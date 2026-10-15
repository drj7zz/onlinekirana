const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { requireAdmin, requireRider } = require('../middleware/roles');
const { rateLimit } = require('../middleware/rateLimit');
const auditAdmin = require('../middleware/auditAdmin');
const c = require('../controllers/deliveryController');
const otpAttemptLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 12, keyFn: (req) => `delivery-code:${req.user.id}` });

// ---- open to any signed-in user ----
router.use(auth);

/**
 * A malformed id in the URL is a client mistake, not a server fault. Without
 * this, `findById('garbage')` raises a Mongoose CastError that reaches the
 * error handler and answers 500. One guard turns every such call into a clean
 * 400 that names the field, instead of scattering `isValidObjectId` checks
 * through every controller.
 */
router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'That is not a valid id' });
  }
  next();
});

// Fees + the time slots still promiseable right now (checkout calls this).
router.get('/options', c.options);

// The hand-over code for my own order (buyer only — the controller checks).
router.get('/orders/:id/code', c.myCode);

// ---- dispatch desk (admin) ----
// The customer closes their own order with the code the rider reads out.
router.post('/orders/:id/confirm', otpAttemptLimit, c.confirmReceipt);

// ---- dispatch desk (admin): supervise, never hand-hold ----
router.get('/orders', requireAdmin, c.allJobs);
router.get('/riders', requireAdmin, c.riders);
router.patch('/riders/:id/status', requireAdmin, auditAdmin, c.setRiderStatus);
router.patch('/orders/:id', requireAdmin, auditAdmin, otpAttemptLimit, c.updateJob);
router.post('/orders/:id/cancel', requireAdmin, auditAdmin, c.cancelOrder);

// ---- rider ----
router.get('/jobs', requireRider, c.myJobs);
router.post('/jobs/:id/claim', requireRider, c.claim);
router.patch('/jobs/:id', requireRider, otpAttemptLimit, c.advance);
router.post('/availability', requireRider, c.setAvailability);

module.exports = router;
