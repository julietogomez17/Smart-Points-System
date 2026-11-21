const express = require('express');
const router = express.Router();

const {
  getDashboardSummary,
  getActivityEngagementReport,
  getMemberEngagementReport,
  getRedemptionReport,
  getFraudReport,
  getPartnerContributionReport,
  getParticipationTrendReport,
  getSeasonLeaderboard,
  getSmartPointsTransactions,
  getMyRecentPointsActivity
} = require('../controllers/reportController');


const {
  verifyToken,
  authorizeRoles,
  requireApprovedLguForReports
} = require('../middleware/authMiddleware');



// ==========================================
// ADMIN AND APPROVED LGU REPORTS
// ==========================================

const reportAccess = [
  verifyToken,
  authorizeRoles('admin', 'lgu'),
  requireApprovedLguForReports
];

// ==========================================
// SUPER ADMIN ONLY REPORTS
// ==========================================
const superAdminReportAccess = [
  verifyToken,
  authorizeRoles('admin')
];

// DASHBOARD SUMMARY
router.get(
  '/dashboard',
  ...reportAccess,
  getDashboardSummary
);

// ACTIVITY ENGAGEMENT
router.get(
  '/activities',
  ...reportAccess,
  getActivityEngagementReport
);

// MEMBER ENGAGEMENT
router.get(
  '/members',
  ...reportAccess,
  getMemberEngagementReport
);

// REDEMPTION REPORT - SUPER ADMIN AND APPROVED LGU
router.get(
  '/redemptions',
  ...reportAccess,
  getRedemptionReport
);

// FRAUD MONITORING
router.get(
  '/fraud',
  ...reportAccess,
  getFraudReport
);

// PARTNER CONTRIBUTION - SUPER ADMIN ONLY
router.get(
  '/partners',
  ...superAdminReportAccess,
  getPartnerContributionReport
);

// SMART POINTS TRANSACTIONS
router.get(
  '/points-transactions',
  ...reportAccess,
  getSmartPointsTransactions
);

// PARTICIPATION TRENDS
router.get(
  '/participation-trends',
  ...reportAccess,
  getParticipationTrendReport
);


// ==========================================
// COMMUNITY MEMBER - RECENT POINTS
// ==========================================
router.get(
  '/my-points-activity',
  verifyToken,
  authorizeRoles('community_member'),
  getMyRecentPointsActivity
);

// ==========================================
// SEASON LEADERBOARD
// ==========================================

router.get(
  '/season-leaderboard',
  verifyToken,
  getSeasonLeaderboard
);

module.exports = router;