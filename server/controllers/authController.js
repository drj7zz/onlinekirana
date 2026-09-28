const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validateRegister, validateLogin, validatePassword } = require('../middleware/validate');
const { loginIp, loginAccount } = require('../middleware/rateLimit');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

const publicUser = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role,
  avatarUrl: u.avatarUrl || undefined,
  shopName: u.shopName || undefined, merchantStatus: u.merchantStatus || undefined,
  riderStatus: u.riderStatus || undefined, riderArea: u.riderArea || undefined, riderVehicle: u.riderVehicle || undefined,
});

// ---- LOGIN: rate-limited per IP + per account; identical failure response (no user enumeration) ----
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy', 10);

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
  loginIp,
  validateLogin,
  loginAccount,
  async (req, res) => {
    try {
      const { email, password, scope } = req.body;
      const user = await User.findOne({ email });
      const hash = user?.password || DUMMY_HASH;
      const ok = await bcrypt.compare(password, hash);

      if (!user || !ok) {
        return res.status(401).json({ message: 'Invalid email or password' });
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
        ...(isMerchant && { shopName, merchantStatus: 'pending' }),
        ...(isRider && {
          riderArea: riderArea || undefined,
          riderVehicle: riderVehicle || undefined,
          riderStatus: 'pending',
        }),
      });

      res.status(201).json({ token: signToken(user), user: publicUser(user) });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ message: 'Email already registered' });
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  },
];

// Password strength check (used by the client meter)
exports.checkStrength = (req, res) => {
  const errors = validatePassword(String(req.body?.password || '').slice(0, 72));
  res.json({ ok: errors.length === 0, errors });
};
