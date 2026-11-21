
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(
  __dirname,
  '..',
  'uploads',
  'activities'
);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    }[file.mimetype];

    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension || ''}`
    );
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error('Only JPG, PNG and WebP images are allowed.')
    );
  }

  cb(null, true);
};

const uploadActivityImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = uploadActivityImage;
