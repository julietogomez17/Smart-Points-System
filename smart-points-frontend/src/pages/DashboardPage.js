import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Html5Qrcode } from 'html5-qrcode';
import { useRef } from 'react';
/* =========================================================
   RANK CONFIGURATION
   ========================================================= */

const RANK_CONFIG = {
  New: {
    current: 'New',
    next: 'Bronze',
    currentMin: 0,
    nextRequired: 100,
    colorClass: 'rank-new',
  },

  Bronze: {
    current: 'Bronze',
    next: 'Silver',
    currentMin: 100,
    nextRequired: 400,
    colorClass: 'rank-bronze',
  },

  Silver: {
    current: 'Silver',
    next: 'Gold',
    currentMin: 400,
    nextRequired: 700,
    colorClass: 'rank-silver',
  },

  Gold: {
    current: 'Gold',
    next: 'Platinum',
    currentMin: 700,
    nextRequired: 1100,
    colorClass: 'rank-gold',
  },

  Platinum: {
    current: 'Platinum',
    next: 'Diamond',
    currentMin: 1100,
    nextRequired: 1500,
    colorClass: 'rank-platinum',
  },

  Diamond: {
    current: 'Diamond',
    next: null,
    currentMin: 1500,
    nextRequired: 1500,
    colorClass: 'rank-diamond',
  },
};

/* =========================================================
   RANK HELPERS
   ========================================================= */

const getSeasonRank = (seasonPoints = 0) => {
  const points = Number(seasonPoints || 0);

  if (points >= 1500) return RANK_CONFIG.Diamond;
  if (points >= 1100) return RANK_CONFIG.Platinum;
  if (points >= 700) return RANK_CONFIG.Gold;
  if (points >= 400) return RANK_CONFIG.Silver;
  if (points >= 100) return RANK_CONFIG.Bronze;

  return RANK_CONFIG.New;
};

const getRankProgress = (seasonPoints = 0, savedRank = null) => {
  const points = Number(seasonPoints || 0);

  const rank =
    savedRank && RANK_CONFIG[savedRank]
      ? RANK_CONFIG[savedRank]
      : getSeasonRank(points);

  if (!rank.next) {
    return {
      ...rank,
      percent: 100,
      remaining: 0,
    };
  }

  const range = rank.nextRequired - rank.currentMin;
  const progress = points - rank.currentMin;

  return {
    ...rank,

    percent: Math.min(
      Math.max((progress / range) * 100, 0),
      100
    ),

    remaining: Math.max(
      rank.nextRequired - points,
      0
    ),
  };
};

/* =========================================================
   COMMUNITY DASHBOARD
   ========================================================= */

function DashboardPage() {
  const [user, setUser] = useState(() => {
    return JSON.parse(localStorage.getItem('user'));
  });

 const [leaderboard, setLeaderboard] = useState([]);
const [participations, setParticipations] = useState([]);
const [activities, setActivities] = useState([]);
const [pointTransactions, setPointTransactions] = useState([]);

const [selectedActivity, setSelectedActivity] = useState(null);
const [showActivityDetails, setShowActivityDetails] = useState(false);
const [showRegistrationModal, setShowRegistrationModal] = useState(false);
const [registeringUpcoming, setRegisteringUpcoming] = useState(false);
const [showMobileScanner, setShowMobileScanner] = useState(false);
const [scannerResult, setScannerResult] = useState(null);
const [scannerError, setScannerError] = useState('');
const [scannerProcessing, setScannerProcessing] = useState(false);

const qrScannerRef = useRef(null);
const scanLockRef = useRef(false);

const [message, setMessage] = useState('');

  const [monthlyBenefitStatus, setMonthlyBenefitStatus] =
    useState({
      can_claim: false,
      already_claimed: false,
      rank: '',
      points: 0,
      message: '',
    });


    

  /* =========================================================
     CURRENT USER RANK
     ========================================================= */

  const currentLeaderboardUser = leaderboard.find(
    (member) =>
      Number(member.user_id) === Number(user?.user_id)
  );

  const seasonPoints = Number(
    currentLeaderboardUser?.season_points || 0
  );

  const savedRank =
    monthlyBenefitStatus.rank &&
    RANK_CONFIG[monthlyBenefitStatus.rank]
      ? monthlyBenefitStatus.rank
      : getSeasonRank(seasonPoints).current;

  const rankProgress = getRankProgress(
    seasonPoints,
    savedRank
  );

  /* =========================================================
     API FUNCTIONS
     ========================================================= */

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/auth/me');

      setUser(res.data.user);

      localStorage.setItem(
        'user',
        JSON.stringify(res.data.user)
      );
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          'Failed to load user profile'
      );
    }
  };

  const fetchSeasonLeaderboard = async () => {
    try {
      const res = await api.get(
        '/reports/season-leaderboard'
      );

      setLeaderboard(res.data.leaderboard || []);
    } catch (error) {
      console.error(
        'Failed to load leaderboard:',
        error
      );
    }
  };

  const fetchMyParticipations = async () => {
  try {
    const res = await api.get('/participations/my');

    setParticipations(
      res.data?.participations || []
    );
  } catch (error) {
    console.error(
      'Failed to load participations:',
      error
    );

    setParticipations([]);
  }
};

