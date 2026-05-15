const db = require('../config/db');
const fs = require('fs');
const crypto = require('crypto');

/* ============================= */
/* RANK SYSTEM HELPERS */
/* ============================= */

const RANKS = [
  { name: 'New', required: 0, bonus: 0 },
  { name: 'Bronze', required: 100, bonus: 50 },
  { name: 'Silver', required: 400, bonus: 100 },
  { name: 'Gold', required: 700, bonus: 200 },
  { name: 'Platinum', required: 1100, bonus: 350 },
  { name: 'Diamond', required: 1500, bonus: 500 }
];

const getMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getRankByPoints = (points) => {
  let rank = RANKS[0];

  for (const item of RANKS) {
    if (Number(points || 0) >= item.required) {
      rank = item;
    }
  }

  return rank;
};

const getRankIndex = (rankName) => {
  return RANKS.findIndex((rank) => rank.name === rankName);
};

const handleRankProgress = (userId, callback = () => {}) => {
  const seasonMonth = getMonthKey();

  const profileSql = `
    INSERT INTO user_rank_profiles (user_id, current_rank, last_active_month)
    VALUES (?, 'New', ?)
    ON DUPLICATE KEY UPDATE user_id = user_id
  `;

  db.query(profileSql, [userId, seasonMonth], (profileErr) => {
    if (profileErr) {
      console.error('RANK PROFILE ERROR:', profileErr);
      return callback(profileErr);
    }

    const getProfileSql = `
      SELECT current_rank, last_active_month
      FROM user_rank_profiles
      WHERE user_id = ?
    `;

    db.query(getProfileSql, [userId], (getProfileErr, profileRows) => {
      if (getProfileErr) {
        console.error('GET RANK PROFILE ERROR:', getProfileErr);
        return callback(getProfileErr);
      }

      const profile = profileRows[0];
      const currentRank = profile?.current_rank || 'New';

      const seasonPointsSql = `
        SELECT COALESCE(SUM(awarded_points), 0) AS season_points
        FROM participation_records
        WHERE user_id = ?
          AND status = 'approved'
          AND DATE_FORMAT(reviewed_at, '%Y-%m') = ?
      `;

      db.query(seasonPointsSql, [userId, seasonMonth], (pointsErr, pointsRows) => {
        if (pointsErr) {
          console.error('SEASON POINTS ERROR:', pointsErr);
          return callback(pointsErr);
        }

        const seasonPoints = Number(pointsRows[0]?.season_points || 0);
        const earnedRank = getRankByPoints(seasonPoints);

        const currentIndex = getRankIndex(currentRank);
        const earnedIndex = getRankIndex(earnedRank.name);

        if (earnedIndex <= currentIndex || earnedRank.name === 'New') {
          const updateProfileSql = `
            UPDATE user_rank_profiles
            SET last_active_month = ?
            WHERE user_id = ?
          `;

          db.query(updateProfileSql, [seasonMonth, userId], () => {
            return callback(null, {
              rankedUp: false,
              currentRank,
              seasonPoints
            });
          });

          return;
        }

        const claimSql = `
          INSERT INTO season_rank_claims
          (user_id, season_month, rank_name, bonus_points)
          VALUES (?, ?, ?, ?)
        `;

        db.query(
          claimSql,
          [userId, seasonMonth, earnedRank.name, earnedRank.bonus],
          (claimErr) => {
            if (claimErr) {
              if (claimErr.code === 'ER_DUP_ENTRY') {
                return callback(null, {
                  rankedUp: false,
                  currentRank: earnedRank.name,
                  seasonPoints,
                  message: 'Rank bonus already claimed this month'
                });
              }

              console.error('RANK CLAIM ERROR:', claimErr);
              return callback(claimErr);
            }

            const getBalanceSql = `
              SELECT points_balance
              FROM users
              WHERE user_id = ?
            `;

            db.query(getBalanceSql, [userId], (balanceErr, balanceRows) => {
              if (balanceErr) {
                console.error('GET BALANCE ERROR:', balanceErr);
                return callback(balanceErr);
              }

              const currentBalance = Number(balanceRows[0]?.points_balance || 0);
              const newBonusBalance = currentBalance + earnedRank.bonus;

              const updateUserPointsSql = `
                UPDATE users
                SET points_balance = points_balance + ?
                WHERE user_id = ?
              `;

              db.query(updateUserPointsSql, [earnedRank.bonus, userId], (bonusErr) => {
                if (bonusErr) {
                  console.error('RANK BONUS POINT ERROR:', bonusErr);
                  return callback(bonusErr);
                }

                const transactionSql = `
                  INSERT INTO point_transactions
                  (user_id, source_type, source_id, points_delta, balance_after, notes)
                  VALUES (?, 'rank_bonus', NULL, ?, ?, ?)
                `;

                db.query(
                  transactionSql,
                  [
                    userId,
                    earnedRank.bonus,
                    newBonusBalance,
                    `Rank-up bonus: ${earnedRank.name} (${seasonMonth})`
                  ],
                  (txErr) => {
                    if (txErr) {
                      console.error('RANK BONUS TRANSACTION ERROR:', txErr);
                    }

                    const updateRankSql = `
                      UPDATE user_rank_profiles
                      SET current_rank = ?, last_active_month = ?
                      WHERE user_id = ?
                    `;

                    db.query(
                      updateRankSql,
                      [earnedRank.name, seasonMonth, userId],
                      (rankUpdateErr) => {
                        if (rankUpdateErr) {
                          console.error('UPDATE RANK ERROR:', rankUpdateErr);
                          return callback(rankUpdateErr);
                        }

                        return callback(null, {
                          rankedUp: true,
                          newRank: earnedRank.name,
                          bonusPoints: earnedRank.bonus,
                          seasonPoints
                        });
                      }
                    );
                  }
                );
              });
            });
          }
        );
      });
    });
  });
};

