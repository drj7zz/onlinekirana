const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Delivery = require('../models/Delivery');
const { serverError } = require('../utils/errors');
const { generateOtp, otpMatches } = require('../utils/otp');
const {
  PILOT_DELIVERY_ENABLED, NIGHT_RATE_PER_KM, slotByKey, slotLabel,
  availableSlots, feeForSlot, distanceKm, SLOTS,
} = require('../config/delivery');
const { notifyUsers } = require('../utils/notifications');

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
  // A failed job is re-queued as pending so another rider can accept it.
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

const listRiders = () => User.find({ role: 'delivery' }).select('-password').sort({ name: 1 });

// ---------- Public / customer ----------

/** GET /api/delivery/options — fees and the slots still promiseable right now. */
exports.options = async (req, res) => {
  try {
    let pickup = null;
    if (req.query.sellerId && req.query.sellerId !== 'platform' && mongoose.isValidObjectId(req.query.sellerId)) {
      const seller = await User.findOne({ _id: req.query.sellerId, role: 'merchant', merchantStatus: 'approved' }).select('shopAddress.location');
      pickup = seller?.shopAddress?.location || null;
    } else if (req.query.sellerId === 'platform' && process.env.PLATFORM_PICKUP_LAT && process.env.PLATFORM_PICKUP_LNG) {
      pickup = { lat: Number(process.env.PLATFORM_PICKUP_LAT), lng: Number(process.env.PLATFORM_PICKUP_LNG) };
    }
    const destination = { lat: Number(req.query.lat), lng: Number(req.query.lng) };
    const km = distanceKm(pickup, destination);
    const riderOnline = await User.exists({ role: 'delivery', riderStatus: { $in: ['available', 'on_delivery'] }, merchantStatus: 'approved' });
    const slots = availableSlots(new Date(), { riderOnline: Boolean(riderOnline), distanceKm: km })
      .map((slot) => ({ ...slot, fee: feeForSlot(slot.key, km), distanceKm: km }));
    res.json({
      pilotPricing: PILOT_DELIVERY_ENABLED,
      ratePerKm: PILOT_DELIVERY_ENABLED ? NIGHT_RATE_PER_KM : 0,
      distanceKm: km,
      distanceType: 'straight-line estimate',
      hasPickupLocation: Boolean(pickup),
      riderOnline: Boolean(riderOnline),
      slots,
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
    if (!['picked', 'delivered'].includes(delivery.status)) {
      return res.status(409).json({ message: 'Your hand-over code will appear after the rider collects your order.' });
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
    if (delivery.status !== 'picked') {
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
    if (order.paymentMethod === 'cod') order.paymentStatus = 'paid';
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
      .select('-otp')
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
 * open pool so another rider can choose the job.
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
    else if (status === 'pending') rider.merchantStatus = 'pending';
    else rider.merchantStatus = 'approved';

    // Never send the whole document back: it carries the bcrypt hash. Rebuild
    // the response from the fields the desk actually renders.
    await rider.save();

    if (status === 'available') {
      await notifyUsers([rider._id], {
        type: 'approval', title: 'Rider account approved',
        body: 'You can go on shift and accept available deliveries.', link: '/rider',
      });
    }

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

/** Move a job along (dispatch override, e.g. an admin confirms the drop-off). */
exports.updateJob = async (req, res) => {
  try {
    const { status } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });

    if (delivery.status !== 'picked' || status !== 'delivered') {
      return res.status(403).json({ message: 'Only a rider can advance delivery. Admins may confirm a picked order with the customer code.' });
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
    if (orderStatus) {
      const orderUpdate = { status: orderStatus };
      if (status === 'delivered') {
        const order = await Order.findById(delivery.order).select('paymentMethod');
        if (order?.paymentMethod === 'cod') orderUpdate.paymentStatus = 'paid';
      }
      await Order.updateOne({ _id: delivery.order }, { $set: orderUpdate });
    }
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
    const reason = String(req.body.reason || 'Cancelled by OnlineKirana').slice(0, 300);
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: { $nin: ['delivered', 'cancelled'] } },
      { $set: { status: 'cancelled', cancelReason: reason, cancelledBy: 'admin', cancelledAt: new Date() } },
      { new: true }
    );
    if (!order) {
      const existing = await Order.findById(req.params.id).select('status');
      if (!existing) return res.status(404).json({ message: 'Order not found' });
      return res.status(400).json({ message: `This order is already ${existing.status}` });
    }
    if (order.paymentStatus === 'paid') {
      order.paymentStatus = 'refunded';
      await order.save();
    }

    // return the reserved stock to the shelf
    for (const item of order.items) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } });
    }

    const activeDelivery = await Delivery.findOne({
      order: order._id,
      status: { $nin: ['delivered', 'failed'] },
    }).select('rider');
    await Delivery.updateOne(
      { order: order._id, status: { $nin: ['delivered', 'failed'] } },
      { status: 'failed', attemptNote: order.cancelReason, rider: null, assignedAt: null, assignedBy: null }
    );
    if (activeDelivery?.rider) await releaseRiderIfIdle(activeDelivery.rider);
    await notifyUsers([order.user, ...order.items.map((item) => item.merchant)], {
      type: 'order',
      title: 'Order cancelled',
      body: `Order #${String(order._id).slice(-6).toUpperCase()} was cancelled.`,
      link: '/orders',
    });

    res.json(order);
  } catch (e) {
    serverError(res, e);
  }
};