const fetchActivities = async () => {
  try {
    const res = await api.get('/activities');

    setActivities(
      res.data?.activities ||
      res.data ||
      []
    );
  } catch (error) {
    console.error(
      'Failed to load activities:',
      error
    );

    setActivities([]);
  }
};

const fetchRecentPointsActivity = async () => {
  try {
    const res = await api.get(
      '/reports/my-points-activity'
    );

    setPointTransactions(
      res.data?.transactions || []
    );
  } catch (error) {
    console.error(
      'Failed to load recent points activity:',
      error
    );

    setPointTransactions([]);
  }
};

  const fetchMonthlyBenefitStatus = async () => {
    try {
      const res = await api.get(
        '/rewards/monthly-benefit-status'
      );

      setMonthlyBenefitStatus({
        can_claim: Boolean(res.data.can_claim),

        already_claimed: Boolean(
          res.data.already_claimed
        ),

        rank: res.data.rank || 'New',

        points: Number(
          res.data.points || 0
        ),

        message: res.data.message || '',
      });
    } catch (error) {
      console.error(
        'Failed to load monthly benefit status:',
        error
      );

      setMonthlyBenefitStatus({
        can_claim: false,
        already_claimed: false,
        rank: 'New',
        points: 0,
        message: 'Monthly benefit status unavailable',
      });
    }
  };

  /* =========================================================
     INITIAL DATA
     ========================================================= */

useEffect(() => {
  fetchCurrentUser();
  fetchSeasonLeaderboard();
  fetchMonthlyBenefitStatus();
  fetchMyParticipations();
  fetchActivities();
  fetchRecentPointsActivity();
}, []);

  /* =========================================================
     REFRESH USER DATA
     ========================================================= */

  useEffect(() => {
    const interval = setInterval(() => {
      fetchCurrentUser();
      fetchSeasonLeaderboard();
      fetchMonthlyBenefitStatus();
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCurrentUser();
        fetchSeasonLeaderboard();
        fetchMonthlyBenefitStatus();
        fetchRecentPointsActivity();
      }
    };

    const handleFocus = () => {
      fetchCurrentUser();
      fetchSeasonLeaderboard();
      fetchMonthlyBenefitStatus();
      fetchRecentPointsActivity();
    };

    window.addEventListener(
      'focus',
      handleFocus
    );

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      clearInterval(interval);

      window.removeEventListener(
        'focus',
        handleFocus
      );

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, []);

  /* =========================================================
     CLAIM MONTHLY BENEFIT
     ========================================================= */

  const handleClaimMonthlyBenefit = async () => {
    if (!monthlyBenefitStatus.can_claim) return;

    try {
      const res = await api.post(
        '/rewards/claim-monthly-benefit'
      );

      alert(
        res.data.message ||
          `You claimed ${res.data.points} monthly points!`
      );

      await fetchCurrentUser();
      await fetchSeasonLeaderboard();
      await fetchMonthlyBenefitStatus();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          'Error claiming monthly benefit.'
      );

      await fetchMonthlyBenefitStatus();
    }
  };

  /* =========================================================
     TEMPORARY UI DATA
     CONNECT TO DATABASE/API LATER
     ========================================================= */
// ==========================================
// REGISTER FOR UPCOMING ACTIVITY
// ==========================================

