const router = require('express').Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const { register, login, checkStrength, logout } = authController;
const { rateLimit, loginIp, loginAccount } = require('../middleware/rateLimit');
const crypto = require('crypto');
const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, keyFn: (req) => `register:${req.ip}` });
const emailKey = (req) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  return email ? crypto.createHash('sha256').update(email).digest('hex') : null;
};
const registrationEmailLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyFn: (req) => ['merchant', 'delivery'].includes(req.body?.role) ? `partner-verification-code:${emailKey(req)}` : null,
});
const resendIpLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 12, keyFn: (req) => `verification-ip:${req.ip}` });
const resendEmailLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, keyFn: (req) => `partner-verification-code:${emailKey(req)}` });
const verifyIpLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyFn: (req) => `verification-attempt:${req.ip}` });
router.post('/register', registerLimit, registrationEmailLimit, register);
router.post('/verify-email', verifyIpLimit, authController.verifyEmail);
router.post('/resend-verification', resendIpLimit, resendEmailLimit, authController.resendVerification);
// loginAccount limits per-email so one locked account can't block an IP
router.post('/login', loginIp, loginAccount, login);
// password-strength is public too, so it gets its own limiter
const strengthLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, keyFn: (req) => `strength:${req.ip}` });
router.post('/password-strength', strengthLimit, checkStrength);
// Logout revokes the token server-side (Redis blocklist), not just in the browser.
router.post('/logout', auth, logout);
module.exports = router;
