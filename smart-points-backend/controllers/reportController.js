const db = require('../config/db');

// DASHBOARD SUMMARY
const getDashboardSummary = (req, res) => {
  const summary = {};

  const queries = [
    {
      key: 'total_users',
      sql: `SELECT COUNT(*) AS total FROM users WHERE role = 'community_member'`
    },
    {
      key: 'total_activities',
      sql: `SELECT COUNT(*) AS total FROM activities`
    },
    {
      key: 'approved_participations',
      sql: `SELECT COUNT(*) AS total FROM participation_records WHERE status = 'approved'`
    },
    {
      key: 'rejected_participations',
      sql: `SELECT COUNT(*) AS total FROM participation_records WHERE status = 'rejected'`
    },
    {
      key: 'flagged_or_suspicious',
      sql: `SELECT COUNT(*) AS total FROM participation_records WHERE ai_flag = TRUE`
    },
    {
      key: 'total_rewards_redeemed',
      sql: `SELECT COUNT(*) AS total FROM reward_redemptions`
    },
    {
      key: 'total_points_awarded',
      sql: `SELECT COALESCE(SUM(points_delta), 0) AS total FROM point_transactions WHERE source_type = 'activity'`
    }
  ];

  let completed = 0;
  let hasError = false;

  queries.forEach((queryItem) => {
    db.query(queryItem.sql, (err, results) => {
      if (hasError) return;

      if (err) {
        hasError = true;
        return res.status(500).json({
          success: false,
          message: `Failed to fetch ${queryItem.key}`,
          error: err.message
        });
      }

      summary[queryItem.key] = results[0].total;
      completed++;

      if (completed === queries.length) {
        return res.status(200).json({
          success: true,
          dashboard: summary
        });
      }
    });
  });
};

// ACTIVITY ENGAGEMENT REPORT
const getActivityEngagementReport = (req, res) => {
  const sql = `
    SELECT
      a.activity_id,
      a.title,
      a.category,
      a.status,
      COUNT(DISTINCT ar.registration_id) AS total_joined,
      COUNT(DISTINCT CASE WHEN pr.status = 'approved' THEN pr.participation_id END) AS approved_count,
      COUNT(DISTINCT CASE WHEN pr.status = 'rejected' THEN pr.participation_id END) AS rejected_count,
      COALESCE(SUM(CASE WHEN pr.status = 'approved' THEN pr.awarded_points ELSE 0 END), 0) AS total_points_generated
    FROM activities a
    LEFT JOIN activity_registrations ar ON a.activity_id = ar.activity_id
    LEFT JOIN participation_records pr ON a.activity_id = pr.activity_id
    GROUP BY a.activity_id, a.title, a.category, a.status
    ORDER BY a.title ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch activity engagement report',
        error: err.message
      });
    }

    const report = results.map((row) => {
      const completion_rate =
        row.total_joined > 0
          ? ((row.approved_count / row.total_joined) * 100).toFixed(2)
          : '0.00';

      return {
        ...row,
        completion_rate: `${completion_rate}%`
      };
    });

    return res.status(200).json({
      success: true,
      count: report.length,
      report
    });
  });
};

// MEMBER ENGAGEMENT REPORT
const getMemberEngagementReport = (req, res) => {
  const sql = `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.points_balance,
      COUNT(DISTINCT ar.registration_id) AS joined_activities,
      COUNT(DISTINCT CASE WHEN pr.status = 'approved' THEN pr.participation_id END) AS approved_participations,
      COUNT(DISTINCT CASE WHEN pr.status = 'rejected' THEN pr.participation_id END) AS rejected_participations,
      COUNT(DISTINCT rr.redemption_id) AS total_redemptions
    FROM users u
    LEFT JOIN activity_registrations ar ON u.user_id = ar.user_id
    LEFT JOIN participation_records pr ON u.user_id = pr.user_id
    LEFT JOIN reward_redemptions rr ON u.user_id = rr.user_id
    WHERE u.role = 'community_member'
    GROUP BY u.user_id, u.full_name, u.email, u.points_balance
    ORDER BY approved_participations DESC, joined_activities DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch member engagement report',
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      report: results
    });
  });
};

