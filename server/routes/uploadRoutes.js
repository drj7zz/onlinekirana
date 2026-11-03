const router = require('express').Router();
const auth = require('../middleware/auth');
const { UPLOADERS, handleUpload, cloudEnabled, removeOld } = require('../middleware/upload');
const c = require('../controllers/uploadController');

router.use(auth);
// Cloudinary uploads return an absolute CDN URL; disk fallbacks return /uploads/…
const storeUrl = (req) => (cloudEnabled ? req.file.cloudinaryUrl : `/uploads/${req.file.cloudinaryPath || ''}`);

router.post('/avatar', ...handleUpload(UPLOADERS.avatars, 'avatars'), (req, res, next) => {
  if (cloudEnabled) req.uploadedUrl = req.file?.cloudinaryUrl;
  else if (req.file) req.uploadedUrl = `/uploads/avatars/${req.file.filename}`;
  next();
}, c.uploadAvatar);
router.delete('/avatar', c.removeAvatar);
router.post('/shop-logo', ...handleUpload(UPLOADERS.shops, 'shops'), (req, res, next) => {
  if (cloudEnabled) req.uploadedUrl = req.file?.cloudinaryUrl;
  else if (req.file) req.uploadedUrl = `/uploads/shops/${req.file.filename}`;
  next();
}, c.uploadShopLogo);
router.post('/product', ...handleUpload(UPLOADERS.products, 'products'), (req, res, next) => {
  if (cloudEnabled) req.uploadedUrl = req.file?.cloudinaryUrl;
  else if (req.file) req.uploadedUrl = `/uploads/products/${req.file.filename}`;
  next();
}, c.uploadProductImage);

module.exports = router;
