const router = require('express').Router();
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { rateLimit } = require('../middleware/rateLimit');
const { getRedis } = require('../lib/redis');
const { cloudEnabled, checkCloudinary } = require('../middleware/upload');

const checkLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  keyFn: (req) => `integration-check:${req.user.id}`,
});

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Integration check timed out.')), timeoutMs);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

async function checkRedis() {
  const client = getRedis();
  if (!client) return { status: 'not_configured' };
  try {
    await withTimeout(client.ping(), 5000);
    return { status: 'ok' };
  } catch {
    return { status: 'error' };
  }
}

router.get('/', auth, requireAdmin, checkLimit, async (req, res) => {
  const [cloudinary, redis] = await Promise.all([
    cloudEnabled
      ? withTimeout(checkCloudinary(), 8000).then(() => ({ status: 'ok' })).catch(() => ({ status: 'error' }))
      : { status: 'not_configured' },
    checkRedis(),
  ]);
  res.json({ cloudinary, redis });
});

module.exports = router;
