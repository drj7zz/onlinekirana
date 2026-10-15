const router = require('express').Router();
const { register, login, checkStrength } = require('../controllers/authController');
const { rateLimit } = require('../middleware/rateLimit');
const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, keyFn: (req) => `register:${req.ip}` });
router.post('/register', registerLimit, register);
router.post('/login', login);
router.post('/password-strength', checkStrength);
module.exports = router;
