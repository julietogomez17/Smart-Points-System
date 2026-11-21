const db = require('../config/db');

// ==========================================
// DASHBOARD SUMMARY
// ==========================================

const getDashboardSummary = (req, res) => {
  const isLgu = req.user.role === 'lgu';
  const lguId = req.user.user_id;

  // Admin sees system-wide statistics.
  // LGU sees only statistics related to its own activities.
  const activityFilter = isLgu
    ? 'AND a.created_by = ?'
    : '';

  const queries = [
    {
      key: 'total_users',
      sql: `
        SELECT COUNT(DISTINCT pr.user_id) AS total
        FROM participation_records pr
        INNER JOIN activities a
          ON a.activity_id = pr.activity_id
        WHERE 1 = 1 ${activityFilter}
      `,
      adminSql: `
        SELECT COUNT(*) AS total
        FROM users
        WHERE role = 'community_member'
      `
    },
    {
      key: 'active_citizens',
      sql: `
        SELECT COUNT(DISTINCT pr.user_id) AS total
        FROM participation_records pr
        INNER JOIN activities a
          ON a.activity_id = pr.activity_id
        WHERE pr.status = 'approved'
          ${activityFilter}
      `
    },
    {
      key: 'total_activities',
      sql: `
        SELECT COUNT(*) AS total
        FROM activities a
        WHERE 1 = 1 ${activityFilter}
      `
    },
    {
      key: 'pending_reviews',
      sql: `
        SELECT COUNT(*) AS total
        FROM participation_records pr
        INNER JOIN activities a
          ON a.activity_id = pr.activity_id
        WHERE pr.status = 'pending'
          ${activityFilter}
      `
    },
    {
      key: 'approved_participations',
      sql: `
        SELECT COUNT(*) AS total
        FROM participation_records pr
        INNER JOIN activities a
          ON a.activity_id = pr.activity_id
        WHERE pr.status = 'approved'
          ${activityFilter}
      `
    },
    {
      key: 'rejected_participations',
      sql: `
        SELECT COUNT(*) AS total
        FROM participation_records pr
        INNER JOIN activities a
          ON a.activity_id = pr.activity_id
        WHERE pr.status = 'rejected'
          ${activityFilter}
      `
    },
    {
      key: 'total_participations',
      sql: `
        SELECT COUNT(*) AS total
        FROM participation_records pr
        INNER JOIN activities a
          ON a.activity_id = pr.activity_id
        WHERE 1 = 1 ${activityFilter}
      `
    },
    {
      key: 'flagged_or_suspicious',
      sql: `
        SELECT COUNT(*) AS total
        FROM participation_records pr
        INNER JOIN activities a
          ON a.activity_id = pr.activity_id
        WHERE pr.ai_flag = TRUE
          ${activityFilter}
      `
    },
    {
      key: 'total_rewards_redeemed',
      sql: `
        SELECT COUNT(*) AS total
        FROM reward_redemptions
      `,
      lguValue: 0
    },
    {
      key: 'total_points_awarded',
      sql: `
        SELECT COALESCE(SUM(pr.awarded_points), 0) AS total
        FROM participation_records pr
        INNER JOIN activities a
          ON a.activity_id = pr.activity_id
        WHERE pr.status = 'approved'
          ${activityFilter}
      `,
      adminSql: `
        SELECT COALESCE(SUM(points_delta), 0) AS total
        FROM point_transactions
        WHERE source_type = 'activity'
          AND points_delta > 0
      `
    },
    {
      key: 'total_points_redeemed',
      sql: `
        SELECT COALESCE(SUM(points_spent), 0) AS total
        FROM reward_redemptions
      `,
      lguValue: 0
    },
    {
      key: 'current_point_circulation',
      sql: `
        SELECT COALESCE(SUM(points_balance), 0) AS total
        FROM users
        WHERE role = 'community_member'
      `,
      lguValue: 0
    }
  ];

  const summary = {};
  let completed = 0;
  let hasError = false;

  queries.forEach((item) => {
    if (isLgu && item.lguValue !== undefined) {
      summary[item.key] = item.lguValue;
      completed++;

      if (completed === queries.length && !hasError) {
        finish();
      }
      return;
    }

    const sql =
      !isLgu && item.adminSql
        ? item.adminSql
        : item.sql;

    const params =
      isLgu && sql.includes('a.created_by = ?')
        ? [lguId]
        : [];

    db.query(sql, params, (error, rows) => {
      if (hasError) return;

      if (error) {
        hasError = true;
        console.error('DASHBOARD REPORT ERROR:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to load dashboard statistics.'
        });
      }

      summary[item.key] = Number(rows[0]?.total || 0);
      completed++;

      if (completed === queries.length) {
        finish();
      }
    });
  });

  function finish() {
    summary.net_points =
      summary.total_points_awarded -
      summary.total_points_redeemed;

    return res.status(200).json({
      success: true,
      dashboard: summary
    });
  }
};



  
// ==========================================
// ACTIVITY ENGAGEMENT REPORT
// ==========================================
const getActivityEngagementReport = (req, res) => {
  const isLgu = req.user.role === 'lgu';

  const ownershipCondition = isLgu
    ? 'WHERE a.created_by = ?'
    : '';

  const queryParams = isLgu
    ? [req.user.user_id]
    : [];
  const sql = `
    SELECT
      a.activity_id,
      a.title,
      a.category,
      a.status,

      COALESCE(ar.total_joined, 0) AS total_joined,
      COALESCE(pr.approved_count, 0) AS approved_count,
      COALESCE(pr.rejected_count, 0) AS rejected_count,
      COALESCE(pr.total_points_generated, 0) AS total_points_generated

    FROM activities a

    LEFT JOIN (
      SELECT
        activity_id,
        COUNT(*) AS total_joined
      FROM activity_registrations
      GROUP BY activity_id
    ) ar
      ON a.activity_id = ar.activity_id

    LEFT JOIN (
      SELECT
        activity_id,

        SUM(
          CASE
            WHEN status = 'approved'
            THEN 1
            ELSE 0
          END
        ) AS approved_count,

        SUM(
          CASE
            WHEN status = 'rejected'
            THEN 1
            ELSE 0
          END
        ) AS rejected_count,

        SUM(
          CASE
            WHEN status = 'approved'
            THEN COALESCE(awarded_points, 0)
            ELSE 0
          END
        ) AS total_points_generated

      FROM participation_records
      GROUP BY activity_id
       ) pr
      ON a.activity_id = pr.activity_id

    ${ownershipCondition}

    ORDER BY
      a.title ASC
  `;

 db.query(sql, queryParams, (err, results) => {
    if (err) {
      console.error(
        'ACTIVITY ENGAGEMENT REPORT ERROR:',
        err
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to fetch activity engagement report',
        error: err.message
      });
    }

    const report = results.map((row) => {
      const joined = Number(row.total_joined || 0);
      const approved = Number(row.approved_count || 0);

      const completionRate =
        joined > 0
          ? ((approved / joined) * 100).toFixed(2)
          : '0.00';

      return {
        ...row,
        total_joined: joined,
        approved_count: approved,
        rejected_count: Number(
          row.rejected_count || 0
        ),
        total_points_generated: Number(
          row.total_points_generated || 0
        ),
        completion_rate: `${completionRate}%`
      };
    });

    return res.status(200).json({
      success: true,
      count: report.length,
      report
    });
  });
};

