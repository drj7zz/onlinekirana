  const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/reviewController');

// public: read reviews for a product
router.get('/product/:productId', c.listForProduct);

// authenticated: create / update your own review, delete a review
router.post('/product/:productId', auth, c.upsertProduct);
router.post('/shop/:shopId', auth, c.upsertShop);
router.delete('/:id', auth, c.remove);

module.exports = router;