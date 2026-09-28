/**
 * Role guards for the API. Each one assumes `auth` has already run and set
 * `req.user`, so they only ever inspect a verified token's role claim.
 */

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'No token, please log in' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have access to this area' });
  }
  next();
};

const requireAdmin = requireRole('admin');
const requireRider = requireRole('delivery');

module.exports = { requireRole, requireAdmin, requireRider };
