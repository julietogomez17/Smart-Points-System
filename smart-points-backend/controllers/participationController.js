
const USER_NAME_SQL = `
  TRIM(CONCAT_WS(' ',
    NULLIF(TRIM(u.first_name), ''),
    NULLIF(TRIM(u.middle_name), ''),
   NULLIF(TRIM(u.last_name), ''),
    NULLIF(TRIM(u.suffix), '')
  ))
`;

const db = require("../config/db");
const fs = require("fs");
const crypto = require("crypto");
const exifr = require("exifr");

const { checkFraudRisk } = require("../services/aiService");
const { createNotification } = require("./notificationController");

// ==========================================
// DATABASE HELPER
// ==========================================

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });

// ==========================================
// RANK SYSTEM
// ==========================================

const RANKS = [
  { name: "New", required: 0, bonus: 0 },
  { name: "Bronze", required: 100, bonus: 50 },
  { name: "Silver", required: 400, bonus: 100 },
  { name: "Gold", required: 700, bonus: 200 },
  { name: "Platinum", required: 1100, bonus: 350 },
  { name: "Diamond", required: 1500, bonus: 500 }
];

const getMonthKey = () => {
  const now = new Date();

  return (
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, "0")}`
  );
};

const getRankByPoints = (points) => {
  let rank = RANKS[0];

  for (const item of RANKS) {
    if (Number(points || 0) >= item.required) {
      rank = item;
    }
  }

  return rank;
};

const getRankIndex = (name) =>
  RANKS.findIndex(rank => rank.name === name);

const handleRankProgress = (userId, callback = () => {}) => {
  const run = async () => {
    const seasonMonth = getMonthKey();

    await query(
      `INSERT INTO user_rank_profiles
       (user_id, current_rank, last_active_month)
       VALUES (?, 'New', ?)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId, seasonMonth]
    );

    const profiles = await query(
      `SELECT current_rank, last_active_month
       FROM user_rank_profiles
       WHERE user_id = ?`,
      [userId]
    );

    const currentRank =
      profiles[0]?.current_rank || "New";

    const pointRows = await query(
      `SELECT COALESCE(SUM(awarded_points), 0)
         AS season_points
       FROM participation_records
       WHERE user_id = ?
         AND status = 'approved'
         AND DATE_FORMAT(reviewed_at, '%Y-%m') = ?`,
      [userId, seasonMonth]
    );

    const seasonPoints =
      Number(pointRows[0]?.season_points || 0);

    const earnedRank = getRankByPoints(seasonPoints);

    if (
      getRankIndex(earnedRank.name) <=
      getRankIndex(currentRank) ||
      earnedRank.name === "New"
    ) {
      await query(
        `UPDATE user_rank_profiles
         SET last_active_month = ?
         WHERE user_id = ?`,
        [seasonMonth, userId]
      );

      return {
        rankedUp: false,
        currentRank,
        seasonPoints
      };
    }

    try {
      await query(
        `INSERT INTO season_rank_claims
         (user_id, season_month, rank_name, bonus_points)
         VALUES (?, ?, ?, ?)`,
        [
          userId,
          seasonMonth,
          earnedRank.name,
          earnedRank.bonus
        ]
      );

    } catch (error) {
      if (error.code !== "ER_DUP_ENTRY") {
        throw error;
      }

      return {
        rankedUp: false,
        currentRank: earnedRank.name,
        seasonPoints,
        message: "Rank bonus already claimed this month"
      };
    }

    const balances = await query(
      `SELECT points_balance
       FROM users
       WHERE user_id = ?`,
      [userId]
    );

    const oldBalance =
      Number(balances[0]?.points_balance || 0);

    const newBalance =
      oldBalance + earnedRank.bonus;

    await query(
      `UPDATE users
       SET points_balance = points_balance + ?
       WHERE user_id = ?`,
      [earnedRank.bonus, userId]
    );

    try {
      await query(
        `INSERT INTO point_transactions
         (user_id, source_type, source_id,
          points_delta, balance_after, notes)
         VALUES (?, 'rank_bonus', NULL, ?, ?, ?)`,
        [
          userId,
          earnedRank.bonus,
          newBalance,
          `Rank-up bonus: ${earnedRank.name} (${seasonMonth})`
        ]
      );

    } catch (error) {
      console.error(
        "RANK BONUS TRANSACTION ERROR:",
        error
      );
    }

    await query(
      `UPDATE user_rank_profiles
       SET current_rank = ?,
           last_active_month = ?
       WHERE user_id = ?`,
      [
        earnedRank.name,
        seasonMonth,
        userId
      ]
    );

    return {
      rankedUp: true,
      newRank: earnedRank.name,
      bonusPoints: earnedRank.bonus,
      seasonPoints
    };
  };

  run()
    .then(result => callback(null, result))
    .catch(error => callback(error));
};

// ==========================================
// FILE HASH
// ==========================================

const generateFileHash = (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);

    return crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex");

  } catch (error) {
    console.error("PROOF HASH ERROR:", error);
    return null;
  }
};

// ==========================================
// GPS HELPERS
// ==========================================

// Allows several common database naming
// conventions without assuming a fixed radius.

const firstConfiguredValue = (source, names) => {
  for (const name of names) {
    if (
      source[name] !== undefined &&
      source[name] !== null &&
      source[name] !== ""
    ) {
      return source[name];
    }
  }

  return null;
};

const optionalNumber = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "boolean") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const validCoordinates = (lat, lng) =>
  lat !== null &&
  lng !== null &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

const getActivityGps = (activity) => {
  const event_lat = optionalNumber(
    firstConfiguredValue(activity, [
      "latitude",
      "event_lat",
      "event_latitude",
      "location_lat",
      "location_latitude",
      "activity_latitude"
    ])
  );

  const event_lng = optionalNumber(
    firstConfiguredValue(activity, [
      "longitude",
      "event_lng",
      "event_longitude",
      "location_lng",
      "location_longitude",
      "activity_longitude"
    ])
  );

 const event_radius_meters = optionalNumber(
  firstConfiguredValue(activity, [
    "coverage_radius_m",
    "coverage_radius_meters",
    "event_radius_meters",
    "radius_meters",
    "geofence_radius",
    "location_radius",
    "coverage_radius",
    "event_radius",
    "radius"
  ])
);

  const available =
    validCoordinates(event_lat, event_lng) &&
    event_radius_meters !== null &&
    event_radius_meters > 0 &&
    event_radius_meters <= 3000;

  return {
    available,
    event_lat,
    event_lng,
    event_radius_meters
  };
};


const getBrowserGps = (body = {}) => {
  const photo_lat = optionalNumber(body.browser_latitude);
  const photo_lng = optionalNumber(body.browser_longitude);
  const gps_accuracy_meters = optionalNumber(
    body.browser_accuracy_meters
  );

  const available =
    validCoordinates(photo_lat, photo_lng) &&
    gps_accuracy_meters !== null &&
    gps_accuracy_meters >= 0;

  return {
    available,
    photo_lat: available ? photo_lat : null,
    photo_lng: available ? photo_lng : null,
    gps_accuracy_meters: available ? gps_accuracy_meters : null,
    source: "BROWSER_GEOLOCATION",
    reason: available ? null : "BROWSER_LOCATION_UNAVAILABLE"
  };
};

const getPhotoGps = async (file) => {
  const unavailable = {
    available: false,
    photo_lat: null,
    photo_lng: null,
    gps_accuracy_meters: null,
    source: "PHOTO_EXIF",
    reason: "PHOTO_GPS_UNAVAILABLE"
  };

  if (!file || (!file.path && !file.buffer)) {
    return unavailable;
  }

  try {
    // Read GPS metadata from the uploaded
    // ORIGINAL photo, not from the browser's
    // current location.
    const imageSource = file.path || file.buffer;

    const metadata = await exifr.gps(imageSource);

    if (!metadata) {
      return unavailable;
    }

    const photo_lat = optionalNumber(
      metadata.latitude
    );

    const photo_lng = optionalNumber(
      metadata.longitude
    );

    if (!validCoordinates(photo_lat, photo_lng)) {
      return unavailable;
    }

    return {
      available: true,
      photo_lat,
      photo_lng,

      // GPS accuracy is not assumed from
      // EXIF latitude and longitude alone.
      gps_accuracy_meters: null,

      source: "PHOTO_EXIF",
      reason: null
    };

  } catch (error) {
    console.error(
      "PHOTO EXIF GPS EXTRACTION ERROR:",
      error.message
    );

    return {
      ...unavailable,
      reason: "PHOTO_GPS_READ_FAILED"
    };
  }
};


// ==========================================
// NOTIFICATION HELPER
// ==========================================

const notify = (
  userId,
  type,
  title,
  message,
  relatedType,
  relatedId,
  callback
) => {
  return createNotification(
    userId,
    type,
    title,
    message,
    relatedType,
    Number(relatedId),
    callback
  );
};




 // ==========================================
 // RANDOM FOREST ASSESSMENT HELPER
 // ==========================================

const runParticipationFraudAssessment = async (aiFeatures) => {



  if (!aiFeatures || typeof aiFeatures !== "object") {
    throw new Error("AI assessment features are missing");
  }

  const useGpsModel =
    Number.isFinite(Number(aiFeatures.event_lat)) &&
    Number.isFinite(Number(aiFeatures.event_lng)) &&
    Number(aiFeatures.event_radius_meters) > 0;

  const aiResult = await checkFraudRisk(
    aiFeatures,
    useGpsModel
  );

  if (
    !aiResult ||
    !Number.isFinite(Number(aiResult.risk_score)) ||
    !aiResult.prediction ||
    aiResult.prediction === "AI_UNAVAILABLE"
  ) {
    throw new Error("AI assessment returned an invalid result");
  }

  return aiResult;
};

