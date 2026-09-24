/**
 * Central place for user-facing error responses.
 *
 * In production we never send raw exception text (it can leak database names,
 * query shapes and stack details) to the client. The real error is logged on
 * the server for developers, while the client gets a calm, generic message.
 */

const isProd = process.env.NODE_ENV === 'production';

// A few error shapes are safe and useful to pass through verbatim.
const SAFE_MESSAGES = new Set([
  'Product not found',
  'Shop not found',
  'Order not found',
  'User not found',
  'Review not found',
  'Not allowed',
  'Rating must be between 1 and 5',
]);

/**
 * Send a 500 (or other status) response without leaking internals.
 * @param {import('express').Response} res
 * @param {Error} err
 * @param {number} [status]
 */
function serverError(res, err, status = 500) {
  // Developer-facing: keep the detail on the server logs only.
  console.error('[server error]', err?.stack || err?.message || err);

  const safe = SAFE_MESSAGES.has(err?.message) ? err.message : null;
  const message = safe && !isProd
    ? safe
    : 'Something went wrong on our side. Please try again in a moment.';

  return res.status(status).json({ message });
}

module.exports = { serverError };