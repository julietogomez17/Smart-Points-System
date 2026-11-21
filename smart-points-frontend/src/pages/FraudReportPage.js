
import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const getScore = (record) => {
  let score = Number(record?.ai_score || 0);

  if (score > 0 && score <= 1) {
    score *= 100;
  }

  return Math.min(Math.max(score, 0), 100);
};

const getRiskLevel = (record) => {
  const score = getScore(record);

  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';

  return 'LOW';
};


const getAssessmentSections = (record) => {
  const reasons = String(record?.ai_reason || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);

  const gps = {
    status: 'NOT_RECORDED',
    radius: null,
    distance: null,
    accuracy: null,
    notes: []
  };

  const riskIndicators = [];
  const seenRisks = new Set();

  const riskCategories = [
    {
      key: 'DUPLICATE_PROOF',
      pattern: /duplicate.proof|identical proof file/i
    },
    {
      key: 'PROOF_REUSE',
      pattern: /proof.reuse|proof file appears to have been used|previous use\(s\)/i
    },
    {
      key: 'RAPID_SUBMISSION',
      pattern: /rapid.submission|submitted within.*(10 minutes|short interval)/i
    },
    {
      key: 'PREVIOUS_REJECTIONS',
      pattern: /previous.reject|prior reject|account has previous rejected/i
    },
    {
      key: 'REPEATED_CLAIMS',
      pattern: /repeated.claim.pattern|five or more claims|claims within the last 24 hours/i
    },
    {
      key: 'HIGH_CLAIM_FREQUENCY',
      pattern: /high.claim.frequency|seven or more claims|claims within the last 7 days/i
    },
    {
      key: 'REPEATED_ACTIVITY',
      pattern: /repeated.activity.claim|multiple claims for this activity/i
    },
    {
      key: 'MISSING_PROOF',
      pattern: /missing proof file/i
    },
    {
      key: 'MISSING_FEEDBACK',
      pattern: /missing feedback/i
    },
    {
      key: 'AI_UNAVAILABLE',
      pattern: /ai.unavailable|ai service unavailable/i
    }
  ];

  const addGpsNote = (message) => {
    if (!gps.notes.includes(message)) {
      gps.notes.push(message);
    }
  };

  for (const reason of reasons) {
    const text = reason.trim();

    // Metadata already displayed in AI assessment.
    if (
      /^(AI Prediction|Risk Level|Risk Score):/i.test(text)
    ) {
      continue;
    }

    const radiusMatch = text.match(
      /^Event Coverage Radius:\s*([\d.]+)/i
    );

    if (radiusMatch) {
      gps.radius = Number(radiusMatch[1]);
      continue;
    }

    const distanceMatch = text.match(
      /^Distance from Event:\s*([\d.]+)/i
    );

    if (distanceMatch) {
      gps.distance = Number(distanceMatch[1]);
      continue;
    }

    const accuracyMatch = text.match(
      /^GPS Accuracy:\s*[±]?\s*([\d.]+)/i
    );

    if (accuracyMatch) {
      gps.accuracy = Number(accuracyMatch[1]);
      continue;
    }

    const statusMatch = text.match(
      /^GPS Verification:\s*(.+)$/i
    );

    if (statusMatch) {
      gps.status = statusMatch[1].trim();
      continue;
    }

    // Put location warnings in GPS Information.
    if (
      /GPS_|location|boundary|photo capture|event area/i.test(text)
    ) {
      if (/GPS_ACCURACY_UNKNOWN|accuracy was not provided|boundary cannot be verified reliably/i.test(text)) {
        addGpsNote(
          'Photo GPS accuracy is unavailable.'
        );
      } else if (
        /GPS_BOUNDARY_UNCERTAIN|accuracy overlaps/i.test(text)
      ) {
        addGpsNote(
          'GPS uncertainty overlaps the event boundary.'
        );
      } else if (
        /GPS_LOCATION_MISMATCH|reported location is outside/i.test(text)
      ) {
        addGpsNote(
          'Photo GPS indicates a location outside the activity radius.'
        );
      } else if (
        /GPS_UNAVAILABLE|LOCATION_UNVERIFIED|location could not be verified|no readable GPS metadata/i.test(text)
      ) {
        addGpsNote(
          'Photo GPS location could not be verified.'
        );
      } else if (
        /ACTIVITY_LOCATION_UNCONFIGURED/i.test(text)
      ) {
        addGpsNote(
          'The activity location or radius is not configured.'
        );
      } else {
        addGpsNote(text);
      }

      continue;
    }

    // Do not present a generic review requirement
    // as proof of unusual account behavior.
    if (
      /AI detected an unusual participation pattern requiring human review/i.test(text)
    ) {
      continue;
    }

    const normalized = text.replace(
      /^(AI Warning|Verification Warning):\s*/i,
      ''
    );

    const category = riskCategories.find(
      (item) => item.pattern.test(normalized)
    );

    const key = category
      ? category.key
      : normalized.toLowerCase();

    if (!seenRisks.has(key)) {
      seenRisks.add(key);

      // Prefer readable risk descriptions to raw codes.
      const labels = {
        DUPLICATE_PROOF: 'Duplicate proof detected',
        PROOF_REUSE: 'Previously used proof detected',
        RAPID_SUBMISSION: 'Rapid submission detected',
        PREVIOUS_REJECTIONS: 'Previous rejected participation detected',
        REPEATED_CLAIMS: 'Repeated claims within 24 hours',
        HIGH_CLAIM_FREQUENCY: 'High participation claim frequency',
        REPEATED_ACTIVITY: 'Multiple claims for the same activity',
        MISSING_PROOF: 'Missing proof file',
        MISSING_FEEDBACK: 'Missing participation feedback',
        AI_UNAVAILABLE: 'AI service unavailable; manual review needed'
      };

      riskIndicators.push(
        labels[key] || normalized
      );
    }
  }

  return {
    gps,
    riskIndicators
  };
};