const assessParticipationAfterCheckout = async (
  participationId
) => {
  const records = await query(
    `SELECT
       pr.participation_id,
       pr.ai_assessment_status,
       pr.ai_features_json,
       pr.proof_url,
       aa.check_in_at,
       aa.check_out_at
     FROM participation_records pr
     LEFT JOIN activity_attendance aa
       ON aa.activity_id = pr.activity_id
      AND aa.user_id = pr.user_id
     WHERE pr.participation_id = ?
     LIMIT 1`,
    [participationId]
  );

  if (!records.length) {
    throw new Error("Participation record not found");
  }

  const record = records[0];

  if (
    !record.check_in_at ||
    !record.check_out_at ||
    !record.proof_url
  ) {
    throw new Error(
      "QR Check-In, proof submission, and QR Check-Out are required before AI assessment"
    );
  }

  if (record.ai_assessment_status === "completed") {
    return { status: "completed", already_assessed: true };
  }

  const features =
    typeof record.ai_features_json === "string"
      ? JSON.parse(record.ai_features_json)
      : record.ai_features_json;

  if (!features) {
    throw new Error("Saved AI features are missing");
  }

  const claimed = await query(
    `UPDATE participation_records
     SET ai_assessment_status = 'processing'
     WHERE participation_id = ?
       AND ai_assessment_status IN
         ('awaiting_checkout', 'pending', 'failed')`,
    [participationId]
  );

  if (claimed.affectedRows !== 1) {
    return { status: "processing", already_assessed: false };
  }

 
  try {
    const aiResult =
      await runParticipationFraudAssessment(features);

    // DEBUG: Display the actual Random Forest result
    console.log(
      "CITIPOINTS AI RESULT:",
      JSON.stringify(aiResult, null, 2)
    );

    // Preserve the existing review reasons for now.

    // Preserve the existing review reasons for now.
    // We will merge the new AI result and GPS warnings
    // when moving the complete assessment logic.
    await query(
      `UPDATE participation_records
       SET ai_assessment_status = 'completed',
           ai_score = ?,
           ai_flag = ?,
           ai_assessed_at = NOW()
       WHERE participation_id = ?
         AND ai_assessment_status = 'processing'`,
      [
        Number(aiResult.risk_score),
        aiResult.requires_human_review ? 1 : 0,
        participationId
      ]
    );

    return {
      status: "completed",
      aiResult
    };
  } catch (error) {
    await query(
      `UPDATE participation_records
       SET ai_assessment_status = 'failed',
           ai_assessed_at = NULL
       WHERE participation_id = ?
         AND ai_assessment_status = 'processing'`,
      [participationId]
    );

    throw error;
  }
};

// ==========================================
// SUBMIT PARTICIPATION + AI
// ==========================================

