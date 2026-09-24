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
  deliveryAddress: {
    line: { type: String, required: true },
    city: { type: String, default: 'Birgunj' },
    ward: String,
    phone: { type: String, required: true },
  },
  paymentMethod: { type: String, enum: ['cod', 'esewa'], default: 'cod' },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending',
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
