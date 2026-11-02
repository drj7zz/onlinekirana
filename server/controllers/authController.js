const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validateRegister, validateLogin, validatePassword } = require('../middleware/validate');
const { loginIp } = require('../middleware/rateLimit');
const { notifyUsers } = require('../utils/notifications');
const { revokeAllSessions } = require('../lib/platform');
const { hashVerificationToken, issueVerificationToken } = require('../lib/emailVerification');
const {
  sendVerificationEmail,
  sendApplicationReceivedEmail,
  sendBestEffort,
} = require('../lib/email');

const { signToken } = require('../lib/tokens');

const publicUser = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role,
  avatarUrl: u.avatarUrl || undefined,
  shopName: u.shopName || undefined, merchantStatus: u.merchantStatus || undefined,
  riderStatus: u.riderStatus || undefined, riderArea: u.riderArea || undefined, riderVehicle: u.riderVehicle || undefined,
});

// ---- LOGIN: rate-limited per IP + per account; identical failure response (no user enumeration) ----
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy', 12);
// POST /api/auth/logout — revoke the caller's token in Redis (instant, server-side)
exports.logout = async (req, res) => {
  try { await revokeSession(String(req.user.id), req.user.jti); } catch { /* best-effort */ }
  res.json({ message: 'Logged out' });
};

/**
 * The storefront and the partner portal share this one endpoint but serve
 * different people. Each app declares which roles it accepts via `scope`, and a
 * merchant can never mint a session on the shopper app (or vice versa). Login
 * without a scope stays unrestricted for the portal, which is the business app.
 */
const SCOPES = {
  customer: ['customer'],
  portal: ['merchant', 'delivery', 'admin'],
};

exports.login = [
  validateLogin,
  async (req, res) => {
    try {
      const { email, password, scope } = req.body;
      const user = await User.findOne({ email });
      const hash = user?.password || DUMMY_HASH;
      const ok = await bcrypt.compare(password, hash);

      if (!user || !ok) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (['merchant', 'delivery'].includes(user.role) && !user.emailVerified) {
        return res.status(403).json({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Verify your email before signing in to the partner portal.',
        });
      }

      // Migrate older bcrypt hashes to the current work factor after a valid
      // password check, without forcing users through a reset flow.
      if (bcrypt.getRounds(user.password) < 12) {
        user.password = password;
        await user.save();
      }

      const allowed = SCOPES[scope];
      if (allowed && !allowed.includes(user.role)) {
        // Verified the credentials, so this is not an enumeration risk — it is a
        // "you are in the wrong building" message with the right door named.
        const isPartner = user.role !== 'customer';
        const role = user.role;
        const article = /^[aeiou]/i.test(role) ? 'an' : 'a';
        return res.status(403).json({
          message: isPartner
            ? `That is ${article} ${role} account. Partners sign in on the partner portal.`
            : 'That is a shopper account. Sign in on the storefront.',
          portal: isPartner,
        });
      }

      res.json({ token: signToken(user), user: publicUser(user) });
    } catch (e) {
      res.status(500).json({ message: 'Login failed. Please try again.' });
    }
  },
];

// ---- REGISTER: full server-side validation; role can only become 'merchant'
// or 'delivery', never 'admin' ----
exports.register = [
  validateRegister,
  async (req, res) => {
    try {
      const { name, email, password, phone, address, role, shopName, riderArea, riderVehicle } = req.body;
      if (await User.findOne({ email })) return res.status(409).json({ message: 'Email already registered' });

      // validateRegister already reduced an unknown role to undefined, so this
      // can only be customer, merchant or delivery. Both partner roles start
      // `pending`: the account exists, but nobody can trade or deliver until an
      // admin approves it from the portal.
      const isMerchant = role === 'merchant';
      const isRider = role === 'delivery';
      const user = await User.create({
        name, email, password,
        phone: phone || undefined,
        address: address?.line ? { line: address.line, city: 'Birgunj', ward: address.ward } : undefined,
        role: isMerchant ? 'merchant' : isRider ? 'delivery' : 'customer',
        emailVerified: !isMerchant && !isRider,
        ...(isMerchant && { shopName, merchantStatus: 'pending' }),
        ...(isRider && {
          riderArea: riderArea || undefined,
          riderVehicle: riderVehicle || undefined,
          riderStatus: 'pending',
        }),
      });

      if (isMerchant || isRider) {
        const token = await issueVerificationToken(user);
        try {
          await sendVerificationEmail(user, token);
        } catch (error) {
          console.error('[email] partner verification email failed:', error.message);
          return res.status(503).json({
            code: 'VERIFICATION_EMAIL_UNAVAILABLE',
            message: 'Your application was saved, but we could not send the verification email. Use resend verification to try again.',
            email: user.email,
          });
        }
        return res.status(202).json({
          verificationRequired: true,
          email: user.email,
          message: 'Check your email for a verification link before signing in.',
        });
      }

      res.status(201).json({ token: signToken(user), user: publicUser(user) });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ message: 'Email already registered' });
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  },
];

exports.resendVerification = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  try {
    const user = await User.findOne({
      email,
      role: { $in: ['merchant', 'delivery'] },
      emailVerified: false,
    });
    if (!user) {
      return res.json({ message: 'If an unverified partner application exists for this address, a new link will be sent.' });
    }

    const token = await issueVerificationToken(user);
    await sendVerificationEmail(user, token);
    res.json({ message: 'If an unverified partner application exists for this address, a new link will be sent.' });
  } catch (error) {
    console.error('[email] verification resend failed:', error.message);
    res.status(503).json({ message: 'Verification email is temporarily unavailable. Please try again later.' });
  }
};

exports.verifyEmail = async (req, res) => {
  const token = String(req.body?.token || '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return res.status(400).json({ message: 'This verification link is invalid or expired. Request a new one.' });
  }
  try {
    const user = await User.findOne({
      emailVerificationTokenHash: hashVerificationToken(token),
      emailVerificationExpires: { $gt: new Date() },
      role: { $in: ['merchant', 'delivery'] },
      emailVerified: false,
    }).select('+emailVerificationTokenHash +emailVerificationExpires');
    if (!user) {
      return res.status(400).json({ message: 'This verification link is invalid or expired. Request a new one.' });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    await sendBestEffort('partner application email', () => sendApplicationReceivedEmail(user));
    try {
      const admins = await User.find({ role: 'admin' }).select('_id').lean();
      await notifyUsers(admins.map((admin) => admin._id), {
        type: 'approval',
        title: user.role === 'merchant' ? 'Shop application received' : 'Rider application received',
        body: `${user.name} verified their email and is waiting for account approval.`,
        link: '/admin/partners',
      });
    } catch (error) {
      console.error('[notifications] application notice failed:', error.message);
    }
    res.json({ message: 'Email verified. Your application is now waiting for admin review.' });
  } catch (error) {
    console.error('[auth] email verification failed:', error.message);
    res.status(500).json({ message: 'Email verification could not be completed. Please try again.' });
  }
};

// Password strength check (used by the client meter)
exports.checkStrength = (req, res) => {
  const errors = validatePassword(String(req.body?.password || '').slice(0, 72));
  res.json({ ok: errors.length === 0, errors });
};