const submitParticipation = async (req, res) => {
  const userId = req.user.user_id;

  const {
    activity_id,
    feedback_text
  } = req.body;

  const proof_url = req.file
    ? `uploads/proofs/${req.file.filename}`
    : null;

  const proof_hash = req.file
    ? generateFileHash(req.file.path)
    : null;

  if (!activity_id) {
    return res.status(400).json({
      success: false,
      message: "activity_id is required"
    });
  }

  const cleanFeedback =
    typeof feedback_text === "string"
      ? feedback_text.trim()
      : "";

  try {
    // ======================================
    // 1. CHECK ACTIVITY REGISTRATION
    // ======================================

    const registrations = await query(
      `SELECT *
       FROM activity_registrations
       WHERE user_id = ?
         AND activity_id = ?`,
      [userId, activity_id]
    );

    if (!registrations.length) {
      return res.status(400).json({
        success: false,
        message:
          "You must join the activity before submitting participation"
      });
    }

    // ======================================
    // 2. PREVENT REPEATED ACTIVITY CLAIMS
    // ======================================

    const previousClaims = await query(
      `SELECT participation_id
       FROM participation_records
       WHERE user_id = ?
         AND activity_id = ?`,
      [userId, activity_id]
    );

    if (previousClaims.length) {
      return res.status(409).json({
        success: false,
        message:
          "Participation already submitted for this activity"
      });
    }

    // ======================================
    // 3. GET TRUSTED ACTIVITY INFORMATION
    // ======================================

    const activities = await query(
      `SELECT *
       FROM activities
       WHERE activity_id = ?`,
      [activity_id]
    );

    if (!activities.length) {
      return res.status(404).json({
        success: false,
        message: "Activity not found"
      });
    }

    const activity = activities[0];

    // ======================================
    // MANDATORY QR ATTENDANCE VERIFICATION
    // ======================================

    const attendanceRows = await query(
      `SELECT check_in_at, check_out_at
       FROM activity_attendance
       WHERE activity_id = ?
         AND user_id = ?
       LIMIT 1`,
      [activity_id, userId]
    );

    const attendance = attendanceRows[0];

   const hasCheckIn = Boolean(attendance?.check_in_at);
const hasCheckOut = Boolean(attendance?.check_out_at);


if (!hasCheckIn) {
  return res.status(409).json({
    success: false,
    code: "QR_CHECK_IN_REQUIRED",
    message: "Complete QR Check-In before submitting participation proof.",
    attendance: {
      check_in_at: attendance?.check_in_at || null,
      check_out_at: attendance?.check_out_at || null,
      status: "missing_check_in"
    },
    ai_assessment: {
      status: "NOT_ASSESSED",
      risk_score: null
    }
  });
}



    // The administrator's event radius and
    // coordinates are read from MySQL,
    // never accepted from the citizen's form.

    const eventGps = getActivityGps(activity);

    // Citizen coordinates are supplied by
    // the browser after location permission.

  
const browserGps = getBrowserGps(req.body);
const photoExifGps = await getPhotoGps(req.file);

// Use browser-reported location for live camera submissions.
// Preserve EXIF as separate evidence when available.
const citizenGps = browserGps.available
  ? browserGps
  : photoExifGps;

console.log("CITIPOINTS BROWSER GPS:", browserGps);
console.log("CITIPOINTS PHOTO EXIF GPS:", photoExifGps);
console.log("CITIPOINTS GPS USED FOR AI:", citizenGps);


    // ======================================
    // 4. EXISTING FRAUD INDICATORS
    // ======================================

    const claims24Rows = await query(
      `SELECT COUNT(*) AS total
       FROM participation_records
       WHERE user_id = ?
         AND submitted_at >=
             NOW() - INTERVAL 24 HOUR`,
      [userId]
    );

    const claims_last_24h =
      Number(claims24Rows[0]?.total || 0);

    const claims7Rows = await query(
      `SELECT COUNT(*) AS total
       FROM participation_records
       WHERE user_id = ?
         AND submitted_at >=
             NOW() - INTERVAL 7 DAY`,
      [userId]
    );

    const user_claims_7d =
      Number(claims7Rows[0]?.total || 0);

    const rejectedRows = await query(
      `SELECT COUNT(*) AS total
       FROM participation_records
       WHERE user_id = ?
         AND status = 'rejected'
         AND submitted_at >=
             NOW() - INTERVAL 30 DAY`,
      [userId]
    );

    const rejected_claims_30d =
      Number(rejectedRows[0]?.total || 0);

    const approvedRows = await query(
      `SELECT COUNT(*) AS total
       FROM participation_records
       WHERE user_id = ?
         AND status = 'approved'`,
      [userId]
    );

    const prior_approved_claims =
      Number(approvedRows[0]?.total || 0);

    // ======================================
    // 5. EXACT DUPLICATE PROOF CHECK
    // ======================================

    let duplicate_proof_count = 0;
    let proof_reuse_count = 0;

    if (proof_hash) {
      const matchingProofs = await query(
        `SELECT COUNT(*) AS total
         FROM participation_records
         WHERE proof_hash = ?`,
        [proof_hash]
      );

      duplicate_proof_count =
        Number(matchingProofs[0]?.total || 0);

      proof_reuse_count = duplicate_proof_count;
    }

    // ======================================
    // 6. RAPID SUBMISSION
    // ======================================

    const lastSubmissions = await query(
      `SELECT submitted_at
       FROM participation_records
       WHERE user_id = ?
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [userId]
    );

    let rapid_submission = 0;

    if (lastSubmissions.length) {
      const previousTime = new Date(
        lastSubmissions[0].submitted_at
      ).getTime();

      const differenceMinutes =
        (Date.now() - previousTime) / 60000;

      if (
        Number.isFinite(differenceMinutes) &&
        differenceMinutes >= 0 &&
        differenceMinutes <= 10
      ) {
        rapid_submission = 1;
      }
    }

    // ======================================
    // 7. SUBMISSION DELAY
    // ======================================

    let submission_delay_minutes = 0;

    if (activity.date_end) {
      const activityEnd = new Date(
        activity.date_end
      ).getTime();

      if (Number.isFinite(activityEnd)) {
        submission_delay_minutes = Math.max(
          0,
          Math.round(
            (Date.now() - activityEnd) / 60000
          )
        );
      }
    }

    // ======================================
    // 8. ACCOUNT AGE PROXY
    // ======================================

    const firstRegistrations = await query(
      `SELECT MIN(created_at) AS first_activity
       FROM activity_registrations
       WHERE user_id = ?`,
      [userId]
    );

    let account_age_days = 0;

    if (firstRegistrations[0]?.first_activity) {
      const firstDate = new Date(
        firstRegistrations[0].first_activity
      ).getTime();

      if (Number.isFinite(firstDate)) {
        account_age_days = Math.max(
          0,
          Math.floor(
            (Date.now() - firstDate) / 86400000
          )
        );
      }
    }

    // One claim per activity is currently
    // permitted by the participation workflow.
    const same_activity_claims = 1;

    const points_claimed =
      Number(activity.points_value || 0);

    // Legacy location indicator.
    // /predict-v2 recalculates it using GPS.
    const location_mismatch = 0;

    // ======================================
    // 9. PRESERVE ORIGINAL 12 FEATURES
    // ======================================

    const aiFeatures = {
      points_claimed,
      claims_last_24h,
      user_claims_7d,
      rejected_claims_30d,
      same_activity_claims,
      duplicate_proof_count,
      proof_reuse_count,
      submission_delay_minutes,
      location_mismatch,
      rapid_submission,
      account_age_days,
      prior_approved_claims
    };

    // ======================================
    // 10. PREPARE DYNAMIC GPS MODEL
    // ======================================

    const useGpsModel = eventGps.available;

    if (useGpsModel) {
      Object.assign(aiFeatures, {
        event_lat: eventGps.event_lat,
        event_lng: eventGps.event_lng,
        event_radius_meters:
          eventGps.event_radius_meters,
        photo_lat: citizenGps.photo_lat,
        photo_lng: citizenGps.photo_lng,
        gps_accuracy_meters:
          citizenGps.gps_accuracy_meters
      });
    }

    console.log(
      "CITIPOINTS AI FEATURES:",
      aiFeatures
    );

    // ======================================
    // 11. RUN RANDOM FOREST
    // ======================================

    
    // AI will run only after QR Check-Out.
    // These values are placeholders for the
    // existing review-reason logic below.
    const aiResult = {
      prediction: "NOT_ASSESSED",
      risk_score: null,
      risk_level: "PENDING",
      requires_human_review: false,
      reasons: [],
      warnings: [],
      gps_verification: null
    };


    // ======================================
    // 12. BUILD ADMIN REVIEW REASONS
    // ======================================

    const reasonList = [];

    if (!cleanFeedback) {
      reasonList.push("Missing feedback");
    }

    if (!proof_url) {
      reasonList.push("Missing proof file");
    }

    if (claims_last_24h >= 5) {
      reasonList.push(
        `Repeated claim pattern: ${claims_last_24h} participation claims within the last 24 hours`
      );
    }

    if (user_claims_7d >= 7) {
      reasonList.push(
        `High claim frequency: ${user_claims_7d} participation claims within the last 7 days`
      );
    }

    if (rapid_submission === 1) {
      reasonList.push(
        "Rapid submission activity: another participation claim was submitted within 10 minutes"
      );
    }

    if (duplicate_proof_count > 0) {
      reasonList.push(
        `Duplicate proof detected: ${duplicate_proof_count} matching proof record(s)`
      );
    }

    if (proof_reuse_count > 0) {
      reasonList.push(
        `Proof reuse detected: ${proof_reuse_count} previous use(s)`
      );
    }

    if (rejected_claims_30d > 0) {
      reasonList.push(
        `Previous rejected claims: ${rejected_claims_30d} within the last 30 days`
      );
    }

    // ======================================
    // 13. GPS REVIEW INFORMATION
    // ======================================

    
// ======================================
// 13. GPS REVIEW INFORMATION
// ======================================

let gpsNeedsReview = false;

if (!eventGps.available) {
  gpsNeedsReview = true;

  reasonList.push(
    "GPS Verification: ACTIVITY_LOCATION_UNCONFIGURED"
  );

  reasonList.push(
    "The activity's coordinates or coverage radius " +
    "are not configured in the database."
  );

} else {
  reasonList.push(
    `Event Coverage Radius: ${eventGps.event_radius_meters} meters`
  );

  reasonList.push(
  `Location Evidence Source: ${citizenGps.source}`
);


if (!citizenGps.available) {
  gpsNeedsReview = true;

  reasonList.push(
    "GPS Verification: LOCATION_UNVERIFIED"
  );

  reasonList.push(
   "No usable browser location or photo GPS metadata was provided. Location could not be verified."
  );
}


  const gps = aiResult.gps_verification;

  if (gps) {
    reasonList.push(
      `GPS Verification: ${gps.status}`
    );

    if (gps.distance_meters != null) {
      reasonList.push(
        `Distance from Event: ${gps.distance_meters} meters`
      );
    }

    if (gps.gps_accuracy_meters != null) {
      reasonList.push(
        `GPS Accuracy: ±${gps.gps_accuracy_meters} meters`
      );
    }

    if (
      gps.status === "OUTSIDE_EVENT_AREA" ||
      gps.status === "BOUNDARY_UNCERTAIN" ||
      gps.status === "LOCATION_UNVERIFIED"
    ) {
      gpsNeedsReview = true;
    }
  }
}

if (Array.isArray(aiResult.reasons)) {
  reasonList.push(...aiResult.reasons);
}

if (Array.isArray(aiResult.warnings)) {
  for (const warning of aiResult.warnings) {
    reasonList.push(`Verification Warning: ${warning}`);
  }
}


    // ======================================
    // 14. AI RESULT
    // ======================================

    
const hasIndependentWarning =
  !eventGps.available ||
  !citizenGps.available ||
  gpsNeedsReview ||
  duplicate_proof_count > 0 ||
  proof_reuse_count > 0 ||
  rapid_submission === 1 ||
  claims_last_24h >= 5 ||
  user_claims_7d >= 7 ||
  rejected_claims_30d > 0 ||
  same_activity_claims > 1 ||
  (
    Array.isArray(aiResult.warnings) &&
    aiResult.warnings.length > 0
  );

  
const ai_score = Number.isFinite(
  Number(aiResult.risk_score)
)
  ? Number(aiResult.risk_score)
  : 0;

let ai_flag =
  Boolean(aiResult.requires_human_review) ||
  hasIndependentWarning ||
  !cleanFeedback ||
  !proof_url;



    reasonList.push(
      `AI Prediction: ${aiResult.prediction}`
    );

    reasonList.push(
      `Risk Level: ${aiResult.risk_level}`
    );

    reasonList.push(
      `Risk Score: ${ai_score}%`
    );

    const hasSpecificFraudIndicator =
      claims_last_24h >= 5 ||
      user_claims_7d >= 7 ||
      rapid_submission === 1 ||
      duplicate_proof_count > 0 ||
      proof_reuse_count > 0 ||
      rejected_claims_30d > 0 ||
      same_activity_claims > 1;

    
const modelActuallyFlagged =
  aiResult.prediction === "SUSPICIOUS" &&
  ai_score >= 50;

if (
  modelActuallyFlagged &&
  !hasSpecificFraudIndicator &&
  !gpsNeedsReview
) {
  reasonList.push(
    "AI model flagged this participation for additional review."
  );
}


    const ai_reason = [
      ...new Set(reasonList)
    ].join("; ");

    // ======================================
    // 15. HUMAN-IN-THE-LOOP
    // ======================================

    // AI NEVER approves or rejects.
    // Every submission starts as pending.

    const status = "pending";

    // ======================================
    // 16. SAVE PARTICIPATION RECORD
    // ======================================

   

const insertResult = await query(
  `INSERT INTO participation_records
   (
     user_id,
     activity_id,
     proof_url,
     proof_hash,
     feedback_text,
     status,
     ai_flag,
     ai_score,
     ai_reason,
     awarded_points,
     ai_assessment_status,
     ai_features_json
   )
   VALUES
   (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  [
    userId,
    activity_id,
    proof_url,
    proof_hash,
  
    cleanFeedback || null,
    "pending",
    0,
    null,
    ai_reason || null,
    "awaiting_checkout",
    JSON.stringify(aiFeatures)

  ]
);



    // ======================================
    // 17. NOTIFY ADMINISTRATORS
    // ======================================

    
    // ======================================
    // 17. WAIT FOR QR CHECK-OUT
    // ======================================

    // Proof and AI features are saved.
    // Do not notify administrators yet because
    // the AI assessment is not complete.

    // ======================================
    // 18. RETURN SUBMISSION RESULT
    // ======================================

    return res.status(201).json({
      success: true,
      message:
        "Participation proof submitted successfully. Please complete QR Check-Out to start AI fraud assessment.",

      participation_id: insertResult.insertId,
      status: "pending",
      proof_url,
      proof_hash,

      attendance: {
        check_in_at: attendance?.check_in_at || null,
        check_out_at: attendance?.check_out_at || null,
        status: "awaiting_checkout"
      },

      ai_assessment: {
        status: "awaiting_checkout",
        prediction: null,
        risk_score: null,
        risk_level: null
      }
    });


  } catch (error) {
    console.error(
      "SUBMIT PARTICIPATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to submit participation",
      error: error.message
    });
  }
};

