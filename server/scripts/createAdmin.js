// Creates (or upgrades) an admin user. Usage: npm run seed-admin
// Admin login details come from .env (ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD).
// CLI args still win if provided: npm run seed-admin <email> <password> <name>
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const email = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@onlinekirana.com';
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.argv[4] || process.env.ADMIN_NAME || 'OnlineKirana Admin';

  // upsert bypasses the pre('save') hook, so hash manually to keep comparePassword working
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate(
    { email },
    { name, email, password: hashed, role: 'admin' },
    { upsert: true, new: true }
  );
  console.log(`Admin ready: ${user.email} (password: ${password})`);
  await mongoose.disconnect();
  process.exit(0);
})();
