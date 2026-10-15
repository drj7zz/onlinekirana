// Creates (or upgrades) an admin user. Usage: npm run seed-admin
// Admin login details come from .env (ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD).
// Passwords are read only from the environment so they do not appear in process listings.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validatePassword } = require('../middleware/validate');

(async () => {
  const email = process.argv[2] || process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.argv[3] || process.env.ADMIN_NAME || 'OnlineKirana Admin';
  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env or the hosting environment.');
  }
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail)) throw new Error('ADMIN_EMAIL must be a valid email address.');
  const passwordErrors = validatePassword(password, { name, email: normalizedEmail });
  if (passwordErrors.length) throw new Error(`ADMIN_PASSWORD does not meet policy: ${passwordErrors.join('; ')}`);

  await mongoose.connect(process.env.MONGO_URI);

  // upsert bypasses the pre('save') hook, so hash manually to keep comparePassword working
  const hashed = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { email: normalizedEmail },
    { name, email: normalizedEmail, password: hashed, role: 'admin' },
    { upsert: true, new: true }
  );
  console.log(`Admin ready: ${user.email}. Password was not printed.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error(`Admin seed failed: ${err.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
