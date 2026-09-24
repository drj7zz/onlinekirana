const router = require('express').Router();
const auth = require('../middleware/auth');
const { getMe, updateMe, changePassword } = require('../controllers/profileController');

router.use(auth);
router.get('/', getMe);
router.put('/', updateMe);
router.put('/password', changePassword);

module.exports = router;
