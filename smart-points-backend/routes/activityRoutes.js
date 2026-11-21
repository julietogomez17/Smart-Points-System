const express = require('express');
const router = express.Router();

const {
  getAllActivities,
  getActivityById,
  getActivityQrCodes,
   regenerateActivityQrCodes,
  createActivity,
  updateActivity,
  approveActivity,
  rejectActivity,
  deleteActivity,
  joinActivity,
  unregisterActivity,
  checkInActivity,
  checkOutActivity

} = require('../controllers/activityController');

const {
  verifyToken,
  authorizeRoles,
  requireApprovedLguForActivities
} = require('../middleware/authMiddleware');

const uploadActivityImage = require('../middleware/activityImageUpload');
const requireVerifiedCitizen = require('../middleware/requireVerifiedCitizen');
const requireVerifiedPartner = require('../middleware/requireVerifiedPartner');
const requireApprovedPartnerIfApplicable = (req, res, next) => {
  if (req.user?.role !== 'partner') {
    return next();
  }

  return requireVerifiedPartner(req, res, next);
};

router.get('/', verifyToken, getAllActivities);
router.get('/:id', verifyToken, getActivityById);


router.get(
  '/:id/qr-codes',
  verifyToken,
  authorizeRoles('admin', 'lgu'),
  requireApprovedPartnerIfApplicable,
  requireApprovedLguForActivities,
  getActivityQrCodes
);

router.post(
  '/:id/qr-codes/regenerate',
  verifyToken,
 authorizeRoles('admin', 'lgu'),
  requireApprovedPartnerIfApplicable,
  requireApprovedLguForActivities,
  regenerateActivityQrCodes
);

router.post(
  '/',
  verifyToken,
authorizeRoles('admin', 'lgu'),
  requireApprovedPartnerIfApplicable,
  requireApprovedLguForActivities,
  uploadActivityImage.single('activity_image'),
  createActivity
);

router.put(
  '/:id',
  verifyToken,
authorizeRoles('admin', 'lgu'),
  requireApprovedPartnerIfApplicable,
  requireApprovedLguForActivities,
  uploadActivityImage.single('activity_image'),
  updateActivity
);

router.put(
  '/:id/approve',
  verifyToken,
  authorizeRoles('admin'),
  approveActivity
);

router.put(
  '/:id/reject',
  verifyToken,
  authorizeRoles('admin'),
  rejectActivity
);

router.delete(
  '/:id',
  verifyToken,
authorizeRoles('admin', 'lgu'),
  requireApprovedLguForActivities,
  deleteActivity
);



/* ==========================================
   CITIZEN QR ATTENDANCE ROUTES
   ========================================== */

router.post(
  '/:id/check-in',
  verifyToken,
  authorizeRoles('community_member'),
  requireVerifiedCitizen,
  checkInActivity
);

router.post(
  '/:id/check-out',
  verifyToken,
  authorizeRoles('community_member'),
  requireVerifiedCitizen,
  checkOutActivity
);


router.post(
  '/:id/join',
  verifyToken,
  authorizeRoles('community_member'),
  requireVerifiedCitizen,
  joinActivity
);

router.delete(
  '/:id/join',
  verifyToken,
  authorizeRoles('community_member'),
  unregisterActivity
);

module.exports = router;