const express = require('express');
const router = express.Router();

const {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  joinActivity
} = require('../controllers/activityController');

const {
  verifyToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

router.get('/', verifyToken, getAllActivities);
router.get('/:id', verifyToken, getActivityById);

router.post(
  '/',
  verifyToken,
  authorizeRoles('admin'),
  createActivity
);

router.put(
  '/:id',
  verifyToken,
  authorizeRoles('admin'),
  updateActivity
);

router.delete(
  '/:id',
  verifyToken,
  authorizeRoles('admin'),
  deleteActivity
);

router.post(
  '/:id/join',
  verifyToken,
  authorizeRoles('community_member'),
  joinActivity
);

module.exports = router;