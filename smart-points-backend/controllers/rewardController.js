const db = require('../config/db');

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
  const userRole = req.user?.role || null;

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
      r.image_url,
      p.organization_name AS partner_name,
      r.created_at
    FROM rewards r
    LEFT JOIN partners p ON r.partner_id = p.partner_id
  `;

  if (userRole === 'admin') {
    sql += `
      WHERE r.availability_status != 'pending'
      ORDER BY r.created_at DESC
    `;
  } else {
    sql += `
      WHERE r.availability_status = 'available'
      ORDER BY r.created_at DESC
    `;
  }

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch rewards',
        error: err.message
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

// CREATE REWARD
const createReward = (req, res) => {
  const {
    reward_name,
    description,
    category,
    points_cost,
    stock,
    partner_id,
    image_url
  } = req.body;

  if (!reward_name || points_cost === undefined || stock === undefined) {
    return res.status(400).json({
      success: false,
      message: 'reward_name, points_cost, and stock are required'
    });
  }

  const userRole = req.user.role;
  const userId = req.user.user_id;

  const finalPartnerId = userRole === 'partner' ? userId : (partner_id || null);
  const finalStatus = userRole === 'partner' ? 'pending' : 'available';

  const sql = `
    INSERT INTO rewards
    (
      partner_id,
      reward_name,
      description,
      category,
      points_cost,
      stock,
      image_url,
      availability_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      finalPartnerId,
      reward_name,
      description || null,
      category || null,
      Number(points_cost),
      Number(stock),
      image_url || null,
      finalStatus
    ],
    (err, result) => {
      if (err) {
        console.error('CREATE REWARD ERROR:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to create reward',
          error: err.message
        });
      }

      return res.status(201).json({
        success: true,
        message:
          userRole === 'partner'
            ? 'Reward submitted for admin approval'
            : 'Reward created successfully',
        reward_id: result.insertId,
        partner_id: finalPartnerId,
        availability_status: finalStatus
      });
    }
  );
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

// APPROVE REWARD
const approveReward = (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE rewards
    SET availability_status = 'available'
    WHERE reward_id = ?
      AND availability_status = 'pending'
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to approve reward',
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found or already reviewed'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reward approved successfully'
    });
  });
};

// REJECT REWARD
const rejectReward = (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE rewards
    SET availability_status = 'inactive'
    WHERE reward_id = ?
      AND availability_status = 'pending'
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to reject reward',
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found or already reviewed'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reward rejected successfully'
    });
  });
};

// UPDATE REWARD
const updateReward = (req, res) => {
  const { id } = req.params;
  const {
    reward_name,
    description,
    category,
    points_cost,
    stock,
    availability_status,
    partner_id,
    image_url
  } = req.body;

  const allowedStatuses = ['pending', 'available', 'out_of_stock', 'inactive'];
  const finalStatus = allowedStatuses.includes(availability_status)
    ? availability_status
    : 'available';

  const sql = `
    UPDATE rewards
    SET
      partner_id = ?,
      reward_name = ?,
      description = ?,
      category = ?,
      points_cost = ?,
      stock = ?,
      image_url = ?,
      availability_status = ?
    WHERE reward_id = ?
  `;

  db.query(
    sql,
    [
      partner_id || null,
      reward_name,
      description || null,
      category || null,
      Number(points_cost),
      Number(stock),
      image_url || null,
      finalStatus,
      id
    ],
    (err, result) => {
      if (err) {
        console.error('UPDATE REWARD ERROR:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to update reward',
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Reward not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Reward updated successfully'
      });
    }
  );
};

// DELETE / DEACTIVATE REWARD
const deleteReward = (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE rewards
    SET availability_status = 'inactive'
    WHERE reward_id = ?
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to deactivate reward',
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reward marked as inactive successfully'
    });
  });
};

