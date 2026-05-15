const express = require('express');
const router = express.Router();

const {
  getRewardRecommendations
} = require('../controllers/recommendationController');

const {
  verifyToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

router.get(
  '/rewards',
  verifyToken,
  authorizeRoles('community_member'),
  getRewardRecommendations
);

module.exports = router;