const router = require('express').Router();
const { list, getOne, categories } = require('../controllers/productController');
router.get('/', list);
router.get('/categories', categories);
router.get('/:id', getOne);
module.exports = router;
