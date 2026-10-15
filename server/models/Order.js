const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: String,
  price: Number,   // final price at time of order
  qty: { type: Number, required: true, min: 1 },
  unit: String,
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [orderItemSchema],
  total: { type: Number, required: true },
  // Delivery fee snapshot, including the late-night pilot estimate when enabled.
  deliveryFee: { type: Number, default: 0, min: 0 },
  // sum of goods + delivery, what the customer actually pays
  grandTotal: { type: Number, default: 0, min: 0 },
  deliveryAddress: {
    line: { type: String, required: true },
    city: { type: String, default: 'Birgunj' },
    ward: String,
    phone: { type: String, required: true },
    location: { lat: Number, lng: Number },
  },
  deliveryDistanceKm: { type: Number, min: 0, default: null },
  paymentMethod: { type: String, enum: ['cod', 'esewa'], default: 'cod' },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
  status: {
    type: String,
    enum: [
      'pending',        // placed, waiting for the shop to confirm
      'confirmed',      // shop accepted the basket
      'packed',         // goods packed, waiting for a rider
      'assigned',       // a rider has been assigned and is coming to collect
      'out_for_delivery', // rider has the goods and is on the way
      'delivered',      // handed over, OTP verified
      'cancelled',      // shop or admin called it off
    ],
    default: 'pending',
  },
  // note left by the customer for the rider (gate code, "ring twice", …)
  deliveryInstructions: { type: String, default: '', maxlength: 300 },
  // kept for the order history / dispute trail
  cancelReason: { type: String, default: '', maxlength: 300 },
  cancelledBy: { type: String, enum: ['customer', 'merchant', 'admin', 'system', null], default: null },
  cancelledAt: { type: Date, default: null },
  cancellationCounted: { type: Boolean, default: false },
}, { timestamps: true });

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'items.merchant': 1, createdAt: -1 });
orderSchema.index({ user: 1, cancelledBy: 1, cancellationCounted: 1, cancelledAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
