const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { cleanStr, PHONE_RE } = require('../middleware/validate');
const { serverError } = require('../utils/errors');
const { cached, cacheInvalidate } = require('../lib/platform');
const { encryptPII } = require('../lib/piiCrypto');

// Public view of a shop — only approved partners get a live shop page
const publicShop = (u, rating) => ({
  id: u._id,
  shopName: u.shopName,
  description: u.shopDescription || '',
  phone: u.shopPhone || '',
  logoUrl: u.shopLogoUrl || '',
  address: { line: u.shopAddress?.line || '', ward: u.shopAddress?.ward || '', city: u.shopAddress?.city || 'Birgunj' },
  memberSince: u.createdAt,
  merchantStatus: u.merchantStatus,
  ratingAverage: rating?.average || 0,
  ratingCount: rating?.count || 0,
});

const shopRating = async (shopId) => {
  const [row] = await Review.aggregate([
    { $match: { shop: shopId } },
    { $group: { _id: '$shop', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return row ? { average: Math.round(row.average * 10) / 10, count: row.count } : { average: 0, count: 0 };
};

// ---- Merchant: load my shop profile for the setup page ----
exports.myShop = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ ...publicShop(user, await shopRating(user._id)), pickupLocation: user.shopAddress?.location || null });
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
    const pickupLocation = req.body.pickupLocation;
    const hasLat = pickupLocation?.lat !== undefined && pickupLocation?.lat !== null;
    const hasLng = pickupLocation?.lng !== undefined && pickupLocation?.lng !== null;
    const lat = Number(pickupLocation?.lat);
    const lng = Number(pickupLocation?.lng);

    if (shopName !== undefined && !shopName) errors.shopName = 'Shop name is required';
    if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a valid Nepali mobile (98XXXXXXXX)';
    if (hasLat !== hasLng || (hasLat && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180))) {
      errors.pickupLocation = 'Save a valid shop location from your device.';
    }
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Validation failed', errors });

    user.shopName = shopName || user.shopName;
    user.shopDescription = description;
    user.shopPhone = phone;
    user.shopLogoUrl = logoUrl;
    user.shopAddress = {
      line, ward, city: 'Birgunj',
      location: hasLat && hasLng ? { lat, lng } : user.shopAddress?.location,
    };
    await user.save();
    // the cached public shop page is now stale
    await cacheInvalidate(`shop:${user._id}`).catch(() => {});

    res.json({ ...publicShop(user, await shopRating(user._id)), pickupLocation: user.shopAddress?.location || null });
  } catch (e) {
    serverError(res, e);
  }
};

// Public: shop info + its live (approved) products — cached 30s per shop.
exports.getShop = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Shop not found' });
    const payload = await cached(`shop:${req.params.id}`, 30, async () => {
      const user = await User.findById(req.params.id);
      if (!user || user.role !== 'merchant' || user.merchantStatus !== 'approved') return null;
      const [products, rating] = await Promise.all([
        Product.find({ merchant: user._id, isActive: true, status: 'approved' }).sort({ createdAt: -1 }),
        shopRating(user._id),
      ]);
      return { shop: publicShop(user, rating), products: JSON.parse(JSON.stringify(products)) };
    });
    if (!payload) return res.status(404).json({ message: 'Shop not found' });
    res.json(payload);
  } catch (e) {
    serverError(res, e);
  }
};

// Public: list all live shops (used for discovery later)
exports.listShops = async (req, res) => {
  try {
    const shops = await User.find({ role: 'merchant', merchantStatus: 'approved' })
      .select('shopName shopDescription shopLogoUrl shopAddress createdAt');
    res.json(await Promise.all(shops.map(async (u) => publicShop(u, await shopRating(u._id)))));
  } catch (e) {
    serverError(res, e);
  }
};
