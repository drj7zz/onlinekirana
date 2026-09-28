const mongoose = require('mongoose');

/**
 * A delivery job. Created for every order at checkout and driven forward by the
 * rider (and, for the handoff steps, the admin/partner).
 *
 * Kept as a separate document from the Order so that courier concerns
 * (assignment, route, proof of delivery) can be indexed, filtered and reported
 * on without ever touching the customer's basket.
 */
const deliverySchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },

  // 'pending'  — order placed, waiting for an admin to hand it to a rider
  // 'assigned' — a rider is on it, they haven't accepted the job yet
  // 'accepted' — rider accepted and is heading to the shop to collect
  // 'picked'   — goods collected from the shop, on the way to the customer
  // 'delivered'— dropped off, proof captured
  // 'failed'   — rider couldn't deliver, admin decides the refund
  status: {
    type: String,
    enum: ['pending', 'assigned', 'accepted', 'picked', 'delivered', 'failed'],
    default: 'pending',
    index: true,
  },

  rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

  // denormalised copies so the dispatch list renders without a join
  pickup: {
    shopName: String,
    line: String,
    ward: String,
    phone: String,
  },
  dropoff: {
    name: String,
    line: String,
    ward: String,
    phone: String,
  },

  // the customer picked one of the published slots at checkout
  slot: { type: String, default: null },

  // amount the customer paid for delivery (charged at checkout, not at drop-off)
  fee: { type: Number, default: 0, min: 0 },

  // 4-digit code the customer must read out to the rider — proves hand-over
  // happened and that the goods were actually received
  otp: { type: String, required: true },

  // short note from the customer, e.g. "ring the bell twice"
  instructions: { type: String, default: '', maxlength: 300 },

  proofImageUrl: { type: String, default: '' },
  attemptNote: { type: String, default: '', maxlength: 300 },

  // who marked what delivered, and when — used for disputes
  completedBy: { type: String, enum: ['rider', 'customer', 'admin', null], default: null },

  // dispatch bookkeeping — 'auto' means no human ever pressed assign
  assignedAt: Date,
  assignedBy: { type: String, enum: ['auto', 'admin', 'rider', null], default: null },

  // what the rider earns if this drop goes through (paid on delivery)
  riderEarning: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

deliverySchema.index({ status: 1, createdAt: -1 });
deliverySchema.index({ rider: 1, status: 1 });

module.exports = mongoose.model('Delivery', deliverySchema);
