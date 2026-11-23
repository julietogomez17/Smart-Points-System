import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

function AdminReportsPage() {
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
    const [proofImages, setProofImages] = useState({});

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  /* =========================================================
     INITIAL LOAD
     ========================================================= */

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  /* =========================================================
     TOAST TIMER
     ========================================================= */

  useEffect(() => {
    let timer;

    if (showToast) {
      timer = setTimeout(() => {
        setShowToast(false);
        setMessage('');
        setMessageType('');
      }, 3000);
    }

    return () => clearTimeout(timer);
  }, [showToast]);

  /* =========================================================
     FETCH REVIEW QUEUE
     ========================================================= */

  const fetchReviewQueue = async () => {
    try {
      setLoading(true);

      const res = await api.get(
        '/participations/review-queue'
      );

      const newRecords = res.data.records || [];

      setRecords(newRecords);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          'Failed to load review queue'
      );

      setMessageType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };
    useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    const loadProofs = async () => {
      const images = {};

      await Promise.all(
        records
          .filter(record => record.proof_url && record.participation_id)
          .map(async record => {
            try {
              const response = await api.get(
                `/participations/${record.participation_id}/proof`,
                { responseType: 'blob' }
              );

              if (cancelled) return;

              const url = URL.createObjectURL(response.data);
              objectUrls.push(url);
              images[record.participation_id] = url;
            } catch (error) {
              console.error(
                'Failed to load protected proof:',
                record.participation_id,
                error
              );
            }
          })
      );

      if (!cancelled) {
        setProofImages(images);
      }
    };

    setProofImages({});
    loadProofs();

    return () => {
      cancelled = true;
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [records]);
  /* =========================================================
     APPROVE
     ========================================================= */

  const handleApprove = async (id) => {
    const confirmed = window.confirm(
      'Approve this participation submission?'
    );

    if (!confirmed) return;

    try {
      const res = await api.post(
        `/participations/${id}/approve`
      );

      setMessage(
        res.data.message ||
          'Participation approved successfully'
      );

      setMessageType('success');
      setShowToast(true);

      setSelectedRecord(null);

      await fetchReviewQueue();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          'Failed to approve participation'
      );

      setMessageType('error');
      setShowToast(true);
    }
  };

  /* =========================================================
     REJECT
     ========================================================= */

  const handleReject = async (id) => {
    const confirmed = window.confirm(
      'Reject this participation submission?'
    );

    if (!confirmed) return;

    try {
      const res = await api.post(
        `/participations/${id}/reject`
      );

      setMessage(
        res.data.message ||
          'Participation rejected successfully'
      );

      setMessageType('success');
      setShowToast(true);

      setSelectedRecord(null);

      await fetchReviewQueue();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          'Failed to reject participation'
      );

      setMessageType('error');
      setShowToast(true);
    }
  };

  /* =========================================================
     HELPERS
     ========================================================= */

