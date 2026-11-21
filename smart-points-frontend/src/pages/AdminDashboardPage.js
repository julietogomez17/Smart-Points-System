import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

function AdminDashboardPage() {
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

  const adminName =
    storedUser?.full_name ||
    storedUser?.name ||
    'Administrator';

 
// =========================================================
// ADMIN DASHBOARD DATA
// =========================================================

const [dashboard, setDashboard] = useState({
  activeCitizens: 0,
  totalActivities: 0,
  pendingReviews: 0,
  fraudAlerts: 0,

  totalParticipations: 0,
  participatingBarangays: 0,

  highRisk: 0,
  mediumRisk: 0,
  lowRisk: 0,

  pointsAwarded: 0,
  pointsRedeemed: 0,
  netPoints: 0,
  currentCirculation: 0,
});

const [participationData, setParticipationData] = useState([]);

const [reviewQueue, setReviewQueue] = useState([]);

const [recentActivities, setRecentActivities] = useState([]);

const [topCitizens, setTopCitizens] = useState([]);

const [smartPointsPeriod, setSmartPointsPeriod] =
  useState('month');
  const [participationPeriod, setParticipationPeriod] =
  useState('month');
 
useEffect(() => {
  const fetchDashboardData = async () => {
    try {
      

  const [
  dashboardResponse,
  trendsResponse,
  fraudResponse,
  activitiesResponse,
  leaderboardResponse,
] = await Promise.all([
  api.get('/reports/dashboard'),
  api.get('/reports/participation-trends'),
  api.get('/reports/fraud'),
  api.get('/activities'),
  api.get('/reports/season-leaderboard'),
]);

const dashboardResult = dashboardResponse.data;
const trendsResult = trendsResponse.data;
const fraudResult = fraudResponse.data;
const activitiesResult = activitiesResponse.data;
const leaderboardResult = leaderboardResponse.data;

      // ==========================================
      // DASHBOARD SUMMARY
      // ==========================================

      const summary =
        dashboardResult.dashboard || {};

      // ==========================================
      // FRAUD RISK COUNTS
      // LOW < 40
      // MEDIUM 40 - 69.99
      // HIGH >= 70
      // ==========================================

      const fraudRecords =
        fraudResult.report || [];

      let highRisk = 0;
      let mediumRisk = 0;
      let lowRisk = 0;

      fraudRecords.forEach((record) => {
        let score = Number(record.ai_score || 0);

        // Support both 0-1 and 0-100 formats
        if (score > 0 && score <= 1) {
          score *= 100;
        }

        if (score >= 70) {
          highRisk++;
        } else if (score >= 40) {
          mediumRisk++;
        } else {
          lowRisk++;
        }
      });

      // ==========================================
      // SET SUMMARY VALUES
      // ==========================================

      setDashboard({
        activeCitizens:
          Number(summary.active_citizens || 0),

        totalActivities:
          Number(summary.total_activities || 0),

        pendingReviews:
          Number(summary.pending_reviews || 0),

        fraudAlerts:
          fraudRecords.length,

        totalParticipations:
          Number(summary.total_participations || 0),

        // Barangay database connection comes later
        participatingBarangays: 0,

        highRisk,
        mediumRisk,
        lowRisk,

        pointsAwarded:
          Number(summary.total_points_awarded || 0),

        pointsRedeemed:
          Number(summary.total_points_redeemed || 0),

        netPoints:
          Number(summary.net_points || 0),

        currentCirculation:
          Number(
            summary.current_point_circulation || 0
          ),
      });

      // ==========================================
      // PARTICIPATION TREND
      // ==========================================

      const trends =
        trendsResult.report || [];

      setParticipationData(
        trends.slice(-5).map((item) => ({
          label:
            item.month ||
            item.month_key ||
            'N/A',

          value:
            Number(
              item.total_participations || 0
            ),
        }))
      );

      // ==========================================
      // REVIEW QUEUE
      // ==========================================

      const queue = [];

      if (
        Number(summary.pending_reviews || 0) > 0
      ) {
        queue.push({
          id: 'pending-participation',
          title: 'Participation Reviews',
          status: 'Pending submissions',
          count: Number(
            summary.pending_reviews || 0
          ),
          type: 'pending',
          icon: '▤',
        });
      }

      if (fraudRecords.length > 0) {
        queue.push({
          id: 'fraud-alerts',
          title: 'AI Risk Alerts',
          status: 'Requires human review',
          count: fraudRecords.length,
          type: 'risk',
          icon: '!',
        });
      }

      setReviewQueue(queue);

      // ==========================================
      // RECENT ACTIVITIES
      // ==========================================

     const activities =
  activitiesResult.activities || [];

      setRecentActivities(
        activities
          .slice()
          .reverse()
          .slice(0, 4)
          .map((activity) => ({
            id: activity.activity_id,

            title:
              activity.title || 'Untitled Activity',

            // Current report endpoint does not
            // return activity date yet.
           date: activity.date_start
  ? new Date(activity.date_start).toLocaleDateString(
      'en-PH',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }
    )
  : '—',

participants:
  Number(activity.joined_count || 0),

            status:
              activity.status || 'Unknown',
          }))
      );

      // ==========================================
      // TOP CITIZENS
      // ==========================================

      const leaderboard =
        leaderboardResult.leaderboard || [];

      setTopCitizens(
        leaderboard.slice(0, 5).map((citizen) => ({
          id: citizen.user_id,

          name:
            citizen.full_name || 'Citizen',

          points:
            Number(citizen.season_points || 0),
        }))
      );
    } catch (error) {
      console.error(
        'ADMIN DASHBOARD ERROR:',
        error
      );
    } 
  };

  fetchDashboardData();
  
}, []);

