const crypto = require('crypto');

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

const hashVerificationCode = (code) =>
  crypto.createHash('sha256').update(code).digest('hex');

async function issueVerificationCode(user) {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  user.emailVerificationCodeHash = hashVerificationCode(code);
  user.emailVerificationExpires = new Date(Date.now() + CODE_TTL_MS);
  user.emailVerificationAttempts = 0;
  await user.save();
  return code;
}

module.exports = {
  hashVerificationCode,
  issueVerificationCode,
  MAX_CODE_ATTEMPTS,
  CODE_TTL_MS,
};
