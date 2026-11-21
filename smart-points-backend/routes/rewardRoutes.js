
const express = require("express");
const router = express.Router();

const db = require("../config/db");
const {uploadRewardImage} = require("../middleware/uploadMiddleware");

const requireApprovedLguIfApplicable = (req, res, next) => {
  if (req.user?.role !== "lgu") {
    return next();
  }

  const sql = `
    SELECT lr.user_id
    FROM lgu_registrations lr
    INNER JOIN users u ON u.user_id = lr.user_id
    WHERE lr.user_id = ?
      AND lr.verification_status = 'approved'
      AND u.status = 'active'
    LIMIT 1
  `;

  db.query(sql, [req.user.user_id], (error, rows) => {
    if (error) {
      console.error("LGU ACCESS CHECK ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to verify LGU authorization."
      });
    }

    if (!rows.length) {
      return res.status(403).json({
        success: false,
        message: "An approved, active LGU account is required."
      });
    }

    next();
  });
};


const {
  getAllRewards,
  getRewardById,
  createReward,
  updateReward,
  deleteReward,
  redeemReward,
  getMyRedemptions,
  getMonthlyBenefitStatus,
  claimMonthlyBenefit,
  getPendingRewards,
  approveReward,
  rejectReward,
  getPartnerRedemptions,
  approveRedemption,
  rejectRedemption,
  confirmRedemptionClaim,
  getPartnerDashboard,
} = require("../controllers/rewardController");

const {
  getAdminRedemptions,
  approveAdminRedemption,
  rejectAdminRedemption,
  confirmAdminRedemption,
} = require("../controllers/adminRedemptionController");

const {
  verifyToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const requireVerifiedPartner = require(
  "../middleware/requireVerifiedPartner"
);

const requireApprovedPartnerIfApplicable = (
  req,
  res,
  next
) => {
  if (req.user?.role !== "partner") {
    return next();
  }

  return requireVerifiedPartner(req, res, next);
};

// =====================================================
// ALL REWARDS
// =====================================================
router.get("/", verifyToken, getAllRewards);

// =====================================================
// CITIZEN REDEMPTIONS
// =====================================================
router.get(
  "/my/redemptions",
  verifyToken,
  authorizeRoles("community_member"),
  getMyRedemptions
);

router.get(
  "/monthly-benefit-status",
  verifyToken,
  authorizeRoles("community_member"),
  getMonthlyBenefitStatus
);

router.post(
  "/claim-monthly-benefit",
  verifyToken,
  authorizeRoles("community_member"),
  claimMonthlyBenefit
);

// =====================================================
// ADMIN - REWARD APPROVAL
// =====================================================
router.get(
  "/pending/list",
  verifyToken,
  authorizeRoles("admin", "lgu"),
  requireApprovedLguIfApplicable,
  getPendingRewards
);
// =====================================================
// ADMIN - REDEMPTION MANAGEMENT
// =====================================================


router.get(
  "/admin/redemptions",
  verifyToken,
  authorizeRoles("admin", "lgu"),
  requireApprovedLguIfApplicable,
  getAdminRedemptions
);

router.post(
  "/admin/redemptions/:id/approve",
  verifyToken,
  authorizeRoles("admin", "lgu"),
  requireApprovedLguIfApplicable,
  approveAdminRedemption
);

router.post(
  "/admin/redemptions/:id/reject",
  verifyToken,
  authorizeRoles("admin", "lgu"),
  requireApprovedLguIfApplicable,
  rejectAdminRedemption
);

router.post(
  "/admin/redemptions/:id/confirm",
  verifyToken,
  authorizeRoles("admin", "lgu"),
  requireApprovedLguIfApplicable,
  confirmAdminRedemption
);


// =====================================================
// PARTNER - REDEMPTION MANAGEMENT
// =====================================================
router.get(
  "/partner/redemptions",
  verifyToken,
  authorizeRoles("partner"),
  getPartnerRedemptions
);

router.post(
  "/partner/redemptions/:id/approve",
  verifyToken,
  authorizeRoles("partner"),
  requireVerifiedPartner,
  approveRedemption
);

router.post(
  "/partner/redemptions/:id/reject",
  verifyToken,
  authorizeRoles("partner"),
  requireVerifiedPartner,
  rejectRedemption
);

router.post(
  "/partner/redemptions/:id/confirm",
  verifyToken,
  authorizeRoles("partner"),
  requireVerifiedPartner,
  confirmRedemptionClaim
);

// =====================================================
// PARTNER DASHBOARD
// =====================================================
router.get(
  "/partner/dashboard",
  verifyToken,
  authorizeRoles("partner"),
  getPartnerDashboard
);

// =====================================================
// SINGLE REWARD
// =====================================================
router.get(
  "/:id",
  verifyToken,
  getRewardById
);

// =====================================================
// CREATE REWARD
// =====================================================

router.post(
  "/",
  verifyToken,
  authorizeRoles("admin", "partner", "lgu"),
  requireApprovedPartnerIfApplicable,
  requireApprovedLguIfApplicable,
  uploadRewardImage.single("reward_image"),
  createReward
);

// =====================================================
// ADMIN APPROVES PARTNER REWARD
// =====================================================
router.post(
  "/:id/approve",
  verifyToken,
  authorizeRoles("admin"),
  approveReward
);

// =====================================================
// ADMIN REJECTS PARTNER REWARD
// =====================================================
router.post(
  "/:id/reject",
  verifyToken,
  authorizeRoles("admin"),
  rejectReward
);

// =====================================================
// UPDATE REWARD
// =====================================================

router.put(
  "/:id",
  verifyToken,
  authorizeRoles("admin", "partner", "lgu"),
  requireApprovedPartnerIfApplicable,
  requireApprovedLguIfApplicable,
  uploadRewardImage.single("reward_image"),
  updateReward
);


// =====================================================
// DEACTIVATE REWARD
// =====================================================

router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("admin", "partner", "lgu"),
  requireApprovedPartnerIfApplicable,
  requireApprovedLguIfApplicable,
  deleteReward
);

// =====================================================
// CITIZEN REQUESTS REDEMPTION
// =====================================================
router.post(
  "/:id/redeem",
  verifyToken,
  authorizeRoles("community_member"),
  redeemReward
);

module.exports = router;
