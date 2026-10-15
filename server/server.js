const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
/**
 * One env file: `server/.env`. Real environment variables (host dashboard, CI)
 * always win over the file, so a deployed host overrides any value without
 * touching the repo.
 */
require('dotenv').config({ path: path.join(__dirname, '.env') });

const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters.');
}
if (isProduction) {
  const productionOrigins = (process.env.CLIENT_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  const validOrigins = productionOrigins.length > 0 && productionOrigins.every((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol === 'https:' && parsed.origin === origin && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    } catch {
      return false;
    }
  });
  if (!validOrigins) throw new Error('Set CLIENT_URL to exact HTTPS storefront and partner portal origins only (no wildcards or local hosts).');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction && req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});
const auth = require('./middleware/auth');
const { requireAdmin } = require('./middleware/roles');
const auditAdmin = require('./middleware/auditAdmin');
/**
 * Allowed browser origins.
 *
 * `CLIENT_URL` stays supported for a single-origin deploy, but comma-separated
 * values are now allowed so the shop, the admin panel and the rider app can be
 * served from different hosts without opening CORS up to the world.
 */
const allowedOrigins = (process.env.CLIENT_URL || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// `localhost` and `127.0.0.1` are the same machine but different Origins to the
// browser, so allow the loopback twin of every configured host as well.
const loopbackVariants = (origin) => {
  const variants = new Set([origin]);
  const m = /^(https?:\/\/)(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.exec(origin);
  if (m) {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      variants.add(`${m[1]}${host}${m[3] || ''}`);
    }
  }
  return variants;
};

// `flatMap` only flattens arrays, so spread the Set from loopbackVariants explicitly.
const allowedVariants = new Set(
  allowedOrigins.flatMap((origin) => [...loopbackVariants(origin)])
);

app.use(
  cors({
    origin(origin, cb) {
      // Same-origin requests and non-browser clients (mobile, curl, tests) send no Origin.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes('*') || allowedVariants.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    exposedHeaders: ['Content-Type'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/delivery', require('./routes/deliveryRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/admin/products', auth, requireAdmin, auditAdmin, require('./routes/adminRoutes'));
app.use('/api/admin/partners', auth, requireAdmin, auditAdmin, require('./routes/adminPartnerRoutes'));
app.use('/api/admin/delivery', auth, requireAdmin, auditAdmin, require('./routes/adminDeliveryRoutes'));
app.use('/api/admin/audit', auth, requireAdmin, require('./routes/adminAuditRoutes'));
app.use('/api/partner', require('./routes/partnerRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/shops', require('./routes/shopRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));

// uploaded images (avatars, shop logos, product photos)
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ok: ready, city: 'Birgunj' });
});

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