useEffect(() => {
  const fetchSmartPointsOverview = async () => {
    try {
     const response = await api.get(
  '/reports/points-transactions',
  {
    params: {
      period: smartPointsPeriod,
    },
  }
);

const data = response.data;

if (!data.success) {
  throw new Error(
    data.message ||
      'Failed to fetch Smart Points overview'
  );
}

      setDashboard((previous) => ({
        ...previous,

        pointsAwarded: Number(
          data.summary?.points_awarded || 0
        ),

        pointsRedeemed: Number(
          data.summary?.points_redeemed || 0
        ),

        netPoints: Number(
          data.summary?.net_points || 0
        ),

        currentCirculation: Number(
          data.summary?.current_circulation || 0
        ),
      }));
    } catch (error) {
      console.error(
        'SMART POINTS OVERVIEW ERROR:',
        error
      );
    }
  };

  fetchSmartPointsOverview();
}, [smartPointsPeriod]);

useEffect(() => {
  const fetchParticipationTrend = async () => {
    try {
    const response = await api.get(
  '/reports/participation-trends',
  {
    params: {
      period: participationPeriod,
    },
  }
);

const data = response.data;

if (!data.success) {
  throw new Error(
    data.message ||
      'Failed to fetch participation trend'
  );
}

      const trends = data.report || [];

      // ==========================================
      // PARTICIPATION CHART
      // ==========================================
      setParticipationData(
        trends.map((item) => ({
          label:
            item.period_label ||
            item.period_key ||
            'N/A',

          value: Number(
            item.total_participations || 0
          ),
        }))
      );

      // ==========================================
      // SELECTED PERIOD SUMMARY
      // ==========================================

    } catch (error) {
      console.error(
        'PARTICIPATION TREND ERROR:',
        error
      );

      setParticipationData([]);
    }
  };

  fetchParticipationTrend();
}, [participationPeriod]);

  // =========================================================
  // CHART HELPERS
  // =========================================================

  const chartWidth = 500;
  const chartHeight = 150;
  const chartPaddingX = 25;
  const chartPaddingTop = 15;
  const chartPaddingBottom = 25;

  const maxParticipation = Math.max(
    ...participationData.map((item) => item.value),
    1
  );

  const chartPoints = participationData
    .map((item, index) => {
      const usableWidth = chartWidth - chartPaddingX * 2;
      const usableHeight =
        chartHeight - chartPaddingTop - chartPaddingBottom;

      const x =
        chartPaddingX +
        (index / Math.max(participationData.length - 1, 1)) *
          usableWidth;

      const y =
        chartPaddingTop +
        usableHeight -
        (item.value / maxParticipation) * usableHeight;

      return `${x},${y}`;
    })
    .join(' ');

  const totalRisk =
    dashboard.highRisk +
    dashboard.mediumRisk +
    dashboard.lowRisk;

  const highPercent =
    totalRisk > 0
      ? (dashboard.highRisk / totalRisk) * 100
      : 0;

  const mediumPercent =
    totalRisk > 0
      ? (dashboard.mediumRisk / totalRisk) * 100
      : 0;

  

  const donutBackground =
    totalRisk > 0
      ? `conic-gradient(
          #ef4444 0% ${highPercent}%,
          #f59e0b ${highPercent}% ${highPercent + mediumPercent}%,
          #3b82f6 ${highPercent + mediumPercent}% 100%
        )`
      : '#e8eef7';

  return (
    <main className="admin-ref-dashboard">

      {/* =====================================================
          WELCOME BANNER
          ===================================================== */}
      <section className="admin-ref-welcome">

        <div className="admin-ref-welcome-content">

          <span className="admin-ref-welcome-small">
            Good morning,
          </span>

          <h1>{adminName}!</h1>

          <p>
            Here&apos;s what&apos;s happening in CitiPoints today.
          </p>

        </div>

        <div className="admin-ref-welcome-message">
          <span>Transparent Governance</span>
          <strong>Active Citizens</strong>
          <span>A Stronger Mandaue.</span>
        </div>

      </section>


      {/* =====================================================
          SUMMARY CARDS
          ===================================================== */}
      <section className="admin-ref-summary-grid">

        {/* ACTIVE CITIZENS */}
        <article className="admin-ref-summary-card">

          <div className="admin-ref-summary-icon blue">
            ♟
          </div>

          <div className="admin-ref-summary-info">

            <span>Active Citizens</span>

            <strong>
              {dashboard.activeCitizens.toLocaleString()}
            </strong>

            <small className="positive">
              ↑ Active participation
            </small>

          </div>

        </article>


        {/* ACTIVITIES */}
        <article className="admin-ref-summary-card">

          <div className="admin-ref-summary-icon purple">
            ▣
          </div>

          <div className="admin-ref-summary-info">

            <span>Total Activities</span>

            <strong>
              {dashboard.totalActivities.toLocaleString()}
            </strong>

            <small className="positive">
              LGU activities
            </small>

          </div>

        </article>


        {/* PENDING */}
        <article className="admin-ref-summary-card">

          <div className="admin-ref-summary-icon orange">
            ▤
          </div>

          <div className="admin-ref-summary-info">

            <span>Pending Reviews</span>

            <strong>
              {dashboard.pendingReviews.toLocaleString()}
            </strong>

            <small className="warning">
              Requires action
            </small>

          </div>

        </article>


        {/* FRAUD */}
        <article className="admin-ref-summary-card">

          <div className="admin-ref-summary-icon red">
            !
          </div>

          <div className="admin-ref-summary-info">

            <span>Fraud Alerts</span>

            <strong>
              {dashboard.fraudAlerts.toLocaleString()}
            </strong>

            <small className="danger">
              For human review
            </small>

          </div>

        </article>

      </section>


      {/* =====================================================
          PARTICIPATION + REVIEW QUEUE
          ===================================================== */}
      <section className="admin-ref-grid admin-ref-top-grid">

        {/* PARTICIPATION */}
        <article className="admin-ref-card participation-card">

          <div className="admin-ref-card-header">

            <h2>Participation Overview</h2>

           <select
  value={participationPeriod}
  onChange={(e) =>
    setParticipationPeriod(e.target.value)
  }
>
  <option value="week">This Week</option>
  <option value="month">This Month</option>
  <option value="year">This Year</option>
  <option value="all">All Time</option>
</select>

          </div>


          {/* LINE CHART */}
          <div className="admin-ref-line-chart">

            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              aria-label="Participation overview chart"
            >

              {/* GRID LINES */}
              <line
                x1="25"
                y1="25"
                x2="475"
                y2="25"
                className="admin-chart-grid-line"
              />

              <line
                x1="25"
                y1="55"
                x2="475"
                y2="55"
                className="admin-chart-grid-line"
              />

              <line
                x1="25"
                y1="85"
                x2="475"
                y2="85"
                className="admin-chart-grid-line"
              />

              <line
                x1="25"
                y1="115"
                x2="475"
                y2="115"
                className="admin-chart-grid-line"
              />

              {/* LINE */}
              <polyline
                points={chartPoints}
                className="admin-chart-line"
              />

              {/* DOTS */}
              {participationData.map((item, index) => {
                const usableWidth =
                  chartWidth - chartPaddingX * 2;

                const usableHeight =
                  chartHeight -
                  chartPaddingTop -
                  chartPaddingBottom;

                const x =
                  chartPaddingX +
                  (index /
                    Math.max(
                      participationData.length - 1,
                      1
                    )) *
                    usableWidth;

                const y =
                  chartPaddingTop +
                  usableHeight -
                  (item.value / maxParticipation) *
                    usableHeight;

                return (
                 <circle
  key={`participation-dot-${index}`}
  cx={x}
  cy={y}
  r="4"
  className="admin-chart-dot"
/>
                );
              })}

            </svg>


            <div className="admin-ref-chart-labels">

            {participationData.map((item, index) => (
  <span key={`participation-label-${index}`}>
    {item.label}
  </span>
))}

            </div>

          </div>


          {/* PARTICIPATION NUMBERS */}
 {/* PARTICIPATION NUMBERS */}
<div className="admin-ref-participation-stats">

  <div>
    <strong>
      {dashboard.activeCitizens.toLocaleString()}
    </strong>

    <span>Active Citizens</span>
  </div>

  <div>
    <strong>
      {dashboard.totalParticipations.toLocaleString()}
    </strong>

    <span>Total Participations</span>
  </div>

  <div>
    <strong>
      {dashboard.participatingBarangays}
    </strong>

    <span>Participating Barangays</span>
  </div>

</div>

        </article>


        {/* =================================================
            REVIEW QUEUE
            ================================================= */}
        <article className="admin-ref-card">

          <div className="admin-ref-card-header">

            <h2>Review Queue</h2>

            <Link to="/admin/reports">
              View All →
            </Link>

          </div>


          <div className="admin-ref-review-list">

            {reviewQueue.length === 0 ? (

              <div className="admin-ref-empty">

                <div className="admin-ref-empty-icon">
                  ✓
                </div>

                <strong>No pending reviews</strong>

                <span>
                  New participation submissions and other
                  review items will appear here.
                </span>

              </div>

            ) : (

              reviewQueue.slice(0, 4).map((item) => (

                <Link
                  to="/admin/reports"
                  className="admin-ref-review-row"
                  key={item.id}
                >

                  <div
                    className={`admin-ref-review-icon ${
                      item.type || ''
                    }`}
                  >
                    {item.icon || '▤'}
                  </div>

                  <span className="admin-ref-review-count">
                    {item.count}
                  </span>

                  <div className="admin-ref-review-info">

                    <strong>{item.title}</strong>

                    <span>{item.status}</span>

                  </div>

                  <span className="admin-ref-arrow">
                    ›
                  </span>

                </Link>

              ))

            )}

          </div>

        </article>

      </section>


      {/* =====================================================
          FRAUD + SMART POINTS
          ===================================================== */}
      <section className="admin-ref-grid admin-ref-middle-grid">

        {/* FRAUD */}
        <article className="admin-ref-card">

          <div className="admin-ref-card-header">

            <h2>Fraud Risk Monitoring</h2>

            <Link to="/admin/fraud-report">
              View Details →
            </Link>

          </div>


          <div className="admin-ref-fraud-content">

            {/* DONUT */}
            <div className="admin-ref-donut-wrapper">

              <div
                className="admin-ref-donut"
                style={{
                  background: donutBackground,
                }}
              >

                <div className="admin-ref-donut-center">

                  <strong>
                    {totalRisk}
                  </strong>

                  <span>Flagged</span>

                </div>

              </div>

            </div>


            {/* LEGEND */}
            <div className="admin-ref-risk-legend">

              <div>

                <span className="risk-color high"></span>

                <strong>High Risk</strong>

                <b>
                  {dashboard.highRisk}
                </b>

              </div>


              <div>

                <span className="risk-color medium"></span>

                <strong>Medium Risk</strong>

                <b>
                  {dashboard.mediumRisk}
                </b>

              </div>


              <div>

                <span className="risk-color low"></span>

                <strong>Low Risk</strong>

                <b>
                  {dashboard.lowRisk}
                </b>

              </div>

            </div>

          </div>


          <div className="admin-ref-human-review">
            AI-assisted risk assessment. Final decisions
            remain with the administrator.
          </div>

        </article>


        {/* =================================================
            SMART POINTS
            ================================================= */}
        <article className="admin-ref-card">

          <div className="admin-ref-card-header">

            <h2>Smart Points Overview</h2>

           <select
  value={smartPointsPeriod}
  onChange={(e) =>
    setSmartPointsPeriod(e.target.value)
  }
>
  <option value="week">This Week</option>
  <option value="month">This Month</option>
  <option value="year">This Year</option>
  <option value="all">All Time</option>
</select>

          </div>


          <div className="admin-ref-points-grid">

            {/* AWARDED */}
            <div className="admin-ref-point-stat">

              <div className="admin-ref-point-icon green">
                ↑
              </div>

              <div>

                <strong>
                  {dashboard.pointsAwarded.toLocaleString()}
                </strong>

                <span>Points Awarded</span>

              </div>

            </div>


            {/* REDEEMED */}
            <div className="admin-ref-point-stat">

              <div className="admin-ref-point-icon red">
                ↓
              </div>

              <div>

                <strong>
                  {dashboard.pointsRedeemed.toLocaleString()}
                </strong>

                <span>Points Redeemed</span>

              </div>

            </div>


            {/* NET */}
            <div className="admin-ref-point-stat">

              <div className="admin-ref-point-icon blue">
                ◎
              </div>

              <div>

                <strong>
                  {dashboard.netPoints.toLocaleString()}
                </strong>

                <span>Net Points</span>

              </div>

            </div>


            {/* CIRCULATION */}
            <div className="admin-ref-point-stat">

              <div className="admin-ref-point-icon green">
                ↻
              </div>

              <div>

                <strong>
                  {dashboard.currentCirculation.toLocaleString()}
                </strong>

                <span>Current Circulation</span>

              </div>

            </div>

          </div>

        </article>

      </section>


      {/* =====================================================
          RECENT ACTIVITIES + TOP CITIZENS
          ===================================================== */}
      <section className="admin-ref-grid admin-ref-bottom-grid">

        {/* RECENT ACTIVITIES */}
        <article className="admin-ref-card">

          <div className="admin-ref-card-header">

            <h2>Recent Activities</h2>

            <Link to="/activities">
              View All →
            </Link>

          </div>


          <div className="admin-ref-table-wrap">

            <table className="admin-ref-table">

              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Participants</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>

                {recentActivities.length === 0 ? (

                  <tr>

                    <td
                      colSpan="4"
                      className="admin-ref-table-empty"
                    >
                      No recent activities yet.
                    </td>

                  </tr>

                ) : (

                  recentActivities
                    .slice(0, 4)
                    .map((activity) => (

                      <tr key={activity.id}>

                        <td>
                          {activity.title}
                        </td>

                        <td>
                          {activity.date}
                        </td>

                        <td>
                          {activity.participants}
                        </td>

                        <td>

                          <span
                            className={`admin-ref-status ${
                              activity.status
                                ?.toLowerCase() || ''
                            }`}
                          >
                            {activity.status}
                          </span>

                        </td>

                      </tr>

                    ))

                )}

              </tbody>

            </table>

          </div>

        </article>


        {/* =================================================
            TOP CITIZENS
            ================================================= */}
        <article className="admin-ref-card">

          <div className="admin-ref-card-header">

            <h2>Top Citizens (This Season)</h2>

            <Link to="/dashboard">
              View Full Leaderboard →
            </Link>

          </div>


          <div className="admin-ref-table-wrap">

            <table className="admin-ref-table leaderboard">

              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Points</th>
                </tr>
              </thead>

              <tbody>

                {topCitizens.length === 0 ? (

                  <tr>

                    <td
                      colSpan="3"
                      className="admin-ref-table-empty"
                    >
                      No leaderboard data yet.
                    </td>

                  </tr>

                ) : (

                  topCitizens
                    .slice(0, 5)
                    .map((citizen, index) => (

                      <tr key={citizen.id}>

                        <td>

                          <span
                            className={`admin-ref-rank rank-${
                              index + 1
                            }`}
                          >
                            {index + 1}
                          </span>

                        </td>

                        <td>

                          <div className="admin-ref-citizen">

                            <div className="admin-ref-avatar">
                              {citizen.name
                                ?.charAt(0)
                                .toUpperCase()}
                            </div>

                            <span>
                              {citizen.name}
                            </span>

                          </div>

                        </td>

                        <td className="admin-ref-points">
                          {Number(
                            citizen.points
                          ).toLocaleString()}
                        </td>

                      </tr>

                    ))

                )}

              </tbody>

            </table>

          </div>

        </article>

      </section>

    </main>
  );
}

export default AdminDashboardPage;