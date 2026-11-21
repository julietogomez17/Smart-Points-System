
const db = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const fs = require("fs");
const crypto = require("crypto");
const QRCode = require("qrcode");

const {
  assessParticipationAfterCheckout
} = require("./participationController");



const withTransaction = async (callback) => {
  const connection = await new Promise((resolve, reject) => {
    db.getConnection((error, conn) => {
      if (error) return reject(error);
      resolve(conn);
    });
  });

  const transactionQuery = (sql, params = []) =>
    new Promise((resolve, reject) => {
      connection.query(sql, params, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });

  let transactionStarted = false;

  try {
    await new Promise((resolve, reject) => {
      connection.beginTransaction((error) => {
        if (error) return reject(error);
        resolve();
      });
    });

    transactionStarted = true;

    const result = await callback(transactionQuery);

    await new Promise((resolve, reject) => {
      connection.commit((error) => {
        if (error) return reject(error);
        resolve();
      });
    });

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await new Promise((resolve, reject) => {
          connection.rollback((rollbackError) => {
            if (rollbackError) return reject(rollbackError);
            resolve();
          });
        });
      } catch (rollbackError) {
        console.error("ROLLBACK ERROR:", rollbackError);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

// ==========================================
// HELPERS
// ==========================================

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });

  const generateQrToken = () =>
  crypto.randomBytes(32).toString("hex");

const hashQrToken = (token) =>
  crypto.createHash("sha256")
    .update(token)
    .digest("hex");


const getQrEncryptionKey = () => {
  const keyHex = process.env.QR_ENCRYPTION_KEY;

  if (!keyHex || !/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error("QR_ENCRYPTION_KEY must be 64 hex characters");
  }

  return Buffer.from(keyHex, "hex");
};

const encryptQrToken = (token) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getQrEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex")
  ].join(":");
};

const decryptQrToken = (storedValue) => {
  const parts = storedValue.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted QR credential");
  }

  const [ivHex, tagHex, encryptedHex] = parts;

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getQrEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]).toString("utf8");
};

const buildActivityQrImages = async (
  activityId,
  checkInToken,
  checkOutToken
) => {
  const checkInPayload = JSON.stringify({
    activity_id: activityId,
    type: "check_in",
    token: checkInToken
  });

  const checkOutPayload = JSON.stringify({
    activity_id: activityId,
    type: "check_out",
    token: checkOutToken
  });

  const [checkInQr, checkOutQr] = await Promise.all([
    QRCode.toDataURL(checkInPayload, {
      width: 320,
      margin: 2
    }),
    QRCode.toDataURL(checkOutPayload, {
      width: 320,
      margin: 2
    })
  ]);

  return {
    check_in_qr: checkInQr,
    check_out_qr: checkOutQr
  };
};


const removeUploadedActivityImage = (file) => {
  if (!file) return;
  fs.unlink(file.path, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("ACTIVITY IMAGE CLEANUP ERROR:", error);
    }
  });
};

const getUploadedActivityImagePath = (file) =>
  file ? `/uploads/activities/${file.filename}` : null;

const validNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseGps = (body) => {
  const latitude = validNumber(body.latitude);
  const longitude = validNumber(body.longitude);
  const coverage_radius_m = validNumber(
    body.coverage_radius_m
  );

  if (
    latitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude === null ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      error: "Please select a valid activity location on the map."
    };
  }

  if (
    coverage_radius_m === null ||
    !Number.isInteger(coverage_radius_m) ||
    coverage_radius_m < 50 ||
    coverage_radius_m > 3000
  ) {
    return {
      error: "Event coverage radius must be between 50 and 3000 meters."
    };
  }

  return { latitude, longitude, coverage_radius_m };
};

const parseCapacity = (value) =>
  value === "" || value === undefined || value === null
    ? null
    : Number(value);

const allowedValidationTypes = ["qr"];

const allowedStatuses = [
  "draft", "pending", "open",
  "closed", "completed", "cancelled"
];

// =====================================================
// CITIPOINTS - APPROVED COMMUNITY ACTIVITY CATEGORIES
// =====================================================

const allowedCommunityCategories = [
  "Environmental Protection",
  "Community Cleanliness and Sanitation",
  "Health and Wellness",
  "Disaster Risk Reduction and Management",
  "Community Volunteerism",
  "Public Consultation and Governance",
  "Education and Skills Development",
  "Livelihood and Employment",
  "Youth Development",
  "Senior Citizen Programs",
  "Persons with Disabilities (PWD) Programs",
  "Women and Family Development",
  "Peace and Public Safety",
  "Cultural and Heritage Programs",
  "Sports and Recreation",
  "Agriculture and Urban Gardening",
  "Social Welfare and Community Assistance",
  "Civic Awareness and Citizenship"
];

