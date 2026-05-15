const express = require('express');
const router = express.Router();

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
  rejectReward
} = require('../controllers/rewardController');

const {
  verifyToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

router.get('/', verifyToken, getAllRewards);

router.get(
  '/my/redemptions',
  verifyToken,
  authorizeRoles('community_member'),
  getMyRedemptions
);

router.get(
  '/monthly-benefit-status',
  verifyToken,
  authorizeRoles('community_member'),
  getMonthlyBenefitStatus
);

router.post(
  '/claim-monthly-benefit',
  verifyToken,
  authorizeRoles('community_member'),
  claimMonthlyBenefit
);

router.get(
  '/pending/list',
  verifyToken,
  authorizeRoles('admin'),
  getPendingRewards
);

router.get('/:id', verifyToken, getRewardById);

router.post(
  '/',
  verifyToken,
  authorizeRoles('admin', 'partner'),
  createReward
);

router.post(
  '/:id/approve',
  verifyToken,
  authorizeRoles('admin'),
  approveReward
);

router.post(
  '/:id/reject',
  verifyToken,
  authorizeRoles('admin'),
  rejectReward
);

router.put(
  '/:id',
  verifyToken,
  authorizeRoles('admin', 'partner'),
  updateReward
);

router.delete(
  '/:id',
  verifyToken,
  authorizeRoles('admin'),
  deleteReward
);

router.post(
  '/:id/redeem',
  verifyToken,
  authorizeRoles('community_member'),
  redeemReward
);

module.exports = router;