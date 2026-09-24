const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const { cleanStr, PHONE_RE } = require('../middleware/validate');
const { serverError } = require('../utils/errors');

// Public view of a shop — only approved partners get a live shop page
const publicShop = (u) => ({
  id: u._id,
  shopName: u.shopName,
  description: u.shopDescription || '',
  phone: u.shopPhone || '',
  logoUrl: u.shopLogoUrl || '',
  address: { line: u.shopAddress?.line || '', ward: u.shopAddress?.ward || '', city: u.shopAddress?.city || 'Birgunj' },
  memberSince: u.createdAt,
  merchantStatus: u.merchantStatus,
});

// ---- Merchant: load my shop profile for the setup page ----
exports.myShop = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(publicShop(user));
  } catch (e) {
    serverError(res, e);
  }
};

// ---- Merchant: update shop profile (shop setup page) ----
exports.updateMyShop = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const errors = {};
    const shopName = cleanStr(req.body.shopName, 80);
    const description = cleanStr(req.body.description, 600);
    const phone = cleanStr(req.body.phone, 15);
    const logoUrl = cleanStr(req.body.logoUrl, 300);
    const line = cleanStr(req.body.address?.line, 200);
    const ward = cleanStr(req.body.address?.ward, 20);

    if (shopName !== undefined && !shopName) errors.shopName = 'Shop name is required';
    if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a valid Nepali mobile (98XXXXXXXX)';
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Validation failed', errors });

    user.shopName = shopName || user.shopName;
    user.shopDescription = description;
    user.shopPhone = phone;
    user.shopLogoUrl = logoUrl;
    user.shopAddress = { line, ward, city: 'Birgunj' };
    await user.save();

    res.json(publicShop(user));
  } catch (e) {
    serverError(res, e);
  }
};

// ---- Public: shop page — shop info + its live (approved) products ----
exports.getShop = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Shop not found' });
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'merchant' || user.merchantStatus !== 'approved') {
      return res.status(404).json({ message: 'Shop not found' });
    }
    const products = await Product.find({ merchant: user._id, isActive: true, status: 'approved' })
      .sort({ createdAt: -1 });
    res.json({ shop: publicShop(user), products });
  } catch (e) {
    serverError(res, e);
  }
};

// Public: list all live shops (used for discovery later)
exports.listShops = async (req, res) => {
  try {
    const shops = await User.find({ role: 'merchant', merchantStatus: 'approved' })
      .select('shopName shopDescription shopLogoUrl shopAddress createdAt');
    res.json(shops.map(publicShop));
  } catch (e) {
    serverError(res, e);
  }
};