const handleUpcomingRegistration = async () => {
  if (!selectedActivity || registeringUpcoming) return;

  const activityId = Number(
    selectedActivity.activity_id || selectedActivity.id
  );

  if (!Number.isSafeInteger(activityId) || activityId <= 0) {
    alert('Invalid activity.');
    return;
  }

  // Prevent duplicate registrations.
  if (
    selectedActivity.is_joined ||
    selectedActivity.registration_status === 'registered'
  ) {
    alert('You are already registered for this activity.');
    return;
  }

  // Only open activities can accept registrations.
  if (
    String(selectedActivity.status || '').toLowerCase() !== 'open'
  ) {
    alert('This activity is not open for registration.');
    return;
  }

  // Check available slots.
  const capacity =
    selectedActivity.capacity == null ||
    selectedActivity.capacity === ''
      ? null
      : Number(selectedActivity.capacity);

  if (
    capacity !== null &&
    Number.isFinite(capacity) &&
    Number(selectedActivity.joined_count || 0) >= capacity
  ) {
    alert('This activity is already full.');
    return;
  }

  // The backend also enforces citizen verification.
  const confirmed = window.confirm(
    `Register for "${selectedActivity.title}"?`
  );

  if (!confirmed) return;

  setRegisteringUpcoming(true);

  try {
    await api.post(`/activities/${activityId}/join`);

    // Refresh registration and participation information.
    await Promise.all([
      fetchActivities(),
      fetchMyParticipations()
    ]);

    setSelectedActivity((previous) =>
      previous
        ? {
            ...previous,
            is_joined: true,
            registration_status: 'registered'
          }
        : previous
    );

    // Close details and display successful registration.
    setShowActivityDetails(false);
    setShowRegistrationModal(true);

  } catch (error) {
    if (error.response?.status === 409) {
      await fetchActivities();

      setShowActivityDetails(false);

      alert('You are already registered for this activity.');
      return;
    }

    alert(
      error.response?.data?.message ||
      'Unable to register for this activity.'
    );

  } finally {
    setRegisteringUpcoming(false);
  }
};
const activitiesJoined = participations.length;

const approvedActivities = participations.filter((item) => {
  const status =
    item.participation_status ||
    item.status ||
    '';

  return String(status).toLowerCase() === 'approved';
}).length;

  const upcomingActivities = activities
  .filter((activity) => {
    if (!activity.date_start) return false;

    const startDate = new Date(activity.date_start);
    const now = new Date();

    const status = String(
      activity.status || ''
    ).toLowerCase();

    // Exclude invalid dates.
    if (Number.isNaN(startDate.getTime())) {
      return false;
    }

    // Exclude cancelled, closed, and completed activities.
    if (
      ['cancelled', 'completed', 'closed'].includes(status)
    ) {
      return false;
    }

    // Only activities that have not started yet.
    return startDate.getTime() > now.getTime();
  })



  .sort(
    (a, b) =>
      new Date(a.date_start) -
      new Date(b.date_start)
  )
  .slice(0, 3)
  .map((activity) => {
    const startDate = new Date(activity.date_start);

    const endDate = activity.date_end
      ? new Date(activity.date_end)
      : null;

    const formatTime = (date) =>
      date.toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

  let image = activity.image_url || '';

if (
  image &&
  !image.startsWith('http://') &&
  !image.startsWith('https://')
) {
  const backendURL = api.defaults.baseURL.replace(/\/api\/?$/, '');

  image = `${backendURL}${
    image.startsWith('/') ? '' : '/'
  }${image}`;
}
    return {
      id: activity.activity_id,

      month: startDate
        .toLocaleString('en-US', {
          month: 'short',
        })
        .toUpperCase(),

      day: startDate
        .getDate()
        .toString()
        .padStart(2, '0'),

      title: activity.title,

      location:
        activity.location ||
        'Location not specified',

      time: endDate
        ? `${formatTime(startDate)} - ${formatTime(endDate)}`
        : formatTime(startDate),

      points: Number(
        activity.points_value || 0
      ),

      image,
    };
  });

 const recentPoints = pointTransactions
  .slice(0, 5)
  .map((transaction) => {
    const points = Number(
      transaction.points_delta || 0
    );

    return {
      id: transaction.transaction_id,

      value:
        points > 0
          ? `+${points}`
          : points.toString(),

      text:
        transaction.source_name ||
        transaction.notes ||
        'Smart Points Transaction',

      date: transaction.created_at
        ? new Date(
            transaction.created_at
          ).toLocaleDateString('en-PH', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })
        : '',

      type:
        points >= 0
          ? 'positive'
          : 'negative',
    };
  });

  const topThree = leaderboard.slice(0, 3);

  const closeMobileScanner = () => {
  setShowMobileScanner(false);
  setScannerResult(null);
  setScannerError('');
  scanLockRef.current = false;
};

