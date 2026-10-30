/**
 * Token minting — the single place JWTs are created.
 *
 * Access tokens are short-lived (24h), typed (`typ: 'access'`) and issued by
 * `onlinekirana-api`, so a token minted by another service — or a hand-crafted
 * payload — is rejected by the auth middleware.
 *
 * Each token carries a unique `jti` (JWT ID) which is registered in Redis as a
 * live session at login and checked there at every request: logout, password
 * change and admin suspension revoke tokens instantly, not just at expiry.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createSession } = require('./platform');

const TOKEN_ISSUER = process.env.JWT_ISSUER || 'onlinekirana-api';

function signToken(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { id: user._id, role: user.role, name: user.name, typ: 'access', jti },
    process.env.JWT_SECRET,
    { expiresIn: '24h', issuer: TOKEN_ISSUER, subject: String(user._id) },
  );
  // Fire-and-forget: if Redis is down the token simply behaves statelessly.
  createSession(String(user._id), jti).catch(() => { });
  return token;
}

module.exports = { signToken, TOKEN_ISSUER };
