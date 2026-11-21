
const db = require("../config/db");

const {
  createNotification,
} = require("./notificationController");

// =====================================================
// DATABASE HELPERS
// =====================================================



const query = (connection, sql, params = []) => {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};


const getConnection = () => {
  return new Promise((resolve, reject) => {
    db.getConnection((error, connection) => {
      if (error) {
        reject(error);
      } else {
        resolve(connection);
      }
    });
  });
};

const beginTransaction = (connection) => {
  return new Promise((resolve, reject) => {
    connection.beginTransaction((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const commit = (connection) => {
  return new Promise((resolve, reject) => {
    connection.commit((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const rollback = (connection) => {
  return new Promise((resolve) => {
    connection.rollback(() => resolve());
  });
};

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const sendError = (res, error) => {
  console.error("ADMIN REDEMPTION ERROR:", error);

 


  return res.status(error.status || 500).json({
    success: false,
    message: error.status
      ? error.message
      : "Unable to process the redemption request.",
  });
};

// =====================================================
// CITIZEN NOTIFICATION
// =====================================================

const notifyCitizen = (
  userId,
  title,
  message,
  redemptionId
) => {
  try {
    createNotification(
      userId,
      "redemption",
      title,
      message,
      "redemption",
      Number(redemptionId)
    );
  } catch (error) {
    console.error(
      "REDEMPTION NOTIFICATION ERROR:",
      error
    );
  }
};

// =====================================================
// GET ALL REDEMPTIONS FOR ADMIN
// =====================================================

const getAdminRedemptions = (req, res) => {
  const isLgu = req.user?.role === "lgu";
  const ownerId = Number(req.user?.user_id);

  const sql = `
    SELECT
      rr.redemption_id,
      rr.user_id,
      rr.reward_id,
      rr.points_spent,
      rr.status,
      rr.redeemed_at,
      rr.updated_at,
      rr.claim_location,
      rr.claim_instructions,

    TRIM(CONCAT_WS(' ',
  NULLIF(u.first_name, ''),
  NULLIF(u.middle_name, ''),
  NULLIF(u.last_name, ''),
  NULLIF(u.suffix, '')
)) AS full_name,
      u.email,

      r.reward_name,
      r.description,
      r.category,
      r.partner_id,

      p.organization_name AS partner_name

    FROM reward_redemptions rr

    INNER JOIN users u
      ON rr.user_id = u.user_id

    INNER JOIN rewards r
      ON rr.reward_id = r.reward_id

LEFT JOIN partners p
  ON r.partner_id = p.partner_id


WHERE r.partner_id IS NULL
${isLgu ? "AND r.created_by_user_id = ?" : ""}

ORDER BY

  rr.redeemed_at DESC,
  rr.redemption_id DESC

  `;

  db.query(sql, isLgu ? [ownerId] : [], (error, results) => {
    if (error) {
      return sendError(res, error);
    }

    const redemptions = results.map((item) => ({
      ...item,
      partner_name:
        item.partner_name ||
        (item.partner_id === null
          ? "LGU Managed"
          : "Partner"),
    }));

    return res.status(200).json({
      success: true,
      count: redemptions.length,

      summary: {
        total: redemptions.length,

        pending: redemptions.filter(
          (item) => item.status === "pending"
        ).length,

        approved: redemptions.filter(
          (item) => item.status === "approved"
        ).length,

        confirmed: redemptions.filter(
          (item) => item.status === "confirmed"
        ).length,
      },

      redemptions,
    });
  });
};

// =====================================================
// PROCESS LGU REDEMPTION
// =====================================================

const processLguRedemption = async (
  req,
  res,
  action
) => {
  const redemptionId = Number(req.params.id);

  if (
    !Number.isSafeInteger(redemptionId) ||
    redemptionId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid redemption ID.",
    });
  }

  // ===================================================
  // CLAIM INFORMATION
  // ===================================================

  const claimLocation =
    typeof req.body?.claim_location === "string"
      ? req.body.claim_location.trim()
      : "";

  const claimInstructions =
    typeof req.body?.claim_instructions === "string"
      ? req.body.claim_instructions.trim()
      : "";

  // Claim information is mandatory during approval.
  if (action === "approve") {
    if (!claimLocation) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter the location where the citizen can claim the reward.",
      });
    }

    if (!claimInstructions) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter the instructions for claiming the reward.",
      });
    }

    if (claimLocation.length > 255) {
      return res.status(400).json({
        success: false,
        message:
          "Claim location must not exceed 255 characters.",
      });
    }

    if (claimInstructions.length > 3000) {
      return res.status(400).json({
        success: false,
        message:
          "Claim instructions must not exceed 3000 characters.",
      });
    }
  }

  let connection = null;
  let transactionStarted = false;
  let committed = false;

  let notification = null;
  let resultData = null;

  try {
    connection = await getConnection();

    await beginTransaction(connection);
    transactionStarted = true;

    // =================================================
    // LOCK REDEMPTION
    // =================================================

   
const rows = await query(
  connection,
  `
    SELECT
      redemption_id,
      user_id,
      reward_id,
      points_spent,
      status
    FROM reward_redemptions
    WHERE redemption_id = ?
    FOR UPDATE
  `,
  [redemptionId]
);

    if (rows.length === 0) {
      throw httpError(
        404,
        "Redemption request not found."
      );
    }

    const redemption = rows[0];

    // =================================================
    // LOCK REWARD
    // =================================================

   


const rewards = await query(
  connection,
  `
  SELECT
    reward_id,
    reward_name,
    partner_id,
    created_by_user_id,
    stock,
    availability_status
  FROM rewards
  WHERE reward_id = ?
  FOR UPDATE
  `,
  [redemption.reward_id]
);




    if (rewards.length === 0) {
      throw httpError(
        404,
        "Reward not found."
      );
    }

    const reward = rewards[0];

    // Only LGU-managed rewards can be processed here.
    if (reward.partner_id !== null) {
      throw httpError(
        403,
        "This reward is managed by a Establishment . Only the partner can process this redemption."
      );
    }


// An Lgu Administrator can process only rewards
// created by their own account.
if (req.user?.role === "lgu") {
  const currentLguId = Number(req.user.user_id);
  const rewardOwnerId = Number(reward.created_by_user_id);

  if (
    reward.created_by_user_id == null ||
    rewardOwnerId !== currentLguId
  ) {
    throw httpError(
      403,
      "You can only process redemptions for rewards created by your LGU account."
    );
  }
}


    // =================================================
    // APPROVE REDEMPTION
    // =================================================

    if (action === "approve") {
      if (redemption.status !== "pending") {
        throw httpError(
          400,
          "Only pending redemptions can be approved."
        );
      }

      if (
        reward.availability_status !== "available" ||
        Number(reward.stock) <= 0
      ) {
        throw httpError(
          400,
          "This reward is unavailable or out of stock."
        );
      }

      // Lock citizen points balance.
      const users = await query(
        connection,
        `
        SELECT points_balance
        FROM users
        WHERE user_id = ?
        FOR UPDATE
        `,
        [redemption.user_id]
      );

      if (users.length === 0) {
        throw httpError(
          404,
          "Citizen account not found."
        );
      }

      const pointsCost = Number(
        redemption.points_spent
      );

      const currentBalance = Number(
        users[0].points_balance
      );

      if (
        !Number.isFinite(pointsCost) ||
        pointsCost < 0 ||
        !Number.isFinite(currentBalance)
      ) {
        throw httpError(
          400,
          "Invalid redemption points information."
        );
      }

      if (currentBalance < pointsCost) {
        throw httpError(
          400,
          "The citizen does not have enough Smart Points."
        );
      }

      const newBalance =
        currentBalance - pointsCost;

      const newStock =
        Number(reward.stock) - 1;

      const newAvailability =
        newStock <= 0
          ? "out_of_stock"
          : reward.availability_status;

      // Deduct Smart Points.
      await query(
        connection,
        `
        UPDATE users
        SET points_balance = ?
        WHERE user_id = ?
        `,
        [
          newBalance,
          redemption.user_id,
        ]
      );

      // Deduct reward stock.
      await query(
        connection,
        `
        UPDATE rewards
        SET
          stock = ?,
          availability_status = ?
        WHERE reward_id = ?
        `,
        [
          newStock,
          newAvailability,
          redemption.reward_id,
        ]
      );

      // Save approval and claim information.
      const updated = await query(
        connection,
        `
        UPDATE reward_redemptions
        SET
          status = 'approved',
          claim_location = ?,
          claim_instructions = ?,
          updated_at = NOW()
        WHERE redemption_id = ?
          AND status = 'pending'
        `,
        [
          claimLocation,
          claimInstructions,
          redemptionId,
        ]
      );

      if (updated.affectedRows !== 1) {
        throw httpError(
          409,
          "Redemption status changed. Please refresh the page."
        );
      }

      // Record Smart Points transaction.
      await query(
        connection,
        `
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
        `,
        [
          redemption.user_id,
          redemptionId,
          -pointsCost,
          newBalance,
          `LGU approved redemption: ${reward.reward_name}`,
        ]
      );

      notification = {
        title: "Redemption Approved",
        message:
          `Your redemption for "${reward.reward_name}" ` +
          "was approved by the LGU. " +
          `Claim location: ${claimLocation}. ` +
          "Open My Redemptions to view the claim instructions.",
      };

      resultData = {
        status: "approved",
        points_deducted: pointsCost,
        new_balance: newBalance,
        remaining_stock: newStock,
        claim_location: claimLocation,
        claim_instructions: claimInstructions,
      };
    }

    // =================================================
    // REJECT REDEMPTION
    // =================================================

    else if (action === "reject") {
      if (redemption.status !== "pending") {
        throw httpError(
          400,
          "Only pending redemptions can be rejected."
        );
      }

      const updated = await query(
        connection,
        `
        UPDATE reward_redemptions
        SET
          status = 'rejected',
          updated_at = NOW()
        WHERE redemption_id = ?
          AND status = 'pending'
        `,
        [redemptionId]
      );

      if (updated.affectedRows !== 1) {
        throw httpError(
          409,
          "Redemption status changed. Please refresh the page."
        );
      }

      notification = {
        title: "Redemption Rejected",
        message:
          `Your redemption request for "${reward.reward_name}" ` +
          "was rejected by the LGU Administrator.",
      };

      resultData = {
        status: "rejected",
        points_deducted: 0,
      };
    }

    // =================================================
    // CONFIRM REWARD CLAIM
    // =================================================

    else if (action === "confirm") {
      if (redemption.status !== "approved") {
        throw httpError(
          400,
          "Only approved redemptions can be confirmed."
        );
      }

      const updated = await query(
        connection,
        `
        UPDATE reward_redemptions
        SET
          status = 'confirmed',
          updated_at = NOW()
        WHERE redemption_id = ?
          AND status = 'approved'
        `,
        [redemptionId]
      );

      if (updated.affectedRows !== 1) {
        throw httpError(
          409,
          "Redemption status changed. Please refresh the page."
        );
      }

      // Points and stock were deducted during approval.
      // Do not deduct them again.
      notification = {
        title: "Reward Claim Confirmed",
        message:
          `Your claim for "${reward.reward_name}" ` +
          "has been confirmed by the LGU Administrator.",
      };

      resultData = {
        status: "confirmed",
        points_deducted: 0,
      };
    }

    else {
      throw httpError(
        400,
        "Invalid redemption action."
      );
    }

    // =================================================
    // COMMIT TRANSACTION
    // =================================================

    await commit(connection);
    committed = true;

    // Notify citizen only after successful commit.
    if (notification) {
      notifyCitizen(
        redemption.user_id,
        notification.title,
        notification.message,
        redemptionId
      );
    }

    return res.status(200).json({
      success: true,

      message:
        action === "approve"
          ? "LGU redemption approved successfully."
          : action === "reject"
          ? "LGU redemption rejected successfully."
          : "LGU reward claim confirmed successfully.",

      redemption_id: redemptionId,
      ...resultData,
    });
  } catch (error) {
    if (
      connection &&
      transactionStarted &&
      !committed
    ) {
      try {
        await rollback(connection);
      } catch (rollbackError) {
        console.error(
          "REDEMPTION ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    return sendError(res, error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// =====================================================
// EXPORTED CONTROLLERS
// =====================================================

const approveAdminRedemption = (req, res) => {
  return processLguRedemption(
    req,
    res,
    "approve"
  );
};

const rejectAdminRedemption = (req, res) => {
  return processLguRedemption(
    req,
    res,
    "reject"
  );
};

const confirmAdminRedemption = (req, res) => {
  return processLguRedemption(
    req,
    res,
    "confirm"
  );
};

module.exports = {
  getAdminRedemptions,
  approveAdminRedemption,
  rejectAdminRedemption,
  confirmAdminRedemption,
};
