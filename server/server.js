const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const auth = require('./middleware/auth');
app.use(cors({ origin: process.env.CLIENT_URL || '*', exposedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '1mb' }));

// Role guard: runs after the router's auth middleware has set req.user
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access only' });
  next();
};

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/admin/products', auth, requireAdmin, require('./routes/adminRoutes'));
app.use('/api/admin/partners', auth, requireAdmin, require('./routes/adminPartnerRoutes'));
app.use('/api/partner', require('./routes/partnerRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/shops', require('./routes/shopRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));

// uploaded images (avatars, shop logos, product photos)
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true, city: 'Birgunj' }));

// 404 for unknown API routes (JSON, not an HTML error page)
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Last-resort error handler: log the real error, but never leak internals to clients
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[unhandled error]', err?.stack || err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ message: 'Something went wrong on our side. Please try again in a moment.' });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`onlinekirana API running on :${PORT}`)))
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
