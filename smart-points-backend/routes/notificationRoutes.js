const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/authMiddleware');

// Get logged-in user's notifications
router.get(
  '/',
  verifyToken,
  notificationController.getMyNotifications
);

// Get unread count
router.get(
  '/unread-count',
  verifyToken,
  notificationController.getUnreadCount
);

// Mark all as read
router.patch(
  '/read-all',
  verifyToken,
  notificationController.markAllAsRead
);

// Mark one notification as read
router.patch(
  '/:id/read',
  verifyToken,
  notificationController.markAsRead
);

module.exports = router;