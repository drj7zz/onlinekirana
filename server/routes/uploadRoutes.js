const router = require('express').Router();
const auth = require('../middleware/auth');
const { UPLOADERS, handleUpload } = require('../middleware/upload');
const c = require('../controllers/uploadController');

router.use(auth);
router.post('/avatar', ...handleUpload(UPLOADERS.avatars), c.uploadAvatar);
router.post('/shop-logo', ...handleUpload(UPLOADERS.shops), c.uploadShopLogo);
router.post('/product', ...handleUpload(UPLOADERS.products), c.uploadProductImage);

module.exports = router;
