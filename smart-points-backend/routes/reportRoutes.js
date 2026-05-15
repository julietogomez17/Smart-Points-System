const express = require('express');
const router = express.Router();

const {
  getDashboardSummary,
  getActivityEngagementReport,
  getMemberEngagementReport,
  getRedemptionReport,
  getFraudReport,
  getPartnerContributionReport,
   getSeasonLeaderboard
} = require('../controllers/reportController');

const {
  verifyToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

router.get('/dashboard', verifyToken, authorizeRoles('admin'), getDashboardSummary);
router.get('/activities', verifyToken, authorizeRoles('admin'), getActivityEngagementReport);
router.get('/members', verifyToken, authorizeRoles('admin'), getMemberEngagementReport);
router.get('/redemptions', verifyToken, authorizeRoles('admin'), getRedemptionReport);
router.get('/fraud', verifyToken, authorizeRoles('admin'), getFraudReport);
router.get('/partners', verifyToken, authorizeRoles('admin'), getPartnerContributionReport);
router.get('/season-leaderboard', verifyToken, getSeasonLeaderboard);

module.exports = router;