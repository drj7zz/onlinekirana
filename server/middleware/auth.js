const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { TOKEN_ISSUER } = require('../lib/tokens');
const { sessionExists, isBlocked } = require('../lib/platform');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token, please log in' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  // Reject tokens that don't look like ours (wrong issuer/type) rather than
  // trusting an unsigned field named `id` from some other token source.
  if (payload?.typ !== 'access' || payload.iss !== TOKEN_ISSUER || !payload.id || typeof payload.role !== 'string') {
    return res.status(401).json({ message: 'Invalid token' });
  }
  // Revocation check (Redis): a logged-out or revoked token is dead instantly,
  // even though its JWT has not expired yet. Unavailable Redis = allow.
  Promise.all([sessionExists(payload.id, payload.jti), isBlocked(payload.jti)])
    .then(([live, blocked]) => {
      if (blocked || (payload.jti && !live)) {
        return res.status(401).json({ message: 'Session ended. Please sign in again.' });
      }
      // The JWT is stateless, so a deleted or suspended account's old token
      // would otherwise stay valid until expiry — a cheap existence check
      // keeps every authenticated route honest.
      return User.exists({ _id: payload.id }).then((exists) => {
        if (!exists) return res.status(401).json({ message: 'Account no longer exists' });
        req.user = payload;
        next();
      });
    })
    .catch(next);
};
