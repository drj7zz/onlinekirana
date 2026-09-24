const User = require('../models/User');
const { cleanStr, validatePassword, NAME_RE, PHONE_RE } = require('../middleware/validate');
const { serverError } = require('../utils/errors');

// Everything the logged-in user may see about themselves (never the password hash)
const myView = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatarUrl: u.avatarUrl || '',
  phone: u.phone || '',
  address: u.address || { line: '', city: 'Birgunj', ward: '' },
  shopName: u.shopName || '',
  merchantStatus: u.merchantStatus || undefined,
  shopDescription: u.shopDescription || '',
  shopPhone: u.shopPhone || '',
  shopLogoUrl: u.shopLogoUrl || '',
  shopAddress: u.shopAddress || { line: '', ward: '', city: 'Birgunj' },
  createdAt: u.createdAt,
});

// GET /api/profile — used by the Profile page and as checkout's default address
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(myView(user));
  } catch (e) {
    serverError(res, e);
  }
};

// PUT /api/profile — update personal info; address saved here is the default for every order
exports.updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const errors = {};
    const name = cleanStr(req.body.name, 60);
    const phone = cleanStr(req.body.phone, 15);
    const line = cleanStr(req.body.address?.line, 200);
    const ward = cleanStr(req.body.address?.ward, 20);

    if (!name || !NAME_RE.test(name)) errors.name = 'Enter a valid name (letters, 2–60 chars)';
    if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a valid Nepali mobile (98XXXXXXXX)';

    if (Object.keys(errors).length) return res.status(400).json({ message: 'Validation failed', errors });

    user.name = name;
    user.phone = phone || undefined;
    // keep the default-delivery shape: { line, city, ward }
    user.address = {
      line: line || undefined,
      city: 'Birgunj',
      ward: ward || undefined,
    };
    await user.save();
    res.json(myView(user));
  } catch (e) {
    serverError(res, e);
  }
};

// PUT /api/profile/password — verify current password, then set the new one
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await user.comparePassword(String(currentPassword || ''));
    if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });

    const pwErrors = validatePassword(String(newPassword || ''), { name: user.name, email: user.email });
    if (pwErrors.length) return res.status(400).json({ message: 'Validation failed', errors: { newPassword: pwErrors.join(', ') } });

    user.password = String(newPassword); // hashed by the pre('save') hook
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (e) {
    serverError(res, e);
  }
};
