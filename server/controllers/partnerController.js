const Product = require('../models/Product');
const Order = require('../models/Order');
const { serverError } = require('../utils/errors');

// Guard: only approved merchants can manage products
exports.requireMerchant = (req, res, next) => {
  if (req.user.role !== 'merchant') return res.status(403).json({ message: 'Merchant (partner) access only' });
  next();
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
    const orders = await Order.find({ 'items.merchant': req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) {
    serverError(res, e);
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const allowed = ['packed', 'out_for_delivery', 'delivered'];
    if (!allowed.includes(req.body.status)) {
      return res.status(403).json({ message: `Partners can only set status to: ${allowed.join(', ')}` });
    }
    const order = await Order.findOne({ _id: req.params.id, 'items.merchant': req.user.id });
    if (!order) return res.status(404).json({ message: 'Order not found among your orders' });
    order.status = req.body.status;
    await order.save();
    res.json(order);
  } catch (e) {
    serverError(res, e);
  }
};
