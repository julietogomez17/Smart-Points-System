import React, { useEffect, useState } from 'react';
import api from '../services/api';

function FraudReportPage() {
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchFraudReport();
  }, []);

  const fetchFraudReport = async () => {
    try {
      const res = await api.get('/reports/fraud');
      setRecords(res.data.report || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load fraud report');
    }
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  };

  return (
    <div className="page-shell">
      <div className="page-header-card">
        <h1>Fraud Report</h1>
        <p>View suspicious participation records and auto-rejected submissions.</p>
        {message && <p className="status-message">{message}</p>}
      </div>

      <div className="page-grid">
        {records.length === 0 ? (
          <div className="page-card">
            <h3>No suspicious submissions</h3>
            <p>No suspicious participation records were found.</p>
          </div>
        ) : (
          records.map((record) => (
            <div key={record.participation_id} className="page-card">
              <div className="card-top-row">
                <h3>{record.full_name}</h3>
                <span className="badge badge-rejected">{record.status}</span>
              </div>

              <p><strong>Email:</strong> {record.email}</p>
              <p><strong>Activity:</strong> {record.activity_title}</p>
              <p><strong>AI Flag:</strong> {record.ai_flag ? 'Yes' : 'No'}</p>
              <p><strong>AI Score:</strong> {record.ai_score}</p>
              <p><strong>AI Reason:</strong> {record.ai_reason}</p>
              <p><strong>Feedback:</strong> {record.feedback_text || 'No feedback'}</p>
              <p><strong>Proof:</strong> {record.proof_url || 'No proof uploaded'}</p>
              <p><strong>Submitted At:</strong> {formatDate(record.submitted_at)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FraudReportPage;