/* ============================= */
/* FILE HASH HELPER */
/* ============================= */

const generateFileHash = (filePath) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  } catch (error) {
    return null;
  }
};

/* ============================= */
/* SUBMIT PARTICIPATION */
/* ============================= */

const submitParticipation = (req, res) => {
  const userId = req.user.user_id;
  const { activity_id, feedback_text } = req.body;

  const uploadedProofPath = req.file ? `uploads/proofs/${req.file.filename}` : null;
  const proof_url = uploadedProofPath;
  const fullUploadedPath = req.file ? req.file.path : null;
  const proof_hash = fullUploadedPath ? generateFileHash(fullUploadedPath) : null;

  if (!activity_id) {
    return res.status(400).json({
      success: false,
      message: 'activity_id is required'
    });
  }

  const cleanFeedback = feedback_text ? feedback_text.trim() : '';

  const checkRegistrationSql = `
    SELECT *
    FROM activity_registrations
    WHERE user_id = ? AND activity_id = ?
  `;

  db.query(checkRegistrationSql, [userId, activity_id], (regErr, regResults) => {
    if (regErr) {
      return res.status(500).json({
        success: false,
        message: 'Failed to verify registration',
        error: regErr.message
      });
    }

    if (regResults.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You must join the activity before submitting participation'
      });
    }

    const checkDuplicateSql = `
      SELECT *
      FROM participation_records
      WHERE user_id = ? AND activity_id = ?
    `;

    db.query(checkDuplicateSql, [userId, activity_id], (dupErr, dupResults) => {
      if (dupErr) {
        return res.status(500).json({
          success: false,
          message: 'Failed to check duplicate participation',
          error: dupErr.message
        });
      }

      if (dupResults.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Participation already submitted for this activity'
        });
      }

      let ai_flag = false;
      let ai_score = 0;
      const reasonList = [];

      // RULE 1: no feedback submitted
      if (!cleanFeedback) {
        ai_score += 60;
        reasonList.push('Missing feedback');
      }

      // RULE 2: no proof uploaded
      if (!proof_url) {
        ai_score += 60;
        reasonList.push('Missing proof file');
      }

      const continueAfterProofCheck = () => {
        if (ai_score >= 30) {
          ai_flag = true;
        }

        const ai_reason =
          reasonList.length > 0
            ? reasonList.join('; ')
            : 'Clean submission';

        const status = ai_flag ? 'rejected' : 'pending';

        const insertSql = `
          INSERT INTO participation_records
          (
            user_id,
            activity_id,
            proof_url,
            proof_hash,
            feedback_text,
            status,
            ai_flag,
            ai_score,
            ai_reason,
            awarded_points
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `;

        db.query(
          insertSql,
          [
            userId,
            activity_id,
            proof_url,
            proof_hash,
            cleanFeedback || null,
            status,
            ai_flag,
            ai_score,
            ai_reason
          ],
          (insertErr, result) => {
            if (insertErr) {
              return res.status(500).json({
                success: false,
                message: 'Failed to submit participation',
                error: insertErr.message
              });
            }

            return res.status(201).json({
              success: true,
              message: ai_flag
                ? 'Participation was automatically rejected due to suspicious activity'
                : 'Participation submitted successfully and is waiting for admin approval',
              participation_id: result.insertId,
              status,
              ai_flag,
              ai_score,
              ai_reason,
              proof_url,
              proof_hash
            });
          }
        );
      };

      // RULE 3: duplicate proof image only
      if (proof_hash) {
        const duplicateProofHashSql = `
          SELECT COUNT(*) AS total
          FROM participation_records
          WHERE proof_hash = ?
        `;

        db.query(duplicateProofHashSql, [proof_hash], (proofErr, proofResults) => {
          if (proofErr) {
            return res.status(500).json({
              success: false,
              message: 'Failed during duplicate proof check',
              error: proofErr.message
            });
          }

          if (proofResults[0].total > 0) {
            ai_score += 100;
            reasonList.push('Duplicate proof file detected');
          }

          continueAfterProofCheck();
        });
      } else {
        continueAfterProofCheck();
      }
    });
  });
};