const isAllowedCommunityCategory = (category) => {
  return (
    typeof category === "string" &&
    allowedCommunityCategories.includes(category.trim())
  );
};

const validateActivitySchedule = (start, end, callback) => {
  const validFormat = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value) &&
    !Number.isNaN(
      new Date(value.replace(" ", "T")).getTime()
    );

  if (!validFormat(start) || !validFormat(end)) {
    return callback(
      null,
      "A valid start date and end date are required."
    );
  }

  db.query(
    `SELECT
      CAST(? AS DATETIME) <= NOW() AS invalid_start,
      CAST(? AS DATETIME) <= CAST(? AS DATETIME)
        AS invalid_end`,
    [start, end, start, end],
    (error, rows) => {
      if (error) return callback(error);

      if (rows[0].invalid_start) {
        return callback(
          null,
          "Activity start date and time must be in the future."
        );
      }

      if (rows[0].invalid_end) {
        return callback(
          null,
          "Activity end date and time must be later than the start date."
        );
      }

      callback(null, null);
    }
  );
};

const validateSchedule = (start, end) =>
  new Promise((resolve, reject) => {
    validateActivitySchedule(
      start,
      end,
      (error, message) => {
        if (error) return reject(error);
        resolve(message);
      }
    );
  });

const closeExpiredActivities = (callback = () => {}) => {
  db.query(
    `UPDATE activities
     SET status = 'closed'
     WHERE status = 'open'
       AND date_end IS NOT NULL
       AND date_end <= NOW()`,
    (error, result) => {
      if (error) {
        console.error("AUTO CLOSE ACTIVITIES ERROR:", error);
      } else if (result.affectedRows > 0) {
        console.log(
          `${result.affectedRows} expired activities automatically closed.`
        );
      }
      callback(error);
    }
  );
};



const auditActivity = (
  userId,
  action,
  activityId,
  details
) => {
  return logAudit({
    actorUserId: userId,
    actionType: action,
    entityType: "activity",
    entityId: activityId,
    details
  }).catch((error) => {
    console.error("ACTIVITY AUDIT ERROR:", error);
  });
};

// ==========================================
// GET ALL ACTIVITIES
// ==========================================

const getAllActivities = (req, res) => {
  closeExpiredActivities((closeErr) => {
    if (closeErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to update expired activities"
      });
    }

    const userRole = req.user?.role || null;
    const userId = req.user?.user_id || null;

    let sql = `
      SELECT
        a.activity_id,
        a.title,
        a.description,
        a.category,
        a.location,
        a.latitude,
        a.longitude,
        a.coverage_radius_m,
        a.date_start,
        a.date_end,
        a.points_value,
        a.capacity,
        a.validation_type,
        a.status,
        a.image_url,
        a.partner_id,
        p.organization_name AS partner_name,
        a.created_by,
        a.created_at,
        (
          SELECT COUNT(*)
          FROM activity_registrations ar2
          WHERE ar2.activity_id = a.activity_id
            AND ar2.registration_status = 'registered'
        ) AS joined_count,
        CASE
          WHEN ar.user_id IS NOT NULL THEN true
          ELSE false
        END AS is_joined,
        ar.registration_status,
        COALESCE(pr.status, 'pending')
          AS participation_status,
        pr.proof_url,
        pr.ai_reason AS rejection_reason,
        COALESCE(pr.awarded_points, 0)
          AS awarded_points
      FROM activities a
      LEFT JOIN partners p
        ON a.partner_id = p.partner_id
      LEFT JOIN activity_registrations ar
        ON ar.activity_id = a.activity_id
       AND ar.user_id = ?
      LEFT JOIN participation_records pr
        ON pr.activity_id = a.activity_id
       AND pr.user_id = ?
    `;

if (userRole === "partner" || userRole === "lgu") {
      sql += `
        WHERE a.status = 'open'
           OR a.created_by = ?
      `;
    } else if (userRole !== "admin") {
      sql += `
        WHERE a.status = 'open'
           OR ar.user_id IS NOT NULL
      `;
    }

    sql += " ORDER BY a.date_start DESC";

   const params = (userRole === "partner" || userRole === "lgu")
      ? [userId, userId, userId]
      : [userId, userId];

    db.query(sql, params, (error, results) => {
      if (error) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch activities",
          error: error.message
        });
      }

      return res.status(200).json({
        success: true,
        count: results.length,
        activities: results
      });
    });
  });
};

