/**
 * Redis connection used for cross-process state: the rate-limit buckets and
 * (optionally) the token blocklist.
 *
 * Configuration comes entirely from `/server/.env`:
 *   REDIS_URL=redis://default:password@host:6379     (full URL form, e.g. Upstash)
 *   — or the individual parts —
 *   REDIS_HOST=localhost
 *   REDIS_PORT=6379
 *   REDIS_PASSWORD=secret
 *   REDIS_TLS=true                                   (for hosted TLS endpoints)
 *   REDIS_DB=0                                       (logical database index)
 *
 * If REDIS_URL / REDIS_HOST is absent the limiter transparently falls back to
 * the in-memory buckets, so local development keeps working without Redis.
 */
const Redis = require('ioredis');

let client = null;
let inMemoryFallback = false;

function buildOptions() {
  const url = process.env.REDIS_URL;
  if (url) {
    const opts = {};
    if (String(process.env.REDIS_TLS).toLowerCase() === 'true' && !/^rediss:/i.test(url)) opts.tls = {};
    return { url, ...opts };
  }
  if (!process.env.REDIS_HOST) return null; // no Redis configured
  return {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    ...(String(process.env.REDIS_TLS).toLowerCase() === 'true' ? { tls: {} } : {}),
  };
}

function getRedis() {
  if (client || inMemoryFallback) return client;
  const opts = buildOptions();
  if (!opts) {
    inMemoryFallback = true;
    console.log('[redis] not configured — using in-memory rate-limit buckets (per-process only)');
    return null;
  }
  try {
    client = new Redis(opts.url || opts, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
      // A single dead-endpoint burst is noise, not an outage: after this many
      // reconnect attempts, stop retrying and stay on the memory limiter.
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 3000)),
    });
    let failures = 0;
    client.on('error', (err) => {
      failures += 1;
      if (failures === 1 || failures % 20 === 0) console.error('[redis error]', err.message);
      if (failures > 5 && !inMemoryFallback) {
        // Stop hammering an unreachable Redis — requests fall back to memory.
        inMemoryFallback = true;
        console.error('[redis] unreachable after repeated errors — using in-memory buckets');
        try { client.disconnect(); } catch { /* already down */ }
        client = null;
      }
    });
    client.on('connect', () => { failures = 0; console.log('[redis] connected'); });
    client.on('reconnecting', () => { if (inMemoryFallback && client) { inMemoryFallback = false; } });
    return client;
  } catch (err) {
    console.error('[redis] init failed — falling back to memory:', err.message);
    inMemoryFallback = true;
    return null;
  }
}

/**
 * INCR a counter in a sliding window. Returns the count and the window's
 * remaining seconds. Falls back to null when Redis is unavailable so callers
 * can use their in-memory path.
 */
async function hit(key, windowMs) {
  const redis = getRedis();
  if (!redis) return null;
  const windowIndex = Math.floor(Date.now() / windowMs);
  const bucketKey = `rl:${key}:${windowIndex}`;
  try {
    const count = await redis.incr(bucketKey);
    if (count === 1) await redis.pexpire(bucketKey, windowMs);
    const retryAfter = Math.ceil(((windowIndex + 1) * windowMs - Date.now()) / 1000);
    return { count, retryAfter };
  } catch (err) {
    console.error('[redis hit failed]', err.message);
    return null;
  }
}

module.exports = { getRedis, hit };