useEffect(() => {
  if (!showMobileScanner || scannerResult) return;

  let disposed = false;
  const scanner = new Html5Qrcode('citipoints-dashboard-qr-reader');
  qrScannerRef.current = scanner;

  const handleScan = async (decodedText) => {
    if (scanLockRef.current || disposed) return;

    scanLockRef.current = true;
    setScannerProcessing(true);
    setScannerError('');

    try {
      const payload = JSON.parse(decodedText);

      const activityId = Number(payload.activity_id);
      const type = payload.type;

      if (
        !Number.isSafeInteger(activityId) ||
        activityId <= 0 ||
        !['check_in', 'check_out'].includes(type) ||
        typeof payload.token !== 'string' ||
        !/^[a-fA-F0-9]{64}$/.test(payload.token)
      ) {
        throw new Error('Invalid CitiPoints activity QR code.');
      }

      const endpoint =
        type === 'check_in' ? 'check-in' : 'check-out';

      const response = await api.post(
        `/activities/${activityId}/${endpoint}`,
        { qr_data: decodedText }
      );

      if (disposed) return;

      setScannerResult({
        activityId,
        type,
        message:
          response.data?.message ||
          (type === 'check_in'
            ? 'Check-In recorded successfully!'
            : 'Check-Out recorded successfully!'),
      });

      await fetchMyParticipations();
    } catch (error) {
      if (disposed) return;

      setScannerError(
        error.response?.data?.message ||
        error.message ||
        'Unable to process QR code.'
      );

      scanLockRef.current = false;
    } finally {
      if (!disposed) setScannerProcessing(false);
    }
  };

  const startScanner = async () => {
    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height, 260);

            return {
              width: size,
              height: size,
            };
          },
        },
        handleScan,
        () => {}
      );
    } catch (error) {
      if (!disposed) {
        setScannerError(
          'Unable to open camera. Allow camera permission and use HTTPS.'
        );
      }
    }
  };

  startScanner();

  return () => {
    disposed = true;

    const cleanup = async () => {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }

        await scanner.clear();
      } catch (error) {
        console.warn('Scanner cleanup:', error);
      }
    };

    cleanup();

    if (qrScannerRef.current === scanner) {
      qrScannerRef.current = null;
    }
  };
}, [showMobileScanner, scannerResult]);

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <main className="dashboard-page">

      {message && (
        <div className="dashboard-global-message">
          {message}
        </div>
      )}

      <div className="compact-member-dashboard">

        {/* ===================================================
            WELCOME
            =================================================== */}

        <section className="compact-welcome">

          <div>
            <p>Welcome back,</p>

            <h1>
              {user?.full_name || 'Citizen'}!
            </h1>

            <span>
              Make your participation count. Together for a
              Better Mandaue.
            </span>
          </div>

          <div className="compact-welcome-quote">
            “Small actions create a bigger,
            <br />
            brighter Mandaue.”
          </div>

        </section>

        {/* ===================================================
            STATS
            =================================================== */}

        <section className="compact-stats">

          {/* SMART POINTS */}

          <button
            type="button"
            className="compact-stat-card points-card"
            onClick={() =>
              (window.location.href = '/rewards')
            }
          >
            <div className="compact-stat-icon">
              ◎
            </div>

            <div>
              <strong>
                {Number(
                  user?.points_balance || 0
                ).toLocaleString()}
              </strong>

              <span>Smart Points</span>

              <small>
                Keep participating!
              </small>
            </div>
          </button>

          {/* RANK */}

          <div className="compact-stat-card">

            <div className="compact-stat-icon rank-icon">
              ★
            </div>

            <div>
              <strong>
                {rankProgress.current}
              </strong>

              <span>Your Rank</span>
            </div>

          </div>

          {/* ACTIVITIES */}

          <button
            type="button"
            className="compact-stat-card"
            onClick={() =>
              (window.location.href = '/activities')
            }
          >
            <div className="compact-stat-icon">
              ▣
            </div>

            <div>
              <strong>
                {activitiesJoined}
              </strong>

              <span>
                Activities Joined
              </span>
            </div>

            <b>›</b>
          </button>

          {/* APPROVED ACTIVITIES */}