// ==========================================
// GET SINGLE ACTIVITY
// ==========================================

const getActivityById = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      a.activity_id,
      a.title,
      a.description,
      a.category,
      a.location,
      a.latitude,
      a.longitude,
      a.coverage_radius_m,
      a.date_start,
      a.date_end,
      a.points_value,
      a.capacity,
      a.validation_type,
      a.status,
      a.image_url,
      a.partner_id,
      p.organization_name AS partner_name,
      a.created_by,
      a.created_at
    FROM activities a
    LEFT JOIN partners p
      ON a.partner_id = p.partner_id
    WHERE a.activity_id = ?
  `;

  db.query(sql, [id], (error, results) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity",
        error: error.message
      });
    }

    if (!results.length) {
      return res.status(404).json({
        success: false,
        message: "Activity not found"
      });
    }

    const activity = results[0];

   if (
  req.user.role === "lgu" &&
  activity.status !== "open" &&
  Number(activity.created_by) !== Number(req.user.user_id)
) {
  return res.status(403).json({
    success: false,
    message: "You cannot view another organizer's inactive activity."
  });
}

if (
  req.user.role !== "admin" &&
  req.user.role !== "partner" &&
  req.user.role !== "lgu" &&
  activity.status !== "open"
) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. This activity is not available."
      });
    }

    if (
      req.user.role === "partner" &&
      activity.status === "pending" &&
      Number(activity.created_by) !==
        Number(req.user.user_id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You can only view your own pending activities."
      });
    }

    return res.status(200).json({
      success: true,
      activity
    });
  });
};

// ==========================================
// CREATE ACTIVITY
// ==========================================

const createActivity = async (req, res) => {
  const {
    title,
    description,
    category,
    location,
    date_start,
    date_end,
    points_value,
    capacity,
    validation_type,
    status,
    partner_id
  } = req.body;

  const userId = req.user.user_id;
  const userRole = req.user.role;
  const imagePath = getUploadedActivityImagePath(req.file);



  // Only approved community activity categories are accepted.
if (!isAllowedCommunityCategory(category)) {
  removeUploadedActivityImage(req.file);

  return res.status(400).json({
    success: false,
    message:
      "Please select a valid CitiPoints community activity category."
  });
}
  try {
    if (!title || !date_start || points_value === undefined) {
      removeUploadedActivityImage(req.file);

      return res.status(400).json({
        success: false,
        message:
          "Title, date_start, and points_value are required"
      });
    }

    const gps = parseGps(req.body);

    if (gps.error) {
      removeUploadedActivityImage(req.file);

      return res.status(400).json({
        success: false,
        message: gps.error
      });
    }

    const dateMessage = await validateSchedule(
      date_start, date_end
    );

    if (dateMessage) {
      removeUploadedActivityImage(req.file);

      return res.status(400).json({
        success: false,
        message: dateMessage
      });
    }

   const finalValidationType = "qr";

    const finalStatus =
      userRole === "partner"
        ? "pending"
        : allowedStatuses.includes(status)
          ? status
          : "open";

    let finalPartnerId = null;

    if (userRole === "partner") {
      const partners = await query(
        `SELECT partner_id
         FROM partners
         WHERE user_id = ?
         LIMIT 1`,
        [userId]
      );

      if (!partners.length) {
        removeUploadedActivityImage(req.file);

        return res.status(404).json({
          success: false,
          message:
            "No partner organization is linked to this account"
        });
      }

      finalPartnerId = partners[0].partner_id;

        } else if (userRole === "lgu") {
      // LGU accounts are independent from Partner accounts.
      // The activity owner is already stored in created_by.
      finalPartnerId = null;

    } else {
      const requestedPartnerId = Number(partner_id);

      finalPartnerId =
        partner_id === "" ||
        partner_id === undefined ||
        partner_id === null ||
        !Number.isFinite(requestedPartnerId) ||
        requestedPartnerId === 0
          ? null
          : requestedPartnerId;
    }

  
    // ==========================================
    // CREATE ACTIVITY AND QR CODES ATOMICALLY
    // ==========================================

    const result = await withTransaction(async (txQuery) => {

      // STEP 1: CREATE ACTIVITY
      const activityResult = await txQuery(
        `INSERT INTO activities
        (
          title,
          description,
          category,
          location,
          latitude,
          longitude,
          coverage_radius_m,
          date_start,
          date_end,
          points_value,
          capacity,
          validation_type,
          status,
          partner_id,
          image_url,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || null,
          category || null,
          location || null,
          gps.latitude,
          gps.longitude,
          gps.coverage_radius_m,
          date_start,
          date_end,
          Number(points_value),
          parseCapacity(capacity),
          finalValidationType,
          finalStatus,
          finalPartnerId,
          imagePath,
          userId
        ]
      );

      // STEP 2: GENERATE SECURE QR TOKENS
      const checkInToken = generateQrToken();
      const checkOutToken = generateQrToken();

     
      // STEP 3: SAVE HASHED AND ENCRYPTED QR TOKENS
      await txQuery(
        `INSERT INTO activity_qr_codes
        (
          activity_id,
          check_in_token_hash,
          check_out_token_hash,
          check_in_token_encrypted,
          check_out_token_encrypted
        )
        VALUES (?, ?, ?, ?, ?)`,
        [
          activityResult.insertId,
          hashQrToken(checkInToken),
          hashQrToken(checkOutToken),
          encryptQrToken(checkInToken),
          encryptQrToken(checkOutToken)
        ]
      );


      return activityResult;
    });

  

    auditActivity(
      userId,
      "CREATE",
      result.insertId,
      userRole === "partner"
        ? `Partner submitted activity for approval: ${title}`
        : `Admin created activity: ${title}`
    );

    return res.status(201).json({
      success: true,
      message: userRole === "partner"
        ? "Activity submitted successfully and is waiting for admin approval"
        : "Activity created successfully",
      activity_id: result.insertId,
      status: finalStatus,
      partner_id: finalPartnerId,
      latitude: gps.latitude,
      longitude: gps.longitude,
      coverage_radius_m: gps.coverage_radius_m
    });

  } catch (error) {
    removeUploadedActivityImage(req.file);

    console.error("CREATE ACTIVITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create activity",
      error: error.message
    });
  }
};



