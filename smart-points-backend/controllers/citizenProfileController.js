
const db = require('../config/db');
const crypto = require('crypto');

/* =====================================================
   GET CITIZEN PROFILE
===================================================== */

const getCitizenProfile = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT
      u.user_id,
     TRIM(CONCAT_WS(' ',
  NULLIF(u.first_name, ''),
  NULLIF(u.middle_name, ''),
  NULLIF(u.last_name, ''),
  NULLIF(u.suffix, '')
)) AS full_name,
      u.first_name,
      u.middle_name,
      u.last_name,
      u.suffix,
      u.email,
      u.phone,
      u.address,
      u.barangay,
      u.city,
      u.points_balance,
      u.created_at,
      u.profile_picture_type,

     COALESCE(urp.current_rank, 'New') AS current_rank,

(
  SELECT cv.verification_status
  FROM citizen_verifications cv
  WHERE cv.user_id = u.user_id
  ORDER BY cv.verification_id DESC
  LIMIT 1
) AS verification_status,
 (
  SELECT cv.id_type
  FROM citizen_verifications cv
  WHERE cv.user_id = u.user_id
  ORDER BY cv.verification_id DESC
  LIMIT 1
) AS id_type,

(
  SELECT cv.id_number
  FROM citizen_verifications cv
  WHERE cv.user_id = u.user_id
  ORDER BY cv.verification_id DESC
  LIMIT 1
) AS id_number,

(
  SELECT avr.rejection_reason
  FROM account_verification_reviews avr
  WHERE avr.account_type = 'citizen'
    AND avr.account_id = u.user_id
    AND avr.decision = 'rejected'
  ORDER BY avr.review_id DESC
  LIMIT 1
) AS rejection_reason,

      (
        SELECT COUNT(*)
        FROM activity_registrations ar
        WHERE ar.user_id = u.user_id
          AND ar.registration_status != 'cancelled'
      ) AS activities_joined,

      (
        SELECT COUNT(*)
        FROM participation_records pr
        WHERE pr.user_id = u.user_id
          AND pr.status = 'approved'
      ) AS activities_completed,

      (
        SELECT COUNT(*)
        FROM reward_redemptions rr
        WHERE rr.user_id = u.user_id
          AND rr.status IN (
            'approved',
            'claimed',
            'completed'
          )
      ) AS rewards_redeemed

    FROM users u

    LEFT JOIN user_rank_profiles urp
      ON urp.user_id = u.user_id

    WHERE u.user_id = ?
      AND u.role = 'community_member'

    LIMIT 1
  `;

  db.query(sql, [userId], (error, results) => {
    if (error) {
      console.error(
        'GET CITIZEN PROFILE ERROR:',
        error.code
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch citizen profile.'
      });
    }

    if (!results.length) {
      return res.status(404).json({
        success: false,
        message: 'Citizen profile not found.'
      });
    }

    const profile = results[0];

    profile.profile_picture_url =
      '/api/citizen/profile/picture';

    return res.status(200).json({
      success: true,
      profile
    });
  });
};

/* =====================================================
   UPDATE PROFILE PICTURE ONLY
===================================================== */

const updateCitizenProfile = (req, res) => {
  const userId = req.user.user_id;

  // Never allow citizens to update personal information.
  const allowedFields = new Set();

  const unexpectedFields = Object.keys(
    req.body || {}
  ).filter((field) => !allowedFields.has(field));

  if (unexpectedFields.length > 0) {
    return res.status(403).json({
      success: false,
      message:
        'Personal information cannot be edited. ' +
        'Please contact the LGU Administrator for corrections.'
    });
  }

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({
      success: false,
      message: 'Please select a profile picture.'
    });
  }

  const image = req.file.buffer;

  const isJpeg =
    image.length >= 3 &&
    image[0] === 0xff &&
    image[1] === 0xd8 &&
    image[2] === 0xff;

  const isPng =
    image.length >= 8 &&
    image.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );

  const isWebp =
    image.length >= 12 &&
    image.toString('ascii', 0, 4) === 'RIFF' &&
    image.toString('ascii', 8, 12) === 'WEBP';

  const validImage =
    (req.file.mimetype === 'image/jpeg' && isJpeg) ||
    (req.file.mimetype === 'image/png' && isPng) ||
    (req.file.mimetype === 'image/webp' && isWebp);

  if (!validImage) {
    return res.status(400).json({
      success: false,
      message: 'Invalid profile picture format.'
    });
  }

  if (image.length > 5 * 1024 * 1024) {
    return res.status(413).json({
      success: false,
      message: 'Profile picture must not exceed 5 MB.'
    });
  }

  const sql = `
    UPDATE users
    SET
      profile_picture = ?,
      profile_picture_type = ?
    WHERE user_id = ?
      AND role = 'community_member'
  `;

  db.query(
    sql,
    [image, req.file.mimetype, userId],
    (error, result) => {
      if (error) {
        console.error(
          'UPDATE PROFILE PICTURE ERROR:',
          error.code
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to update profile picture.'
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Citizen profile not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Profile picture updated successfully.'
      });
    }
  );
};

/* =====================================================
   GET PROFILE PICTURE
===================================================== */

const getProfilePicture = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT
      profile_picture,
      profile_picture_type
    FROM users
    WHERE user_id = ?
      AND role = 'community_member'
    LIMIT 1
  `;

  db.query(sql, [userId], (error, results) => {
    if (error) {
      console.error(
        'GET PROFILE PICTURE ERROR:',
        error.code
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch profile picture.'
      });
    }

    if (
      !results.length ||
      !results[0].profile_picture
    ) {
      return res.status(404).json({
        success: false,
        message: 'Profile picture not found.'
      });
    }

    const picture = results[0];

    res.set(
      'Content-Type',
      picture.profile_picture_type || 'image/jpeg'
    );

    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');

    return res.send(picture.profile_picture);
  });
};
  /* =====================================================
   RESUBMIT REJECTED CITIZEN VERIFICATION
===================================================== */

const resubmitCitizenVerification = async (req, res) => {
  const userId = req.user?.user_id;

  if (!userId || req.user?.role !== 'community_member') {
    return res.status(403).json({
      success: false,
      message: 'Only citizens can resubmit verification.'
    });
  }

  const body = req.body || {};
  const files = req.files || {};

  const hasField = (field) =>
    Object.prototype.hasOwnProperty.call(body, field);

  const allowedFields = [
    'id_type',
    'id_number',
    'other_id_type'
  ];

  if (
    Object.keys(body).some(
      (field) => !allowedFields.includes(field)
    )
  ) {
    return res.status(400).json({
      success: false,
      message: 'Only ID verification details can be corrected.'
    });
  }

  const acceptedFiles = ['id_front', 'id_back'];

  if (
    Object.keys(files).some(
      (field) => !acceptedFiles.includes(field)
    )
  ) {
    return res.status(400).json({
      success: false,
      message: 'Unexpected verification document.'
    });
  }

  const front = files.id_front?.[0] || null;
  const back = files.id_back?.[0] || null;

  const validateImage = (file) => {
    if (!file) return true;

    const buffer = file.buffer;

    if (
      !buffer ||
      buffer.length === 0 ||
      buffer.length > 5 * 1024 * 1024
    ) {
      return false;
    }

    const jpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const png =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );

    return (
      (file.mimetype === 'image/jpeg' && jpeg) ||
      (file.mimetype === 'image/png' && png)
    );
  };

  if (!validateImage(front) || !validateImage(back)) {
    return res.status(400).json({
      success: false,
      message: 'ID photos must be valid JPG or PNG images, maximum 5 MB.'
    });
  }

  const hashBuffer = (buffer) =>
    crypto.createHash('sha256')
      .update(buffer)
      .digest('hex');

  let connection;
  let transactionStarted = false;

  const query = (sql, params = []) =>
    new Promise((resolve, reject) => {
      connection.query(sql, params, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });

  const rollback = () =>
    new Promise((resolve) => {
      connection.rollback(() => resolve());
    });

  try {
    connection = await new Promise((resolve, reject) => {
      db.getConnection((error, conn) => {
        if (error) return reject(error);
        resolve(conn);
      });
    });

    await new Promise((resolve, reject) => {
      connection.beginTransaction((error) => {
        if (error) return reject(error);
        resolve();
      });
    });

    transactionStarted = true;

    // Lock the existing citizen verification record.
    const rows = await query(
      `SELECT
         cv.verification_id,
         cv.verification_status,
         cv.id_type,
         cv.id_number,
         cv.id_front,
         cv.id_back,
         cv.id_front_hash,
cv.id_back_hash,
u.barangay AS citizen_barangay
FROM citizen_verifications cv
       INNER JOIN users u
         ON u.user_id = cv.user_id
       WHERE cv.user_id = ?
         AND u.role = 'community_member'
         AND u.status = 'active'
         AND u.deleted_at IS NULL
       ORDER BY cv.verification_id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!rows.length) {
      await rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: 'Active citizen verification record not found.'
      });
    }

    const verification = rows[0];

    if (verification.verification_status !== 'rejected') {
      await rollback();
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: 'Only rejected verification requests can be resubmitted.'
      });
    }

    let finalIdType = verification.id_type;
    let finalIdNumber = verification.id_number;

    // Validate corrected ID type.
    if (hasField('id_type')) {
      const selectedType = String(body.id_type || '').trim();

      const allowedTypes = [
        'national_id',
        'drivers_license',
        'voters_id',
        'senior_citizen_id',
        'other'
      ];

      if (!allowedTypes.includes(selectedType)) {
        await rollback();
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: 'Select a valid government-issued ID type.'
        });
      }

      if (selectedType === 'other') {
        const otherType = String(
          body.other_id_type || ''
        ).trim();

        if (
          otherType.length < 3 ||
          otherType.length > 40 ||
          !/^[\p{L}\p{M}][\p{L}\p{M}0-9 .()'/-]*$/u.test(otherType)
        ) {
          await rollback();
          transactionStarted = false;

          return res.status(400).json({
            success: false,
            message: 'Specify a valid government-issued ID type.'
          });
        }

        finalIdType = `Other: ${otherType}`;
      } else {
        finalIdType = selectedType;
      }
    } else if (hasField('other_id_type')) {
      await rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Select the ID type when changing the custom ID type.'
      });
    }

    // Validate corrected ID number.
    if (hasField('id_number')) {
      const number = String(body.id_number || '').trim();

      if (
        number.length < 3 ||
        number.length > 50 ||
        !/^[A-Za-z0-9][A-Za-z0-9 /-]*[A-Za-z0-9]$/.test(number)
      ) {
        await rollback();
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: 'Enter a valid ID number.'
        });
      }

      finalIdNumber = number;
    }

    const existingFrontHash =
      verification.id_front_hash ||
      (
        verification.id_front
          ? hashBuffer(verification.id_front)
          : null
      );

    const existingBackHash =
      verification.id_back_hash ||
      (
        verification.id_back
          ? hashBuffer(verification.id_back)
          : null
      );

    const finalFrontHash = front
      ? hashBuffer(front.buffer)
      : existingFrontHash;

    const finalBackHash = back
      ? hashBuffer(back.buffer)
      : existingBackHash;

    if (!finalFrontHash || !finalBackHash) {
      await rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Front and back ID photos are required.'
      });
    }

    if (finalFrontHash === finalBackHash) {
      await rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Front and back ID photos cannot be identical.'
      });
    }

    const hasChanges =
      finalIdType !== verification.id_type ||
      finalIdNumber !== verification.id_number ||
      (front && finalFrontHash !== existingFrontHash) ||
      (back && finalBackHash !== existingBackHash);

    if (!hasChanges) {
      await rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Correct an ID detail or capture a new ID photo.'
      });
    }

    // Update only the supplied ID information and photos.
    const updates = [
      'id_type = ?',
      'id_number = ?',
      'verification_status = ?'
    ];

    const values = [
      finalIdType,
      finalIdNumber,
      'pending'
    ];

    if (front) {
      updates.push(
        'id_front = ?',
        'id_front_type = ?',
        'id_front_hash = ?'
      );

      values.push(
        front.buffer,
        front.mimetype,
        finalFrontHash
      );
    }

    if (back) {
      updates.push(
        'id_back = ?',
        'id_back_type = ?',
        'id_back_hash = ?'
      );

      values.push(
        back.buffer,
        back.mimetype,
        finalBackHash
      );
    }

    const result = await query(
      `UPDATE citizen_verifications
       SET ${updates.join(', ')}
       WHERE verification_id = ?
         AND user_id = ?
         AND verification_status = 'rejected'`,
      [...values, verification.verification_id, userId]
    );

    if (result.affectedRows !== 1) {
      throw new Error('VERIFICATION_RESUBMISSION_CONFLICT');
    }

    // Synchronize the document hash registry whenever
    // ID images are submitted. The unique hash constraint
    // prevents using another citizen's ID document.
    if (front || back) {
      await query(
        `DELETE FROM citizen_document_hashes
         WHERE verification_id = ?`,
        [verification.verification_id]
      );

      for (const documentHash of new Set([
        finalFrontHash,
        finalBackHash
      ])) {
        await query(
          `INSERT INTO citizen_document_hashes
             (document_hash, verification_id)
           VALUES (?, ?)`,
          [documentHash, verification.verification_id]
        );
      }
    }

    // =====================================================
    // NOTIFY REVIEWER — CITIZEN VERIFICATION RESUBMITTED
    // =====================================================

    const citizenBarangay = String(
      verification.citizen_barangay || ''
    ).trim();

    const notificationMessage = citizenBarangay
      ? `A citizen from ${citizenBarangay} has resubmitted their identity verification. Please review the updated application.`
      : 'A citizen has resubmitted their identity verification. Please review the updated application.';

    // Notify all approved, authorized Barangay LGU reviewers
    // assigned to this citizen's barangay.
    const reviewerNotifications = await query(
      `INSERT INTO notifications (
         user_id,
         type,
         title,
         message,
         reference_type,
         reference_id
       )
       SELECT DISTINCT
         reviewer.user_id,
         'account',
         'Citizen Verification Resubmitted',
         ?,
         'citizen',
         ?
       FROM users reviewer
       INNER JOIN lgu_registrations lgu
         ON lgu.user_id = reviewer.user_id
       WHERE reviewer.role = 'lgu'
         AND reviewer.status = 'active'
         AND reviewer.deleted_at IS NULL
         AND lgu.lgu_level = 'barangay'
         AND lgu.verification_status = 'approved'
         AND lgu.can_verify_citizens = 1
         AND LOWER(TRIM(lgu.lgu_barangay)) =
             LOWER(TRIM(?))`,
      [
        notificationMessage,
        Number(userId),
        citizenBarangay
      ]
    );

    // If no authorized Barangay LGU exists,
    // send the notification to the City Super Admin.
    if (reviewerNotifications.affectedRows === 0) {
      const superAdminId = Number(
        process.env.CITY_SUPER_ADMIN_ID
      );

      if (
        !Number.isSafeInteger(superAdminId) ||
        superAdminId <= 0
      ) {
        throw new Error(
          'City Super Admin is not configured.'
        );
      }

      const fallbackNotification = await query(
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
           'Citizen Verification Resubmitted',
           ?,
           'citizen',
           ?
         FROM users u
         WHERE u.user_id = ?
           AND u.role = 'admin'
           AND u.status = 'active'
           AND u.deleted_at IS NULL
         LIMIT 1`,
        [
          notificationMessage,
          Number(userId),
          superAdminId
        ]
      );

      if (fallbackNotification.affectedRows !== 1) {
        throw new Error(
          'Unable to notify an authorized reviewer.'
        );
      }
    }

    await new Promise((resolve, reject) => {
      connection.commit((error) => {
        if (error) return reject(error);
        resolve();
      });
    });

    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: 'Identity verification resubmitted successfully. Awaiting LGU review.',
      verification_status: 'pending'
    });

  } catch (error) {
    if (connection && transactionStarted) {
      await rollback();
    }

    console.error(
      'CITIZEN RESUBMISSION ERROR:',
      error.code || error.message
    );

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'An ID document or identification number is already registered.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to resubmit identity verification.'
    });

  } finally {
    if (connection) connection.release();
  }
};
module.exports = {
  getCitizenProfile,
  updateCitizenProfile,
  getProfilePicture,
  resubmitCitizenVerification
};
