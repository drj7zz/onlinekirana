const path = require('path');
const User = require('../models/User');
const Product = require('../models/Product');
const { UPLOAD_ROOT, cloudEnabled, removeOld } = require('../middleware/upload');
const { serverError } = require('../utils/errors');
const { encryptPII } = require('../lib/piiCrypto');

// POST /api/uploads/avatar  (multipart: image)  → sets user.avatarUrl
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image received' });
    const url = req.uploadedUrl || (cloudEnabled ? req.file.cloudinaryUrl : `/uploads/avatars/${req.file.filename}`);
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await removeOld(user.avatarUrl);
    user.avatarUrl = url;
    await user.save();
    res.json({ url: user.avatarUrl });
  } catch (e) {
    serverError(res, e);
  }
};

// DELETE /api/uploads/avatar — remove the signed-in user's profile photo.
exports.removeAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await removeOld(user.avatarUrl);
    user.avatarUrl = '';
    await user.save();
    res.json({ url: '' });
  } catch (e) {
    serverError(res, e);
  }
};

// POST /api/uploads/shop-logo  (merchant only)  → sets user.shopLogoUrl
exports.uploadShopLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image received' });
    if (req.user.role !== 'merchant') return res.status(403).json({ message: 'Merchant (partner) access only' });
    const url = req.uploadedUrl || (cloudEnabled ? req.file.cloudinaryUrl : `/uploads/shops/${req.file.filename}`);
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await removeOld(user.shopLogoUrl);
    user.shopLogoUrl = url;
    await user.save();
    res.json({ url: user.shopLogoUrl });
  } catch (e) {
    serverError(res, e);
  }
};

// POST /api/uploads/product  (merchant or admin)  → returns URL, caller attaches it to the product
exports.uploadProductImage = async (req, res) => {
  try {
    if (!['merchant', 'admin', 'delivery'].includes(req.user.role)) return res.status(403).json({ message: 'Image upload is not available for this account.' });
    if (!req.file) return res.status(400).json({ message: 'No image received' });
    const url = req.uploadedUrl || (cloudEnabled ? req.file.cloudinaryUrl : `/uploads/products/${req.file.filename}`);
    if (req.query.linkTo) {
      const filter = req.user.role === 'admin'
        ? { _id: req.query.linkTo }
        : { _id: req.query.linkTo, merchant: req.user.id };
      await Product.updateOne(filter, { imageUrl: url });
    }
    res.json({ url });
  } catch (e) {
    serverError(res, e);
  }
};
