const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Delivery = require('../models/Delivery');
const { serverError } = require('../utils/errors');
const { generateOtp, otpMatches } = require('../utils/otp');
const { feeFor, slotByKey, slotLabel, availableSlots, SLOTS, FREE_OVER } = require('../config/delivery');

// Mirrors the order status a delivery step implies, so the customer's order
// timeline always agrees with what the rider has actually done.
const DELIVERY_TO_ORDER = {
  accepted: 'assigned',
  picked: 'out_for_delivery',
  delivered: 'delivered',
};

// A job can only move forward one step at a time — no skipping from
// "assigned" straight to "delivered".
const NEXT_STEP = {
  pending: ['assigned', 'failed'],
  assigned: ['accepted', 'failed'],
  accepted: ['picked', 'failed'],
  picked: ['delivered', 'failed'],
  delivered: [],
  // A failed job is only ever re-queued by the system (autoDispatch), never
  // pushed forward by a rider, so the only legal target is back to `pending`.
  failed: ['pending'],
};

const pick = (v) => (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null);

/**
 * Resolve a job by id with the extra conditions a handler needs. The route layer
 * already rejects malformed ids, so this only ever returns null for a job that
 * is genuinely absent or belongs to someone else.
 */
const jobOr404 = async (id, extra = {}) => {
  const _id = pick(id);
  if (!_id) return null;
  return Delivery.findOne({ _id, ...extra });
};

/**
 * How much active load one rider may carry before the queue moves on to the
 * next person. Keeps a single rider from stacking up jobs on a busy evening.
 */
const MAX_ACTIVE_JOBS = Number(process.env.RIDER_MAX_JOBS || 3);

/** Normalise a ward number to a clean string; '' when it isn't a number. */
const cleanWard = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? String(n) : '';
};

const listRiders = () => User.find({ role: 'delivery' }).select('-password').sort({ name: 1 });

// ---------- Public / customer ----------

/** GET /api/delivery/options — fees and the slots still promiseable right now. */
exports.options = async (req, res) => {
  try {
    const ward = cleanWard(req.query.ward);
    res.json({
      fee: feeFor(0, ward),
      freeOver: FREE_OVER,
      slots: availableSlots().map(({ key, label }) => ({ key, label })),
    });
  } catch (e) {
    serverError(res, e);
  }
};

/** My delivery code for an order (only the buyer can read it). */
exports.myCode = async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ order: req.params.id });
    if (!delivery) return res.status(404).json({ message: 'No delivery for this order yet' });
    const order = await Order.findById(req.params.id).select('user');
    if (!order || String(order.user) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    res.json({ otp: delivery.otp, slot: delivery.slot, slotLabel: slotLabel(delivery.slot) });
  } catch (e) {
    serverError(res, e);
  }
};

/**
 * POST /api/delivery/orders/:id/confirm — the customer closes their own order.
 *
 * The rider asks for the code at the door, the buyer types it in, and the order
 * flips to `delivered` on the spot. No rider tap, no admin step, no waiting —
 * the only human action in the chain is the person actually receiving the goods.
 */
exports.confirmReceipt = async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ order: req.params.id });
    if (!delivery) return res.status(404).json({ message: 'No delivery for this order yet' });

    const order = await Order.findById(req.params.id);
    if (!order || String(order.user) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    if (delivery.status === 'delivered') {
      return res.json({ status: 'delivered', alreadyDone: true });
    }
    if (!['picked', 'accepted'].includes(delivery.status)) {
      return res.status(400).json({ message: 'Your order has not reached your address yet' });
    }
    if (!otpMatches(req.body.otp, delivery.otp)) {
      return res.status(400).json({ message: 'That code did not match. Check the number in your order card.' });
    }

    delivery.status = 'delivered';
    delivery.completedBy = 'customer';
    delivery.completedAt = new Date();
    await delivery.save();

    order.status = 'delivered';
    if (order.paymentMethod === 'cod' || order.paymentStatus !== 'paid') order.paymentStatus = 'paid';
    order.deliveredAt = new Date();
    await order.save();

    await releaseRiderIfIdle(delivery.rider);
    res.json({ status: 'delivered' });
  } catch (e) {
    serverError(res, e);
  }
};