/* ==========================================
   QR ACCESS VALIDATION
   ========================================== */

const findAuthorizedQrActivity = async (req, res) => {
  const activityId = Number(req.params.id);
  const userId = Number(req.user.user_id);
  const userRole = req.user.role;

  if (!Number.isSafeInteger(activityId) || activityId <= 0) {
    res.status(400).json({
      success: false,
      message: "Invalid activity ID"
    });
    return null;
  }

  const activities = await query(
    `SELECT activity_id, title, status, created_by
     FROM activities
     WHERE activity_id = ?
     LIMIT 1`,
    [activityId]
  );

  if (!activities.length) {
    res.status(404).json({
      success: false,
      message: "Activity not found"
    });
    return null;
  }

  const activity = activities[0];

 const authorized =
  userRole === "admin" ||
  (
    ["partner", "lgu"].includes(userRole) &&
    Number(activity.created_by) === userId
  );

  if (!authorized) {
    res.status(403).json({
      success: false,
      message: "You cannot manage QR codes for this activity"
    });
    return null;
  }

  if (
    activity.status !== "open" ||
    userRole === "partner" && activity.status !== "open"
  ) {
    res.status(400).json({
      success: false,
      message: "QR codes are available only for open activities"
    });
    return null;
  }

  return activity;
};


/* ==========================================
   GET EXISTING QR CODES — NO ROTATION
   ========================================== */

const getActivityQrCodes = async (req, res) => {
  try {
    const activity = await findAuthorizedQrActivity(req, res);

    if (!activity) return;

    const rows = await query(
      `SELECT
         check_in_token_hash,
         check_out_token_hash,
         check_in_token_encrypted,
         check_out_token_encrypted
       FROM activity_qr_codes
       WHERE activity_id = ?
       LIMIT 1`,
      [activity.activity_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "QR credentials not found for this activity"
      });
    }

    const qrRecord = rows[0];

    if (
      !qrRecord.check_in_token_encrypted ||
      !qrRecord.check_out_token_encrypted
    ) {
      return res.status(409).json({
        success: false,
        requires_regeneration: true,
        message:
          "This activity uses legacy QR credentials. Regenerate them once to enable persistent QR display."
      });
    }

    const checkInToken = decryptQrToken(
      qrRecord.check_in_token_encrypted
    );

    const checkOutToken = decryptQrToken(
      qrRecord.check_out_token_encrypted
    );

    // Check stored credentials are consistent.
    if (
      hashQrToken(checkInToken) !== qrRecord.check_in_token_hash ||
      hashQrToken(checkOutToken) !== qrRecord.check_out_token_hash
    ) {
      throw new Error("QR credential integrity check failed");
    }

    const qrImages = await buildActivityQrImages(
      activity.activity_id,
      checkInToken,
      checkOutToken
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      activity_id: activity.activity_id,
      title: activity.title,
      ...qrImages
    });

  } catch (error) {
    console.error("GET ACTIVITY QR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve activity QR codes"
    });
  }
};


