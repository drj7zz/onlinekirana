const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Delivery = require('../models/Delivery');
const { serverError } = require('../utils/errors');
const deliveryController = require('./deliveryController');
const { notifyUsers } = require('../utils/notifications');

// Guard: only approved merchants can manage products
exports.requireMerchant = async (req, res, next) => {
  if (req.user.role !== 'merchant') return res.status(403).json({ message: 'Merchant (partner) access only' });
  try {
    const merchant = await User.findOne({ _id: req.user.id, role: 'merchant', merchantStatus: 'approved' }).select('_id');
    if (!merchant) return res.status(403).json({ message: 'Your shop application must be approved before managing products and orders.' });
    next();
  } catch (error) { next(error); }
};

exports.myProducts = async (req, res) => {
  try {
    const products = await Product.find({ merchant: req.user.id }).sort({ createdAt: -1 });
    res.json(products);
  } catch (e) {
    serverError(res, e);
  }
};

// Create: goes live only after admin approval (status = pending)
exports.create = async (req, res) => {
  try {
    const { name, description, category, price, unit, stock, imageUrl, discountPercent } = req.body;
    if (!name || !category || price == null) return res.status(400).json({ message: 'Name, category and price are required' });
    const product = await Product.create({
      name, description, category, price, unit, stock, imageUrl, discountPercent,
      merchant: req.user.id,
      status: 'pending',   // admin must approve before it appears in the shop
    });
    res.status(201).json(product);
  } catch (e) {
    serverError(res, e);
  }
};

// Update own product — price/stock changes revert to pending for admin review
const EDITABLE = ['name', 'description', 'category', 'price', 'unit', 'stock', 'imageUrl', 'discountPercent'];
exports.update = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, merchant: req.user.id });
    if (!product) return res.status(404).json({ message: 'Product not found among your products' });

    const wasApproved = product.status === 'approved';
    let meaningfulChange = false;
    for (const k of EDITABLE) {
      if (req.body[k] !== undefined && req.body[k] !== product[k]) {
        product[k] = req.body[k];
        if (['name', 'category', 'price', 'discountPercent', 'imageUrl'].includes(k)) meaningfulChange = true;
      }
    }
    // stock-only updates stay live; anything else needs re-approval
    if (wasApproved && meaningfulChange) product.status = 'pending';
    await product.save();
    res.json(product);
  } catch (e) {
    serverError(res, e);
  }
};

exports.remove = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, merchant: req.user.id });
    if (!product) return res.status(404).json({ message: 'Product not found among your products' });
    res.json({ message: 'Product removed' });
  } catch (e) {
    serverError(res, e);
  }
};

// Orders that contain this merchant's items — merchant can advance packing/delivery
exports.myOrders = async (req, res) => {
  try {
    const orders = await Order.find({ 'items.merchant': req.user.id })
      .sort({ createdAt: -1 })
      .populate('items.product', 'imageUrl description category')
      .lean();

    // Join the delivery job so the shopkeeper can see which rider is coming and
    // whether they have reached the counter yet. That visibility is what makes
    // the pack → hand-over handoff work without a phone call. Done by hand
    // because the job hangs off Delivery.order, not a back-reference on Order.
    const jobs = await Delivery.find({ order: { $in: orders.map((o) => o._id) } })
      .select('order status rider completedBy slot')
      .populate('rider', 'name phone riderVehicle')
      .lean();

    const byOrder = new Map(jobs.map((j) => [String(j.order), j]));
    for (const o of orders) {
      o.delivery = byOrder.get(String(o._id)) || null;
      if (o.deliveryAddress?.location) delete o.deliveryAddress.location;
    }

    res.json(orders);
  } catch (e) {
    serverError(res, e);
  }
};

/**
 * The merchant's only lever.
 *
 * A shopkeeper packs goods — that is it. Packing makes the delivery visible
 * to riders, who choose whether to accept it.
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const allowed = ['packed'];
    if (!allowed.includes(req.body.status)) {
      return res.status(403).json({
        message: `Packing is the only step you set. Delivery updates itself once packed.`,
      });
    }
    const order = await Order.findOne({ _id: req.params.id, 'items.merchant': req.user.id });
    if (!order) return res.status(404).json({ message: 'Order not found among your orders' });
    if (['cancelled', 'delivered'].includes(order.status)) {
      return res.status(409).json({ message: `Order is already ${order.status}` });
    }
    if (order.status === 'packed') return res.json(order);

    order.status = 'packed';
    order.packedAt = new Date();
    await order.save();

    const delivery = await deliveryController.dispatchForOrder(order._id);
    await notifyUsers([order.user], {
      type: 'order',
      title: 'Order packed',
      body: 'The shop packed your items. A rider will accept the delivery next.',
      link: '/orders',
    });
    if (delivery) {
      const [riders, loads] = await Promise.all([
        User.find({ role: 'delivery', riderStatus: { $in: ['available', 'on_delivery'] } }).select('_id').lean(),
        Delivery.aggregate([
          { $match: { status: { $in: ['assigned', 'accepted', 'picked'] } } },
          { $group: { _id: '$rider', count: { $sum: 1 } } },
        ]),
      ]);
      const active = new Map(loads.map((row) => [String(row._id), row.count]));
      const eligible = riders
        .filter((rider) => (active.get(String(rider._id)) || 0) < deliveryController.MAX_ACTIVE_JOBS)
        .map((rider) => rider._id);
      await notifyUsers(eligible, {
        type: 'delivery',
        title: 'Delivery available',
        body: `A packed order is ready to accept${delivery.dropoff?.ward ? ` · Ward ${delivery.dropoff.ward}` : ''}${delivery.fee ? ` · Late delivery charge रू ${delivery.fee}` : ' · Free evening delivery'}.`,
        link: '/rider',
      });
    }

    res.json({ order, delivery });
  } catch (e) {
    serverError(res, e);
  }
};
