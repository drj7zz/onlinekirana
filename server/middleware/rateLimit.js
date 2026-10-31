// Redis-backed rate limiter (shared across processes), with an in-memory
// fallback so a dev machine or a Redis outage never takes the API down.
//
// With REDIS_URL/REDIS_HOST set, buckets live in Redis so horizontally scaled
// instances enforce ONE shared limit instead of N per-process limits. Without
// it, behaviour is exactly the old per-process memory limiter.
const buckets = new Map();
const { hit: redisHit } = require('../lib/redis');

async function check(key, windowMs, max) {
  const r = await redisHit(key, windowMs, max);
  if (r) {
    return { count: r.count, retryAfter: Math.max(1, r.retryAfter) };
  }
  // ---- in-memory fallback (original behaviour) ----
  const now = Date.now();
  const entry = buckets.get(key) || { count: 0, resetAt: now + windowMs, retryAfter: 0 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count += 1;
  entry.retryAfter = Math.ceil((entry.resetAt - now) / 1000);
  buckets.set(key, entry);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  return { count: entry.count, retryAfter: entry.retryAfter };
}

function rateLimit({ windowMs = 15 * 60 * 1000, max = 5, keyFn = (req) => req.ip }) {
  return (req, res, next) => {
    const key = keyFn(req);
    if (!key) return next(); // no key → don't throttle
    check(key, windowMs, max)
      .then(({ count, retryAfter }) => {
        if (count > max) {
          res.set('Retry-After', String(retryAfter));
          return res.status(429).json({ message: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.` });
        }
        next();
      })
      .catch(next);
  };
}

// Login-specific limiter: keyed by IP + email so one locked account can't block an IP, and vice versa
const loginIp = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyFn: (req) => `ip:${req.ip}` });
const loginAccount = rateLimit({ windowMs: 15 * 60 * 1000, max: 6, keyFn: (req) => `acct:${(req.body?.email || '').toLowerCase().trim()}` });

module.exports = { rateLimit, loginIp, loginAccount };
