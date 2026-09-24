const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },   // snapshot so the review keeps its author name
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, default: '', maxlength: 800 },
  // true when the reviewer actually received this product in a delivered order
  verified: { type: Boolean, default: false },
}, { timestamps: true });

// one review per user per product — re-submitting updates the existing one
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);