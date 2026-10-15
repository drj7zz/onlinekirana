const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, default: 'general', maxlength: 40 },
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, default: '', maxlength: 300 },
  link: { type: String, default: '/' },
  readAt: { type: Date, default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });


notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