// ---------- Admin (dispatch desk) ----------

/** GET /api/delivery/orders — the dispatch board: every job, newest first. */
exports.allJobs = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const jobs = await Delivery.find(filter)
      .sort({ createdAt: -1 })
      .populate('rider', 'name phone riderVehicle riderStatus')
      .populate('order', 'total grandTotal status paymentMethod items');
    res.json(jobs);
  } catch (e) {
    serverError(res, e);
  }
};

/** Riders, with their live load so the dispatcher can pick the right person. */
exports.riders = async (req, res) => {
  try {
    const riders = await listRiders();
    const counts = await Delivery.aggregate([
      { $match: { status: { $in: ['assigned', 'accepted', 'picked'] } } },
      { $group: { _id: '$rider', n: { $sum: 1 } } },
    ]);
    const load = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
    res.json(riders.map((r) => ({ ...r.toJSON(), activeJobs: load[String(r._id)] || 0 })));
  } catch (e) {
    serverError(res, e);
  }
};

/**
 * POST /api/delivery/riders/:id/status — approve, suspend or reinstate a rider.
 * This is the *only* rider field an admin may write by hand; everything else on
 * a delivery runs itself. A suspension immediately frees up their jobs so the
 * auto-dispatcher can re-line them.
 */
exports.setRiderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'available', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Riders can only be approved, available or suspended' });
    }
    const rider = await User.findOne({ _id: req.params.id, role: 'delivery' });
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    rider.riderStatus = status;
    if (status === 'suspended') rider.merchantStatus = 'suspended';
    if (status !== 'suspended') rider.merchantStatus = 'approved';

    // Never send the whole document back: it carries the bcrypt hash. Rebuild
    // the response from the fields the desk actually renders.
    await rider.save();

    // Approving a rider is the moment they become dispatchable, so anything
    // stranded in the pool goes out now rather than at the next packing.
    if (status === 'available') await dispatchWaitingJobs();

    if (status === 'suspended') {
      // hand the live jobs back to the pool instead of stranding the goods
      const freed = await Delivery.find({ rider: rider._id, status: { $in: ['assigned', 'accepted'] } });
      for (const job of freed) {
        job.rider = null;
        job.status = 'pending';
        job.assignedAt = null;
        job.assignedBy = null;
        await job.save();
        await Order.updateOne({ _id: job.order, status: 'packed' });
        await autoDispatch(job);
      }
    }
    res.json({
      _id: rider._id,
      name: rider.name,
      phone: rider.phone,
      role: rider.role,
      riderStatus: rider.riderStatus,
      riderArea: rider.riderArea,
      riderVehicle: rider.riderVehicle,
    });
  } catch (e) {
    serverError(res, e);
  }
};

/** Hand a job to a rider. */
exports.assign = async (req, res) => {
  try {
    const { riderId } = req.body;
    if (!pick(riderId)) return res.status(400).json({ message: 'Choose a rider' });

    const rider = await User.findOne({ _id: riderId, role: 'delivery' });
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    if (rider.merchantStatus === 'suspended' || rider.riderStatus === 'suspended') {
      return res.status(400).json({ message: 'That rider is suspended' });
    }

    const delivery = await Delivery.findOne({ order: req.params.id });
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    if (delivery.status === 'delivered') return res.status(400).json({ message: 'This delivery is already complete' });
    if (delivery.rider && String(delivery.rider) !== riderId) {
      return res.status(409).json({ message: 'Another rider is already on this delivery' });
    }

    delivery.rider = rider._id;
    delivery.status = delivery.status === 'pending' ? 'assigned' : delivery.status;
    await delivery.save();

    // keep the order timeline honest
    if (delivery.status === 'assigned' || delivery.status === 'accepted') {
      await Order.updateOne({ _id: delivery.order }, { status: 'assigned' });
    }

    // auto-claim the rider for the rest of their shift
    if (rider.riderStatus === 'available') await User.updateOne({ _id: rider._id }, { riderStatus: 'on_delivery' });

    res.json(delivery);
  } catch (e) {
    serverError(res, e);
  }
};

