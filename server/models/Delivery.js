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

  // 'pending'  — order placed; riders see it only after the shop packs it
  // 'assigned' — a rider accepted the job and owns it
  // 'accepted' — rider accepted and is heading to the shop to collect
  // 'picked'   — goods collected from the shop, on the way to the customer
  // 'delivered'— dropped off, proof captured
  // 'failed'   — rider couldn't deliver; operations reviews the failed handoff
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
    location: { lat: Number, lng: Number },
  },
  dropoff: {
    name: String,
    line: String,
    ward: String,
    phone: String,
    location: { lat: Number, lng: Number },
  },

  // the customer picked one of the published slots at checkout
  slot: { type: String, default: null },

  // Delivery fee snapshot, including the late-night estimate when enabled.
  fee: { type: Number, default: 0, min: 0 },
  distanceKm: { type: Number, min: 0, default: null },

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

  // Reserved for a future rider compensation configuration. Pay is not calculated yet.
  riderEarning: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

deliverySchema.index({ status: 1, createdAt: -1 });
deliverySchema.index({ rider: 1, status: 1 });

module.exports = mongoose.model('Delivery', deliverySchema);