function FraudReportPage() {

  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    fetchFraudReport();
  }, []);

  /* =========================================================
     FETCH FRAUD REPORT
     ========================================================= */

  const fetchFraudReport = async () => {
    try {
      setLoading(true);
      setMessage('');

      const res = await api.get('/reports/fraud');

      setRecords(res.data.report || []);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          'Failed to load fraud report'
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     HELPERS
     ========================================================= */

  const formatDate = (value) => {
    if (!value) return 'N/A';

    return new Date(value).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };


  const formatStatus = (status) => {
    if (!status) return 'Pending Review';

    const value = String(status)
      .replaceAll('_', ' ')
      .toLowerCase();

    return value.replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
  };

  const getInitials = (name) => {
    if (!name) return '?';

    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  };

 
const getIndicators = (record) => {
  return getAssessmentSections(record).riskIndicators;
};


  const getProofUrl = (proofUrl) => {
    if (!proofUrl) return null;

    if (
      proofUrl.startsWith('http://') ||
      proofUrl.startsWith('https://')
    ) {
      return proofUrl;
    }

    return proofUrl;
  };

  /* =========================================================
     COUNTS
     ========================================================= */

  const stats = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;

    records.forEach((record) => {
      const risk = getRiskLevel(record);

      if (risk === 'HIGH') high += 1;
      else if (risk === 'MEDIUM') medium += 1;
      else low += 1;
    });

    return {
      total: records.length,
      high,
      medium,
      low,
    };
  }, [records]);

  /* =========================================================
     FILTERING
     ========================================================= */

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const searchableText = [
        record.full_name,
        record.email,
        record.activity_title,
        record.participation_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !search || searchableText.includes(search);

      const risk = getRiskLevel(record);

      const matchesRisk =
        riskFilter === 'all' || risk === riskFilter;

      const normalizedStatus = String(
        record.status || 'pending'
      ).toLowerCase();

      const matchesStatus =
        statusFilter === 'all' ||
        normalizedStatus === statusFilter;

      return (
        matchesSearch &&
        matchesRisk &&
        matchesStatus
      );
    });
  }, [
    records,
    searchTerm,
    riskFilter,
    statusFilter,
  ]);

  /* =========================================================
     EXPORT CURRENT VIEW
     ========================================================= */

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      return;
    }

    const headers = [
      'Participation ID',
      'Citizen',
      'Email',
      'Activity',
      'AI Risk Score',
      'Risk Level',
      'Status',
      'Submitted At',
      'AI Reason',
    ];

    const rows = filteredRecords.map((record) => [
      record.participation_id,
      record.full_name || '',
      record.email || '',
      record.activity_title || '',
      `${getScore(record).toFixed(2)}%`,
      getRiskLevel(record),
      record.status || '',
      formatDate(record.submitted_at),
      record.ai_reason || '',
    ]);

    const escapeCsv = (value) => {
      const text = String(value ?? '');

      return `"${text.replaceAll('"', '""')}"`;
    };

    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) =>
        row.map(escapeCsv).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = 'citipoints-fraud-alerts.csv';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  /* =========================================================
     MAIN PAGE
     ========================================================= */

  return (
    <main className="fraud-monitor-page">
      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="fraud-monitor-hero">
        <div>
          <span>FRAUD MONITORING</span>

          <h1>Fraud Alerts</h1>

          <p>
            Review AI-assisted risk assessments and
            suspicious participation patterns.
            Final decisions remain with the LGU
            Administrator.
          </p>
        </div>

        <div className="fraud-monitor-hero-icon">
          ⚠
        </div>
      </section>

      {/* =====================================================
          ERROR
          ===================================================== */}

      {message && (
        <div className="fraud-monitor-error">
          <strong>Unable to load report</strong>
          <span>{message}</span>

          <button
            type="button"
            onClick={fetchFraudReport}
          >
            Try Again
          </button>
        </div>
      )}

      {/* =====================================================
          SUMMARY
          ===================================================== */}

      <section className="fraud-monitor-stats">
        <FraudStat
          icon="!"
          title="Total Flagged"
          value={stats.total}
          description="AI-flagged records"
          type="total"
        />

        <FraudStat
          icon="▲"
          title="High Risk"
          value={stats.high}
          description="Risk score ≥ 70%"
          type="high"
        />

        <FraudStat
          icon="!"
          title="Medium Risk"
          value={stats.medium}
          description="Risk score 40% – 69.99%"
          type="medium"
        />

        <FraudStat
          icon="✓"
          title="Low Risk"
          value={stats.low}
          description="Risk score below 40%"
          type="low"
        />
      </section>

      {/* =====================================================
          REPORT
          ===================================================== */}

      <section className="fraud-monitor-panel">
        <div className="fraud-monitor-panel-header">
          <div>
            <h2>Fraud Risk Monitoring</h2>

            <p>
              View participation records flagged by
              the AI model for potential suspicious
              activity.
            </p>
          </div>

          <button
            type="button"
            className="fraud-export-btn"
            onClick={handleExport}
            disabled={filteredRecords.length === 0}
          >
            ↓ Export
          </button>
        </div>

        {/* FILTERS */}

        <div className="fraud-monitor-toolbar">
          <div className="fraud-monitor-search">
            <span>⌕</span>

            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search name, email, activity..."
            />
          </div>

          <select
            value={riskFilter}
            onChange={(event) =>
              setRiskFilter(event.target.value)
            }
          >
            <option value="all">
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

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">
              All Status
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="approved">
              Approved
            </option>

            <option value="rejected">
              Rejected
            </option>
          </select>
        </div>

        {/* TABLE */}

        <div className="fraud-monitor-table-wrap">
          <table className="fraud-monitor-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Citizen</th>
                <th>Activity</th>
                <th>Submitted</th>
                <th>AI Risk Score</th>
                <th>Risk Level</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="fraud-table-message"
                  >
                    Loading fraud alerts...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="fraud-table-message"
                  >
                    <div className="fraud-empty-state">
                      <span>✓</span>

                      <strong>
                        No flagged records found
                      </strong>

                      <p>
                        No records match the current
                        filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const score = getScore(record);
                  const risk =
                    getRiskLevel(record);

                  return (
                    <tr
                      key={record.participation_id}
                    >
                      <td>
                        <strong>
                          #
                          {
                            record.participation_id
                          }
                        </strong>
                      </td>

                      <td>
                        <div className="fraud-citizen-cell">
                          <div className="fraud-citizen-avatar">
                            {getInitials(
                              record.full_name
                            )}
                          </div>

                          <div>
                            <strong>
                              {record.full_name ||
                                'Unknown Citizen'}
                            </strong>

                            <span>
                              {record.email ||
                                'No email'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="fraud-activity-name">
                          {record.activity_title ||
                            'N/A'}
                        </span>
                      </td>

                      <td>
                        <span className="fraud-submitted-date">
                          {formatDate(
                            record.submitted_at
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="fraud-score-cell">
                          <strong>
                            {score.toFixed(2)}%
                          </strong>

                          <div>
                            <span
                              className={`fraud-score-fill ${risk.toLowerCase()}`}
                              style={{
                                width: `${score}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <RiskBadge risk={risk} />
                      </td>

                      <td>
                        <span
                          className={`fraud-status-badge ${String(
                            record.status ||
                              'pending'
                          ).toLowerCase()}`}
                        >
                          {formatStatus(
                            record.status
                          )}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="fraud-review-btn"
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

        <div className="fraud-monitor-footer">
          Showing {filteredRecords.length} of{' '}
          {records.length} flagged records
        </div>
      </section>

      {/* =====================================================
          REVIEW MODAL
          ===================================================== */}

      {selectedRecord && (
        <FraudDetailsModal
          record={selectedRecord}
          getScore={getScore}
          getRiskLevel={getRiskLevel}
          getIndicators={getIndicators}
          getProofUrl={getProofUrl}
          formatDate={formatDate}
          formatStatus={formatStatus}
          onClose={() =>
            setSelectedRecord(null)
          }
        />
      )}
    </main>
  );
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

function FraudStat({
  icon,
  title,
  value,
  description,
  type,
}) {
  return (
    <article className="fraud-stat-card">
      <div
        className={`fraud-stat-icon ${type}`}
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

/* =========================================================
   RISK BADGE
   ========================================================= */

function RiskBadge({ risk }) {
  return (
    <span
      className={`fraud-risk-badge ${risk.toLowerCase()}`}
    >
      <i />

      {risk === 'HIGH'
        ? 'High Risk'
        : risk === 'MEDIUM'
        ? 'Medium Risk'
        : 'Low Risk'}
    </span>
  );
}

/* =========================================================
   DETAILS MODAL
   ========================================================= */

function FraudDetailsModal({
  record,
  getScore,
  getRiskLevel,
  getIndicators,
  getProofUrl,
  formatDate,
  formatStatus,
  onClose,
}) {
  const score = getScore(record);
  const risk = getRiskLevel(record);
  const indicators = getIndicators(record);
  const { gps } = getAssessmentSections(record);

const gpsIsInside = gps.status === 'INSIDE_EVENT_AREA';
const gpsIsOutside = gps.status === 'OUTSIDE_EVENT_AREA';

const gpsColor = gpsIsInside
  ? '#15803d'
  : gpsIsOutside
  ? '#dc2626'
  : '#b45309';

const gpsBackground = gpsIsInside
  ? '#f0fdf4'
  : gpsIsOutside
  ? '#fef2f2'
  : '#fffbeb';

const gpsBorder = gpsIsInside
  ? '#bbf7d0'
  : gpsIsOutside
  ? '#fecaca'
  : '#fde68a';

const gpsStatusLabel = {
  INSIDE_EVENT_AREA: 'Inside Event Area',
  OUTSIDE_EVENT_AREA: 'Outside Event Area',
  BOUNDARY_UNCERTAIN: 'Boundary Uncertain',
  LOCATION_UNVERIFIED: 'Location Unverified',
  ACTIVITY_LOCATION_UNCONFIGURED: 'Activity Location Not Configured',
  NOT_RECORDED: 'Not Recorded'
}[gps.status] || gps.status.replaceAll('_', ' ');
  const proofUrl = getProofUrl(
    record.proof_url
  );

  return (
    <div
      className="fraud-modal-backdrop"
      onClick={onClose}
    >
      <aside
        className="fraud-details-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        {/* HEADER */}

        <header className="fraud-details-header">
          <div>
            <span>AI-ASSISTED MONITORING</span>
            <h2>Fraud Alert Details</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="fraud-details-content">
          {/* PARTICIPATION DETAILS */}

          <section className="fraud-detail-section">
            <div className="fraud-detail-section-title">
              <span>●</span>
              <h3>Participation Details</h3>
            </div>

            <div className="fraud-detail-list">
              <DetailRow
                label="Participation ID"
                value={`#${
                  record.participation_id
                }`}
              />

              <DetailRow
                label="Citizen Name"
                value={
                  record.full_name || 'N/A'
                }
              />

              <DetailRow
                label="Email"
                value={record.email || 'N/A'}
              />

              <DetailRow
                label="Activity"
                value={
                  record.activity_title ||
                  'N/A'
                }
              />

              <DetailRow
                label="Submitted At"
                value={formatDate(
                  record.submitted_at
                )}
              />

              <DetailRow
                label="Status"
                value={formatStatus(
                  record.status
                )}
              />
            </div>
          </section>

          {/* AI RISK */}

          <section className="fraud-detail-section">
            <div className="fraud-detail-section-title">
              <span>AI</span>
              <h3>AI Risk Assessment</h3>
            </div>

            <div className="fraud-risk-summary">
              <div
                className={`fraud-score-circle ${risk.toLowerCase()}`}
                style={{
                  '--fraud-score': `${score * 3.6}deg`,
                }}
              >
                <div>
                  <strong>
                    {score.toFixed(2)}%
                  </strong>

                  <span>
                    AI Risk Score
                  </span>
                </div>
              </div>

              <div
                className={`fraud-risk-result ${risk.toLowerCase()}`}
              >
                <span>
                  {risk === 'HIGH'
                    ? '▲'
                    : risk === 'MEDIUM'
                    ? '!'
                    : '✓'}
                </span>

                <div>
                  <strong>
                    {risk} RISK
                  </strong>

                  <small>
                    {record.ai_flag
                      ? 'Requires Human Review'
                      : 'AI Risk Assessment'}
                  </small>
                </div>
              </div>
            </div>

            <div className="fraud-ai-explanation">
              This participation was assessed by
              the CitiPoints AI model for
              potentially suspicious participation
              patterns.
            </div>
          </section>





                        
{/* ==========================================
    GPS INFORMATION
    ========================================== */}

<section className="fraud-detail-section">
  <div className="fraud-detail-section-title">
    <span>📍</span>
    <h3>GPS Information</h3>
  </div>

  <div
    style={{
      backgroundColor: gpsBackground,
      border: `1px solid ${gpsBorder}`,
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}
    >
      <strong style={{ fontSize: '13px' }}>
        Photo GPS Verification
      </strong>

      <span
        style={{
          color: gpsColor,
          fontWeight: 700,
          fontSize: '12px'
        }}
      >
        {gpsIsInside ? '✓ ' : gpsIsOutside ? '⚠ ' : '! '}
        {gpsStatusLabel}
      </span>
    </div>

    <div className="fraud-detail-list">
      <DetailRow
        label="Distance from Activity"
        value={
          gps.distance !== null
            ? `${gps.distance.toFixed(2)} meters`
            : 'Unavailable'
        }
      />

      <DetailRow
        label="Allowed Coverage Radius"
        value={
          gps.radius !== null
            ? `${gps.radius} meters`
            : 'Not configured / unavailable'
        }
      />

      <DetailRow
        label="GPS Accuracy"
        value={
          gps.accuracy !== null
            ? `±${gps.accuracy} meters`
            : 'Unknown'
        }
      />
    </div>

    {gps.notes.length > 0 && (
      <div
        style={{
          borderTop: `1px solid ${gpsBorder}`,
          paddingTop: '12px'
        }}
      >
        {gps.notes.map((note, index) => (
          <p
            key={`${note}-${index}`}
            style={{
              margin: index === 0 ? 0 : '8px 0 0',
              color:
                gpsIsInside ? '#92400e' : gpsColor,
              fontSize: '12px',
              lineHeight: 1.5
            }}
          >
            {note}
          </p>
        ))}
      </div>
    )}
  </div>

  <p
    style={{
      fontSize: '12px',
      color: '#64748b',
      marginTop: '10px'
    }}
  >
    Location is obtained from the uploaded photo's
    GPS metadata. GPS metadata alone does not
    conclusively prove attendance.
  </p>
</section>

          {/* INDICATORS */}

          <section className="fraud-detail-section">
            <div className="fraud-detail-section-title">
              <span>☷</span>
              <h3>Risk Indicators</h3>
            </div>
{indicators.length === 0 ? (
  <div
    style={{
      backgroundColor: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: '10px',
      padding: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      color: '#15803d'
    }}
  >
    <span>✓</span>
    <span>
      No specific behavioral or proof-reuse
      risk indicators recorded.
    </span>
  </div>
) : (
  <div className="fraud-indicator-list">
    {indicators.map((indicator, index) => (
      <div key={`${indicator}-${index}`}>
        <span>!</span>
        <p>{indicator}</p>
      </div>
    ))}
  </div>
)}

          </section>

          {/* EVIDENCE */}

          <section className="fraud-detail-section">
            <div className="fraud-detail-section-title">
              <span>▣</span>
              <h3>Submitted Evidence</h3>
            </div>

            <div className="fraud-evidence-grid">
              <div>
                <span className="fraud-evidence-label">
                  Proof
                </span>

                {proofUrl ? (
                  <a
                    className="fraud-proof-link"
                    href={proofUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Submitted Proof ↗
                  </a>
                ) : (
                  <div className="fraud-no-proof">
                    No proof uploaded
                  </div>
                )}
              </div>

              <div>
                <span className="fraud-evidence-label">
                  Citizen Feedback
                </span>

                <div className="fraud-feedback-box">
                  {record.feedback_text ||
                    'No feedback submitted.'}
                </div>
              </div>
            </div>
          </section>

          {/* HUMAN REVIEW */}

          <div className="fraud-human-review">
            <div>i</div>

            <section>
              <strong>
                Human Review Required
              </strong>

              <p>
                This AI assessment is
                decision-support only. A suspicious
                risk score does not automatically
                determine fraud or reject the
                participation. Final review and
                decisions remain with the LGU
                Administrator through Participation
                Review.
              </p>
            </section>
          </div>
        </div>

        <footer className="fraud-details-footer">
          <button
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}

/* =========================================================
   DETAIL ROW
   ========================================================= */

function DetailRow({ label, value }) {
  return (
    <div className="fraud-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default FraudReportPage;