const router = require('express').Router();
const c = require('../controllers/shopController');

// Public shop pages: /api/shops, /api/shops/:id
router.get('/', c.listShops);
router.get('/:id', c.getShop);

module.exports = router;
