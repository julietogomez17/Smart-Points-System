const db = require('../config/db');

// GET ALL ACTIVITIES
const getAllActivities = (req, res) => {
  const userRole = req.user?.role || null;
  const userId = req.user?.user_id || null;

  let sql = `
    SELECT 
      a.activity_id,
      a.title,
      a.description,
      a.category,
      a.location,
      a.date_start,
      a.date_end,
      a.points_value,
      a.capacity,
      a.validation_type,
      a.status,
      a.image_url,
      a.partner_id,
      p.organization_name AS partner_name,
      a.created_by,
      a.created_at,



      (
  SELECT COUNT(*)
  FROM activity_registrations ar2
  WHERE ar2.activity_id = a.activity_id
    AND ar2.registration_status = 'registered'
) AS joined_count,

      
      CASE 
        WHEN ar.user_id IS NOT NULL THEN true
        ELSE false
      END AS is_joined,

      ar.registration_status,
COALESCE(pr.status, 'pending') AS participation_status,
pr.ai_reason AS rejection_reason,
COALESCE(pr.awarded_points, 0) AS awarded_points

    FROM activities a
    LEFT JOIN partners p ON a.partner_id = p.partner_id

    -- 🔥 JOIN USER REGISTRATION
    LEFT JOIN activity_registrations ar 
      ON ar.activity_id = a.activity_id 
      AND ar.user_id = ?


      LEFT JOIN participation_records pr
  ON pr.activity_id = a.activity_id
  AND pr.user_id = ?`
  ;

if (userRole !== 'admin') {
  sql += `
    WHERE a.status != 'cancelled'
       OR ar.user_id IS NOT NULL
  `;
}

sql += ` ORDER BY a.date_start DESC `;

 db.query(sql, [userId, userId], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch activities',
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      activities: results
    });
  });
};
// GET SINGLE ACTIVITY
const getActivityById = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      a.activity_id,
      a.title,
      a.description,
      a.category,
      a.location,
      a.date_start,
      a.date_end,
      a.points_value,
      a.capacity,
      a.validation_type,
      a.status,
     image_url = COALESCE(?, image_url),
      a.partner_id,
      p.organization_name AS partner_name,
      a.created_by,
      a.created_at
    FROM activities a
    LEFT JOIN partners p ON a.partner_id = p.partner_id
    WHERE a.activity_id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch activity',
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    return res.status(200).json({
      success: true,
      activity: results[0]
    });
  });
};

