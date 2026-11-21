
const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');



// =====================================================
// DATABASE HELPERS
// =====================================================

const queryAccount = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });

const connectionQuery = (connection, sql, params = []) =>
  new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });

const getConnection = () =>
  new Promise((resolve, reject) => {
    db.getConnection((error, connection) => {
      if (error) return reject(error);
      resolve(connection);
    });
  });

const beginTransaction = (connection) =>
  new Promise((resolve, reject) => {
    connection.beginTransaction((error) => {
      if (error) return reject(error);
      resolve();
    });
  });

const commitTransaction = (connection) =>
  new Promise((resolve, reject) => {
    connection.commit((error) => {
      if (error) return reject(error);
      resolve();
    });
  });

const rollbackTransaction = (connection) =>
  new Promise((resolve) => {
    connection.rollback(() => resolve());
  });

// =====================================================
// ACCOUNT REQUEST ACCESS HELPERS
// =====================================================

const getScope = (req, res) =>
  res.locals.accountRequestAccess || null;

const canAccessType = (scope, type) => {
  if (!scope) return false;

  if (type === 'citizen') {
    return scope.canVerifyCitizens === true;
  }

  if (type === 'establishment') {
    return scope.canVerifyPartners === true;
  }

  return false;
};

const sameBarangay = (first, second) => {
  if (typeof first !== 'string' ||
      typeof second !== 'string') {
    return false;
  }

  const normalize = (value) =>
    value.trim().toLocaleLowerCase('en');

  return (
    normalize(first) !== '' &&
    normalize(first) === normalize(second)
  );
};

const canAccessRecord = (scope, type, record) => {
  if (!canAccessType(scope, type) || !record) {
    return false;
  }

  if (scope.type === 'super_admin') {
    return true;
  }

  if (type === 'citizen') {
    return (
      scope.type === 'barangay_lgu' &&
      sameBarangay(record.barangay, scope.barangay)
    );
  }

  return (
    type === 'establishment' &&
    scope.type === 'city_lgu'
  );
};

const documents = {
  citizen: {
    id_front: ['citizen_verifications', 'user_id', 'id_front', 'id_front_type'],
    id_back: ['citizen_verifications', 'user_id', 'id_back', 'id_back_type']
  },
  establishment: {
    business_permit: [
      'partners',
      'partner_id',
      'business_permit_file',
      'business_permit_type'
    ],
    storefront_photo: [
      'partners',
      'partner_id',
      'storefront_photo',
      'storefront_photo_type'
    ],
    representative_id: [
      'partners',
      'partner_id',
      'representative_id_file',
      'representative_id_mime'
    ]
  }
};

const validId = (id) => /^[1-9]\d*$/.test(String(id));

// =====================================================
// GET ACCOUNT REQUESTS - ROLE AND BARANGAY FILTERED
// =====================================================

exports.getAccountRequests = async (req, res) => {
  const scope = getScope(req, res);

  if (!scope) {
    return res.status(403).json({
      message: 'Account verification permission required.'
    });
  }

  try {
    const requests = [];

    if (scope.canVerifyCitizens) {
      let citizenSql = `
        SELECT
          u.user_id AS id,
          u.user_id,
         

TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
u.email,


          u.email,
          u.phone,
          u.barangay,
          u.created_at,
          'citizen' AS account_type,
          cv.verification_status AS status,
          NULL AS organization_name,
          CASE WHEN NOT EXISTS (
            SELECT 1
            FROM lgu_registrations l
            JOIN users verifier
              ON verifier.user_id = l.user_id
            WHERE l.lgu_level = 'barangay'
              AND l.verification_status = 'approved'
              AND l.can_verify_citizens = 1
              AND verifier.role = 'lgu'
              AND verifier.status = 'active'
              AND LOWER(TRIM(l.lgu_barangay)) =
                  LOWER(TRIM(u.barangay))
          ) THEN 1 ELSE 0 END AS needs_super_admin_attention
        FROM users u
        INNER JOIN citizen_verifications cv
          ON cv.user_id = u.user_id
        WHERE u.role = 'community_member'
      `;

      const citizenParams = [];

      if (scope.type === 'barangay_lgu') {
        citizenSql += `
          AND LOWER(TRIM(u.barangay)) = LOWER(TRIM(?))
        `;
        citizenParams.push(scope.barangay);
      }

      const citizens = await queryAccount(
        citizenSql,
        citizenParams
      );

      requests.push(...citizens);
    }

    if (scope.canVerifyPartners) {
      const partners = await queryAccount(`
        SELECT
          p.partner_id AS id,
          u.user_id,


TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
u.email,

          u.email,
          u.phone,
          p.business_barangay AS barangay,
          u.created_at,
          'establishment' AS account_type,
          p.status AS status,
          p.organization_name,
          0 AS needs_super_admin_attention
        FROM partners p
        INNER JOIN users u
          ON u.user_id = p.user_id
        WHERE u.role = 'partner'
      `);

      requests.push(...partners);
    }

    const normalized = requests.map((request) => ({
      ...request,
      status:
        request.account_type === 'citizen' &&
        request.status === 'verified'
          ? 'approved'
          : request.account_type === 'establishment' &&
            request.status === 'active'
            ? 'approved'
            : request.status,
      needs_super_admin_attention:
        Number(request.needs_super_admin_attention) === 1 &&
        request.status === 'pending'
    }));

    normalized.sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

    return res.status(200).json({
      success: true,
      requests: normalized,
      summary: {
        pending: normalized.filter(
          (request) => request.status === 'pending'
        ).length,
        approved: normalized.filter(
          (request) => request.status === 'approved'
        ).length,
        rejected: normalized.filter(
          (request) => request.status === 'rejected'
        ).length
      }
    });
  } catch (error) {
    console.error('ACCOUNT REQUESTS ERROR:', error.code);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve account requests.'
    });
  }
};

