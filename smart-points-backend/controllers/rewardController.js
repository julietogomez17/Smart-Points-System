const db = require('../config/db');

const {
  saveImage,
  cleanupTemporaryImage,
  rollbackUploadedImage,
  useCloudinary
} = require("../utils/imageStorage");

const { createNotification} = require('./notificationController');

const BENEFIT_MAP = {
  New: 0,
  Bronze: 20,
  Silver: 50,
  Gold: 100,
  Platinum: 250,
  Diamond: 300
};

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// GET ALL REWARDS

const getAllRewards = (req, res) => {
  const userRole = req.user?.role;
  const userId = req.user?.user_id;

  let sql = `
    SELECT
      r.reward_id,
      r.reward_name,
      r.description,
      r.category,
      r.points_cost,
      r.stock,
      r.availability_status,
      r.partner_id,
      r.created_by_user_id,
      r.image_url,
      p.organization_name AS partner_name,

CASE
  WHEN p.status = 'active'
    AND OCTET_LENGTH(p.profile_picture) > 0
  THEN 1
  ELSE 0
END AS has_partner_logo,

r.created_at
    FROM rewards r
    LEFT JOIN partners p
      ON r.partner_id = p.partner_id
  `;

  let params = [];

  if (userRole === 'admin') {
    // Super Admin sees all rewards.
    sql += `
      ORDER BY r.created_at DESC
    `;
  } else if (
    userRole === 'lgu' ||
    userRole === 'partner'
  ) {
    // LGU and Partner see only their own rewards.
    sql += `
      WHERE r.created_by_user_id = ?
      ORDER BY r.created_at DESC
    `;

    params = [userId];
  } else if (userRole === 'community_member') {
    // Citizens see all available rewards.
    sql += `
      WHERE r.availability_status = 'available'
      ORDER BY r.created_at DESC
    `;
  } else {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized reward access'
    });
  }

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('GET REWARDS ERROR:', err);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch rewards'
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      rewards: results
    });
  });
};


// GET SINGLE REWARD
const getRewardById = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      r.reward_id,
      r.reward_name,
      r.description,
      r.category,
      r.points_cost,
      r.stock,
      r.availability_status,
      r.partner_id,
      r.image_url,
      p.organization_name AS partner_name,
      r.created_at,
      r.updated_at
    FROM rewards r
    LEFT JOIN partners p ON r.partner_id = p.partner_id
    WHERE r.reward_id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch reward',
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    return res.status(200).json({
      success: true,
      reward: results[0]
    });
  });
};

// =====================================================
// CREATE REWARD
// =====================================================

const createReward = async (req, res) => {
 const {
  reward_name,
  description,
  category,
  points_cost,
  stock,
  partner_id
} = req.body;

 if (
    !reward_name ||
    points_cost === undefined ||
    stock === undefined
  ) {
    return res.status(400).json({
      success: false,
      message:
        'reward_name, points_cost, and stock are required'
    });
  }
 


  

  const userRole = req.user.role;
  const userId = req.user.user_id;

  // ===================================================
  // INSERT REWARD
  // ===================================================

const insertReward = async (finalPartnerId) => {
    const finalStatus =
      userRole === 'partner'
        ? 'pending'
        : 'available';

    // ==========================================
    // SAVE REWARD IMAGE AFTER ACCOUNT VALIDATION
    // Localhost: local image storage
    // Render: Cloudinary image storage
    // ==========================================

    let image_url = null;

    if (req.file) {
      try {
        image_url = await saveImage(req.file, {
          folder: "rewards",
          localFolder: "rewards",
          privateImage: false
        });

        await cleanupTemporaryImage(req.file);
      } catch (error) {
        console.error("CREATE REWARD IMAGE ERROR:", error);
        await cleanupTemporaryImage(req.file);

        return res.status(500).json({
          success: false,
          message: "Failed to upload reward image."
        });
      }
    }

   
const sql = `
  INSERT INTO rewards (
    partner_id,
    created_by_user_id,
    reward_name,
    description,
    category,
    points_cost,
    stock,
    image_url,
    availability_status
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;


    db.query(
      sql,
     
[
  finalPartnerId,
  userId,
  reward_name,
  description || null,
  category || null,
  Number(points_cost),
  Number(stock),
  image_url || null,
  finalStatus
],
     async (err, result) => {
  if (err) {
    console.error(
      'CREATE REWARD ERROR:',
      err
    );

    await rollbackUploadedImage(image_url);

          return res.status(500).json({
            success: false,
            message: 'Failed to create reward',
            error: err.message
          });
        }

        // =====================================================
// NOTIFY ADMIN — NEW PARTNER REWARD SUBMISSION
// =====================================================

if (userRole === 'partner') {
  const adminSql = `
    SELECT user_id
    FROM users
    WHERE role = 'admin'
  `;

  db.query(
    adminSql,
    (adminErr, adminRows) => {
      if (adminErr) {
        console.error(
          'ADMIN NOTIFICATION LOOKUP ERROR:',
          adminErr
        );

        // Reward was still successfully created,
        // so do not fail the reward submission.
        return res.status(201).json({
          success: true,
          message:
            'Reward submitted for admin approval, but admin notification could not be created',
          reward_id: result.insertId,
          partner_id: finalPartnerId,
          availability_status: finalStatus
        });
      }

      // Send notification to every Admin account
      for (const admin of adminRows) {
        createNotification(
          admin.user_id,
          'reward',
          'New Reward Submission',
          `A partner submitted "${reward_name}" for approval.`,
          'reward',
          Number(result.insertId)
        );
      }

      return res.status(201).json({
        success: true,
        message:
          'Reward submitted for admin approval',
        reward_id: result.insertId,
        partner_id: finalPartnerId,
        availability_status: finalStatus
      });
    }
  );

  return;
}


// =====================================================
// ADMIN-CREATED REWARD
// =====================================================
// Admin created this reward themselves,
// so no notification is necessary.

return res.status(201).json({
  success: true,
  message: 'Reward created successfully',
  reward_id: result.insertId,
  partner_id: finalPartnerId,
  availability_status: finalStatus
});
      }
    );
  };

  // ===================================================
  // PARTNER
  // ===================================================
  // Resolve the REAL partner_id from the logged-in
  // user's account. Never assume user_id = partner_id.
  // ===================================================

  if (userRole === 'partner') {
    const partnerSql = `
      SELECT
        partner_id,
        organization_name,
        status
      FROM partners
      WHERE user_id = ?
      LIMIT 1
    `;

    db.query(
      partnerSql,
      [userId],
      (partnerErr, partnerRows) => {
        if (partnerErr) {
          console.error(
            'CREATE REWARD PARTNER LOOKUP ERROR:',
            partnerErr
          );

          return res.status(500).json({
            success: false,
            message:
              'Failed to identify partner account',
            error: partnerErr.message
          });
        }

        if (partnerRows.length === 0) {
          return res.status(404).json({
            success: false,
            message:
              'No partner organization is linked to this account'
          });
        }

        const partner = partnerRows[0];

        if (partner.status !== 'active') {
          return res.status(403).json({
            success: false,
            message:
              'Partner organization is not active'
          });
        }

        return insertReward(
          partner.partner_id
        );
      }
    );

    return;
  }

  // ===================================================
  // ADMIN
  // ===================================================

  const adminPartnerId =
    partner_id === '' ||
    partner_id === undefined ||
    partner_id === null ||
    Number(partner_id) === 0 ||
    Number.isNaN(Number(partner_id))
      ? null
      : Number(partner_id);

 return insertReward(null);
};

// GET PENDING REWARDS
const getPendingRewards = (req, res) => {
  const sql = `
    SELECT
      r.reward_id,
      r.reward_name,
      r.description,
      r.category,
      r.points_cost,
      r.stock,
      r.availability_status,
      r.partner_id,
      r.image_url,
      p.organization_name AS partner_name,
      r.created_at
    FROM rewards r
    LEFT JOIN partners p ON r.partner_id = p.partner_id
    WHERE r.availability_status = 'pending'
    ORDER BY r.created_at ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch pending rewards',
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      rewards: results
    });
  });
};

