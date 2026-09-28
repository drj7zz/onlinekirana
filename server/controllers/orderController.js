const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Delivery = require('../models/Delivery');
const { serverError } = require('../utils/errors');
const { feeFor, slotByKey } = require('../config/delivery');
const { createForOrder } = require('./deliveryController');

// Order lifecycle, in the order it may happen. Guards admin status edits so a
// typo can't put an order into a state nothing else knows how to leave.
const ORDER_STATUSES = [
  'pending', 'confirmed', 'packed', 'assigned',
  'out_for_delivery', 'delivered', 'cancelled',
];

// Place order: cart items come from client, but prices are re-read from DB (never trust client prices)
exports.place = async (req, res) => {
  try {
    const { items, deliveryAddress, paymentMethod, slot, deliveryInstructions } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Cart is empty' });
    if (!deliveryAddress?.line || !deliveryAddress?.phone) {
      return res.status(400).json({ message: 'Delivery address and phone are required' });
    }

    const ids = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, isActive: true });
    if (products.length !== ids.length) return res.status(400).json({ message: 'Some products are unavailable' });

    const orderItems = [];
    let total = 0;
    for (const item of items) {
      const p = products.find((p) => p._id.toString() === item.productId);
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      if (p.stock < qty) return res.status(400).json({ message: `Only ${p.stock} ${p.unit} of ${p.name} left in stock` });
      const price = Math.round(p.price * (1 - p.discountPercent / 100) * 100) / 100;
      orderItems.push({ product: p._id, merchant: p.merchant, name: p.name, price, qty, unit: p.unit });
      total += price * qty;
    }
    total = Math.round(total * 100) / 100;

    // Delivery cost comes from the same config the checkout page shows, so the
    // customer never sees one price at checkout and pays another.
    const deliveryFee = feeFor(total, deliveryAddress.ward);
    const grandTotal = Math.round((total + deliveryFee) * 100) / 100;

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      total,
      deliveryFee,
      grandTotal,
      deliveryAddress: { line: deliveryAddress.line, city: 'Birgunj', ward: deliveryAddress.ward, phone: deliveryAddress.phone },
      paymentMethod: paymentMethod === 'esewa' ? 'esewa' : 'cod',
      deliveryInstructions: String(deliveryInstructions || '').slice(0, 300),
    });

    // Every order gets a delivery job for the dispatch desk to work from.
    // Pickup comes from the merchant the goods came from; a cart spanning
    // several shops is collected from the main OnlineKirana counter.
    const merchantIds = [...new Set(orderItems.map((i) => String(i.merchant || '')).filter(Boolean))];
    const shops = merchantIds.length
      ? await User.find({ _id: { $in: merchantIds } }).select('shopName shopAddress shopPhone phone')
      : [];
    const customer = await User.findById(req.user.id).select('name');

    await createForOrder({
      order,
      shop: shops.length === 1 ? shops[0] : null,
      address: deliveryAddress,
      customerName: customer?.name || '',
      fee: deliveryFee,
      slot: slotByKey(slot) ? slot : null,
      instructions: deliveryInstructions,
    }).catch((e) => {
      // The order is already saved — never fail checkout because the delivery
      // record hiccuped. The order itself still drives the admin order list.
      console.error('[delivery] could not queue job for order', order._id, e?.message || e);
    });

    // decrement stock
    await Promise.all(items.map((i) =>
      Product.updateOne({ _id: i.productId }, { $inc: { stock: -Math.max(1, parseInt(i.qty, 10) || 1) } })
    ));

    res.status(201).json(order);
  } catch (e) {
    serverError(res, e);
  }
};

exports.myOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
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
      .populate('user', 'name email phone')
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

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === status) return res.json(order);
    if (order.status === 'delivered' && status !== 'cancelled') {
      return res.status(400).json({ message: 'This order is already delivered' });
    }

    order.status = status;
    if (status === 'delivered') order.paymentStatus = 'paid';
    if (status === 'cancelled') {
      order.cancelReason = String(req.body.reason || 'Cancelled by OnlineKirana').slice(0, 300);
      // give the stock back
      for (const item of order.items) {
        await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } });
      }
    }
    await order.save();

    // keep the delivery job in step with the order the desk is looking at
    const mirror = { packed: null, assigned: 'assigned', out_for_delivery: 'picked', delivered: 'delivered' };
    if (status in mirror && mirror[status]) {
      await Delivery.updateOne(
        { order: order._id, status: { $nin: ['delivered', 'failed'] } },
        { status: mirror[status] }
      );
    } else if (status === 'cancelled') {
      await Delivery.updateOne(
        { order: order._id, status: { $nin: ['delivered', 'failed'] } },
        { status: 'failed', attemptNote: order.cancelReason, rider: null }
      );
    }

    res.json(order);
  } catch (e) {
    serverError(res, e);
  }
};
