import React, { useEffect, useState } from 'react';
import api from '../services/api';

function MyParticipationsPage() {
  const [participations, setParticipations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState({
    activity_id: '',
    feedback_text: ''
  });
  const [proofFile, setProofFile] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [participationTab, setParticipationTab] = useState('active');

  useEffect(() => {
    fetchMyParticipations();
    fetchActivities();
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

  const fetchMyParticipations = async () => {
    try {
      const res = await api.get('/participations/my');
      setParticipations(res.data.participations || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load participations');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await api.get('/activities');
      setActivities(res.data.activities || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load activities');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const joinedOrOpenActivities = activities.filter(
    (item) =>
      item.status === 'open' ||
      item.status === 'completed' ||
      item.status === 'closed'
  );

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    setProofFile(e.target.files[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = new FormData();
      data.append('activity_id', form.activity_id);
      data.append('feedback_text', form.feedback_text);

      if (proofFile) {
        data.append('proof_file', proofFile);
      }

      const res = await api.post('/participations', data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage(res.data.message || 'Participation submitted successfully');
      setMessageType('success');
      setShowToast(true);

      setForm({
        activity_id: '',
        feedback_text: ''
      });
      setProofFile(null);

      fetchMyParticipations();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to submit participation');
      setMessageType('error');
      setShowToast(true);
    }
  };

  const buildProofLink = (proofUrl) => {
    if (!proofUrl) return null;
    return `http://localhost:5000/${proofUrl}`;
  };

  const activeParticipations = participations.filter(
    (item) => item.status === 'approved'
  );

  const pendingParticipations = participations.filter(
    (item) => item.status === 'pending'
  );

  const inactiveParticipations = participations.filter(
    (item) => item.status === 'rejected'
  );

  const visibleParticipations =
    participationTab === 'active'
      ? activeParticipations
      : participationTab === 'pending'
      ? pendingParticipations
      : inactiveParticipations;

  return (
    <div className="page-shell">
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

      <div className="page-header-card">
        <h1>My Participations</h1>
        <p>Submit your participation proof and track submission status.</p>
      </div>

      <div className="reward-tabs">
        <button
          className={participationTab === 'active' ? 'reward-tab active' : 'reward-tab'}
          onClick={() => setParticipationTab('active')}
        >
          Active ({activeParticipations.length})
        </button>

        <button
          className={participationTab === 'pending' ? 'reward-tab active' : 'reward-tab'}
          onClick={() => setParticipationTab('pending')}
        >
          Pending ({pendingParticipations.length})
        </button>

        <button
          className={participationTab === 'inactive' ? 'reward-tab active' : 'reward-tab'}
          onClick={() => setParticipationTab('inactive')}
        >
          Inactive ({inactiveParticipations.length})
        </button>
      </div>

      <div className="form-card">
        <h3>Submit Participation</h3>

        <form onSubmit={handleSubmit} className="form-grid">
          <select
            name="activity_id"
            value={form.activity_id}
            onChange={handleChange}
            required
          >
            <option value="">Select Activity</option>
            {joinedOrOpenActivities.map((activity) => (
              <option key={activity.activity_id} value={activity.activity_id}>
                {activity.title} - {activity.category}
              </option>
            ))}
          </select>

          <div className="file-upload-box">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange}
            />
            {proofFile && <p className="file-name">{proofFile.name}</p>}
          </div>

          <textarea
            name="feedback_text"
            placeholder="Describe your participation"
            value={form.feedback_text}
            onChange={handleChange}
            rows="4"
            className="full-width-textarea"
          />

          <button className="primary-btn" type="submit">
            Submit Participation
          </button>
        </form>
      </div>

      {participations.length === 0 ? (
        <div className="page-card">
          <h3>No participation records yet</h3>
          <p>You have not submitted any participation records yet.</p>
        </div>
      ) : (
        <div className="participation-grid">
          {visibleParticipations.map((item) => {
            const status = item.status;

            const cardClass =
              status === 'approved'
                ? 'participation-card approved-card'
                : status === 'rejected'
                ? 'participation-card rejected-card'
                : 'participation-card pending-card';

            const statusClass =
              status === 'approved'
                ? 'status approved'
                : status === 'rejected'
                ? 'status rejected'
                : 'status pending';

            return (
              <div key={item.participation_id} className={cardClass}>
                <div className="card-top">
                  <h3>{item.activity_title}</h3>
                  <span className={statusClass}>{status}</span>
                </div>

                <div className="meta-row">
                  <span>🕒 {new Date(item.submitted_at).toLocaleTimeString()}</span>
                  <span>💵 {item.awarded_points || 0}</span>
                </div>

                <div className="meta-row">
                  <span>📅 {new Date(item.submitted_at).toLocaleDateString()}</span>
                </div>

                <div className="details-grid">
                  <p><strong>Category:</strong> {item.category}</p>
                  <p><strong>AI Flag:</strong> {item.ai_flag ? 'Yes' : 'No'}</p>
                  <p><strong>AI Score:</strong> {item.ai_score}</p>
                  <p><strong>AI Reason:</strong> {item.ai_reason}</p>
                  <p><strong>Awarded Points:</strong> {item.awarded_points}</p>
                  <p><strong>Feedback:</strong> {item.feedback_text || 'No feedback'}</p>
                </div>

                <p className="proof-line">
                  <strong>Proof:</strong>{' '}
                  {item.proof_url ? (
                    <a
                      href={buildProofLink(item.proof_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Uploaded Proof
                    </a>
                  ) : (
                    'No proof uploaded'
                  )}
                </p>

                {item.status === 'approved' && item.awarded_points >= 40 && (
                  <span className="badge excellent">Excellent</span>
                )}

                {item.status === 'approved' && item.awarded_points < 40 && (
                  <span className="badge average">Average</span>
                )}

                {item.status !== 'approved' && (
                  <span className="badge well">Well</span>
                )}

                <button className="play-btn">▶</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyParticipationsPage;