const db = require('../config/db');

// =========================================================
// GET MY NOTIFICATIONS
// GET /api/notifications
// =========================================================
const getMyNotifications = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT
      notification_id,
      user_id,
      type,
      title,
      message,
      reference_type,
      reference_id,
      is_read,
      created_at,
      read_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC, notification_id DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('GET NOTIFICATIONS ERROR:', err);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications'
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      notifications: results
    });
  });
};

// =========================================================
// GET UNREAD COUNT
// GET /api/notifications/unread-count
// =========================================================
const getUnreadCount = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT COUNT(*) AS unread_count
    FROM notifications
    WHERE user_id = ?
      AND is_read = 0
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('UNREAD COUNT ERROR:', err);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch unread notification count'
      });
    }

    return res.status(200).json({
      success: true,
      unread_count: Number(results[0]?.unread_count || 0)
    });
  });
};

// =========================================================
// MARK ONE NOTIFICATION AS READ
// PATCH /api/notifications/:id/read
// =========================================================
const markAsRead = (req, res) => {
  const userId = req.user.user_id;
  const notificationId = req.params.id;

  const sql = `
    UPDATE notifications
    SET
      is_read = 1,
      read_at = COALESCE(read_at, NOW())
    WHERE notification_id = ?
      AND user_id = ?
  `;

  db.query(
    sql,
    [notificationId, userId],
    (err, result) => {
      if (err) {
        console.error('MARK NOTIFICATION READ ERROR:', err);

        return res.status(500).json({
          success: false,
          message: 'Failed to mark notification as read'
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read'
      });
    }
  );
};

// =========================================================
// MARK ALL MY NOTIFICATIONS AS READ
// PATCH /api/notifications/read-all
// =========================================================
const markAllAsRead = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    UPDATE notifications
    SET
      is_read = 1,
      read_at = COALESCE(read_at, NOW())
    WHERE user_id = ?
      AND is_read = 0
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error('MARK ALL NOTIFICATIONS READ ERROR:', err);

      return res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updated_count: result.affectedRows
    });
  });
};

// =========================================================
// REUSABLE HELPER FOR OTHER CONTROLLERS
// This is NOT an API endpoint.
// Other controllers will use this when something happens.
// =========================================================
const createNotification = (
  userId,
  type,
  title,
  message,
  referenceType = null,
  referenceId = null,
  callback = null
) => {
  const sql = `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      reference_type,
      reference_id
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      userId,
      type,
      title,
      message,
      referenceType,
      referenceId
    ],
    (err, result) => {
      if (err) {
        console.error('CREATE NOTIFICATION ERROR:', err);
      }

      if (typeof callback === 'function') {
        callback(err, result);
      }
    }
  );
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification
};