import React, { useEffect, useState } from 'react';
import api from '../services/api';

function AdminReportsPage() {
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetchReviewQueue();
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

  const fetchReviewQueue = async () => {
    try {
      const res = await api.get('/participations/review-queue');
      setRecords(res.data.records || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load review queue');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await api.post(`/participations/${id}/approve`);
      setMessage(res.data.message || 'Participation approved successfully');
      setMessageType('success');
      setShowToast(true);
      fetchReviewQueue();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to approve participation');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await api.post(`/participations/${id}/reject`);
      setMessage(res.data.message || 'Participation rejected successfully');
      setMessageType('success');
      setShowToast(true);
      fetchReviewQueue();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to reject participation');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const getProofUrl = (proofUrl) => {
    if (!proofUrl) return null;

    if (proofUrl.startsWith('http://') || proofUrl.startsWith('https://')) {
      return proofUrl;
    }

    return `http://localhost:5000/${proofUrl}`;
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
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="page-shell admin-review-shell">
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

      <section className="review-queue-panel">
        <div className="review-queue-header">
          <div>
            <h1>Recent Pending Proofs</h1>
            <p>Review clean pending participation submissions.</p>
          </div>

          <button className="review-view-all-btn" onClick={fetchReviewQueue}>
            Refresh
          </button>
        </div>

        {records.length === 0 ? (
          <div className="review-empty-state">
            <div className="review-empty-icon">✓</div>
            <h3>No pending proofs</h3>
            <p>There are no clean pending participation records for review.</p>
          </div>
        ) : (
          <div className="review-table-wrap">
            <div className="review-table-header">
              <span>Participant</span>
              <span>Activity</span>
              <span>Submitted At</span>
              <span>Proof</span>
              <span>Action</span>
            </div>

            <div className="review-table-body">
              {records.map((record) => {
                const proofUrl = getProofUrl(record.proof_url);

                return (
                  <div className="review-table-row" key={record.participation_id}>
                    <div className="review-participant-cell">
                      <div className="review-avatar">
                        {record.full_name
                          ? record.full_name.charAt(0).toUpperCase()
                          : 'U'}
                      </div>

                      <div>
                        <h3>{record.full_name || 'Unknown Participant'}</h3>
                        <p>{record.email || 'No email'}</p>
                      </div>
                    </div>

                    <div className="review-activity-cell">
                      <h3>{record.activity_title || 'Untitled Activity'}</h3>
                      <p>{record.category || 'No category'}</p>
                    </div>

                    <div className="review-date-cell">
                      <h3>{formatDate(record.submitted_at)}</h3>
                      <p>{formatTime(record.submitted_at)}</p>
                    </div>

                    <div className="review-proof-cell">
                      {proofUrl ? (
                        <a href={proofUrl} target="_blank" rel="noreferrer">
                          <img src={proofUrl} alt="Submitted proof" />
                        </a>
                      ) : (
                        <div className="review-proof-placeholder">No Proof</div>
                      )}
                    </div>

                    <div className="review-action-cell">
                      <button
                        className="review-approve-btn"
                        onClick={() => handleApprove(record.participation_id)}
                      >
                        Approve
                      </button>

                      <button
                        className="review-reject-btn"
                        onClick={() => handleReject(record.participation_id)}
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

export default AdminReportsPage;