/* ==========================================
   REGENERATE QR CODES — EXPLICIT ACTION
   ========================================== */

const regenerateActivityQrCodes = async (req, res) => {
  try {
    const activity = await findAuthorizedQrActivity(req, res);

    if (!activity) return;

    const checkInToken = generateQrToken();
    const checkOutToken = generateQrToken();

    const qrImages = await buildActivityQrImages(
      activity.activity_id,
      checkInToken,
      checkOutToken
    );

    const result = await query(
      `UPDATE activity_qr_codes
       SET
         check_in_token_hash = ?,
         check_out_token_hash = ?,
         check_in_token_encrypted = ?,
         check_out_token_encrypted = ?
       WHERE activity_id = ?`,
      [
        hashQrToken(checkInToken),
        hashQrToken(checkOutToken),
        encryptQrToken(checkInToken),
        encryptQrToken(checkOutToken),
        activity.activity_id
      ]
    );

    if (result.affectedRows !== 1) {
      return res.status(404).json({
        success: false,
        message: "QR credentials not found for this activity"
      });
    }

    auditActivity(
      req.user.user_id,
      "UPDATE",
      activity.activity_id,
      "Regenerated activity Check-In and Check-Out QR credentials"
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      message: "QR codes regenerated successfully",
      activity_id: activity.activity_id,
      title: activity.title,
      ...qrImages
    });

  } catch (error) {
    console.error("REGENERATE ACTIVITY QR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to regenerate activity QR codes"
    });
  }
};




// ==========================================
// UPDATE ACTIVITY
// ==========================================

const updateActivity = async (req, res) => {
  const { id } = req.params;

  const {
    title,
    description,
    category,
    location,
    date_start,
    date_end,
    points_value,
    capacity,
    validation_type,
    status
  } = req.body;

  try {
    const existing = await query(
      `SELECT
         activity_id,
         title,
         created_by,
         status,
         image_url,
         date_end,
         (date_end <= NOW()) AS is_expired
       FROM activities
       WHERE activity_id = ?`,
      [id]
    );

    if (!existing.length) {
      removeUploadedActivityImage(req.file);

      return res.status(404).json({
        success: false,
        message: "Activity not found"
      });
    }

    const activity = existing[0];
    // Prevent changing an activity to an unsupported category.
if (!isAllowedCommunityCategory(category)) {
  removeUploadedActivityImage(req.file);

  return res.status(400).json({
    success: false,
    message:
      "Please select a valid CitiPoints community activity category."
  });
}

   if (
  ["partner", "lgu"].includes(req.user.role) &&
  Number(activity.created_by) !==
    Number(req.user.user_id)
) {
  removeUploadedActivityImage(req.file);

  return res.status(403).json({
    success: false,
    message:
      "Access denied. You can only edit activities created by your own account."
  });
}

    if (
      ["closed", "completed", "cancelled"].includes(
        activity.status
      ) ||
      activity.is_expired
    ) {
      removeUploadedActivityImage(req.file);

      return res.status(400).json({
        success: false,
        message:
          "Historical or expired activities cannot be edited."
      });
    }

    const gps = parseGps(req.body);

    if (gps.error) {
      removeUploadedActivityImage(req.file);

      return res.status(400).json({
        success: false,
        message: gps.error
      });
    }

    const dateMessage = await validateSchedule(
      date_start, date_end
    );

    if (dateMessage) {
      removeUploadedActivityImage(req.file);

      return res.status(400).json({
        success: false,
        message: dateMessage
      });
    }

    const finalValidationType = "qr";

    const finalStatus =
      req.user.role === "partner"
        ? "pending"
        : allowedStatuses.includes(status)
          ? status
          : "draft";

    const imagePath = req.file
      ? getUploadedActivityImagePath(req.file)
      : activity.image_url;

    const result = await query(
      `UPDATE activities
       SET
         title = ?,
         description = ?,
         category = ?,
         location = ?,
         latitude = ?,
         longitude = ?,
         coverage_radius_m = ?,
         date_start = ?,
         date_end = ?,
         points_value = ?,
         capacity = ?,
         validation_type = ?,
         status = ?,
         image_url = ?
       WHERE activity_id = ?
         AND status NOT IN
           ('closed', 'completed', 'cancelled')
         AND (
           date_end IS NULL OR date_end > NOW()
         )`,
      [
        title,
        description || null,
        category || null,
        location || null,
        gps.latitude,
        gps.longitude,
        gps.coverage_radius_m,
        date_start,
        date_end,
        Number(points_value),
        parseCapacity(capacity),
        finalValidationType,
        finalStatus,
        imagePath,
        id
      ]
    );

    if (!result.affectedRows) {
      removeUploadedActivityImage(req.file);

      return res.status(400).json({
        success: false,
        message:
          "Activity not found or no longer editable"
      });
    }

    auditActivity(
      req.user.user_id,
      "UPDATE",
      id,
      req.user.role === "partner"
        ? `Partner updated activity and sent it back to pending review: ${title}`
        : `Updated activity: ${title}`
    );

    return res.status(200).json({
      success: true,
      message: req.user.role === "partner"
        ? "Activity updated and sent back for admin approval"
        : "Activity updated successfully",
      status: finalStatus,
      latitude: gps.latitude,
      longitude: gps.longitude,
      coverage_radius_m: gps.coverage_radius_m
    });

  } catch (error) {
    removeUploadedActivityImage(req.file);

    console.error("UPDATE ACTIVITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update activity",
      error: error.message
    });
  }
};

// ==========================================
// APPROVE PARTNER ACTIVITY
// ==========================================

const approveActivity = (req, res) => {
  const { id } = req.params;

  db.query(
    `UPDATE activities
     SET status = 'open'
     WHERE activity_id = ?
       AND status = 'pending'
       AND date_start > NOW()
       AND date_end IS NOT NULL
       AND date_end > date_start`,
    [id],
    (error, result) => {
      if (error) {
        return res.status(500).json({
          success: false,
          message: "Failed to approve activity",
          error: error.message
        });
      }

      if (!result.affectedRows) {
        return res.status(400).json({
          success: false,
          message:
            "Activity must be pending and have valid future dates."
        });
      }

      auditActivity(
        req.user.user_id,
        "APPROVE",
        id,
        "Approved partner-submitted activity"
      );

      return res.status(200).json({
        success: true,
        message: "Activity approved successfully"
      });
    }
  );
};

// ==========================================
// REJECT PARTNER ACTIVITY
// ==========================================

const rejectActivity = (req, res) => {
  const { id } = req.params;

  db.query(
    `UPDATE activities
     SET status = 'cancelled'
     WHERE activity_id = ?
       AND status = 'pending'`,
    [id],
    (error, result) => {
      if (error) {
        return res.status(500).json({
          success: false,
          message: "Failed to reject activity",
          error: error.message
        });
      }

      if (!result.affectedRows) {
        return res.status(400).json({
          success: false,
          message:
            "Only pending activities can be rejected."
        });
      }

      auditActivity(
        req.user.user_id,
        "REJECT",
        id,
        "Rejected partner-submitted activity"
      );

      return res.status(200).json({
        success: true,
        message: "Activity rejected successfully"
      });
    }
  );
};

// ==========================================
// DELETE / CANCEL ACTIVITY
// ==========================================

const deleteActivity = async (req, res) => {
  const { id } = req.params;

  try {
    const records = await query(
      `SELECT
         activity_id,
         created_by,
         status,
         (date_end <= NOW()) AS is_expired
       FROM activities
       WHERE activity_id = ?`,
      [id]
    );

    if (!records.length) {
      return res.status(404).json({
        success: false,
        message: "Activity not found"
      });
    }

    const activity = records[0];

    if (
  ["partner", "lgu"].includes(req.user.role) &&
  Number(activity.created_by) !==
    Number(req.user.user_id)
) {
  return res.status(403).json({
    success: false,
    message:
      "Access denied. You can only deactivate activities created by your own account."
  });
}
    if (
      ["closed", "completed", "cancelled"].includes(
        activity.status
      ) ||
      activity.is_expired
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Historical or expired activities cannot be deactivated."
      });
    }

    const usage = await query(
      `SELECT
        (
          SELECT COUNT(*)
          FROM activity_registrations
          WHERE activity_id = ?
        ) AS registration_count,
        (
          SELECT COUNT(*)
          FROM participation_records
          WHERE activity_id = ?
        ) AS participation_count`,
      [id, id]
    );

    const isUsed =
      Number(usage[0].registration_count) > 0 ||
      Number(usage[0].participation_count) > 0;

    const result = isUsed
      ? await query(
          `UPDATE activities
           SET status = 'cancelled'
           WHERE activity_id = ?
             AND status NOT IN
               ('closed', 'completed', 'cancelled')
             AND (
               date_end IS NULL OR date_end > NOW()
             )`,
          [id]
        )
      : await query(
          `DELETE FROM activities
           WHERE activity_id = ?
             AND status NOT IN
               ('closed', 'completed', 'cancelled')
             AND (
               date_end IS NULL OR date_end > NOW()
             )`,
          [id]
        );

    if (!result.affectedRows) {
      return res.status(400).json({
        success: false,
        message:
          "Activity is no longer available for cancellation"
      });
    }

    if (isUsed) {
      auditActivity(
        req.user.user_id,
        "CANCEL",
        id,
        "Cancelled activity"
      );
    }

    return res.status(200).json({
      success: true,
      message: isUsed
        ? "Activity is already in use, so it was marked as cancelled instead of being deleted"
        : "Activity deleted successfully"
    });

  } catch (error) {
    console.error("DELETE ACTIVITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete activity",
      error: error.message
    });
  }
};