// ==========================================
// GET MY PARTICIPATIONS
// ==========================================

const getMyParticipations = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT
      ar.registration_id,
      ar.user_id,
      ar.activity_id,
      ar.registration_status,
      ar.created_at AS registered_at,

      a.title AS activity_title,
      a.description,
      a.category,
      a.location,
      a.date_start,
      a.date_end,
      a.points_value,
      a.image_url,
     a.status AS activity_status,
a.validation_type,
aa.check_in_at,
aa.check_out_at,

CASE
  WHEN a.validation_type <> 'qr'
    THEN 'not_required'
  WHEN aa.check_in_at IS NULL
    THEN 'missing_check_in'
  WHEN aa.check_out_at IS NULL
    THEN 'missing_check_out'
  ELSE 'complete'
END AS qr_attendance_status,  

      pr.participation_id,
      pr.proof_url,
      pr.proof_hash,
      pr.feedback_text,
      pr.status AS participation_status,
      pr.ai_flag,
      pr.ai_score,
      pr.ai_reason,
      pr.awarded_points,
      pr.submitted_at,
      pr.reviewed_at,

      CASE
        WHEN pr.participation_id IS NULL
          THEN 'not_submitted'
        ELSE pr.status
      END AS status

    FROM activity_registrations ar

    INNER JOIN activities a
      ON a.activity_id = ar.activity_id
      LEFT JOIN activity_attendance aa
  ON aa.activity_id = ar.activity_id
  AND aa.user_id = ar.user_id

    LEFT JOIN participation_records pr
      ON pr.user_id = ar.user_id
      AND pr.activity_id = ar.activity_id

    WHERE ar.user_id = ?

    ORDER BY ar.created_at DESC
  `;

  db.query(sql, [userId], (error, results) => {
    if (error) {
      console.error(
        "GET MY PARTICIPATIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch participations",
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      participations: results
    });
  });
};

// ==========================================
// GET ADMIN REVIEW QUEUE
// ==========================================

const getReviewQueue = (req, res) => {
  const isLgu = req.user.role === "lgu";
  const reviewerId = req.user.user_id;

  const sql = `
    SELECT
      pr.participation_id,
      pr.user_id,

