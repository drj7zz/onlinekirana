const router = require('express').Router();
const auth = require('../middleware/auth');
const requireAdmin = (req, res, next) => (req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access only' }));
const { place, myOrders, allOrders, updateStatus } = require('../controllers/orderController');

router.use(auth);
router.post('/', place);
router.get('/mine', myOrders);
router.get('/', requireAdmin, allOrders);
router.patch('/:id/status', requireAdmin, updateStatus);

module.exports = router;
