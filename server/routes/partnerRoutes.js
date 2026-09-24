const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/partnerController');
const shop = require('../controllers/shopController');

router.use(auth, c.requireMerchant);
router.get('/shop', shop.myShop);
router.put('/shop', shop.updateMyShop);
router.get('/products', c.myProducts);
router.post('/products', c.create);
router.put('/products/:id', c.update);
router.delete('/products/:id', c.remove);
router.get('/orders', c.myOrders);
router.patch('/orders/:id/status', c.updateOrderStatus);

module.exports = router;
