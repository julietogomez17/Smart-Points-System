
const express = require('express');
const multer = require('multer');

const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error('Only JPG, PNG, and PDF files are allowed.')
      );
    }

    callback(null, true);
  }
});


const uploadRegistrationDocuments = (req, res, next) => {
  upload.fields([
    // Citizen verification
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },

    // Establishment  verification
    { name: 'business_permit', maxCount: 1 },
    { name: 'storefront_photo', maxCount: 1 },
    { name: 'representative_id', maxCount: 1 },

    // LGU verification
    { name: 'lgu_loi', maxCount: 1 },
    { name: 'lgu_id', maxCount: 1 }
  ])(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message: error.message
      });
    }

    next();
  });
};


router.post(
  '/register',
  uploadRegistrationDocuments,
  authController.register
);

router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOTP);
router.post('/reset-password', authController.resetPassword);

router.post('/verify-email', authController.verifyEmail);

router.post('/resend-otp', authController.resendEmailOTP);
// =====================================================
// RESUBMIT REJECTED ESTABLISHMENT APPLICATION
// =====================================================

router.post(
  '/partner/resubmit',
  verifyToken,
  uploadRegistrationDocuments,
  authController.resubmitPartner
);


router.get(
  '/me',
  verifyToken,
  authController.getCurrentUser
);

router.put(
  '/change-password',
  verifyToken,
  authController.changePassword
);

module.exports = router;