// =====================================================
// APPROVE REWARD + NOTIFY PARTNER
// =====================================================
const approveReward = (req, res) => {
  const { id } = req.params;

  // First get the reward and the partner's USER ID.
  const getRewardSql = `
    SELECT
      r.reward_id,
      r.reward_name,
      r.availability_status,
      r.partner_id,
      p.user_id AS partner_user_id
    FROM rewards r
    LEFT JOIN partners p
      ON r.partner_id = p.partner_id
    WHERE r.reward_id = ?
    LIMIT 1
  `;

  db.query(getRewardSql, [id], (getErr, rows) => {
    if (getErr) {
      console.error(
        'GET REWARD FOR APPROVAL ERROR:',
        getErr
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to check reward',
        error: getErr.message
      });
    }

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    const reward = rows[0];

    if (reward.availability_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Reward has already been reviewed'
      });
    }

    const updateSql = `
      UPDATE rewards
      SET availability_status = 'available'
      WHERE reward_id = ?
        AND availability_status = 'pending'
    `;

    db.query(updateSql, [id], (updateErr, result) => {
      if (updateErr) {
        console.error(
          'APPROVE REWARD ERROR:',
          updateErr
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to approve reward',
          error: updateErr.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(400).json({
          success: false,
          message:
            'Reward was already reviewed'
        });
      }

      // Notify only when this reward belongs
      // to a partner account.
      if (reward.partner_user_id) {
        createNotification(
          reward.partner_user_id,
          'reward',
          'Reward Approved',
          `Your reward "${reward.reward_name}" has been approved and is now available to citizens.`,
          'reward',
          Number(reward.reward_id)
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Reward approved successfully'
      });
    });
  });
};

// =====================================================
// REJECT REWARD + NOTIFY PARTNER
// =====================================================
const rejectReward = (req, res) => {
  const { id } = req.params;

  const getRewardSql = `
    SELECT
      r.reward_id,
      r.reward_name,
      r.availability_status,
      r.partner_id,
      p.user_id AS partner_user_id
    FROM rewards r
    LEFT JOIN partners p
      ON r.partner_id = p.partner_id
    WHERE r.reward_id = ?
    LIMIT 1
  `;

  db.query(getRewardSql, [id], (getErr, rows) => {
    if (getErr) {
      console.error(
        'GET REWARD FOR REJECTION ERROR:',
        getErr
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to check reward',
        error: getErr.message
      });
    }

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    const reward = rows[0];

    if (reward.availability_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Reward has already been reviewed'
      });
    }

    const updateSql = `
      UPDATE rewards
      SET availability_status = 'inactive'
      WHERE reward_id = ?
        AND availability_status = 'pending'
    `;

    db.query(updateSql, [id], (updateErr, result) => {
      if (updateErr) {
        console.error(
          'REJECT REWARD ERROR:',
          updateErr
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to reject reward',
          error: updateErr.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(400).json({
          success: false,
          message:
            'Reward was already reviewed'
        });
      }

      if (reward.partner_user_id) {
        createNotification(
          reward.partner_user_id,
          'reward',
          'Reward Rejected',
          `Your reward "${reward.reward_name}" was not approved by the LGU Administrator.`,
          'reward',
          Number(reward.reward_id)
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Reward rejected successfully'
      });
    });
  });
};

// UPDATE REWARD

// UPDATE REWARD
const updateReward = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;
  const role = req.user.role;

 const {
  reward_name,
  description,
  category,
  points_cost,
  stock,
  availability_status
} = req.body;


  // Keep the existing image when no replacement is uploaded.
  // The replacement image will be processed only after
  // reward ownership and input validation succeed.
  let image_url = undefined;

const checkSql = `
  SELECT
    reward_id,
    created_by_user_id,
    availability_status,
    image_url
  FROM rewards
  WHERE reward_id = ?
  LIMIT 1
`;

  db.query(checkSql, [id], async (checkErr, rows) => {
    if (checkErr) {
      console.error('CHECK REWARD OWNERSHIP ERROR:', checkErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify reward ownership'
      });
    }

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    const reward = rows[0];

    if (
      role !== 'admin' &&
      Number(reward.created_by_user_id) !== Number(userId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit rewards you created.'
      });
    }

    // Pending partner rewards must be reviewed by Super Admin.
    if (role === 'partner' && reward.availability_status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'This reward is awaiting Super Admin approval.'
      });
    }

    if (!reward_name?.trim() ||
        !Number.isFinite(Number(points_cost)) ||
        Number(points_cost) < 0 ||
        !Number.isInteger(Number(stock)) ||
        Number(stock) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide a valid reward name, points cost, and stock.'
      });
    }

    const allowedStatuses = ['available', 'out_of_stock', 'inactive'];
    const finalStatus = allowedStatuses.includes(availability_status)
      ? availability_status
      : reward.availability_status;

    // Partners cannot publish or reactivate rewards through editing.
    const status = role === 'partner'
    
      ? reward.availability_status
      : finalStatus;


    // ==========================================
    // SAVE REPLACEMENT REWARD IMAGE
    // Localhost: local uploads
    // Render: Cloudinary
    // ==========================================

    if (req.file) {
      try {
        image_url = await saveImage(req.file, {
          folder: "rewards",
          localFolder: "rewards",
          privateImage: false
        });
      } catch (error) {
        console.error("UPDATE REWARD IMAGE ERROR:", error);
        await cleanupTemporaryImage(req.file);

        return res.status(500).json({
          success: false,
          message: "Failed to upload replacement reward image."
        });
      }
    }

      

    const sql = `
      UPDATE rewards
      SET reward_name = ?,
          description = ?,
          category = ?,
          points_cost = ?,
          stock = ?,
          image_url = ?,
          availability_status = ?
      WHERE reward_id = ?
        ${role === 'admin' ? '' : 'AND created_by_user_id = ?'}
    `;

    const params = [
  reward_name.trim(),
  description || null,
  category || null,
  Number(points_cost),
  Number(stock),
  image_url !== undefined
    ? image_url
    : reward.image_url,
  status,
  id
];

    if (role !== 'admin') {
      params.push(userId);
    }

    db.query(sql, params, async (err, result) => {
  if (err) {
    console.error('UPDATE REWARD ERROR:', err);

    // Remove the newly uploaded Cloudinary image
    // if the database update fails.
    await rollbackUploadedImage(image_url);

    await cleanupTemporaryImage(req.file);

    return res.status(500).json({
      success: false,
      message: 'Failed to update reward'
    });
  }

    if (!result.affectedRows) {
  await rollbackUploadedImage(image_url);
  await cleanupTemporaryImage(req.file);

  return res.status(403).json({
    success: false,
    message: 'Reward update was not permitted.'
  });
}
        await cleanupTemporaryImage(req.file);
      return res.status(200).json({
        success: true,
        message: 'Reward updated successfully'
      });
    });
  });
};



