const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads/proofs');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and PDF files are allowed'));
  }
};

const uploadProof = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});


/* =====================================================
   REWARD IMAGE UPLOAD
   ===================================================== */

const rewardUploadDir = path.join(
  __dirname,
  '../uploads/rewards'
);

if (!fs.existsSync(rewardUploadDir)) {
  fs.mkdirSync(rewardUploadDir, {
    recursive: true
  });
}

const rewardStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, rewardUploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      'reward-' +
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname).toLowerCase();

    cb(null, uniqueName);
  }
});

const rewardFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp'
  ];

  const extension = path.extname(
    file.originalname
  ).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(extension)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Only JPG, PNG, and WebP reward images are allowed.'
      )
    );
  }
};

const uploadRewardImage = multer({
  storage: rewardStorage,
  fileFilter: rewardFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

/* =====================================================
   EXPORT BOTH UPLOAD MIDDLEWARES
   ===================================================== */

module.exports = {
  uploadProof,
  uploadRewardImage
};