// ==========================================
// JOIN ACTIVITY
// ==========================================

const joinActivity = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const activities = await query(
      `SELECT
         activity_id,
         title,
         capacity,
         status,
         (
           date_end IS NOT NULL
           AND date_end > NOW()
         ) AS registration_time_valid
       FROM activities
       WHERE activity_id = ?`,
      [id]
    );

    if (!activities.length) {
      return res.status(404).json({
        success: false,
        message: "Activity not found"
      });
    }

    const activity = activities[0];

    if (
      activity.status !== "open" ||
      !activity.registration_time_valid
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This activity is not open for registration"
      });
    }

    const counts = await query(
      `SELECT COUNT(*) AS total
       FROM activity_registrations
       WHERE activity_id = ?
         AND registration_status = 'registered'`,
      [id]
    );

    if (
      activity.capacity !== null &&
      Number(counts[0].total) >=
        Number(activity.capacity)
    ) {
      return res.status(400).json({
        success: false,
        message: "Activity is already full"
      });
    }

    await query(
      `INSERT INTO activity_registrations
       (user_id, activity_id, registration_status)
       VALUES (?, ?, 'registered')`,
      [userId, id]
    );

    return res.status(201).json({
      success: true,
      message: "Joined activity successfully"
    });

  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "You have already joined this activity"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to join activity",
      error: error.message
    });
  }
};

// ==========================================
// UNREGISTER FROM ACTIVITY
// ==========================================

const unregisterActivity = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const registrations = await query(
      `SELECT *
       FROM activity_registrations
       WHERE user_id = ?
         AND activity_id = ?
         AND registration_status = 'registered'
       LIMIT 1`,
      [userId, id]
    );

    if (!registrations.length) {
      return res.status(404).json({
        success: false,
        message:
          "You are not registered for this activity"
      });
    }

    const proofs = await query(
      `SELECT participation_id, proof_url
       FROM participation_records
       WHERE user_id = ?
         AND activity_id = ?
       LIMIT 1`,
      [userId, id]
    );

   if (proofs.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot unregister because participation proof has already been submitted."
      });
    }

    const result = await query(
      `DELETE FROM activity_registrations
       WHERE user_id = ?
         AND activity_id = ?
         AND registration_status = 'registered'`,
      [userId, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Registration could not be found"
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "You have successfully unregistered from the activity"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to unregister from activity",
      error: error.message
    });
  }
};


/* ==========================================
   CITIZEN QR ATTENDANCE
   ========================================== */

