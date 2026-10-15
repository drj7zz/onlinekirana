const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const requireAdmin = (req, res, next) => (req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access only' }));
const { place, myOrders, allOrders, cancellationStatus, cancelMine } = require('../controllers/orderController');
const { cancelOrder } = require('../controllers/deliveryController');
const auditAdmin = require('../middleware/auditAdmin');
const { rateLimit } = require('../middleware/rateLimit');
const customerCancelLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 6, keyFn: (req) => `cancel:${req.user.id}` });

router.use(auth);
router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'That is not a valid id.' });
  next();
});
router.post('/', place);
router.get('/mine', myOrders);
router.get('/cancellation-status', cancellationStatus);
router.post('/:id/cancel', customerCancelLimit, cancelMine);
router.get('/', requireAdmin, allOrders);
router.patch('/:id/status', requireAdmin, auditAdmin, (req, res, next) => {
  if (req.body?.status !== 'cancelled') {
    return res.status(409).json({ message: 'Order progress is updated by the shop and rider. Admins can cancel an order here.' });
  }
  return cancelOrder(req, res, next);
});

module.exports = router;