<div className="compact-stat-card">

  <div className="compact-stat-icon">
    ✓
  </div>

  <div>
    <strong>
      {approvedActivities}
    </strong>

    <span>
      Approved Activities
    </span>
  </div>

  <b>›</b>

</div>

        </section>
{/* ===================================================
    RANK PROGRESS
    =================================================== */}

<section className="compact-rank-bar">

  <div className="compact-rank-name">
    <span>★</span>

    <strong>
      {rankProgress.current}
    </strong>
  </div>

  <div className="compact-rank-progress">
    <div
      className="compact-rank-fill"
      style={{
        width: `${rankProgress.percent}%`,
      }}
    />
  </div>

  <div className="compact-rank-next">

    {rankProgress.next ? (
      <>
        <span>
          {rankProgress.remaining.toLocaleString()}{' '}
          more points to reach
        </span>

        <strong>
          {rankProgress.next}
        </strong>
      </>
    ) : (
      <span>
        Highest seasonal rank reached
      </span>
    )}

  </div>

</section>
      
        {/* ===================================================
            MONTHLY RANK BENEFIT
            =================================================== */}

        <section className="compact-benefit-strip">

          <div className="compact-benefit-info">

            <strong>
              Monthly Rank Benefit
            </strong>

            <span>
              {monthlyBenefitStatus.already_claimed
                ? `Your ${rankProgress.current} monthly benefit has already been claimed.`
                : monthlyBenefitStatus.can_claim
                ? `Your ${rankProgress.current} rank benefit is ready to claim.`
                : monthlyBenefitStatus.message ||
                  'Complete an approved activity this month to unlock your monthly benefit.'}
            </span>

          </div>

          <div className="compact-benefit-rank">
            {rankProgress.current}
          </div>

          <button
            type="button"
            className="compact-benefit-button"
            disabled={!monthlyBenefitStatus.can_claim}
            onClick={handleClaimMonthlyBenefit}
          >
            {monthlyBenefitStatus.can_claim
              ? `Claim +${monthlyBenefitStatus.points} pts`
              : monthlyBenefitStatus.already_claimed
              ? 'Claimed'
              : 'Unavailable'}
          </button>

          {/* MONTHLY BENEFIT BREAKDOWN */}
         <div className="monthly-benefit-info">
  <button
    type="button"
    className="monthly-benefit-info-icon"
    aria-label="View monthly benefit points"
  >
    i
  </button>

  <div className="monthly-benefit-tooltip">
    <strong>Monthly Benefits</strong>

    <div>
      <span>New</span>
      <b>+0 pts</b>
    </div>

    <div>
      <span>Bronze</span>
      <b>+25 pts</b>
    </div>

    <div>
      <span>Silver</span>
      <b>+50 pts</b>
    </div>

    <div>
      <span>Gold</span>
      <b>+75 pts</b>
    </div>

    <div>
      <span>Platinum</span>
      <b>+100 pts</b>
    </div>

    <div>
      <span>Diamond</span>
      <b>+150 pts</b>
    </div>
  </div>