const getProofUrl = (record) => {
  if (!record?.proof_url || !record?.participation_id) {
    return null;
  }

  return proofImages[record.participation_id] || null;
};
  const formatDate = (value) => {
    if (!value) return 'N/A';

    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (value) => {
    if (!value) return '';

    return new Date(value).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getQrAttendance = (record) => {
  if (!record || !record.validation_type) {
    return {
      status: 'unavailable',
      label: 'Unavailable',
      className: 'unavailable',
      message: 'QR attendance data is not available.'
    };
  }

  if (record.validation_type !== 'qr') {
    return {
      status: 'not_required',
      label: 'Not Required',
      className: 'neutral',
      message: 'This activity does not require QR attendance.'
    };
  }

  if (!record.check_in_at) {
    return {
      status: 'missing_check_in',
      label: 'Missing Check-In',
      className: 'warning',
      message: 'Required QR Check-In is missing.'
    };
  }

  if (!record.check_out_at) {
    return {
      status: 'missing_check_out',
      label: 'Awaiting Check-Out',
      className: 'warning',
      message: 'Awaiting QR Check-Out. Participation approval will become available once the citizen completes QR attendance..'
    };
  }

  return {
    status: 'complete',
    label: 'Complete',
    className: 'complete',
    message: 'Both required QR scans are recorded.'
  };
};

  const getRiskLevel = (score) => {
    const value = Number(score || 0);

    if (value >= 70) return 'HIGH';
    if (value >= 40) return 'MEDIUM';

    return 'LOW';
  };

  const getRiskClass = (level) => {
    if (level === 'HIGH') return 'high';
    if (level === 'MEDIUM') return 'medium';

    return 'low';
  };

 
const getReviewDetails = (record) => {
  const gps = {
    status: 'NOT_RECORDED',
    source: null,
    radius: null,
    distance: null,
    accuracy: null,
    warnings: []
  };

 const risks = [];
const seenRisks = new Set();

const notes = [];

const addNote = (message) => {
  if (message && !notes.includes(message)) {
    notes.push(message);
  }
};

  if (!record) {
    return { gps, risks, notes };
  }

  // Read saved GPS data without changing AI assessment
  let features = {};

  try {
    features =
      typeof record.ai_features_json === 'string'
        ? JSON.parse(record.ai_features_json)
        : record.ai_features_json || {};
  } catch (error) {
    console.error('Failed to read saved GPS features:', error);
  }

  const eventLat = Number(features.event_lat);
  const eventLng = Number(features.event_lng);
  const citizenLat = Number(features.photo_lat);
  const citizenLng = Number(features.photo_lng);
  const radius = Number(features.event_radius_meters);

  const hasCoordinates =
    features.event_lat != null &&
    features.event_lng != null &&
    features.photo_lat != null &&
    features.photo_lng != null &&
    Number.isFinite(eventLat) &&
    Number.isFinite(eventLng) &&
    Number.isFinite(citizenLat) &&
    Number.isFinite(citizenLng) &&
    eventLat >= -90 && eventLat <= 90 &&
    citizenLat >= -90 && citizenLat <= 90 &&
    eventLng >= -180 && eventLng <= 180 &&
    citizenLng >= -180 && citizenLng <= 180;

  if (Number.isFinite(radius) && radius > 0) {
    gps.radius = radius;
  }

  if (
    features.gps_accuracy_meters != null &&
    Number.isFinite(Number(features.gps_accuracy_meters))
  ) {
    gps.accuracy = Number(features.gps_accuracy_meters);
  }

  if (hasCoordinates && gps.radius !== null) {
    const toRadians = (degrees) => degrees * Math.PI / 180;

    const dLat = toRadians(citizenLat - eventLat);
    const dLng = toRadians(citizenLng - eventLng);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(eventLat)) *
      Math.cos(toRadians(citizenLat)) *
      Math.sin(dLng / 2) ** 2;

    const distance =
      6371000 * 2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(Math.max(0, 1 - a))
      );

    gps.distance = distance;

    // Display-only GPS classification.
    // Does not change the AI model's prediction.
    if (
      gps.accuracy !== null &&
      Math.abs(distance - gps.radius) <= gps.accuracy
    ) {
      gps.status = 'BOUNDARY_UNCERTAIN';
    } else {
      gps.status =
        distance <= gps.radius
          ? 'INSIDE_EVENT_AREA'
          : 'OUTSIDE_EVENT_AREA';
    }
  } else if (gps.radius === null) {
    gps.status = 'ACTIVITY_LOCATION_UNCONFIGURED';
  } else {
    gps.status = 'LOCATION_UNVERIFIED';
  }


  const reasons = String(record.ai_reason || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);

  const addGpsWarning = (message) => {
    if (!gps.warnings.includes(message)) {
      gps.warnings.push(message);
    }
  };

  const riskRules = [
    {
      key: 'duplicate',
      pattern: /DUPLICATE_PROOF|duplicate proof|identical proof file/i,
      label: 'Duplicate proof detected'
    },
    {
      key: 'reuse',
      pattern: /PROOF_REUSE|proof reuse|proof file appears to have been used/i,
      label: 'Previously used proof detected'
    },
    {
      key: 'rapid',
      pattern: /RAPID_SUBMISSION|rapid submission|submitted within.*short interval/i,
      label: 'Rapid submission detected'
    },
    {
      key: 'previous',
      pattern: /PREVIOUS_REJECTIONS|previous rejected claims|account has previous rejected/i,
      label: 'Previous rejected participation detected'
    },
    {
      key: 'frequency24',
      pattern: /REPEATED_CLAIM_PATTERN|repeated claim pattern|five or more claims/i,
      label: 'Repeated claims within 24 hours'
    },
    {
      key: 'frequency7',
      pattern: /HIGH_CLAIM_FREQUENCY|high claim frequency|seven or more claims/i,
      label: 'High participation claim frequency'
    },
    {
      key: 'sameactivity',
      pattern: /REPEATED_ACTIVITY_CLAIM|multiple claims for this activity/i,
      label: 'Repeated claim for the same activity'
    },
    {
      key: 'missingproof',
      pattern: /missing proof file/i,
      label: 'Missing participation proof'
    },
    {
      key: 'missingfeedback',
      pattern: /missing feedback/i,
      label: 'Missing participation feedback'
    },
    {
      key: 'aiunavailable',
      pattern: /AI_UNAVAILABLE|AI service unavailable/i,
      label: 'AI service unavailable — manual review required'
    }
  ];

  for (const reason of reasons) {
    // Remove AI score metadata.
    if (
      /^(AI Prediction|Risk Level|Risk Score):/i.test(reason)
    ) {
      continue;
    }
    // Location source is information, not fraud.
const sourceMatch = reason.match(
  /^Location Evidence Source:\s*(.+)$/i
);

if (sourceMatch) {
  const source = sourceMatch[1].trim();

  gps.source = source;

  const sourceLabel =
    source === 'BROWSER_GEOLOCATION'
      ? 'Browser Geolocation'
      : source === 'PHOTO_EXIF'
      ? 'Photo EXIF Metadata'
      : source.replaceAll('_', ' ');

  addNote(`Location Evidence Source: ${sourceLabel}`);

  continue;
}
    // GPS status.
    const statusMatch = reason.match(
      /^GPS Verification:\s*(.+)$/i
    );

    if (statusMatch) {
      gps.status = statusMatch[1].trim();
      continue;
    }

    // Event radius.
    const radiusMatch = reason.match(
      /^Event Coverage Radius:\s*([\d.]+)/i
    );

    if (radiusMatch) {
      gps.radius = Number(radiusMatch[1]);
      continue;
    }

    // Photo distance.
    const distanceMatch = reason.match(
      /^Distance from Event:\s*([\d.]+)/i
    );

    if (distanceMatch) {
      gps.distance = Number(distanceMatch[1]);
      continue;
    }

    // GPS accuracy.
    const accuracyMatch = reason.match(
      /^GPS Accuracy:\s*±?\s*([\d.]+)/i
    );

    if (accuracyMatch) {
      gps.accuracy = Number(accuracyMatch[1]);
      continue;
    }

    // GPS-related warnings.
    if (
      /GPS_ACCURACY_UNKNOWN|accuracy was not provided|boundary cannot be verified reliably/i.test(reason)
    ) {
      addGpsWarning('Photo GPS accuracy is unavailable.');
      continue;
    }

    if (
      /GPS_BOUNDARY_UNCERTAIN|GPS accuracy overlaps|location uncertainty|LOW_GPS_PRECISION/i.test(reason)
    ) {
      addGpsWarning('GPS location uncertainty requires review.');
      continue;
    }

    if (
      /GPS_LOCATION_MISMATCH|reported location is outside|outside the event radius/i.test(reason)
    ) {
      addGpsWarning(
        'Photo GPS is outside the permitted activity radius.'
      );
      continue;
    }

    if (
      /GPS_UNAVAILABLE|LOCATION_UNVERIFIED|PHOTO_GPS_UNAVAILABLE|no readable GPS metadata|location could not be verified/i.test(reason)
    ) {
      addGpsWarning('Photo GPS location could not be verified.');
      continue;
    }

    if (
      /ACTIVITY_LOCATION_UNCONFIGURED|activity.*coordinates.*not configured/i.test(reason)
    ) {
      addGpsWarning('Activity location is not configured.');
      continue;
    }

    // Ignore outdated generic warning that
    // incorrectly described any review as fraud.
    if (
      /AI detected an unusual participation pattern requiring human review/i.test(reason)
    ) {
      continue;
    }

    const rule = riskRules.find(
      (item) => item.pattern.test(reason)
    );

   if (rule) {
  const informationOnly = [
    'previous',
    'missingproof',
    'missingfeedback',
    'aiunavailable'
  ];

  if (informationOnly.includes(rule.key)) {
    addNote(rule.label);
  } else if (!seenRisks.has(rule.key)) {
    seenRisks.add(rule.key);
    risks.push(rule.label);
  }

  continue;
}

    // Preserve other genuine review reasons.
    const fallback = reason.replace(
      /^(Verification Warning|AI Warning):\s*/i,
      ''
    );

    // Unclassified explanations remain review notes.
// Do not automatically describe them as fraud.
addNote(fallback);
  }

 return { gps, risks, notes };
};

  /* =========================================================
     FILTER
     ========================================================= */

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const participant = String(
        record.full_name || ''
      ).toLowerCase();

      const email = String(
        record.email || ''
      ).toLowerCase();

      const activity = String(
        record.activity_title || ''
      ).toLowerCase();

      const searchValue = search
        .toLowerCase()
        .trim();

      const matchesSearch =
        participant.includes(searchValue) ||
        email.includes(searchValue) ||
        activity.includes(searchValue);

      const level = getRiskLevel(
        record.ai_score
      );

      const matchesRisk =
        riskFilter === 'ALL' ||
        riskFilter === level;

      return matchesSearch && matchesRisk;
    });
  }, [records, search, riskFilter]);

  /* =========================================================
     COUNTS
     ========================================================= */

  const highCount = records.filter(
    (item) =>
      getRiskLevel(item.ai_score) === 'HIGH'
  ).length;

  const mediumCount = records.filter(
    (item) =>
      getRiskLevel(item.ai_score) === 'MEDIUM'
  ).length;

  const lowCount = records.filter(
    (item) =>
      getRiskLevel(item.ai_score) === 'LOW'
  ).length;

  /* =========================================================
     SELECTED RECORD VALUES
     ========================================================= */