const deleteReward = (req, res) => {
  const { id } = req.params;
  const role = req.user.role;
  const userId = req.user.user_id;

  const sql = `
    UPDATE rewards
    SET availability_status = 'inactive'
    WHERE reward_id = ?
    ${role === 'admin' ? '' : 'AND created_by_user_id = ?'}
  `;

  const params = role === 'admin'
    ? [id]
    : [id, userId];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error('DEACTIVATE REWARD ERROR:', err);

      return res.status(500).json({
        success: false,
        message: 'Failed to deactivate reward'
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found or access denied'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reward deactivated successfully'
    });
  });
};


// REDEEM REWARD
// Citizen submits a redemption request.
// Points and stock are NOT deducted yet.
// The partner must approve the request first.
const redeemReward = (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;

  // 1. Get the selected reward
  const rewardSql = `
    SELECT
      reward_id,
      reward_name,
      points_cost,
      stock,
      availability_status,
      partner_id
    FROM rewards
    WHERE reward_id = ?
  `;

  db.query(rewardSql, [id], (rewardErr, rewardResults) => {
    if (rewardErr) {
      console.error('REDEEM REWARD ERROR:', rewardErr);

      return res.status(500).json({
        success: false,
        message: 'Failed to check reward',
        error: rewardErr.message
      });
    }

    // Reward does not exist
    if (rewardResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    const reward = rewardResults[0];

    // 2. Check if reward is available
    if (reward.availability_status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Reward is not available'
      });
    }

   

    // 4. Check stock
    if (Number(reward.stock) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Reward is out of stock'
      });
    }

    // 5. Get citizen's current Smart Points
    const userSql = `
      SELECT
        user_id,
        points_balance
      FROM users
      WHERE user_id = ?
    `;

    db.query(userSql, [userId], (userErr, userResults) => {
      if (userErr) {
        console.error('REDEEM USER CHECK ERROR:', userErr);

        return res.status(500).json({
          success: false,
          message: 'Failed to check user balance',
          error: userErr.message
        });
      }

      if (userResults.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userResults[0];

      // 6. Citizen must currently have enough points
      if (Number(user.points_balance) < Number(reward.points_cost)) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient points'
        });
      }

      // 7. Prevent another active request for the same reward
      const existingRequestSql = `
        SELECT redemption_id
        FROM reward_redemptions
        WHERE user_id = ?
          AND reward_id = ?
          AND status IN ('pending', 'approved')
        LIMIT 1
      `;

      db.query(
        existingRequestSql,
        [userId, reward.reward_id],
        (existingErr, existingResults) => {
          if (existingErr) {
            console.error(
              'CHECK EXISTING REDEMPTION ERROR:',
              existingErr
            );

            return res.status(500).json({
              success: false,
              message: 'Failed to check existing redemption request',
              error: existingErr.message
            });
          }

          if (existingResults.length > 0) {
            return res.status(400).json({
              success: false,
              message:
                'You already have an active redemption request for this reward'
            });
          }

          // 8. Create PENDING redemption request only
          const insertRedemptionSql = `
            INSERT INTO reward_redemptions
            (
              user_id,
              reward_id,
              points_spent,
              status
            )
            VALUES (?, ?, ?, 'pending')
          `;

          db.query(
            insertRedemptionSql,
            [
              userId,
              reward.reward_id,
              reward.points_cost
            ],
            (redemptionErr, redemptionResult) => {
              if (redemptionErr) {
                console.error(
                  'CREATE REDEMPTION REQUEST ERROR:',
                  redemptionErr
                );

                return res.status(500).json({
                  success: false,
                  message: 'Failed to create redemption request',
                  error: redemptionErr.message
                });
              }

              // Get the Partner USER ID and Citizen name
// so the correct Partner receives the notification.
const notificationSql = `
  SELECT
    p.user_id AS partner_user_id,
   TRIM(CONCAT_WS(' ',
  NULLIF(u.first_name, ''),
  NULLIF(u.middle_name, ''),
  NULLIF(u.last_name, ''),
  NULLIF(u.suffix, '')
)) AS citizen_name
  FROM partners p
  INNER JOIN users u
    ON u.user_id = ?
  WHERE p.partner_id = ?
  LIMIT 1
`;

db.query(
  notificationSql,
  [userId, reward.partner_id],
  (notificationLookupErr, notificationRows) => {
    if (notificationLookupErr) {
      console.error(
        'REDEMPTION NOTIFICATION LOOKUP ERROR:',
        notificationLookupErr
      );
    } else if (
      notificationRows.length > 0 &&
      notificationRows[0].partner_user_id
    ) {
      const partnerUserId =
        notificationRows[0].partner_user_id;

      const citizenName =
        notificationRows[0].citizen_name ||
        'A citizen';

      createNotification(
        partnerUserId,
        'redemption',
        'New Redemption Request',
        `${citizenName} requested to redeem "${reward.reward_name}" for ${reward.points_cost} Smart Points.`,
        'redemption',
        Number(redemptionResult.insertId)
      );
    }

    return res.status(201).json({
      success: true,
      message: reward.partner_id == null
  ? 'Redemption request submitted. Waiting for LGU approval.'
  : 'Redemption request submitted. Waiting for partner approval.',
      redemption_id: redemptionResult.insertId,
      reward_id: reward.reward_id,
      reward_name: reward.reward_name,
      points_spent: reward.points_cost,
      status: 'pending',
      points_deducted: false
    });
  }
);
            }
          );
        }
      );
    });
  });
};

// GET MY REDEMPTIONS + RANK/MONTHLY BONUS HISTORY
const getMyRedemptions = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT
      rr.redemption_id AS id,
      rr.redemption_id,
      rr.user_id,
      rr.reward_id,
      rr.points_spent,
      rr.status,
      rr.redeemed_at AS activity_date,
      rr.updated_at,

      r.reward_name,
      r.description,
      r.category,
      r.image_url,
      r.availability_status,

    
p.organization_name AS partner_name,
r.partner_id,
rr.claim_location AS claim_location,
rr.claim_instructions AS claim_instructions,


      'redemption' AS record_type

    FROM reward_redemptions rr

    INNER JOIN rewards r
      ON rr.reward_id = r.reward_id

    LEFT JOIN partners p
      ON r.partner_id = p.partner_id

    WHERE rr.user_id = ?

    UNION ALL

    SELECT
      pt.transaction_id AS id,
      NULL AS redemption_id,
      pt.user_id,
      NULL AS reward_id,
      pt.points_delta AS points_spent,
      'approved' AS status,
      pt.created_at AS activity_date,
      pt.created_at AS updated_at,

      pt.notes AS reward_name,

      CASE
        WHEN pt.source_type = 'monthly_bonus'
          THEN 'Monthly benefit added to your redeemable points.'
        ELSE 'Rank-up benefit added to your redeemable points.'
      END AS description,

      CASE
        WHEN pt.source_type = 'monthly_bonus'
          THEN 'Monthly Benefit'
        ELSE 'Rank Benefit'
      END AS category,

      NULL AS image_url,
      'bonus' AS availability_status,

      NULL AS partner_name,
