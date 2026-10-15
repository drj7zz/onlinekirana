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
const User = require('../models/User');
const requireRider = (req, res, next) => {
  if (!req.user || req.user.role !== 'delivery') return res.status(403).json({ message: 'Delivery partner access only.' });
  User.findOne({ _id: req.user.id, role: 'delivery', riderStatus: { $nin: ['pending', 'suspended'] }, merchantStatus: 'approved' })
    .select('_id')
    .then((rider) => rider ? next() : res.status(403).json({ message: 'Your rider account is not approved for deliveries.' }))
    .catch(next);
};

module.exports = { requireRole, requireAdmin, requireRider };
