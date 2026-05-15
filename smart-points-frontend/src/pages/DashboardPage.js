import React, { useEffect, useState } from 'react';
import api from '../services/api';

const RANK_CONFIG = {
  New: {
    current: 'New',
    next: 'Bronze',
    currentMin: 0,
    nextRequired: 100,
    colorClass: 'rank-new'
  },
  Bronze: {
    current: 'Bronze',
    next: 'Silver',
    currentMin: 100,
    nextRequired: 400,
    colorClass: 'rank-bronze'
  },
  Silver: {
    current: 'Silver',
    next: 'Gold',
    currentMin: 400,
    nextRequired: 700,
    colorClass: 'rank-silver'
  },
  Gold: {
    current: 'Gold',
    next: 'Platinum',
    currentMin: 700,
    nextRequired: 1100,
    colorClass: 'rank-gold'
  },
  Platinum: {
    current: 'Platinum',
    next: 'Diamond',
    currentMin: 1100,
    nextRequired: 1500,
    colorClass: 'rank-platinum'
  },
  Diamond: {
    current: 'Diamond',
    next: null,
    currentMin: 1500,
    nextRequired: 1500,
    colorClass: 'rank-diamond'
  }
};

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
      progressText: `${points.toLocaleString()} pts`
    };
  }

  const tierRange = rank.nextRequired - rank.currentMin;
  const tierProgress = points - rank.currentMin;
  const percent = Math.min(Math.max((tierProgress / tierRange) * 100, 0), 100);
  const remaining = Math.max(rank.nextRequired - points, 0);

  return {
    ...rank,
    percent,
    remaining,
    progressText: `${points.toLocaleString()} / ${rank.nextRequired.toLocaleString()} pts`
  };
};