// ==========================================
// MEMBER ENGAGEMENT REPORT
// ==========================================

const getMemberEngagementReport = (req, res) => {
  const isLgu = req.user.role === 'lgu';

  // LGUs only see citizens who registered for or
  // participated in activities created by their account.
  if (isLgu) {
    const sql = `
      SELECT
        u.user_id,
      TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
u.email,

        NULL AS points_balance,

        (
          SELECT COUNT(DISTINCT ar.registration_id)
          FROM activity_registrations ar
          INNER JOIN activities a
            ON a.activity_id = ar.activity_id
          WHERE ar.user_id = u.user_id
            AND a.created_by = ?
        ) AS joined_activities,

        (
          SELECT COUNT(DISTINCT pr.participation_id)
          FROM participation_records pr
          INNER JOIN activities a
            ON a.activity_id = pr.activity_id
          WHERE pr.user_id = u.user_id
            AND pr.status = 'approved'
            AND a.created_by = ?
        ) AS approved_participations,

        (
          SELECT COUNT(DISTINCT pr.participation_id)
          FROM participation_records pr
          INNER JOIN activities a
            ON a.activity_id = pr.activity_id
          WHERE pr.user_id = u.user_id
            AND pr.status = 'rejected'
            AND a.created_by = ?
        ) AS rejected_participations,

        NULL AS total_redemptions

      FROM users u

      WHERE u.role = 'community_member'
        AND (
          EXISTS (
            SELECT 1
            FROM activity_registrations ar
            INNER JOIN activities a
              ON a.activity_id = ar.activity_id
            WHERE ar.user_id = u.user_id
              AND a.created_by = ?
          )
          OR EXISTS (
            SELECT 1
            FROM participation_records pr
            INNER JOIN activities a
              ON a.activity_id = pr.activity_id
            WHERE pr.user_id = u.user_id
              AND a.created_by = ?
          )
        )

      ORDER BY
        approved_participations DESC,
        joined_activities DESC
    `;

    const params = Array(5).fill(req.user.user_id);

    return db.query(sql, params, (err, results) => {
      if (err) {
        console.error('LGU MEMBER ENGAGEMENT ERROR:', err);

        return res.status(500).json({
          success: false,
          message: 'Failed to fetch LGU member engagement report'
        });
      }

      return res.status(200).json({
        success: true,
        count: results.length,
        report: results
      });
    });
  }

  // Super Admin retains system-wide reporting.
  const sql = `
    SELECT
      u.user_id,
      TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
      u.email,
      u.points_balance,

      COUNT(DISTINCT ar.registration_id)
        AS joined_activities,

      COUNT(
        DISTINCT CASE
          WHEN pr.status = 'approved'
          THEN pr.participation_id
        END
      ) AS approved_participations,

      COUNT(
        DISTINCT CASE
          WHEN pr.status = 'rejected'
          THEN pr.participation_id
        END
      ) AS rejected_participations,

      COUNT(DISTINCT rr.redemption_id)
        AS total_redemptions

    FROM users u

    LEFT JOIN activity_registrations ar
      ON u.user_id = ar.user_id

    LEFT JOIN participation_records pr
      ON u.user_id = pr.user_id

    LEFT JOIN reward_redemptions rr
      ON u.user_id = rr.user_id

    WHERE u.role = 'community_member'

   
GROUP BY
    u.user_id,
    u.first_name,
    u.middle_name,
    u.last_name,
    u.suffix,
    u.email,
    u.points_balance


    ORDER BY
      approved_participations DESC,
      joined_activities DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('MEMBER ENGAGEMENT ERROR:', err);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch member engagement report'
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      report: results
    });
  });
};


// ==========================================
// FRAUD REPORT
// ==========================================

const getFraudReport = (req, res) => {
  const isLgu = req.user.role === 'lgu';

  const sql = `
    SELECT
      pr.participation_id,
      TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
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

    INNER JOIN users u
      ON pr.user_id = u.user_id

    INNER JOIN activities a
      ON pr.activity_id = a.activity_id

    WHERE (
      pr.ai_flag = TRUE
      OR pr.ai_score >= 25
      OR (
        pr.ai_reason IS NOT NULL
        AND pr.ai_reason != 'Clean submission'
      )
    )

    ${isLgu ? 'AND a.created_by = ?' : ''}

    ORDER BY
      pr.ai_score DESC,
      pr.submitted_at DESC
  `;

  const params = isLgu
    ? [req.user.user_id]
    : [];

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('FRAUD REPORT ERROR:', err);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch fraud report'
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      report: results
    });
  });
};


// ==========================================
// REDEMPTION REPORT
// ==========================================

const getRedemptionReport = (req, res) => {
  const isLgu = req.user.role === 'lgu';

  const ownershipCondition = isLgu
    ? 'WHERE r.created_by_user_id = ?'
    : '';

  const queryParams = isLgu
    ? [req.user.user_id]
    : [];

  const sql = `
    SELECT
      r.reward_id,
      r.reward_name,
      r.category,
      r.stock,

      COUNT(rr.redemption_id) AS total_redemptions,

      COALESCE(
        SUM(rr.points_spent),
        0
      ) AS total_points_spent

    FROM rewards r

    LEFT JOIN reward_redemptions rr
      ON r.reward_id = rr.reward_id

    ${ownershipCondition}

    GROUP BY
      r.reward_id,
      r.reward_name,
      r.category,
      r.stock

    ORDER BY
      total_redemptions DESC,
      r.reward_name ASC
  `;

  db.query(sql, queryParams, (err, results) => {
    if (err) {
      console.error('REDEMPTION REPORT ERROR:', err);

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


// ==========================================
// PARTNER CONTRIBUTION REPORT
// ==========================================
const getPartnerContributionReport = (req, res) => {
  const sql = `
    SELECT
      p.partner_id,
      p.organization_name,

      COUNT(
        DISTINCT a.activity_id
      ) AS total_activities,

      COUNT(
        DISTINCT r.reward_id
      ) AS total_rewards,

      COUNT(
        DISTINCT rr.redemption_id
      ) AS total_reward_redemptions,

      COALESCE(
        SUM(
          CASE
            WHEN pr.status = 'approved'
            THEN pr.awarded_points
            ELSE 0
          END
        ),
        0
      ) AS total_points_generated

    FROM partners p

    LEFT JOIN activities a
      ON p.partner_id = a.partner_id

    LEFT JOIN rewards r
      ON p.partner_id = r.partner_id

    LEFT JOIN reward_redemptions rr
      ON r.reward_id = rr.reward_id

    LEFT JOIN participation_records pr
      ON a.activity_id = pr.activity_id

    GROUP BY
      p.partner_id,
      p.organization_name

    ORDER BY
      p.organization_name ASC
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

// ==========================================
// PARTICIPATION TREND REPORT
// ==========================================
const getParticipationTrendReport = (req, res) => {
  const period = req.query.period || 'month';
  const isLgu = req.user.role === 'lgu';

const activityJoin = isLgu
  ? `INNER JOIN activities a
       ON a.activity_id = participation_records.activity_id`
  : '';

const ownershipCondition = isLgu
  ? 'AND a.created_by = ?'
  : '';

const queryParams = isLgu
  ? [req.user.user_id]
  : [];

  let dateCondition = '';
  let dateKey = '';
  let dateLabel = '';

  // ==========================================
  // THIS WEEK
  // ==========================================
  if (period === 'week') {
    dateCondition = `
      AND reviewed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
    `;

    dateKey = `
      DATE_FORMAT(reviewed_at, '%Y-%m-%d')
    `;

    dateLabel = `
      DATE_FORMAT(reviewed_at, '%b %d')
    `;
  }

  // ==========================================
  // THIS MONTH
  // ==========================================
  else if (period === 'month') {
    dateCondition = `
      AND MONTH(reviewed_at) = MONTH(CURRENT_DATE())
      AND YEAR(reviewed_at) = YEAR(CURRENT_DATE())
    `;

    dateKey = `
      DATE_FORMAT(reviewed_at, '%Y-%m-%d')
    `;

    dateLabel = `
      DATE_FORMAT(reviewed_at, '%b %d')
    `;
  }

  // ==========================================
  // THIS YEAR
  // ==========================================
  else if (period === 'year') {
    dateCondition = `
      AND YEAR(reviewed_at) = YEAR(CURRENT_DATE())
    `;

    dateKey = `
      DATE_FORMAT(reviewed_at, '%Y-%m')
    `;

    dateLabel = `
      DATE_FORMAT(reviewed_at, '%b')
    `;
  }

  // ==========================================
  // ALL TIME
  // ==========================================
  else {
    dateKey = `
      DATE_FORMAT(reviewed_at, '%Y-%m')
    `;

    dateLabel = `
      DATE_FORMAT(reviewed_at, '%b %Y')
    `;
  }

  // ==========================================
  // CHART DATA
  // ==========================================
  const trendSql = `
    SELECT
      ${dateKey} AS period_key,
      ${dateLabel} AS period_label,

      COUNT(*) AS total_participations,

      COUNT(DISTINCT participation_records.user_id) AS active_citizens

   FROM participation_records

${activityJoin}

WHERE
      participation_records.status = 'approved'
      AND participation_records.reviewed_at IS NOT NULL

      ${dateCondition}
      ${ownershipCondition}


    GROUP BY
      ${dateKey},
      ${dateLabel}

    ORDER BY
      period_key ASC
  `;

  // ==========================================
  // SUMMARY FOR SELECTED PERIOD
  // Prevents duplicate counting of citizens
  // ==========================================
 const summarySql = `
  SELECT
    COUNT(*) AS total_participations,
    COUNT(DISTINCT participation_records.user_id) AS active_citizens

  FROM participation_records

  ${activityJoin}

WHERE
    participation_records.status = 'approved'
    AND participation_records.reviewed_at IS NOT NULL

    ${dateCondition}
    ${ownershipCondition}
`;

  db.query(trendSql, queryParams, (trendErr, trendRows) => {
    if (trendErr) {
      console.error(
        'PARTICIPATION TREND ERROR:',
        trendErr
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to fetch participation trend report',
        error: trendErr.message
      });
    }

    db.query(summarySql, queryParams, (summaryErr, summaryRows) => {
      if (summaryErr) {
        console.error(
          'PARTICIPATION SUMMARY ERROR:',
          summaryErr
        );

        return res.status(500).json({
          success: false,
          message:
            'Failed to fetch participation summary',
          error: summaryErr.message
        });
      }

      const report = trendRows.map((row) => ({
        period_key: row.period_key,

        period_label: row.period_label,

        total_participations: Number(
          row.total_participations || 0
        ),

        active_citizens: Number(
          row.active_citizens || 0
        )
      }));

      const summary = {
        total_participations: Number(
          summaryRows[0]?.total_participations || 0
        ),

        active_citizens: Number(
          summaryRows[0]?.active_citizens || 0
        )
      };

      return res.status(200).json({
        success: true,

        period,

        summary,

        count: report.length,

        report
      });
    });
  });
};


