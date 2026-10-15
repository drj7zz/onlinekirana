const AuditEvent = require('../models/AuditEvent');

// Record admin mutations without storing request bodies, customer data, tokens,
// IP addresses, or other credentials in the audit trail.
module.exports = function auditAdmin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  res.once('finish', () => {
    AuditEvent.create({
      actor: req.user.id,
      action: `${req.method} ${req.originalUrl.split('?')[0]}`.slice(0, 160),
      resourceId: String(req.params.id || ''),
      outcome: res.statusCode,
    }).catch((err) => console.error('[audit write failed]', err.message));
  });
  next();
};
