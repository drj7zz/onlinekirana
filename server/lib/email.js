const API_URL = 'https://api.resend.com';
const EMAIL_TIMEOUT_MS = 10000;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const emailConfig = () => ({
  apiKey: process.env.RESEND_API_KEY || '',
  from: process.env.EMAIL_FROM || '',
  replyTo: process.env.EMAIL_REPLY_TO || '',
});

const emailConfigured = () => {
  const { apiKey, from } = emailConfig();
  return Boolean(apiKey && from);
};

function requestWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function sendEmail({ to, subject, text, html }) {
  const { apiKey, from, replyTo } = emailConfig();
  if (!apiKey || !from) {
    const error = new Error('Transactional email is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  if (!to || !subject || !text || !html) {
    throw new Error('Transactional email requires a recipient, subject, text and HTML body.');
  }

  let response;
  try {
    response = await requestWithTimeout(`${API_URL}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        ...(replyTo && { reply_to: replyTo }),
        subject,
        text,
        html,
      }),
    });
  } catch (error) {
    const failure = new Error(error.name === 'AbortError' ? 'Resend request timed out.' : 'Resend could not be reached.');
    failure.code = error.name === 'AbortError' ? 'EMAIL_TIMEOUT' : 'EMAIL_PROVIDER_UNAVAILABLE';
    throw failure;
  }

  if (!response.ok) {
    const error = new Error(`Resend rejected the email request (HTTP ${response.status}).`);
    error.code = 'EMAIL_PROVIDER_REJECTED';
    error.status = response.status;
    throw error;
  }
  return response.json().catch(() => ({}));
}

async function checkEmailProvider() {
  const { apiKey, from } = emailConfig();
  if (!apiKey || !from) return { status: 'not_configured' };

  try {
    const response = await requestWithTimeout(`${API_URL}/domains`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return { status: 'error' };

    const fromAddress = from.match(/<([^<>]+)>/)?.[1] || from;
    const domain = fromAddress.split('@').pop()?.toLowerCase();
    const result = await response.json();
    const verified = (result.data || []).some((item) =>
      String(item.name || '').toLowerCase() === domain && item.status === 'verified'
    );
    return { status: verified ? 'ok' : 'sender_domain_not_verified' };
  } catch {
    return { status: 'error' };
  }
}

function emailLayout(title, content) {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f5f7f5;font-family:Arial,sans-serif;color:#202820"><main style="max-width:560px;margin:32px auto;padding:28px;background:#fff;border-radius:12px"><h1 style="font-size:22px;color:#0c831f">${escapeHtml(title)}</h1>${content}<p style="margin-top:28px;color:#667066;font-size:13px">OnlineKirana · Birgunj</p></main></body></html>`;
}

async function sendApplicationReceivedEmail(user) {
  const role = user.role === 'delivery' ? 'delivery partner' : 'merchant';
  return sendEmail({
    to: user.email,
    subject: 'OnlineKirana received your partner application',
    text: `Hello ${user.name}, your email is verified and your ${role} application is now with our operations team for review.`,
    html: emailLayout('Application received', `<p>Hello ${escapeHtml(user.name)},</p><p>Your email is verified and your ${escapeHtml(role)} application is now with our operations team for review.</p>`),
  });
}

async function sendPartnerStatusEmail(user, status) {
  const role = user.role === 'delivery' ? 'delivery partner' : 'shop';
  const approved = status === 'approved' || status === 'available';
  const title = approved ? 'Your OnlineKirana account is approved' : 'An update to your OnlineKirana account';
  const detail = approved
    ? 'Your account has been approved. Sign in to the partner portal to continue.'
    : 'Your account has been suspended. Please contact OnlineKirana support if you believe this is a mistake.';
  return sendEmail({
    to: user.email,
    subject: title,
    text: `Hello ${user.name}, your ${role} account status changed to ${status}. ${detail}`,
    html: emailLayout(title, `<p>Hello ${escapeHtml(user.name)},</p><p>Your ${escapeHtml(role)} account status changed to <strong>${escapeHtml(status)}</strong>.</p><p>${escapeHtml(detail)}</p>`),
  });
}

async function sendProductReviewEmail(user, product, status) {
  const approved = status === 'approved';
  const title = approved ? 'Your product is approved' : 'Your product needs changes';
  const detail = approved ? 'It is now available in your shop.' : 'It was not approved for listing. Please review the listing and contact support if you need help.';
  return sendEmail({
    to: user.email,
    subject: `${title}: ${product.name}`,
    text: `Hello ${user.name}, "${product.name}" ${approved ? 'was approved' : 'was not approved'}. ${detail}`,
    html: emailLayout(title, `<p>Hello ${escapeHtml(user.name)},</p><p><strong>${escapeHtml(product.name)}</strong> ${approved ? 'was approved' : 'was not approved'}.</p><p>${escapeHtml(detail)}</p>`),
  });
}

const ORDER_EMAILS = {
  placed: ['Order received', 'We received your order. The shop will prepare it shortly.'],
  packed: ['Your order is packed', 'The shop packed your order. A rider will take it to you.'],
  picked: ['Your order is on the way', 'The rider collected your order and is on the way.'],
  delivered: ['Your order was delivered', 'Your order has been marked as handed over.'],
  cancelled: ['Your order was cancelled', 'Your order has been cancelled. Contact support if you need help.'],
  failed: ['Delivery update', 'The delivery could not be completed. Operations is arranging the next step.'],
};

async function sendOrderStatusEmail(user, order, status) {
  const [title, detail] = ORDER_EMAILS[status] || [];
  if (!title) return null;
  const orderNumber = String(order._id).slice(-6).toUpperCase();
  return sendEmail({
    to: user.email,
    subject: `${title} · Order ${orderNumber}`,
    text: `Hello ${user.name}, ${detail} Order ${orderNumber}.`,
    html: emailLayout(title, `<p>Hello ${escapeHtml(user.name)},</p><p>${escapeHtml(detail)}</p><p>Order <strong>${escapeHtml(orderNumber)}</strong></p>`),
  });
}

async function sendPasswordChangedEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Your OnlineKirana password was changed',
    text: `Hello ${user.name}, your OnlineKirana password was changed. If you did not make this change, contact support immediately.`,
    html: emailLayout('Password changed', `<p>Hello ${escapeHtml(user.name)},</p><p>Your OnlineKirana password was changed. If you did not make this change, contact support immediately.</p>`),
  });
}

async function sendBestEffort(label, operation) {
  try {
    await operation();
    return true;
  } catch (error) {
    console.error(`[email] ${label} failed: ${error.message}`);
    return false;
  }
}

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
