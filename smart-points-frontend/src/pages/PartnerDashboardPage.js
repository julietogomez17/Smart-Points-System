import React, { useEffect, useState } from 'react';
import api from '../services/api';

function PartnerDashboardPage() {
const [user, setUser] = useState(null);
const [dashboard, setDashboard] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

const [rewardPeriod, setRewardPeriod] =
  useState('this_month');

const [activityPeriod, setActivityPeriod] =
  useState('this_year');

useEffect(() => {
  fetchDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [rewardPeriod, activityPeriod]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError('');

      const [userRes, dashboardRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/rewards/partner/dashboard', {
  params: {
    reward_period: rewardPeriod,
    activity_period: activityPeriod
  }
})
      ]);

      setUser(userRes.data.user);
      setDashboard(dashboardRes.data);
    } catch (err) {
      console.error('PARTNER DASHBOARD ERROR:', err);

      setError(
        err.response?.data?.message ||
          'Failed to load partner dashboard'
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="partner-dashboard-page">
        <div className="partner-dashboard-loading">
          Loading dashboard...
        </div>
      </main>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <main className="partner-dashboard-page">
        <div className="partner-dashboard-loading">
          <p>{error}</p>

          <button
            type="button"
            onClick={fetchDashboard}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!dashboard) {
    return null;
  }

  // =====================================================
  // DASHBOARD DATA
  // =====================================================

  const stats = dashboard.stats || {};
  const activitySummary =
  dashboard.activity_summary || {};

  const rewards = dashboard.rewards || [];

  const activeRewards = rewards.filter(
    (reward) =>
      reward.availability_status === 'available'
  );

  const recentRedemptions =
    dashboard.recent_redemptions || [];

  const rewardPerformance =
    dashboard.reward_performance || [];

  // Highest redemption count is used to calculate
  // the visual height of each chart bar.
  const highestPerformance = Math.max(
    ...rewardPerformance.map((item) =>
      Number(item.redemption_count || 0)
    ),
    1
  );

  // =====================================================
  // ORGANIZATION NAME
  // =====================================================

  const getOrganizationName = () => {
    return (
      dashboard.partner?.organization_name ||
      user?.organization_name ||
      user?.partner_name ||
      user?.full_name ||
      'Partner'
    );
  };

  // =====================================================
  // REWARD IMAGE
  // =====================================================

  const getRewardImage = (reward) => {
    return (
      reward.image_url ||
      reward.image ||
      '/citipoints-logo.png'
    );
  };

  // =====================================================
  // REDEMPTION STATUS
  // =====================================================

  const getStatusLabel = (status) => {
    if (status === 'pending') {
      return 'Pending';
    }

    if (status === 'approved') {
      return 'Ready to Claim';
    }

    if (status === 'confirmed') {
      return 'Completed';
    }

    if (status === 'rejected') {
      return 'Rejected';
    }

    if (status === 'cancelled') {
      return 'Cancelled';
    }

    return status || 'Unknown';
  };

  // =====================================================
  // DATE FORMAT
  // =====================================================

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return '—';
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // =====================================================
  // GROWTH DISPLAY
  // =====================================================

  const growth = Number(
    stats.participation_growth || 0
  );

  const growthDisplay =
    growth > 0
      ? `+${growth}%`
      : `${growth}%`;

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="partner-dashboard-page">

      {/* =================================================
          WELCOME
          ================================================= */}

      <section className="partner-welcome-banner">

        <div className="partner-welcome-content">

          <span>Welcome back,</span>

          <h1>
            {getOrganizationName()}!
          </h1>

          <p>
            Thank you for being a partner building a more
            engaged Mandaue.
          </p>

        </div>

        <div className="partner-welcome-message">

          <span>LOCAL PARTNERS</span>

          <strong>
            Stronger Communities.
          </strong>

        </div>

      </section>

      {/* =================================================
          SUMMARY CARDS
          ================================================= */}

      <section className="partner-summary-grid">

        {/* ACTIVE REWARDS */}

        <div className="partner-summary-card">

          <div className="partner-summary-icon">
            🎁
          </div>

          <div>

            <strong>
              {Number(
                stats.active_rewards || 0
              ).toLocaleString()}
            </strong>

            <span>
              Active Rewards
            </span>

          </div>

        </div>

        {/* REDEMPTIONS */}

        <div className="partner-summary-card">

          <div className="partner-summary-icon">
            ◇
          </div>

          <div>

            <strong>
              {Number(
                stats.total_redemptions || 0
              ).toLocaleString()}
            </strong>

            <span>
              Redemptions
            </span>

          </div>

        </div>

        {/* PARTNER ACTIVITIES */}

        <div className="partner-summary-card">

          <div className="partner-summary-icon">
            ▣
          </div>

          <div>

            <strong>
             {Number(
  activitySummary.total_activities || 0
).toLocaleString()}
            </strong>

            <span>
              Partner Activities
            </span>

          </div>

        </div>

        {/* ENGAGED CITIZENS */}

        <div className="partner-summary-card">

          <div className="partner-summary-icon">
            ●
          </div>

          <div>

            <strong>
              {Number(
                stats.engaged_citizens || 0
              ).toLocaleString()}
            </strong>

            <span>
              Engaged Citizens
            </span>

          </div>

        </div>

      </section>

      {/* =================================================
          PERFORMANCE + RECENT REDEMPTIONS
          ================================================= */}

      <section className="partner-dashboard-main-grid">

        {/* =================================================
            REWARD PERFORMANCE
            ================================================= */}

        <div className="partner-dashboard-panel">

          <div className="partner-panel-header">

            <h2>
              Reward Performance
            </h2>

           <select
  className="partner-year-label"
  value={rewardPeriod}
  onChange={(e) => setRewardPeriod(e.target.value)}
>
  <option value="this_month">This Month</option>
  <option value="this_year">This Year</option>
  <option value="all">All Time</option>
</select>

          </div>

          {rewardPerformance.length === 0 ? (

            <div className="partner-table-empty">
              No reward performance data yet.
            </div>

          ) : (

            <>
              <div className="partner-performance-chart">

                {rewardPerformance.map((item) => {

                  const count = Number(
                    item.redemption_count || 0
                  );

                  const percentage =
                    count === 0
                      ? 3
                      : Math.max(
                          (count / highestPerformance) * 100,
                          8
                        );

                  return (
                    <div
                      className="partner-chart-column"
                      key={item.reward_id}
                    >

                      <div className="partner-chart-track">

                        <div
                          className="partner-chart-bar"
                          style={{
                            height: `${Math.min(
                              percentage,
                              100
                            )}%`
                          }}
                          title={`${count} redemption${
                            count === 1 ? '' : 's'
                          }`}
                        />

                      </div>

                      <strong
                        style={{
                          fontSize: '11px',
                          marginTop: '5px'
                        }}
                      >
                        {count}
                      </strong>

                      <span title={item.reward_name}>
                        {item.reward_name}
                      </span>

                    </div>
                  );
                })}

              </div>

              <p className="partner-empty-note">
                Number of redemption requests received
                for each reward.
              </p>
            </>

          )}

        </div>

        {/* =================================================
            RECENT REDEMPTIONS
            ================================================= */}

        <div className="partner-dashboard-panel">

          <div className="partner-panel-header">

            <h2>
              Recent Redemption Requests
            </h2>

            <button
              type="button"
              onClick={() =>
                (window.location.href =
                  '/partner/redemptions')
              }
            >
              View All →
            </button>

          </div>

          <div className="partner-redemption-table-wrap">

            <table className="partner-redemption-table">

              <thead>

                <tr>
                  <th>Citizen</th>
                  <th>Reward</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>

              </thead>

              <tbody>

                {recentRedemptions.length === 0 ? (

                  <tr>

                    <td
                      colSpan="4"
                      className="partner-table-empty"
                    >
                      No redemption requests yet.
                    </td>

                  </tr>

                ) : (

                  recentRedemptions.map(
                    (redemption) => (

                      <tr
                        key={
                          redemption.redemption_id
                        }
                      >

                        <td>
                          {redemption.full_name ||
                            'Citizen'}
                        </td>

                        <td>
                          {redemption.reward_name ||
                            'Reward'}
                        </td>

                        <td>
                          {formatDate(
                            redemption.redeemed_at
                          )}
                        </td>

                        <td>

                          <span
                            className={`partner-status ${
                              redemption.status || ''
                            }`}
                          >
                            {getStatusLabel(
                              redemption.status
                            )}
                          </span>

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        </div>

      </section>

      {/* =================================================
          YOUR REWARDS
          ================================================= */}

      <section
        className="
          partner-dashboard-panel
          partner-rewards-section
        "
      >

        <div className="partner-panel-header">

          <h2>
            Your Rewards
          </h2>

          <button
            type="button"
            onClick={() =>
              (window.location.href = '/rewards')
            }
          >
            Manage Rewards →
          </button>

        </div>

        {activeRewards.length === 0 ? (

          <div className="partner-empty-rewards">

            <div>
              🎁
            </div>

            <strong>
              No active rewards yet
            </strong>

            <span>
              Your approved active rewards will appear
              here.
            </span>

          </div>

        ) : (

          <div className="partner-reward-grid">

            {activeRewards
              .slice(0, 4)
              .map((reward) => (

                <article
                  className="partner-reward-card"
                  key={reward.reward_id}
                >

                  <div className="partner-reward-image">

                    <img
                      src={getRewardImage(reward)}
                      alt={
                        reward.reward_name ||
                        'Reward'
                      }
                      onError={(e) => {
                        e.currentTarget.src =
                          '/citipoints-logo.png';
                      }}
                    />

                  </div>

                  <div className="partner-reward-body">

                    <h3>
                      {reward.reward_name ||
                        'Reward'}
                    </h3>

                    <strong>
                      {Number(
                        reward.points_cost || 0
                      ).toLocaleString()}{' '}
                      pts
                    </strong>

                    <span className="partner-active-pill">
                      Active
                    </span>

                  </div>

                </article>

              ))}

          </div>

        )}

      </section>

      {/* =================================================
          PARTNER ACTIVITY SUMMARY
          ================================================= */}

      <section
        className="
          partner-dashboard-panel
          partner-activity-section
        "
      >

        <div className="partner-panel-header">

          <h2>
            Partner Activity Summary
          </h2>

          <select
  className="partner-year-label"
  value={activityPeriod}
  onChange={(e) => setActivityPeriod(e.target.value)}
>
  <option value="this_year">This Year</option>
  <option value="last_year">Last Year</option>
  <option value="all">All Time</option>
</select>

        </div>

        <div className="partner-activity-summary-grid">

          {/* TOTAL ACTIVITIES */}

          <div className="partner-activity-summary-card">

            <div className="partner-activity-icon">
              ▣
            </div>

            <div>

              <strong>
                {Number(
  activitySummary.total_activities || 0
).toLocaleString()}
              </strong>

              <span>
                Total Activities
              </span>

            </div>

          </div>

          {/* TOTAL PARTICIPANTS */}

          <div className="partner-activity-summary-card">

            <div className="partner-activity-icon">
              ●
            </div>

            <div>

              <strong>
                {Number(
                 activitySummary.total_participants || 0
                ).toLocaleString()}
              </strong>

              <span>
                Total Participants
              </span>

            </div>

          </div>

          {/* PARTICIPATION GROWTH */}

          <div className="partner-activity-summary-card">

            <div className="partner-activity-icon">
              ↗
            </div>

            <div>

              <strong>
                {growthDisplay}
              </strong>

              <span>
                Participation Growth
              </span>

            </div>

          </div>

          {/* MESSAGE */}

          <div className="partner-community-message">

            <span>
              ◇
            </span>

            <p>
              Together with local partners, we make a
              greater impact.
            </p>

          </div>

        </div>

      </section>

    </main>
  );
}

export default PartnerDashboardPage;