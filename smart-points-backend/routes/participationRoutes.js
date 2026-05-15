const express = require('express');
const router = express.Router();

const {
  submitParticipation,
  getMyParticipations,
  getReviewQueue,
  approveParticipation,
  rejectParticipation,
  getParticipantsByActivity
} = require('../controllers/participationController');

const {
  verifyToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

const { uploadProof } = require('../middleware/uploadMiddleware');

router.post(
  '/',
  verifyToken,
  authorizeRoles('community_member'),
  uploadProof.single('proof_file'),
  submitParticipation
);

router.get(
  '/activity/:id',
  verifyToken,
  authorizeRoles('admin'),
  getParticipantsByActivity
);

router.get(
  '/my',
  verifyToken,
  authorizeRoles('community_member'),
  getMyParticipations
);

router.get(
  '/review-queue',
  verifyToken,
  authorizeRoles('admin'),
  getReviewQueue
);

router.post(
  '/:id/approve',
  verifyToken,
  authorizeRoles('admin'),
  approveParticipation
);

router.post(
  '/:id/reject',
  verifyToken,
  authorizeRoles('admin'),
  rejectParticipation
);

module.exports = router;