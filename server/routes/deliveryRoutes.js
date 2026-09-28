const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { requireAdmin, requireRider } = require('../middleware/roles');
const c = require('../controllers/deliveryController');

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
router.post('/orders/:id/confirm', c.confirmReceipt);

// ---- dispatch desk (admin): supervise, never hand-hold ----
router.get('/orders', requireAdmin, c.allJobs);
router.get('/riders', requireAdmin, c.riders);
router.patch('/riders/:id/status', requireAdmin, c.setRiderStatus);
router.post('/orders/:id/assign', requireAdmin, c.assign);
router.patch('/orders/:id', requireAdmin, c.updateJob);
router.post('/orders/:id/cancel', requireAdmin, c.cancelOrder);

// ---- rider ----
router.get('/jobs', requireRider, c.myJobs);
router.post('/jobs/:id/claim', requireRider, c.claim);
router.patch('/jobs/:id', requireRider, c.advance);
router.post('/availability', requireRider, c.setAvailability);

module.exports = router;
