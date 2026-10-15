const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { promises: fsp } = require('fs');

// All uploads live under server/uploads — served statically by server.js
const ROOT = path.join(__dirname, '..', 'uploads');
for (const sub of ['avatars', 'shops', 'products']) {
  fs.mkdirSync(path.join(ROOT, sub), { recursive: true });
}

// Disk storage builder: each upload kind writes to its OWN folder.
// NOTE: multer's `destination` runs while the multipart body is still streaming,
// so we must NOT read req.body here — the sub-folder is fixed per kind instead.
const storageFor = (sub) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(ROOT, sub)),
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
    cb(null, `${crypto.randomBytes(18).toString('hex')}${ext}`);
  },
});

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

async function hasValidSignature(file) {
  const handle = await fsp.open(file.path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    if (file.mimetype === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (file.mimetype === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (file.mimetype === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    return false;
  } finally {
    await handle.close();
  }
}

const makeUploader = (sub) => multer({
  storage: storageFor(sub),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
});

// One uploader per folder so the destination is deterministic (never inferred from the body).
const UPLOADERS = {
  avatars: makeUploader('avatars'),
  shops: makeUploader('shops'),
  products: makeUploader('products'),
};

// Small wrapper so a bad file becomes a clean 400 instead of a Multer error page
const handleUpload = (uploader) => [
  uploader.single('image'),
  async (req, res, next) => {
    if (!req.file) return next();
    try {
      if (await hasValidSignature(req.file)) return next();
      await fsp.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ message: 'The uploaded file contents do not match a supported image format.' });
    } catch (err) {
      await fsp.unlink(req.file.path).catch(() => {});
      return next(err);
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

module.exports = { UPLOADERS, handleUpload, UPLOAD_ROOT: ROOT };
