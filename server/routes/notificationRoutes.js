const router = require('express').Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { publicKey, pushEnabled } = require('../utils/notifications');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const [items, unreadCount] = await Promise.all([
      Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ user: req.user.id, readAt: null }),
    ]);
    res.json({ items, unreadCount, push: { enabled: pushEnabled, publicKey } });
  } catch {
    res.status(500).json({ message: 'Could not load notifications.' });
  }
});

router.post('/subscriptions', async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!pushEnabled) return res.status(503).json({ message: 'Push notifications are not configured yet.' });
    if (typeof endpoint !== 'string' || endpoint.length > 2048 || !endpoint.startsWith('https://') ||
        typeof keys?.p256dh !== 'string' || keys.p256dh.length > 256 ||
        typeof keys?.auth !== 'string' || keys.auth.length > 256) {
      return res.status(400).json({ message: 'Invalid push subscription.' });
    }
    await User.updateOne(
      { _id: req.user.id },
      {
        $pull: { pushSubscriptions: { endpoint } },
      }
    );
    await User.updateOne(
      { _id: req.user.id },
      { $push: { pushSubscriptions: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } } }
    );
    res.json({ subscribed: true });
  } catch {
    res.status(500).json({ message: 'Could not enable push notifications.' });
  }
});

router.delete('/subscriptions', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint === 'string') {
      await User.updateOne({ _id: req.user.id }, { $pull: { pushSubscriptions: { endpoint } } });
    }
    res.json({ subscribed: false });
  } catch {
    res.status(500).json({ message: 'Could not disable push notifications.' });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ read: true });
  } catch {
    res.status(500).json({ message: 'Could not update notifications.' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const notice = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notice) return res.status(404).json({ message: 'Notification not found.' });
    res.json(notice);
  } catch {
    res.status(500).json({ message: 'Could not update notification.' });
  }
});

module.exports = router;
