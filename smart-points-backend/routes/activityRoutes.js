const express = require('express');
const router = express.Router();

const {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  approveActivity,
  rejectActivity,
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
  authorizeRoles('admin', 'partner'),
  createActivity
);

router.put(
  '/:id',
  verifyToken,
  authorizeRoles('admin', 'partner'),
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
  authorizeRoles('admin', 'partner'),
  deleteActivity
);

router.post(
  '/:id/join',
  verifyToken,
  authorizeRoles('community_member'),
  joinActivity
);

module.exports = router;