const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validateRegister, validateLogin, validatePassword } = require('../middleware/validate');
const { loginIp, loginAccount } = require('../middleware/rateLimit');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

const publicUser = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role,
  shopName: u.shopName || undefined, merchantStatus: u.merchantStatus || undefined,
});

// ---- LOGIN: rate-limited per IP + per account; identical failure response (no user enumeration) ----
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy', 10);

exports.login = [
  loginIp,
  validateLogin,
  loginAccount,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      const hash = user?.password || DUMMY_HASH;
      const ok = await bcrypt.compare(password, hash);

      if (!user || !ok) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      res.json({ token: signToken(user), user: publicUser(user) });
    } catch (e) {
      res.status(500).json({ message: 'Login failed. Please try again.' });
    }
  },
];

// ---- REGISTER: full server-side validation; role can only become 'merchant', never 'admin' ----
exports.register = [
  validateRegister,
  async (req, res) => {
    try {
      const { name, email, password, phone, address, role, shopName } = req.body;
      if (await User.findOne({ email })) return res.status(409).json({ message: 'Email already registered' });

      const isMerchant = role === 'merchant';
      const user = await User.create({
        name, email, password,
        phone: phone || undefined,
        address: address?.line ? { line: address.line, city: 'Birgunj', ward: address.ward } : undefined,
        role: isMerchant ? 'merchant' : 'customer',
        ...(isMerchant && { shopName, merchantStatus: 'pending' }),
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
