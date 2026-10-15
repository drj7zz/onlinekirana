const webpush = require('web-push');
const Notification = require('../models/Notification');
const User = require('../models/User');

const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@onlinekirana.com';
const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) webpush.setVapidDetails(subject, publicKey, privateKey);

async function pushToUser(userId, notice) {
  if (!pushEnabled) return;
  const user = await User.findById(userId).select('pushSubscriptions');
  if (!user?.pushSubscriptions?.length) return;

  const payload = JSON.stringify({
    title: notice.title,
    body: notice.body,
    url: notice.link,
  });

  await Promise.allSettled(user.pushSubscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription.toObject(), payload, { TTL: 60 * 60 * 24 });
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) {
        await User.updateOne({ _id: userId }, { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } });
      } else {
        console.warn('[push] delivery failed:', error.statusCode || error.message);
      }
    }
  }));
}

async function notifyUser(userId, notice) {
  if (!userId) return null;
  const saved = await Notification.create({
    user: userId,
    type: notice.type || 'general',
    title: String(notice.title || 'OnlineKirana update').slice(0, 120),
    body: String(notice.body || '').slice(0, 300),
    link: String(notice.link || '/'),
  });
  pushToUser(userId, notice).catch((error) => console.warn('[push] send failed:', error.message));
  return saved;
}

async function notifyUsers(userIds, notice) {
  const unique = [...new Set((userIds || []).filter(Boolean).map(String))];
  return Promise.allSettled(unique.map((id) => notifyUser(id, notice)));
}

module.exports = { notifyUser, notifyUsers, publicKey, pushEnabled };