// REDEEM REWARD
const redeemReward = (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;

  const rewardSql = `
    SELECT reward_id, reward_name, points_cost, stock, availability_status
    FROM rewards
    WHERE reward_id = ?
  `;

  db.query(rewardSql, [id], (rewardErr, rewardResults) => {
    if (rewardErr) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check reward',
        error: rewardErr.message
      });
    }

    if (rewardResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found'
      });
    }

    const reward = rewardResults[0];

    if (reward.availability_status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Reward is not available'
      });
    }

    if (reward.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Reward is out of stock'
      });
    }

    const userSql = `
      SELECT user_id, points_balance
      FROM users
      WHERE user_id = ?
    `;

    db.query(userSql, [userId], (userErr, userResults) => {
      if (userErr) {
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

      if (user.points_balance < reward.points_cost) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient points'
        });
      }

      const newBalance = Number(user.points_balance) - Number(reward.points_cost);
      const newStock = Number(reward.stock) - 1;
      const newAvailability = newStock <= 0 ? 'out_of_stock' : reward.availability_status;

      const insertRedemptionSql = `
        INSERT INTO reward_redemptions
        (user_id, reward_id, points_spent, status)
        VALUES (?, ?, ?, 'approved')
      `;

      db.query(
        insertRedemptionSql,
        [userId, reward.reward_id, reward.points_cost],
        (redemptionErr, redemptionResult) => {
          if (redemptionErr) {
            return res.status(500).json({
              success: false,
              message: 'Failed to create redemption record',
              error: redemptionErr.message
            });
          }

          const updateUserSql = `
            UPDATE users
            SET points_balance = ?
            WHERE user_id = ?
          `;

          db.query(updateUserSql, [newBalance, userId], (updateUserErr) => {
            if (updateUserErr) {
              return res.status(500).json({
                success: false,
                message: 'Redemption created but failed to update user balance',
                error: updateUserErr.message
              });
            }

            const updateRewardSql = `
              UPDATE rewards
              SET stock = ?, availability_status = ?
              WHERE reward_id = ?
            `;

            db.query(
              updateRewardSql,
              [newStock, newAvailability, reward.reward_id],
              (updateRewardErr) => {
                if (updateRewardErr) {
                  return res.status(500).json({
                    success: false,
                    message: 'Redemption created but failed to update reward stock',
                    error: updateRewardErr.message
                  });
                }

                const transactionSql = `
                  INSERT INTO point_transactions
                  (user_id, source_type, source_id, points_delta, balance_after, notes)
                  VALUES (?, 'redemption', ?, ?, ?, ?)
                `;

                db.query(
                  transactionSql,
                  [
                    userId,
                    redemptionResult.insertId,
                    -Number(reward.points_cost),
                    newBalance,
                    `Redeemed reward: ${reward.reward_name}`
                  ],
                  (txErr) => {
                    if (txErr) {
                      return res.status(500).json({
                        success: false,
                        message: 'Reward redeemed but transaction log failed',
                        error: txErr.message
                      });
                    }

                    return res.status(201).json({
                      success: true,
                      message: 'Reward redeemed successfully',
                      redemption_id: redemptionResult.insertId,
                      points_spent: reward.points_cost,
                      new_balance: newBalance,
                      remaining_stock: newStock
                    });
                  }
                );
              }
            );
          });
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
      'redemption' AS record_type
    FROM reward_redemptions rr
    INNER JOIN rewards r ON rr.reward_id = r.reward_id
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
      pt.source_type AS record_type
    FROM point_transactions pt
    WHERE pt.user_id = ?
      AND pt.source_type IN ('rank_bonus', 'monthly_bonus')

    ORDER BY activity_date DESC
  `;

  db.query(sql, [userId, userId], (err, results) => {
    if (err) {
      console.error('GET MY REDEMPTIONS ERROR:', err);

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
  });
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

        return res.status(200).json({
          success: true,
          can_claim: canClaim,
          already_claimed: alreadyClaimed,
          rank: currentRank,
          points: bonusPoints,
          approved_this_month: approvedThisMonth,
          month: seasonMonth,
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
  rejectReward
};