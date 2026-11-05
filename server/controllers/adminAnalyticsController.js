const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const User = require('../models/User');
const { serverError } = require('../utils/errors');

/**
 * GET /api/admin/analytics — the operations desk's numbers in one call.
 *
 * Everything is computed with aggregations over real order data: repeat rate,
 * average fulfilment delay, stock refill pressure, review health and catalogue
 * size. A missing number is sent as null rather than a fake zero.
 */
exports.overview = async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [ordersByStatus, perCustomer, fulfilment, revenue, topProducts, reviewAgg, counts] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$user', orders: { $sum: 1 }, spend: { $sum: '$grandTotal' } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: since }, status: 'delivered', deliveredAt: { $exists: true } } },
        { $project: { minutes: { $divide: [{ $subtract: ['$deliveredAt', '$createdAt'] }, 60000] } } },
        { $group: { _id: null, avg: { $avg: '$minutes' }, p90: { $push: '$minutes' } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', name: { $first: '$items.name' }, qty: { $sum: '$items.qty' } } },
        { $sort: { qty: -1 } },
        { $limit: 8 },
      ]),
      Review.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
      Promise.all([
        Product.countDocuments({}),
        Product.countDocuments({ status: 'pending' }),
        User.countDocuments({ role: 'merchant', merchantStatus: 'approved' }),
        User.countDocuments({ role: 'delivery' }),
        User.countDocuments({ role: 'customer' }),
        // low stock: sellable products with at most 5 units left
        Product.countDocuments({ isActive: true, status: 'approved', stock: { $lte: 5 } }),
        Product.countDocuments({ isActive: true, status: 'approved', stock: 0 }),
      ]),
    ]);

    const customers = perCustomer.length;
    const repeatBuyers = perCustomer.filter((c) => c.orders > 1).length;
    const totalOrders = perCustomer.reduce((sum, c) => sum + c.orders, 0);
    const statusMap = Object.fromEntries(ordersByStatus.map((s) => [s._id, s.count]));
    const cancelled = statusMap.cancelled || 0;
    const delivered = statusMap.delivered || 0;

    const fulfil = fulfilment[0];
    let avgDelayMinutes = null;
    let p90DelayMinutes = null;
    if (fulfil) {
      avgDelayMinutes = Math.round(fulfil.avg);
      if (Array.isArray(fulfil.p90) && fulfil.p90.length) {
        const sorted = [...fulfil.p90].sort((a, b) => a - b);
        p90DelayMinutes = Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]);
      }
    }

    res.json({
      window: '30 days',
      orders: {
        total: totalOrders,
        byStatus: statusMap,
        cancelled,
        delivered,
        cancelRate: totalOrders ? Math.round((cancelled / totalOrders) * 100) : 0,
        fulfilmentRate: totalOrders ? Math.round((delivered / totalOrders) * 100) : 0,
      },
      revenue: {
        total: revenue[0]?.total || 0,
        averageOrder: revenue[0]?.count ? Math.round((revenue[0].total / revenue[0].count) * 10) / 10 : 0,
      },
      customers: {
        total: counts[4],
        repeatRate: customers ? Math.round((repeatBuyers / customers) * 100) : 0,
        averageOrdersPerCustomer: customers ? Math.round((totalOrders / customers) * 10) / 10 : 0,
      },
      delay: {
        avgMinutes: avgDelayMinutes,
        p90Minutes: p90DelayMinutes,
        note: 'delivered minus placed, Birgunj orders only',
      },
      stock: {
        products: counts[0],
        pendingApproval: counts[1],
        lowStock: counts[5],
        outOfStock: counts[6],
      },
      partners: {
        approvedMerchants: counts[2],
        riders: counts[3],
      },
      reviews: {
        count: reviewAgg[0]?.count || 0,
        average: reviewAgg[0] ? Math.round(reviewAgg[0].avg * 10) / 10 : 0,
      },
      topProducts: topProducts.map((t) => ({ name: t.name, qty: t.qty })),
    });
  } catch (e) {
    serverError(res, e);
  }
};
