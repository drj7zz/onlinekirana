const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
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
    const reviews = await Review.find({ product: req.params.productId }).sort({ createdAt: -1 });

    const count = reviews.length;
    const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

    // star distribution (5→1) powers the rating bars in the UI
    const breakdown = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => r.rating === star).length,
    }));

    res.json({
      reviews,
      summary: { count, average: Math.round(avg * 10) / 10, breakdown },
    });
  } catch (e) {
    serverError(res, e);
  }
};

// POST /api/reviews/product/:productId — create or update the caller's review
exports.upsert = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const product = await Product.findById(req.params.productId).select('_id');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const rating = clampRating(req.body.rating);
    if (!rating) return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    const comment = String(req.body.comment || '').slice(0, 800).trim();

    // "Verified purchase" = this user has a delivered order containing the product
    const bought = await Order.exists({
      user: req.user.id,
      status: 'delivered',
      'items.product': product._id,
    });

    const review = await Review.findOneAndUpdate(
      { product: product._id, user: req.user.id },
      { rating, comment, name: req.user.name || 'Customer', verified: !!bought },
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