TRIM(CONCAT_WS(' ',
    NULLIF(TRIM(u.first_name), ''),
    NULLIF(TRIM(u.middle_name), ''),
    NULLIF(TRIM(u.last_name), ''),
    NULLIF(TRIM(u.suffix), '')
)) AS full_name,
      u.email,
      pr.activity_id,
      a.title AS activity_title,
a.validation_type,
aa.check_in_at,
aa.check_out_at,

CASE
  WHEN a.validation_type <> 'qr'
    THEN 'not_required'
  WHEN aa.check_in_at IS NULL
    THEN 'missing_check_in'
  WHEN aa.check_out_at IS NULL
    THEN 'missing_check_out'
  ELSE 'complete'
END AS qr_attendance_status,
      pr.proof_url,
      pr.proof_hash,
      pr.feedback_text,
      pr.status,
      
       pr.ai_flag,
       pr.ai_score,
       pr.ai_reason,
       pr.ai_features_json,
       pr.awarded_points,

      pr.submitted_at

    FROM participation_records pr

    INNER JOIN users u
      ON pr.user_id = u.user_id

    INNER JOIN activities a
      ON pr.activity_id = a.activity_id
      LEFT JOIN activity_attendance aa
  ON aa.activity_id = pr.activity_id
  AND aa.user_id = pr.user_id

  
WHERE pr.status = 'pending'
  AND pr.ai_assessment_status = 'completed'
  AND aa.check_in_at IS NOT NULL
  AND aa.check_out_at IS NOT NULL
  AND pr.proof_url IS NOT NULL
  AND pr.proof_url <> ''
${isLgu ? "AND a.created_by = ?" : ""}


ORDER BY
      pr.ai_flag DESC,
      pr.ai_score DESC,
      pr.submitted_at ASC
  `;

  db.query(
  sql,
  isLgu ? [reviewerId] : [],
  (error, results) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch review queue",
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      records: results
    });
  });
};

// ==========================================
// APPROVE PARTICIPATION
// ==========================================

const approveParticipation = (req, res) => {


  const { id } = req.params;
  const reviewerId = req.user.user_id;

  const getParticipationSql = `
    SELECT
      pr.*,
    a.points_value,