NULL AS partner_id,
NULL AS claim_location,
NULL AS claim_instructions,

      pt.source_type AS record_type

    FROM point_transactions pt

    WHERE pt.user_id = ?
      AND pt.source_type IN (
        'rank_bonus',
        'monthly_bonus'
      )

    ORDER BY activity_date DESC
  `;

  db.query(
    sql,
    [userId, userId],
    (err, results) => {
      if (err) {
        console.error(
          'GET MY REDEMPTIONS ERROR:',
          err
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to fetch redemptions',
          error: err.message
        });
      }

      return res.status(200).json({
        success: true,
        count: results.length,
        redemptions: results
      });
    }
  );
};

// GET MONTHLY BENEFIT STATUS
const getMonthlyBenefitStatus = (req, res) => {
  const userId = req.user.user_id;
  const seasonMonth = getCurrentMonthKey();

  const profileSql = `
    SELECT current_rank
    FROM user_rank_profiles
    WHERE user_id = ?
  `;

  db.query(profileSql, [userId], (profileErr, profileRows) => {
    if (profileErr) {
      console.error('MONTHLY STATUS PROFILE ERROR:', profileErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to check monthly benefit status',
        error: profileErr.message
      });
    }

    if (profileRows.length === 0) {
      return res.status(200).json({
        success: true,
        can_claim: false,
        already_claimed: false,
        rank: 'New',
        points: 0,
        message: 'Earn activity points first.'
      });
    }

    const currentRank = profileRows[0].current_rank || 'New';
    const bonusPoints = BENEFIT_MAP[currentRank] || 0;

    const activeSql = `
      SELECT COUNT(*) AS total
      FROM participation_records
      WHERE user_id = ?
        AND status = 'approved'
        AND DATE_FORMAT(reviewed_at, '%Y-%m') = ?
    `;

    db.query(activeSql, [userId, seasonMonth], (activeErr, activeRows) => {
      if (activeErr) {
        console.error('MONTHLY STATUS ACTIVE ERROR:', activeErr);
        return res.status(500).json({
          success: false,
          message: 'Failed to check monthly activity',
          error: activeErr.message
        });
      }

      const approvedThisMonth = Number(activeRows[0].total || 0);

      const claimSql = `
        SELECT transaction_id
        FROM point_transactions
        WHERE user_id = ?
          AND source_type = 'monthly_bonus'
          AND DATE_FORMAT(created_at, '%Y-%m') = ?
        LIMIT 1
      `;

      db.query(claimSql, [userId, seasonMonth], (claimErr, claimRows) => {
        if (claimErr) {
          console.error('MONTHLY STATUS CLAIM ERROR:', claimErr);
          return res.status(500).json({
            success: false,
            message: 'Failed to check monthly claim',
            error: claimErr.message
          });
        }

        const alreadyClaimed = claimRows.length > 0;
        const canClaim =
          currentRank !== 'New' &&
          bonusPoints > 0 &&
          approvedThisMonth > 0 &&
          !alreadyClaimed;

        let message = '';

        if (alreadyClaimed) {
          message = `${currentRank} monthly benefit already claimed this month.`;
        } else if (currentRank === 'New' || bonusPoints <= 0) {
          message = 'New rank has no monthly benefit.';
        } else if (approvedThisMonth <= 0) {
          message = 'You need at least one approved activity this month to claim monthly benefit.';
        } else {
          message = `${currentRank} monthly benefit is ready to claim.`;
        }

      // Notify Citizen about monthly benefit
return res.status(200).json({
  success: true,
  can_claim: canClaim,
  already_claimed: alreadyClaimed,
  rank: currentRank,
  points: bonusPoints,
  approved_this_month: approvedThisMonth,
  message
});
      });
    });
  });
};

// CLAIM MONTHLY BENEFIT
const claimMonthlyBenefit = (req, res) => {
  const userId = req.user.user_id;
  const seasonMonth = getCurrentMonthKey();

  const profileSql = `
    SELECT current_rank
    FROM user_rank_profiles
    WHERE user_id = ?
  `;

  db.query(profileSql, [userId], (profileErr, profileRows) => {
    if (profileErr) {
      console.error('MONTHLY BENEFIT PROFILE ERROR:', profileErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to check rank profile',
        error: profileErr.message
      });
    }

    if (profileRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rank profile not found. Earn activity points first.'
      });
    }

    const currentRank = profileRows[0].current_rank || 'New';
    const bonusPoints = BENEFIT_MAP[currentRank] || 0;

    if (currentRank === 'New' || bonusPoints <= 0) {
      return res.status(400).json({
        success: false,
        message: 'New rank has no monthly benefit.'
      });
    }

    const activeSql = `
      SELECT COUNT(*) AS total
      FROM participation_records
      WHERE user_id = ?
        AND status = 'approved'
        AND DATE_FORMAT(reviewed_at, '%Y-%m') = ?
    `;

    db.query(activeSql, [userId, seasonMonth], (activeErr, activeRows) => {
      if (activeErr) {
        console.error('MONTHLY BENEFIT ACTIVE ERROR:', activeErr);
        return res.status(500).json({
          success: false,
          message: 'Failed to check monthly activity',
          error: activeErr.message
        });
      }

      const approvedThisMonth = Number(activeRows[0].total || 0);

      if (approvedThisMonth <= 0) {
        return res.status(400).json({
          success: false,
          message: 'You need at least one approved activity this month to claim monthly benefit.'
        });
      }

      const checkClaimSql = `
        SELECT transaction_id
        FROM point_transactions
        WHERE user_id = ?
          AND source_type = 'monthly_bonus'
          AND DATE_FORMAT(created_at, '%Y-%m') = ?
        LIMIT 1
      `;

      db.query(checkClaimSql, [userId, seasonMonth], (claimErr, claimRows) => {
        if (claimErr) {
          console.error('MONTHLY BENEFIT CLAIM CHECK ERROR:', claimErr);
          return res.status(500).json({
            success: false,
            message: 'Failed to check monthly benefit claim',
            error: claimErr.message
          });
        }

        if (claimRows.length > 0) {
          return res.status(400).json({
            success: false,
            message: `${currentRank} monthly benefit already claimed this month.`
          });
        }

        const getBalanceSql = `
          SELECT points_balance
          FROM users
          WHERE user_id = ?
        `;

        db.query(getBalanceSql, [userId], (balanceErr, balanceRows) => {
          if (balanceErr) {
            console.error('MONTHLY BENEFIT BALANCE ERROR:', balanceErr);
            return res.status(500).json({
              success: false,
              message: 'Failed to check current balance',
              error: balanceErr.message
            });
          }

          const currentBalance = Number(balanceRows[0]?.points_balance || 0);
          const newBalance = currentBalance + bonusPoints;

          const updateUserSql = `
            UPDATE users
            SET points_balance = points_balance + ?
            WHERE user_id = ?
          `;

          db.query(updateUserSql, [bonusPoints, userId], (updateErr) => {
            if (updateErr) {
              console.error('MONTHLY BENEFIT USER UPDATE ERROR:', updateErr);
              return res.status(500).json({
                success: false,
                message: 'Failed to add monthly benefit points',
                error: updateErr.message
              });
            }

            const transactionSql = `
              INSERT INTO point_transactions
              (user_id, source_type, source_id, points_delta, balance_after, notes)
              VALUES (?, 'monthly_bonus', NULL, ?, ?, ?)
            `;

            db.query(
              transactionSql,
              [
                userId,
                bonusPoints,
                newBalance,
                `Monthly benefit: ${currentRank} (${seasonMonth})`
              ],
              (txErr) => {
                if (txErr) {
                  console.error('MONTHLY BENEFIT TRANSACTION ERROR:', txErr);
                  return res.status(500).json({
                    success: false,
                    message: 'Benefit added but transaction log failed',
                    error: txErr.message
                  });
                }

               // =====================================================
// NOTIFY CITIZEN — MONTHLY BENEFIT CLAIMED
// =====================================================

createNotification(
  userId,
  'points',
  'Monthly Benefit Claimed',
  `You received ${bonusPoints} Smart Points from your ${currentRank} monthly benefit.`,
  'monthly_bonus',
  null
);

return res.status(200).json({
  success: true,
  message: `${currentRank} monthly benefit claimed successfully.`,
  rank: currentRank,
  points: bonusPoints,
  new_balance: newBalance
});
              }
            );
          });
        });
      });
    });
  });
};
/// GET PARTNER REDEMPTION REQUESTS
const getPartnerRedemptions = (req, res) => {
  const userId = req.user.user_id;

  // Get the real partner_id connected to this logged-in user
  const partnerSql = `
    SELECT partner_id
    FROM partners
    WHERE user_id = ?
    LIMIT 1
  `;

  db.query(partnerSql, [userId], (partnerErr, partnerResults) => {
    if (partnerErr) {
      console.error(
        'GET PARTNER ID ERROR:',
        partnerErr
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to identify partner account',
        error: partnerErr.message
      });
    }

    if (partnerResults.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'No partner organization is linked to this account'
      });
    }

    const partnerId = partnerResults[0].partner_id;

    const sql = `
      SELECT
        rr.redemption_id,
        rr.user_id,
        rr.reward_id,
        rr.points_spent,
        rr.status,
        rr.redeemed_at,
        rr.updated_at,

        r.reward_name,
        r.description,
        r.category,
        r.image_url,
        r.points_cost,

       TRIM(CONCAT_WS(' ',
  NULLIF(u.first_name, ''),
  NULLIF(u.middle_name, ''),
  NULLIF(u.last_name, ''),
  NULLIF(u.suffix, '')
)) AS full_name,
        u.email,

       p.organization_name AS partner_name,
