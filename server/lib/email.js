/**
 * Email is intentionally NOT sent from this app anymore.
 *
 * The previous Resend integration (transactional provider) has been removed:
 * partner/order notifications now reach people through the in-app notification
 * centre and web push (utils/notifications.js), which need no third-party
 * account and cannot leak provider credentials.
 *
 * The notify* helpers below keep their old signatures so call sites stay
 * untouched — they simply resolve without doing anything.
 */

const noop = async () => false;

const emailConfigured = () => false;

/** Integration health: email delivery is no longer part of this app. */
async function checkEmailProvider() {
  return { status: 'not_configured' };
}

const sendEmail = noop;
const sendApplicationReceivedEmail = noop;
const sendPartnerStatusEmail = noop;
const sendProductReviewEmail = noop;
const sendOrderStatusEmail = noop;
const sendPasswordChangedEmail = noop;
const sendBestEffort = noop;

module.exports = {
  emailConfigured,
  checkEmailProvider,
  sendEmail,
  sendApplicationReceivedEmail,
  sendPartnerStatusEmail,
  sendProductReviewEmail,
  sendOrderStatusEmail,
  sendPasswordChangedEmail,
  sendBestEffort,
};
