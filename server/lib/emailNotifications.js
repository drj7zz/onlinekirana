const User = require('../models/User');
const Order = require('../models/Order');
const {
  sendApplicationReceivedEmail,
  sendPartnerStatusEmail,
  sendProductReviewEmail,
  sendOrderStatusEmail,
  sendPasswordChangedEmail,
  sendBestEffort,
} = require('./email');

const notifyApplicationReceived = (user) =>
  sendBestEffort('partner application email', () => sendApplicationReceivedEmail(user));

const notifyPartnerStatus = (user, status) =>
  sendBestEffort('partner status email', () => sendPartnerStatusEmail(user, status));

const notifyProductReview = async (merchantId, product, status) => {
  if (!merchantId) return false;
  return sendBestEffort('product review email', async () => {
    const merchant = await User.findOne({ _id: merchantId, role: 'merchant' }).select('name email');
    if (merchant) await sendProductReviewEmail(merchant, product, status);
  });
};

const notifyOrderStatus = async (orderOrId, status) => {
  return sendBestEffort(`order ${status} email`, async () => {
    const order = typeof orderOrId === 'object' && orderOrId?._id
      ? orderOrId
      : await Order.findById(orderOrId).select('_id user');
    if (!order?.user) return;
    const user = await User.findById(order.user).select('name email');
    if (user?.email) await sendOrderStatusEmail(user, order, status);
  });
};

const notifyPasswordChanged = (user) =>
  sendBestEffort('password security email', () => sendPasswordChangedEmail(user));

module.exports = {
  notifyApplicationReceived,
  notifyPartnerStatus,
  notifyProductReview,
  notifyOrderStatus,
  notifyPasswordChanged,
};