// ==========================================
// SEASON LEADERBOARD
// ==========================================
// Uses saved rank from user_rank_profiles.
// Counts only current-month approved points after
// the latest monthly rank decay log.
const getSeasonLeaderboard = (req, res) => {
  const sql = `
    SELECT
      u.user_id,
      TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
      u.email,
      u.points_balance,

      COALESCE(
        urp.current_rank,
        'New'
      ) AS current_rank,

      COALESCE(
        SUM(pr.awarded_points),
        0
      ) AS season_points,

      COUNT(
        DISTINCT pr.participation_id
      ) AS approved_count

    FROM users u

    LEFT JOIN user_rank_profiles urp
      ON urp.user_id = u.user_id

    LEFT JOIN (
      SELECT
        user_id,
        MAX(created_at) AS last_decay_at

      FROM point_transactions

      WHERE
        source_type = 'bonus'
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

    WHERE
      u.role = 'community_member'

    

GROUP BY
    u.user_id,
    u.first_name,
    u.middle_name,
    u.last_name,
    u.suffix,
    u.email,
    u.points_balance,
    urp.current_rank


    ORDER BY
      season_points DESC,
      approved_count DESC

    
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(
        'SEASON LEADERBOARD ERROR:',
        err
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to fetch season leaderboard',
        error: err.message
      });
    }

    const leaderboard = results.map(
      (member, index) => ({
        ...member,
        rank: index + 1,
        tier: member.current_rank || 'New'
      })
    );

    return res.status(200).json({
      success: true,
      count: leaderboard.length,
      leaderboard
    });
  });
};
// ==========================================
// SMART POINTS TRANSACTIONS REPORT
// ==========================================

const getSmartPointsTransactions = (req, res) => {
  const period = req.query.period || 'all';

  // ==========================================
  // LGU: OWN ACTIVITY POINT TRANSACTIONS ONLY
  // ==========================================
  if (req.user.role === 'lgu') {
    let lguDateCondition = '';

    if (period === 'week') {
      lguDateCondition =
        'AND pt.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      lguDateCondition = `
        AND MONTH(pt.created_at) = MONTH(CURRENT_DATE())
        AND YEAR(pt.created_at) = YEAR(CURRENT_DATE())
      `;
    } else if (period === 'year') {
      lguDateCondition =
        'AND YEAR(pt.created_at) = YEAR(CURRENT_DATE())';
    }

    const sql = `
      SELECT
        pt.transaction_id,
        pt.user_id,
        TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
        u.email,
        pt.source_type,
        pt.source_id,
        pt.points_delta,
        NULL AS balance_after,
        pt.notes,
        pt.created_at,
        'Credit' AS transaction_type,
        a.title AS source_name

      FROM point_transactions pt

      INNER JOIN activities a
        ON pt.source_type = 'activity'
        AND pt.source_id = a.activity_id

      INNER JOIN users u
        ON pt.user_id = u.user_id

      WHERE a.created_by = ?
        AND pt.points_delta > 0

        ${lguDateCondition}

      ORDER BY pt.created_at DESC
    `;

    return db.query(
      sql,
      [req.user.user_id],
      (err, results) => {
        if (err) {
          console.error(
            'LGU SMART POINTS REPORT ERROR:',
            err
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to fetch LGU Smart Points report'
          });
        }

        const transactions = results.map((row) => ({
          ...row,
          points_delta: Number(row.points_delta || 0),
          balance_after: null
        }));

        const pointsAwarded = transactions.reduce(
          (total, row) => total + row.points_delta,
          0
        );

        return res.status(200).json({
          success: true,
          period,

          summary: {
            points_awarded: pointsAwarded,
            points_redeemed: 0,
            net_points: pointsAwarded,
            current_circulation: 0
          },

          count: transactions.length,
          transactions
        });
      }
    );
  }

  // ==========================================
  // SUPER ADMIN: SYSTEM-WIDE TRANSACTIONS
  // ==========================================
  let dateCondition = '';


  if (period === 'week') {
    dateCondition =
      'AND pt.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (period === 'month') {
    dateCondition = `
      AND MONTH(pt.created_at) = MONTH(CURRENT_DATE())
      AND YEAR(pt.created_at) = YEAR(CURRENT_DATE())
    `;
  } else if (period === 'year') {
    dateCondition =
      'AND YEAR(pt.created_at) = YEAR(CURRENT_DATE())';
  }

  // ------------------------------------------
  // SUMMARY FOR SELECTED PERIOD
  // ------------------------------------------
  const summarySql = `
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN pt.points_delta > 0
            THEN pt.points_delta
            ELSE 0
          END
        ),
        0
      ) AS points_awarded,

      COALESCE(
        SUM(
          CASE
            WHEN pt.points_delta < 0
            THEN ABS(pt.points_delta)
            ELSE 0
          END
        ),
        0
      ) AS points_redeemed

    FROM point_transactions pt

    WHERE 1 = 1
    ${dateCondition}
  `;

  // ------------------------------------------
  // CURRENT CIRCULATION
  // This is current state, so it is NOT
  // filtered by week/month/year.
  // ------------------------------------------
  const circulationSql = `
    SELECT
      COALESCE(SUM(points_balance), 0)
        AS current_circulation

    FROM users

    WHERE role = 'community_member'
  `;

  // ------------------------------------------
  // TRANSACTION HISTORY
  // ------------------------------------------
  const transactionsSql = `
    SELECT
      pt.transaction_id,
      pt.user_id,

      TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
      u.email,

      pt.source_type,
      pt.source_id,
      pt.points_delta,
      pt.balance_after,
      pt.notes,
      pt.created_at,

      CASE
        WHEN pt.points_delta > 0
          THEN 'Credit'
        WHEN pt.points_delta < 0
          THEN 'Debit'
        ELSE 'Neutral'
      END AS transaction_type,

      CASE
        WHEN pt.source_type = 'activity'
          THEN COALESCE(a.title, 'Activity')

        WHEN pt.source_type = 'redemption'
          THEN COALESCE(r.reward_name, 'Reward Redemption')

        WHEN pt.source_type = 'rank_bonus'
          THEN 'Rank Bonus'

        WHEN pt.source_type = 'monthly_bonus'
          THEN 'Monthly Benefit'

        ELSE pt.source_type
      END AS source_name

    FROM point_transactions pt

    INNER JOIN users u
      ON pt.user_id = u.user_id

    LEFT JOIN activities a
      ON pt.source_type = 'activity'
      AND pt.source_id = a.activity_id

    LEFT JOIN reward_redemptions rr
      ON pt.source_type = 'redemption'
      AND pt.source_id = rr.redemption_id

    LEFT JOIN rewards r
      ON rr.reward_id = r.reward_id

    WHERE 1 = 1
    ${dateCondition}

    ORDER BY pt.created_at DESC
  `;

  db.query(summarySql, (summaryErr, summaryRows) => {
    if (summaryErr) {
      console.error(
        'SMART POINTS SUMMARY ERROR:',
        summaryErr
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to fetch Smart Points summary',
        error: summaryErr.message
      });
    }

    db.query(
      circulationSql,
      (circulationErr, circulationRows) => {
        if (circulationErr) {
          console.error(
            'SMART POINTS CIRCULATION ERROR:',
            circulationErr
          );

          return res.status(500).json({
            success: false,
            message:
              'Failed to fetch current point circulation',
            error: circulationErr.message
          });
        }

        db.query(
          transactionsSql,
          (transactionsErr, transactionRows) => {
            if (transactionsErr) {
              console.error(
                'SMART POINTS TRANSACTIONS ERROR:',
                transactionsErr
              );

              return res.status(500).json({
                success: false,
                message:
                  'Failed to fetch Smart Points transactions',
                error: transactionsErr.message
              });
            }

            const pointsAwarded = Number(
              summaryRows[0]?.points_awarded || 0
            );

            const pointsRedeemed = Number(
              summaryRows[0]?.points_redeemed || 0
            );

            const currentCirculation = Number(
              circulationRows[0]
                ?.current_circulation || 0
            );

            return res.status(200).json({
              success: true,

              period,

              summary: {
                points_awarded: pointsAwarded,

                points_redeemed: pointsRedeemed,

                net_points:
                  pointsAwarded - pointsRedeemed,

                current_circulation:
                  currentCirculation
              },

              count: transactionRows.length,

              transactions: transactionRows.map(
                (transaction) => ({
                  ...transaction,

                  points_delta: Number(
                    transaction.points_delta || 0
                  ),

                  balance_after: Number(
                    transaction.balance_after || 0
                  )
                })
              )
            });
          }
        );
      }
    );
  });
};
// ==========================================
// MY POINTS HISTORY
// Community member only
// ==========================================
const getMyRecentPointsActivity = (req, res) => {
  const userId = req.user.user_id;

  const summarySql = `
    SELECT
      u.points_balance AS current_points,

      COALESCE(
        SUM(
          CASE
            WHEN pt.points_delta > 0
            THEN pt.points_delta
            ELSE 0
          END
        ),
        0
      ) AS total_earned,

      COALESCE(
        SUM(
          CASE
            WHEN pt.points_delta < 0
            THEN ABS(pt.points_delta)
            ELSE 0
          END
        ),
        0
      ) AS total_spent

    FROM users u

    LEFT JOIN point_transactions pt
      ON pt.user_id = u.user_id

    WHERE u.user_id = ?

    GROUP BY
      u.user_id,
      u.points_balance
  `;

  const transactionsSql = `
    SELECT
      pt.transaction_id,
      pt.source_type,
      pt.source_id,
      pt.points_delta,
      pt.balance_after,
      pt.notes,
      pt.created_at,

      CASE
        WHEN pt.points_delta > 0
          THEN 'Earned'

        WHEN pt.points_delta < 0
          THEN 'Spent'

        ELSE 'Neutral'
      END AS transaction_type,

      CASE
        WHEN pt.source_type = 'activity'
          THEN COALESCE(a.title, 'Activity Participation')

        WHEN pt.source_type = 'redemption'
          THEN COALESCE(r.reward_name, 'Reward Redemption')

        WHEN pt.source_type = 'rank_bonus'
          THEN 'Rank Bonus'

        WHEN pt.source_type = 'monthly_bonus'
          THEN 'Monthly Rank Benefit'

        ELSE COALESCE(pt.notes, pt.source_type)
      END AS source_name

    FROM point_transactions pt

    LEFT JOIN activities a
      ON pt.source_type = 'activity'
      AND pt.source_id = a.activity_id

    LEFT JOIN reward_redemptions rr
      ON pt.source_type = 'redemption'
      AND pt.source_id = rr.redemption_id

    LEFT JOIN rewards r
      ON rr.reward_id = r.reward_id

    WHERE pt.user_id = ?

    ORDER BY pt.created_at DESC
  `;

  db.query(summarySql, [userId], (summaryErr, summaryRows) => {
    if (summaryErr) {
      console.error('MY POINTS SUMMARY ERROR:', summaryErr);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch points summary',
        error: summaryErr.message
      });
    }

    db.query(
      transactionsSql,
      [userId],
      (transactionsErr, transactionRows) => {
        if (transactionsErr) {
          console.error(
            'MY POINTS HISTORY ERROR:',
            transactionsErr
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to fetch points history',
            error: transactionsErr.message
          });
        }

        const summary = summaryRows[0] || {};

        return res.status(200).json({
          success: true,

          summary: {
            current_points: Number(
              summary.current_points || 0
            ),

            total_earned: Number(
              summary.total_earned || 0
            ),

            total_spent: Number(
              summary.total_spent || 0
            )
          },

          count: transactionRows.length,

          transactions: transactionRows.map(
            (transaction) => ({
              ...transaction,

              points_delta: Number(
                transaction.points_delta || 0
              ),

              balance_after: Number(
                transaction.balance_after || 0
              )
            })
          )
        });
      }
    );
  });
};

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  getDashboardSummary,
  getActivityEngagementReport,
  getMemberEngagementReport,
  getRedemptionReport,
  getFraudReport,
  getPartnerContributionReport,
  getParticipationTrendReport,
  getSeasonLeaderboard,
  getSmartPointsTransactions,
  getMyRecentPointsActivity

};