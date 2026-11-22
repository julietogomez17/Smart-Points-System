
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const {sendVerificationEmail,sendPasswordResetEmail} = require('../utils/emailService');

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const generateEmailOTP = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, '0');

const hashEmailOTP = (userId, otp) => {
  const secret = process.env.OTP_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('OTP_SECRET must contain at least 32 characters.');
  }

  return crypto
    .createHmac('sha256', secret)
    .update(`${userId}:${otp}`)
    .digest('hex');
};

const issueEmailOTP = async (connection, userId, email) => {
  const otp = generateEmailOTP();
  const otpHash = hashEmailOTP(userId, otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await runQuery(
    connection,
    `INSERT INTO email_verification_otps
       (user_id, otp_hash, expires_at, attempts, last_sent_at)
     VALUES (?, ?, ?, 0, NOW())
     ON DUPLICATE KEY UPDATE
       otp_hash = VALUES(otp_hash),
       expires_at = VALUES(expires_at),
       attempts = 0,
       last_sent_at = NOW()`,
    [userId, otpHash, expiresAt]
  );

  await sendVerificationEmail(email, otp);
};


const JWT_SECRET = process.env.JWT_SECRET;

const ID_TYPES = [
  'national_id',
  'drivers_license',
  'voters_id',
  'senior_citizen_id',
  'other'
];

const BARANGAYS = [
  'Alang-Alang', 'Bakilid', 'Banilad', 'Basak',
  'Cabancalan', 'Cambaro', 'Canduman', 'Casili',
  'Casuntingan', 'Centro', 'Cubacub', 'Guizo',
  'Ibabao-Estancia', 'Jagobiao', 'Labogon',
  'Looc', 'Maguikay', 'Mantuyong', 'Opao',
  'Pagsabungan', 'Paknaan', 'Subangdaku',
  'Tabok', 'Tawason', 'Tingub', 'Tipolo',
  'Umapad'
];

const clean = (value) =>
  typeof value === 'string' ? value.trim() : '';

// =====================================================
// DATABASE HELPERS
// =====================================================

const runQuery = (connection, sql, params = []) =>
  new Promise((resolve, reject) => {
    connection.query(sql, params, (error, result) => {
      if (error) return reject(error);
      resolve(result);
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
// DOCUMENT VALIDATION
// =====================================================

const validDocument = (file) => {
  if (!file || !file.buffer) return false;

  if (
    file.buffer.length === 0 ||
    file.buffer.length > 5 * 1024 * 1024
  ) {
    return false;
  }

  const buffer = file.buffer;

  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const png =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([
        137, 80, 78, 71, 13, 10, 26, 10
      ])
    );

  const pdf =
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString() === '%PDF-';

  return (
    (file.mimetype === 'image/jpeg' && jpeg) ||
    (file.mimetype === 'image/png' && png) ||
    (file.mimetype === 'application/pdf' && pdf)
  );
};

// =====================================================
// DUPLICATE ID DETECTION
// =====================================================

const hashDocument = (file) => {
  if (!file || !file.buffer) return null;

  return crypto
    .createHash('sha256')
    .update(file.buffer)
    .digest('hex');
};

const checkDuplicateID = async (
  connection,
  frontHash,
  backHash
) => {
  const hashes = [frontHash, backHash].filter(Boolean);

  if (hashes.length === 0) return false;

  const placeholders = hashes.map(() => '?').join(', ');

  const sql = `
    SELECT verification_id
    FROM citizen_verifications
    WHERE id_front_hash IN (${placeholders})
       OR id_back_hash IN (${placeholders})
    LIMIT 1
  `;

  const results = await runQuery(
    connection,
    sql,
    [...hashes, ...hashes]
  );

  return results.length > 0;
};

// =====================================================
// REGISTER
// =====================================================

exports.register = async (req, res) => {
  const body = req.body || {};

  const firstName = clean(body.first_name);
  const middleName = clean(body.middle_name);
  const lastName = clean(body.last_name);
  const suffix = clean(body.suffix);
  const idNumber = clean(body.id_number);

  const fullName = [
    firstName,
    middleName,
    lastName,
    suffix
  ].filter(Boolean).join(' ');

  const email = clean(body.email).toLowerCase();
  const phone = clean(body.phone);
  const password = body.password;
  const role = clean(body.role);
  const dateOfBirth = clean(body.date_of_birth);

 const isCitizen = role === 'community_member';
const isPartner = role === 'partner';
const isLGU = role === 'lgu';

// Only these roles can register publicly.
// Existing administrator accounts are not public registration roles.
if (!['community_member', 'partner', 'lgu'].includes(role)) {
  return res.status(403).json({
    message: 'Invalid registration account type.'
  });
}

  // Validate personal information
  if (!firstName || !lastName || !email || !phone) {
    return res.status(400).json({
      message: 'Complete all required personal information.'
    });
  }

  if (
  idNumber.length < 3 ||
  idNumber.length > 50 ||
  !/^[A-Za-z0-9][A-Za-z0-9 /-]*[A-Za-z0-9]$/.test(idNumber)
) {
  return res.status(400).json({
    message: 'A valid ID number is required (3–50 characters).'
  });
}

  // Validate name format: no numbers or invalid symbols
const validPersonName = (name) =>
  /^[\p{L}][\p{L}\p{M} .'-]*$/u.test(name);

if (
  !validPersonName(firstName) ||
  !validPersonName(lastName) ||
  (middleName && !validPersonName(middleName))
) {
  return res.status(400).json({
    message: 'Names must contain letters and valid name punctuation only.'
  });
}
  if (
    firstName.length > 100 ||
    middleName.length > 100 ||
    lastName.length > 100 ||
    suffix.length > 10 ||
    fullName.length > 150
  ) {
    return res.status(400).json({
      message: 'One or more name fields are too long.'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      message: 'Invalid email address.'
    });
  }

  if (!/^09\d{9}$/.test(phone)) {
    return res.status(400).json({
      message: 'Enter a valid Philippine mobile number.'
    });
  }

  if (
    typeof password !== 'string' ||
    password.length < 8
  ) {
    return res.status(400).json({
      message: 'Password must contain at least 8 characters.'
    });
  }

  const address = isCitizen ? clean(body.address) : null;
  const barangay = isCitizen ? clean(body.barangay) : null;
  const city = isCitizen ? 'Mandaue City' : null;

  const front = req.files?.id_front?.[0];
  const back = req.files?.id_back?.[0];
  const businessPermit = req.files?.business_permit?.[0];
const storefrontPhoto = req.files?.storefront_photo?.[0];
const representativeId = req.files?.representative_id?.[0];

const partnerName = clean(body.partner_name);
const businessPermitNumber = clean(body.business_permit_number);
const businessAddress = clean(body.business_address);
const businessBarangay = clean(body.business_barangay);
const representativeIdType = clean(body.representative_id_type);
// CUSTOM ID TYPE (OTHERS)
const otherIdType = clean(body.other_id_type);

const validOtherIdType =
  otherIdType.length >= 3 &&
  otherIdType.length <= 40 &&
  /^[\p{L}\p{M}][\p{L}\p{M}0-9 .()'/-]*$/u.test(otherIdType);

const resolveIdType = (selectedType) => {
  if (selectedType === 'other') {
    return `Other: ${otherIdType}`;
  }

  return selectedType;
};

// LGU registration information
const lguLevel = clean(body.lgu_level);
const lguBarangay = clean(body.lgu_barangay);
const lguOffice = clean(body.lgu_office);
const lguOfficeAddress = clean(body.lgu_office_address);
const lguOfficeContact = clean(body.lgu_office_contact);
const lguDesignation = clean(body.lgu_designation);

// LGU uploaded documents
const lguLOI = req.files?.lgu_loi?.[0];
const lguId = req.files?.lgu_id?.[0];

  let frontHash = null;
  let backHash = null;

// ===================================================
// DATE OF BIRTH VALIDATION
// Required for all public registration roles
// ===================================================

if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
  return res.status(400).json({
    message: 'A valid date of birth is required.'
  });
}

const [year, month, day] = dateOfBirth.split('-').map(Number);

const parsedDate = new Date(Date.UTC(year, month - 1, day));

const validDate =
  parsedDate.getUTCFullYear() === year &&
  parsedDate.getUTCMonth() === month - 1 &&
  parsedDate.getUTCDate() === day;

const today = new Date();

const todayUTC = Date.UTC(
  today.getFullYear(),
  today.getMonth(),
  today.getDate()
);

if (!validDate || parsedDate.getTime() > todayUTC) {
  return res.status(400).json({
    message: 'Enter a valid date of birth that is not in the future.'
  });
}

  if (isCitizen) {
    if (!address || address.length > 255) {
      return res.status(400).json({
        message: 'Enter a valid residential address.'
      });
    }

    if (!BARANGAYS.includes(barangay)) {
      return res.status(400).json({
        message: 'Select a valid Mandaue City barangay.'
      });
    }

    if (!ID_TYPES.includes(body.id_type)) {
      return res.status(400).json({
        message: 'Select an accepted government ID.'
      });
    }
    // VALIDATE SPECIFIED CITIZEN ID TYPE
if (body.id_type === 'other' && !validOtherIdType) {
  return res.status(400).json({
    message: 'Please specify a valid government-issued ID type.'
  });
}

    if (!validDocument(front)) {
      return res.status(400).json({
        message: 'A valid front ID document is required.'
      });
    }

 // Require a valid back ID document for citizen registration
if (!validDocument(back)) {
  return res.status(400).json({
    message: 'A valid back ID document is required.'
  });
}

    if (
      body.residency_declaration !== 'true' ||
      body.privacy_acknowledgment !== 'true'
    ) {
      return res.status(400).json({
        message: 'Please complete the required declarations.'
      });
    }

    // Generate SHA-256 hashes
    frontHash = hashDocument(front);
    backHash = hashDocument(back);

    if (frontHash && backHash && frontHash === backHash) {
  return res.status(400).json({
    message:
      'The front and back ID images cannot be identical. ' +
      'Please upload the correct images.'
  });
}

  } else if (isPartner) {
  // PARTNER REGISTRATION VALIDATION

  if (!partnerName || partnerName.length > 150) {
    return res.status(400).json({
      message: 'Enter a valid establishment name.'
    });
  }

  if (
    !businessPermitNumber ||
    businessPermitNumber.length > 100
  ) {
    return res.status(400).json({
      message: 'Enter a valid business permit number.'
    });
  }

  if (
    !businessAddress ||
    businessAddress.length > 255
  ) {
    return res.status(400).json({
      message: 'Enter a valid business address.'
    });
  }

  if (!BARANGAYS.includes(businessBarangay)) {
    return res.status(400).json({
      message: 'Select a valid Mandaue City business barangay.'
    });
  }

  if (!ID_TYPES.includes(representativeIdType)) {
    return res.status(400).json({
      message: 'Select an accepted representative ID type.'
    });
  }
  // VALIDATE SPECIFIED REPRESENTATIVE ID TYPE
if (representativeIdType === 'other' && !validOtherIdType) {
  return res.status(400).json({
    message: 'Please specify a valid representative ID type.'
  });
}

  if (!validDocument(businessPermit)) {
    return res.status(400).json({
      message: 'A valid business permit is required.'
    });
  }

  if (!validDocument(storefrontPhoto)) {
    return res.status(400).json({
      message: 'A valid storefront photo is required.'
    });
  }

  if (!['image/jpeg', 'image/png'].includes(
    storefrontPhoto.mimetype
  )) {
    return res.status(400).json({
      message: 'Storefront photo must be JPG or PNG.'
    });
  }

  if (!validDocument(representativeId)) {
    return res.status(400).json({
      message: 'A valid representative ID is required.'
    });
  }

  if (body.privacy_acknowledgment !== 'true') {
    return res.status(400).json({
      message: 'Please acknowledge the privacy notice.'
    });
  }

  if (front || back) {
    return res.status(400).json({
      message: 'Unexpected citizen ID upload.'
    });
  }
}


  // ===================================================
  // LGU REGISTRATION VALIDATION
  // ===================================================

  if (isLGU) {
    if (!['city', 'barangay'].includes(lguLevel)) {
      return res.status(400).json({
        message: 'Select a valid LGU level.'
      });
    }

    if (
      lguLevel === 'barangay' &&
      !BARANGAYS.includes(lguBarangay)
    ) {
      return res.status(400).json({
        message: 'Select a valid Mandaue City barangay.'
      });
    }

    if (!lguOffice || lguOffice.length > 150) {
      return res.status(400).json({
        message: 'A valid LGU office or unit is required.'
      });
    }

    if (
      !lguOfficeAddress ||
      lguOfficeAddress.length > 255
    ) {
      return res.status(400).json({
        message: 'Enter a valid official office address.'
      });
    }

    if (
      !lguOfficeContact ||
      lguOfficeContact.length > 50
    ) {
      return res.status(400).json({
        message: 'Enter a valid office contact number.'
      });
    }

    if (
      !lguDesignation ||
      lguDesignation.length > 150
    ) {
      return res.status(400).json({
        message: 'Enter a valid official designation.'
      });
    }

    if (!validDocument(lguLOI)) {
      return res.status(400).json({
        message: 'Upload a valid signed Letter of Intent.'
      });
    }

    if (!validDocument(lguId)) {
      return res.status(400).json({
        message: 'Upload a valid government or employee ID.'
      });
    }

    if (
      body.lgu_authorization !== 'true' ||
      body.privacy_acknowledgment !== 'true'
    ) {
      return res.status(400).json({
        message: 'Complete the authorization and privacy acknowledgments.'
      });
    }

    if (
      front ||
      back ||
      businessPermit ||
      storefrontPhoto ||
      representativeId
    ) {
      return res.status(400).json({
        message: 'Unexpected documents for LGU registration.'
      });
    }
  }


  let connection;
  let transactionStarted = false;

  try {
    connection = await getConnection();

    await beginTransaction(connection);
    transactionStarted = true;

    // =================================================
    // DUPLICATE ID CHECK
    // =================================================

    if (isCitizen) {
      const duplicateFound = await checkDuplicateID(
        connection,
        frontHash,
        backHash
      );

      if (duplicateFound) {
        const duplicateError = new Error(
          'Matching ID document already submitted.'
        );

        duplicateError.code = 'DUPLICATE_ID';
        throw duplicateError;
      }
    }

      // =================================================
// PREVENT DUPLICATE LGU OFFICE REGISTRATION
// =================================================

if (isLGU) {
  const duplicateOffices = await runQuery(
    connection,
    `SELECT l.lgu_registration_id
     FROM lgu_registrations l
     WHERE l.lgu_level = ?
       AND (
         ? = 'city'
         OR LOWER(TRIM(l.lgu_barangay)) =
            LOWER(TRIM(?))
       )
       AND LOWER(
         REGEXP_REPLACE(TRIM(l.lgu_office), '[[:space:]]+', ' ')
       ) = LOWER(
         REGEXP_REPLACE(TRIM(?), '[[:space:]]+', ' ')
       )
       AND l.verification_status IN ('pending', 'approved')
     LIMIT 1`,
    [
      lguLevel,
      lguLevel,
      lguLevel === 'barangay' ? lguBarangay : '',
      lguOffice
    ]
  );

  if (duplicateOffices.length > 0) {
    const duplicateError = new Error(
      'This LGU office is already registered in CitiPoints.'
    );

    duplicateError.code = 'DUPLICATE_LGU_OFFICE';
    throw duplicateError;
  }
}


    // =================================================
    // CREATE USER
    // =================================================

    const passwordHash = await bcrypt.hash(password, 10);

   
   const userResult = await runQuery(
  connection,
  `INSERT INTO users (
    first_name,
    middle_name,
    last_name,
    suffix,
    date_of_birth,
    email,
    phone,
    address,
    barangay,
    city,
    password_hash,
    role,
    status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    firstName,
    middleName || null,
    lastName,
    suffix || null,
    dateOfBirth,
    email,
    phone,
    isCitizen
      ? address
      : isPartner
        ? businessAddress
        : lguOfficeAddress,
    isCitizen
      ? barangay
      : isPartner
        ? businessBarangay
        : lguLevel === 'barangay'
          ? lguBarangay
          : null,
    'Mandaue City',
    passwordHash,
    role,
'active'
  ]
);


    const userId = userResult.insertId;

    // =================================================
    // SAVE CITIZEN VERIFICATION
    // =================================================

   if (isCitizen) {
 const verificationResult = await runQuery(
  connection,
  `INSERT INTO citizen_verifications (
    user_id,
    id_type,
    id_number,
    id_front,
    id_front_type,
    id_back,
    id_back_type,
    id_front_hash,
    id_back_hash,
    verification_status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  [
   userId,
resolveIdType(body.id_type),
idNumber,
    front.buffer,
    front.mimetype,
    back ? back.buffer : null,
    back ? back.mimetype : null,
    frontHash,
    backHash
  ]
);

  const verificationId = verificationResult.insertId;

  // Reserve the document hashes in a table with
  // a UNIQUE primary key.
  const documentHashes = [
    frontHash,
    backHash
  ].filter(Boolean);

  for (const documentHash of new Set(documentHashes)) {
    await runQuery(
      connection,
      `INSERT INTO citizen_document_hashes (
        document_hash,
        verification_id
      ) VALUES (?, ?)`,
      [documentHash, verificationId]
    );
  }

} else if (isPartner) {
  // SAVE PARTNER REGISTRATION FOR LGU REVIEW
  // SAVE PARTNER REGISTRATION FOR LGU REVIEW

 await runQuery(
  connection,
  `INSERT INTO partners (
    user_id,
    organization_name,
    contact_person,
    email,
    phone,
    status,
    business_permit_number,
    business_address,
    business_barangay,
    business_permit_file,
    business_permit_type,
    storefront_photo,
    storefront_photo_type,
    representative_id_type,
    representative_id_number,
    representative_id_file,
    representative_id_mime
  ) VALUES (
    ?, ?, ?, ?, ?, 'pending',
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )`,
  [
    userId,
    partnerName,
    fullName,
    email,
    phone,
    businessPermitNumber,
    businessAddress,
    businessBarangay,
    businessPermit.buffer,
    businessPermit.mimetype,
    storefrontPhoto.buffer,
    storefrontPhoto.mimetype,
    resolveIdType(representativeIdType),
    idNumber,
    representativeId.buffer,
    representativeId.mimetype
  ]
);

}


    // =================================================
    // SAVE LGU REGISTRATION FOR CITY ADMIN REVIEW
    // =================================================

    if (isLGU) {
      await runQuery(
  connection,
  `INSERT INTO lgu_registrations (
    user_id,
    lgu_level,
    lgu_barangay,
    lgu_office,
    lgu_office_address,
    lgu_office_contact,
    lgu_designation,
    loi_file,
    loi_file_type,
    representative_id_file,
    representative_id_type,
    representative_id_number,
    verification_status
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending'
  )`,
  [
    userId,
    lguLevel,
    lguLevel === 'barangay'
      ? lguBarangay
      : null,
    lguOffice,
    lguOfficeAddress,
    lguOfficeContact,
    lguDesignation,
    lguLOI.buffer,
    lguLOI.mimetype,
    lguId.buffer,
    lguId.mimetype,
    idNumber
  ]
);
    }


    // =====================================================
    // NOTIFY SUPER ADMIN — NEW LGU REGISTRATION
    // =====================================================

    if (isLGU) {
      const superAdminId = String(
        process.env.CITY_SUPER_ADMIN_ID || ''
      ).trim();

      if (!/^[1-9]\d*$/.test(superAdminId)) {
        throw new Error(
          'CITY_SUPER_ADMIN_ID is not configured.'
        );
      }

      const registrations = await runQuery(
        connection,
        `SELECT lgu_registration_id
         FROM lgu_registrations
         WHERE user_id = ?
         LIMIT 1`,
        [userId]
      );

      if (registrations.length !== 1) {
        throw new Error('LGU registration not found.');
      }

      const notificationResult = await runQuery(
        connection,
        `INSERT INTO notifications (
           user_id,
           type,
           title,
           message,
           reference_type,
           reference_id
         )
         SELECT
           u.user_id,
           'account',
           'New LGU Registration',
           ?,
           'lgu_registration',
           ?
         FROM users u
         WHERE u.user_id = ?
           AND u.role = 'admin'
           AND u.status = 'active'
           AND u.deleted_at IS NULL
         LIMIT 1`,
        [
          `${lguOffice} has submitted a new ${lguLevel} LGU registration application. The application is awaiting your review.`,
          registrations[0].lgu_registration_id,
          superAdminId
        ]
      );

      if (notificationResult.affectedRows !== 1) {
        throw new Error(
          'Unable to notify the City Super Admin.'
        );
      }
    }


    await commitTransaction(connection);
    transactionStarted = false;


let emailSent = false;

try {
  await issueEmailOTP(connection, userId, email);
  emailSent = true;
} catch (emailError) {
  console.error('Registration verification email failed:', {
    code: emailError.code,
    message: emailError.message
  });
}

return res.status(201).json({
  success: true,
  user_id: userId,
  email_verification_required: true,
  email_sent: emailSent,
  message: emailSent
    ? 'Registration successful. A 6-digit verification code has been sent to your email.'
    : 'Your account was created, but the verification email could not be sent. Please request a new code.',
  verification_status: isCitizen ? 'pending' : null,
  partner_status: isPartner ? 'pending' : null,
  lgu_status: isLGU ? 'pending' : null
});


  } catch (error) {
    if (connection && transactionStarted) {
      await rollbackTransaction(connection);
    }

    // Avoid logging ID images or full SQL statements.
    console.error('Registration error:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState
    });

   if (error.code === 'DUPLICATE_LGU_OFFICE') {
  return res.status(409).json({
    success: false,
    message:
      'This LGU office is already registered in CitiPoints. ' +
      'Only one official account is allowed per office. ' +
      'Please contact the Super Admin for assistance.'
  });
}

  if (error.code === 'ER_DUP_ENTRY') {
  if (error.sqlMessage?.includes('unique_lgu_office')) {
    return res.status(409).json({
      success: false,
      message:
        'This LGU office is already registered in CitiPoints. ' +
        'Only one official account is allowed per office. ' +
        'Please contact the Super Admin.'
    });
  }

  return res.status(409).json({
    success: false,
    message:
      'This email address or identification document ' +
      'has already been registered. Please use different ' +
      'account information or contact the LGU Administrator.'
  });
}

    if (error.code === 'ER_NET_PACKET_TOO_LARGE') {
      return res.status(413).json({
        message:
          'The uploaded documents exceed the database packet limit.'
      });
    }

    return res.status(500).json({
      message: 'Registration failed. Please try again.'
    });

  } finally {
    if (connection) connection.release();
  }
};


exports.resendEmailOTP = async (req, res) => {
  const email = clean(req.body?.email).toLowerCase();

  if (!email) {
    return res.status(400).json({
      message: 'Email address is required.'
    });
  }

  let connection;

  try {
    connection = await getConnection();

    const users = await runQuery(
      connection,
      `SELECT user_id, email_verified_at
       FROM users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1`,
      [email]
    );

    const user = users[0];

    if (!user || user.email_verified_at) {
      return res.json({
        message: 'If verification is needed, a code can be requested.'
      });
    }

    const rows = await runQuery(
      connection,
      `SELECT last_sent_at
       FROM email_verification_otps
       WHERE user_id = ?`,
      [user.user_id]
    );

    if (rows.length) {
      const elapsed =
        Date.now() - new Date(rows[0].last_sent_at).getTime();

      if (elapsed < OTP_RESEND_MS) {
        return res.status(429).json({
          message: 'Please wait before requesting another code.'
        });
      }
    }

    await issueEmailOTP(connection, user.user_id, email);

    return res.json({
      success: true,
      message: 'If verification is needed, a new code has been sent.'
    });

  } catch (error) {
    console.error('Resend OTP error:', error.code);

    return res.status(500).json({
      message: 'Unable to process verification request.'
    });
  } finally {
    if (connection) connection.release();
  }
};


exports.verifyEmail = async (req, res) => {
  const email = clean(req.body?.email).toLowerCase();
  const otp = clean(req.body?.otp);

  if (!email || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      message: 'Enter your email and a valid 6-digit code.'
    });
  }

  let connection;

  try {
    connection = await getConnection();
    await beginTransaction(connection);

    const users = await runQuery(
      connection,
      `SELECT user_id, email_verified_at
       FROM users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [email]
    );

    const user = users[0];

    if (!user) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        message: 'Invalid or expired verification code.'
      });
    }

    if (user.email_verified_at) {
      await commitTransaction(connection);
      return res.json({
        success: true,
        message: 'Email is already verified.'
      });
    }

    const rows = await runQuery(
      connection,
      `SELECT otp_hash, expires_at, attempts
       FROM email_verification_otps
       WHERE user_id = ?
       LIMIT 1 FOR UPDATE`,
      [user.user_id]
    );

    const record = rows[0];

    if (!record ||
        new Date(record.expires_at).getTime() <= Date.now() ||
        record.attempts >= OTP_MAX_ATTEMPTS) {
      await commitTransaction(connection);
      return res.status(400).json({
        message: 'Code expired or attempts exhausted. Request a new code.'
      });
    }

    const submittedHash = hashEmailOTP(user.user_id, otp);

    const valid = crypto.timingSafeEqual(
      Buffer.from(submittedHash, 'hex'),
      Buffer.from(record.otp_hash, 'hex')
    );

    if (!valid) {
      await runQuery(
        connection,
        `UPDATE email_verification_otps
         SET attempts = attempts + 1
         WHERE user_id = ?`,
        [user.user_id]
      );

      await commitTransaction(connection);

      return res.status(400).json({
        message: 'Incorrect verification code.'
      });
    }

    await runQuery(
      connection,
      `UPDATE users
       SET email_verified_at = NOW()
       WHERE user_id = ?`,
      [user.user_id]
    );

    await runQuery(
      connection,
      `DELETE FROM email_verification_otps
       WHERE user_id = ?`,
      [user.user_id]
    );

    await commitTransaction(connection);

    return res.json({
      success: true,
      message: 'Email verified successfully. You may now log in.'
    });

  } catch (error) {
    if (connection) await rollbackTransaction(connection);

    console.error('Email verification error:', error.code);

    return res.status(500).json({
      message: 'Unable to verify email. Please try again.'
    });
  } finally {
    if (connection) connection.release();
  }
};



// =====================================================
// LOGIN
// =====================================================

exports.login = (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required.'
    });
  }
  

if (
  typeof email !== 'string' ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
) {
  return res.status(400).json({
    message: 'Invalid email address.'
  });
}


  if (!JWT_SECRET) {
    return res.status(500).json({
      message: 'Authentication is not configured.'
    });
  }

  const sql = `
    SELECT
      users.user_id,
     TRIM(CONCAT_WS(' ',
  NULLIF(users.first_name, ''),
  NULLIF(users.middle_name, ''),
  NULLIF(users.last_name, ''),
  NULLIF(users.suffix, '')
)) AS full_name,
      users.first_name,
      users.middle_name,
      users.last_name,
      users.suffix,
     users.email,
users.email_verified_at,
users.password_hash,
      users.role,
      users.status,
      users.points_balance,

      partners.partner_id,
      partners.organization_name,
      partners.status AS partner_status,

     citizen_verifications.verification_status,
lgu_registrations.verification_status AS lgu_status

    FROM users

    LEFT JOIN partners
      ON users.user_id = partners.user_id

    LEFT JOIN citizen_verifications
      ON users.user_id = citizen_verifications.user_id
      LEFT JOIN lgu_registrations
  ON users.user_id = lgu_registrations.user_id

   WHERE users.email = ?
  AND users.deleted_at IS NULL
LIMIT 1
  `;

  db.query(
    sql,
    [clean(email).toLowerCase()],
    async (error, results) => {
      if (error) {
        console.error('Login database error:', {
          code: error.code
        });

        return res.status(500).json({
          message: 'Database error.'
        });
      }

      const user = results[0];

      if (!user) {
        return res.status(401).json({
          message: 'Invalid email or password.'
        });
      }

      try {
        const isMatch = await bcrypt.compare(
          password,
          user.password_hash
        );

        if (!isMatch) {
          return res.status(401).json({
            message: 'Invalid email or password.'
          });
        }


if (!user.email_verified_at) {
  return res.status(403).json({
    code: 'EMAIL_NOT_VERIFIED',
    email_verification_required: true,
    message:
      'Please verify your email address before logging in.'
  });
}



       if (user.status !== 'active') {
  return res.status(403).json({
    message: user.role === 'lgu'
      ? 'Your LGU registration is awaiting administrator approval.'
      : 'This account is inactive or suspended.'
  });
}
    if (
  user.role === 'lgu' &&
  !['pending', 'approved', 'rejected'].includes(
    user.lgu_status
  )
) {
  return res.status(403).json({
    message: 'LGU registration record not available.'
  });
}
       if (user.role === 'partner') {
  if (!user.partner_id) {
    return res.status(403).json({
      message: 'Establishment registration record not found.'
    });
  }

 if (!['pending', 'active', 'rejected'].includes(user.partner_status)) {
  return res.status(403).json({
    message: 'This establishment account is inactive or unavailable.'
  });
}
}

        const token = jwt.sign(
          {
            user_id: user.user_id,
            role: user.role
          },
          JWT_SECRET,
          { expiresIn: '1d' }
        );

        return res.json({
          message: 'Login successful.',
          token,
          user: {
            user_id: user.user_id,
            full_name: user.full_name,
            first_name: user.first_name,
            middle_name: user.middle_name,
            last_name: user.last_name,
            suffix: user.suffix,
            email: user.email,
            role: user.role,
            status: user.status,
            points_balance: user.points_balance,
           partner_id: user.partner_id || null,
            partner_name: user.organization_name || null,
            partner_status:
            user.role === 'partner'
            ? user.partner_status || 'pending'
            : null,
              verification_status:
  user.role === 'community_member'
    ? user.verification_status || 'pending'
    : null,

lgu_verification_status:
  user.role === 'lgu'
    ? user.lgu_status
    : null
          }
        });

      } catch (error) {
        console.error('Login error:', {
          code: error.code
        });

        return res.status(500).json({
          message: 'Server error.'
        });
      }
    }
  );
};

// =====================================================
// RESUBMIT REJECTED ESTABLISHMENT APPLICATION
// =====================================================

exports.resubmitPartner = async (req, res) => {
  if (req.user?.role !== 'partner') {
    return res.status(403).json({
      message: 'Only establishments can resubmit applications.'
    });
  }

  const body = req.body || {};
  const files = req.files || {};

  const hasField = (name) =>
    Object.prototype.hasOwnProperty.call(body, name);

  const changes = {};

  // Only these registration details can be corrected.
  const editableFields = [
    ['partner_name', 'organization_name', 150],
    ['business_permit_number', 'business_permit_number', 100],
    ['business_address', 'business_address', 255],
    ['business_barangay', 'business_barangay', 100],
    ['phone', 'phone', 11],
    ['id_number', 'representative_id_number', 50]
  ];

  for (const [input, column, maxLength] of editableFields) {
    if (!hasField(input)) continue;

    if (typeof body[input] !== 'string') {
      return res.status(400).json({
        message: `Invalid ${input}.`
      });
    }

    const value = clean(body[input]);

    if (!value || value.length > maxLength) {
      return res.status(400).json({
        message: `Please enter a valid ${input}.`
      });
    }

    if (
      input === 'business_barangay' &&
      !BARANGAYS.includes(value)
    ) {
      return res.status(400).json({
        message: 'Select a valid Mandaue City barangay.'
      });
    }

    if (input === 'phone' && !/^09\d{9}$/.test(value)) {
      return res.status(400).json({
        message: 'Enter a valid Philippine mobile number.'
      });
    }

    if (
      input === 'id_number' &&
      (
        value.length < 3 ||
        !/^[A-Za-z0-9][A-Za-z0-9 /-]*[A-Za-z0-9]$/.test(value)
      )
    ) {
      return res.status(400).json({
        message: 'Enter a valid representative ID number.'
      });
    }

    changes[column] = value;
  }

  // Representative ID type, including Others.
  if (hasField('representative_id_type')) {
    const idType = clean(body.representative_id_type);

    if (!ID_TYPES.includes(idType)) {
      return res.status(400).json({
        message: 'Select a valid representative ID type.'
      });
    }

    if (idType === 'other') {
      const otherType = clean(body.other_id_type);

      if (
        otherType.length < 3 ||
        otherType.length > 40 ||
        !/^[\p{L}\p{M}][\p{L}\p{M}0-9 .()'/-]*$/u.test(otherType)
      ) {
        return res.status(400).json({
          message: 'Specify a valid representative ID type.'
        });
      }

      changes.representative_id_type = `Other: ${otherType}`;
    } else {
      changes.representative_id_type = idType;
    }
  } else if (hasField('other_id_type')) {
    return res.status(400).json({
      message: 'Select the representative ID type first.'
    });
  }

  // Existing registration document fields.
  const documentFields = [
    ['business_permit', 'business_permit_file', 'business_permit_type'],
    ['storefront_photo', 'storefront_photo', 'storefront_photo_type'],
    ['representative_id', 'representative_id_file', 'representative_id_mime']
  ];

  const allowedFiles = documentFields.map(([name]) => name);

  if (Object.keys(files).some((name) => !allowedFiles.includes(name))) {
    return res.status(400).json({
      message: 'Unexpected verification document.'
    });
  }

  const replacements = [];

  for (const [name, fileColumn, typeColumn] of documentFields) {
    const file = files[name]?.[0];

    if (!file) continue;

    if (!validDocument(file)) {
      return res.status(400).json({
        message: `Invalid ${name} document.`
      });
    }

    if (
      name === 'storefront_photo' &&
      !['image/jpeg', 'image/png'].includes(file.mimetype)
    ) {
      return res.status(400).json({
        message: 'Storefront photo must be JPG or PNG.'
      });
    }

    replacements.push({
      fileColumn,
      typeColumn,
      file
    });
  }

  if (
    Object.keys(changes).length === 0 &&
    replacements.length === 0
  ) {
    return res.status(400).json({
      message: 'Please make a correction or upload a replacement document.'
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await getConnection();

    await beginTransaction(connection);
    transactionStarted = true;

    // Lock this application during resubmission.
    const rows = await runQuery(
      connection,
      `SELECT
         p.partner_id,
         p.status AS partner_status,
         p.organization_name,
         p.business_permit_number,
         p.business_address,
         p.business_barangay,
         p.phone,
         p.representative_id_type,
         p.representative_id_number,
         u.status AS account_status
       FROM partners p
       INNER JOIN users u ON u.user_id = p.user_id
       WHERE u.user_id = ?
         AND u.role = 'partner'
         AND u.deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [req.user.user_id]
    );

    if (!rows.length || rows[0].account_status !== 'active') {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(403).json({
        message: 'Active establishment account required.'
      });
    }

    const partner = rows[0];

    if (partner.partner_status !== 'rejected') {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(409).json({
        message: 'Only rejected applications can be resubmitted.'
      });
    }

    const updates = [];
    const values = [];

    // Update only information that was changed.
    for (const [column, value] of Object.entries(changes)) {
      if (String(partner[column] ?? '') !== value) {
        updates.push(`${column} = ?`);
        values.push(value);
      }
    }

    // Replace only the documents the applicant uploaded.
    for (const replacement of replacements) {
      updates.push(`${replacement.fileColumn} = ?`);
      values.push(replacement.file.buffer);

      updates.push(`${replacement.typeColumn} = ?`);
      values.push(replacement.file.mimetype);
    }

    if (!updates.length) {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(400).json({
        message: 'No changes were detected in the application.'
      });
    }

    // Return the existing application to Pending.
    const result = await runQuery(
      connection,
      `UPDATE partners
       SET ${updates.join(', ')},
           status = 'pending',
           updated_at = NOW()
       WHERE partner_id = ?
         AND status = 'rejected'`,
      [...values, partner.partner_id]
    );

    if (result.affectedRows !== 1) {
      throw new Error('PARTNER_RESUBMISSION_CONFLICT');
    }

    // Keep shared account contact details consistent.
    const userUpdates = [];
    const userValues = [];

    for (const [partnerColumn, userColumn] of [
      ['business_address', 'address'],
      ['business_barangay', 'barangay'],
      ['phone', 'phone']
    ]) {
      if (
        Object.prototype.hasOwnProperty.call(changes, partnerColumn) &&
        changes[partnerColumn] !== partner[partnerColumn]
      ) {
        userUpdates.push(`${userColumn} = ?`);
        userValues.push(changes[partnerColumn]);
      }
    }

    if (userUpdates.length) {
      await runQuery(
        connection,
        `UPDATE users
         SET ${userUpdates.join(', ')}
         WHERE user_id = ?
           AND status = 'active'`,
        [...userValues, req.user.user_id]
      );
    }

    await commitTransaction(connection);
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: 'Application resubmitted successfully. Awaiting LGU review.',
      partner_status: 'pending'
    });

  } catch (error) {
    if (connection && transactionStarted) {
      await rollbackTransaction(connection);
    }

    console.error('PARTNER RESUBMISSION ERROR:', error.code || error.message);

    return res.status(
      error.code === 'ER_NET_PACKET_TOO_LARGE' ? 413 : 500
    ).json({
      success: false,
      message: 'Unable to resubmit application. Please try again.'
    });

  } finally {
    if (connection) connection.release();
  }
};
// =====================================================
// GET CURRENT USER
// =====================================================