// FRAUD REPORT
const getFraudReport = (req, res) => {
  const sql = `
    SELECT
      pr.participation_id,
      u.full_name,
      u.email,
      a.title AS activity_title,
      pr.feedback_text,
      pr.proof_url,
      pr.status,
      pr.ai_flag,
      pr.ai_score,
      pr.ai_reason,
      pr.submitted_at
    FROM participation_records pr
    INNER JOIN users u ON pr.user_id = u.user_id
    INNER JOIN activities a ON pr.activity_id = a.activity_id
    WHERE pr.ai_flag = TRUE
       OR pr.ai_score >= 25
       OR pr.ai_reason != 'Clean submission'
    ORDER BY pr.ai_score DESC, pr.submitted_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch fraud report',
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      report: results
    });
  });
};

// REDEMPTION REPORT
const getRedemptionReport = (req, res) => {
  const sql = `
    SELECT
      r.reward_id,
      r.reward_name,
      r.category,
      r.stock,
      COUNT(rr.redemption_id) AS total_redemptions,
      COALESCE(SUM(rr.points_spent), 0) AS total_points_spent
    FROM rewards r
    LEFT JOIN reward_redemptions rr ON r.reward_id = rr.reward_id
    GROUP BY r.reward_id, r.reward_name, r.category, r.stock
    ORDER BY total_redemptions DESC, r.reward_name ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch redemption report',
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      report: results
    });
  });
};

// PARTNER CONTRIBUTION REPORT
const getPartnerContributionReport = (req, res) => {
  const sql = `
    SELECT
      p.partner_id,
      p.organization_name,
      COUNT(DISTINCT a.activity_id) AS total_activities,
      COUNT(DISTINCT r.reward_id) AS total_rewards,
      COUNT(DISTINCT rr.redemption_id) AS total_reward_redemptions,
      COALESCE(SUM(CASE WHEN pr.status = 'approved' THEN pr.awarded_points ELSE 0 END), 0) AS total_points_generated
    FROM partners p
    LEFT JOIN activities a ON p.partner_id = a.partner_id
    LEFT JOIN rewards r ON p.partner_id = r.partner_id
    LEFT JOIN reward_redemptions rr ON r.reward_id = rr.reward_id
    LEFT JOIN participation_records pr ON a.activity_id = pr.activity_id
    GROUP BY p.partner_id, p.organization_name
    ORDER BY p.organization_name ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch partner contribution report',
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      report: results
    });
  });
};

// SEASON LEADERBOARD
// Uses saved rank from user_rank_profiles.
// Counts only current-month approved points after the latest monthly rank decay log.
const getSeasonLeaderboard = (req, res) => {
  const sql = `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.points_balance,
      COALESCE(urp.current_rank, 'New') AS current_rank,
      COALESCE(SUM(pr.awarded_points), 0) AS season_points,
      COUNT(DISTINCT pr.participation_id) AS approved_count
    FROM users u
    LEFT JOIN user_rank_profiles urp
      ON urp.user_id = u.user_id
    LEFT JOIN (
      SELECT
        user_id,
        MAX(created_at) AS last_decay_at
      FROM point_transactions
      WHERE source_type = 'bonus'
        AND notes LIKE 'Monthly rank decay:%'
      GROUP BY user_id
    ) decay
      ON decay.user_id = u.user_id
    LEFT JOIN participation_records pr
      ON pr.user_id = u.user_id
      AND pr.status = 'approved'
      AND MONTH(pr.reviewed_at) = MONTH(CURRENT_DATE())
      AND YEAR(pr.reviewed_at) = YEAR(CURRENT_DATE())
      AND (
        decay.last_decay_at IS NULL
        OR pr.reviewed_at > decay.last_decay_at
      )
    WHERE u.role = 'community_member'
    GROUP BY
      u.user_id,
      u.full_name,
      u.email,
      u.points_balance,
      urp.current_rank
    ORDER BY season_points DESC, approved_count DESC
    LIMIT 10
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('SEASON LEADERBOARD ERROR:', err);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch season leaderboard',
        error: err.message
      });
    }

    const leaderboard = results.map((member, index) => {
      return {
        ...member,
        rank: index + 1,
        tier: member.current_rank || 'New'
      };
    });

    return res.status(200).json({
      success: true,
      count: leaderboard.length,
      leaderboard
    });
  });
};

module.exports = {
  getDashboardSummary,
  getActivityEngagementReport,
  getMemberEngagementReport,
  getRedemptionReport,
  getFraudReport,
  getPartnerContributionReport,
  getSeasonLeaderboard
};