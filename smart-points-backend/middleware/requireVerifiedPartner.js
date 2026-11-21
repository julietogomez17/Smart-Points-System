
const db = require('../config/db');

const requireVerifiedPartner = (req, res, next) => {
  const userId = req.user?.user_id;

  if (!userId) {
    return res.status(401).json({
      message: 'Authentication required.'
    });
  }

  const sql = `
    SELECT
      u.status AS account_status,
      p.status AS partner_status
    FROM users u
    INNER JOIN partners p
      ON p.user_id = u.user_id
    WHERE u.user_id = ?
      AND u.role = 'partner'
    LIMIT 1
  `;

  db.query(sql, [userId], (error, results) => {
    if (error) {
      console.error('Partner verification error:', error.code);

      return res.status(500).json({
        message: 'Unable to verify establishment status.'
      });
    }

    if (!results.length) {
      return res.status(403).json({
        message: 'Establishment account not found.'
      });
    }

    const partner = results[0];

    if (
      partner.account_status !== 'active' ||
      partner.partner_status !== 'active'
    ) {
      return res.status(403).json({
        message:
          'Your establishment must be approved by the LGU Administrator before you can perform this action.'
      });
    }

    next();
  });
};

module.exports = requireVerifiedPartner;
