
const db = require('../config/db');

const requireVerifiedCitizen = (req, res, next) => {
  const userId = req.user?.user_id;

  if (!userId) {
    return res.status(401).json({
      message: 'Authentication required.'
    });
  }

  const sql = `
    SELECT
      u.status AS account_status,
      cv.verification_status
    FROM users u
    LEFT JOIN citizen_verifications cv
      ON cv.user_id = u.user_id
    WHERE u.user_id = ?
      AND u.role = 'community_member'
    LIMIT 1
  `;

  db.query(sql, [userId], (error, results) => {
    if (error) {
      console.error('Verification check error:', error.code);

      return res.status(500).json({
        message: 'Unable to verify account status.'
      });
    }

    if (!results.length) {
      return res.status(403).json({
        message: 'Citizen account not found.'
      });
    }

    const citizen = results[0];

    if (citizen.account_status !== 'active') {
      return res.status(403).json({
        message: 'Your account is inactive or suspended.'
      });
    }

    if (citizen.verification_status !== 'verified') {
      return res.status(403).json({
        message:
          'Your account must be verified by the LGU Administrator before you can register for activities or submit participation proof.'
      });
    }

    next();
  });
};

module.exports = requireVerifiedCitizen;