</div>

        </section>

        {/* ===================================================
            MAIN CONTENT
            =================================================== */}

        <section className="compact-dashboard-grid">

          {/* LEFT SIDE */}

          <div className="compact-dashboard-left">

            <div className="compact-section-header">

              <h2>
                Upcoming Activities
              </h2>

              <button
                type="button"
                onClick={() =>
                  (window.location.href =
                    '/activities')
                }
              >
                View All →
              </button>

            </div>

            <div className="compact-activity-grid">

              {upcomingActivities.map(
                (activity) => (
                  <article
                    className="compact-activity-card"
                    key={activity.id}
                  >

                    <div className="compact-activity-image">

                     {activity.image ? (
  <img
    src={activity.image}
    alt={activity.title}
  />
) : (
  <div
    style={{
      width: '100%',
      height: '100%',
      minHeight: '150px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#eef4ff',
      fontSize: '32px',
    }}
  >
    📅
  </div>
)}

                      <div className="compact-date-badge">
                        <span>
                          {activity.month}
                        </span>

                        <strong>
                          {activity.day}
                        </strong>
                      </div>

                     <span className="compact-open-badge compact-upcoming-badge">
  Upcoming
</span>

                    </div>

                    <div className="compact-activity-body">

                      <h3>
                        {activity.title}
                      </h3>

                      <p>
                        ● {activity.location}
                      </p>

                      <p>
                        ◷ {activity.time}
                      </p>

                      <span className="compact-points-pill">
                        +{activity.points} pts
                      </span>

                      <button
                         type="button"
                           onClick={() => {
                            const fullActivity = activities.find(
                              (item) =>
                              Number(item.activity_id) ===
                           Number(activity.id)
                       );

                         setSelectedActivity(
                  fullActivity || activity
                   );

                  setShowActivityDetails(true);
                     }}
>
                           View Details →
                    </button>

                    </div>

                  </article>
                )
              )}

            </div>

          </div>

          {/* RIGHT SIDE */}

          <aside className="compact-dashboard-right">

            {/* RECENT POINTS */}

            <div className="compact-side-panel">

             <div className="compact-section-header">

  <h2>
    Recent Points Activity
  </h2>

 <button
  type="button"
  onClick={() => {
    window.location.href = '/points-history';
  }}
>
  View All →
</button>

</div>

              <div className="compact-points-list">

                {recentPoints.map((item) => (
                  <div
                    className="compact-point-row"
                    key={item.id}
                  >

                    <span
                      className={`compact-point-value ${item.type}`}
                    >
                      {item.value}
                    </span>

                    <span className="compact-point-text">
                      {item.text}
                    </span>

                    <small>
                      {item.date}
                    </small>

                  </div>
                ))}

              </div>

            </div>

            {/* LEADERBOARD */}

            <div className="compact-side-panel leaderboard-panel">

              <div className="compact-section-header">

                <h2>
                  Season Leaderboard
                </h2>

                <button
  type="button"
  onClick={() => {
    window.location.href = '/leaderboard';
  }}
>
  View Full Leaderboard →
</button>

              </div>

              <div className="compact-leaderboard-list">

                {topThree.length === 0 ? (
                  <p className="compact-empty">
                    No leaderboard data yet.
                  </p>
                ) : (
                  topThree.map((member) => {
                    const isCurrentUser =
                      Number(member.user_id) ===
                      Number(user?.user_id);

                    return (
                      <div
                        className={`compact-leader-row ${
                          isCurrentUser
                            ? 'current-user'
                            : ''
                        }`}
                        key={member.user_id}
                      >

                        <span className="compact-place">
                          {member.rank}
                        </span>

                        <span className="compact-user-circle">
                          {member.full_name
                            ?.charAt(0)
                            .toUpperCase() || 'U'}
                        </span>

                        <span className="compact-leader-name">

                          {member.full_name}

                          {isCurrentUser && (
                            <small>
                              {' '}
                              (You)
                            </small>
                          )}

                        </span>

                        <strong>
                          {Number(
                            member.season_points || 0
                          ).toLocaleString()}{' '}
                          pts
                        </strong>

                      </div>
                    );
                  })
                )}

              </div>

            </div>

          </aside>

        </section>
                  {/* ===================================================
    ACTIVITY DETAILS MODAL
    =================================================== */}