/** Move a job along (dispatch override, e.g. an admin confirms the drop-off). */
exports.updateJob = async (req, res) => {
  try {
    const { status } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });

    if (!NEXT_STEP[delivery.status]?.includes(status)) {
      return res.status(400).json({ message: `Cannot go from ${delivery.status} to ${status}` });
    }

    // a dispatch-side completion still needs the customer's code
    if (status === 'delivered' && !otpMatches(req.body.otp, delivery.otp)) {
      return res.status(400).json({ message: 'The hand-over code did not match' });
    }

    delivery.status = status;
    if (status === 'delivered') {
      delivery.completedBy = 'admin';
      delivery.proofImageUrl = String(req.body.proofImageUrl || delivery.proofImageUrl);
    }
    if (status === 'failed') delivery.attemptNote = String(req.body.note || '').slice(0, 300);
    await delivery.save();

    const orderStatus = DELIVERY_TO_ORDER[status];
    if (orderStatus) await Order.updateOne({ _id: delivery.order }, { status: orderStatus, paymentStatus: 'paid' });
    if (status === 'failed') await Order.updateOne({ _id: delivery.order }, { status: 'cancelled', cancelReason: 'Delivery could not be completed' });
    if (status === 'delivered' || status === 'failed') await releaseRiderIfIdle(delivery.rider);

    res.json(delivery);
  } catch (e) {
    serverError(res, e);
  }
};

/** Call the whole order off and put the stock back. */
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ message: `This order is already ${order.status}` });
    }

    order.status = 'cancelled';
    order.cancelReason = String(req.body.reason || 'Cancelled by OnlineKirana').slice(0, 300);
    order.paymentStatus = order.paymentStatus === 'paid' ? 'refunded' : 'unpaid';
    await order.save();

    // return the reserved stock to the shelf
    for (const item of order.items) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } });
    }

    await Delivery.findOneAndUpdate(
      { order: order._id, status: { $nin: ['delivered', 'failed'] } },
      { status: 'failed', attemptNote: order.cancelReason, rider: null }
    );

    res.json(order);
  } catch (e) {
    serverError(res, e);
  }
};

// ---------- Rider ----------

/** GET /api/delivery/jobs — my queue plus the unclaimed jobs I can pick up. */
exports.myJobs = async (req, res) => {
  try {
    const mine = await Delivery.find({ rider: pick(req.user.id) })
      .sort({ createdAt: 1 })
      .populate('order', 'total grandTotal status paymentMethod items');
    const open = await Delivery.find({ rider: null, status: 'pending' })
      .sort({ createdAt: 1 })
      .populate('order', 'total grandTotal status paymentMethod items');
    res.json({ mine, open });
  } catch (e) {
    serverError(res, e);
  }
};

/** Claim an unassigned job. */
exports.claim = async (req, res) => {
  try {
    const delivery = await jobOr404(req.params.id, { status: 'pending', rider: null });
    if (!delivery) return res.status(409).json({ message: 'That job was just taken' });

    delivery.rider = pick(req.user.id);
    delivery.status = 'assigned';
    await delivery.save();
    await Order.updateOne({ _id: delivery.order }, { status: 'assigned' });
    await User.updateOne({ _id: req.user.id }, { riderStatus: 'on_delivery' });

    res.json(delivery);
  } catch (e) {
    serverError(res, e);
  }
};

/**
 * Advance my own job. `delivered` requires the customer's hand-over code —
 * a rider can never mark a drop-off complete on their own.
 */
