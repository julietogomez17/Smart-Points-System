import React, { useEffect, useState } from 'react';
import api from '../services/api';

function PendingRewardsPage() {
  const [rewards, setRewards] = useState([]);
  const [activities, setActivities] = useState([]);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  fetchApprovalQueue();
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

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setShowToast(true);
  };

  const fetchApprovalQueue = async () => {
    await Promise.all([fetchPendingRewards(), fetchPendingActivities()]);
  };

  const fetchPendingRewards = async () => {
    try {
      const res = await api.get('/rewards/pending/list');
      setRewards(res.data.rewards || []);
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to load pending rewards', 'error');
    }
  };

  const fetchPendingActivities = async () => {
    try {
      const res = await api.get('/activities');
      const allActivities = res.data.activities || [];
      const pendingActivities = allActivities.filter(
        (activity) => activity.status === 'pending'
      );

      setActivities(pendingActivities);
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to load pending activities', 'error');
    }
  };

  const handleApproveReward = async (id) => {
    try {
      const res = await api.post(`/rewards/${id}/approve`);
      showMessage(res.data.message || 'Reward approved successfully', 'success');
      fetchApprovalQueue();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to approve reward', 'error');
    }
  };

  const handleRejectReward = async (id) => {
    try {
      const res = await api.post(`/rewards/${id}/reject`);
      showMessage(res.data.message || 'Reward rejected successfully', 'success');
      fetchApprovalQueue();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to reject reward', 'error');
    }
  };

  const handleApproveActivity = async (id) => {
    try {
      const res = await api.put(`/activities/${id}/approve`);
      showMessage(res.data.message || 'Activity approved successfully', 'success');
      fetchApprovalQueue();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to approve activity', 'error');
    }
  };

  const handleRejectActivity = async (id) => {
    try {
      const res = await api.put(`/activities/${id}/reject`);
      showMessage(res.data.message || 'Activity rejected successfully', 'success');
      fetchApprovalQueue();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to reject activity', 'error');
    }
  };

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }

    return `http://localhost:5000/${imageUrl}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';

    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="page-shell approval-page-shell">
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

      <div className="approval-header">
        <div>
          <h1>Admin Approval Queue</h1>
          <p>Review partner-submitted rewards and activities before publishing them.</p>
        </div>

        <button className="approval-refresh-btn" onClick={fetchApprovalQueue}>
          Refresh
        </button>
      </div>

      <div className="approval-tabs-summary">
        <span className="approval-summary-pill active">
          Pending Rewards ({rewards.length})
        </span>

        <span className="approval-summary-pill">
          Pending Activities ({activities.length})
        </span>
      </div>

      <section className="approval-section-card">
        <div className="approval-section-header">
          <div>
            <h2>Pending Rewards</h2>
            <p>Partner-submitted rewards waiting for admin approval.</p>
          </div>
        </div>

        {rewards.length === 0 ? (
          <div className="approval-empty-state">
            <div>✓</div>
            <h3>No pending rewards</h3>
            <p>There are no rewards waiting for approval.</p>
          </div>
        ) : (
          <div className="approval-table">
            {rewards.map((reward) => {
              const imageUrl = getImageUrl(reward.image_url);

              return (
                <div className="approval-row" key={`reward-${reward.reward_id}`}>
                  <div className="approval-main-cell">
                    <div className="approval-image-box">
                      {imageUrl ? (
                        <img src={imageUrl} alt={reward.reward_name} />
                      ) : (
                        <span>🎁</span>
                      )}
                    </div>

                    <div>
                      <h3>{reward.reward_name || 'Untitled Reward'}</h3>
                      <p>{reward.description || 'No description provided.'}</p>
                    </div>
                  </div>

                  <div className="approval-category-pill">
                    {reward.category || 'No Category'}
                  </div>

                  <div className="approval-info-cell">
                    <strong>{Number(reward.points_cost || 0).toLocaleString()} pts</strong>
                    <span>Points Cost</span>
                  </div>

                  <div className="approval-info-cell green">
                    <strong>{Number(reward.stock || 0).toLocaleString()}</strong>
                    <span>Stock</span>
                  </div>

                  <div className="approval-info-cell">
                    <strong>{reward.partner_name || 'N/A'}</strong>
                    <span>Partner</span>
                  </div>

                  <div className="approval-action-cell">
                    <button
                      className="approval-approve-btn"
                      onClick={() => handleApproveReward(reward.reward_id)}
                    >
                      Approve
                    </button>

                    <button
                      className="approval-reject-btn"
                      onClick={() => handleRejectReward(reward.reward_id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="approval-section-card">
        <div className="approval-section-header">
          <div>
            <h2>Pending Activities</h2>
            <p>Partner-created activities waiting for admin approval.</p>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="approval-empty-state">
            <div>✓</div>
            <h3>No pending activities</h3>
            <p>There are no activities waiting for approval.</p>
          </div>
        ) : (
          <div className="approval-table">
            {activities.map((activity) => {
              const imageUrl = getImageUrl(activity.image_url);

              return (
                <div className="approval-row" key={`activity-${activity.activity_id}`}>
                  <div className="approval-main-cell">
                    <div className="approval-image-box">
                      {imageUrl ? (
                        <img src={imageUrl} alt={activity.title} />
                      ) : (
                        <span>📌</span>
                      )}
                    </div>

                    <div>
                      <h3>{activity.title || 'Untitled Activity'}</h3>
                      <p>{activity.description || 'No description provided.'}</p>
                    </div>
                  </div>

                  <div className="approval-category-pill activity">
                    {activity.category || 'No Category'}
                  </div>

                  <div className="approval-info-cell">
                    <strong>{Number(activity.points_value || 0).toLocaleString()} pts</strong>
                    <span>Points</span>
                  </div>

                  <div className="approval-info-cell green">
                    <strong>{activity.capacity || '∞'}</strong>
                    <span>Capacity</span>
                  </div>

                  <div className="approval-info-cell">
                    <strong>{formatDate(activity.date_start)}</strong>
                    <span>Start Date</span>
                  </div>

                  <div className="approval-action-cell">
                    <button
                      className="approval-approve-btn"
                      onClick={() => handleApproveActivity(activity.activity_id)}
                    >
                      Approve
                    </button>

                    <button
                      className="approval-reject-btn"
                      onClick={() => handleRejectActivity(activity.activity_id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default PendingRewardsPage;