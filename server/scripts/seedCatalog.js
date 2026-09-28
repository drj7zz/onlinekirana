re/**
 * Seed a realistic Birgunj grocery catalogue into MongoDB.
 *
 * Nothing in the UI hardcodes products — this script is the single source of
 * demo data, and it writes through Mongoose so the app treats the seeded
 * rows exactly like anything a shopkeeper adds by hand.
 *
 * Idempotent: if approved products already exist it does nothing. Use
 * `--force` to wipe approved, admin-listed products and re-seed.
 *
 * Usage: npm run seed-catalog [-- --force]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');

// categories are seeded as plain strings on products; the storefront reads
// them back from GET /api/products/categories

const CATALOG = [
  // Sabzi — vegetables (per kg)
  { name: 'Aloo (Potato)', category: 'Sabzi', price: 60, unit: 'kg', stock: 120, description: 'Fresh local aloo from the Terai belt.' },
  { name: 'Pyaaj (Onion)', category: 'Sabzi', price: 85, unit: 'kg', stock: 90, description: 'Firm red onions, sorted and cleaned.' },
  { name: 'Tomato', category: 'Sabzi', price: 70, unit: 'kg', stock: 60, discountPercent: 10, description: 'Ripe, juicy tomatoes for curry and salad.' },
  { name: 'Kauli (Cauliflower)', category: 'Sabzi', price: 90, unit: 'kg', stock: 40 },
  { name: 'Bandaa (Cabbage)', category: 'Sabzi', price: 55, unit: 'kg', stock: 45 },
  { name: 'Kaalo Bodi (Black lentils)', category: 'Sabzi', price: 180, unit: 'kg', stock: 30 },
  // Chamal-Dal — rice, lentils & grains
  { name: 'Jeera Chamal (Cumin rice)', category: 'Chamal-Dal', price: 120, unit: 'kg', stock: 200, description: 'Everyday cumin rice, cleaned twice.' },
  { name: 'Musuro Dal (Red lentils)', category: 'Chamal-Dal', price: 160, unit: 'kg', stock: 80, discountPercent: 5 },
  { name: 'Rahar Dal (Pigeon peas)', category: 'Chamal-Dal', price: 190, unit: 'kg', stock: 60 },
  { name: 'Chamal Dal combo (5kg rice + 1kg dal)', category: 'Chamal-Dal', price: 745, unit: 'packet', stock: 25, discountPercent: 8, description: 'Week-of-daal-bhaatra bundle.' },
  // Phalphul — fruits
  { name: 'Kera (Banana)', category: 'Phalphul', price: 120, unit: 'dozen', stock: 50 },
  { name: 'Syau (Apple)', category: 'Phalphul', price: 250, unit: 'kg', stock: 45, description: 'Mustang apples, crunchy and sweet.' },
  { name: 'Anaar (Pomegranate)', category: 'Phalphul', price: 350, unit: 'kg', stock: 20, discountPercent: 12 },
  { name: 'Mewa (Grapes)', category: 'Phalphul', price: 220, unit: 'kg', stock: 25 },
  // Dairy
  { name: 'Doodh (Milk)', category: 'Dairy', price: 65, unit: 'litre', stock: 100, description: 'Pasteurised full-cream milk, delivered cold.' },
  { name: 'Dahi (Curd)', category: 'Dairy', price: 90, unit: 'piece', stock: 60, description: 'Set dahi in a 500g cup.' },
  { name: 'Chana (Paneer)', category: 'Dairy', price: 380, unit: 'kg', stock: 18, discountPercent: 6 },
  { name: 'Ghee (Clarified butter)', category: 'Dairy', price: 1250, unit: 'litre', stock: 12 },
  // Masala
  { name: 'Jeera Masu (Cumin powder)', category: 'Masala', price: 60, unit: 'packet', stock: 70 },
  { name: 'Chilli Powder', category: 'Masala', price: 55, unit: 'packet', stock: 85, description: 'Sun-dried Bhotay khursani, ground fine.' },
  { name: 'Turmeric Powder', category: 'Masala', price: 45, unit: 'packet', stock: 90 },
  { name: 'Garam Masala', category: 'Masala', price: 95, unit: 'packet', stock: 55, discountPercent: 15 },
  // Snacks & beverages
  { name: 'Chow Chow (Instant noodles)', category: 'Snacks', price: 25, unit: 'piece', stock: 300 },
  { name: 'Wai Wai Noodles', category: 'Snacks', price: 30, unit: 'piece', stock: 250, discountPercent: 10 },
  { name: 'Bhutta Kuwa (Roasted corn)', category: 'Snacks', price: 40, unit: 'packet', stock: 60 },
  { name: 'Real Fruit Juice 1L', category: 'Beverages', price: 210, unit: 'piece', stock: 40 },
  { name: 'Mineral Water 1L', category: 'Beverages', price: 30, unit: 'piece', stock: 200 },
  // Oil & ghee, bakery, kirana
  { name: 'Sunflower Oil 1L', category: 'Oil-Ghee', price: 285, unit: 'litre', stock: 90, discountPercent: 5 },
  { name: 'Mustard Oil 1L', category: 'Oil-Ghee', price: 320, unit: 'litre', stock: 65, description: 'Kalo tel — cold-pressed mustard oil.' },
  { name: 'Fresh Bread', category: 'Bakery', price: 60, unit: 'packet', stock: 35 },
  { name: 'Biscuits family pack', category: 'Bakery', price: 150, unit: 'packet', stock: 50 },
  { name: 'Cheeni (Sugar)', category: 'Kirana', price: 95, unit: 'kg', stock: 140 },
  { name: 'Nun (Salt)', category: 'Kirana', price: 30, unit: 'packet', stock: 160 },
  { name: 'Chino (Eggs)', category: 'Kirana', price: 22, unit: 'piece', stock: 180, description: 'Farm eggs, packed in dozens.' },
];

async function main() {
  const force = process.argv.includes('--force');
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME || undefined });
  console.log('Connected to MongoDB');

  const existing = await Product.countDocuments({ status: 'approved' });
  if (existing > 0 && !force) {
    console.log(`Catalogue already has ${existing} approved products — nothing to do. Run with --force to re-seed.`);
    await mongoose.disconnect();
    return;
  }
  if (force) {
    const del = await Product.deleteMany({ merchant: null, status: { $in: ['approved', 'pending'] } });
    console.log(`Removed ${del.deletedCount} admin-listed products`);
  }

  // pick any approved merchant to own the rows (falls back to admin); rows
  // without a merchant are treated as admin-listed by the app
  const owner =
    (await User.findOne({ role: 'merchant', merchantStatus: 'approved' })) ||
    (await User.findOne({ role: 'merchant' })) ||
    null;

  const rows = CATALOG.filter((p) => !p.skip).map(({ skip, ...p }) => ({
    ...p,
    merchant: owner ? owner._id : null,
    status: 'approved',
    isActive: true,
  }));

  const inserted = await Product.insertMany(rows);
  console.log(`Seeded ${inserted.length} products across ${new Set(rows.map((r) => r.category)).size} categories`);
  if (owner) console.log(`Owner: ${owner.shopName || owner.name}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
