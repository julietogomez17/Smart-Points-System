import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

function AdminAnalyticsPage() {
  const [dashboard, setDashboard] = useState(null);
  const [activityReport, setActivityReport] = useState([]);
  const [memberReport, setMemberReport] = useState([]);
  const [redemptionReport, setRedemptionReport] = useState([]);
  const [partnerReport, setPartnerReport] = useState([]);
  const [message, setMessage] = useState('');

useEffect(() => {
  fetchReports(); 

  const interval = setInterval(() => {
    fetchReports();
  }, 5000);

  return () => clearInterval(interval);
}, []);

  const fetchReports = async () => {
    try {
      const [
        dashboardRes,
        activityRes,
        memberRes,
        redemptionRes,
        partnerRes
      ] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/activities'),
        api.get('/reports/members'),
        api.get('/reports/redemptions'),
        api.get('/reports/partners')
      ]);

      setDashboard(dashboardRes.data.dashboard || {});
      setActivityReport(activityRes.data.report || []);
      setMemberReport(memberRes.data.report || []);
      setRedemptionReport(redemptionRes.data.report || []);
      setPartnerReport(partnerRes.data.report || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load analytics reports');
    }
  };

  const topActivity = useMemo(() => {
    if (!activityReport.length) return null;
    return [...activityReport].sort((a, b) => b.approved_count - a.approved_count)[0];
  }, [activityReport]);

  const topReward = useMemo(() => {
    if (!redemptionReport.length) return null;
    return [...redemptionReport].sort((a, b) => b.total_redemptions - a.total_redemptions)[0];
  }, [redemptionReport]);

  const topMember = useMemo(() => {
    if (!memberReport.length) return null;
    return [...memberReport].sort((a, b) => b.approved_participations - a.approved_participations)[0];
  }, [memberReport]);

  const exportTableToCSV = (filename, rows) => {
    if (!rows || !rows.length) return;

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((field) => `"${String(row[field] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPage = () => {
    window.print();
  };

  const maxActivityApproved = Math.max(...activityReport.map((a) => Number(a.approved_count || 0)), 1);
  const maxRewardRedemptions = Math.max(...redemptionReport.map((r) => Number(r.total_redemptions || 0)), 1);

  return (
    <div className="page-shell">
      <div className="page-header-card no-print">
        <h1>Analytics Reports</h1>
        <p>Evaluate engagement performance, member activity, reward usage, and partner contribution.</p>
        {message && <p className="status-message">{message}</p>}

        <div className="action-row">
          <button className="primary-btn small-btn" onClick={printPage}>
            Print Report
          </button>
          <button
            className="secondary-btn small-btn"
            onClick={() => exportTableToCSV('activity-engagement-report.csv', activityReport)}
          >
            Export Activities CSV
          </button>
          <button
            className="secondary-btn small-btn"
            onClick={() => exportTableToCSV('member-engagement-report.csv', memberReport)}
          >
            Export Members CSV
          </button>
          <button
            className="secondary-btn small-btn"
            onClick={() => exportTableToCSV('reward-redemption-report.csv', redemptionReport)}
          >
            Export Rewards CSV
          </button>
        </div>
      </div>

      <section className="summary-grid">
        <div className="summary-card">
          <h3>Total Members</h3>
          <p>{dashboard?.total_users ?? 0}</p>
        </div>
        <div className="summary-card">
          <h3>Total Activities</h3>
          <p>{dashboard?.total_activities ?? 0}</p>
        </div>
        <div className="summary-card">
          <h3>Approved</h3>
          <p>{dashboard?.approved_participations ?? 0}</p>
        </div>
        <div className="summary-card">
          <h3>Rejected</h3>
          <p>{dashboard?.rejected_participations ?? 0}</p>
        </div>
        <div className="summary-card">
          <h3>Suspicious Cases</h3>
          <p>{dashboard?.flagged_or_suspicious ?? 0}</p>
        </div>
        <div className="summary-card">
          <h3>Rewards Redeemed</h3>
          <p>{dashboard?.total_rewards_redeemed ?? 0}</p>
        </div>
      </section>

      <div className="insight-grid">
        <div className="insight-card">
          <h3>Top Activity</h3>
          <p>{topActivity?.title || 'N/A'}</p>
          <span>{topActivity ? `${topActivity.approved_count} approved participations` : 'No data yet'}</span>
        </div>
        <div className="insight-card">
          <h3>Top Reward</h3>
          <p>{topReward?.reward_name || 'N/A'}</p>
          <span>{topReward ? `${topReward.total_redemptions} redemptions` : 'No data yet'}</span>
        </div>
        <div className="insight-card">
          <h3>Most Engaged Member</h3>
          <p>{topMember?.full_name || 'N/A'}</p>
          <span>{topMember ? `${topMember.approved_participations} approved activities` : 'No data yet'}</span>
        </div>
      </div>

      <div className="report-section">
        <h2>Activity Performance Snapshot</h2>
        <div className="mini-chart-list">
       {[...activityReport]
  .sort((a, b) =>
    Number(b.approved_count || 0) - Number(a.approved_count || 0) ||
    Number(b.total_joined || 0) - Number(a.total_joined || 0)
  )
  .slice(0, 6)
  .map((item) => (
    <div key={item.activity_id} className="mini-chart-row">
      <div className="mini-chart-label">{item.title}</div>
      <div className="mini-chart-bar-wrap">
        <div
          className="mini-chart-bar"
          style={{
            width: `${(Number(item.approved_count || 0) / maxActivityApproved) * 100}%`
          }}
        />
      </div>
      <div className="mini-chart-value">{item.approved_count}</div>
    </div>
))}
        </div>
      </div>

      <div className="report-section">
        <h2>Reward Redemption Snapshot</h2>
        <div className="mini-chart-list">
          {redemptionReport.slice(0, 6).map((item) => (
            <div key={item.reward_id} className="mini-chart-row">
              <div className="mini-chart-label">{item.reward_name}</div>
              <div className="mini-chart-bar-wrap">
                <div
                  className="mini-chart-bar alt"
                  style={{ width: `${(Number(item.total_redemptions || 0) / maxRewardRedemptions) * 100}%` }}
                />
              </div>
              <div className="mini-chart-value">{item.total_redemptions}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="report-section">
        <div className="section-row">
          <h2>Activity Engagement Report</h2>
          <button
            className="secondary-btn small-btn no-print"
            onClick={() => exportTableToCSV('activity-engagement-report.csv', activityReport)}
          >
            Export
          </button>
        </div>

        <div className="table-shell">
          <table className="report-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Category</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Completion Rate</th>
                <th>Total Points</th>
              </tr>
            </thead>
            <tbody>
  {[...activityReport]
    .sort((a, b) => Number(b.approved_count || 0) - Number(a.approved_count || 0))
    .map((item) => (
      <tr key={item.activity_id}>
        <td>{item.title}</td>
        <td>{item.category || 'N/A'}</td>
        <td>{item.status}</td>
        <td>{item.total_joined}</td>
        <td>{item.approved_count}</td>
        <td>{item.rejected_count}</td>
        <td>{item.completion_rate}</td>
        <td>{item.total_points_generated}</td>
      </tr>
  ))}
</tbody>
          </table>
        </div>
      </div>

      <div className="report-section">
        <div className="section-row">
          <h2>Member Engagement Report</h2>
          <button
            className="secondary-btn small-btn no-print"
            onClick={() => exportTableToCSV('member-engagement-report.csv', memberReport)}
          >
            Export
          </button>
        </div>

        <div className="table-shell">
          <table className="report-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Joined Activities</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Points Balance</th>
                <th>Redemptions</th>
              </tr>
            </thead>
            <tbody>
              {memberReport.map((item) => (
                <tr key={item.user_id}>
                  <td>{item.full_name}</td>
                  <td>{item.email}</td>
                  <td>{item.joined_activities}</td>
                  <td>{item.approved_participations}</td>
                  <td>{item.rejected_participations}</td>
                  <td>{item.points_balance}</td>
                  <td>{item.total_redemptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-section">
        <div className="section-row">
          <h2>Reward Redemption Report</h2>
          <button
            className="secondary-btn small-btn no-print"
            onClick={() => exportTableToCSV('reward-redemption-report.csv', redemptionReport)}
          >
            Export
          </button>
        </div>

        <div className="table-shell">
          <table className="report-table">
            <thead>
              <tr>
                <th>Reward</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Total Redemptions</th>
                <th>Total Points Spent</th>
              </tr>
            </thead>
            <tbody>
              {redemptionReport.map((item) => (
                <tr key={item.reward_id}>
                  <td>{item.reward_name}</td>
                  <td>{item.category || 'N/A'}</td>
                  <td>{item.stock}</td>
                  <td>{item.total_redemptions}</td>
                  <td>{item.total_points_spent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-section">
        <h2>Partner Contribution Report</h2>
        <div className="table-shell">
          <table className="report-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Activities</th>
                <th>Rewards</th>
                <th>Reward Redemptions</th>
                <th>Total Points Generated</th>
              </tr>
            </thead>
            <tbody>
              {partnerReport.map((item) => (
                <tr key={item.partner_id}>
                  <td>{item.organization_name}</td>
                  <td>{item.total_activities}</td>
                  <td>{item.total_rewards}</td>
                  <td>{item.total_reward_redemptions}</td>
                  <td>{item.total_points_generated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminAnalyticsPage;