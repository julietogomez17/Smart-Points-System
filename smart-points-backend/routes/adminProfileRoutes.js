
const express = require('express');
const multer = require('multer');
const db = require('../config/db');

const {
  verifyToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

const profileAccess = [
  verifyToken,
  authorizeRoles('admin', 'lgu')
];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowed.includes(file.mimetype)) {
      return callback(
        new Error('Only JPG, PNG, and WebP images are allowed.')
      );
    }

    callback(null, true);
  }
});

// GET ADMIN PROFILE

router.get('/profile', ...profileAccess, (req, res) => {
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
      u.role,
      u.status,
      u.created_at,
      u.profile_picture_type,

      l.lgu_level,
      l.lgu_barangay,
      l.lgu_office,
      l.lgu_office_address,
      l.lgu_office_contact,
      l.lgu_designation,
      l.representative_id_number,
      l.verification_status AS lgu_verification_status,
      l.rejection_reason

    FROM users u
    LEFT JOIN lgu_registrations l
      ON l.user_id = u.user_id

    WHERE u.user_id = ?
      AND u.role IN ('admin', 'lgu')
    LIMIT 1
  `;

  db.query(sql, [req.user.user_id], (error, results) => {
    if (error) {
      console.error('PROFILE ERROR:', error.code);
      return res.status(500).json({
        success: false,
        message: 'Unable to load profile.'
      });
    }

    if (!results.length) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found.'
      });
    }

    return res.json({
      success: true,
      profile: results[0]
    });
  });
});

// GET ADMIN PROFILE PICTURE
router.get(
  '/profile/picture',
  ...profileAccess,
  (req, res) => {
    db.query(
      `SELECT
         profile_picture,
         profile_picture_type
       FROM users
       WHERE user_id = ?
        AND role IN ('admin', 'lgu')
       LIMIT 1`,
      [req.user.user_id],
      (error, results) => {
        if (error) {
          console.error(
            'GET ADMIN PICTURE:',
            error.code
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve profile picture.'
          });
        }

        if (
          !results.length ||
          !results[0].profile_picture
        ) {
          return res.status(404).json({
            success: false,
            message: 'No profile picture uploaded.'
          });
        }

        res.set(
          'Content-Type',
          results[0].profile_picture_type ||
            'image/jpeg'
        );

        res.set('Cache-Control', 'no-store');
        res.set('X-Content-Type-Options', 'nosniff');

        return res.send(results[0].profile_picture);
      }
    );
  }
);

// UPDATE ADMIN PROFILE PICTURE
router.put(
  '/profile/picture',
  ...profileAccess,
  upload.single('profile_picture'),
  (req, res) => {
    if (Object.keys(req.body || {}).length > 0) {
      return res.status(403).json({
        success: false,
        message:
          'Administrator personal information is read-only.'
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Please select a profile picture.'
      });
    }

    const image = req.file.buffer;

    const jpeg =
      image.length >= 3 &&
      image[0] === 0xff &&
      image[1] === 0xd8 &&
      image[2] === 0xff;

    const png =
      image.length >= 8 &&
      image.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );

    const webp =
      image.length >= 12 &&
      image.toString('ascii', 0, 4) === 'RIFF' &&
      image.toString('ascii', 8, 12) === 'WEBP';

    const valid =
      (req.file.mimetype === 'image/jpeg' && jpeg) ||
      (req.file.mimetype === 'image/png' && png) ||
      (req.file.mimetype === 'image/webp' && webp);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image format.'
      });
    }

    db.query(
      `UPDATE users
       SET
         profile_picture = ?,
         profile_picture_type = ?
       WHERE user_id = ?
        AND role IN ('admin', 'lgu')`,
      [
        image,
        req.file.mimetype,
        req.user.user_id
      ],
      (error, result) => {
        if (error) {
          console.error(
            'UPDATE ADMIN PICTURE:',
            error.code
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to update profile picture.'
          });
        }

        if (!result.affectedRows) {
          return res.status(404).json({
            success: false,
            message: 'Administrator not found.'
          });
        }

        return res.json({
          success: true,
          message: 'Profile picture updated successfully.'
        });
      }
    );
  }
);

/* =====================================================
   LGU VERIFICATION RESUBMISSION
   ===================================================== */

const uploadLGUResubmit = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
    fields: 4
  },
  fileFilter: (req, file, callback) => {
    if (![
      'image/jpeg',
      'image/png',
      'application/pdf'
    ].includes(file.mimetype)) {
      return callback(
        new Error('Only JPG, PNG or PDF documents are allowed.')
      );
    }

    callback(null, true);
  }
}).fields([
  { name: 'lgu_loi', maxCount: 1 },
  { name: 'lgu_id', maxCount: 1 }
]);

const validLGUResubmitFile = (file) => {
  if (!file) return true;

  const buffer = file.buffer;

  if (
    !buffer ||
    !buffer.length ||
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

  const pdf =
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString() === '%PDF-';

  return (
    (file.mimetype === 'image/jpeg' && jpeg) ||
    (file.mimetype === 'image/png' && png) ||
    (file.mimetype === 'application/pdf' && pdf)
  );
};

router.put(
  '/profile/resubmit',
  verifyToken,
  authorizeRoles('lgu'),
  uploadLGUResubmit,
  async (req, res) => {
    const data = req.body || {};

    const officeAddress =
      String(data.lgu_office_address || '').trim();

    const officeContact =
      String(data.lgu_office_contact || '').trim();

    const designation =
      String(data.lgu_designation || '').trim();

    const idNumber =
      String(data.representative_id_number || '').trim();

    const loi = req.files?.lgu_loi?.[0] || null;
    const idFile = req.files?.lgu_id?.[0] || null;

    if (
      !officeAddress ||
      officeAddress.length > 255 ||
      !officeContact ||
      officeContact.length > 50 ||
      !designation ||
      designation.length > 150 ||
      idNumber.length < 3 ||
      idNumber.length > 50 ||
      !/^[A-Za-z0-9][A-Za-z0-9 /-]*[A-Za-z0-9]$/.test(idNumber)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid LGU information.'
      });
    }

    if (
      !validLGUResubmitFile(loi) ||
      !validLGUResubmitFile(idFile)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification document.'
      });
    }

    if (
      loi && idFile &&
      loi.buffer.equals(idFile.buffer)
    ) {
      return res.status(400).json({
        success: false,
        message: 'LOI and ID cannot be identical documents.'
      });
    }

    let connection;
    let transactionStarted = false;

    try {
      connection = await new Promise((resolve, reject) => {
        db.getConnection((error, conn) => {
          if (error) reject(error);
          else resolve(conn);
        });
      });

      const query = (sql, params = []) =>
        new Promise((resolve, reject) => {
          connection.query(sql, params, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });

      await query('START TRANSACTION');
      transactionStarted = true;

     const rows = await query(`
  SELECT
    l.lgu_registration_id,
    l.lgu_office,
    l.verification_status,
    l.lgu_office_address,
    l.lgu_office_contact,
    l.lgu_designation,
    l.representative_id_number
        FROM lgu_registrations l
        INNER JOIN users u
          ON u.user_id = l.user_id
        WHERE l.user_id = ?
          AND u.role = 'lgu'
          AND u.status = 'active'
          AND u.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `, [req.user.user_id]);

      if (
        !rows.length ||
        rows[0].verification_status !== 'rejected'
      ) {
        await query('ROLLBACK');
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message:
            'Only rejected LGU registrations can be resubmitted.'
        });
      }

      const previous = rows[0];

      const hasChanges =
        officeAddress !== previous.lgu_office_address ||
        officeContact !== previous.lgu_office_contact ||
        designation !== previous.lgu_designation ||
        idNumber !== previous.representative_id_number ||
        Boolean(loi) ||
        Boolean(idFile);

      if (!hasChanges) {
        await query('ROLLBACK');
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message:
            'Please correct information or upload a replacement document.'
        });
      }

      const result = await query(`
        UPDATE lgu_registrations
        SET
          lgu_office_address = ?,
          lgu_office_contact = ?,
          lgu_designation = ?,
          representative_id_number = ?,
          loi_file = COALESCE(?, loi_file),
          loi_file_type = COALESCE(?, loi_file_type),
          representative_id_file =
            COALESCE(?, representative_id_file),
          representative_id_type =
            COALESCE(?, representative_id_type),
          verification_status = 'pending',
          can_verify_citizens = 0,
          can_verify_partners = 0,
          reviewed_by = NULL,
          reviewed_at = NULL,
          rejection_reason = NULL
        WHERE user_id = ?
          AND verification_status = 'rejected'
      `, [
        officeAddress,
        officeContact,
        designation,
        idNumber,
        loi?.buffer || null,
        loi?.mimetype || null,
        idFile?.buffer || null,
        idFile?.mimetype || null,
        req.user.user_id
      ]);

      if (result.affectedRows !== 1) {
        throw new Error('LGU resubmission update failed.');
      }
     
      // =====================================================
      // NOTIFY CITY SUPER ADMIN — LGU RESUBMISSION
      // =====================================================

      const superAdminId = String(
        process.env.CITY_SUPER_ADMIN_ID || ''
      ).trim();

      // Only the configured City Super Admin can
      // receive this application notification.
      if (!/^[1-9]\d*$/.test(superAdminId)) {
        throw new Error(
          'CITY_SUPER_ADMIN_ID is not configured.'
        );
      }

      const superAdmins = await query(
        `
          SELECT user_id
          FROM users
          WHERE user_id = ?
            AND role = 'admin'
            AND status = 'active'
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [superAdminId]
      );

      if (superAdmins.length !== 1) {
        throw new Error(
          'City Super Admin account not found or inactive.'
        );
      }

      const officeName =
        String(previous.lgu_office || '').trim() ||
        'An LGU office';

      const notificationResult = await query(
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
          superAdmins[0].user_id,
          'account',
          'LGU Application Resubmitted',
          `${officeName} has resubmitted its LGU registration application. The updated information is now pending your review.`,
          'lgu_registration',
          previous.lgu_registration_id
        ]
      );

      if (notificationResult.affectedRows !== 1) {
        throw new Error(
          'Failed to create LGU resubmission notification.'
        );
      }

      await query('COMMIT');
      transactionStarted = false;

      return res.json({
        success: true,
        message:
          'LGU verification resubmitted successfully.',
        verification_status: 'pending'
      });

    } catch (error) {
      if (connection && transactionStarted) {
        try {
          await new Promise((resolve) => {
            connection.rollback(() => resolve());
          });
        } catch (_) {
          // Preserve the original error.
        }
      }

      console.error(
        'LGU RESUBMISSION ERROR:',
        error.code || error.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to resubmit LGU verification.'
      });

    } finally {
      if (connection) connection.release();
    }
  }
);

// HANDLE UPLOAD ERRORS
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message:
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Image must not exceed 5 MB.'
          : error.message
    });
  }

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next();
});

module.exports = router;
