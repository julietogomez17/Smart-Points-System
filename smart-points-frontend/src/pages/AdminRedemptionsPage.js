
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../services/api";

const API_PATH = "/rewards/admin/redemptions";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const normalizeRedemption = (item) => ({
  ...item,
  id: item.redemption_id ?? item.id,
  citizen:
    item.full_name ??
    item.citizen_name ??
    item.citizen ??
    "Unknown Citizen",
  reward:
    item.reward_name ??
    item.reward ??
    "Unknown Reward",
  partner:
    item.partner_name ??
    item.organization_name ??
    (item.partner_id == null ? "LGU Managed" : "Partner"),
  points: Number(item.points_spent ?? item.points ?? 0),
  status: String(item.status ?? "pending").toLowerCase(),
  dateValue:
    item.redeemed_at ??
    item.created_at ??
    item.activity_date ??
    null,
  isLguManaged: item.partner_id == null,
  claim_location: item.claim_location ?? "",
  claim_instructions: item.claim_instructions ?? "",
});

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const statusStyle = (status) => {
  const colors = {
    pending: ["#fff4db", "#c97700"],
    approved: ["#e5f8ec", "#16803b"],
    confirmed: ["#e7f0ff", "#1d4ed8"],
    rejected: ["#fee2e2", "#b91c1c"],
    cancelled: ["#f1f5f9", "#64748b"],
  };

  const [background, color] =
    colors[status] || ["#f1f5f9", "#475569"];

  return {
    display: "inline-block",
    padding: "6px 11px",
    borderRadius: 30,
    background,
    color,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "capitalize",
  };
};

const tabButtonStyle = (active) => ({
  padding: "13px 20px",
  borderRadius: 10,
  border: active
    ? "1px solid #2563eb"
    : "1px solid #dbe4f0",
  background: active ? "#2563eb" : "#fff",
  color: active ? "#fff" : "#334155",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
});

const actionButtonStyle = (background, color = "#fff") => ({
  padding: "10px 16px",
  background,
  color,
  border: "none",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
});

const fieldStyle = {
  width: "100%",
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14,
  color: "#10264b",
  background: "#fff",
};