const selectedProofUrl = getProofUrl(selectedRecord);

  const selectedRiskLevel = getRiskLevel(
    selectedRecord?.ai_score
  );

  const selectedRiskClass = getRiskClass(
    selectedRiskLevel
  );

  const selectedScore = Number(
    selectedRecord?.ai_score || 0
  );

const {
  gps: selectedGps,
  risks: selectedIndicators = [],
  notes: selectedNotes = []
} = getReviewDetails(selectedRecord);

const selectedGpsInside =
  selectedGps.status === 'INSIDE_EVENT_AREA';

const selectedGpsOutside =
  selectedGps.status === 'OUTSIDE_EVENT_AREA';

const selectedGpsStyle = selectedGpsInside
  ? {
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      color: '#166534'
    }
  : selectedGpsOutside
  ? {
      background: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#991b1b'
    }
  : {
      background: '#fffbeb',
      border: '1px solid #fde68a',
      color: '#92400e'
    };

const selectedGpsLabel = {
  INSIDE_EVENT_AREA: 'Inside Event Area',
  OUTSIDE_EVENT_AREA: 'Outside Event Area',
  BOUNDARY_UNCERTAIN: 'Boundary Uncertain',
  LOCATION_UNVERIFIED: 'Location Unverified',
  ACTIVITY_LOCATION_UNCONFIGURED: 'Activity Location Not Configured',
  NOT_RECORDED: 'Not Recorded'
}[selectedGps.status] ||
  selectedGps.status.replaceAll('_', ' ');

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <main className="admin-participation-page">

      {/* =====================================================
          TOAST
          ===================================================== */}

      {showToast && (
        <div className="floating-toast-wrap">
          <div
            className={`floating-toast ${
              messageType === 'success'
                ? 'floating-toast-success'
                : 'floating-toast-error'
            }`}
          >
            <div className="floating-toast-icon">
              {messageType === 'success'
                ? '✓'
                : '!'}
            </div>

            <div className="floating-toast-content">
              <h4>
                {messageType === 'success'
                  ? 'Success'
                  : 'Error'}
              </h4>

              <p>{message}</p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          HEADER
          ===================================================== */}

      <section className="admin-participation-header">
        <div>
          <span className="admin-participation-eyebrow">
            PARTICIPATION MANAGEMENT
          </span>

          <h1>Participation Review</h1>

          <p>
            Review citizen participation submissions,
            submitted proof, and AI-assisted risk
            assessments before making the final decision.
          </p>
        </div>

        <button
          type="button"
          className="admin-participation-refresh"
          onClick={fetchReviewQueue}
          disabled={loading}
        >
          ↻ {loading ? 'Loading...' : 'Refresh'}
        </button>
      </section>

      {/* =====================================================
          SUMMARY
          ===================================================== */}

      <section className="admin-participation-summary-grid">

        <SummaryCard
          icon="▣"
          title="Pending Reviews"
          value={records.length}
          description="Awaiting human review"
          type="pending"
        />

        <SummaryCard
          icon="!"
          title="High Risk"
          value={highCount}
          description="Requires closer review"
          type="high"
        />

        <SummaryCard
          icon="!"
          title="Medium Risk"
          value={mediumCount}
          description="Review recommended"
          type="medium"
        />

        <SummaryCard
          icon="✓"
          title="Low Risk"
          value={lowCount}
          description="Lower AI risk score"
          type="low"
        />

      </section>

      {/* =====================================================
          RECORDS CARD
          ===================================================== */}

      <section className="admin-participation-card">

        <div className="admin-participation-card-header">
          <div>
            <h2>Pending Submissions</h2>

            <p>
              High-risk submissions are prioritized for
              human review.
            </p>
          </div>

          <span className="admin-participation-count">
            {filteredRecords.length}{' '}
            {filteredRecords.length === 1
              ? 'record'
              : 'records'}
          </span>
        </div>

        {/* =================================================
            SEARCH AND FILTER
            ================================================= */}

        <div className="admin-participation-toolbar">

          <div className="admin-participation-search">
            <span>⌕</span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search participant, email, or activity..."
            />
          </div>

          <select
            value={riskFilter}
            onChange={(event) =>
              setRiskFilter(event.target.value)
            }
          >
            <option value="ALL">
              All Risk Levels
            </option>

            <option value="HIGH">
              High Risk
            </option>

            <option value="MEDIUM">
              Medium Risk
            </option>

            <option value="LOW">
              Low Risk
            </option>
          </select>

        </div>

        {/* =================================================
            TABLE
            ================================================= */}

        <div className="admin-participation-table-wrap">

          <table className="admin-participation-table">

            <thead>
              <tr>
                <th>Participant</th>
                <th>Activity</th>
                <th>Submitted</th>
                <th>Proof</th>
               <th>AI Risk</th>
<th>QR Attendance</th>
<th>Action</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="admin-participation-empty-cell"
                  >
                    <div className="admin-participation-empty">
                      <div className="admin-participation-loader" />

                      <strong>
                        Loading review queue...
                      </strong>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="admin-participation-empty-cell"
                  >
                    <div className="admin-participation-empty">

                      <div className="admin-participation-empty-icon">
                        ✓
                      </div>

                      <strong>
                        No submissions found
                      </strong>

                      <span>
                        There are no pending submissions
                        matching the selected filters.
                      </span>

                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
               const proofUrl = getProofUrl(record);

                  const riskLevel = getRiskLevel(
                    record.ai_score
                  );

                  const riskClass =
                    getRiskClass(riskLevel);

                    const qrAttendance = getQrAttendance(record);

                  return (
                    <tr
                      key={
                        record.participation_id
                      }
                    >

                      {/* PARTICIPANT */}

                      <td>
                        <div className="admin-participation-user">

                          <div className="admin-participation-avatar">
                            {record.full_name
                              ? record.full_name
                                  .charAt(0)
                                  .toUpperCase()
                              : 'U'}
                          </div>

                          <div>
                            <strong>
                              {record.full_name ||
                                'Unknown Participant'}
                            </strong>

                            <span>
                              {record.email ||
                                'No email'}
                            </span>
                          </div>

                        </div>
                      </td>

                      {/* ACTIVITY */}

                      <td>
                        <div className="admin-participation-activity">
                          <strong>
                            {record.activity_title ||
                              'Untitled Activity'}
                          </strong>

                          {record.category && (
                            <span>
                              {record.category}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* DATE */}

                      <td>
                        <div className="admin-participation-date">
                          <strong>
                            {formatDate(
                              record.submitted_at
                            )}
                          </strong>

                          <span>
                            {formatTime(
                              record.submitted_at
                            )}
                          </span>
                        </div>
                      </td>

                      {/* PROOF */}

                      <td>
                        {proofUrl ? (
                          <img
                            src={proofUrl}
                            alt="Submitted proof"
                            className="admin-participation-proof-thumb"
                          />
                        ) : (
                          <span className="admin-participation-no-proof">
                            None
                          </span>
                        )}
                      </td>

                      {/* AI RISK */}

                      <td>
                        <div
                          className={`admin-participation-risk ${riskClass}`}
                        >
                          <strong>
                            {riskLevel}
                          </strong>

                          <span>
                            {Number(
                              record.ai_score || 0
                            ).toFixed(2)}
                            %
                          </span>
                        </div>
                      </td>
                              {/* QR ATTENDANCE */}

<td>
  <span
    className={`admin-qr-status ${qrAttendance.className}`}
  >
    {qrAttendance.label}
  </span>
</td>
                      {/* REVIEW */}

                      <td>
                        <button
                          type="button"
                          className="admin-participation-review-btn"
                          onClick={() =>
                            setSelectedRecord(
                              record
                            )
                          }
                        >
                          Review
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}

            </tbody>
          </table>

        </div>
      </section>

      {/* =====================================================
          REVIEW MODAL
          ===================================================== */}

      {selectedRecord && (
        <div
          className="participation-review-modal-overlay"
          onClick={() =>
            setSelectedRecord(null)
          }
        >

          <div
            className="participation-review-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="participation-review-modal-header">

              <div>
                <span>
                  PARTICIPATION REVIEW
                </span>

                <h2>
                  Review Submission #
                  {selectedRecord.participation_id}
                </h2>
              </div>

              <button
                type="button"
                className="participation-review-close"
                onClick={() =>
                  setSelectedRecord(null)
                }
              >
                ×
              </button>

            </div>

            {/* =================================================
                PARTICIPANT + ACTIVITY
                ================================================= */}

            <div className="participation-review-overview">

              <div className="participation-review-person">

                <div className="participation-review-avatar">
                  {selectedRecord.full_name
                    ? selectedRecord.full_name
                        .charAt(0)
                        .toUpperCase()
                    : 'U'}
                </div>

                <div>
                  <span>Citizen</span>

                  <strong>
                    {selectedRecord.full_name ||
                      'Unknown Participant'}
                  </strong>

                  <small>
                    {selectedRecord.email ||
                      'No email'}
                  </small>
                </div>

              </div>

              <div className="participation-review-overview-item">
                <span>Activity</span>

                <strong>
                  {selectedRecord.activity_title ||
                    'Untitled Activity'}
                </strong>

                {selectedRecord.category && (
                  <small>
                    {selectedRecord.category}
                  </small>
                )}
              </div>

              <div className="participation-review-overview-item">
                <span>Submitted</span>

                <strong>
                  {formatDate(
                    selectedRecord.submitted_at
                  )}
                </strong>

                <small>
                  {formatTime(
                    selectedRecord.submitted_at
                  )}
                </small>
              </div>

              <div className="participation-review-overview-item">
                <span>Status</span>

                <strong className="participation-review-pending">
                  Pending Review
                </strong>
              </div>

            </div>

            {/* =================================================
                MODAL BODY
                ================================================= */}

            <div className="participation-review-body">

              {/* LEFT COLUMN */}

              <div className="participation-review-left">

                {/* PROOF */}

                <section className="participation-review-section">

                  <div className="participation-review-section-title">
                    <span>▣</span>
                    <h3>Submitted Proof</h3>
                  </div>

                  {selectedProofUrl ? (
                    <a
                      href={selectedProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="participation-review-proof-link"
                    >
                      <img
                        src={selectedProofUrl}
                        alt="Submitted proof"
                        className="participation-review-proof"
                      />

                      <div className="participation-review-proof-overlay">
                        View Full Proof ↗
                      </div>
                    </a>
                  ) : (
                    <div className="participation-review-proof-empty">
                      <span>⊘</span>
                      <strong>
                        No proof submitted
                      </strong>
                    </div>
                  )}

                </section>

                {/* FEEDBACK */}

                <section className="participation-review-section">

                  <div className="participation-review-section-title">
                    <span>☰</span>
                    <h3>Citizen Feedback</h3>
                  </div>

                  <div className="participation-review-feedback">
                    {selectedRecord.feedback_text ||
                      'No feedback was submitted.'}
                  </div>

                </section>

              </div>

              {/* RIGHT COLUMN */}

              <div className="participation-review-right">

                {/* QR ATTENDANCE VALIDATION */}

<section className="participation-review-section">

  <div className="participation-review-section-title">
    <span>▣</span>
    <h3>QR Attendance Verification</h3>
  </div>

  <div className="admin-qr-panel">

    <div className="admin-qr-panel-header">
      <span>Attendance Status</span>

      <span
        className={`admin-qr-status ${
          getQrAttendance(selectedRecord).className
        }`}
      >
        {getQrAttendance(selectedRecord).label}
      </span>
    </div>

    {selectedRecord.validation_type === 'qr' ? (
      <>
        <div className="admin-qr-scans">

          <div className="admin-qr-scan-card">
            <span>QR Check-In</span>

            <strong>
              {selectedRecord.check_in_at
                ? '✓ Completed'
                : '⚠ Missing'}
            </strong>

            <small>
              {selectedRecord.check_in_at
                ? `${formatDate(selectedRecord.check_in_at)} • ${formatTime(selectedRecord.check_in_at)}`
                : 'No Check-In recorded'}
            </small>
          </div>

          <div className="admin-qr-scan-card">
            <span>QR Check-Out</span>

            <strong>
              {selectedRecord.check_out_at
                ? '✓ Completed'
                : '⚠ Missing'}
            </strong>

            <small>
              {selectedRecord.check_out_at
                ? `${formatDate(selectedRecord.check_out_at)} • ${formatTime(selectedRecord.check_out_at)}`
                : 'No Check-Out recorded'}
            </small>
          </div>

        </div>

        {getQrAttendance(selectedRecord).status !== 'complete' && (
          <div className="admin-qr-warning">
            ⚠ {getQrAttendance(selectedRecord).message}
            {' '}Participation cannot be approved until
            required QR attendance is complete.
          </div>
        )}
      </>
    ) : (
      <p className="admin-qr-description">
        {getQrAttendance(selectedRecord).message}
      </p>
    )}

  </div>

</section>

                {/* AI ASSESSMENT */}

                <section className="participation-review-section">

                  <div className="participation-review-ai-heading">

                    <div className="participation-review-section-title">
                      <span>AI</span>
                      <h3>AI Risk Assessment</h3>
                    </div>

                    <span
                      className={`participation-review-risk-badge ${selectedRiskClass}`}
                    >
                      {selectedRiskLevel} RISK
                    </span>

                  </div>

                  <div
                    className={`participation-review-ai-card ${selectedRiskClass}`}
                  >

                    <div className="participation-review-score-row">
                      <span>Risk Score</span>

                      <strong>
                        {selectedScore.toFixed(2)}%
                      </strong>
                    </div>

                    <progress
                      className="participation-review-progress"
                      value={Math.min(
                        selectedScore,
                        100
                      )}
                      max="100"
                    />

                    <div className="participation-review-score-row">
                      <span>AI Assessment</span>

                      <strong>
                        {Number(
                          selectedRecord.ai_flag
                        ) === 1
                          ? 'Requires Human Review'
                          : 'No AI Flag'}
                      </strong>
                    </div>

                  </div>

                </section>

                
{/* ==========================================
    GPS INFORMATION
    ========================================== */}

<section className="participation-review-section">

  <div className="participation-review-section-title">
    <span>📍</span>
    <h3>GPS Information</h3>
  </div>

  <div
    style={{
      ...selectedGpsStyle,
      borderRadius: '10px',
      padding: '15px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}
  >

    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap'
      }}
    >
      <span style={{ fontSize: '12px' }}>
       GPS Location Verification
      </span>

      <strong style={{ fontSize: '12px' }}>
        {selectedGpsInside
          ? '✓ '
          : selectedGpsOutside
          ? '⚠ '
          : '! '}
        {selectedGpsLabel}
      </strong>
    </div>

    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '10px'
      }}
    >
      <span style={{ fontSize: '12px' }}>
        Distance from Activity
      </span>

      <strong style={{ fontSize: '12px' }}>
        {selectedGps.distance !== null
          ? `${selectedGps.distance.toFixed(2)} meters`
          : 'Unavailable'}
      </strong>
    </div>

    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '10px'
      }}
    >
      <span style={{ fontSize: '12px' }}>
        Allowed Coverage Radius
      </span>

      <strong style={{ fontSize: '12px' }}>
        {selectedGps.radius !== null
          ? `${selectedGps.radius} meters`
          : 'Unavailable'}
      </strong>
    </div>

    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '10px'
      }}
    >
      <span style={{ fontSize: '12px' }}>
        GPS Accuracy
      </span>

      <strong style={{ fontSize: '12px' }}>
        {selectedGps.accuracy !== null
          ? `±${selectedGps.accuracy} meters`
          : 'Unknown'}
      </strong>
    </div>

  </div>

  {selectedGps.warnings.map((warning, index) => (
    <div
      key={`${warning}-${index}`}
      style={{
        marginTop: '8px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: '#fffbeb',
        border: '1px solid #fde68a',
        color: '#92400e',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px'
      }}
    >
      <span>!</span>
      <span>{warning}</span>
    </div>
  ))}

  <p
    style={{
      fontSize: '11px',
      color: '#64748b',
      marginTop: '8px'
    }}
  >
   {selectedGps.source === 'BROWSER_GEOLOCATION'
  ? "Location coordinates were obtained from the Citizen's browser during proof submission. Location evidence does not independently prove attendance."
  : selectedGps.source === 'PHOTO_EXIF'
  ? "Location coordinates were extracted from the submitted photo's EXIF metadata. This does not independently prove attendance."
  : "Location source is not recorded. GPS coordinates alone do not independently prove attendance."}
  </p>

