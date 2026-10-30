/**
 * Redis-backed platform services shared across routes:
 *
 *   - cache     : read-through caching for hot public reads (product list,
 *                 categories, shops, dashboards) with tag-based invalidation
 *   - sessions  : login-session registry so tokens can be revoked server-side
 *                 (logout logs the token out EVERYWHERE, not just the browser)
 *   - blocklist : per-token deny-list used by the auth middleware
 *   - queue     : lightweight background task queue (resilient, at-least-once)
 *   - pubsub    : real-time fanout of notifications between processes
 *
 * Everything degrades to a no-op when Redis is unreachable, so a Redis outage
 * never takes the API down — behaviour is exactly the pre-Redis version.
 */
const { getRedis } = require('./redis');

const KEY = {
  cache: (tag, id) => `cache:${tag}:${id}`,
  session: (userId, jti) => `sess:${userId}:${jti}`,
  block: (jti) => `block:${jti}`,
  queue: 'tasks:queue',
  processing: 'tasks:processing',
};

// ---------------------------------------------------------------- cache ----

/** Read-through cache. `ttlSec` 0 disables. Never throws. */
async function cacheGet(key) {
  const redis = getRedis();
  if (!redis) return null;
  try { return await redis.get(KEY.cache('v1', key)); } catch { return null; }
}

async function cacheSet(key, value, ttlSec = 60) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const payload = JSON.stringify(value);
    if (ttlSec > 0) await redis.set(KEY.cache('v1', key), payload, 'EX', ttlSec);
    else await redis.set(KEY.cache('v1', key), payload);
  } catch { /* cache is best-effort */ }
}

/** Invalidate every cache entry whose key contains the fragment. */
async function cacheInvalidate(fragment) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const pattern = `${KEY.cache('v1', `*${fragment}*`)}`;
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(keys);
  } catch { /* best-effort */ }
}

/** Helper: `cached('products:list:…', 60, loader)` */
async function cached(key, ttlSec, loader) {
  const hitValue = await cacheGet(key);
  // JSON.parse: cacheSet stores JSON.stringify()'d values, but a raw string is
  // returned verbatim by redis.get. Without the parse a cached product list
  // comes back as a STRING, and `products.map` inside the controller throws —
  // which surfaced to shoppers as "Products could not be loaded".
  const parsed = typeof hitValue === 'string'
    ? (() => { try { return JSON.parse(hitValue); } catch { return null; } })()
    : hitValue;
  if (parsed !== null && parsed !== undefined) return parsed;
  const value = await loader();
  await cacheSet(key, value, ttlSec);
  return value;
}

// -------------------------------------------------------------- sessions ----

const SESSION_TTL = 60 * 60 * 24; // matches the 24h JWT

/**
 * Register a live session for a token's jti. The auth middleware checks this
 * before accepting the token, giving us instant server-side revocation.
 */
async function createSession(userId, jti) {
  const redis = getRedis();
  if (!redis || !jti) return;
  try {
    await redis.set(KEY.session(userId, jti), '1', 'EX', SESSION_TTL);
  } catch { /* degrade: tokens remain valid until expiry */ }
}

async function sessionExists(userId, jti) {
  const redis = getRedis();
  if (!redis || !jti) return true; // no registry → cannot prove revocation
  try { return (await redis.exists(KEY.session(userId, jti))) === 1; } catch { return true; }
}

async function revokeSession(userId, jti) {
  const redis = getRedis();
  if (!redis || !jti) return;
  try {
    await redis.del(KEY.session(userId, jti));
    await redis.set(KEY.block(jti), '1', 'EX', SESSION_TTL); // belt & braces
  } catch { /* best-effort */ }
}

async function revokeAllSessions(userId) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys(`sess:${userId}:*`);
    for (const k of keys) {
      const jti = k.split(':').pop();
      await redis.del(k);
      await redis.set(KEY.block(jti), '1', 'EX', SESSION_TTL);
    }
  } catch { /* best-effort */ }
}

async function isBlocked(jti) {
  const redis = getRedis();
  if (!redis || !jti) return false;
  try { return (await redis.exists(KEY.block(jti))) === 1; } catch { return false; }
}

// ----------------------------------------------------------------- queue ----

/**
 * Push a background job. Payload must be JSON-serialisable.
 * A single concurrent worker (started in server.js) drains the queue.
 */
async function enqueue(task) {
  const redis = getRedis();
  if (!redis) return false;
  try { await redis.rpush(KEY.queue, JSON.stringify(task)); return true; } catch { return false; }
}

/** Start a background worker. `handler(task)` should be idempotent — jobs are at-least-once. */
function startWorker(handler) {
  const redis = getRedis();
  if (!redis) return null;
  let stopped = false;
  (async function loop() {
    while (!stopped) {
      try {
        // BRPOPLPUSH: pop into a processing list so a crashed job can be re-queued.
        const raw = await redis.brpoplpush(KEY.queue, KEY.processing, 5);
        if (raw) {
          const task = JSON.parse(raw);
          try { await handler(task); await redis.lrem(KEY.processing, 1, raw); }
          catch (err) {
            console.error('[queue] task failed, leaving for retry:', err.message);
            // exponential backoff-lite: requeue at the tail after a pause
            await new Promise((r) => setTimeout(r, 2000));
            await redis.lrem(KEY.processing, 1, raw);
            await redis.rpush(KEY.queue, raw);
          }
        }
      } catch (err) {
        // brpoplpush timeout on some clients throws — pause and retry
        if (!String(err?.message).includes('timeout')) console.error('[queue]', err.message);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();
  return () => { stopped = true; };
}

// ---------------------------------------------------------------- pubsub ----

/** Publish a real-time event to all API processes (live dashboards, notifications). */
async function publish(channel, event) {
  const redis = getRedis();
  if (!redis) return;
  try { await redis.publish(`events:${channel}`, JSON.stringify(event)); } catch { /* best-effort */ }
}

/** Subscribe to a channel; `handler(event)` runs for every published event. */
function subscribe(channel, handler) {
  const redis = getRedis();
  if (!redis) return () => { };
  try {
    const sub = redis.duplicate();
    sub.subscribe(`events:${channel}`).catch(() => { });
    sub.on('message', (_ch, raw) => {
      try { handler(JSON.parse(raw)); } catch { /* malformed event ignored */ }
    });
    return () => { try { sub.disconnect(); } catch { /* noop */ } };
  } catch { return () => { }; }
}

module.exports = {
  cached, cacheGet, cacheSet, cacheInvalidate,
  createSession, sessionExists, revokeSession, revokeAllSessions, isBlocked,
  enqueue, startWorker,
  publish, subscribe,
};
