const router = require('express').Router();
const auth = require('../middleware/auth');
const { register, login, checkStrength, logout } = require('../controllers/authController');
const { rateLimit, loginIp, loginAccount } = require('../middleware/rateLimit');
const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, keyFn: (req) => `register:${req.ip}` });
router.post('/register', registerLimit, register);
// loginAccount limits per-email so one locked account can't block an IP
router.post('/login', loginIp, loginAccount, login);
// password-strength is public too, so it gets its own limiter
const strengthLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, keyFn: (req) => `strength:${req.ip}` });
router.post('/password-strength', strengthLimit, checkStrength);
// Logout revokes the token server-side (Redis blocklist), not just in the browser.
router.post('/logout', auth, logout);
module.exports = router;
