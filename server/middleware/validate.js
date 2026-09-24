// Field validation for auth routes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s.'-]{1,50}$/;
const PHONE_RE = /^9[678]\d{8}$/;                     // Nepali mobile (98/96/97...)
const COMMON = ['password', '123456', 'qwerty', 'abc123', 'password1', 'iloveyou', 'admin123', 'admin', 'letmein', 'welcome', 'monkey', 'dragon', '111111', '123123', 'kirana', 'onlinekirana', 'birgunj'];

function validatePassword(pw, { name = '', email = '' } = {}) {
  const errors = [];
  if (typeof pw !== 'string' || pw.length < 8) errors.push('At least 8 characters');
  if (pw.length > 72) errors.push('At most 72 characters');
  if (!/[a-z]/.test(pw)) errors.push('One lowercase letter');
  if (!/[A-Z]/.test(pw)) errors.push('One uppercase letter');
  if (!/\d/.test(pw)) errors.push('One number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('One symbol (e.g. ! @ # ?)');
  const lower = pw.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) errors.push('Too common — avoid words like "password", "admin", "kirana"');
  if (name && lower.includes(name.toLowerCase().split(' ')[0]) && name.split(' ')[0].length > 2) errors.push("Must not contain your name");
  if (email) {
    const local = email.split('@')[0].toLowerCase();
    if (local.length > 3 && lower.includes(local)) errors.push('Must not contain your email');
  }
  return errors;
}

function cleanStr(v, max = 200) {
  if (typeof v !== 'string') return '';
  return v.replace(/[<>]/g, '').trim().slice(0, max);
}

// POST /api/auth/register
function validateRegister(req, res, next) {
  const b = req.body || {};
  const errors = {};

  b.name = cleanStr(b.name, 60);
  b.email = cleanStr(b.email, 100).toLowerCase();
  if (b.shopName !== undefined) b.shopName = cleanStr(b.shopName, 80);
  if (b.phone !== undefined) b.phone = cleanStr(b.phone, 15);
  if (b.role !== undefined) b.role = b.role === 'merchant' ? 'merchant' : undefined; // role can ONLY become merchant via this endpoint — never admin

  if (!b.name || !NAME_RE.test(b.name)) errors.name = 'Enter a valid name (letters, 2–60 chars)';
  if (!EMAIL_RE.test(b.email)) errors.email = 'Enter a valid email address';
  const pwErrors = validatePassword(b.password, { name: b.name, email: b.email });
  if (pwErrors.length) errors.password = pwErrors.join(', ');
  if (b.phone && !PHONE_RE.test(b.phone)) errors.phone = 'Enter a valid Nepali mobile (98XXXXXXXX)';
  if (b.role === 'merchant' && !b.shopName) errors.shopName = 'Shop name is required for partners';
  if (b.address?.line) b.address.line = cleanStr(b.address.line, 200);
  if (b.address?.ward) b.address.ward = cleanStr(b.address.ward, 20);

  if (Object.keys(errors).length) return res.status(400).json({ message: 'Validation failed', errors });
  next();
}

// POST /api/auth/login
function validateLogin(req, res, next) {
  const b = req.body || {};
  b.email = cleanStr(b.email, 100).toLowerCase();
  b.password = typeof b.password === 'string' ? b.password.slice(0, 72) : '';
  if (!EMAIL_RE.test(b.email) || !b.password) {
    return res.status(400).json({ message: 'Enter a valid email and password' });
  }
  next();
}

module.exports = { validateRegister, validateLogin, validatePassword, cleanStr, NAME_RE, PHONE_RE };