</section>


{/* ==========================================
    RISK INDICATORS
    ========================================== */}

<section className="participation-review-section">

  <div className="participation-review-section-title">
    <span>!</span>
   <h3>Suspicious Activity Indicators</h3>
  </div>

  <div className="participation-review-indicators">

    {selectedIndicators.length === 0 ? (

      <div
        className="participation-review-indicator normal"
        style={{
          background: '#f0fdf4',
          borderColor: '#bbf7d0',
          color: '#166534'
        }}
      >
        <span>✓</span>

      <p>
  No specific suspicious behavior or proof-reuse
  indicators were recorded.
</p>
      </div>

    ) : (

      selectedIndicators.map((indicator, index) => (

        <div
          key={`${indicator}-${index}`}
          className="participation-review-indicator warning"
        >
          <span>!</span>
          <p>{indicator}</p>
        </div>

      ))

    )}

  </div>

</section>

      {/* ==========================================
    PARTICIPATION INFORMATION & REVIEW NOTES
    ========================================== */}

<section className="participation-review-section">

  <div className="participation-review-section-title">
    <span>i</span>
    <h3>Participation Information & Review Notes</h3>
  </div>

  <div className="participation-review-indicators">

    {selectedNotes.length === 0 ? (

      <div className="participation-review-indicator info">
        <span>i</span>

        <p>
          No additional participation information
          or review notes recorded.
        </p>
      </div>

    ) : (

      selectedNotes.map((note, index) => (

        <div
          key={`review-note-${index}`}
          className="participation-review-indicator info"
        >
          <span>i</span>
          <p>{note}</p>
        </div>

      ))

    )}

  </div>

