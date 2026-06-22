const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `qr-${uniqueSuffix}${ext}`);
  }
});

const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

module.exports = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed!'), false);
  },
  // Allow large QR uploads (requested ~50MB)
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }
});