a.created_by AS activity_created_by,
a.validation_type,
aa.check_in_at,
aa.check_out_at,
u.points_balance

    FROM participation_records pr

    INNER JOIN activities a
      ON pr.activity_id = a.activity_id

    INNER JOIN users u
      ON pr.user_id = u.user_id
      LEFT JOIN activity_attendance aa
  ON aa.activity_id = pr.activity_id
  AND aa.user_id = pr.user_id

    WHERE pr.participation_id = ?
  `;

  db.query(
    getParticipationSql,
    [id],
    (fetchErr, results) => {
      if (fetchErr) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch participation record",
          error: fetchErr.message
        });
      }

      if (!results.length) {
        return res.status(404).json({
          success: false,
          message: "Participation record not found"
        });
      }

      const record = results[0];

if (
  req.user.role === "lgu" &&
  Number(record.activity_created_by) !== Number(reviewerId)
) {
  return res.status(403).json({
    success: false,
    message: "You can only approve participation for your own LGU activities."
  });
}
      if (record.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Only pending submissions can be approved"
        });
      }

      if (record.ai_assessment_status !== "completed") {
  return res.status(409).json({
    success: false,
    code: "AI_ASSESSMENT_INCOMPLETE",
    message:
      "Cannot approve participation until the AI fraud assessment has been completed.",
    ai_assessment_status: record.ai_assessment_status
  });
}


      // ==========================================
// LEVEL 1: QR ATTENDANCE VALIDATION
// ==========================================

if (record.validation_type === "qr") {

  const hasCheckIn = Boolean(record.check_in_at);
  const hasCheckOut = Boolean(record.check_out_at);

  if (!hasCheckIn || !hasCheckOut) {

    const missing = [];

    if (!hasCheckIn) {
      missing.push("Check-In");
    }

    if (!hasCheckOut) {
      missing.push("Check-Out");
    }

    return res.status(409).json({
      success: false,
      code: "QR_ATTENDANCE_INCOMPLETE",

      message:
        `Cannot approve participation. Missing QR ${missing.join(" and ")}.`,

      attendance: {
        check_in_at: record.check_in_at,
        check_out_at: record.check_out_at,

        status: !hasCheckIn
          ? "missing_check_in"
          : "missing_check_out"
      }
    });
  }
}

      const awardedPoints =
        Number(record.points_value || 0);

      const newBalance =
        Number(record.points_balance || 0) +
        awardedPoints;

    const updateSql = `
  UPDATE participation_records
  SET
    status = 'approved',
    awarded_points = ?,
    reviewed_by = ?,
    reviewed_at = NOW()
  WHERE participation_id = ?
    AND status = 'pending'
    AND (
      ? <> 'lgu'
      OR EXISTS (
        SELECT 1
        FROM activities a
        WHERE a.activity_id = participation_records.activity_id
          AND a.created_by = ?
      )
    )
    AND EXISTS (
      SELECT 1
      FROM activity_attendance aa
      WHERE aa.activity_id = participation_records.activity_id
        AND aa.user_id = participation_records.user_id
        AND aa.check_in_at IS NOT NULL
        AND aa.check_out_at IS NOT NULL
    )
`;

      db.query(
        updateSql,
       [awardedPoints, reviewerId, id, req.user.role, reviewerId],
        (updateErr, updateResult) => {
          if (updateErr) {
            return res.status(500).json({
              success: false,
              message: "Failed to approve participation",
              error: updateErr.message
            });
          }

          if (!updateResult.affectedRows) {
            return res.status(400).json({
              success: false,
              message: "Participation was already reviewed"
            });
          }

          db.query(
            `UPDATE users
             SET points_balance = points_balance + ?
             WHERE user_id = ?`,
            [awardedPoints, record.user_id],
            (userErr) => {
              if (userErr) {
                return res.status(500).json({
                  success: false,
                  message:
                    "Participation approved but failed to update points balance",
                  error: userErr.message
                });
              }

              const transactionSql = `
                INSERT INTO point_transactions
                (
                  user_id,
                  source_type,
                  source_id,
                  points_delta,
                  balance_after,
                  notes
                )
                VALUES
                (?, 'activity', ?, ?, ?, ?)
              `;

              db.query(
                transactionSql,
                [
                  record.user_id,
                  record.activity_id,
                  awardedPoints,
                  newBalance,
                  "Approved participation points"
                ],
                (transactionErr) => {
                  if (transactionErr) {
                    return res.status(500).json({
                      success: false,
                      message:
                        "Participation approved and balance updated, but transaction log failed",
                      error: transactionErr.message
                    });
                  }

                  handleRankProgress(
                    record.user_id,
                    (rankErr, rankResult) => {
                      if (rankErr) {
                        console.error(
                          "RANK PROGRESS ERROR:",
                          rankErr
                        );
                      }

                      let notificationMessage =
                        `Your participation was approved. You earned ${awardedPoints} Smart Points.`;

                      if (
                        !rankErr &&
                        rankResult?.rankedUp
                      ) {
                        notificationMessage +=
                          ` You also reached ${rankResult.newRank} rank and received ${rankResult.bonusPoints} Smart Points rank bonus.`;
                      }

                      notify(
                        record.user_id,
                        "participation",
                        "Participation Approved",
                        notificationMessage,
                        "participation",
                        id,
                        (
                          notificationErr,
                          notificationResult
                        ) => {
                          if (notificationErr) {
                            return res.status(200).json({
                              success: true,
                              message:
                                "Participation approved and points added, but notification creation failed",
                              awarded_points:
                                awardedPoints,
                              new_balance: newBalance,
                              notification_error:
                                notificationErr.message
                            });
                          }

                          return res.status(200).json({
                            success: true,
                            message:
                              !rankErr &&
                              rankResult?.rankedUp
                                ? `Participation approved. Rank upgraded to ${rankResult.newRank}. Bonus +${rankResult.bonusPoints} points awarded.`
                                : "Participation approved and points added immediately",
                            awarded_points:
                              awardedPoints,
                            new_balance: newBalance,
                            rankResult:
                              rankErr ? null : rankResult,
                            notification_created: true,
                            notification_id:
                              notificationResult?.insertId
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
};

// ==========================================
// REJECT PARTICIPATION
// ==========================================

const rejectParticipation = (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user.user_id;

  const sql = `
    SELECT
      pr.participation_id,
      pr.user_id,
      pr.status,
     a.title AS activity_title,
