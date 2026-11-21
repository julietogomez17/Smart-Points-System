
import React, { useCallback, useEffect, useState } from "react";
import '../App.css';
import api from '../services/api';



function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
  

      const params = new URLSearchParams({
        page: String(page),
        search,
        action,
        entity
      });

    const response = await api.get(
  `/audit-logs?${params.toString()}`
);

const data = response.data;

if (!data.success) {
  throw new Error(
    data.message || "Failed to load audit logs."
  );
}

      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, action, entity]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const applySearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short"
        });
  };

  return (
    <main className="audit-page">
      <div className="audit-heading">
        <div>
          <h1>Audit Logs</h1>
          <p>
            Monitor system activities and administrative actions.
          </p>
        </div>

        <button
          className="audit-refresh"
          onClick={fetchLogs}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="audit-summary">
        <span>Total matching records</span>
        <strong>{pagination.total}</strong>
      </div>

      <div className="audit-panel">
        <form
          className="audit-filters"
          onSubmit={applySearch}
        >
          <input
            type="text"
            placeholder="Search user ID or details..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />

          <button type="submit">Search</button>

          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="APPROVE">Approve</option>
            <option value="REJECT">Reject</option>
            <option value="CANCEL">Cancel</option>
            <option value="DELETE">Delete</option>
          </select>

          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Modules</option>
            <option value="activity">Activities</option>
            <option value="account">Accounts</option>
            <option value="participation">Participation</option>
            <option value="points">Smart Points</option>
            <option value="reward">Rewards</option>
            <option value="redemption">Redemptions</option>
            <option value="fraud">Fraud Monitoring</option>
          </select>
        </form>

        {error && (
          <div className="audit-error" role="alert">
            {error}
          </div>
        )}

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Performed By</th>
                <th>Action</th>
                <th>Module</th>
                <th>Record ID</th>
                <th>Details</th>
                <th>Date & Time</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="audit-empty">
                    Loading audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="audit-empty">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.log_id}>
                    <td>#{log.log_id}</td>

                    <td>
                      <strong>
                        {log.actor_name ||
                          `User #${log.actor_user_id ?? "Unknown"}`}
                      </strong>
                      <small>{log.actor_role || "Unknown role"}</small>
                    </td>

                    <td>
                      <span
                        className={`audit-action audit-action-${String(
                          log.action_type
                        ).toLowerCase()}`}
                      >
                        {log.action_type}
                      </span>
                    </td>

                    <td>{log.entity_type}</td>
                    <td>{log.entity_id ?? "—"}</td>
                    <td className="audit-details">
                      {log.details || "—"}
                    </td>
                    <td>{formatDate(log.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="audit-pagination">
          <span>
            Page {pagination.page} of{" "}
            {Math.max(1, pagination.totalPages)}
          </span>

          <div>
            <button
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>

            <button
              disabled={
                loading ||
                page >= pagination.totalPages
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default AdminAuditLogsPage;