// ---------- Rider ----------

/** GET /api/delivery/jobs — my queue plus packed jobs riders may accept. */
exports.myJobs = async (req, res) => {
  try {
    const mine = await Delivery.find({ rider: pick(req.user.id) })
      .select('-otp')
      .sort({ createdAt: 1 })
      .populate('order', 'total grandTotal status paymentMethod items');
    const openJobs = await Delivery.find({ rider: null, status: 'pending' })
      .sort({ createdAt: 1 })
      .populate({ path: 'order', select: 'total grandTotal status paymentMethod items', match: { status: 'packed' } });
    // Until acceptance, riders only see the destination ward and the order
    // contents. Customer name, phone, street address, delivery note and OTP are
    // disclosed only after this rider owns the job.
    const open = openJobs.filter((job) => job.order).map((job) => {
      const { otp, ...safeJob } = job.toObject();
      void otp;
      return {
        ...safeJob,
        instructions: '',
        dropoff: { ward: job.dropoff?.ward || '', city: 'Birgunj' },
      };
    });
    res.json({ mine, open });
  } catch (e) {
    serverError(res, e);
  }
};

/** Claim an unassigned job. */
exports.claim = async (req, res) => {
  try {
    const rider = await User.findOne({ _id: req.user.id, role: 'delivery' }).select('riderStatus merchantStatus');
    if (!rider || rider.merchantStatus !== 'approved' || rider.riderStatus === 'pending' || rider.riderStatus === 'suspended') {
      return res.status(403).json({ message: 'Your rider account is not approved for deliveries.' });
    }
    if (!['available', 'on_delivery'].includes(rider.riderStatus)) {
      return res.status(403).json({ message: 'Go on shift before accepting an order.' });
    }
    const candidate = await Delivery.findOne({ _id: pick(req.params.id), status: 'pending', rider: null }).select('order');
    if (!candidate || !(await Order.exists({ _id: candidate.order, status: 'packed' }))) {
      return res.status(409).json({ message: 'This order is no longer available to accept.' });
    }
    const activeJobs = await Delivery.countDocuments({
      rider: req.user.id,
      status: { $in: ['assigned', 'accepted', 'picked'] },
    });
    if (activeJobs >= MAX_ACTIVE_JOBS) {
      return res.status(409).json({ message: `You already have ${MAX_ACTIVE_JOBS} active orders.` });
    }
    // Atomic conditional update: if two riders tap at once, exactly one gets it.
    const delivery = await Delivery.findOneAndUpdate(
      { _id: pick(req.params.id), status: 'pending', rider: null },
      { $set: { rider: pick(req.user.id), status: 'assigned', assignedAt: new Date(), assignedBy: 'rider' } },
      { new: true }
    );
    if (!delivery) return res.status(409).json({ message: 'That job was just taken' });
    const orderUpdate = await Order.updateOne({ _id: delivery.order, status: 'packed' }, { status: 'assigned' });
    if (orderUpdate.modifiedCount !== 1) {
      await Delivery.updateOne({ _id: delivery._id, rider: req.user.id, status: 'assigned' }, { $set: { rider: null, status: 'pending', assignedAt: null, assignedBy: null } });
      return res.status(409).json({ message: 'This order was changed before acceptance. Refresh your available deliveries.' });
    }
    await User.updateOne({ _id: req.user.id }, { riderStatus: 'on_delivery' });

    const order = await Order.findById(delivery.order).select('user items');
    const parties = [order?.user, ...(order?.items || []).map((item) => item.merchant)];
    await notifyUsers(parties, {
      type: 'delivery',
      title: 'Rider accepted your order',
      body: 'A delivery partner has accepted the job and can now see your delivery details.',
      link: '/orders',
    });

    const { otp: hiddenOtp, ...safeDelivery } = delivery.toObject();
    void hiddenOtp;
    res.json(safeDelivery);
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
    // open pool as `pending`, free the rider, and put the order back to `packed`.
    if (status === 'failed') {
      delivery.rider = null;
      delivery.assignedAt = null;
      delivery.assignedBy = null;
      // Reset the job to pending and clear its rider so another rider can
      // choose to accept it.
      delivery.status = 'pending';
      await delivery.save();
      await Order.updateOne({ _id: delivery.order, status: { $nin: ['delivered', 'cancelled'] } }, { status: 'packed' });
    } else {
      const orderStatus = DELIVERY_TO_ORDER[status];
      if (orderStatus) {
        const orderUpdate = { status: orderStatus };
        if (status === 'delivered') {
          const order = await Order.findById(delivery.order).select('paymentMethod');
          if (order?.paymentMethod === 'cod') orderUpdate.paymentStatus = 'paid';
        }
        await Order.updateOne({ _id: delivery.order }, { $set: orderUpdate });
      }
    }

    if (['picked', 'delivered', 'failed'].includes(status)) {
      const order = await Order.findById(delivery.order).select('user items');
      const parties = [order?.user, ...(order?.items || []).map((item) => item.merchant)];
      await notifyUsers(parties, {
        type: 'delivery',
        title: status === 'picked' ? 'Order is on the way' : status === 'delivered' ? 'Order delivered' : 'Delivery needs another rider',
        body: status === 'picked' ? 'The rider collected your order from the shop.' : status === 'delivered' ? 'Your order has been handed over.' : 'This job is open for another rider to accept.',
        link: '/orders',
      });
    }

    if (status === 'delivered' || status === 'failed') await releaseRiderIfIdle(req.user.id);
    const { otp: hiddenOtp, ...safeDelivery } = delivery.toObject();
    void hiddenOtp;
    res.json(safeDelivery);
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
    // themselves to `available` before approval.
    const rider = await User.findById(req.user.id).select('riderStatus merchantStatus');
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    if (rider.merchantStatus !== 'approved' || rider.riderStatus === 'suspended') {
      return res.status(403).json({ message: 'Your account is suspended — contact the admin.' });
    }
    if (online && rider.riderStatus === 'pending') {
      return res.status(403).json({ message: 'Your rider account is still awaiting approval.' });
    }

    await User.updateOne({ _id: req.user.id }, { riderStatus: status });
    res.json({ riderStatus: status });
  } catch (e) {
    serverError(res, e);
  }
};

async function dispatchForOrder(orderId) {
  // Packing leaves the job pending. The rider dashboard is the only automatic
  // route to riders; assignment happens after their explicit acceptance.
  return Delivery.findOne({ order: orderId, status: 'pending', rider: null });
}

/** A rider with nothing left in hand goes back to "available". */
async function releaseRiderIfIdle(riderId) {
  if (!riderId) return;
  const busy = await Delivery.countDocuments({
    rider: pick(riderId),
    status: { $in: ['assigned', 'accepted', 'picked'] },
  });
  if (busy === 0) {
    await User.updateOne({ _id: riderId, riderStatus: 'on_delivery' }, { riderStatus: 'available' });
  }
}

/** Called from the order controller right after a successful checkout. */
async function createForOrder({ order, shop, address, customerName, fee, slot, instructions, distance }) {
  return Delivery.create({
    order: order._id,
    status: 'pending',
    otp: generateOtp(),
    fee,
    distanceKm: distance,
    slot: slotByKey(slot) ? slot : null,
    instructions: String(instructions || '').slice(0, 300),
    pickup: {
      shopName: shop?.shopName || 'OnlineKirana',
      line: shop?.shopAddress?.line || '',
      ward: shop?.shopAddress?.ward || '',
      phone: shop?.shopPhone || shop?.phone || '',
      location: shop?.shopAddress?.location || null,
    },
    dropoff: {
      name: customerName || '',
      line: address?.line || '',
      ward: address?.ward || '',
      phone: address?.phone || '',
      location: address?.location || null,
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
  updateJob: exports.updateJob,
  cancelOrder: exports.cancelOrder,
  myJobs: exports.myJobs,
  claim: exports.claim,
  advance: exports.advance,
  setAvailability: exports.setAvailability,
  createForOrder,
  dispatchForOrder,
  releaseRiderIfIdle,
  MAX_ACTIVE_JOBS,
  DELIVERY_TO_ORDER,
  SLOTS,
};