</section>
                {/* HUMAN REVIEW NOTICE */}

                <div className="participation-review-notice">

                  <div>i</div>

                  <p>
                    <strong>
                      Human Review Required
                    </strong>

                    AI assessment is a
                    decision-support tool only.
                    Review the submitted evidence
                    and participation information
                    before making the final
                    decision.
                  </p>

                </div>

              </div>
            </div>

            {/* =================================================
                MODAL FOOTER
                ================================================= */}

            <div className="participation-review-modal-footer">

              <button
                type="button"
                className="participation-review-cancel"
                onClick={() =>
                  setSelectedRecord(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="participation-review-reject"
                onClick={() =>
                  handleReject(
                    selectedRecord.participation_id
                  )
                }
              >
                ✕ Reject
              </button>

              <button
                type="button"
                className="participation-review-approve"
                disabled={
  selectedRecord.validation_type === 'qr' &&
  getQrAttendance(selectedRecord).status !== 'complete'
}
title={
  selectedRecord.validation_type === 'qr' &&
  getQrAttendance(selectedRecord).status !== 'complete'
    ? 'Complete QR attendance is required before approval.'
    : ''
}
                onClick={() =>
                  handleApprove(
                    selectedRecord.participation_id
                  )
                }
              >
                ✓ Approve Participation
              </button>

            </div>

          </div>
        </div>
      )}

    </main>
  );
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

function SummaryCard({
  icon,
  title,
  value,
  description,
  type,
}) {
  return (
    <article className="admin-participation-summary-card">

      <div
        className={`admin-participation-summary-icon ${type}`}
      >
        {icon}
      </div>

      <div>
        <span>{title}</span>

        <strong>
          {Number(value || 0).toLocaleString()}
        </strong>

        <small>{description}</small>
      </div>

    </article>
  );
}

export default AdminReportsPage;