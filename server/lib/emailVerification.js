const crypto = require('crypto');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const hashVerificationToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

async function issueVerificationToken(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  user.emailVerificationTokenHash = hashVerificationToken(token);
  user.emailVerificationExpires = new Date(Date.now() + TOKEN_TTL_MS);
  await user.save();
  return token;
}

module.exports = { hashVerificationToken, issueVerificationToken };