// =====================================================
// FETCH ONE ACCOUNT - USED BY DETAILS AND DOCUMENTS
// =====================================================

const findAccount = async (type, id) => {
  if (type === 'citizen') {
    const rows = await queryAccount(`
      SELECT
        u.user_id AS id,
        u.user_id,


TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
u.email,

        u.email,
        u.phone,
        u.address,
        u.barangay,
        u.city,
        u.date_of_birth,
        u.created_at,
        cv.id_type,
        cv.verification_status AS status,
        (cv.id_front IS NOT NULL) AS has_id_front,
        (cv.id_back IS NOT NULL) AS has_id_back
      FROM users u
      INNER JOIN citizen_verifications cv
        ON cv.user_id = u.user_id
      WHERE u.user_id = ?
        AND u.role = 'community_member'
      LIMIT 1
    `, [id]);

    return rows[0] || null;
  }

  if (type === 'establishment') {
    const rows = await queryAccount(`
      SELECT
        p.partner_id AS id,
        u.user_id,


TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
u.email,

        u.email,
        u.phone,
        u.date_of_birth,
        u.created_at,
        p.organization_name,
        p.business_permit_number,
        p.business_address,
        p.business_barangay,
        p.business_barangay AS barangay,
        p.representative_id_type,
        p.status,
        (p.business_permit_file IS NOT NULL)
          AS has_business_permit,
        (p.storefront_photo IS NOT NULL)
          AS has_storefront_photo,
        (p.representative_id_file IS NOT NULL)
          AS has_representative_id
      FROM partners p
      INNER JOIN users u
        ON u.user_id = p.user_id
      WHERE p.partner_id = ?
        AND u.role = 'partner'
      LIMIT 1
    `, [id]);

    return rows[0] || null;
  }

  return null;
};

// =====================================================
// GET REGISTRATION DETAILS
// =====================================================

exports.getAccountRequestDetails = async (req, res) => {
  const { type, id } = req.params;
  const scope = getScope(req, res);

  if (!documents[type] || !validId(id)) {
    return res.status(400).json({
      message: 'Invalid account request.'
    });
  }

  if (!canAccessType(scope, type)) {
    return res.status(403).json({
      message: 'You cannot review this account type.'
    });
  }

  try {
    const account = await findAccount(type, id);

    if (!account) {
      return res.status(404).json({
        message: 'Registration request not found.'
      });
    }

    if (!canAccessRecord(scope, type, account)) {
      return res.status(403).json({
        message: 'This request is outside your assigned scope.'
      });
    }

    return res.json({
      success: true,
      account: {
        ...account,
        account_type: type
      }
    });
  } catch (error) {
    console.error('ACCOUNT DETAILS ERROR:', error.code);

    return res.status(500).json({
      message: 'Failed to load registration details.'
    });
  }
};

// =====================================================
// GET VERIFICATION DOCUMENT - SCOPED ACCESS
// =====================================================

