
const express = require('express');
const multer = require('multer');
const db = require('../config/db');

const {
  verifyToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();
const requireVerifiedPartner = require(
  '../middleware/requireVerifiedPartner'
);

/* =====================================================
   PROFILE PICTURE UPLOAD
===================================================== */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          'Only JPG, PNG, and WebP images are allowed.'
        )
      );
    }

    cb(null, true);
  }
});

/* =====================================================
   GET ALL ACTIVE PARTNERS
===================================================== */

router.get('/', (req, res) => {
  const sql = `
    SELECT partner_id, organization_name
    FROM partners
    WHERE status = 'active'
    ORDER BY organization_name ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch partners.'
      });
    }

    return res.json({
      success: true,
      partners: results
    });
  });
});
  /* =====================================================
   PUBLIC LOGO FOR VERIFIED ESTABLISHMENTS
===================================================== */

router.get('/public/:partnerId/logo', (req, res) => {
  const partnerId = Number(req.params.partnerId);

  if (!Number.isSafeInteger(partnerId) || partnerId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid establishment ID.'
    });
  }

  const sql = `
    SELECT
      profile_picture,
      profile_picture_type
    FROM partners
    WHERE partner_id = ?
      AND status = 'active'
    LIMIT 1
  `;

  db.query(sql, [partnerId], (error, rows) => {
    if (error) {
      console.error('PARTNER LOGO ERROR:', error);

      return res.status(500).json({
        success: false,
        message: 'Unable to load establishment logo.'
      });
    }

    if (!rows.length || !rows[0].profile_picture) {
      return res.status(404).json({
        success: false,
        message: 'Establishment logo unavailable.'
      });
    }

    const logo = rows[0];

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(logo.profile_picture_type)) {
      return res.status(415).json({
        success: false,
        message: 'Unsupported logo format.'
      });
    }

    res.set('Content-Type', logo.profile_picture_type);
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');

    return res.send(logo.profile_picture);
  });
});
/* =====================================================
   GET LOGGED-IN ESTABLISHMENT PROFILE
===================================================== */

router.get(
  '/profile',
  verifyToken,
  authorizeRoles('partner'),
  (req, res) => {
    const userId = req.user.user_id;

    const sql = `
      SELECT
        p.partner_id,
        p.organization_name,
        p.contact_person,
        p.email AS organization_email,
        p.phone,
        p.status AS partner_status,
        (
  SELECT avr.rejection_reason
  FROM account_verification_reviews avr
  WHERE avr.account_type = 'establishment'
    AND avr.account_id = p.partner_id
    AND avr.decision = 'rejected'
  ORDER BY avr.review_id DESC
  LIMIT 1
) AS rejection_reason,

        p.business_permit_number,
        p.business_address,
        p.business_barangay,
        p.representative_id_type,
p.representative_id_number,

        p.claim_location,
        p.claim_instructions,

        p.profile_picture_type,

        p.created_at,
        p.updated_at,

        u.user_id,
       TRIM(CONCAT_WS(' ',
  NULLIF(u.first_name, ''),
  NULLIF(u.middle_name, ''),
  NULLIF(u.last_name, ''),
  NULLIF(u.suffix, '')
)) AS full_name,
        u.email,
        u.role,
        u.status AS account_status

      FROM partners p

      INNER JOIN users u
        ON p.user_id = u.user_id

      WHERE p.user_id = ?
      LIMIT 1
    `;

    db.query(sql, [userId], (err, results) => {
      if (err) {
        console.error(
          'GET PARTNER PROFILE ERROR:',
          err.code
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to load establishment profile.'
        });
      }

      if (!results.length) {
        return res.status(404).json({
          success: false,
          message: 'Establishment profile not found.'
        });
      }

      const partner = results[0];

      partner.profile_picture_url =
        '/api/partners/profile/picture';

      return res.status(200).json({
        success: true,
        partner
      });
    });
  }
);

/* =====================================================
   GET ESTABLISHMENT PROFILE PICTURE
===================================================== */

router.get(
  '/profile/picture',
  verifyToken,
  authorizeRoles('partner'),
  (req, res) => {
    const userId = req.user.user_id;

    db.query(
      `SELECT
         profile_picture,
         profile_picture_type
       FROM partners
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
      (err, results) => {
        if (err) {
          console.error(
            'GET PARTNER PICTURE ERROR:',
            err.code
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to load profile picture.'
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
      }
    );
  }
);

/* =====================================================
   UPDATE ESTABLISHMENT PROFILE PICTURE ONLY
===================================================== */

router.put(
  '/profile/picture',
  verifyToken,
  authorizeRoles('partner'),
  upload.single('profile_picture'),
  (req, res) => {

    const userId = req.user.user_id;

    if (Object.keys(req.body || {}).length > 0) {
      return res.status(403).json({
        success: false,
        message:
          'Registered establishment information cannot be edited.'
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
      `UPDATE partners
       SET
         profile_picture = ?,
         profile_picture_type = ?,
         updated_at = NOW()
       WHERE user_id = ?`,
      [
        image,
        req.file.mimetype,
        userId
      ],
      (err, result) => {
        if (err) {
          console.error(
            'UPDATE PARTNER PICTURE ERROR:',
            err.code
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to update profile picture.'
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'Establishment profile not found.'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Profile picture updated successfully.'
        });
      }
    );
  }
);

/* =====================================================
   UPDATE REWARD CLAIM DETAILS
===================================================== */

router.put(
  '/claim-details',
  verifyToken,
  authorizeRoles('partner'),
  (req, res) => {
    const userId = req.user.user_id;

    const {
      claim_location,
      claim_instructions
    } = req.body || {};

    if (
      typeof claim_location !== 'string' ||
      !claim_location.trim() ||
      typeof claim_instructions !== 'string' ||
      !claim_instructions.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Claim location and claim instructions are required.'
      });
    }

    db.query(
      `UPDATE partners
       SET
         claim_location = ?,
         claim_instructions = ?,
         updated_at = NOW()
       WHERE user_id = ?`,
      [
        claim_location.trim(),
        claim_instructions.trim(),
        userId
      ],
      (err, result) => {
        if (err) {
          console.error(
            'UPDATE CLAIM DETAILS ERROR:',
            err.code
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to update claim details.'
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: 'Establishment profile not found.'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Claim details updated successfully.',
          claim_location: claim_location.trim(),
          claim_instructions: claim_instructions.trim()
        });
      }
    );
  }
);

/* =====================================================
   UPLOAD ERROR HANDLING
===================================================== */

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Profile picture must not exceed 5 MB.'
          : err.message
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  next();
});

module.exports = router;
