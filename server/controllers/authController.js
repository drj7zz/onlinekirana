const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validateRegister, validateLogin, validatePassword } = require('../middleware/validate');
const { loginIp } = require('../middleware/rateLimit');
const { notifyUsers } = require('../utils/notifications');
const { revokeAllSessions } = require('../lib/platform');
const {
  hashVerificationCode,
  issueVerificationCode,
  MAX_CODE_ATTEMPTS,
} = require('../lib/emailVerification');
const {
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
          message: 'Complete the in-app verification code step before signing in to the partner portal.',
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
        const verificationCode = await issueVerificationCode(user);
        return res.status(202).json({
          verificationRequired: true,
          email: user.email,
          verificationCode,
          message: 'Enter the in-app code to continue to application review.',
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
  const password = String(req.body?.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !password) {
    return res.status(400).json({ message: 'Enter the application email and password.' });
  }
  try {
    const user = await User.findOne({
      email,
      role: { $in: ['merchant', 'delivery'] },
      emailVerified: false,
    }).select('+password');
    const passwordMatches = await bcrypt.compare(password, user?.password || DUMMY_HASH);
    if (!user || !passwordMatches) {
      return res.status(400).json({ message: 'Could not issue a code for those credentials. Check the email and password.' });
    }

    const verificationCode = await issueVerificationCode(user);
    res.json({
      verificationCode,
      message: 'Enter this in-app code to continue. It expires in 15 minutes.',
    });
  } catch (error) {
    console.error('[auth] verification code resend failed:', error.message);
    res.status(500).json({ message: 'A new verification code could not be issued. Please try again.' });
  }
};

exports.verifyEmail = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: 'Enter the email address and six-digit code.' });
  }
  try {
    const user = await User.findOne({
      email,
      role: { $in: ['merchant', 'delivery'] },
      emailVerified: false,
    }).select('+emailVerificationCodeHash +emailVerificationExpires +emailVerificationAttempts');
    if (!user || !user.emailVerificationCodeHash
      || !user.emailVerificationExpires || user.emailVerificationExpires <= new Date()
      || user.emailVerificationAttempts >= MAX_CODE_ATTEMPTS) {
      return res.status(400).json({ message: 'That code is invalid or expired. Request a new code.' });
    }
    const submittedHash = Buffer.from(hashVerificationCode(code), 'hex');
    const storedHash = Buffer.from(user.emailVerificationCodeHash, 'hex');
    if (!crypto.timingSafeEqual(submittedHash, storedHash)) {
      user.emailVerificationAttempts += 1;
      if (user.emailVerificationAttempts >= MAX_CODE_ATTEMPTS) {
        user.emailVerificationCodeHash = undefined;
        user.emailVerificationExpires = undefined;
      }
      await user.save();
      return res.status(400).json({ message: 'That code is invalid or expired. Request a new code.' });
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationAttempts = 0;
    await user.save();

    await sendBestEffort('partner application email', () => sendApplicationReceivedEmail(user));
    try {
      const admins = await User.find({ role: 'admin' }).select('_id').lean();
      await notifyUsers(admins.map((admin) => admin._id), {
        type: 'approval',
        title: user.role === 'merchant' ? 'Shop application received' : 'Rider application received',
        body: `${user.name} completed the in-app code step and is waiting for account approval.`,
        link: '/admin/partners',
      });
    } catch (error) {
      console.error('[notifications] application notice failed:', error.message);
    }
    res.json({ message: 'Code accepted. Your application is now waiting for admin review.' });
  } catch (error) {
    console.error('[auth] verification code check failed:', error.message);
    res.status(500).json({ message: 'The verification code could not be checked. Please try again.' });
  }
};

// Password strength check (used by the client meter)
exports.checkStrength = (req, res) => {
  const errors = validatePassword(String(req.body?.password || '').slice(0, 72));
  res.json({ ok: errors.length === 0, errors });
};
