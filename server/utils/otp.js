const crypto = require('crypto');

/**
 * 4-digit hand-over code. Generated with crypto (not Math.random) because the
 * customer reads it out at the door to confirm they received the goods.
 */
const generateOtp = () => String(crypto.randomInt(1000, 10000));

/** Constant-time compare so a caller can't time their way to the code. */
const otpMatches = (a, b) => {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (x.length !== y.length || !x) return false;
  return crypto.timingSafeEqual(Buffer.from(x), Buffer.from(y));
};

module.exports = { generateOtp, otpMatches };
