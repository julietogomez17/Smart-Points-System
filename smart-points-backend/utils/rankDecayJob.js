const cron = require('node-cron');
const db = require('../config/db');

const RANK_ORDER = ['New', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const demoteRank = (currentRank) => {
  const index = RANK_ORDER.indexOf(currentRank);

  if (index <= 0) return 'New';

  const newIndex = Math.max(index - 2, 0);

  return RANK_ORDER[newIndex];
};

const processMonthlyRankDecay = () => {
  const currentMonth = getCurrentMonthKey();

  console.log(`Running monthly rank decay/reset for ${currentMonth}`);

  const usersSql = `
    SELECT
      u.user_id,
      COALESCE(urp.current_rank, 'New') AS current_rank
    FROM users u
    LEFT JOIN user_rank_profiles urp
      ON urp.user_id = u.user_id
    WHERE u.role = 'community_member'
  `;

  db.query(usersSql, (usersErr, users) => {
    if (usersErr) {
      console.error('MONTHLY RANK RESET FETCH ERROR:', usersErr);
      return;
    }

    if (!users || users.length === 0) {
      console.log('No community members to process.');
      return;
    }

    users.forEach((user) => {
      const checkAlreadyProcessedSql = `
        SELECT transaction_id
        FROM point_transactions
        WHERE user_id = ?
          AND source_type = 'bonus'
          AND notes LIKE ?
        LIMIT 1
      `;

      db.query(
        checkAlreadyProcessedSql,
        [user.user_id, `Monthly rank decay:%(${currentMonth})%`],
        (checkErr, checkRows) => {
          if (checkErr) {
            console.error(`MONTHLY RESET CHECK ERROR FOR USER ${user.user_id}:`, checkErr);
            return;
          }

          if (checkRows.length > 0) {
            console.log(`User ${user.user_id} already processed for ${currentMonth}.`);
            return;
          }

          const oldRank = user.current_rank || 'New';
          const newRank = demoteRank(oldRank);

          const upsertProfileSql = `
            INSERT INTO user_rank_profiles
              (user_id, current_rank, last_active_month)
            VALUES
              (?, ?, ?)
            ON DUPLICATE KEY UPDATE
              current_rank = VALUES(current_rank),
              last_active_month = VALUES(last_active_month),
              updated_at = NOW()
          `;

          db.query(
            upsertProfileSql,
            [user.user_id, newRank, currentMonth],
            (profileErr) => {
              if (profileErr) {
                console.error(`MONTHLY RESET PROFILE ERROR FOR USER ${user.user_id}:`, profileErr);
                return;
              }

              const logSql = `
                INSERT INTO point_transactions
                (user_id, source_type, source_id, points_delta, balance_after, notes)
                SELECT
                  user_id,
                  'bonus',
                  NULL,
                  0,
                  points_balance,
                  ?
                FROM users
                WHERE user_id = ?
              `;

              db.query(
                logSql,
                [
                  `Monthly rank decay: ${oldRank} to ${newRank} (${currentMonth})`,
                  user.user_id
                ],
                (logErr) => {
                  if (logErr) {
                    console.error(`MONTHLY RESET LOG ERROR FOR USER ${user.user_id}:`, logErr);
                    return;
                  }

                  console.log(`User ${user.user_id}: ${oldRank} → ${newRank}`);
                }
              );
            }
          );
        }
      );
    });
  });
};

const startRankDecayJob = () => {
  cron.schedule('5 0 1 * *', () => {
    processMonthlyRankDecay();
  });

  console.log('Monthly rank decay/reset job scheduled: every 1st day at 12:05 AM.');
};

module.exports = {
  startRankDecayJob,
  processMonthlyRankDecay
};