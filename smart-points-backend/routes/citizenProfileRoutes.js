
const express = require('express');
const multer = require('multer');

const {
  getCitizenProfile,
  updateCitizenProfile,
  getProfilePicture,
  resubmitCitizenVerification
} = require('../controllers/citizenProfileController');

const {
  verifyToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

/* =====================================================
   PROFILE PICTURE UPLOAD CONFIGURATION
   Store temporarily in memory before saving to MySQL
===================================================== */

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          'Only JPEG, PNG, and WEBP images are allowed.'
        )
      );
    }

    cb(null, true);
  }
});
  /* =====================================================
   CITIZEN RESUBMISSION DOCUMENT UPLOAD
===================================================== */

const verificationUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
    fields: 3
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          'Verification documents must be JPG or PNG images.'
        )
      );
    }

    cb(null, true);
  }
});
/* =====================================================
   PROFILE ROUTES
===================================================== */

// GET CITIZEN PROFILE
router.get(
  '/profile',
  verifyToken,
  authorizeRoles('community_member'),
  getCitizenProfile
);

// GET PROFILE PICTURE FROM MYSQL
router.get(
  '/profile/picture',
  verifyToken,
  authorizeRoles('community_member'),
  getProfilePicture
);

/* =====================================================
   UPDATE PROFILE PICTURE ONLY

   Citizens cannot update their:
   - Full name
   - Email address
   - Contact number
   - Barangay
   - City
   - Address

   Only profile_picture is accepted.
===================================================== */

router.put(
  '/profile',
  verifyToken,
  authorizeRoles('community_member'),
  upload.single('profile_picture'),

  (req, res, next) => {
    const protectedFields = [
      'full_name',
      'first_name',
      'middle_name',
      'last_name',
      'suffix',
      'email',
      'phone',
      'phone_number',
      'contact_number',
      'barangay',
      'city',
      'address'
    ];

    const attemptedChanges = protectedFields.filter(
      (field) =>
        Object.prototype.hasOwnProperty.call(
          req.body || {},
          field
        )
    );

    if (attemptedChanges.length > 0) {
      return res.status(403).json({
        success: false,
        message:
          'Personal information cannot be changed. ' +
          'Please contact the LGU Administrator for corrections.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select a profile picture.'
      });
    }

    next();
  },

  updateCitizenProfile
);
  /* =====================================================
   RESUBMIT REJECTED CITIZEN VERIFICATION
===================================================== */

router.post(
  '/verification/resubmit',

  verifyToken,
  authorizeRoles('community_member'),

  verificationUpload.fields([
    {
      name: 'id_front',
      maxCount: 1
    },
    {
      name: 'id_back',
      maxCount: 1
    }
  ]),

  resubmitCitizenVerification
);
/* =====================================================
   MULTER ERROR HANDLER
===================================================== */

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Profile picture must not exceed 5 MB.'
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  next();
});

module.exports = router;
