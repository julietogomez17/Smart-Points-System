import React, { useEffect, useState } from 'react';
import api from '../services/api';

function PendingRewardsPage() {
  const [rewards, setRewards] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetchPendingRewards();
  }, []);

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

  const fetchPendingRewards = async () => {
    try {
      const res = await api.get('/rewards/pending/list');
      setRewards(res.data.rewards || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load pending rewards');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await api.post(`/rewards/${id}/approve`);
      setMessage(res.data.message || 'Reward approved successfully');
      setMessageType('success');
      setShowToast(true);
      fetchPendingRewards();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to approve reward');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await api.post(`/rewards/${id}/reject`);
      setMessage(res.data.message || 'Reward rejected successfully');
      setMessageType('success');
      setShowToast(true);
      fetchPendingRewards();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to reject reward');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const getRewardImageUrl = (imageUrl) => {
    if (!imageUrl) return null;

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }

    return `http://localhost:5000/${imageUrl}`;
  };

  return (
    <div className="page-shell pending-rewards-shell">
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
              {messageType === 'success' ? '✓' : '!'}
            </div>

            <div className="floating-toast-content">
              <h4>{messageType === 'success' ? 'Success' : 'Error'}</h4>
              <p>{message}</p>
            </div>
          </div>
        </div>
      )}

      <section className="pending-rewards-panel">
        <div className="pending-rewards-header">
          <div>
            <h1>Pending Rewards</h1>
            <p>Review partner-submitted rewards before making them available.</p>
          </div>

          <button className="pending-refresh-btn" onClick={fetchPendingRewards}>
            Refresh
          </button>
        </div>

        {rewards.length === 0 ? (
          <div className="pending-empty-state">
            <div className="pending-empty-icon">✓</div>
            <h3>No pending rewards</h3>
            <p>There are no rewards waiting for admin approval.</p>
          </div>
        ) : (
          <div className="pending-table-wrap">
            <div className="pending-table-header">
              <span>Reward</span>
              <span>Category</span>
              <span>Points Cost</span>
              <span>Stock</span>
              <span>Partner</span>
              <span>Action</span>
            </div>

            <div className="pending-table-body">
              {rewards.map((reward) => {
                const imageUrl = getRewardImageUrl(reward.image_url);

                return (
                  <div className="pending-table-row" key={reward.reward_id}>
                    <div className="pending-reward-cell">
                      <div className="pending-reward-img">
                        {imageUrl ? (
                          <img src={imageUrl} alt={reward.reward_name} />
                        ) : (
                          <span>🎁</span>
                        )}
                      </div>

                      <div>
                        <div className="pending-title-row">
                          <h3>{reward.reward_name || 'Untitled Reward'}</h3>
                          <span className="pending-status-pill">
                            {reward.availability_status || 'pending'}
                          </span>
                        </div>

                        <p>{reward.description || 'No description provided'}</p>
                      </div>
                    </div>

                    <div className="pending-category-cell">
                      <strong>{reward.category || 'N/A'}</strong>
                    </div>

                    <div className="pending-points-cell">
                      <strong>{Number(reward.points_cost || 0).toLocaleString()}</strong>
                      <span>points</span>
                    </div>

                    <div className="pending-stock-cell">
                      <strong>{Number(reward.stock || 0).toLocaleString()}</strong>
                      <span>available</span>
                    </div>

                    <div className="pending-partner-cell">
                      <strong>{reward.partner_name || 'N/A'}</strong>
                    </div>

                    <div className="pending-action-cell">
                      <button
                        className="pending-approve-btn"
                        onClick={() => handleApprove(reward.reward_id)}
                      >
                        Approve
                      </button>

                      <button
                        className="pending-reject-btn"
                        onClick={() => handleReject(reward.reward_id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default PendingRewardsPage;