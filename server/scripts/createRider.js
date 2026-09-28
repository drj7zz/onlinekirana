// Creates (or reactivates) a delivery rider. Usage: npm run seed-rider
// Details come from .env (RIDER_NAME / RIDER_EMAIL / RIDER_PASSWORD / RIDER_AREA / RIDER_VEHICLE)
// CLI args still win: npm run seed-rider <email> <password> <name> [area] [vehicle]
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const email = (process.argv[2] || process.env.RIDER_EMAIL || '').toLowerCase();
  const password = process.argv[3] || process.env.RIDER_PASSWORD || '';
  const name = process.argv[4] || process.env.RIDER_NAME || '';
  const riderArea = process.argv[5] || process.env.RIDER_AREA || '';
  const riderVehicle = process.argv[6] || process.env.RIDER_VEHICLE || '';

  if (!email || !password || !name) {
    console.error('Need at least an email, password and name (args or .env).');
    process.exit(1);
  }

  // upsert bypasses the pre('save') hook, so hash manually to keep comparePassword working
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate(
    { email },
    {
      name,
      email,
      password: hashed,
      role: 'delivery',
      riderArea,
      riderVehicle,
      riderStatus: 'available',
      // a rider's shop-partner fields are meaningless — clear them if reused
      merchantStatus: 'pending',
    },
    { upsert: true, new: true }
  );

  console.log(`Rider ready: ${user.email}`);
  console.log(`  name    : ${user.name}`);
  console.log(`  area    : ${user.riderArea || '(none)'}`);
  console.log(`  vehicle : ${user.riderVehicle || '(none)'}`);
  console.log(`  status  : ${user.riderStatus}`);
  await mongoose.disconnect();
  process.exit(0);
})();