const processCitizenQrAttendance = async (req, res, scanType) => {
  try {
    const activityId = Number(req.params.id);
    const userId = Number(req.user.user_id);

    if (!Number.isSafeInteger(activityId) || activityId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID."
      });
    }

    // The scanner sends the decoded QR JSON as qr_data.
    const { qr_data } = req.body || {};

    let qrPayload;

    try {
      qrPayload =
        typeof qr_data === "string"
          ? JSON.parse(qr_data)
          : qr_data;
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid QR code format."
      });
    }

    if (
      !qrPayload ||
      typeof qrPayload !== "object" ||
      Array.isArray(qrPayload) ||
      Number(qrPayload.activity_id) !== activityId ||
      qrPayload.type !== scanType ||
      typeof qrPayload.token !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(qrPayload.token)
    ) {
      return res.status(400).json({
        success: false,
        message: "This QR code is invalid or belongs to another activity."
      });
    }

    // Validate activity and its attendance schedule.
    const activities = await query(
      `SELECT
         activity_id,
         title,
         status,
         date_start,
         date_end,
         (NOW() >= date_start AND NOW() <= date_end)
           AS within_schedule
       FROM activities
       WHERE activity_id = ?
       LIMIT 1`,
      [activityId]
    );

    if (!activities.length) {
      return res.status(404).json({
        success: false,
        message: "Activity not found."
      });
    }

    const activity = activities[0];

    if (activity.status !== "open" || !activity.within_schedule) {
      return res.status(400).json({
        success: false,
        message: "QR attendance is available only during an open activity's scheduled time."
      });
    }

    // Check citizen registration.
    const registrations = await query(
      `SELECT registration_id
       FROM activity_registrations
       WHERE activity_id = ?
         AND user_id = ?
         AND registration_status = 'registered'
       LIMIT 1`,
      [activityId, userId]
    );

    if (!registrations.length) {
      return res.status(403).json({
        success: false,
        message: "You must be registered for this activity before scanning."
      });
    }

    // Retrieve the currently valid QR hash.
    const qrRows = await query(
      `SELECT
         check_in_token_hash,
         check_out_token_hash
       FROM activity_qr_codes
       WHERE activity_id = ?
       LIMIT 1`,
      [activityId]
    );

    if (!qrRows.length) {
      return res.status(404).json({
        success: false,
        message: "QR credentials were not found."
      });
    }

    const expectedHash =
      scanType === "check_in"
        ? qrRows[0].check_in_token_hash
        : qrRows[0].check_out_token_hash;

    const providedHash = hashQrToken(qrPayload.token);

    // Compare hashes without ordinary string equality.
    if (
      typeof expectedHash !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(expectedHash) ||
      !crypto.timingSafeEqual(
        Buffer.from(providedHash, "hex"),
        Buffer.from(expectedHash, "hex")
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired QR token."
      });
    }

    if (scanType === "check_in") {
      // The unique activity/user key prevents duplicate rows.
      const result = await query(
        `INSERT IGNORE INTO activity_attendance
           (activity_id, user_id, check_in_at)
         VALUES (?, ?, NOW())`,
        [activityId, userId]
      );

      if (result.affectedRows !== 1) {
        return res.status(409).json({
          success: false,
          message: "You have already checked in for this activity."
        });
      }

      return res.status(200).json({
        success: true,
        message: "Check-In successful!",
        activity_id: activityId,
        attendance_status: "checked_in"
      });
    }

    // Require participation proof before check-out.
    const proofs = await query(
      `SELECT participation_id
       FROM participation_records
       WHERE activity_id = ?
         AND user_id = ?
         AND proof_url IS NOT NULL
         AND proof_url <> ''
       LIMIT 1`,
      [activityId, userId]
    );

    if (!proofs.length) {
      return res.status(400).json({
        success: false,
        message: "Submit your participation proof before checking out."
      });
    }

    // Atomically update only a previously checked-in record.
    const result = await query(
      `UPDATE activity_attendance
       SET check_out_at = NOW()
       WHERE activity_id = ?
         AND user_id = ?
         AND check_in_at IS NOT NULL
         AND check_out_at IS NULL`,
      [activityId, userId]
    );

    if (result.affectedRows !== 1) {
      return res.status(409).json({
        success: false,
        message: "Check-Out unavailable. You may not have checked in, or you have already checked out."
      });
    }

    
    // ======================================
    // RUN AI AFTER SUCCESSFUL QR CHECK-OUT
    // ======================================

    const participationId = proofs[0].participation_id;

    try {
      const assessment = await assessParticipationAfterCheckout(
        participationId
      );

      return res.status(200).json({
        success: true,
        message:
          assessment.status === "completed"
            ? "Check-Out successful! AI fraud assessment completed. Your participation is awaiting LGU review."
            : "Check-Out successful! AI fraud assessment is processing.",

        activity_id: activityId,
        participation_id: participationId,
        attendance_status: "checked_out",
        ai_assessment_status: assessment.status
      });

    } catch (aiError) {
      console.error(
        "AI ASSESSMENT AFTER CHECK-OUT ERROR:",
        aiError
      );

      return res.status(200).json({
        success: true,
        message:
          "QR Check-Out was successful, but AI assessment failed. Your participation is not yet available for LGU review.",

        activity_id: activityId,
        participation_id: participationId,
        attendance_status: "checked_out",
        ai_assessment_status: "failed"
      });
    }


  } catch (error) {
    console.error("CITIZEN QR ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process QR attendance."
    });
  }
};

const checkInActivity = (req, res) =>
  processCitizenQrAttendance(req, res, "check_in");

const checkOutActivity = (req, res) =>
  processCitizenQrAttendance(req, res, "check_out");

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

module.exports = {
  getAllActivities,
  getActivityById,
  getActivityQrCodes,
  regenerateActivityQrCodes,
  createActivity,
  updateActivity,
  approveActivity,
  rejectActivity,
  deleteActivity,
  joinActivity,
  unregisterActivity,
   checkInActivity,
  checkOutActivity
};
