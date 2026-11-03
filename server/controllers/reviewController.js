const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const { serverError } = require('../utils/errors');

const clampRating = (n) => {
  const r = Math.round(Number(n));
  return Number.isFinite(r) ? Math.min(5, Math.max(1, r)) : null;
};

// GET /api/reviews/product/:productId — public list + summary
exports.listForProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const filter = { product: req.params.productId };
    const idFields = { id: '$product', title: '$name' };
    const kind = 'product';
    return listFor(req, res, filter, idFields, kind);
  } catch (e) {
    serverError(res, e);
  }
};

// GET /api/reviews/shop/:shopId — public list + summary for a shop
exports.listForShop = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.shopId)) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    const filter = { shop: req.params.shopId };
    return listFor(req, res, filter, { id: '$shop', title: '$shopName' }, 'shop');
  } catch (e) {
    serverError(res, e);
  }
};

// Shared reader: same shape for product and shop reviews.
const listFor = async (req, res, filter, idFields, kind) => {
  const reviews = await Review.find(filter).sort({ createdAt: -1 });

  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  // star distribution (5→1) powers the rating bars in the UI
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  res.json({
    kind,
    idFields,
    reviews,
    summary: { count, average: Math.round(avg * 10) / 10, breakdown },
  });
};

// POST /api/reviews/product/:productId — create or update the caller's review
exports.upsertProduct = async (req, res) => upsert(req, res, 'product');

// POST /api/reviews/shop/:shopId — any logged-in user can rate a shop
exports.upsertShop = async (req, res) => upsert(req, res, 'shop');

// Shared writer: same shape for product and shop reviews.
const upsert = async (req, res, kind) => {
  try {
    const targetId = req.params.productId || req.params.shopId;
    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(404).json({ message: kind === 'product' ? 'Product not found' : 'Shop not found' });
    }

    let target = null;
    let bought = null;
    if (kind === 'product') {
      target = await Product.findById(targetId).select('_id');
      if (!target) return res.status(404).json({ message: 'Product not found' });
      // "Verified purchase" = this user has a delivered order containing the product
      bought = await Order.exists({
        user: req.user.id,
        status: 'delivered',
        'items.product': target._id,
      });
    } else {
      target = await User.findOne({ _id: targetId, role: 'merchant', merchantStatus: 'approved' }).select('_id');
      if (!target) return res.status(404).json({ message: 'Shop not found' });
      // Merchants can't rate their own shop.
      if (String(target._id) === String(req.user.id)) {
        return res.status(403).json({ message: 'You cannot review your own shop' });
      }
    }

    const rating = clampRating(req.body.rating);
    if (!rating) return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    const comment = String(req.body.comment || '').slice(0, 800).trim();

    const filter = kind === 'product' ? { product: target._id, user: req.user.id } : { shop: target._id, user: req.user.id };
    const update = kind === 'product' ? { rating, comment, name: req.user.name || 'Customer', verified: !!bought } : { rating, comment, name: req.user.name || 'Customer' };
    const review = await Review.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(201).json(review);
  } catch (e) {
    serverError(res, e);
  }
};

// DELETE /api/reviews/:id — author (or admin) removes their review
exports.remove = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (String(review.user) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not allowed' });
    }
    await review.deleteOne();
    res.json({ message: 'Review removed' });
  } catch (e) {
    serverError(res, e);
  }
};