function DashboardPage() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [dashboard, setDashboard] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [message, setMessage] = useState('');

  const [monthlyBenefitStatus, setMonthlyBenefitStatus] = useState({
    can_claim: false,
    already_claimed: false,
    rank: '',
    points: 0,
    message: ''
  });

  const currentLeaderboardUser = leaderboard.find(
    (member) => Number(member.user_id) === Number(user?.user_id)
  );

  const seasonPoints = Number(currentLeaderboardUser?.season_points || 0);

  const savedRank =
    monthlyBenefitStatus.rank && RANK_CONFIG[monthlyBenefitStatus.rank]
      ? monthlyBenefitStatus.rank
      : getSeasonRank(seasonPoints).current;

  const rankProgress = getRankProgress(seasonPoints, savedRank);

  useEffect(() => {
    fetchCurrentUser();

    const interval = setInterval(() => {
      fetchCurrentUser();

      if (user?.role === 'community_member') {
        fetchSeasonLeaderboard();
        fetchMonthlyBenefitStatus();
      }
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCurrentUser();

        if (user?.role === 'community_member') {
          fetchSeasonLeaderboard();
          fetchMonthlyBenefitStatus();
        }
      }
    };

    window.addEventListener('focus', fetchCurrentUser);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchCurrentUser);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminDashboard();
    }

    if (user?.role === 'community_member') {
      fetchRecommendations();
      fetchSeasonLeaderboard();
      fetchMonthlyBenefitStatus();
    }
  }, [user?.role]);

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load user profile');
    }
  };

  const fetchAdminDashboard = async () => {
    try {
      const res = await api.get('/reports/dashboard');
      setDashboard(res.data.dashboard);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load admin dashboard');
    }
  };

  const fetchRecommendations = async () => {
    try {
      const res = await api.get('/recommendations/rewards');
      setRecommendations(res.data.recommendations || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load recommendations');
    }
  };

  const fetchSeasonLeaderboard = async () => {
    try {
      const res = await api.get('/reports/season-leaderboard');
      setLeaderboard(res.data.leaderboard || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load leaderboard');
    }
  };

  const fetchMonthlyBenefitStatus = async () => {
    try {
      const res = await api.get('/rewards/monthly-benefit-status');

      setMonthlyBenefitStatus({
        can_claim: Boolean(res.data.can_claim),
        already_claimed: Boolean(res.data.already_claimed),
        rank: res.data.rank || 'New',
        points: Number(res.data.points || 0),
        message: res.data.message || ''
      });
    } catch (error) {
      console.error('Failed to load monthly benefit status:', error);

      setMonthlyBenefitStatus({
        can_claim: false,
        already_claimed: false,
        rank: 'New',
        points: 0,
        message: 'Monthly benefit status unavailable'
      });
    }
  };

  const handleClaimMonthlyBenefit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!monthlyBenefitStatus.can_claim) return;

    try {
      const res = await api.post('/rewards/claim-monthly-benefit');

      alert(res.data.message || `You claimed ${res.data.points} monthly points!`);

      await fetchCurrentUser();
      await fetchSeasonLeaderboard();
      await fetchMonthlyBenefitStatus();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error claiming monthly benefit.');

      await fetchMonthlyBenefitStatus();
    }
  };

  const renderAdminDashboard = () => (
    <>
      <section className="summary-grid">
        <div className="summary-card card-yellow">
          <h3>Total Members</h3>
          <p>{dashboard?.total_users ?? 0}</p>
        </div>

        <div className="summary-card card-green">
          <h3>Total Activities</h3>
          <p>{dashboard?.total_activities ?? 0}</p>
        </div>

        <div className="summary-card card-blue">
          <h3>Approved</h3>
          <p>{dashboard?.approved_participations ?? 0}</p>
        </div>

        <div className="summary-card card-red">
          <h3>Rejected</h3>
          <p>{dashboard?.rejected_participations ?? 0}</p>
        </div>

        <div className="summary-card card-purple">
          <h3>Rewards Redeemed</h3>
          <p>{dashboard?.total_rewards_redeemed ?? 0}</p>
        </div>

        <div className="summary-card card-orange">
          <h3>Suspicious Cases</h3>
          <p>{dashboard?.flagged_or_suspicious ?? 0}</p>
        </div>
      </section>

      <section className="feature-section">
        <h2 className="section-title">Admin Management Tools</h2>

        <div className="feature-grid">
          <div className="feature-card">
            <h3>Review Queue</h3>
            <p>Approve or reject clean participation submissions.</p>
            <a href="/admin/reports" className="primary-btn small-btn">Open</a>
          </div>

          <div className="feature-card">
            <h3>Fraud Report</h3>
            <p>Monitor suspicious submissions and auto-rejected records.</p>
            <a href="/admin/fraud-report" className="primary-btn small-btn">Open</a>
          </div>

          <div className="feature-card">
            <h3>Pending Rewards</h3>
            <p>Review partner-submitted rewards before making them available.</p>
            <a href="/admin/pending-rewards" className="primary-btn small-btn">Open</a>
          </div>

          <div className="feature-card">
            <h3>Create Activity</h3>
            <p>Add new engagement activities for members.</p>
            <a href="/admin/create-activity" className="primary-btn small-btn">Create</a>
          </div>

          <div className="feature-card">
            <h3>Create Reward</h3>
            <p>Add admin-managed rewards to the catalog.</p>
            <a href="/admin/create-reward" className="primary-btn small-btn">Create</a>
          </div>
        </div>
      </section>
    </>
  );

  const renderMemberDashboard = () => {
    const affordableRewards = recommendations.filter((item) => item.affordable);

    return (
      <>
        <section className="feature-section">
          <h2 className="section-title">Recommended Rewards</h2>

          {affordableRewards.length === 0 ? (
            <p>No rewards available within your current points yet.</p>
          ) : (
            <div className="feature-grid">
              {affordableRewards.map((item) => (
                <div key={item.reward_id} className="feature-card">
                  <h3>{item.reward_name}</h3>
                  <p><strong>Category:</strong> {item.category}</p>
                  <p><strong>Points Cost:</strong> {item.points_cost}</p>
                  <p><strong>Stock:</strong> {item.stock}</p>
                  <p>{item.reason}</p>

                  <div className="action-row">
                    <button
                      className="primary-btn small-btn"
                      onClick={() => window.location.href = `/rewards?rewardId=${item.reward_id}`}
                    >
                      View Reward
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="feature-section season-leaderboard-preview">
          <div className="section-row">
            <div>
              <h2 className="section-title">Season Leaderboard</h2>
              <p className="section-subtitle">Top community members this season</p>
            </div>

            <button
              className="secondary-btn small-btn"
              onClick={() => window.location.href = '/leaderboard'}
            >
              View Full Leaderboard
            </button>
          </div>

          <div className="leaderboard-preview-table">
            <div className="leaderboard-preview-header">
              <span>Rank</span>
              <span>Member</span>
              <span>Tier</span>
              <span>Season Points</span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="leaderboard-preview-row">
                <span>-</span>
                <span>No leaderboard data yet</span>
                <span className="tier-badge tier-bronze">New</span>
                <strong>0</strong>
              </div>
            ) : (
              leaderboard.slice(0, 5).map((member) => {
                const isCurrentUser = Number(member.user_id) === Number(user?.user_id);
                const displayTier = isCurrentUser ? savedRank : member.tier;
                const tierClass = `tier-${String(displayTier || 'New').toLowerCase()}`;

                return (
                  <div
                    key={member.user_id}
                    className={`leaderboard-preview-row ${
                      member.rank === 1
                        ? 'top-one'
                        : member.rank === 2
                        ? 'top-two'
                        : member.rank === 3
                        ? 'top-three'
                        : ''
                    }`}
                  >
                    <span
                      className={`rank-number ${
                        member.rank === 1
                          ? 'gold-rank'
                          : member.rank === 2
                          ? 'silver-rank'
                          : member.rank === 3
                          ? 'bronze-rank'
                          : ''
                      }`}
                    >
                      {member.rank}
                    </span>

                    <span>{member.full_name}</span>

                    <span className={`tier-badge ${tierClass}`}>
                      {displayTier === 'Diamond'
                        ? '💎 Diamond'
                        : displayTier === 'Platinum'
                        ? '✦ Platinum'
                        : displayTier === 'Gold'
                        ? '⭐ Gold'
                        : displayTier === 'Silver'
                        ? '✦ Silver'
                        : displayTier === 'Bronze'
                        ? '◆ Bronze'
                        : 'New'}
                    </span>

                    <strong>
                      {Number(member.season_points || 0).toLocaleString()}
                    </strong>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </>
    );
  };

  const renderPartnerDashboard = () => (
    <>
      <section className="summary-grid member-grid">
        <div className="summary-card">
          <h3>My Organization</h3>
          <p>{user?.partner_name || 'N/A'}</p>
        </div>

        <div className="summary-card">
          <h3>My Rewards</h3>
          <p>Manage rewards you created</p>
        </div>

        <div className="summary-card">
          <h3>Redemptions</h3>
          <p>Track redeemed items</p>
        </div>
      </section>

      <section className="feature-section">
        <h2 className="section-title">Partner Tools</h2>

        <div className="feature-grid">
          <div className="feature-card">
            <h3>Create Reward</h3>
            <p>Add rewards for users to redeem</p>

            <button
              className="primary-btn small-btn"
              onClick={() => window.location.href = '/admin/create-reward'}
            >
              Create
            </button>
          </div>

          <div className="feature-card">
            <h3>My Rewards</h3>
            <p>View and manage your rewards</p>

            <button
              className="primary-btn small-btn"
              onClick={() => window.location.href = '/rewards'}
            >
              Open
            </button>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <div className="dashboard-page">
      <section className="hero-section">
        <div className="hero-overlay">
          <div className="hero-content">
            <p className="hero-subtitle">Smart Points Engine</p>

            <h1 className="hero-title">
              Empower Community Engagement Through Smart Rewards
            </h1>

            <p className="hero-text">
              Track participation, review submissions, detect suspicious activity,
              and reward meaningful community engagement.
            </p>

            <div className="hero-buttons">
              <a href="/activities" className="primary-btn">View Activities</a>
              <a href="/rewards" className="secondary-btn">Explore Rewards</a>
            </div>
          </div>
        </div>
      </section>

      <div className="dashboard-container">
        <div className="profile-hero">
          <div className="profile-left">
            <div className={`avatar-circle rank-avatar-ring ${user?.role === 'community_member' ? rankProgress.colorClass : ''}`}>
              🎖️
            </div>

            <div className="profile-info">
              <h2>{user?.full_name}</h2>

              <span className="role-badge">{user?.role}</span>

              {user?.role === 'community_member' && (
                <div className="rank-progress-wrap">
                  <div className="rank-progress-top">
                    <span className={`rank-pill ${rankProgress.colorClass}`}>
                      {rankProgress.current}
                    </span>

                    <span className="rank-progress-text">
                      {rankProgress.progressText}
                    </span>

                    {rankProgress.next && (
                      <span className="rank-next-pill">
                        {rankProgress.next}
                      </span>
                    )}
                  </div>

                  <div className="rank-progress-line">
                    <div className="rank-progress-bar">
                      <div
                        className="rank-progress-fill"
                        style={{ width: `${rankProgress.percent}%` }}
                      />
                    </div>

                    <div className="rank-benefit-info">
                      ?

                      <div className="rank-benefit-tooltip rank-benefit-tooltip-wide">
                        <strong>Benefits</strong>

                        <div className="benefit-columns">
                          <div className="benefit-column">
                            <h4>Rank Benefits</h4>
                            <p>Bronze: +50 pts</p>
                            <p>Silver: +100 pts</p>
                            <p>Gold: +200 pts</p>
                            <p>Platinum: +350 pts</p>
                            <p>Diamond: +500 pts</p>
                          </div>

                          <div className="benefit-column">
                            <h4>Monthly Benefits</h4>
                            <p>Bronze: +20 pts</p>
                            <p>Silver: +50 pts</p>
                            <p>Gold: +100 pts</p>
                            <p>Platinum: +250 pts</p>
                            <p>Diamond: +300 pts</p>
                          </div>
                        </div>

                        <div className="rank-benefit-actions benefit-actions-grid">
                          <button
                            type="button"
                            className="rank-benefit-btn disabled"
                            disabled
                          >
                            Rank Benefit Auto-Claimed
                          </button>

                          <button
                            type="button"
                            className={`rank-benefit-btn ${
                              monthlyBenefitStatus.can_claim ? 'available' : 'disabled'
                            }`}
                            disabled={!monthlyBenefitStatus.can_claim}
                            onClick={handleClaimMonthlyBenefit}
                          >
                            {monthlyBenefitStatus.can_claim
                              ? `Claim Monthly Benefit +${monthlyBenefitStatus.points}`
                              : monthlyBenefitStatus.already_claimed
                              ? 'Monthly Benefit Claimed'
                              : 'Monthly Benefit Unavailable'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="rank-progress-note">
                    {rankProgress.next
                      ? `Earn ${rankProgress.remaining.toLocaleString()} more points to reach ${rankProgress.next}`
                      : 'You reached the highest seasonal rank'}
                  </p>
                </div>
              )}

              {user?.role === 'partner' && (
                <div className="progress-bar-wrap">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(((user?.points_balance || 0) / 500) * 100, 100)}%`
                      }}
                    />
                  </div>

                  <p className="progress-text">
                    Progress • Points: <strong>{user?.points_balance ?? 0}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="profile-right">
            {user?.role === 'community_member' && (
              <div className="stat-card">
                <p>Available points</p>
                <h3>{user?.points_balance ?? 0}</h3>
              </div>
            )}

            {user?.role === 'admin' && (
              <>
                <div className="stat-card">
                  <p>Total Members</p>
                  <h3>{dashboard?.total_users ?? 0}</h3>
                </div>

                <div className="stat-card">
                  <p>Total Activities</p>
                  <h3>{dashboard?.total_activities ?? 0}</h3>
                </div>
              </>
            )}

            {user?.role === 'partner' && (
              <>
                <div className="stat-card">
                  <p>My Rewards</p>
                  <h3>—</h3>
                </div>

                <div className="stat-card">
                  <p>Redemptions</p>
                  <h3>—</h3>
                </div>
              </>
            )}
          </div>
        </div>

        {message && <p className="status-message">{message}</p>}

        {user?.role === 'admin' && renderAdminDashboard()}
        {user?.role === 'community_member' && renderMemberDashboard()}
        {user?.role === 'partner' && renderPartnerDashboard()}
      </div>
    </div>
  );
}

export default DashboardPage;