exports.getAccountDocument = async (req, res) => {
  const { type, id, documentType } = req.params;
  const scope = getScope(req, res);

  if (!documents[type] || !validId(id)) {
    return res.status(400).json({
      message: 'Invalid account request.'
    });
  }

  const columns = documents[type][documentType];

  if (!columns) {
    return res.status(400).json({
      message: 'Invalid document type.'
    });
  }

  if (!canAccessType(scope, type)) {
    return res.status(403).json({
      message: 'Document access denied.'
    });
  }

  try {
    const account = await findAccount(type, id);

    if (!account) {
      return res.status(404).json({
        message: 'Registration request not found.'
      });
    }

    if (!canAccessRecord(scope, type, account)) {
      return res.status(403).json({
        message: 'Document access denied.'
      });
    }

    // These database identifiers are from the fixed
    // server-side allowlist above, not user input.
    const [table, key, fileColumn, mimeColumn] = columns;

    const rows = await queryAccount(`
      SELECT
        ${fileColumn} AS document_data,
        ${mimeColumn} AS mime_type
      FROM ${table}
      WHERE ${key} = ?
      LIMIT 1
    `, [id]);

    const document = rows[0];

    if (!document?.document_data) {
      return res.status(404).json({
        message: 'Document not found.'
      });
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf'
    ];

    if (!allowedMimeTypes.includes(document.mime_type)) {
      return res.status(415).json({
        message: 'Unsupported document format.'
      });
    }

    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="verification-document"'
    );

    return res.send(document.document_data);
  } catch (error) {
    console.error('DOCUMENT VIEW ERROR:', error.code);

    return res.status(500).json({
      message: 'Unable to retrieve document.'
    });
  }
};

// =====================================================
// RECHECK REVIEWER PERMISSION INSIDE THE TRANSACTION
// =====================================================

const verifyReviewer = async (connection, req, type) => {
  const userId = req.user?.user_id;

  const rows = await connectionQuery(
    connection,
    `SELECT
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
     FOR UPDATE`,
    [userId]
  );

  const reviewer = rows[0];

  if (
    !reviewer ||
    reviewer.account_status !== 'active' ||
    reviewer.role !== req.user.role
  ) {
    return null;
  }

  if (
    reviewer.role === 'admin' &&
    String(reviewer.user_id) ===
      String(process.env.CITY_SUPER_ADMIN_ID || '')
  ) {
    return { type: 'super_admin' };
  }

  if (
    reviewer.role !== 'lgu' ||
    reviewer.lgu_status !== 'approved'
  ) {
    return null;
  }

  if (
    type === 'citizen' &&
    reviewer.lgu_level === 'barangay' &&
    Number(reviewer.can_verify_citizens) === 1 &&
    typeof reviewer.lgu_barangay === 'string' &&
    reviewer.lgu_barangay.trim()
  ) {
    return {
      type: 'barangay_lgu',
      barangay: reviewer.lgu_barangay
    };
  }

  if (
    type === 'establishment' &&
    reviewer.lgu_level === 'city' &&
    Number(reviewer.can_verify_partners) === 1
  ) {
    return { type: 'city_lgu' };
  }

  return null;
};

// =====================================================
// APPROVE OR REJECT ACCOUNT REQUEST
// =====================================================