rr.claim_location AS claim_location,
rr.claim_instructions AS claim_instructions

      FROM reward_redemptions rr

      INNER JOIN rewards r
        ON rr.reward_id = r.reward_id

      INNER JOIN users u
        ON rr.user_id = u.user_id

      INNER JOIN partners p
        ON r.partner_id = p.partner_id

      WHERE r.partner_id = ?

      ORDER BY
        CASE
          WHEN rr.status = 'pending' THEN 1
          WHEN rr.status = 'approved' THEN 2
          WHEN rr.status = 'confirmed' THEN 3
          WHEN rr.status = 'rejected' THEN 4
          ELSE 5
        END,
        rr.redeemed_at DESC
    `;

    db.query(sql, [partnerId], (err, results) => {
      if (err) {
        console.error(
          'GET PARTNER REDEMPTIONS ERROR:',
          err
        );

        return res.status(500).json({
          success: false,
          message:
            'Failed to fetch partner redemption requests',
          error: err.message
        });
      }

      const pending = results.filter(
        (item) => item.status === 'pending'
      ).length;

      const readyToClaim = results.filter(
        (item) => item.status === 'approved'
      ).length;

      const completed = results.filter(
        (item) => item.status === 'confirmed'
      ).length;

      const rejected = results.filter(
        (item) => item.status === 'rejected'
      ).length;

      return res.status(200).json({
        success: true,

        summary: {
          total: results.length,
          pending,
          ready_to_claim: readyToClaim,
          completed,
          rejected
        },

        count: results.length,
        redemptions: results
      });
    });
  });
};
// PARTNER APPROVES REDEMPTION
const approveRedemption = (req, res) => {
  const redemptionId = req.params.id;
  const userId = req.user.user_id;
    const claimLocation =
    typeof req.body?.claim_location === 'string'
      ? req.body.claim_location.trim()
      : '';

  const claimInstructions =
    typeof req.body?.claim_instructions === 'string'
      ? req.body.claim_instructions.trim()
      : '';

  if (!claimLocation || !claimInstructions) {
    return res.status(400).json({
      success: false,
      message:
        'Where to Claim and Claim Instructions are required to approve a redemption.'
    });
  }

  // 1. Find the real partner_id connected to this logged-in user
  const partnerSql = `
    SELECT partner_id
    FROM partners
    WHERE user_id = ?
    LIMIT 1
  `;

  db.query(partnerSql, [userId], (partnerErr, partnerResults) => {
    if (partnerErr) {
      console.error('GET PARTNER ID ERROR:', partnerErr);

      return res.status(500).json({
        success: false,
        message: 'Failed to identify partner account',
        error: partnerErr.message
      });
    }

    if (partnerResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No partner organization is linked to this account'
      });
    }

    const partnerId = partnerResults[0].partner_id;

    // 2. Start database transaction
    db.getConnection((connectionErr, connection) => {
      if (connectionErr) {
        console.error(
          'DATABASE CONNECTION ERROR:',
          connectionErr
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to connect to database',
          error: connectionErr.message
        });
      }

      connection.beginTransaction((transactionErr) => {
        if (transactionErr) {
          connection.release();

          return res.status(500).json({
            success: false,
            message: 'Failed to start redemption approval',
            error: transactionErr.message
          });
        }

        const rollback = (
          statusCode,
          message,
          error = null
        ) => {
          connection.rollback(() => {
            connection.release();

            return res.status(statusCode).json({
              success: false,
              message,
              ...(error ? { error } : {})
            });
          });
        };

        // 3. Get redemption and lock it
        const redemptionSql = `
          SELECT
            rr.redemption_id,
            rr.user_id,
            rr.reward_id,
            rr.points_spent,
            rr.status,

            r.reward_name,
            r.points_cost,
            r.stock,
            r.availability_status,
            r.partner_id

          FROM reward_redemptions rr

          INNER JOIN rewards r
            ON rr.reward_id = r.reward_id

          WHERE rr.redemption_id = ?
            AND r.partner_id = ?

          FOR UPDATE
        `;

        connection.query(
          redemptionSql,
          [redemptionId, partnerId],
          (redemptionErr, redemptionResults) => {
            if (redemptionErr) {
              return rollback(
                500,
                'Failed to check redemption request',
                redemptionErr.message
              );
            }

            if (redemptionResults.length === 0) {
              return rollback(
                404,
                'Redemption request not found for this partner'
              );
            }

            const redemption = redemptionResults[0];

            // 4. Only pending requests can be approved
            if (redemption.status !== 'pending') {
              return rollback(
                400,
                'Only pending redemption requests can be approved'
              );
            }

            // 5. Check reward stock/availability
            if (
              redemption.availability_status !== 'available' ||
              Number(redemption.stock) <= 0
            ) {
              return rollback(
                400,
                'Reward is no longer available or is out of stock'
              );
            }

            // 6. Lock citizen points balance
            const userSql = `
              SELECT points_balance
              FROM users
              WHERE user_id = ?
              FOR UPDATE
            `;

            connection.query(
              userSql,
              [redemption.user_id],
              (userErr, userResults) => {
                if (userErr) {
                  return rollback(
                    500,
                    'Failed to check citizen points',
                    userErr.message
                  );
                }

                if (userResults.length === 0) {
                  return rollback(
                    404,
                    'Citizen account not found'
                  );
                }

                const currentBalance = Number(
                  userResults[0].points_balance || 0
                );

                const pointsCost = Number(
                  redemption.points_spent
                );

                // 7. Check points again at approval
                if (currentBalance < pointsCost) {
                  return rollback(
                    400,
                    'Citizen no longer has enough Smart Points'
                  );
                }

                const newBalance =
                  currentBalance - pointsCost;

                const newStock =
                  Number(redemption.stock) - 1;

                const newAvailability =
                  newStock <= 0
                    ? 'out_of_stock'
                    : redemption.availability_status;

                // 8. Deduct points
                const updateUserSql = `
                  UPDATE users
                  SET points_balance = ?
                  WHERE user_id = ?
                `;

                connection.query(
                  updateUserSql,
                  [newBalance, redemption.user_id],
                  (updateUserErr) => {
                    if (updateUserErr) {
                      return rollback(
                        500,
                        'Failed to deduct Smart Points',
                        updateUserErr.message
                      );
                    }

                    // 9. Reduce stock
                    const updateRewardSql = `
                      UPDATE rewards
                      SET
                        stock = ?,
                        availability_status = ?
                      WHERE reward_id = ?
                    `;

                    connection.query(
                      updateRewardSql,
                      [
                        newStock,
                        newAvailability,
                        redemption.reward_id
                      ],
                      (updateRewardErr) => {
                        if (updateRewardErr) {
                          return rollback(
                            500,
                            'Failed to update reward stock',
                            updateRewardErr.message
                          );
                        }

                        // 10. pending -> approved
                      // 10. pending -> approved
// Save claim details for this specific redemption.
const updateRedemptionSql = `
  UPDATE reward_redemptions
  SET
    status = 'approved',
    claim_location = ?,
    claim_instructions = ?,
    updated_at = NOW()
  WHERE redemption_id = ?
    AND status = 'pending'
