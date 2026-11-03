const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // A review is attached to either a product or a shop — never both.
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },   // snapshot so the review keeps its author name
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, default: '', maxlength: 800 },
  // true when the reviewer actually received this product in a delivered order
  verified: { type: Boolean, default: false },
}, { timestamps: true });

// one review per user per product — re-submitting updates the existing one
reviewSchema.index({ product: 1, user: 1 }, { unique: true, partialFilterExpression: { product: { $type: 'objectId' } } });
// …and one per user per shop
reviewSchema.index({ shop: 1, user: 1 }, { unique: true, partialFilterExpression: { shop: { $type: 'objectId' } } });

module.exports = mongoose.model('Review', reviewSchema);