const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
  },
});

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

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
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 3 MB' : 'Image upload failed' });
    }
    if (err) return res.status(400).json({ message: 'Only JPG, PNG or WebP images are allowed (max 3 MB)' });
    next();
  },
];

module.exports = { UPLOADERS, handleUpload, UPLOAD_ROOT: ROOT };
