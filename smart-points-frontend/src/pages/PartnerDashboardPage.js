import React, { useEffect, useState } from 'react';
import api from '../services/api';

function PartnerDashboardPage() {
  const [user, setUser] = useState(null);
  const [rewards, setRewards] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userRes = await api.get('/auth/me');
      setUser(userRes.data.user);

      const rewardRes = await api.get('/rewards');
      setRewards(rewardRes.data.rewards || []);
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;

  const pending = rewards.filter(r => r.availability_status === 'pending').length;
  const approved = rewards.filter(r => r.availability_status === 'available').length;
  const inactive = rewards.filter(r => r.availability_status === 'inactive').length;

  return (
    <div>

      {/* 🔥 HERO SECTION (SAME AS ADMIN) */}
    <div className="hero-section">
  <div className="hero-overlay">
    <div className="hero-content">
      
      <p className="hero-subtitle">Smart Points Engine</p>

      {/* 🔥 IMPORTANT CLASS */}
      <h1 className="hero-title">
        Empower Community Engagement Through Smart Rewards
      </h1>

      <p className="hero-text">
        Manage your partner rewards and contributions effectively.
      </p>

      <div className="hero-buttons">
        <a href="/rewards" className="primary-btn">
          Explore Rewards
        </a>
      </div>

    </div>
  </div>
</div>

      {/* 🔥 MAIN CONTENT */}
      <div className="page-shell">

        {/* ✅ WELCOME CARD */}
        <div className="page-header-card">
          <h2>Welcome, {user.full_name}</h2>
          <p><strong>Role:</strong> {user.role}</p>
          <p><strong>Organization:</strong> {user.organization_name || 'N/A'}</p>
        </div>

        {/* ✅ SUMMARY CARDS (MATCH ADMIN STYLE) */}
        <div className="summary-grid">
          <div className="summary-card">
            <h3>Pending Rewards</h3>
            <p>{pending}</p>
          </div>

          <div className="summary-card">
            <h3>Approved Rewards</h3>
            <p>{approved}</p>
          </div>

          <div className="summary-card">
            <h3>Inactive Rewards</h3>
            <p>{inactive}</p>
          </div>
        </div>

        {/* ✅ PARTNER TOOLS */}
        <div className="feature-section">
          <h2 className="section-title">Partner Tools</h2>

          <div className="feature-grid">
            <div className="feature-card">
              <h3>Create Reward</h3>
              <p>Submit a new reward for admin approval.</p>
              <a href="/admin/create-reward" className="primary-btn small-btn">
                Create
              </a>
            </div>

            <div className="feature-card">
              <h3>Reward Catalog</h3>
              <p>View rewards currently visible in the system.</p>
              <a href="/rewards" className="primary-btn small-btn">
                Open
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default PartnerDashboardPage;