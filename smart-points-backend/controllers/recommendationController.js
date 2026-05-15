const db = require('../config/db');

const getRewardRecommendations = (req, res) => {
  const userId = req.user.user_id;

  const userSql = `
    SELECT user_id, points_balance
    FROM users
    WHERE user_id = ?
  `;

  db.query(userSql, [userId], (userErr, userResults) => {
    if (userErr) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user data',
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

    const activityHistorySql = `
      SELECT a.category, COUNT(*) AS total
      FROM participation_records pr
      INNER JOIN activities a ON pr.activity_id = a.activity_id
      WHERE pr.user_id = ? AND pr.status = 'approved'
      GROUP BY a.category
      ORDER BY total DESC
      LIMIT 1
    `;

    db.query(activityHistorySql, [userId], (historyErr, historyResults) => {
      if (historyErr) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch activity history',
          error: historyErr.message
        });
      }

      const favoriteCategory =
        historyResults.length > 0 ? historyResults[0].category : null;

      const rewardsSql = `
        SELECT
          r.reward_id,
          r.reward_name,
          r.description,
          r.category,
          r.points_cost,
          r.stock,
          r.availability_status,
          p.organization_name AS partner_name
        FROM rewards r
        LEFT JOIN partners p ON r.partner_id = p.partner_id
        WHERE r.availability_status = 'available'
          AND r.stock > 0
      `;

      db.query(rewardsSql, (rewardErr, rewardResults) => {
        if (rewardErr) {
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch rewards',
            error: rewardErr.message
          });
        }

        const recommendations = rewardResults.map((reward) => {
          const affordable = user.points_balance >= reward.points_cost;
          const gap = reward.points_cost - user.points_balance;

          let reason = 'Currently in stock';

          if (affordable) {
            reason = 'You can afford this reward now';
          } else if (gap > 0) {
            reason = `You need ${gap} more point${gap === 1 ? '' : 's'} to redeem this`;
          }

          if (
            favoriteCategory &&
            reward.category &&
            reward.category.toLowerCase() === favoriteCategory.toLowerCase()
          ) {
            reason += '. Matches your activity history';
          }

          return {
            reward_id: reward.reward_id,
            reward_name: reward.reward_name,
            description: reward.description,
            category: reward.category,
            points_cost: reward.points_cost,
            stock: reward.stock,
            partner_name: reward.partner_name,
            affordable,
            reason
          };
        });

        recommendations.sort((a, b) => {
          // 1. Affordable rewards first
          if (a.affordable !== b.affordable) {
            return a.affordable ? -1 : 1;
          }

          // 2. Lowest points cost first
          if (a.points_cost !== b.points_cost) {
            return a.points_cost - b.points_cost;
          }

          // 3. Higher stock first
          return b.stock - a.stock;
        });

        return res.status(200).json({
          success: true,
          current_points: user.points_balance,
          favorite_category: favoriteCategory,
          recommendations
        });
      });
    });
  });
};

module.exports = {
  getRewardRecommendations
};