function AdminRedemptionsPage() {
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("requests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const [selectedRedemption, setSelectedRedemption] =
    useState(null);
  const [confirmAction, setConfirmAction] = useState("");
  const [claimLocation, setClaimLocation] = useState("");
  const [claimInstructions, setClaimInstructions] =
    useState("");
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const fetchRedemptions = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const response = await api.get(API_PATH);
      const payload = response.data;

      if (payload?.success === false) {
        throw new Error(
          payload.message || "Failed to fetch redemptions."
        );
      }

      const records = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.redemptions)
        ? payload.redemptions
        : Array.isArray(payload?.data)
        ? payload.data
        : null;

      if (!records) {
        throw new Error("Unexpected redemption API response.");
      }

      setRedemptions(records.map(normalizeRedemption));
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to load redemption records."
        )
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

 
const summary = useMemo(() => {
  const lguRedemptions = redemptions.filter(
    (item) => item.isLguManaged
  );

  return {
    total: lguRedemptions.length,
    pending: lguRedemptions.filter(
      (item) => item.status === "pending"
    ).length,
    approved: lguRedemptions.filter(
      (item) => item.status === "approved"
    ).length,
    confirmed: lguRedemptions.filter(
      (item) =>
        ["confirmed", "completed", "claimed"].includes(item.status)
    ).length,
    requests: lguRedemptions.filter(
      (item) =>
        ["pending", "approved"].includes(item.status)
    ).length,
    records: lguRedemptions.filter(
      (item) =>
        ["confirmed", "completed", "claimed", "rejected"].includes(
          item.status
        )
    ).length,
  };
}, [redemptions]);


  const filteredRedemptions = useMemo(() => {
    const now = new Date();
    const keyword = search.trim().toLowerCase();

    return redemptions.filter((item) => {
     
const matchesOwnerAccess = item.isLguManaged;

const matchesTab =
  activeTab === "requests"
    ? ["pending", "approved"].includes(item.status)
    : ["confirmed", "completed", "claimed", "rejected"].includes(
        item.status
      );

if (!matchesOwnerAccess || !matchesTab) return false;

      const matchesSearch =
        !keyword ||
        [
          item.id,
          item.citizen,
          item.reward,
          item.partner,
          item.status,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(keyword)
        );

      const matchesStatus =
        activeTab === "requests" ||
        statusFilter === "all" ||
        item.status === statusFilter;

      const matchesOwner =
        ownerFilter === "all" ||
        (ownerFilter === "lgu" && item.isLguManaged) ||
        (ownerFilter === "partner" && !item.isLguManaged);

      let matchesPeriod = true;

      if (periodFilter !== "all") {
        const date = new Date(item.dateValue);

        if (Number.isNaN(date.getTime())) {
          matchesPeriod = false;
        } else {
          const start = new Date(now);

          if (periodFilter === "today") {
            start.setHours(0, 0, 0, 0);
          } else if (periodFilter === "week") {
            start.setDate(now.getDate() - 6);
            start.setHours(0, 0, 0, 0);
          } else if (periodFilter === "month") {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
          } else if (periodFilter === "year") {
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
          }

          matchesPeriod = date >= start && date <= now;
        }
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesOwner &&
        matchesPeriod
      );
    });
  }, [
    redemptions,
    activeTab,
    search,
    statusFilter,
    ownerFilter,
    periodFilter,
  ]);

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSearch("");
    setStatusFilter("all");
    setOwnerFilter("all");
    setPeriodFilter("all");
  };

  const exportRecords = () => {
    if (filteredRedemptions.length === 0) {
      showToast("No data available to export.", "error");
      return;
    }

    const columns = [
      "Redemption ID",
      "Citizen",
      "Reward",
      "Partner / Owner",
      "Points",
      "Date",
      "Status",
      "Claim Location",
      "Claim Instructions",
    ];

    const safeCsv = (value) => {
      const raw = String(value ?? "");
      const safe = /^[=+\-@\t\r]/.test(raw)
        ? "'" + raw
        : raw;

      return `"${safe.replace(/"/g, '""')}"`;
    };

    const rows = filteredRedemptions.map((r) => [
      r.id,
      r.citizen,
      r.reward,
      r.partner,
      r.points,
      formatDate(r.dateValue),
      r.status,
      r.claim_location,
      r.claim_instructions,
    ]);

    const csv = [columns, ...rows]
      .map((row) => row.map(safeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      `CitiPoints_${
        activeTab === "requests"
          ? "Redemption_Requests"
          : "Redemption_Records"
      }_${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("Export completed successfully.");
  };

  const processRedemption = async (action) => {
    if (!selectedRedemption || processing) return;

    if (!selectedRedemption.isLguManaged) {
      showToast(
        "Partner-managed redemptions must be processed by their partner.",
        "error"
      );
      return;
    }

    const validAction =
      (["approve", "reject"].includes(action) &&
        selectedRedemption.status === "pending") ||
      (action === "confirm" &&
        selectedRedemption.status === "approved");

    if (!validAction) {
      showToast("This action is not allowed.", "error");
      return;
    }

    if (action === "approve") {
      if (!claimLocation.trim()) {
        showToast("Claim location is required.", "error");
        return;
      }

      if (!claimInstructions.trim()) {
        showToast("Claim instructions are required.", "error");
        return;
      }

      if (
        claimLocation.trim().length > 255 ||
        claimInstructions.trim().length > 3000
      ) {
        showToast(
          "Claim details exceed the allowed character limit.",
          "error"
        );
        return;
      }
    }

    setProcessing(true);

    try {
      const response = await api.post(
        `${API_PATH}/${selectedRedemption.id}/${action}`,
        action === "approve"
          ? {
              claim_location: claimLocation.trim(),
              claim_instructions: claimInstructions.trim(),
            }
          : {}
      );

      if (response.data?.success === false) {
        throw new Error(
          response.data.message || "Action failed."
        );
      }

      showToast(
        response.data?.message ||
          `Redemption ${action} completed.`
      );

      setSelectedRedemption(null);
      setConfirmAction("");
      setClaimLocation("");
      setClaimInstructions("");

      await fetchRedemptions(true);
    } catch (err) {
      showToast(
        getErrorMessage(
          err,
          `Failed to ${action} redemption.`
        ),
        "error"
      );
    } finally {
      setProcessing(false);
    }
  };

  const openDetails = (item) => {
    setSelectedRedemption(item);
    setConfirmAction("");
    setClaimLocation("");
    setClaimInstructions("");
  };

  const closeDetails = () => {
    if (processing) return;
    setSelectedRedemption(null);
    setConfirmAction("");
    setClaimLocation("");
    setClaimInstructions("");
  };

  const canApproveOrReject =
    selectedRedemption?.isLguManaged &&
    selectedRedemption?.status === "pending";

  const canConfirm =
    selectedRedemption?.isLguManaged &&
    selectedRedemption?.status === "approved";

  return (
    <main className="admin-redemptions-page">
      {/* TOAST */}
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 99999,
            background:
              toast.type === "error"
                ? "#dc2626"
                : "#16a34a",
            color: "#fff",
            padding: "14px 20px",
            borderRadius: 10,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,.15)",
            maxWidth: 380,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* HEADER */}
      <section className="admin-redemptions-header">
        <div>
          <span className="admin-redemptions-eyebrow">
            REDEMPTION MANAGEMENT
          </span>
          <h1>Redemptions</h1>
          <p>
            Manage reward requests and monitor redemption
            transactions across CitiPoints.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className="admin-redemptions-export"
            onClick={() => fetchRedemptions(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>

          <button
            type="button"
            className="admin-redemptions-export"
            onClick={exportRecords}
            disabled={loading || !!error}
          >
            ↓ Export{" "}
            {activeTab === "requests"
              ? "Requests"
              : "Records"}
          </button>
        </div>
      </section>

      {/* STATISTICS */}
      <section className="admin-redemptions-summary-grid">
        <article className="admin-redemptions-summary-card">
          <div className="admin-redemptions-summary-icon total">
            ▣
          </div>
          <div>
            <span>Total Redemptions</span>
            <strong>
              {summary.total.toLocaleString()}
            </strong>
            <small>All redemption transactions</small>
          </div>
        </article>

        <article className="admin-redemptions-summary-card">
          <div className="admin-redemptions-summary-icon pending">
            ◷
          </div>
          <div>
            <span>Pending Requests</span>
            <strong>
              {summary.pending.toLocaleString()}
            </strong>
            <small>Awaiting processing</small>
          </div>
        </article>

        <article className="admin-redemptions-summary-card">
          <div className="admin-redemptions-summary-icon approved">
            ✓
          </div>
          <div>
            <span>Approved</span>
            <strong>
              {summary.approved.toLocaleString()}
            </strong>
            <small>Awaiting claim confirmation</small>
          </div>
        </article>

        <article className="admin-redemptions-summary-card">
          <div className="admin-redemptions-summary-icon confirmed">
            ★
          </div>
          <div>
            <span>Confirmed</span>
            <strong>
              {summary.confirmed.toLocaleString()}
            </strong>
            <small>Completed reward claims</small>
          </div>
        </article>
      </section>

      {/* MAIN CONTENT */}
      <section className="admin-redemptions-card">
        {/* TABS */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 25,
            paddingBottom: 18,
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            style={tabButtonStyle(
              activeTab === "requests"
            )}
            onClick={() => changeTab("requests")}
          >
           Redemption Requests ({summary.requests})
          </button>

          <button
            type="button"
            style={tabButtonStyle(
              activeTab === "records"
            )}
            onClick={() => changeTab("records")}
          >
            Redemption Records ({summary.records})
          </button>
        </div>

        {/* SECTION HEADING */}
        <div className="admin-redemptions-card-heading">
          <div>
            <h2>
              {activeTab === "requests"
                ? "Redemption Requests"
                : "Redemption Records"}
            </h2>
            <p>
             
{activeTab === "requests"
  ? "Manage pending and approved LGU reward redemption requests."
  : "View completed and rejected LGU reward redemptions."}

            </p>
          </div>

          <select
            value={periodFilter}
            onChange={(e) =>
              setPeriodFilter(e.target.value)
            }
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>

        {/* FILTERS */}
        <div
          className="admin-redemptions-toolbar"
          style={{ flexWrap: "wrap" }}
        >
          <div className="admin-redemptions-search">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search citizen, reward, partner..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          {activeTab === "records" && (
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
            >
            
<option value="all">All Status</option>
<option value="confirmed">Completed</option>
<option value="rejected">Rejected</option>

            </select>
          )}

        </div>

        {/* ERROR */}
        {error && (
          <div
            role="alert"
            style={{
              padding: 16,
              margin: "12px 0",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              color: "#991b1b",
            }}
          >
            <strong>
              Unable to load redemption data
            </strong>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => fetchRedemptions()}
            >
              Try Again
            </button>
          </div>
        )}

        {/* TABLE */}
        <div className="admin-redemptions-table-wrap">
          <table className="admin-redemptions-table">
            <thead>
              <tr>
                <th>Redemption ID</th>
                <th>Citizen</th>
                <th>Reward</th>
                <th>Partner / Owner</th>
                <th>Points</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="admin-redemptions-empty-cell"
                  >
                    <div className="admin-redemptions-empty">
                      <strong>
                        Loading redemptions...
                      </strong>
                    </div>
                  </td>
                </tr>
              ) : filteredRedemptions.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="admin-redemptions-empty-cell"
                  >
                    <div className="admin-redemptions-empty">
                      <div className="admin-redemptions-empty-icon">
                        ◇
                      </div>
                      <strong>
                        {error
                          ? "Redemption data unavailable"
                          : activeTab === "requests"
                          ? "No pending redemption requests"
                          : "No redemption records found"}
                      </strong>
                      <span>
                        {error
                          ? "Check your backend connection."
                          : redemptions.length === 0
                          ? "Redemption transactions will appear here."
                          : "Try changing your search or filters."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRedemptions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>#{item.id}</strong>
                    </td>

                    <td>
                      <div className="admin-redemptions-citizen">
                        <div className="admin-redemptions-avatar">
                          {String(item.citizen)
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span>{item.citizen}</span>
                      </div>
                    </td>

                    <td>{item.reward}</td>

                    <td>
                      <span>{item.partner}</span>
                      {item.isLguManaged && (
                        <small
                          style={{
                            display: "block",
                            marginTop: 4,
                            color: "#2563eb",
                          }}
                        >
                          LGU Reward
                        </small>
                      )}
                    </td>

                    <td>
                      <strong className="admin-redemptions-points">
                        {item.points.toLocaleString()} pts
                      </strong>
                    </td>

                    <td>
                      {formatDate(item.dateValue)}
                    </td>

                    <td>
                      <span
                        style={statusStyle(item.status)}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="admin-redemptions-view"
                        onClick={() =>
                          openDetails(item)
                        }
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && (
          <p
            style={{
              marginTop: 15,
              fontSize: 12,
              color: "#64748b",
            }}
          >
            Showing {filteredRedemptions.length}{" "}
            {activeTab === "requests"
              ? "requests"
              : "records"}.
          </p>
        )}
      </section>

      {/* INFORMATION CARDS */}
      <section className="admin-redemptions-info-grid">
        <article className="admin-redemptions-info-card">
          <div className="admin-redemptions-info-icon citizen">
            ♙
          </div>
          <div>
            <h3>Citizen</h3>
            <p>
              Citizens submit redemption requests
              and track their reward claim status.
            </p>
          </div>
        </article>

        <article className="admin-redemptions-info-card">
          <div className="admin-redemptions-info-icon partner">
            ◇
          </div>
          <div>
            <h3>Partner</h3>
            <p>
              Partners approve, reject, and confirm
              claims for their own rewards.
            </p>
          </div>
        </article>

        <article className="admin-redemptions-info-card">
          <div className="admin-redemptions-info-icon admin">
            ✓
          </div>
          <div>
            <h3>LGU Administrator</h3>
            <p>
              Administrators manage LGU reward
              requests and monitor all redemption
              transactions.
            </p>
          </div>
        </article>
      </section>

      {/* REDEMPTION DETAILS MODAL */}
      {selectedRedemption && (
        <div
          className="admin-redemptions-modal-overlay"
          onClick={closeDetails}
        >
          <div
            className="admin-redemptions-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Redemption Details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-redemptions-modal-header">
              <div>
                <span>REDEMPTION DETAILS</span>
                <h2>
                  Redemption #{selectedRedemption.id}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                disabled={processing}
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="admin-redemptions-modal-status">
              <span
                style={statusStyle(
                  selectedRedemption.status
                )}
              >
                {selectedRedemption.status}
              </span>
            </div>

            <div className="admin-redemptions-details-grid">
              <div>
                <span>Citizen</span>
                <strong>
                  {selectedRedemption.citizen}
                </strong>
              </div>

              <div>
                <span>Reward</span>
                <strong>
                  {selectedRedemption.reward}
                </strong>
              </div>

              <div>
                <span>Partner / Owner</span>
                <strong>
                  {selectedRedemption.partner}
                </strong>
              </div>

              <div>
                <span>Points</span>
                <strong>
                  {selectedRedemption.points.toLocaleString()} pts
                </strong>
              </div>

              <div>
                <span>Date Requested</span>
                <strong>
                  {formatDate(
                    selectedRedemption.dateValue
                  )}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong
                  style={{
                    textTransform: "capitalize",
                  }}
                >
                  {selectedRedemption.status}
                </strong>
              </div>
            </div>

            <div className="admin-redemptions-modal-note">
              <strong>
                {selectedRedemption.isLguManaged
                  ? "LGU-Managed Redemption"
                  : "Partner-Managed Redemption"}
              </strong>

              <p>
                {selectedRedemption.isLguManaged
                  ? "The LGU Administrator handles approval, rejection, and claim confirmation for this reward."
                  : "The assigned Establishment  handles approval, rejection, and claim confirmation. The LGU Administrator can monitor this transaction."}
              </p>
            </div>

            {/* SAVED CLAIM DETAILS */}
            {(selectedRedemption.claim_location ||
              selectedRedemption.claim_instructions) && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 10,
                }}
              >
                <strong
                  style={{ color: "#1d4ed8" }}
                >
                  Claiming Details
                </strong>

                <p
                  style={{
                    margin: "10px 0 5px",
                    color: "#475569",
                    overflowWrap: "anywhere",
                  }}
                >
                  <b>Where to Claim:</b>{" "}
                  {selectedRedemption.claim_location ||
                    "Not provided"}
                </p>

                <p
                  style={{
                    margin: 0,
                    color: "#475569",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  <b>Instructions:</b>{" "}
                  {selectedRedemption.claim_instructions ||
                    "Not provided"}
                </p>
              </div>
            )}

            {/* CONFIRM ACTION */}
            {confirmAction && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  border: "1px solid #dbe4f0",
                  background: "#f8fafc",
                  borderRadius: 10,
                }}
              >
                <strong
                  style={{
                    color: "#10264b",
                    fontSize: 16,
                  }}
                >
                  {confirmAction === "approve"
                    ? "Approve Redemption"
                    : confirmAction === "reject"
                    ? "Reject Redemption"
                    : "Confirm Reward Claim"}
                </strong>

                <p
                  style={{
                    margin: "10px 0 15px",
                    lineHeight: 1.6,
                    color: "#475569",
                    fontSize: 13,
                  }}
                >
                  {confirmAction === "approve"
                    ? "Enter the claiming information below. Approval will deduct the citizen's Smart Points and reduce the reward stock."
                    : confirmAction === "reject"
                    ? "This request will be rejected without deducting Smart Points."
                    : "Confirm that the citizen has already received the reward. Points and stock will not be deducted again."}
                </p>

                {/* NEW REQUIRED CLAIM FIELDS */}
                {confirmAction === "approve" && (
                  <div
                    style={{
                      display: "grid",
                      gap: 14,
                      marginBottom: 18,
                    }}
                  >
                    <div>
                      <label
                        htmlFor="lgu-claim-location"
                        style={{
                          display: "block",
                          fontWeight: 700,
                          marginBottom: 7,
                          color: "#1e3a5f",
                          fontSize: 13,
                        }}
                      >
                        Where to Claim{" "}
                        <span
                          style={{ color: "#dc2626" }}
                        >
                          *
                        </span>
                      </label>

                      <input
                        id="lgu-claim-location"
                        type="text"
                        required
                        maxLength={255}
                        value={claimLocation}
                        onChange={(e) =>
                          setClaimLocation(
                            e.target.value
                          )
                        }
                        placeholder="e.g. Mandaue City Hall, Ground Floor"
                        disabled={processing}
                        style={fieldStyle}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lgu-claim-instructions"
                        style={{
                          display: "block",
                          fontWeight: 700,
                          marginBottom: 7,
                          color: "#1e3a5f",
                          fontSize: 13,
                        }}
                      >
                        Claim Instructions{" "}
                        <span
                          style={{ color: "#dc2626" }}
                        >
                          *
                        </span>
                      </label>

                      <textarea
                        id="lgu-claim-instructions"
                        required
                        rows={4}
                        maxLength={3000}
                        value={claimInstructions}
                        onChange={(e) =>
                          setClaimInstructions(
                            e.target.value
                          )
                        }
                        placeholder="e.g. Present your redemption ID and a valid ID at the designated counter."
                        disabled={processing}
                        style={{
                          ...fieldStyle,
                          resize: "vertical",
                        }}
                      />
                    </div>

                    <small
                      style={{
                        color: "#64748b",
                        lineHeight: 1.5,
                      }}
                    >
                      Both fields are required.
                      The citizen will see these details
                      after the redemption is approved.
                    </small>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() =>
                      setConfirmAction("")
                    }
                    style={actionButtonStyle(
                      "#e2e8f0",
                      "#334155"
                    )}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      processing ||
                      (confirmAction === "approve" &&
                        (!claimLocation.trim() ||
                          !claimInstructions.trim()))
                    }
                    onClick={() =>
                      processRedemption(confirmAction)
                    }
                    style={{
                      ...actionButtonStyle(
                        confirmAction === "reject"
                          ? "#dc2626"
                          : "#2563eb"
                      ),
                      opacity:
                        processing ||
                        (confirmAction === "approve" &&
                          (!claimLocation.trim() ||
                            !claimInstructions.trim()))
                          ? 0.55
                          : 1,
                    }}
                  >
                    {processing
                      ? "Processing..."
                      : confirmAction === "approve"
                      ? "Approve Redemption"
                      : "Yes, Confirm"}
                  </button>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            {!confirmAction && (
              <div
                className="admin-redemptions-modal-footer"
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                {canApproveOrReject && (
                  <>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() =>
                        setConfirmAction("reject")
                      }
                      style={actionButtonStyle(
                        "#dc2626"
                      )}
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      disabled={processing}
                      onClick={() =>
                        setConfirmAction("approve")
                      }
                      style={actionButtonStyle(
                        "#2563eb"
                      )}
                    >
                      Approve
                    </button>
                  </>
                )}

                {canConfirm && (
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() =>
                      setConfirmAction("confirm")
                    }
                    style={actionButtonStyle(
                      "#16a34a"
                    )}
                  >
                    Confirm Claim
                  </button>
                )}

                <button
                  type="button"
                  onClick={closeDetails}
                  disabled={processing}
                  style={actionButtonStyle(
                    "#e2e8f0",
                    "#334155"
                  )}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminRedemptionsPage;
