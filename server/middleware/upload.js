/**
 * Image uploads — served from the Cloudinary CDN, not from this server's disk.
 *
 * Why Cloudinary: product/avatars/shop logos never touch the repo or the API's
 * local storage. Cloudinary auto-optimises (WebP/AVIF for modern browsers),
 * resizes on the fly via URL transforms and serves everything over a global
 * CDN — noticeably faster on mobile.
 *
 * The rest of the app stores whatever URL the upload returns; `imageUrl()` on
 * the frontend already handles absolute https URLs, so no frontend change is
 * needed. Local disk storage is kept as a fallback when Cloudinary is not
 * configured, so the API still boots in a bare environment.
 *
 * Security: mimetype + magic-byte signature are still verified; uploads are
 * limited to 3 MB and land in per-role folders (`avatars|shops|products`).
 */
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promises: fsp } = require('fs');
const { v2: cloudinary } = require('cloudinary');

// Configure from CLOUDINARY_URL (cloudinary://key:secret@cloud) when present.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config(true); // parse CLOUDINARY_URL
}

const cloudEnabled = Boolean(process.env.CLOUDINARY_URL);

// ---- local-disk fallback (used only when Cloudinary is not configured) ----
const ROOT = path.join(__dirname, '..', 'uploads');
for (const sub of ['avatars', 'shops', 'products']) {
  fs.mkdirSync(path.join(ROOT, sub), { recursive: true });
}

const storageFor = (sub) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(ROOT, sub)),
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
    cb(null, `${crypto.randomBytes(18).toString('hex')}${ext}`);
  },
});

// Memory storage when Cloudinary is on: the buffer streams straight up.
const memoryStorage = multer.memoryStorage();

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Magic-byte check — refuses a renamed .exe pretending to be a .jpg. */
async function hasValidSignature(file) {
  // disk-storage files have .path; memory-storage files have .buffer
  let bytes;
  if (file.buffer) bytes = file.buffer.subarray(0, 12);
  else {
    const handle = await fsp.open(file.path, 'r');
    try {
      const header = Buffer.alloc(12);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      bytes = header.subarray(0, bytesRead);
    } finally { await handle.close(); }
  }
  if (!bytes || bytes.length < 3) return false;
  if (file.mimetype === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

const makeUploader = (sub) => multer({
  storage: cloudEnabled ? memoryStorage : storageFor(sub),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
});

/**
 * Push a verified image to Cloudinary. Returns a delivery URL that auto-serves
 * WebP/AVIF (`f_auto`) and a width-capped, quality-optimised variant (`q_auto`).
 */
async function uploadToCloudinary(file, sub) {
  const b64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(b64, {
    folder: `onlinekirana/${sub}`,
    resource_type: 'image',
    overwrite: false,
    unique_filename: true,
  });
  // /f_auto,q_auto/ is inserted once into the delivery URL
  return result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
}

/** Delete a previously uploaded image so storage doesn't grow forever. */
async function removeOld(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') return;
  if (cloudEnabled && /res\.cloudinary\.com/.test(publicPath)) {
    // public_id is the path after /upload/ (minus transforms and extension)
    try {
      const m = /\/upload\/(?:f_auto,q_auto\/)?v\d+\/(.+?)(?:\.[a-zA-Z]+)?$/.exec(publicPath);
      if (m) await cloudinary.uploader.destroy(m[1]).catch(() => { });
    } catch { /* best-effort */ }
    return;
  }
  if (!publicPath.startsWith('/uploads/')) return;
  const rel = publicPath.slice('/uploads/'.length);
  if (!/^(avatars|shops|products)\/[a-zA-Z0-9._-]+$/.test(rel)) return;
  const abs = path.resolve(ROOT, rel);
  const relative = path.relative(ROOT, abs);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;
  fs.promises.unlink(abs).catch(() => { });
}

// Small wrapper so a bad file becomes a clean 400 instead of a Multer error page
const handleUpload = (uploader, sub) => [
  uploader.single('image'),
  async (req, res, next) => {
    if (!req.file) return next();
    let valid = false;
    try { valid = await hasValidSignature(req.file); } catch { valid = false; }
    if (!valid) {
      if (req.file.path) await fsp.unlink(req.file.path).catch(() => { });
      return res.status(400).json({ message: 'The uploaded file contents do not match a supported image format.' });
    }
    if (!cloudEnabled) return next(); // disk fallback: controller stores /uploads/… path
    try {
      const url = await uploadToCloudinary(req.file, sub);
      req.file.cloudinaryUrl = url;
      return next();
    } catch (err) {
      console.error('[cloudinary upload failed]', err.message);
      return res.status(502).json({ message: 'Image hosting is temporarily unavailable. Please try again.' });
    }
  },
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 3 MB' : 'Image upload failed' });
    }
    if (err) return res.status(400).json({ message: 'Only JPG, PNG or WebP images are allowed (max 3 MB)' });
    next();
  },
];

// One uploader per folder so the destination is deterministic (never inferred from the body).
const UPLOADERS = {
  avatars: makeUploader('avatars'),
  shops: makeUploader('shops'),
  products: makeUploader('products'),
};

module.exports = { UPLOADERS, handleUpload, UPLOAD_ROOT: ROOT, cloudEnabled, removeOld };
