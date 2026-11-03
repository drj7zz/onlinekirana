const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validateRegister, validateLogin, validatePassword } = require('../middleware/validate');
const { loginIp } = require('../middleware/rateLimit');
const { revokeAllSessions } = require('../lib/platform');
const { verifyGoogleCredential } = require('../lib/googleIdentity');

const { signToken } = require('../lib/tokens');

const publicUser = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role,
  avatarUrl: u.avatarUrl || undefined,
  hasPassword: Boolean(u.password),
  shopName: u.shopName || undefined, merchantStatus: u.merchantStatus || undefined,
  riderStatus: u.riderStatus || undefined, riderArea: u.riderArea || undefined, riderVehicle: u.riderVehicle || undefined,
});

async function findOrLinkGoogleAccount(identity) {
  let user = await User.findOne({ googleSub: identity.sub }).select('+googleSub');
  if (user) {
    if (user.role !== 'customer') {
      const error = new Error('Use the partner portal to sign in to this account.');
      error.status = 403;
      throw error;
    }
    if (user.email !== identity.email) {
      const error = new Error('Your Google email changed. Sign in with your password and contact support to update the account.');
      error.status = 409;
      throw error;
    }
    return user;
  }

  user = await User.findOne({ email: identity.email }).select('+googleSub');
  if (!user) return null;
  if (user.role !== 'customer') {
    const error = new Error('This email belongs to a partner account. Sign in on the partner portal.');
    error.status = 409;
    throw error;
  }
  if (user.googleSub && user.googleSub !== identity.sub) {
    const error = new Error('This email is already linked to a different Google account.');
    error.status = 409;
    throw error;
  }

  user.googleSub = identity.sub;
  if (!user.avatarUrl && identity.picture) user.avatarUrl = identity.picture;
  await user.save();
  return user;
}

exports.googleLogin = async (req, res) => {
  try {
    const identity = await verifyGoogleCredential(req.body?.credential);
    const user = await findOrLinkGoogleAccount(identity);
    if (!user) {
      return res.json({
        registrationRequired: true,
        profile: { name: identity.name, email: identity.email },
      });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ code: error.code, message: error.message });
    if (error.code === 11000) return res.status(409).json({ message: 'This Google account is already linked to another account.' });
    console.error('[auth] Google sign-in failed:', error.message);
    res.status(500).json({ message: 'Google sign-in could not be completed. Please try again.' });
  }
};

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
        // Belt & braces for legacy rows created before the in-app code step was
        // removed: verification no longer blocks sign-in.
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
    let googleIdentity = null;
    try {
      const { name, email, password, phone, address, role, shopName, riderArea, riderVehicle } = req.body;
      const googleCredential = req.body.googleCredential || '';
      if (googleCredential) {
        googleIdentity = await verifyGoogleCredential(googleCredential);
        if (googleIdentity.email !== email) {
          return res.status(400).json({ message: 'Use the same email address you selected with Google.' });
        }
        if (role === 'merchant' || role === 'delivery') {
          return res.status(400).json({ message: 'Google signup is only available for customer accounts.' });
        }
        const existing = await findOrLinkGoogleAccount(googleIdentity);
        if (existing) {
          return res.status(200).json({ token: signToken(existing), user: publicUser(existing) });
        }
      } else if (await User.findOne({ email })) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      // validateRegister already reduced an unknown role to undefined, so this
      // can only be customer, merchant or delivery. Both partner roles start
      // `pending`: the account exists, but nobody can trade or deliver until an
      // admin approves it from the portal.
      const isMerchant = role === 'merchant';
      const isRider = role === 'delivery';
      const user = await User.create({
        name, email, password: password || undefined,
        passwordless: Boolean(googleIdentity && !password),
        ...(googleIdentity && { googleSub: googleIdentity.sub, avatarUrl: googleIdentity.picture }),
        phone: phone || undefined,
        address: address?.line ? { line: address.line, city: 'Birgunj', ward: address.ward } : undefined,
        role: isMerchant ? 'merchant' : isRider ? 'delivery' : 'customer',
        // The in-app email-code step is gone: every new account is signed in
        // immediately and goes to admin review, exactly like before.
        emailVerified: true,
        ...(isMerchant && { shopName, merchantStatus: 'pending' }),
        ...(isRider && {
          riderArea: riderArea || undefined,
          riderVehicle: riderVehicle || undefined,
          riderStatus: 'pending',
        }),
      });

      res.status(201).json({ token: signToken(user), user: publicUser(user) });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ code: e.code, message: e.message });
      if (e.code === 11000 && googleIdentity) {
        try {
          const existing = await findOrLinkGoogleAccount(googleIdentity);
          if (existing) return res.status(200).json({ token: signToken(existing), user: publicUser(existing) });
        } catch (linkError) {
          if (linkError.status) return res.status(linkError.status).json({ code: linkError.code, message: linkError.message });
        }
      }
      if (e.code === 11000) return res.status(409).json({ message: 'Email already registered' });
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  },
];

// The in-app email verification-code flow has been removed entirely — see
// lib/email.js. These endpoints are gone from the routes file as well.

// Password strength check (used by the client meter)
exports.checkStrength = (req, res) => {
  const errors = validatePassword(String(req.body?.password || '').slice(0, 72));
  res.json({ ok: errors.length === 0, errors });
};
