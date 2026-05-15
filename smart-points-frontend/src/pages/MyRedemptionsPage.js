import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

function MyRedemptionsPage() {
  const [redemptions, setRedemptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRedemption, setSelectedRedemption] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetchMyRedemptions();
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

  const fetchMyRedemptions = async () => {
    try {
      const res = await api.get('/rewards/my/redemptions');
      setRedemptions(res.data.redemptions || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load redemption history');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';

    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (value) => {
    if (!value) return '';

    return new Date(value).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const isBonusRecord = (item) => {
    return item?.record_type === 'rank_bonus' || item?.record_type === 'monthly_bonus';
  };

  const getBonusIcon = (item) => {
    if (item?.record_type === 'rank_bonus') return '🏅';
    if (item?.record_type === 'monthly_bonus') return '💰';
    return '🎁';
  };

  const getStatusLabel = (status) => {
    if (!status) return 'Pending';

    const cleanStatus = String(status).toLowerCase();

    if (cleanStatus === 'approved') return 'Approved';
    if (cleanStatus === 'claimed') return 'Claimed';
    if (cleanStatus === 'completed') return 'Completed';
    if (cleanStatus === 'rejected') return 'Rejected';
    if (cleanStatus === 'cancelled') return 'Cancelled';
    if (cleanStatus === 'pending') return 'Pending';

    return status;
  };

  const getStatusIcon = (status) => {
    const cleanStatus = String(status || 'pending').toLowerCase();

    if (
      cleanStatus === 'approved' ||
      cleanStatus === 'claimed' ||
      cleanStatus === 'completed'
    ) {
      return '✓';
    }

    if (cleanStatus === 'rejected') return '✕';
    if (cleanStatus === 'cancelled') return '−';

    return '◷';
  };

  const getStatusClass = (status) => {
    const cleanStatus = String(status || 'pending').toLowerCase();

    if (
      cleanStatus === 'approved' ||
      cleanStatus === 'claimed' ||
      cleanStatus === 'completed'
    ) {
      return 'redemption-status-approved';
    }

    if (cleanStatus === 'rejected') return 'redemption-status-rejected';
    if (cleanStatus === 'cancelled') return 'redemption-status-cancelled';

    return 'redemption-status-pending';
  };

  const filteredRedemptions = useMemo(() => {
    return redemptions.filter((item) => {
      const rewardName = String(item.reward_name || '').toLowerCase();
      const category = String(item.category || '').toLowerCase();
      const status = String(item.status || 'pending').toLowerCase();

      const matchesSearch =
        rewardName.includes(searchTerm.toLowerCase()) ||
        category.includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [redemptions, searchTerm, statusFilter]);

  return (
    <div className="page-shell">
      {showToast && (
        <div className="floating-toast-wrap">
          <div
            className={`floating-toast ${
              messageType === 'success' ? 'floating-toast-success' : 'floating-toast-error'
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

      <section className="redemption-page-card">
        <div className="redemption-header">
          <div className="redemption-title-wrap">
            <div className="redemption-title-icon">🎁</div>

            <div>
              <h1>My Redemptions</h1>
              <p>View your reward redemptions and earned benefits</p>
            </div>
          </div>

          <div className="redemption-tools">
            <div className="redemption-search">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search redemptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="redemption-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="claimed">Claimed</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="redemption-table-header">
          <span>Reward</span>
          <span>Date & Time</span>
          <span>Points Cost</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {filteredRedemptions.length === 0 ? (
          <div className="redemption-empty">
            <div>🎁</div>
            <h3>No redemption history</h3>
            <p>You have not redeemed any rewards or claimed benefits yet.</p>
          </div>
        ) : (
          <div className="redemption-list">
            {filteredRedemptions.map((item) => {
              const redeemedDate = item.activity_date || item.redeemed_at || item.created_at;
              const statusClass = getStatusClass(item.status);
              const keyValue = `${item.record_type || 'redemption'}-${item.id || item.redemption_id}`;

              return (
                <div key={keyValue} className="redemption-row">
                  <div className="redemption-reward-cell">
                    <div className="redemption-img-box">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.reward_name} />
                      ) : (
                        <span>{getBonusIcon(item)}</span>
                      )}
                    </div>

                    <div>
                      <h3>{item.reward_name || 'Unnamed Reward'}</h3>
                      <p>{item.category || 'N/A'}</p>
                      <small>📍 Cebu City</small>
                    </div>
                  </div>

                  <div className="redemption-date-cell">
                    <strong>{formatDate(redeemedDate)}</strong>
                    <span>{formatTime(redeemedDate)}</span>
                  </div>

                  <div className="redemption-points-cell">
                    <strong>
                      {isBonusRecord(item)
                        ? `+${Number(item.points_spent || 0).toLocaleString()}`
                        : Number(item.points_spent || 0).toLocaleString()}
                    </strong>

                    <span>{isBonusRecord(item) ? 'bonus points' : 'points'}</span>
                  </div>

                  <div>
                    <span className={`redemption-status-pill ${statusClass}`}>
                      <b>{getStatusIcon(item.status)}</b>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>

                  <div className="redemption-action-cell">
                    <button
                      className="redemption-view-btn"
                      onClick={() => setSelectedRedemption(item)}
                    >
                      View
                    </button>

                    <button
                      className="redemption-dropdown-btn"
                      onClick={() => setSelectedRedemption(item)}
                      title="View details"
                    >
                      ⌄
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="redemption-footer">
          <span>
            Showing {filteredRedemptions.length} of {redemptions.length} redemptions
          </span>

          <button className="redemption-refresh-btn" onClick={fetchMyRedemptions}>
            Refresh
          </button>
        </div>
      </section>

      {selectedRedemption && (
        <div className="participation-modal-backdrop">
          <div className="participation-modal redemption-detail-modal">
            <button
              className="modal-close-btn"
              onClick={() => setSelectedRedemption(null)}
            >
              ×
            </button>

            <section className="side-card modal-side-card">
              <h2>Redemption Details</h2>
              <p>Review the details of this reward redemption.</p>

              <div className="redemption-modal-image">
                {selectedRedemption.image_url ? (
                  <img
                    src={selectedRedemption.image_url}
                    alt={selectedRedemption.reward_name}
                  />
                ) : (
                  <span>{getBonusIcon(selectedRedemption)}</span>
                )}
              </div>

              <div className="redemption-detail-list">
                <p>
                  <span>Reward</span>
                  <strong>{selectedRedemption.reward_name || 'Unnamed Reward'}</strong>
                </p>

                <p>
                  <span>Category</span>
                  <strong>{selectedRedemption.category || 'N/A'}</strong>
                </p>

                <p>
                  <span>Points</span>
                  <strong>
                    {isBonusRecord(selectedRedemption)
                      ? `+${Number(selectedRedemption.points_spent || 0).toLocaleString()} bonus pts`
                      : `${Number(selectedRedemption.points_spent || 0).toLocaleString()} pts`}
                  </strong>
                </p>

                <p>
                  <span>Status</span>
                  <strong>{getStatusLabel(selectedRedemption.status)}</strong>
                </p>

                <p>
                  <span>Date</span>
                  <strong>
                    {formatDate(
                      selectedRedemption.activity_date ||
                        selectedRedemption.redeemed_at ||
                        selectedRedemption.created_at
                    )}
                  </strong>
                </p>

                <p>
                  <span>Updated At</span>
                  <strong>{formatDate(selectedRedemption.updated_at)}</strong>
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyRedemptionsPage;