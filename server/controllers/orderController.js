const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Delivery = require('../models/Delivery');
const { serverError } = require('../utils/errors');
const {
  PILOT_CANCELLATION_ENABLED, CANCELLATION_WINDOW_DAYS, CANCELLATION_LIMIT,
  CANCELLATION_RESTRICTION_DAYS, slotByKey, availableSlots, feeForSlot, distanceKm,
} = require('../config/delivery');
const { createForOrder } = require('./deliveryController');
const { notifyUsers } = require('../utils/notifications');

// Place order: cart items come from client, but prices are re-read from DB (never trust client prices)
exports.place = async (req, res) => {
  const reserved = [];
  let createdOrder = null;
  try {
    const { items, deliveryAddress, paymentMethod, slot, quotedDeliveryFee, deliveryInstructions } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Cart is empty' });
    if (!deliveryAddress?.line || !deliveryAddress?.phone) {
      return res.status(400).json({ message: 'Delivery address and phone are required' });
    }
    if (paymentMethod && paymentMethod !== 'cod') {
      return res.status(400).json({ message: 'Cash on delivery is currently available. Online payments are not enabled yet.' });
    }
    const customer = await User.findById(req.user.id).select('orderRestrictedUntil');
    if (PILOT_CANCELLATION_ENABLED && customer?.orderRestrictedUntil && customer.orderRestrictedUntil > new Date()) {
      return res.status(403).json({
        message: `Order placement is temporarily paused until ${customer.orderRestrictedUntil.toISOString()}. Contact support if you need a review.`,
        restrictedUntil: customer.orderRestrictedUntil,
      });
    }

    const normalized = [];
    for (const item of items) {
      const qty = Number(item?.qty);
      if (!mongoose.isValidObjectId(item?.productId) || !Number.isSafeInteger(qty) || qty < 1 || qty > 999) {
        return res.status(400).json({ message: 'Each item needs a valid product and quantity.' });
      }
      normalized.push({ productId: String(item.productId), qty });
    }
    if (new Set(normalized.map((item) => item.productId)).size !== normalized.length) {
      return res.status(400).json({ message: 'Remove duplicate products from your cart and try again.' });
    }

    const ids = normalized.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: ids }, isActive: true, status: 'approved' });
    if (products.length !== ids.length) return res.status(400).json({ message: 'Some products are unavailable' });

    const pickupSources = new Set(products.map((product) => String(product.merchant || 'platform')));
    if (pickupSources.size > 1) {
      return res.status(400).json({ message: 'Please place separate orders for items from different sellers. Each delivery has one pickup.' });
    }

    const merchantIds = [...new Set(products.map((product) => String(product.merchant || '')).filter(Boolean))];
    const shops = merchantIds.length
      ? await User.find({ _id: { $in: merchantIds } }).select('shopName shopAddress shopPhone phone')
      : [];
    const shop = shops[0] || null;
    const pickup = shop?.shopAddress?.location || (process.env.PLATFORM_PICKUP_LAT && process.env.PLATFORM_PICKUP_LNG
      ? { lat: Number(process.env.PLATFORM_PICKUP_LAT), lng: Number(process.env.PLATFORM_PICKUP_LNG) }
      : null);
    const location = deliveryAddress.location;
    const hasLat = location?.lat !== undefined && location?.lat !== null;
    const hasLng = location?.lng !== undefined && location?.lng !== null;
    if (hasLat !== hasLng || (hasLat && (!Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng)) || Math.abs(Number(location.lat)) > 90 || Math.abs(Number(location.lng)) > 180))) {
      return res.status(400).json({ message: 'Choose a valid delivery location.' });
    }
    const km = distanceKm(pickup, hasLat && hasLng ? location : null);
    const selectedSlot = slotByKey(slot);
    const riderOnline = selectedSlot?.feeMode === 'night'
      ? Boolean(await User.exists({ role: 'delivery', riderStatus: { $in: ['available', 'on_delivery'] }, merchantStatus: 'approved' }))
      : false;
    if (!availableSlots(new Date(), { riderOnline, distanceKm: km }).some((window) => window.key === slot)) {
      return res.status(409).json({ message: 'That delivery window is no longer available. Refresh checkout and choose another window.' });
    }
    const deliveryFee = feeForSlot(slot, km);
    if (deliveryFee === null) {
      return res.status(400).json({ message: 'A shop pickup location and your delivery pin are required for paid late-night delivery.' });
    }
    // The server owns pricing; this quote check prevents stale frontend/API
    // deployments from silently changing the customer's checkout total.
    if (quotedDeliveryFee !== undefined && (!Number.isFinite(Number(quotedDeliveryFee)) || Number(quotedDeliveryFee) !== deliveryFee)) {
      return res.status(409).json({ message: 'Delivery price changed. Refresh checkout to review the updated total before ordering.' });
    }

    const orderItems = [];
    let total = 0;
    for (const item of normalized) {
      const p = products.find((product) => product._id.toString() === item.productId);
      const reservedStock = await Product.updateOne(
        { _id: p._id, isActive: true, status: 'approved', stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } }
      );
      if (reservedStock.modifiedCount !== 1) {
        for (const prior of reserved) await Product.updateOne({ _id: prior.id }, { $inc: { stock: prior.qty } });
        reserved.length = 0;
        return res.status(409).json({ message: `${p.name} just sold out or has fewer items available. Refresh your cart.` });
      }
      reserved.push({ id: p._id, qty: item.qty });
      const price = Math.round(p.price * (1 - p.discountPercent / 100) * 100) / 100;
      orderItems.push({ product: p._id, merchant: p.merchant, name: p.name, price, qty: item.qty, unit: p.unit });
      total += price * item.qty;
    }
    total = Math.round(total * 100) / 100;

    const grandTotal = Math.round((total + deliveryFee) * 100) / 100;
    createdOrder = await Order.create({
      user: req.user.id,
      items: orderItems,
      total,
      deliveryFee,
      grandTotal,
      deliveryAddress: {
        line: deliveryAddress.line,
        city: 'Birgunj',
        ward: deliveryAddress.ward,
        phone: deliveryAddress.phone,
        ...(hasLat && hasLng && { location: { lat: Number(location.lat), lng: Number(location.lng) } }),
      },
      deliveryDistanceKm: km,
      paymentMethod: 'cod',
      deliveryInstructions: String(deliveryInstructions || '').slice(0, 300),
    });

    const orderCustomer = await User.findById(req.user.id).select('name');

    // A customer must never receive an order that has no corresponding delivery
    // job. If job creation fails, the outer handler removes the order and stock
    // reservation so checkout can safely be retried.
    await createForOrder({
      order: createdOrder,
      shop,
      address: deliveryAddress,
      customerName: orderCustomer?.name || '',
      fee: deliveryFee,
      distance: km,
      slot,
      instructions: deliveryInstructions,
    });

    await notifyUsers([...merchantIds, req.user.id], {
      type: 'order',
      title: 'New order placed',
      body: `${createdOrder.items.length} item(s) · रू ${grandTotal.toLocaleString('en-IN')}`,
      link: '/orders',
    });
    res.status(201).json(createdOrder);
  } catch (e) {
    if (createdOrder) await Order.deleteOne({ _id: createdOrder._id }).catch(() => {});
    for (const item of reserved) await Product.updateOne({ _id: item.id }, { $inc: { stock: item.qty } }).catch(() => {});
    serverError(res, e);
  }
};

const cancellationCutoff = () => new Date(Date.now() - CANCELLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

async function countRecentCustomerCancellations(userId) {
  const since = cancellationCutoff();
  const count = await Order.countDocuments({ user: userId, cancelledBy: 'customer', cancellationCounted: true, cancelledAt: { $gte: since } });
  return { count, since };
}

exports.cancellationStatus = async (req, res) => {
  try {
    const [user, { count }] = await Promise.all([
      User.findById(req.user.id).select('orderRestrictedUntil'),
      countRecentCustomerCancellations(req.user.id),
    ]);
    res.json({
      enabled: PILOT_CANCELLATION_ENABLED,
      recentCount: count,
      limit: CANCELLATION_LIMIT,
      windowDays: CANCELLATION_WINDOW_DAYS,
      restrictionDays: CANCELLATION_RESTRICTION_DAYS,
      warning: PILOT_CANCELLATION_ENABLED && count >= CANCELLATION_LIMIT - 1,
      restrictedUntil: PILOT_CANCELLATION_ENABLED && user?.orderRestrictedUntil > new Date() ? user.orderRestrictedUntil : null,
    });
  } catch (e) {
    serverError(res, e);
  }
};

exports.cancelMine = async (req, res) => {
  try {
    if (!PILOT_CANCELLATION_ENABLED) return res.status(404).json({ message: 'Online cancellation is not enabled.' });
    const order = await Order.findOne({ _id: req.params.id, user: req.user.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['pending', 'packed', 'assigned'].includes(order.status)) {
      return res.status(409).json({ message: 'This order can no longer be cancelled online. Contact support for help.' });
    }

    // Claim the job before changing the order. This prevents a rider from
    // collecting the goods at the same time the customer cancels.
    const delivery = await Delivery.findOneAndUpdate(
      { order: order._id, status: { $in: ['pending', 'assigned', 'accepted'] } },
      { $set: { status: 'failed', attemptNote: 'Cancelled by customer', rider: null, assignedAt: null, assignedBy: null } },
      { new: false }
    );
    if (!delivery) return res.status(409).json({ message: 'A rider has collected this order already; contact support for help.' });

    const cancelledAt = new Date();
    const cancellationCounted = ['packed', 'assigned'].includes(order.status);
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, user: req.user.id, status: { $in: ['pending', 'packed', 'assigned'] } },
      {
        $set: {
          status: 'cancelled',
          cancelledBy: 'customer',
          cancelledAt,
          cancellationCounted,
          cancelReason: String(req.body?.reason || 'Cancelled by customer').slice(0, 300),
        },
      },
      { new: true }
    );
    if (!updated) {
      await Delivery.updateOne({ _id: delivery._id, status: 'failed', rider: null }, {
        $set: { status: delivery.status, rider: delivery.rider, assignedAt: delivery.assignedAt, assignedBy: delivery.assignedBy, attemptNote: delivery.attemptNote },
      });
      return res.status(409).json({ message: 'Order status changed. Refresh the page before trying again.' });
    }

    for (const item of updated.items) await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } });
    if (delivery.rider) await require('./deliveryController').releaseRiderIfIdle(delivery.rider);
    const count = PILOT_CANCELLATION_ENABLED
      ? (await countRecentCustomerCancellations(req.user.id)).count
      : 0;
    let restrictedUntil = null;
    if (cancellationCounted && count >= CANCELLATION_LIMIT) {
      restrictedUntil = new Date(Date.now() + CANCELLATION_RESTRICTION_DAYS * 24 * 60 * 60 * 1000);
      await User.updateOne({ _id: req.user.id }, { $set: { orderRestrictedUntil: restrictedUntil } });
    }
    await notifyUsers([updated.user, ...updated.items.map((item) => item.merchant)], {
      type: 'order', title: 'Order cancelled',
      body: `Order #${String(updated._id).slice(-6).toUpperCase()} was cancelled by the customer.`,
      link: '/orders',
    });
    res.json({
      order: updated,
      cancellation: {
        recentCount: count,
        limit: CANCELLATION_LIMIT,
        windowDays: CANCELLATION_WINDOW_DAYS,
        warning: count >= CANCELLATION_LIMIT - 1,
        restrictedUntil,
      },
    });
  } catch (e) {
    serverError(res, e);
  }
};

exports.myOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    const jobs = await Delivery.find({ order: { $in: orders.map((order) => order._id) } })
      .select('order status rider slot fee')
      .populate('rider', 'name phone riderVehicle')
      .lean();
    const byOrder = new Map(jobs.map((job) => [String(job.order), job]));
    for (const order of orders) order.delivery = byOrder.get(String(order._id)) || null;
    res.json(orders);
  } catch (e) {
    serverError(res, e);
  }
};

// ---------- Admin ----------
exports.allOrders = async (req, res) => {
  try {
    // Join the delivery job onto each order. This is the admin's main order
    // screen, so it has to answer "where is this and who is carrying it" —
    // without the join an order that a rider is actively delivering looks
    // identical to one nobody has touched.
    //
    // `.lean()` is required: on a hydrated Mongoose document, assigning a field
    // that is not in the schema is silently dropped, so `o.delivery = job` would
    // never reach the response.
    const orders = await Order.find({}).sort({ createdAt: -1 })
      .populate('user', 'name email phone orderRestrictedUntil')
      .lean();
    const jobs = await Delivery.find({ order: { $in: orders.map((o) => o._id) } })
      .select('order status rider slot fee dropoff')
      .populate('rider', 'name phone riderVehicle riderStatus')
      .lean();
    const byOrder = new Map(jobs.map((j) => [String(j.order), j]));
    for (const o of orders) o.delivery = byOrder.get(String(o._id)) || null;
    res.json(orders);
  } catch (e) {
    serverError(res, e);
  }
};
