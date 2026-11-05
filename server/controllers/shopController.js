const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { cleanStr, PHONE_RE } = require('../middleware/validate');
const { serverError } = require('../utils/errors');
const { cached, cacheInvalidate } = require('../lib/platform');
const { encryptPII } = require('../lib/piiCrypto');

// The shop's public username: a slug of the shop name so the merchant gets a
// solid identity (onlinekirana.com/shop/new-mithai-bhatti) instead of a random
// Mongo id. On a collision, a short numeric suffix is appended.
const slugifyShop = (name) => name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '');
const uniqueShopUsername = async (base, currentUserId) => {
  const clean = slugifyShop(base) || 'shop';
  let candidate = clean;
  for (let n = 2; n < 50; n += 1) {
    // eslint-disable-next-line no-await-in-loop
    const taken = await User.findOne({ shopUsername: candidate, _id: { $ne: currentUserId } }).select('_id').lean();
    if (!taken) return candidate;
    candidate = `${clean}-${n}`;
  }
  return `${clean}-${Date.now().toString(36)}`;
};

// Public view of a shop — only approved partners get a live shop page
const publicShop = (u, rating) => ({
  id: u._id,
  username: u.shopUsername || '',
  mapsUrl: u.shopGoogleMapsUrl || '',
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
    // low-stock alerts: products the shop manager must reorder soon
    const LOW_STOCK_LIMIT = 10;
    const lowStock = await Product.find({ merchant: user._id, isActive: true, stock: { $lte: LOW_STOCK_LIMIT } })
      .select('name stock unit').sort({ stock: 1 }).limit(10).lean();
    res.json({
      ...publicShop(user, await shopRating(user._id)),
      pickupLocation: user.shopAddress?.location || null,
      lowStock: lowStock.map((p) => ({ id: p._id, name: p.name, stock: p.stock, unit: p.unit })),
    });
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
    const mapsUrl = cleanStr(req.body.mapsUrl, 300);
    const line = cleanStr(req.body.address?.line, 200);
    const ward = cleanStr(req.body.address?.ward, 20);
    const pickupLocation = req.body.pickupLocation;
    const hasLat = pickupLocation?.lat !== undefined && pickupLocation?.lat !== null;
    const hasLng = pickupLocation?.lng !== undefined && pickupLocation?.lng !== null;
    const lat = Number(pickupLocation?.lat);
    const lng = Number(pickupLocation?.lng);

    if (shopName !== undefined && !shopName) errors.shopName = 'Shop name is required';
    if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a valid Nepali mobile (98XXXXXXXX)';
    if (mapsUrl && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(mapsUrl)) {
      errors.mapsUrl = 'Paste a Google Maps link for your shop listing.';
    }
    if (hasLat !== hasLng || (hasLat && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180))) {
      errors.pickupLocation = 'Save a valid shop location from your device.';
    }
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Validation failed', errors });

    user.shopName = shopName || user.shopName;
    user.shopDescription = description;
    user.shopPhone = phone;
    user.shopLogoUrl = logoUrl;
    if (mapsUrl !== undefined) user.shopGoogleMapsUrl = mapsUrl;
    // keep the public username in step with the shop name; never blank it out
    if (shopName && (!user.shopUsername || shopName !== user.shopName)) {
      // eslint-disable-next-line no-await-in-loop
      user.shopUsername = await uniqueShopUsername(shopName, user._id);
    }
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