{showActivityDetails && selectedActivity && (
  <div
    className="cp-modal-backdrop"
    onClick={() => setShowActivityDetails(false)}
  >
    <div
      className="cp-modal cp-registration-modal"
      onClick={(e) => e.stopPropagation()}
    >

      {/* HEADER */}
      <div className="cp-modal-header">
        <h2>Activity Details</h2>

        <button
          type="button"
          className="cp-modal-close"
          onClick={() => setShowActivityDetails(false)}
        >
          ×
        </button>
      </div>

      <div className="cp-modal-content">

        {/* IMAGE AND DESCRIPTION */}
        <div className="cp-modal-activity">

          <img
            src={
              selectedActivity.image_url ||
              'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=900&q=80'
            }
            alt={selectedActivity.title}
          />

          <div>
            <h3>{selectedActivity.title}</h3>

            <span className="cp-modal-category">
              {selectedActivity.category || 'Community'}
            </span>

            <p>
              {selectedActivity.description ||
                'Join this community activity and earn Smart Points.'}
            </p>
          </div>

        </div>

        {/* ACTIVITY INFORMATION */}
        <div className="cp-activity-details">

          <h4>Activity Information</h4>

          <div className="cp-details-grid">

            <div className="cp-detail-item">
              <span className="cp-detail-icon">▣</span>

              <div>
                <small>Date</small>

                <strong>
                  {selectedActivity.date_start
                    ? new Date(
                        selectedActivity.date_start
                      ).toLocaleDateString('en-PH', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Not specified'}
                </strong>

                <span>
                  {selectedActivity.date_start
                    ? new Date(
                        selectedActivity.date_start
                      ).toLocaleTimeString('en-PH', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : ''}

                  {selectedActivity.date_end
                    ? ` – ${new Date(
                        selectedActivity.date_end
                      ).toLocaleTimeString('en-PH', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`
                    : ''}
                </span>
              </div>
            </div>

            <div className="cp-detail-item">
              <span className="cp-detail-icon">⌖</span>

              <div>
                <small>Location</small>

                <strong>
                  {selectedActivity.location ||
                    'Not specified'}
                </strong>
              </div>
            </div>

            <div className="cp-detail-item">
              <span className="cp-detail-icon points">★</span>

              <div>
                <small>Smart Points</small>

                <strong>
                  {Number(
                    selectedActivity.points_value || 0
                  ).toLocaleString()}{' '}
                  pts
                </strong>
              </div>
            </div>

            <div className="cp-detail-item">
              <span className="cp-detail-icon">♟</span>

              <div>
                <small>Participants</small>

                <strong>
                  {Number(
                    selectedActivity.joined_count || 0
                  )}

                  {selectedActivity.capacity
                    ? ` / ${selectedActivity.capacity}`
                    : ' / ∞'}
                </strong>
              </div>
            </div>

          </div>
        </div>

        {/* BUTTONS */}
        <div className="cp-modal-actions">

          <button
            type="button"
            className="cp-cancel-btn"
            onClick={() => setShowActivityDetails(false)}
          >
            Close
          </button>

         <button
  type="button"
  className="cp-primary-btn"
  disabled={
    registeringUpcoming ||
    Boolean(selectedActivity.is_joined) ||
    selectedActivity.registration_status === 'registered'
  }
  onClick={handleUpcomingRegistration}
>
  {registeringUpcoming
    ? 'Registering...'
    : selectedActivity.is_joined ||
      selectedActivity.registration_status === 'registered'
    ? '✓ Registered'
    : 'Register Now'}
</button>

        </div>

      </div>
    </div>
  </div>
)}

{/* ===================================================
    ACTIVITY REGISTRATION MODAL
    =================================================== */}

{showRegistrationModal && selectedActivity && (
  <div
    className="cp-modal-backdrop"
    onClick={() => setShowRegistrationModal(false)}
  >
    <div
      className="cp-modal cp-registration-modal"
      onClick={(e) => e.stopPropagation()}
    >

      <div className="cp-modal-header">
        <h2>Activity Registration</h2>

        <button
          type="button"
          className="cp-modal-close"
          onClick={() => setShowRegistrationModal(false)}
        >
          ×
        </button>
      </div>

      <div className="cp-modal-content">

        <div className="cp-modal-activity">
          <img
            src={
              selectedActivity.image_url ||
              'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=900&q=80'
            }
            alt={selectedActivity.title}
          />

          <div>
            <h3>{selectedActivity.title}</h3>

            <span className="cp-modal-category">
              {selectedActivity.category || 'Community'}
            </span>

            <p>
              {selectedActivity.description ||
                'Participate in this community activity.'}
            </p>
          </div>
        </div>

        <div className="cp-status-box registered">
          <div className="cp-status-icon">✓</div>

          <div>
            <small>Registration Status</small>
            <h3>Registered</h3>
            <p>You are registered for this activity.</p>
          </div>
        </div>

        <div className="cp-status-box proof">
          <div className="cp-status-icon">◷</div>

          <div>
            <small>Participation Proof</small>
            <h3>Awaiting Proof</h3>

            <p>
              After participating in the activity,
              submit your proof for verification.
            </p>
          </div>
        </div>

        <div className="cp-modal-actions">

          <button
  type="button"
  className="cp-cancel-btn"
  onClick={() =>
    setShowRegistrationModal(false)
  }
>
  Close
</button>

          <button
            type="button"
            className="cp-primary-btn"
            onClick={() => {
              setShowRegistrationModal(false);
              window.location.href = '/activities';
            }}
          >
            Submit Proof
          </button>

        </div>

      </div>
    </div>
  </div>
)}
        {/* ===================================================
            DISCOVER REWARDS
            =================================================== */}

        <section className="member-rewards-banner compact-rewards-banner">

          <div>

            <p>
              USE YOUR SMART POINTS
            </p>

            <h2>
              Discover rewards made for you
            </h2>

            <span>
              Browse available rewards and use your
              accumulated Smart Points.
            </span>

          </div>

          <button
            type="button"
            onClick={() =>
              (window.location.href = '/rewards')
            }
          >
            Explore Rewards
          </button>

        </section>

          </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav
        className="cp-mobile-bottom-nav"
        aria-label="Citizen mobile navigation"
      >
        <a href="/dashboard" className="cp-mobile-nav-item active">
          <span className="cp-mobile-nav-icon">⌂</span>
          <span>Home</span>
        </a>

        <a href="/activities" className="cp-mobile-nav-item">
          <span className="cp-mobile-nav-icon">▦</span>
          <span>Activities</span>
        </a>

        <button
          type="button"
          className="cp-mobile-qr-button"
          aria-label="Scan activity QR code"
          onClick={() => {
            setScannerResult(null);
            setScannerError('');
            scanLockRef.current = false;
            setShowMobileScanner(true);
          }}
        >
          <svg
            viewBox="0 0 48 48"
            width="36"
            height="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          >
            <path d="M5 18V10a5 5 0 0 1 5-5h8" />
            <path d="M30 5h8a5 5 0 0 1 5 5v8" />
            <path d="M43 30v8a5 5 0 0 1-5 5h-8" />
            <path d="M18 43h-8a5 5 0 0 1-5-5v-8" />
            <path d="M13 24h22" />
          </svg>
        </button>

        <a href="/rewards" className="cp-mobile-nav-item">
          <span className="cp-mobile-nav-icon">♧</span>
          <span>Rewards</span>
        </a>

        <a href="/profile" className="cp-mobile-nav-item">
          <span className="cp-mobile-nav-icon">♙</span>
          <span>Profile</span>
        </a>
      </nav>

      {/* MOBILE QR SCANNER */}
      {showMobileScanner && (
        <div className="cp-mobile-scanner-overlay">
          <div className="cp-mobile-scanner-header">
            <button
              type="button"
              onClick={closeMobileScanner}
              aria-label="Close scanner"
            >
              ←
            </button>

            <strong>Scan QR Code</strong>

            <span>ⓘ</span>
          </div>

          <div className="cp-mobile-scanner-content">
            {!scannerResult && (
              <>
                <div className="cp-mobile-scanner-frame">
                  <div
                    id="citipoints-dashboard-qr-reader"
                    className="cp-mobile-scanner-reader"
                  />

                  <div className="cp-mobile-scanner-corners" />
                </div>

                <p>
                  Align the activity QR code within the frame
                  to check in or check out.
                </p>

                {scannerProcessing && (
                  <p>Verifying attendance...</p>
                )}

                {scannerError && (
                  <div className="cp-mobile-scanner-error">
                    {scannerError}
                  </div>
                )}
              </>
            )}

            {scannerResult && (
              <div className="cp-mobile-scanner-success">
                <div className="cp-mobile-success-icon">✓</div>

                <h2>
                  {scannerResult.type === 'check_in'
                    ? 'Check-In Successful!'
                    : 'Check-Out Successful!'}
                </h2>

                <p>{scannerResult.message}</p>

                <p>
                  Activity ID: {scannerResult.activityId}
                </p>

                <button
                  type="button"
                  onClick={closeMobileScanner}
                >
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}

export default DashboardPage;