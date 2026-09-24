const router = require('express').Router();
const { register, login, checkStrength } = require('../controllers/authController');
router.post('/register', register);
router.post('/login', login);
router.post('/password-strength', checkStrength);
module.exports = router;
