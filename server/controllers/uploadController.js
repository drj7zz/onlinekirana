const path = require('path');
const User = require('../models/User');
const Product = require('../models/Product');
const { UPLOAD_ROOT } = require('../middleware/upload');
const { serverError } = require('../utils/errors');

// DELETE the previous file (if it was one of ours) so uploads don't pile up forever
async function removeOld(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  const abs = path.join(UPLOAD_ROOT, publicPath.replace('/uploads/', ''));
  const fs = require('fs');
  fs.promises.unlink(abs).catch(() => {});
}

// POST /api/uploads/avatar  (multipart: image)  → sets user.avatarUrl
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image received' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await removeOld(user.avatarUrl);
    user.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await user.save();
    res.json({ url: user.avatarUrl });
  } catch (e) {
    serverError(res, e);
  }
};

// POST /api/uploads/shop-logo  (merchant only)  → sets user.shopLogoUrl
exports.uploadShopLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image received' });
    if (req.user.role !== 'merchant') return res.status(403).json({ message: 'Merchant (partner) access only' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await removeOld(user.shopLogoUrl);
    user.shopLogoUrl = `/uploads/shops/${req.file.filename}`;
    await user.save();
    res.json({ url: user.shopLogoUrl });
  } catch (e) {
    serverError(res, e);
  }
};

// POST /api/uploads/product  (merchant or admin)  → returns URL, caller attaches it to the product
exports.uploadProductImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image received' });
    const url = `/uploads/products/${req.file.filename}`;
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