exports.getCurrentUser = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT
      users.user_id,
     TRIM(CONCAT_WS(' ',
  NULLIF(users.first_name, ''),
  NULLIF(users.middle_name, ''),
  NULLIF(users.last_name, ''),
  NULLIF(users.suffix, '')
)) AS full_name,
      users.first_name,
      users.middle_name,
      users.last_name,
      users.suffix,
      users.email,
      users.role,
      users.status,
      users.points_balance,

      partners.partner_id,
      partners.organization_name,
      partners.status AS partner_status,

     citizen_verifications.verification_status,
lgu_registrations.verification_status AS lgu_status

    FROM users

    LEFT JOIN partners
      ON users.user_id = partners.user_id

    LEFT JOIN citizen_verifications
      ON users.user_id = citizen_verifications.user_id
      LEFT JOIN lgu_registrations
  ON users.user_id = lgu_registrations.user_id

    WHERE users.user_id = ?
    LIMIT 1
  `;

  db.query(sql, [userId], (error, results) => {
    if (error) {
      console.error('Get current user error:', {
        code: error.code
      });

      return res.status(500).json({
        message: 'Database error.'
      });
    }

    const user = results[0];

    if (!user) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    return res.json({
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        first_name: user.first_name,
        middle_name: user.middle_name,
        last_name: user.last_name,
        suffix: user.suffix,
        email: user.email,
        role: user.role,
        status: user.status,
        points_balance: user.points_balance,
partner_id: user.partner_id || null,
partner_name: user.organization_name || null,
partner_status:
  user.role === 'partner'
    ? user.partner_status || 'pending'
    : null,
verification_status:
  user.role === 'community_member'
    ? user.verification_status || 'pending'
    : null

      }
    });
  });
};



/* =====================================================
   CHANGE PASSWORD
   Available to authenticated users
===================================================== */

exports.changePassword = async (req, res) => {
  const userId = req.user?.user_id;

  const {
    currentPassword,
    newPassword
  } = req.body || {};

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (
    typeof currentPassword !== 'string' ||
    !currentPassword
  ) {
    return res.status(400).json({
      success: false,
      message: 'Current password is required.'
    });
  }

  if (
    typeof newPassword !== 'string' ||
    newPassword.length < 12 ||
    Buffer.byteLength(newPassword, 'utf8') > 72
  ) {
    return res.status(400).json({
      success: false,
      message:
        'New password must contain at least 12 characters ' +
        'and must not exceed 72 UTF-8 bytes.'
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message:
        'New password must be different from your current password.'
    });
  }

  try {
    const results = await new Promise((resolve, reject) => {
      db.query(
        `SELECT password_hash
         FROM users
         WHERE user_id = ?
           AND status = 'active'
         LIMIT 1`,
        [userId],
        (error, rows) => {
          if (error) return reject(error);
          resolve(rows);
        }
      );
    });

    if (!results.length) {
      return res.status(403).json({
        success: false,
        message: 'Account not found or inactive.'
      });
    }

    const oldHash = results[0].password_hash;

    const validPassword = await bcrypt.compare(
      currentPassword,
      oldHash
    );

    if (!validPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      oldHash
    );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message:
          'Your new password must be different from your current password.'
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    // Update only if the password has not changed
    // since it was retrieved.
    const updateResult = await new Promise(
      (resolve, reject) => {
        db.query(
          `UPDATE users
           SET password_hash = ?
           WHERE user_id = ?
             AND status = 'active'
             AND password_hash = ?`,
          [newHash, userId, oldHash],
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
      }
    );

    if (updateResult.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        message:
          'Your password was changed in another session. ' +
          'Please try again.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });

  } catch (error) {
    console.error('CHANGE PASSWORD ERROR:', error.code);

    return res.status(500).json({
      success: false,
      message: 'Unable to change password.'
    });
  }
};


/* =====================================================
   FORGOT PASSWORD - SEND RESET OTP
   ===================================================== */

exports.forgotPassword = async (req, res) => {



  const email = clean(req.body?.email).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      message: 'Enter a valid email address.'
    });
  }

  const genericMessage =
    'If an account exists with this email, a password reset code will be sent.';

  let connection;

  try {
    connection = await getConnection();

    const users = await runQuery(
      connection,
      `SELECT user_id
       FROM users
       WHERE email = ?
         AND deleted_at IS NULL
         AND email_verified_at IS NOT NULL
       LIMIT 1`,
      [email]
    );

    // Do not reveal whether an email is registered.
    if (!users.length) {
      return res.json({
        success: true,
        message: genericMessage
      });
    }

    const userId = users[0].user_id;

    await beginTransaction(connection);

    // Lock the user's reset record before checking cooldown.
    const records = await runQuery(
      connection,
      `SELECT last_sent_at
       FROM password_reset_otps
       WHERE user_id = ?
       FOR UPDATE`,
      [userId]
    );

    if (records.length) {
      const elapsed =
        Date.now() -
        new Date(records[0].last_sent_at).getTime();

      if (elapsed < OTP_RESEND_MS) {
        await commitTransaction(connection);

        return res.json({
          success: true,
          message: genericMessage
        });
      }
    }

    const otp = generateEmailOTP();

    // Domain separation prevents reset OTP hashes
    // from matching email verification OTP hashes.
    const otpHash = hashEmailOTP(
      `password-reset:${userId}`,
      otp
    );

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_MS
    );

    await runQuery(
      connection,
      `INSERT INTO password_reset_otps (
         user_id,
         otp_hash,
         expires_at,
         attempts,
         last_sent_at,
         reset_token_hash,
         reset_token_expires_at
       )
       VALUES (?, ?, ?, 0, NOW(), NULL, NULL)
       ON DUPLICATE KEY UPDATE
         otp_hash = VALUES(otp_hash),
         expires_at = VALUES(expires_at),
         attempts = 0,
         last_sent_at = NOW(),
         reset_token_hash = NULL,
         reset_token_expires_at = NULL`,
      [userId, otpHash, expiresAt]
    );

    await commitTransaction(connection);

    // Send only after saving the OTP.
    await sendPasswordResetEmail(email, otp);

    return res.json({
      success: true,
      message: genericMessage
    });

  } catch (error) {
    console.error('Forgot password error:', {
      code: error.code,
      message: error.message
    });

    // Avoid revealing whether the account exists
    // through the public response.
    return res.status(500).json({
      message: 'Unable to process reset request. Please try again.'
    });

  } finally {
    if (connection) connection.release();
  }
};


/* =====================================================
   VERIFY PASSWORD RESET OTP
   ===================================================== */

exports.verifyResetOTP = async (req, res) => {
  const email = clean(req.body?.email).toLowerCase();
  const otp = clean(req.body?.otp);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      message: 'Enter a valid email and 6-digit code.'
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await getConnection();
    await beginTransaction(connection);
    transactionStarted = true;

    const users = await runQuery(
      connection,
      `SELECT user_id
       FROM users
       WHERE email = ?
         AND deleted_at IS NULL
         AND email_verified_at IS NOT NULL
       LIMIT 1
       FOR UPDATE`,
      [email]
    );

    const user = users[0];

    if (!user) {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(400).json({
        message: 'Invalid or expired reset code.'
      });
    }

    const records = await runQuery(
      connection,
      `SELECT otp_hash, expires_at, attempts
       FROM password_reset_otps
       WHERE user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [user.user_id]
    );

    const record = records[0];

    if (
      !record ||
      new Date(record.expires_at).getTime() <= Date.now() ||
      record.attempts >= OTP_MAX_ATTEMPTS ||
      !/^[a-f0-9]{64}$/i.test(record.otp_hash || '')
    ) {
      await commitTransaction(connection);
      transactionStarted = false;

      return res.status(400).json({
        message: 'Code expired or attempts exhausted. Request a new code.'
      });
    }

    const submittedHash = hashEmailOTP(
      `password-reset:${user.user_id}`,
      otp
    );

    const valid = crypto.timingSafeEqual(
      Buffer.from(submittedHash, 'hex'),
      Buffer.from(record.otp_hash, 'hex')
    );

    if (!valid) {
      await runQuery(
        connection,
        `UPDATE password_reset_otps
         SET attempts = attempts + 1
         WHERE user_id = ?`,
        [user.user_id]
      );

      await commitTransaction(connection);
      transactionStarted = false;

      return res.status(400).json({
        message: 'Incorrect reset code.'
      });
    }

    // Generate a short-lived, single-use reset authorization.
    const resetToken = crypto.randomBytes(32).toString('hex');

    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const resetTokenExpiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await runQuery(
      connection,
      `UPDATE password_reset_otps
       SET otp_hash = NULL,
           reset_token_hash = ?,
           reset_token_expires_at = ?,
           attempts = 0
       WHERE user_id = ?`,
      [
        resetTokenHash,
        resetTokenExpiresAt,
        user.user_id
      ]
    );

    await commitTransaction(connection);
    transactionStarted = false;

    return res.json({
      success: true,
      resetToken,
      message: 'Code verified successfully.'
    });

  } catch (error) {
    if (connection && transactionStarted) {
      await rollbackTransaction(connection);
    }

    console.error('Verify reset OTP error:', error.code);

    return res.status(500).json({
      message: 'Unable to verify reset code.'
    });

  } finally {
    if (connection) connection.release();
  }
};


