
/**
 * Removes the throwaway accounts created while testing the delivery flow.
 *
 * There is no DELETE /api/users route on purpose — accounts are not something
 * the API should be able to erase. This is a one-off maintenance script that
 * talks to Mongo directly, matched strictly on the throwaway email domain and
 * the known test names, so it cannot touch a real partner.
 *
 *   node scripts/cleanupTestAccounts.js          # dry run (default)
 *   node scripts/cleanupTestAccounts.js --apply  # actually delete
 */
require('dotenv').config({
  path: require('path').join(
    __dirname,
    '..',
    `.env.${process.env.NODE_ENV === 'production' || process.argv.includes('--prod') ? 'production' : 'development'}`
  ),
});
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Delivery = require('../models/Delivery');

// Only accounts whose email is one of these throwaway patterns.
const TEST_EMAIL = /@t\.com$|^probe\d+@test\.com$/i;
const TEST_NAME = /^(Test Khadka|Test Rider|Self Signup Rider|QA Rider|No Phone Rider|Plain Customer|Test Buyer)$/;

const isThrowaway = (u) => TEST_EMAIL.test(u.email || '') || TEST_NAME.test(u.name || '');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(APPLY ? 'APPLYING — this deletes data.' : 'DRY RUN — pass --apply to delete.');

  const users = await User.find().select('_id name email role');
  const mine = users.filter(isThrowaway);

  if (!mine.length) {
    console.log('No test accounts found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const ids = mine.map((u) => u._id);
  console.log(`\n${mine.length} test account(s):\n`);
  for (const u of mine) console.log(`  ${u.role.padEnd(9)} ${u.name.padEnd(20)} ${u.email}`);

  // Everything that hangs off those accounts has to go too, or the catalogue and
  // the order history keep pointing at users that no longer exist.
  const orders = await Order.find({ user: { $in: ids } }).select('_id');
  const products = await Product.find({ merchant: { $in: ids } }).select('_id');
  const orderIds = orders.map((o) => o._id);

  const counts = {
    orders: orderIds.length,
    deliveries: await Delivery.countDocuments({ order: { $in: orderIds } }),
    products: products.length,
    reviews: await Review.countDocuments({ user: { $in: ids } }),
  };
  console.log(`\nAlso removing: ${counts.orders} orders, ${counts.deliveries} delivery jobs, ` +
    `${counts.products} products, ${counts.reviews} reviews`);
  // Orders placed BY the test customers may contain test merchants' goods too.
  const strays = await Order.countDocuments({ 'items.merchant': { $in: ids } });
  if (strays) console.log(`  (+${strays} order lines belonging to these shops)`);

  if (!APPLY) {
    console.log('\nDry run complete. Nothing was deleted.');
    await mongoose.disconnect();
    return;
  }

  await Delivery.deleteMany({ order: { $in: orderIds } });
  await Review.deleteMany({ user: { $in: ids } });
  await Order.deleteMany({ $or: [{ user: { $in: ids } }, { 'items.merchant': { $in: ids } }] });
  await Product.deleteMany({ merchant: { $in: ids } });
  const res = await User.deleteMany({ _id: { $in: ids } });

  console.log(`\nDeleted ${res.deletedCount} account(s) and all their data.`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error('Cleanup failed:', e.message);
  process.exit(1);
});
