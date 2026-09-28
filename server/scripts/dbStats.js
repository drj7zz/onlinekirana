require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Delivery = require('../models/Delivery');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const byRole = await User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }, { $sort: { n: -1 } }]);
  console.log('users by role :', byRole.map((r) => `${r._id}=${r.n}`).join('  ') || '(none)');
  console.log('products      :', await Product.countDocuments());
  console.log('orders        :', await Order.countDocuments());
  console.log('reviews       :', await Review.countDocuments());
  console.log('delivery jobs :', await Delivery.countDocuments());
  await mongoose.disconnect();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