`;

                       connection.query(
  updateRedemptionSql,
  [
    claimLocation,
    claimInstructions,
    redemptionId
  ],
                          (
                            updateRedemptionErr,
                            updateRedemptionResult
                          ) => {
                            if (updateRedemptionErr) {
                              return rollback(
                                500,
                                'Failed to approve redemption',
                                updateRedemptionErr.message
                              );
                            }

                            if (
                              updateRedemptionResult.affectedRows === 0
                            ) {
                              return rollback(
                                400,
                                'Redemption request was already reviewed'
                              );
                            }

                            // 11. Record points transaction
                            const transactionSql = `
                              INSERT INTO point_transactions
                              (
                                user_id,
                                source_type,
                                source_id,
                                points_delta,
                                balance_after,
                                notes
                              )
                              VALUES (
                                ?,
                                'redemption',
                                ?,
                                ?,
                                ?,
                                ?
                              )
                            `;

                            connection.query(
                              transactionSql,
                              [
                                redemption.user_id,
                                redemption.redemption_id,
                                -pointsCost,
                                newBalance,
                                `Partner approved redemption: ${redemption.reward_name}`
                              ],
                              (transactionLogErr) => {
                                if (transactionLogErr) {
                                  return rollback(
                                    500,
                                    'Failed to record Smart Points transaction',
                                    transactionLogErr.message
                                  );
                                }

                                // 12. Commit everything
                                connection.commit(
                                  (commitErr) => {
                                    if (commitErr) {
                                      return rollback(
                                        500,
                                        'Failed to complete redemption approval',
                                        commitErr.message
                                      );
                                    }

connection.release();

// =====================================================
// NOTIFY CITIZEN — REDEMPTION APPROVED
// =====================================================

createNotification(
  redemption.user_id,
  'redemption',
  'Redemption Approved',
  `Your redemption request for "${redemption.reward_name}" was approved. Your reward is now ready to claim.`,
  'redemption',
  Number(redemptionId)
);


// =====================================================
// NOTIFY PARTNER — LOW REWARD STOCK
// =====================================================

// Notify the Partner when remaining stock is 5 or less.
// Do not send this when stock reaches 0 because a
// separate Out of Stock notification is more useful.
if (newStock > 0 && newStock <= 5) {
  createNotification(
    userId,
    'reward',
    'Low Reward Stock',
    `"${redemption.reward_name}" is running low. Only ${newStock} item${newStock === 1 ? '' : 's'} remaining.`,
    'reward',
    Number(redemption.reward_id)
  );
}


// =====================================================
// NOTIFY PARTNER — OUT OF STOCK
// =====================================================

if (newStock === 0) {
  createNotification(
    userId,
    'reward',
    'Reward Out of Stock',
    `"${redemption.reward_name}" is now out of stock. Update the reward stock if more items become available.`,
    'reward',
    Number(redemption.reward_id)
  );
}


// =====================================================
// RESPONSE
// =====================================================

return res.status(200).json({
  success: true,

  message:
    'Redemption approved. Reward is ready to claim.',

  redemption_id:
    Number(redemptionId),

  status:
    'approved',

  display_status:
    'Ready to Claim',

  points_deducted:
    pointsCost,

  new_balance:
    newBalance,

  remaining_stock:
    newStock
});
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      });
    });
  });
};
// =====================================================
// PARTNER REJECTS REDEMPTION
// =====================================================

const rejectRedemption = (req, res) => {
  const redemptionId = req.params.id;
  const userId = req.user.user_id;

  // 1. Get the real partner_id connected to this user
  const partnerSql = `
    SELECT partner_id
    FROM partners
    WHERE user_id = ?
    LIMIT 1
  `;

  db.query(partnerSql, [userId], (partnerErr, partnerResults) => {
    if (partnerErr) {
      console.error('GET PARTNER ID ERROR:', partnerErr);

      return res.status(500).json({
        success: false,
        message: 'Failed to identify partner account',
        error: partnerErr.message
      });
    }

    if (partnerResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No partner organization is linked to this account'
      });
    }

    const partnerId = partnerResults[0].partner_id;

    // 2. Check that this redemption belongs to this partner
    const checkSql = `
      SELECT
        rr.redemption_id,
        rr.status,
        rr.user_id,
        rr.reward_id,
        r.reward_name,
        r.partner_id

      FROM reward_redemptions rr

      INNER JOIN rewards r
        ON rr.reward_id = r.reward_id

      WHERE rr.redemption_id = ?
        AND r.partner_id = ?

      LIMIT 1
    `;

    db.query(
      checkSql,
      [redemptionId, partnerId],
      (checkErr, results) => {
        if (checkErr) {
          console.error(
            'CHECK REDEMPTION ERROR:',
            checkErr
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to check redemption request',
            error: checkErr.message
          });
        }

        if (results.length === 0) {
          return res.status(404).json({
            success: false,
            message:
              'Redemption request not found for this partner'
          });
        }

        const redemption = results[0];

        // Only pending requests can be rejected
        if (redemption.status !== 'pending') {
          return res.status(400).json({
            success: false,
            message:
              'Only pending redemption requests can be rejected'
          });
        }

        // 3. pending -> rejected
        //
        // IMPORTANT:
        // No points are returned because points have NOT
        // been deducted yet while the request is pending.
        //
        // Stock is also unchanged because stock has NOT
        // been reduced yet.

        const updateSql = `
          UPDATE reward_redemptions
          SET
            status = 'rejected',
            updated_at = NOW()
          WHERE redemption_id = ?
            AND status = 'pending'
        `;

        db.query(
          updateSql,
          [redemptionId],
          (updateErr, updateResult) => {
            if (updateErr) {
              console.error(
                'REJECT REDEMPTION ERROR:',
                updateErr
              );

              return res.status(500).json({
                success: false,
                message:
                  'Failed to reject redemption request',
                error: updateErr.message
              });
            }

            if (updateResult.affectedRows === 0) {
              return res.status(400).json({
                success: false,
                message:
                  'Redemption request was already reviewed'
              });
            }

           // Notify Citizen about rejected redemption
createNotification(
  redemption.user_id,
  'redemption',
  'Redemption Rejected',
  `Your redemption request for "${redemption.reward_name}" was rejected.`,
  'redemption',
  Number(redemptionId)
);

return res.status(200).json({
  success: true,
  message: 'Redemption request rejected.',
  redemption_id: Number(redemptionId),
  status: 'rejected',
  display_status: 'Rejected'
});
          }
        );
      }
    );
  });
};
// =====================================================
// PARTNER CONFIRMS THAT THE REWARD WAS CLAIMED
// approved -> confirmed
// =====================================================

const confirmRedemptionClaim = (req, res) => {
  const redemptionId = req.params.id;
  const userId = req.user.user_id;

  // 1. Find the REAL partner_id connected to this user account
  const partnerSql = `
    SELECT partner_id
    FROM partners
    WHERE user_id = ?
    LIMIT 1
  `;

  db.query(
    partnerSql,
    [userId],
    (partnerErr, partnerResults) => {

      if (partnerErr) {
        console.error(
          'GET PARTNER ID ERROR:',
          partnerErr
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to identify partner account',
          error: partnerErr.message
        });
      }

      if (partnerResults.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            'No partner organization is linked to this account'
        });
      }

      const partnerId =
        partnerResults[0].partner_id;

      // 2. Make sure this redemption belongs
      //    to this partner and is approved
      const checkSql = `
        SELECT
          rr.redemption_id,
          rr.user_id,
          rr.reward_id,
          rr.status,
          rr.points_spent,

          r.reward_name,
          r.partner_id

        FROM reward_redemptions rr

        INNER JOIN rewards r
          ON rr.reward_id = r.reward_id

        WHERE rr.redemption_id = ?
          AND r.partner_id = ?

        LIMIT 1
      `;

      db.query(
        checkSql,
        [redemptionId, partnerId],
        (checkErr, results) => {

          if (checkErr) {
            console.error(
              'CHECK CLAIM ERROR:',
              checkErr
            );

            return res.status(500).json({
              success: false,
              message:
                'Failed to check redemption claim',
              error: checkErr.message
            });
          }

          if (results.length === 0) {
            return res.status(404).json({
              success: false,
              message:
                'Redemption does not belong to this partner'
            });
          }

          const redemption = results[0];

          // Already completed
          if (redemption.status === 'confirmed') {
            return res.status(400).json({
              success: false,
              message:
                'This reward has already been claimed'
            });
          }

          // Must be approved first
          if (redemption.status !== 'approved') {
            return res.status(400).json({
              success: false,
              message:
                'Only Ready to Claim redemptions can be confirmed'
            });
          }

          // 3. approved -> confirmed
          const updateSql = `
            UPDATE reward_redemptions

            SET
              status = 'confirmed',
              updated_at = NOW()

            WHERE redemption_id = ?
              AND status = 'approved'
          `;

          db.query(
            updateSql,
            [redemptionId],
            (updateErr, updateResult) => {

              if (updateErr) {
                console.error(
                  'CONFIRM CLAIM UPDATE ERROR:',
                  updateErr
                );

                return res.status(500).json({
                  success: false,
                  message:
                    'Failed to confirm reward claim',
                  error: updateErr.message
                });
              }

              if (
                updateResult.affectedRows === 0
              ) {
                return res.status(400).json({
                  success: false,
                  message:
                    'Redemption status changed before confirmation'
                });
              }

             // 4. Notify Citizen that the reward was claimed
createNotification(
  redemption.user_id,
  'redemption',
  'Reward Claimed',
  `Your reward "${redemption.reward_name}" has been successfully claimed.`,
  'redemption',
  Number(redemptionId)
);

return res.status(200).json({
  success: true,

  message:
    'Reward claim confirmed successfully.',

  redemption_id:
    Number(redemptionId),

  status: 'confirmed',

  display_status:
    'Completed'
});
            }
          );
        }
      );
    }
  );
};

// =====================================================
// GET PARTNER DASHBOARD
// =====================================================

const getPartnerDashboard = (req, res) => {
  const userId = req.user.user_id;

  // Dropdown filters
  const rewardPeriod =
    req.query.reward_period || 'this_month';

  const activityPeriod =
    req.query.activity_period || 'this_year';

  const allowedRewardPeriods = [
    'this_month',
    'this_year',
    'all'
  ];

  const allowedActivityPeriods = [
    'this_year',
    'last_year',
    'all'
  ];

  const finalRewardPeriod =
    allowedRewardPeriods.includes(rewardPeriod)
      ? rewardPeriod
      : 'this_month';

  const finalActivityPeriod =
    allowedActivityPeriods.includes(activityPeriod)
      ? activityPeriod
      : 'this_year';

  // ---------------------------------------------------
  // 1. FIND REAL PARTNER ID
  // ---------------------------------------------------

  const partnerSql = `
    SELECT
      partner_id,
      organization_name
    FROM partners
    WHERE user_id = ?
    LIMIT 1
  `;

  db.query(
    partnerSql,
    [userId],
    (partnerErr, partnerRows) => {

      if (partnerErr) {
        console.error(
          'PARTNER DASHBOARD PARTNER ERROR:',
          partnerErr
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to identify partner account',
          error: partnerErr.message
        });
      }

      if (partnerRows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            'No partner organization is linked to this account'
        });
      }

      const partnerId =
        partnerRows[0].partner_id;

      const organizationName =
        partnerRows[0].organization_name ||
        'Partner';

      // ---------------------------------------------------
      // 2. MAIN DASHBOARD SUMMARY
      // ---------------------------------------------------

      const summarySql = `
        SELECT

          (
            SELECT COUNT(*)
            FROM rewards
            WHERE partner_id = ?
              AND availability_status = 'available'
          ) AS active_rewards,

          (
            SELECT COUNT(*)
            FROM reward_redemptions rr
            INNER JOIN rewards r
              ON rr.reward_id = r.reward_id
            WHERE r.partner_id = ?
          ) AS total_redemptions,

          (
            SELECT COUNT(*)
            FROM activities
            WHERE partner_id = ?
          ) AS partner_activities,

          (
            SELECT COUNT(DISTINCT pr.user_id)
            FROM participation_records pr
            INNER JOIN activities a
              ON pr.activity_id = a.activity_id
            WHERE a.partner_id = ?
          ) AS engaged_citizens,

          (
            SELECT COUNT(*)
            FROM participation_records pr
            INNER JOIN activities a
              ON pr.activity_id = a.activity_id
            WHERE a.partner_id = ?
              AND YEAR(pr.submitted_at) =
                  YEAR(CURDATE())
          ) AS participants_this_year,

          (
            SELECT COUNT(*)
            FROM participation_records pr
            INNER JOIN activities a
              ON pr.activity_id = a.activity_id
            WHERE a.partner_id = ?
              AND YEAR(pr.submitted_at) =
                  YEAR(CURDATE()) - 1
          ) AS participants_last_year
      `;

      const summaryParams = [
        partnerId,
        partnerId,
        partnerId,
        partnerId,
        partnerId,
        partnerId
      ];

      db.query(
        summarySql,
        summaryParams,
        (summaryErr, summaryRows) => {

          if (summaryErr) {
            console.error(
              'PARTNER DASHBOARD SUMMARY ERROR:',
              summaryErr
            );

            return res.status(500).json({
              success: false,
              message:
                'Failed to load dashboard summary',
              error: summaryErr.message
            });
          }

          const summary =
            summaryRows[0] || {};

          const thisYear = Number(
            summary.participants_this_year || 0
          );

          const lastYear = Number(
            summary.participants_last_year || 0
          );

          let participationGrowth = 0;

          if (lastYear > 0) {
            participationGrowth =
              ((thisYear - lastYear) /
                lastYear) *
              100;
          } else if (thisYear > 0) {
            participationGrowth = 100;
          }

          participationGrowth =
            Number(
              participationGrowth.toFixed(1)
            );

          // ---------------------------------------------------
          // 3. ACTIVITY SUMMARY FILTER
          // ---------------------------------------------------

          let activityDateCondition = '';

          if (
            finalActivityPeriod ===
            'this_year'
          ) {
            activityDateCondition = `
              AND YEAR(a.date_start) =
                  YEAR(CURDATE())
            `;
          } else if (
            finalActivityPeriod ===
            'last_year'
          ) {
            activityDateCondition = `
              AND YEAR(a.date_start) =
                  YEAR(CURDATE()) - 1
            `;
          }

          const activitySummarySql = `
            SELECT

              COUNT(DISTINCT a.activity_id)
                AS total_activities,

              COUNT(pr.participation_id)
                AS total_participants

            FROM activities a

            LEFT JOIN participation_records pr
              ON a.activity_id =
                 pr.activity_id

            WHERE a.partner_id = ?
              ${activityDateCondition}
          `;

          db.query(
            activitySummarySql,
            [partnerId],
            (
              activitySummaryErr,
              activitySummaryRows
            ) => {

              if (activitySummaryErr) {
                console.error(
                  'PARTNER ACTIVITY SUMMARY ERROR:',
                  activitySummaryErr
                );

                return res.status(500).json({
                  success: false,
                  message:
                    'Failed to load partner activity summary',
                  error:
                    activitySummaryErr.message
                });
              }

              const activitySummary =
                activitySummaryRows[0] || {};

              // ---------------------------------------------------
              // 4. PARTNER REWARDS
              // ---------------------------------------------------

              const rewardsSql = `
                SELECT
                  reward_id,
                  reward_name,
                  description,
                  category,
                  points_cost,
                  stock,
                  availability_status,
                  image_url,
                  created_at

                FROM rewards

                WHERE partner_id = ?

                ORDER BY created_at DESC
              `;

              db.query(
                rewardsSql,
                [partnerId],
                (
                  rewardsErr,
                  rewardRows
                ) => {

                  if (rewardsErr) {
                    console.error(
                      'PARTNER DASHBOARD REWARDS ERROR:',
                      rewardsErr
                    );

                    return res
                      .status(500)
                      .json({
                        success: false,
                        message:
                          'Failed to load partner rewards',
                        error:
                          rewardsErr.message
                      });
                  }

                  // ---------------------------------------------------
                  // 5. RECENT REDEMPTIONS
                  // ---------------------------------------------------

                  const recentSql = `
                    SELECT
                      rr.redemption_id,
                      rr.points_spent,
                      rr.status,
                      rr.redeemed_at,
                      rr.updated_at,

                      r.reward_id,
                      r.reward_name,

                      u.user_id,
                    TRIM(CONCAT_WS(' ',
  NULLIF(u.first_name, ''),
  NULLIF(u.middle_name, ''),
  NULLIF(u.last_name, ''),
  NULLIF(u.suffix, '')
)) AS full_name

                    FROM reward_redemptions rr

                    INNER JOIN rewards r
                      ON rr.reward_id =
                         r.reward_id

                    INNER JOIN users u
                      ON rr.user_id =
                         u.user_id

                    WHERE r.partner_id = ?

                    ORDER BY
                      rr.redeemed_at DESC

                    LIMIT 5
                  `;

                  db.query(
                    recentSql,
                    [partnerId],
                    (
                      recentErr,
                      recentRows
                    ) => {

                      if (recentErr) {
                        console.error(
                          'PARTNER DASHBOARD RECENT ERROR:',
                          recentErr
                        );

                        return res
                          .status(500)
                          .json({
                            success: false,
                            message:
                              'Failed to load recent redemptions',
                            error:
                              recentErr.message
                          });
                      }

                      // ---------------------------------------------------
                      // 6. REWARD PERFORMANCE FILTER
                      // ---------------------------------------------------

                      let rewardDateCondition =
                        '';

                      if (
                        finalRewardPeriod ===
                        'this_month'
                      ) {
                        rewardDateCondition = `
                          AND YEAR(rr.redeemed_at) =
                              YEAR(CURDATE())

                          AND MONTH(rr.redeemed_at) =
                              MONTH(CURDATE())
                        `;
                      } else if (
                        finalRewardPeriod ===
                        'this_year'
                      ) {
                        rewardDateCondition = `
                          AND YEAR(rr.redeemed_at) =
                              YEAR(CURDATE())
                        `;
                      }

                      const performanceSql = `
                        SELECT
                          r.reward_id,
                          r.reward_name,

                          COUNT(
                            rr.redemption_id
                          ) AS redemption_count

                        FROM rewards r

                        LEFT JOIN reward_redemptions rr
                          ON r.reward_id =
                             rr.reward_id

                          ${rewardDateCondition}

                        WHERE r.partner_id = ?

                        GROUP BY
                          r.reward_id,
                          r.reward_name

                        ORDER BY
                          redemption_count DESC,
                          r.reward_id DESC

                        LIMIT 5
                      `;

                      db.query(
                        performanceSql,
                        [partnerId],
                        (
                          performanceErr,
                          performanceRows
                        ) => {

                          if (
                            performanceErr
                          ) {
                            console.error(
                              'PARTNER DASHBOARD PERFORMANCE ERROR:',
                              performanceErr
                            );

                            return res
                              .status(500)
                              .json({
                                success:
                                  false,
                                message:
                                  'Failed to load reward performance',
                                error:
                                  performanceErr.message
                              });
                          }

                          // ---------------------------------------------------
                          // 7. RETURN DASHBOARD DATA
                          // ---------------------------------------------------

                          return res
                            .status(200)
                            .json({
                              success: true,

                              filters: {
                                reward_period:
                                  finalRewardPeriod,

                                activity_period:
                                  finalActivityPeriod
                              },

                              partner: {
                                partner_id:
                                  partnerId,

                                organization_name:
                                  organizationName
                              },

                              stats: {
                                active_rewards:
                                  Number(
                                    summary.active_rewards ||
                                      0
                                  ),

                                total_redemptions:
                                  Number(
                                    summary.total_redemptions ||
                                      0
                                  ),

                                partner_activities:
                                  Number(
                                    summary.partner_activities ||
                                      0
                                  ),

                                engaged_citizens:
                                  Number(
                                    summary.engaged_citizens ||
                                      0
                                  ),

                                participants_this_year:
                                  thisYear,

                                participants_last_year:
                                  lastYear,

                                participation_growth:
                                  participationGrowth
                              },

                              activity_summary: {
                                period:
                                  finalActivityPeriod,

                                total_activities:
                                  Number(
                                    activitySummary.total_activities ||
                                      0
                                  ),

                                total_participants:
                                  Number(
                                    activitySummary.total_participants ||
                                      0
                                  )
                              },

                              rewards:
                                rewardRows,

                              recent_redemptions:
                                recentRows,

                              reward_performance:
                                performanceRows.map(
                                  (item) => ({
                                    reward_id:
                                      item.reward_id,

                                    reward_name:
                                      item.reward_name,

                                    redemption_count:
                                      Number(
                                        item.redemption_count ||
                                          0
                                      )
                                  })
                                )
                            });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
};
module.exports = {
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
};