exports.advance = async (req, res) => {
  try {
    const { status, otp, note, proofImageUrl } = req.body;
    const delivery = await jobOr404(req.params.id, { rider: pick(req.user.id) });
    if (!delivery) return res.status(404).json({ message: 'Job not found among your deliveries' });

    if (!NEXT_STEP[delivery.status]?.includes(status)) {
      return res.status(400).json({ message: `Cannot go from ${delivery.status} to ${status}` });
    }

    if (status === 'delivered') {
      if (!otpMatches(otp, delivery.otp)) {
        return res.status(400).json({ message: 'That hand-over code did not match. Ask the customer to read it out.' });
      }
      delivery.completedBy = 'rider';
      delivery.proofImageUrl = String(proofImageUrl || '');
    }
    if (status === 'failed') delivery.attemptNote = String(note || '').slice(0, 300);

    delivery.status = status;
    await delivery.save();

    // A rider who gives up must not strand the order. Put the job back in the
    // pool as `pending`, free the rider, and put the order back to `packed` so
    // the merchant still sees it as theirs. Then try again immediately — a
    // different rider is often free by now. If nobody is, it stays claimable.
    if (status === 'failed') {
      delivery.rider = null;
      delivery.assignedAt = null;
      delivery.assignedBy = null;
      // `autoDispatch` only ever picks up `pending` jobs, so the status has to
      // be reset too — otherwise the retry silently does nothing and the order
      // is stranded with a dead rider attached.
      delivery.status = 'pending';
      await delivery.save();
      await Order.updateOne({ _id: delivery.order, status: { $nin: ['delivered', 'cancelled'] } }, { status: 'packed' });
      await autoDispatch(delivery);
    } else {
      const orderStatus = DELIVERY_TO_ORDER[status];
      if (orderStatus) await Order.updateOne({ _id: delivery.order }, { status: orderStatus, paymentStatus: 'paid' });
    }

    if (status === 'delivered' || status === 'failed') await releaseRiderIfIdle(req.user.id);
    res.json(delivery);
  } catch (e) {
    serverError(res, e);
  }
};

/** Go on / off shift — the rider's own availability toggle. */
exports.setAvailability = async (req, res) => {
  try {
    const online = Boolean(req.body.online);
    const status = online ? 'available' : 'offline';

    // `req.user` is the JWT payload (id, role, name) — it carries no riderStatus,
    // so the real status has to be read from the database. Reading it is also the
    // only way to stop a suspended or not-yet-approved rider from flipping
    // themselves to `available`, which is what the auto-dispatcher looks for.
    const rider = await User.findById(req.user.id).select('riderStatus');
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    if (rider.riderStatus === 'suspended') {
      return res.status(403).json({ message: 'Your account is suspended — contact the admin.' });
    }
    if (online && rider.riderStatus === 'pending') {
      return res.status(403).json({ message: 'Your rider account is still awaiting approval.' });
    }

    await User.updateOne({ _id: req.user.id }, { riderStatus: status });
    // A rider coming online is the moment a stuck job can move again. Anything
    // left sitting in the pool with nobody on it is offered to the fleet now,
    // rather than waiting for a shopkeeper to pack something else.
    if (online) await dispatchWaitingJobs();
    res.json({ riderStatus: status });
  } catch (e) {
    serverError(res, e);
  }
};

/**
 * Pick the right rider without anyone touching a screen.
 *
 * Order of preference:
 *   1. the least busy rider who is on shift and under the load cap
 *   2. if nobody is free, park the job as `pending` so a rider can claim it
 *
 * Runs the moment the merchant marks the order packed, so the shopkeeper never
 * picks a rider and the customer never waits on a manual dispatch tap.
 */
async function autoDispatch(delivery) {
  if (!delivery || delivery.rider || delivery.status !== 'pending') return delivery;

  const load = await Delivery.aggregate([
    { $match: { status: { $in: ['assigned', 'accepted', 'picked'] } } },
    { $group: { _id: '$rider', n: { $sum: 1 } } },
  ]);
  const busy = new Map(load.map((row) => [String(row._id), row.n]));

  const candidates = await User.find({
    role: 'delivery',
    riderStatus: 'available',
  })
    .select('_id name')
    .lean();

  const free = candidates
    .filter((r) => (busy.get(String(r._id)) || 0) < MAX_ACTIVE_JOBS)
    .sort((a, b) => (busy.get(String(a._id)) || 0) - (busy.get(String(b._id)) || 0));

  const chosen = free[0];
  if (!chosen) return delivery; // stays pending and claimable

  delivery.rider = chosen._id;
  // The job lands on `assigned`, NOT `accepted`: the rider is told about the job
  // and starts towards the shop, but still taps "I've reached the shop" when they
  // actually arrive. That tap is the merchant↔rider handoff — it is the moment
  // the rider knows the packed goods are theirs, so it must not be skipped.
  delivery.status = 'assigned';
  delivery.assignedAt = new Date();
  delivery.assignedBy = 'auto';
  await delivery.save();

  await Order.updateOne({ _id: delivery.order }, { status: 'assigned' });
  await User.updateOne({ _id: chosen._id }, { riderStatus: 'on_delivery' });
  return delivery;
}

