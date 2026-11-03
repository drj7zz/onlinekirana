const router = require('express').Router();
const auth = require('../middleware/auth');
const { getMe, updateMe, changePassword } = require('../controllers/profileController');
const { rateLimit } = require('../middleware/rateLimit');
const passwordEmailLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyFn: (req) => `password-change:${req.user.id}` });

router.use(auth);
router.get('/', getMe);
router.put('/', updateMe);
router.put('/password', passwordEmailLimit, changePassword);

module.exports = router;
