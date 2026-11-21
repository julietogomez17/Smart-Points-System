
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;


const canLimitedLGUAccess = (req) => {
  const path = req.originalUrl
    .split('?')[0]
    .replace(/\/+$/, '');

 if (req.method === 'GET') {
  return (
    [
      '/api/auth/me',
      '/api/admin/profile',
      '/api/admin/profile/picture',
      '/api/activities',
      '/api/rewards',
      '/api/notifications',
      '/api/notifications/unread-count'
    ].includes(path) ||
      /^\/api\/activities\/[1-9]\d*$/.test(path) ||
      /^\/api\/rewards\/[1-9]\d*$/.test(path)
    );
  }

  if (req.method === 'PUT') {
  return [
    '/api/auth/change-password',
    '/api/admin/profile/picture',
    '/api/admin/profile/resubmit'
  ].includes(path);
}
// =====================================================
// ALLOW PENDING / REJECTED LGUS TO MANAGE NOTIFICATIONS
// =====================================================

if (req.method === 'PATCH') {
  return (
    path === '/api/notifications/read-all' ||
    /^\/api\/notifications\/[1-9]\d*\/read$/.test(path)
  );
}

  return false;
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No valid token provided.'
    });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Authentication is not configured.'
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(
      authHeader.substring(7),
      JWT_SECRET
    );
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }

  if (!decoded.user_id || !decoded.role) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.'
    });
  }

  req.user = decoded;

  // Preserve existing authentication for other roles.
  if (decoded.role !== 'lgu') {
    return next();
  }

  // LGU permissions must reflect current database status.
  db.query(
    `SELECT
       u.role,
       u.status AS account_status,
       l.verification_status AS lgu_status
     FROM users u
     INNER JOIN lgu_registrations l
       ON l.user_id = u.user_id
     WHERE u.user_id = ?
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [decoded.user_id],
    (error, rows) => {
      if (error) {
        console.error(
          'LGU ACCESS CHECK ERROR:',
          error.code
        );

        return res.status(500).json({
          success: false,
          message: 'Unable to check LGU account access.'
        });
      }

      const account = rows[0];

      // Inactive or suspended LGUs cannot authenticate.
      if (
        !account ||
        account.role !== 'lgu' ||
        account.account_status !== 'active'
      ) {
        return res.status(403).json({
          success: false,
          message: 'LGU account is inactive or suspended.'
        });
      }

      req.user.lgu_verification_status =
        account.lgu_status;

      // Approved LGUs retain normal role-based access.
      if (account.lgu_status === 'approved') {
        return next();
      }

      // Pending and rejected LGUs get limited access.
      if (
        !['pending', 'rejected'].includes(
          account.lgu_status
        ) ||
        !canLimitedLGUAccess(req)
      ) {
        return res.status(403).json({
          success: false,
          code: 'LGU_VERIFICATION_REQUIRED',
          verification_status: account.lgu_status,
          message:
            'LGU verification is required for this feature.'
        });
      }

      next();
    }
  );
};


const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission.'
      });
    }

    next();
  };
};

// =====================================================
// REQUIRE VERIFIED CITIZEN
// =====================================================

const requireVerifiedCitizen = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'community_member') {
    return res.status(403).json({
      success: false,
      message: 'This action is only available to citizens.'
    });
  }

  const sql = `
    SELECT
      users.status AS account_status,
      citizen_verifications.verification_status
    FROM users
    LEFT JOIN citizen_verifications
      ON users.user_id = citizen_verifications.user_id
    WHERE users.user_id = ?
      AND users.role = 'community_member'
    LIMIT 1
  `;

  db.query(sql, [req.user.user_id], (error, results) => {
    if (error) {
      console.error('Verification middleware error:', error);

      return res.status(500).json({
        success: false,
        message: 'Unable to check verification status.'
      });
    }

    const citizen = results[0];

    if (!citizen) {
      return res.status(403).json({
        success: false,
        message: 'Citizen account not found.'
      });
    }

    if (citizen.account_status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Citizen account is inactive or suspended.'
      });
    }

    if (citizen.verification_status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'LGU identity verification is required before performing this action.',
        verification_status:
          citizen.verification_status || 'pending'
      });
    }

    next();
  });
};


/* =====================================================
   CITIPOINTS - ACCOUNT REQUEST PERMISSIONS
   ===================================================== */

const requireAccountRequestAccess = (req, res, next) => {
  const userId = req.user?.user_id;
  const tokenRole = req.user?.role;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  // Exactly one existing admin is designated as Super Admin.
  const superAdminId = process.env.CITY_SUPER_ADMIN_ID;


  if (
    !superAdminId ||
    !/^[1-9]\d*$/.test(superAdminId)
  ) {
    return res.status(503).json({
      success: false,
      message: 'City Super Admin is not configured.'
    });
  }

  const sql = `
    SELECT
      u.user_id,
      u.role,
      u.status AS account_status,
      l.lgu_level,
      l.lgu_barangay,
      l.verification_status AS lgu_status,
      l.can_verify_citizens,
      l.can_verify_partners
    FROM users u
    LEFT JOIN lgu_registrations l
      ON l.user_id = u.user_id
    WHERE u.user_id = ?
    LIMIT 1
  `;

  db.query(sql, [userId], (error, results) => {
    if (error) {
      console.error(
        'ACCOUNT REQUEST ACCESS ERROR:',
        error.code
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to verify account permissions.'
      });
    }

    const account = results[0];

    if (
      !account ||
      account.role !== tokenRole ||
      account.account_status !== 'active'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Active authorized account required.'
      });
    }

    // Only the designated existing admin account.
    if (
      account.role === 'admin' &&
      String(account.user_id) === superAdminId
    ) {
      res.locals.accountRequestAccess = {
        type: 'super_admin',
        canVerifyCitizens: true,
        canVerifyPartners: true,
        canReviewLGU: true,
        barangay: null
      };

      return next();
    }

    // Other legacy admin accounts do not automatically
    // receive access to sensitive registration requests.
    if (account.role !== 'lgu') {
      return res.status(403).json({
        success: false,
        message: 'Account verification permission required.'
      });
    }

    if (account.lgu_status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'LGU approval is required.'
      });
    }

    const isBarangay = account.lgu_level === 'barangay';
    const isCity = account.lgu_level === 'city';

    const barangay =
      typeof account.lgu_barangay === 'string'
        ? account.lgu_barangay.trim()
        : '';

    const canVerifyCitizens =
      isBarangay &&
      Boolean(barangay) &&
      Number(account.can_verify_citizens) === 1;

    const canVerifyPartners =
      isCity &&
      Number(account.can_verify_partners) === 1;

    if (!canVerifyCitizens && !canVerifyPartners) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have Account Verification permission.'
      });
    }

    res.locals.accountRequestAccess = {
      type: isBarangay ? 'barangay_lgu' : 'city_lgu',
      canVerifyCitizens,
      canVerifyPartners,
      canReviewLGU: false,
      barangay: canVerifyCitizens ? barangay : null
    };

    next();
  });
};


/* =====================================================
   REQUIRE APPROVED LGU FOR ADMIN REPORTS
   ===================================================== */

const requireApprovedLguForReports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  // Admin accounts retain their existing report access.
  if (req.user.role === "admin") {
    return next();
  }

  if (req.user.role !== "lgu") {
    return res.status(403).json({
      success: false,
      message: "Reporting access is not permitted."
    });
  }

  const sql = `
    SELECT
      u.user_id,
      u.role,
      u.status,
      l.verification_status
    FROM users u
    INNER JOIN lgu_registrations l
      ON l.user_id = u.user_id
    WHERE u.user_id = ?
      AND u.role = 'lgu'
      AND u.status = 'active'
      AND l.verification_status = 'approved'
    LIMIT 1
  `;

  db.query(sql, [req.user.user_id], (error, results) => {
    if (error) {
      console.error("LGU REPORT ACCESS ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to verify LGU reporting access."
      });
    }

    if (results.length === 0) {
      return res.status(403).json({
        success: false,
        message: "An approved and active LGU account is required."
      });
    }

    next();
  });
};

// =====================================================
// REQUIRE APPROVED LGU FOR ACTIVITY MANAGEMENT
// =====================================================

const requireApprovedLguForActivities = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  // Existing Admin and Partner permissions are handled
  // separately by their routes and controllers.
  if (req.user.role !== 'lgu') {
    return next();
  }

  const sql = `
    SELECT
      u.user_id,
      l.lgu_level,
      l.lgu_barangay,
      l.lgu_office
    FROM users u
    INNER JOIN lgu_registrations l
      ON l.user_id = u.user_id
    WHERE u.user_id = ?
      AND u.role = 'lgu'
      AND u.status = 'active'
      AND l.verification_status = 'approved'
    LIMIT 1
  `;

  db.query(sql, [req.user.user_id], (error, results) => {
    if (error) {
      console.error('LGU ACTIVITY ACCESS ERROR:', error.code);

      return res.status(500).json({
        success: false,
        message: 'Unable to verify LGU activity permissions.'
      });
    }

    if (!results.length) {
      return res.status(403).json({
        success: false,
        message:
          'An approved and active LGU account is required.'
      });
    }

    // Save verified LGU information for later checks.
    res.locals.lguActivityAccess = {
      userId: results[0].user_id,
      level: results[0].lgu_level,
      barangay: results[0].lgu_barangay,
      office: results[0].lgu_office
    };

    next();
  });
};


const requireSuperAdmin = (req, res, next) => {
  const superAdminId = process.env.CITY_SUPER_ADMIN_ID;

  if (!superAdminId || !/^[1-9]\d*$/.test(superAdminId)) {
    return res.status(503).json({
      success: false,
      message: "Super Admin is not configured."
    });
  }

  if (
    !req.user ||
    req.user.role !== "admin" ||
    String(req.user.user_id) !== superAdminId
  ) {
    return res.status(403).json({
      success: false,
      message: "Super Admin access required."
    });
  }

  db.query(
    `SELECT user_id
     FROM users
     WHERE user_id = ?
       AND role = 'admin'
       AND status = 'active'
     LIMIT 1`,
    [req.user.user_id],
    (error, rows) => {
      if (error) {
        console.error("SUPER ADMIN ACCESS ERROR:", error);
        return res.status(500).json({
          success: false,
          message: "Unable to verify Super Admin access."
        });
      }

      if (!rows.length) {
        return res.status(403).json({
          success: false,
          message: "Active Super Admin account required."
        });
      }

      next();
    }
  );
};

module.exports = {
  verifyToken,
  authorizeRoles,
  requireVerifiedCitizen,
  requireAccountRequestAccess,
  requireApprovedLguForReports,
  requireApprovedLguForActivities,
  requireSuperAdmin
};