// CREATE ACTIVITY
const createActivity = (req, res) => {
  const {
    title,
    description,
    category,
    location,
    date_start,
    date_end,
    points_value,
    capacity,
    validation_type,
    status,
    partner_id,
    image_url
  } = req.body;

  if (!title || !date_start || points_value === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Title, date_start, and points_value are required'
    });
  }

  const allowedValidationTypes = ['manual', 'qr', 'proof_upload'];
  const allowedStatuses = ['draft', 'open', 'closed', 'completed', 'cancelled'];

  const finalValidationType = allowedValidationTypes.includes(validation_type)
    ? validation_type
    : 'manual';

  const finalStatus = allowedStatuses.includes(status)
    ? status
    : 'draft';

  const sql = `
    INSERT INTO activities (
      title,
      description,
      category,
      location,
      date_start,
      date_end,
      points_value,
      capacity,
      validation_type,
      status,
      partner_id,
      image_url,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      title,
      description || null,
      category || null,
      location || null,
      date_start,
      date_end || null,
      Number(points_value),
      capacity === '' || capacity === undefined ? null : Number(capacity),
      finalValidationType,
      finalStatus,
    partner_id === '' ||
partner_id === undefined ||
partner_id === null ||
Number(partner_id) === 0 ||
Number.isNaN(Number(partner_id))
  ? null
  : Number(partner_id),
      image_url || null,
      req.user.user_id
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create activity',
          error: err.message
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Activity created successfully',
        activity_id: result.insertId
      });
    }
  );
};

// UPDATE ACTIVITY
const updateActivity = (req, res) => {
  const { id } = req.params;

  const {
    title,
    description,
    category,
    location,
    date_start,
    date_end,
    points_value,
    capacity,
    validation_type,
    status,
    partner_id,
    image_url
  } = req.body;

  const allowedValidationTypes = ['manual', 'qr', 'proof_upload'];
  const allowedStatuses = ['draft', 'open', 'closed', 'completed', 'cancelled'];

  const finalValidationType = allowedValidationTypes.includes(validation_type)
    ? validation_type
    : 'manual';

  const finalStatus = allowedStatuses.includes(status)
    ? status
    : 'draft';

  const sql = `
    UPDATE activities
    SET
      title = ?,
      description = ?,
      category = ?,
      location = ?,
      date_start = ?,
      date_end = ?,
      points_value = ?,
      capacity = ?,
      validation_type = ?,
      status = ?,

      image_url = ?
    WHERE activity_id = ?
  `;

  db.query(
    sql,
    [
      title,
      description || null,
      category || null,
      location || null,
      date_start,
      date_end || null,
      Number(points_value),
      capacity === '' || capacity === undefined ? null : Number(capacity),
      finalValidationType,
      finalStatus,
     
      image_url || null,
      id
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update activity',
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Activity not found'
        });
      }



      db.query(
  `INSERT INTO audit_logs 
   (actor_user_id, action_type, entity_type, entity_id, details)
   VALUES (?, ?, ?, ?, ?)`,
  [
    req.user.user_id,
    'UPDATE',
    'activity',
    id,
    `Updated activity: ${title}`
  ]
);

      return res.status(200).json({
        success: true,
        message: 'Activity updated successfully'
      });


    }
  );
};

// DELETE / CANCEL ACTIVITY
const deleteActivity = (req, res) => {
  const { id } = req.params;

  const checkSql = `
    SELECT 
      (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = ?) AS registration_count,
      (SELECT COUNT(*) FROM participation_records WHERE activity_id = ?) AS participation_count
  `;

  db.query(checkSql, [id, id], (checkErr, checkResults) => {
    if (checkErr) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check activity references',
        error: checkErr.message
      });
    }

    const { registration_count, participation_count } = checkResults[0];

    if (registration_count > 0 || participation_count > 0) {
      const softDeleteSql = `
        UPDATE activities
        SET status = 'cancelled'
        WHERE activity_id = ?
      `;

      db.query(softDeleteSql, [id], (softErr, softResult) => {
        if (softErr) {
          return res.status(500).json({
            success: false,
            message: 'Failed to cancel activity',
            error: softErr.message
          });
        }

        if (softResult.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'Activity not found'
          });
        }


 //  AUDIT LOG
db.query(
  `INSERT INTO audit_logs 
   (actor_user_id, action_type, entity_type, entity_id, details)
   VALUES (?, ?, ?, ?, ?)`,
  [
    req.user.user_id,
    'CANCEL',
    'activity',
    id,
    'Cancelled activity'
  ]
);




        return res.status(200).json({
          success: true,
          message: 'Activity is already in use, so it was marked as cancelled instead of being deleted'
        });

       


      });
    } else {
      db.query('DELETE FROM activities WHERE activity_id = ?', [id], (err, result) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Failed to delete activity',
            error: err.message
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'Activity not found'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Activity deleted successfully'
        });
      });
    }
  });
};

// JOIN ACTIVITY
const joinActivity = (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;

  const checkActivitySql = `
    SELECT activity_id, title, capacity, status
    FROM activities
    WHERE activity_id = ?
  `;

  db.query(checkActivitySql, [id], (activityErr, activityResults) => {
    if (activityErr) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check activity',
        error: activityErr.message
      });
    }

    if (activityResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    const activity = activityResults[0];

    if (activity.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'This activity is not open for registration'
      });
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM activity_registrations
      WHERE activity_id = ? AND registration_status = 'registered'
    `;

    db.query(countSql, [id], (countErr, countResults) => {
      if (countErr) {
        return res.status(500).json({
          success: false,
          message: 'Failed to check activity capacity',
          error: countErr.message
        });
      }

      const totalRegistered = countResults[0].total;

      if (activity.capacity !== null && totalRegistered >= activity.capacity) {
        return res.status(400).json({
          success: false,
          message: 'Activity is already full'
        });
      }

      const insertSql = `
        INSERT INTO activity_registrations (user_id, activity_id, registration_status)
        VALUES (?, ?, 'registered')
      `;

      db.query(insertSql, [userId, id], (insertErr) => {
        if (insertErr) {
          if (insertErr.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
              success: false,
              message: 'You have already joined this activity'
            });
          }

          return res.status(500).json({
            success: false,
            message: 'Failed to join activity',
            error: insertErr.message
          });
        }

        return res.status(201).json({
          success: true,
          message: 'Joined activity successfully'
        });
      });
    });
  });
};

module.exports = {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  joinActivity
};