/**
 * Run the auto-flow after the merchant packs an order. Nothing else in the
 * system has to be touched by a human for the delivery to move.
 */
async function dispatchForOrder(orderId) {
  const delivery = await Delivery.findOne({ order: orderId, status: 'pending', rider: null });
  if (!delivery) return null;
  return autoDispatch(delivery);
}

/**
 * Drain the pool: hand every unassigned job to an available rider. Called when a
 * rider comes online, so a job packed while nobody was on shift is picked up as
 * soon as anyone is. Oldest first, so nobody is left waiting behind newer work.
 */
async function dispatchWaitingJobs() {
  const waiting = await Delivery.find({ status: 'pending', rider: null }).sort({ createdAt: 1 });
  const assigned = [];
  for (const job of waiting) {
    // `autoDispatch` returns the job untouched when no rider is free or every
    // free rider is at the load cap. Once that happens the rest cannot succeed
    // either, so stop rather than re-querying the same empty candidate set for
    // every job still waiting.
    const before = job.rider;
    const out = await autoDispatch(job);
    if (out?.rider && !before) assigned.push(out);
    else if (!out?.rider) break;
  }
  return assigned;
}

/** A rider with nothing left in hand goes back to "available". */
async function releaseRiderIfIdle(riderId) {
  if (!riderId) return;
  const busy = await Delivery.countDocuments({
    rider: pick(riderId),
    status: { $in: ['assigned', 'accepted', 'picked'] },
  });
  if (busy === 0) {
    await User.updateOne({ _id: riderId }, { riderStatus: 'available' });
    // Finishing a job frees a slot, and a free slot is the moment the next
    // waiting job can move. Without this the pool stalls until another order is
    // packed or a rider happens to toggle their shift.
    await dispatchWaitingJobs();
  }
}

/** Called from the order controller right after a successful checkout. */
async function createForOrder({ order, shop, address, customerName, fee, slot, instructions }) {
  return Delivery.create({
    order: order._id,
    status: 'pending',
    otp: generateOtp(),
    fee,
    slot: slotByKey(slot) ? slot : null,
    instructions: String(instructions || '').slice(0, 300),
    pickup: {
      shopName: shop?.shopName || 'OnlineKirana',
      line: shop?.shopAddress?.line || '',
      ward: shop?.shopAddress?.ward || '',
      phone: shop?.shopPhone || shop?.phone || '',
    },
    dropoff: {
      name: customerName || '',
      line: address?.line || '',
      ward: address?.ward || '',
      phone: address?.phone || '',
    },
  });
}

// Exported as a flat object so the route file can destructure it in one line.
module.exports = {
  options: exports.options,
  myCode: exports.myCode,
  allJobs: exports.allJobs,
  riders: exports.riders,
  confirmReceipt: exports.confirmReceipt,
  setRiderStatus: exports.setRiderStatus,
  assign: exports.assign,
  updateJob: exports.updateJob,
  cancelOrder: exports.cancelOrder,
  myJobs: exports.myJobs,
  claim: exports.claim,
  advance: exports.advance,
  setAvailability: exports.setAvailability,
  createForOrder,
  autoDispatch,
  dispatchForOrder,
  dispatchWaitingJobs,
  MAX_ACTIVE_JOBS,
  DELIVERY_TO_ORDER,
  SLOTS,
};