exports.reviewAccountRequest = async (req, res) => {
  const { type, id, decision } = req.params;
  const { reason } = req.body || {};

  if (
    !['citizen', 'establishment'].includes(type) ||
    !['approve', 'reject'].includes(decision) ||
    !validId(id)
  ) {
    return res.status(400).json({
      message: 'Invalid account review request.'
    });
  }

  if (
    decision === 'reject' &&
    (
      typeof reason !== 'string' ||
      reason.trim().length < 5 ||
      reason.trim().length > 1000
    )
  ) {
    return res.status(400).json({
      message: 'A rejection reason of 5–1000 characters is required.'
    });
  }

  const scope = getScope(req, res);

  if (!canAccessType(scope, type)) {
    return res.status(403).json({
      message: 'You cannot review this account type.'
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await getConnection();

    await beginTransaction(connection);
    transactionStarted = true;

    // Check current database permissions again, not
    // just the JWT or permissions from an earlier request.
    const reviewer = await verifyReviewer(
      connection,
      req,
      type
    );

    if (!reviewer) {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(403).json({
        message: 'Account verification permission required.'
      });
    }

    const isCitizen = type === 'citizen';

    const sql = isCitizen
      ? `SELECT
           cv.user_id,
           u.barangay,
           cv.verification_status AS status
         FROM citizen_verifications cv
         INNER JOIN users u
           ON u.user_id = cv.user_id
         WHERE cv.user_id = ?
           AND u.role = 'community_member'
         LIMIT 1
         FOR UPDATE`
      : `SELECT
           p.user_id,
           p.business_barangay AS barangay,
           p.status
         FROM partners p
         INNER JOIN users u
           ON u.user_id = p.user_id
         WHERE p.partner_id = ?
           AND u.role = 'partner'
         LIMIT 1
         FOR UPDATE`;

    const accounts = await connectionQuery(
      connection,
      sql,
      [id]
    );

    if (!accounts.length) {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(404).json({
        message: 'Account request not found.'
      });
    }

    const account = accounts[0];

    // Barangay verifiers can ONLY review citizen
    // records belonging to their own assigned barangay.
    if (
      isCitizen &&
      reviewer.type === 'barangay_lgu' &&
      !sameBarangay(
        account.barangay,
        reviewer.barangay
      )
    ) {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(403).json({
        message: 'Citizen belongs to another barangay.'
      });
    }

    if (account.status !== 'pending') {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(409).json({
        message: 'This account has already been reviewed.'
      });
    }

    const newStatus = isCitizen
      ? (decision === 'approve' ? 'verified' : 'rejected')
      : (decision === 'approve' ? 'active' : 'rejected');

    const updateSql = isCitizen
      ? `UPDATE citizen_verifications
         SET verification_status = ?
         WHERE user_id = ?
           AND verification_status = 'pending'`
      : `UPDATE partners
         SET status = ?
         WHERE partner_id = ?
           AND status = 'pending'`;

    const result = await connectionQuery(
      connection,
      updateSql,
      [newStatus, id]
    );

    if (result.affectedRows !== 1) {
      throw new Error('Account review update failed.');
    }

    await connectionQuery(
      connection,
      `INSERT INTO account_verification_reviews
       (
         account_type,
         account_id,
         user_id,
         admin_user_id,
         decision,
         rejection_reason
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        type,
        Number(id),
        account.user_id,
        req.user.user_id,
        decision === 'approve' ? 'approved' : 'rejected',
        decision === 'reject' ? reason.trim() : null
      ]
    );



await logAudit({
  actorUserId: req.user.user_id,
  actionType: decision === 'approve' ? 'APPROVE' : 'REJECT',
  entityType: type === 'citizen' ? 'citizen_account' : 'partner_account',
  entityId: account.user_id,
  details: JSON.stringify({
    account_type: type,
    account_user_id: account.user_id,
    previous_status: account.status,
    new_status: newStatus,
    reviewed_by: reviewer.type
  }),
  connection
});

  // =====================================================
// NOTIFY CITIZEN / ESTABLISHMENT ABOUT ACCOUNT REVIEW
// =====================================================

const accountLabel = isCitizen
  ? 'Citizen'
  : 'Establishment';

const approved = decision === 'approve';

await connectionQuery(
  connection,
  `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      reference_type,
      reference_id
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  [
    account.user_id,
    'account',

    approved
      ? `${accountLabel} Verification Approved`
      : `${accountLabel} Verification Rejected`,

    approved
      ? `Your ${accountLabel.toLowerCase()} verification has been approved successfully.`
      : `Your ${accountLabel.toLowerCase()} verification was rejected. Reason: ${reason.trim()}. Please review your information and resubmit your verification.`,

    type,
    Number(id)
  ]
);
    await commitTransaction(connection);
    transactionStarted = false;

    return res.json({
      success: true,
      message:
        decision === 'approve'
          ? 'Account approved successfully.'
          : 'Account rejected successfully.',
      status: newStatus
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await rollbackTransaction(connection);
    }

    console.error('ACCOUNT REVIEW ERROR:', error.code);

    return res.status(500).json({
      message: 'Unable to process the account review.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};



/* =====================================================
   LGU REGISTRATION APPROVAL — CITY SUPER ADMIN ONLY
===================================================== */

// This check is in addition to the route middleware.
const requireLGUSuperAdmin = (req, res) => {
  const scope = res.locals.accountRequestAccess;
  const configuredId = process.env.CITY_SUPER_ADMIN_ID;

  return (
    scope?.type === 'super_admin' &&
    req.user?.role === 'admin' &&
    String(req.user?.user_id) === String(configuredId || '')
  );
};

const lguQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });

const validLGURequestId = (id) =>
  /^[1-9]\d*$/.test(String(id));

// -----------------------------------------------------
// GET ALL LGU REGISTRATION REQUESTS
// -----------------------------------------------------

exports.getLGUAccountRequests = async (req, res) => {
  if (!requireLGUSuperAdmin(req, res)) {
    return res.status(403).json({
      message: 'City Super Admin access required.'
    });
  }

  try {
    const requests = await lguQuery(`
      SELECT
        l.lgu_registration_id AS id,
        l.lgu_registration_id,
        l.user_id,

TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,

        u.email,
        u.phone,
        u.date_of_birth,
        l.lgu_level,
        l.lgu_barangay,
        l.lgu_barangay AS barangay,
        l.lgu_office,
        l.lgu_office_address,
        l.lgu_office_contact,
        l.lgu_designation,
        l.verification_status AS status,
        l.can_verify_citizens,
        l.can_verify_partners,
        l.created_at,
        'lgu' AS account_type
      FROM lgu_registrations l
      INNER JOIN users u ON u.user_id = l.user_id
      WHERE u.role = 'lgu'
      ORDER BY l.created_at DESC, l.lgu_registration_id DESC
    `);

    return res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('LGU REQUEST LIST ERROR:', error.code);

    return res.status(500).json({
      message: 'Unable to load LGU registration requests.'
    });
  }
};

// -----------------------------------------------------
// GET ONE LGU REGISTRATION
// -----------------------------------------------------

exports.getLGUAccountDetails = async (req, res) => {
  if (!requireLGUSuperAdmin(req, res)) {
    return res.status(403).json({
      message: 'City Super Admin access required.'
    });
  }

  const { id } = req.params;

  if (!validLGURequestId(id)) {
    return res.status(400).json({
      message: 'Invalid LGU registration ID.'
    });
  }

  try {
    const rows = await lguQuery(`
      SELECT
        l.lgu_registration_id AS id,
        l.user_id,

TRIM(CONCAT_WS(' ',
    NULLIF(u.first_name, ''),
    NULLIF(u.middle_name, ''),
    NULLIF(u.last_name, ''),
    NULLIF(u.suffix, '')
)) AS full_name,
u.email,
        u.phone,
        u.date_of_birth,
        u.status AS account_status,
        l.lgu_level,
        l.lgu_barangay,
        l.lgu_barangay AS barangay,
        l.lgu_office,
        l.lgu_office_address,
        l.lgu_office_contact,
        l.lgu_designation,
        l.verification_status AS status,
        l.can_verify_citizens,
        l.can_verify_partners,
        l.reviewed_by,
        l.reviewed_at,
        l.rejection_reason,
        l.created_at,
        (l.loi_file IS NOT NULL) AS has_lgu_loi,
        (l.representative_id_file IS NOT NULL) AS has_lgu_id,
        'lgu' AS account_type
      FROM lgu_registrations l
      INNER JOIN users u ON u.user_id = l.user_id
      WHERE l.lgu_registration_id = ?
        AND u.role = 'lgu'
      LIMIT 1
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({
        message: 'LGU registration not found.'
      });
    }

    return res.json({
      success: true,
      account: rows[0]
    });
  } catch (error) {
    console.error('LGU REQUEST DETAILS ERROR:', error.code);

    return res.status(500).json({
      message: 'Unable to load LGU registration details.'
    });
  }
};

// -----------------------------------------------------
// VIEW SUBMITTED LOI OR REPRESENTATIVE ID
// -----------------------------------------------------

exports.getLGUAccountDocument = async (req, res) => {
  if (!requireLGUSuperAdmin(req, res)) {
    return res.status(403).json({
      message: 'City Super Admin access required.'
    });
  }

  const { id, documentType } = req.params;

  if (!validLGURequestId(id)) {
    return res.status(400).json({
      message: 'Invalid LGU registration ID.'
    });
  }

  const documents = {
    lgu_loi: ['loi_file', 'loi_file_type'],
    lgu_id: ['representative_id_file', 'representative_id_type']
  };

  const columns = documents[documentType];

  if (!columns) {
    return res.status(400).json({
      message: 'Invalid LGU document type.'
    });
  }

  const [fileColumn, mimeColumn] = columns;

  try {
    const rows = await lguQuery(`
      SELECT
        ${fileColumn} AS document_data,
        ${mimeColumn} AS mime_type
      FROM lgu_registrations
      WHERE lgu_registration_id = ?
      LIMIT 1
    `, [id]);

    const document = rows[0];

    if (!document?.document_data) {
      return res.status(404).json({
        message: 'LGU document not found.'
      });
    }

    if (![
      'application/pdf',
      'image/jpeg',
      'image/png'
    ].includes(document.mime_type)) {
      return res.status(415).json({
        message: 'Unsupported document format.'
      });
    }

    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="lgu-verification-document"'
    );

    return res.send(document.document_data);
  } catch (error) {
    console.error('LGU DOCUMENT ERROR:', error.code);

    return res.status(500).json({
      message: 'Unable to retrieve LGU document.'
    });
  }
};

// -----------------------------------------------------
// APPROVE OR REJECT LGU REGISTRATION
// -----------------------------------------------------

exports.reviewLGUAccountRequest = async (req, res) => {
  if (!requireLGUSuperAdmin(req, res)) {
    return res.status(403).json({
      message: 'City Super Admin access required.'
    });
  }

  const { id, decision } = req.params;
  const body = req.body || {};

  if (
    !validLGURequestId(id) ||
    !['approve', 'reject'].includes(decision)
  ) {
    return res.status(400).json({
      message: 'Invalid LGU review request.'
    });
  }

  const reason =
    typeof body.reason === 'string'
      ? body.reason.trim()
      : '';

  if (
    decision === 'reject' &&
    (reason.length < 5 || reason.length > 1000)
  ) {
    return res.status(400).json({
      message: 'A rejection reason of 5–1000 characters is required.'
    });
  }

  if (
    decision === 'approve' &&
    (
      !['boolean'].includes(typeof body.can_verify_citizens) ||
      !['boolean'].includes(typeof body.can_verify_partners)
    )
  ) {
    return res.status(400).json({
      message: 'Select the LGU verification permissions.'
    });
  }

  let connection;
  let transactionStarted = false;

  const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      connection.query(sql, params, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });

  try {
    connection = await new Promise((resolve, reject) => {
      db.getConnection((error, conn) => {
        if (error) return reject(error);
        resolve(conn);
      });
    });
    
    await run('START TRANSACTION');
    transactionStarted = true;

    // Confirm the Super Admin is still active.
    const reviewers = await run(`
      SELECT user_id
      FROM users
      WHERE user_id = ?
        AND role = 'admin'
        AND status = 'active'
      LIMIT 1
      FOR UPDATE
    `, [req.user.user_id]);

    if (!reviewers.length) {
      await run('ROLLBACK');
      transactionStarted = false;

      return res.status(403).json({
        message: 'Active City Super Admin account required.'
      });
    }

const rows = await run(`
  SELECT
    l.user_id,
    l.lgu_level,
    l.lgu_barangay,
    l.lgu_office,
    l.verification_status,
    u.role
      FROM lgu_registrations l
      INNER JOIN users u ON u.user_id = l.user_id
      WHERE l.lgu_registration_id = ?
      LIMIT 1
      FOR UPDATE
    `, [id]);

    if (!rows.length) {
      await run('ROLLBACK');
      transactionStarted = false;

      return res.status(404).json({
        message: 'LGU application not found.'
      });
    }

    const application = rows[0];

    if (
      application.role !== 'lgu' ||
      application.verification_status !== 'pending'
    ) {
      await run('ROLLBACK');
      transactionStarted = false;

      return res.status(409).json({
        message: 'This LGU application is no longer pending.'
      });
    }

    const isBarangay = application.lgu_level === 'barangay';
    const isCity = application.lgu_level === 'city';

    if (!isBarangay && !isCity) {
      await run('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        message: 'Invalid registered LGU level.'
      });
    }

    if (
      isBarangay &&
      !String(application.lgu_barangay || '').trim()
    ) {
      await run('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        message: 'Barangay assignment is required.'
      });
    }


    // =================================================
// PREVENT APPROVAL OF DUPLICATE LGU OFFICES
// =================================================

if (decision === 'approve') {
  const duplicateOffices = await run(
    `SELECT lgu_registration_id
     FROM lgu_registrations
     WHERE lgu_registration_id <> ?
       AND lgu_level = ?
       AND (
         ? = 'city'
         OR LOWER(TRIM(lgu_barangay)) =
            LOWER(TRIM(?))
       )
       AND LOWER(
         REGEXP_REPLACE(
           TRIM(lgu_office),
           '[[:space:]]+',
           ' '
         )
       ) = LOWER(
         REGEXP_REPLACE(
           TRIM(?),
           '[[:space:]]+',
           ' '
         )
       )
       AND verification_status = 'approved'
     LIMIT 1`,
    [
      id,
      application.lgu_level,
      application.lgu_level,
      application.lgu_barangay || '',
      application.lgu_office
    ]
  );

  if (duplicateOffices.length > 0) {
    await run('ROLLBACK');
    transactionStarted = false;

    return res.status(409).json({
      success: false,
      message:
        'This LGU office already has an approved account. ' +
        'Only one official account is allowed per office.'
    });
  }
}
    // Barangay representatives may verify Citizens.
    // City representatives may verify Partners.
    const canVerifyCitizens =
      decision === 'approve' &&
      isBarangay &&
      body.can_verify_citizens === true;

    const canVerifyPartners =
      decision === 'approve' &&
      isCity &&
      body.can_verify_partners === true;

    if (
      decision === 'approve' &&
      (
        (isCity && body.can_verify_citizens === true) ||
        (isBarangay && body.can_verify_partners === true)
      )
    ) {
      await run('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        message: 'Permission does not match the LGU level.'
      });
    }

    const newStatus =
      decision === 'approve' ? 'approved' : 'rejected';

    await run(`
      UPDATE lgu_registrations
      SET
        verification_status = ?,
        can_verify_citizens = ?,
        can_verify_partners = ?,
        reviewed_by = ?,
        reviewed_at = NOW(),
        rejection_reason = ?
      WHERE lgu_registration_id = ?
        AND verification_status = 'pending'
    `, [
      newStatus,
      canVerifyCitizens ? 1 : 0,
      canVerifyPartners ? 1 : 0,
      req.user.user_id,
      decision === 'reject' ? reason : null,
      id
    ]);

   // Rejected LGU applicants retain their login access.
// Existing inactive pending accounts can be activated
// when the Super Admin approves their registration.

if (decision === 'approve') {
  await run(`
    UPDATE users
    SET status = 'active'
    WHERE user_id = ?
      AND role = 'lgu'
      AND status = 'inactive'
  `, [application.user_id]);
}

 


await logAudit({
  actorUserId: req.user.user_id,
  actionType: decision === 'approve' ? 'APPROVE' : 'REJECT',
  entityType: 'lgu_account',
  entityId: application.user_id,
  details: JSON.stringify({
    lgu_registration_id: Number(id),
    lgu_level: application.lgu_level,
    lgu_office: application.lgu_office,
    previous_status: application.verification_status,
    new_status: newStatus,
    can_verify_citizens: canVerifyCitizens,
    can_verify_partners: canVerifyPartners
  }),
  connection
});


    // =====================================================
    // NOTIFY LGU — APPLICATION APPROVED OR REJECTED
    // =====================================================

    const notificationTitle =
      decision === 'approve'
        ? 'LGU Registration Approved'
        : 'LGU Registration Rejected';

    const notificationMessage =
      decision === 'approve'
        ? `Your LGU registration for "${application.lgu_office}" has been approved by the City Super Admin.`
        : `Your LGU registration for "${application.lgu_office}" has been rejected. Reason: ${reason}. Please correct your application and resubmit it for review.`;

    await run(
      `
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          reference_type,
          reference_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        application.user_id,
        'account',
        notificationTitle,
        notificationMessage,
        'lgu_registration',
        Number(id)
      ]
    );

    await run('COMMIT');
    transactionStarted = false;

    return res.json({
      success: true,
      message:
        decision === 'approve'
          ? 'LGU account approved successfully.'
          : 'LGU registration rejected successfully.',
      status: newStatus,
      permissions: {
        can_verify_citizens: canVerifyCitizens,
        can_verify_partners: canVerifyPartners
      }
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await run('ROLLBACK');
      } catch (rollbackError) {
        console.error('LGU ROLLBACK ERROR:', rollbackError.code);
      }
    }

    console.error('LGU REVIEW ERROR:', {
  code: error.code,
  message: error.message,
  sqlMessage: error.sqlMessage,
  sqlState: error.sqlState
});

    return res.status(500).json({
      message: 'Unable to review LGU registration.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
