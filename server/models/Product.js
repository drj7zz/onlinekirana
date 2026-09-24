const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  // category: rice/dal/oil, sabzi (vegetables), fruits, dairy, snacks, masala, etc.
  category: { type: String, required: true, index: true },
  price: { type: Number, required: true, min: 0 },       // NPR per unit
  unit: { type: String, default: 'kg' },                  // kg, litre, packet, piece
  stock: { type: Number, required: true, min: 0, default: 0 },
  imageUrl: { type: String, default: '' },
  discountPercent: { type: Number, default: 0, min: 0, max: 90 },
  isActive: { type: Boolean, default: true },
  // merchant ownership + admin moderation
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = listed by admin
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
}, { timestamps: true });

productSchema.index({ name: 'text', category: 'text' });

productSchema.virtual('finalPrice').get(function () {
  return Math.round(this.price * (1 - this.discountPercent / 100) * 100) / 100;
});
productSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