/* ============================= */
/* GET MY PARTICIPATIONS */
/* ============================= */

const getMyParticipations = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT
      pr.participation_id,
      pr.activity_id,
      a.title AS activity_title,
      a.category,
      pr.proof_url,
      pr.proof_hash,
      pr.feedback_text,
      pr.status,
      pr.ai_flag,
      pr.ai_score,
      pr.ai_reason,
      pr.awarded_points,
      pr.submitted_at,
      pr.reviewed_at
    FROM participation_records pr
    INNER JOIN activities a ON pr.activity_id = a.activity_id
    WHERE pr.user_id = ?
    ORDER BY pr.submitted_at DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch participations',
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      participations: results
    });
  });
};

/* ============================= */
/* GET REVIEW QUEUE */
/* ============================= */

const getReviewQueue = (req, res) => {
  const sql = `
    SELECT
      pr.participation_id,
      pr.user_id,
      u.full_name,
      u.email,
      pr.activity_id,
      a.title AS activity_title,
      pr.proof_url,
      pr.proof_hash,
      pr.feedback_text,
      pr.status,
      pr.ai_flag,
      pr.ai_score,
      pr.ai_reason,
      pr.awarded_points,
      pr.submitted_at
    FROM participation_records pr
    INNER JOIN users u ON pr.user_id = u.user_id
    INNER JOIN activities a ON pr.activity_id = a.activity_id
    WHERE pr.status = 'pending'
      AND pr.ai_flag = FALSE
    ORDER BY pr.submitted_at ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch review queue',
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      records: results
    });
  });
};

/* ============================= */
/* APPROVE PARTICIPATION */
/* ============================= */

const approveParticipation = (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user.user_id;

  const getParticipationSql = `
    SELECT pr.*, a.points_value, u.points_balance
    FROM participation_records pr
    INNER JOIN activities a ON pr.activity_id = a.activity_id
    INNER JOIN users u ON pr.user_id = u.user_id
    WHERE pr.participation_id = ?
  `;

  db.query(getParticipationSql, [id], (fetchErr, results) => {
    if (fetchErr) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch participation record',
        error: fetchErr.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Participation record not found'
      });
    }

    const record = results[0];

    if (record.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending submissions can be approved'
      });
    }

    const awardedPoints = Number(record.points_value || 0);
    const newBalance = Number(record.points_balance || 0) + awardedPoints;

    const updateParticipationSql = `
      UPDATE participation_records
      SET
        status = 'approved',
        awarded_points = ?,
        reviewed_by = ?,
        reviewed_at = NOW()
      WHERE participation_id = ?
    `;

    db.query(updateParticipationSql, [awardedPoints, reviewerId, id], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({
          success: false,
          message: 'Failed to approve participation',
          error: updateErr.message
        });
      }

      const updateUserSql = `
        UPDATE users
        SET points_balance = points_balance + ?
        WHERE user_id = ?
      `;

      db.query(updateUserSql, [awardedPoints, record.user_id], (userErr) => {
        if (userErr) {
          return res.status(500).json({
            success: false,
            message: 'Participation approved but failed to update points balance',
            error: userErr.message
          });
        }

        const transactionSql = `
          INSERT INTO point_transactions
          (user_id, source_type, source_id, points_delta, balance_after, notes)
          VALUES (?, 'activity', ?, ?, ?, ?)
        `;

        db.query(
          transactionSql,
          [
            record.user_id,
            record.activity_id,
            awardedPoints,
            newBalance,
            'Approved participation points'
          ],
          (txErr) => {
            if (txErr) {
              return res.status(500).json({
                success: false,
                message: 'Participation approved and balance updated, but transaction log failed',
                error: txErr.message
              });
            }

            handleRankProgress(record.user_id, (rankErr, rankResult) => {
              if (rankErr) {
                console.error('Rank progress failed:', rankErr);

                return res.status(200).json({
                  success: true,
                  message: 'Participation approved and points added, but rank progress failed',
                  awarded_points: awardedPoints,
                  new_balance: newBalance,
                  rank_error: rankErr.message
                });
              }

              return res.status(200).json({
                success: true,
                message: rankResult?.rankedUp
                  ? `Participation approved. Rank upgraded to ${rankResult.newRank}. Bonus +${rankResult.bonusPoints} points awarded.`
                  : 'Participation approved and points added immediately',
                awarded_points: awardedPoints,
                new_balance: newBalance,
                rankResult
              });
            });
          }
        );
      });
    });
  });
};

/* ============================= */
/* REJECT PARTICIPATION */
/* ============================= */

const rejectParticipation = (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user.user_id;

  const sql = `
    UPDATE participation_records
    SET
      status = 'rejected',
      awarded_points = 0,
      reviewed_by = ?,
      reviewed_at = NOW()
    WHERE participation_id = ?
      AND status = 'pending'
      AND ai_flag = FALSE
  `;

  db.query(sql, [reviewerId, id], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to reject participation',
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Participation not found or cannot be rejected from clean review queue'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Participation rejected successfully'
    });
  });
};

/* ============================= */
/* GET PARTICIPANTS BY ACTIVITY */
/* ============================= */

const getParticipantsByActivity = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      u.full_name,
      u.email,
      ar.created_at,
      ar.registration_status
    FROM activity_registrations ar
    INNER JOIN users u ON u.user_id = ar.user_id
    WHERE ar.activity_id = ?
    ORDER BY ar.created_at DESC
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch participants',
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      participants: results
    });
  });
};

module.exports = {
  submitParticipation,
  getMyParticipations,
  getReviewQueue,
  approveParticipation,
  rejectParticipation,
  getParticipantsByActivity
};