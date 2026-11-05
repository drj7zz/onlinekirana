const router = require('express').Router();
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const c = require('../controllers/adminAnalyticsController');
router.use(auth, requireAdmin);
router.get('/', c.overview);
module.exports = router;
