const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { serverError } = require('../utils/errors');

// One endpoint, three shapes — based on the caller's role
exports.stats = async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'admin') {
      const [products, pendingProducts, partners, pendingPartners, orders, newOrders, deliveredOrders, revenueAgg] = await Promise.all([
        Product.countDocuments({}),
        Product.countDocuments({ status: 'pending' }),
        User.countDocuments({ role: 'merchant' }),
        User.countDocuments({ role: 'merchant', merchantStatus: 'pending' }),
        Order.countDocuments({}),
        Order.countDocuments({ status: 'pending' }),
        Order.countDocuments({ status: 'delivered' }),
        Order.aggregate([
          { $match: { status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]),
      ]);
      const recentOrders = await Order.find({}).sort({ createdAt: -1 }).limit(5).populate('user', 'name');
      return res.json({
        role,
        cards: [
          { key: 'products', label: 'Products', value: products },
          { key: 'pendingProducts', label: 'Awaiting approval', value: pendingProducts, accent: pendingProducts > 0 },
          { key: 'partners', label: 'Partners', value: partners },
          { key: 'pendingPartners', label: 'Partner applications', value: pendingPartners, accent: pendingPartners > 0 },
          { key: 'orders', label: 'Total orders', value: orders },
          { key: 'newOrders', label: 'New orders', value: newOrders, accent: newOrders > 0 },
          { key: 'delivered', label: 'Delivered', value: deliveredOrders },
          { key: 'revenue', label: 'Revenue (रू)', value: revenueAgg[0]?.total || 0 },
        ],
        recentOrders,
      });
    }

    if (role === 'merchant') {
      const id = req.user.id;
      const [myProducts, pendingMine, liveMine, myOrders, activeOrders, revenueAgg] = await Promise.all([
        Product.countDocuments({ merchant: id }),
        Product.countDocuments({ merchant: id, status: 'pending' }),
        Product.countDocuments({ merchant: id, status: 'approved', isActive: true }),
        Order.countDocuments({ 'items.merchant': id }),
        Order.countDocuments({ 'items.merchant': id, status: { $in: ['pending', 'confirmed', 'packed', 'out_for_delivery'] } }),
        Order.aggregate([
          { $unwind: '$items' },
          { $match: { 'items.merchant': mongooseId(id), status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: { $multiply: ['$items.price', '$items.qty'] } } } },
        ]),
      ]);
      const recentOrders = await Order.find({ 'items.merchant': id }).sort({ createdAt: -1 }).limit(5);
      return res.json({
        role,
        cards: [
          { key: 'myProducts', label: 'My products', value: myProducts },
          { key: 'liveMine', label: 'Live in shop', value: liveMine },
          { key: 'pendingMine', label: 'Awaiting approval', value: pendingMine, accent: pendingMine > 0 },
          { key: 'myOrders', label: 'Orders with my items', value: myOrders },
          { key: 'activeOrders', label: 'To fulfil', value: activeOrders, accent: activeOrders > 0 },
          { key: 'revenue', label: 'My sales (रू)', value: Math.round((revenueAgg[0]?.total || 0) * 100) / 100 },
        ],
        recentOrders,
      });
    }

    // customer
    const id = req.user.id;
    const [orders, active, delivered, spentAgg] = await Promise.all([
      Order.countDocuments({ user: id }),
      Order.countDocuments({ user: id, status: { $in: ['pending', 'confirmed', 'packed', 'out_for_delivery'] } }),
      Order.countDocuments({ user: id, status: 'delivered' }),
      Order.aggregate([
        { $match: { user: mongooseId(id), status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);
    const recentOrders = await Order.find({ user: id }).sort({ createdAt: -1 }).limit(5);
    return res.json({
      role,
      cards: [
        { key: 'orders', label: 'My orders', value: orders },
        { key: 'active', label: 'In progress', value: active, accent: active > 0 },
        { key: 'delivered', label: 'Delivered', value: delivered },
        { key: 'spent', label: 'Total spent (रू)', value: spentAgg[0]?.total || 0 },
      ],
      recentOrders,
    });
  } catch (e) {
    serverError(res, e);
  }
};

const mongooseId = (id) => {
  const mongoose = require('mongoose');
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};