a.created_by AS activity_created_by

    FROM participation_records pr

    INNER JOIN activities a
      ON pr.activity_id = a.activity_id

    WHERE pr.participation_id = ?
    LIMIT 1
  `;

  db.query(sql, [id], (fetchErr, results) => {
    if (fetchErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch participation",
        error: fetchErr.message
      });
    }

    if (!results.length) {
      return res.status(404).json({
        success: false,
        message: "Participation not found"
      });
    }

    const record = results[0];

    if (
  req.user.role === "lgu" &&
  Number(record.activity_created_by) !== Number(reviewerId)
) {
  return res.status(403).json({
    success: false,
    message: "You can only reject participation for your own LGU activities."
  });
}

    if (record.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending participation can be rejected"
      });
    }

    const updateSql = `
      UPDATE participation_records
      SET
        status = 'rejected',
        awarded_points = 0,
        reviewed_by = ?,
        reviewed_at = NOW()
      WHERE participation_id = ?
        AND status = 'pending'
    `;

    db.query(
      updateSql,
      [reviewerId, id, req.user.role, reviewerId],
      (updateErr, updateResult) => {
        if (updateErr) {
          return res.status(500).json({
            success: false,
            message: "Failed to reject participation",
            error: updateErr.message
          });
        }

        if (!updateResult.affectedRows) {
          return res.status(400).json({
            success: false,
            message: "Participation was already reviewed"
          });
        }

        notify(
          record.user_id,
          "participation",
          "Participation Rejected",
          `Your participation for "${record.activity_title}" was rejected.`,
          "participation",
          id,
          (notificationErr, notificationResult) => {
            if (notificationErr) {
              return res.status(200).json({
                success: true,
                message:
                  "Participation rejected, but notification creation failed",
                notification_error:
                  notificationErr.message
              });
            }

            return res.status(200).json({
              success: true,
              message:
                "Participation rejected successfully",
              notification_created: true,
              notification_id:
                notificationResult?.insertId
            });
          }
        );
      }
    );
  });
};

// ==========================================
// GET PARTICIPANTS BY ACTIVITY
// ==========================================

const getParticipantsByActivity = async (req, res) => {
  const { activityId } = req.params;

  // LGU accounts may only view participants
  // of activities created by their own account.
  if (req.user.role === "lgu") {
    try {
      const activities = await query(
        `SELECT a.activity_id
         FROM activities a
         INNER JOIN users u
           ON u.user_id = a.created_by
         INNER JOIN lgu_registrations l
           ON l.user_id = u.user_id
         WHERE a.activity_id = ?
           AND a.created_by = ?
           AND u.role = 'lgu'
           AND u.status = 'active'
           AND l.verification_status = 'approved'
         LIMIT 1`,
        [activityId, req.user.user_id]
      );

      if (!activities.length) {
        return res.status(403).json({
          success: false,
          message:
            "You can only view participants of activities created by your approved LGU account."
        });
      }
    } catch (error) {
      console.error("LGU PARTICIPANT ACCESS ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to verify LGU participant access."
      });
    }
  }

  const sql = `
    SELECT
      ar.user_id,
      ar.activity_id,
      ar.created_at AS registered_at,
      ar.registration_status,
      a.validation_type,
aa.check_in_at,
aa.check_out_at,

CASE
  WHEN a.validation_type <> 'qr'
    THEN 'not_required'
  WHEN aa.check_in_at IS NULL
    THEN 'missing_check_in'
  WHEN aa.check_out_at IS NULL
    THEN 'missing_check_out'
  ELSE 'complete'
END AS qr_attendance_status,

     TRIM(CONCAT_WS(' ',
  NULLIF(TRIM(u.first_name), ''),
  NULLIF(TRIM(u.middle_name), ''),
 NULLIF(TRIM(u.last_name), ''),
  NULLIF(TRIM(u.suffix), '')
)) AS full_name,
      u.email,

      pr.participation_id,
      pr.proof_url,
      pr.feedback_text,
      pr.status AS participation_status,
      pr.ai_flag,
      pr.ai_score,
      pr.ai_reason,
      pr.awarded_points,
      pr.submitted_at,
      pr.reviewed_at

    FROM activity_registrations ar

    INNER JOIN users u
      ON u.user_id = ar.user_id
      INNER JOIN activities a
  ON a.activity_id = ar.activity_id

LEFT JOIN activity_attendance aa
  ON aa.activity_id = ar.activity_id
  AND aa.user_id = ar.user_id

    LEFT JOIN participation_records pr
      ON pr.user_id = ar.user_id
      AND pr.activity_id = ar.activity_id

    WHERE ar.activity_id = ?

    ORDER BY ar.created_at DESC
  `;

  db.query(sql, [activityId], (error, results) => {
    if (error) {
      console.error(
        "GET ACTIVITY PARTICIPANTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch participants",
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      participants: results
    });
  });
};

// ==========================================
// EXPORT CONTROLLER FUNCTIONS
// ==========================================


module.exports = {
  submitParticipation,
  assessParticipationAfterCheckout,
  getMyParticipations,
  getReviewQueue,
  approveParticipation,
  rejectParticipation,
  getParticipantsByActivity
};
