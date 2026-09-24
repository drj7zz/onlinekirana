const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { serverError } = require('../utils/errors');

// Place order: cart items come from client, but prices are re-read from DB (never trust client prices)
exports.place = async (req, res) => {
  try {
    const { items, deliveryAddress, paymentMethod } = req.body;
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

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      total,
      deliveryAddress: { line: deliveryAddress.line, city: 'Birgunj', ward: deliveryAddress.ward, phone: deliveryAddress.phone },
      paymentMethod: paymentMethod === 'esewa' ? 'esewa' : 'cod',
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
    const orders = await Order.find({}).sort({ createdAt: -1 }).populate('user', 'name email phone');
    res.json(orders);
  } catch (e) {
    serverError(res, e);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (e) {
    serverError(res, e);
  }
};