/* =====================================================
   RESET PASSWORD
   Requires a valid, single-use reset token
===================================================== */

exports.resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body || {};

  if (
    typeof resetToken !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(resetToken)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reset authorization. Request a new code.'
    });
  }

  if (
    typeof newPassword !== 'string' ||
    newPassword.length < 12 ||
    Buffer.byteLength(newPassword, 'utf8') > 72
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Password must contain at least 12 characters ' +
        'and must not exceed 72 UTF-8 bytes.'
    });
  }

  const resetTokenHash = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  let connection;
  let transactionStarted = false;

  try {
    connection = await getConnection();

    await beginTransaction(connection);
    transactionStarted = true;

    const records = await runQuery(
      connection,
      `SELECT
         user_id,
         reset_token_expires_at
       FROM password_reset_otps
       WHERE reset_token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [resetTokenHash]
    );

    const record = records[0];

    if (
      !record ||
      !record.reset_token_expires_at ||
      new Date(record.reset_token_expires_at).getTime() <= Date.now()
    ) {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message:
          'Reset authorization is invalid or expired. ' +
          'Please request a new code.'
      });
    }

    const users = await runQuery(
      connection,
      `SELECT password_hash
       FROM users
       WHERE user_id = ?
         AND deleted_at IS NULL
         AND email_verified_at IS NOT NULL
       LIMIT 1
       FOR UPDATE`,
      [record.user_id]
    );

    if (!users.length) {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Unable to reset this account.'
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      users[0].password_hash
    );

    if (samePassword) {
      await rollbackTransaction(connection);
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message:
          'Your new password must be different ' +
          'from your previous password.'
      });
    }

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      12
    );

    await runQuery(
      connection,
      `UPDATE users
       SET password_hash = ?
       WHERE user_id = ?`,
      [newPasswordHash, record.user_id]
    );

    // Invalidate the reset authorization permanently.
    await runQuery(
      connection,
      `DELETE FROM password_reset_otps
       WHERE user_id = ?`,
      [record.user_id]
    );

    await commitTransaction(connection);
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully.'
    });

  } catch (error) {
    if (connection && transactionStarted) {
      await rollbackTransaction(connection);
    }

    console.error('RESET PASSWORD ERROR:', {
      code: error.code,
      message: error.message
    });

    return res.status(500).json({
      success: false,
      message:
        'Unable to reset password. Please try again.'
    });

  } finally {
    if (connection) connection.release();
  }
};

