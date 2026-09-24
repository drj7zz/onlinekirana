const router = require('express').Router();
const auth = require('../middleware/auth');
const { stats } = require('../controllers/dashboardController');

router.use(auth);
router.get('/', stats);

module.exports = router;
