// Simple in-memory rate limiter (per key). For production behind multiple instances use Redis.
const buckets = new Map();

function rateLimit({ windowMs = 15 * 60 * 1000, max = 5, keyFn = (req) => req.ip }) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = buckets.get(key) || { count: 0, resetAt: now + windowMs, retryAfter: 0 };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
    entry.count += 1;
    entry.retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    buckets.set(key, entry);

    // periodic cleanup
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);

    if (entry.count > max) {
      res.set('Retry-After', String(entry.retryAfter));
      return res.status(429).json({ message: `Too many attempts. Try again in ${Math.ceil(entry.retryAfter / 60)} minutes.` });
    }
    next();
  };
}

// Login-specific limiter: keyed by IP + email so one locked account can't block an IP, and vice versa
const loginIp = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyFn: (req) => `ip:${req.ip}` });
const loginAccount = rateLimit({ windowMs: 15 * 60 * 1000, max: 6, keyFn: (req) => `acct:${(req.body?.email || '').toLowerCase().trim()}` });

module.exports = { rateLimit, loginIp, loginAccount };
