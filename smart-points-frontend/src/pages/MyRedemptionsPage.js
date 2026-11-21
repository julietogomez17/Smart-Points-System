
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../services/api";
import "../App.css";

const BLUE = "#2563eb";
const NAVY = "#10264b";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const isBonus = (item) =>
  ["rank_bonus", "monthly_bonus"].includes(
    item?.record_type
  );

const bonusIcon = (item) => {
  if (item?.record_type === "rank_bonus") return "🏅";
  if (item?.record_type === "monthly_bonus") return "💰";
  return "🎁";
};

const getOwner = (item) => {
  if (isBonus(item)) return "CitiPoints Benefit";

  if (
    item.partner_id === null ||
    item.partner_name === "LGU Managed"
  ) {
    return "LGU Managed";
  }

  return (
    item.partner_name ||
    item.organization_name ||
    "Reward Redemption"
  );
};

const getStatus = (item) => {
  if (isBonus(item)) {
    return {
      label: "Benefit Earned",
      color: "#1d4ed8",
      bg: "#dbeafe",
      icon: "★",
    };
  }

  const status = String(
    item.status || "pending"
  ).toLowerCase();

  if (status === "pending") {
    return {
      label:
        item.partner_id === null ||
        item.partner_name === "LGU Managed"
          ? "Waiting for LGU Approval"
          : "Waiting for Partner Approval",
      color: "#a16207",
      bg: "#fef3c7",
      icon: "◷",
    };
  }

  if (status === "approved") {
    return {
      label: "Ready to Claim",
      color: "#15803d",
      bg: "#dcfce7",
      icon: "✓",
    };
  }

  if (
    ["confirmed", "completed", "claimed"].includes(status)
  ) {
    return {
      label: "Completed",
      color: "#1d4ed8",
      bg: "#dbeafe",
      icon: "✓",
    };
  }

  if (status === "rejected") {
    return {
      label: "Rejected",
      color: "#b91c1c",
      bg: "#fee2e2",
      icon: "×",
    };
  }

  if (status === "cancelled") {
    return {
      label: "Cancelled",
      color: "#64748b",
      bg: "#f1f5f9",
      icon: "−",
    };
  }

  return {
    label: status,
    color: "#475569",
    bg: "#f1f5f9",
    icon: "•",
  };
};

const getDateValue = (item) =>
  item.activity_date ||
  item.redeemed_at ||
  item.created_at;

const getPoints = (item) => {
  const points = Number(item.points_spent || 0);
  return isBonus(item)
    ? `+${points.toLocaleString()}`
    : points.toLocaleString();
};

function StatusBadge({ item }) {
  const status = getStatus(item);

  return (
    <span
      className="cp-red-status"
      style={{
        color: status.color,
        background: status.bg,
      }}
    >
      <span className="cp-red-status-icon">
        {status.icon}
      </span>
      {status.label}
    </span>
  );
}
const getRewardImageUrl = (imageUrl) => {
  if (!imageUrl) return null;

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  const backendURL = api.defaults.baseURL.replace(/\/api\/?$/, '');
  const path = imageUrl.replace(/^\/+/, '');

  return `${backendURL}/${path}`;
};
function RewardImage({ item, large = false }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [item.image_url]);

  return (
    <div
      className={
        large
          ? "cp-red-reward-image large"
          : "cp-red-reward-image"
      }
    >
      {item.image_url && !imageFailed ? (
        <img
          src={getRewardImageUrl(item.image_url)}
          alt={item.reward_name || "Reward"}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{bonusIcon(item)}</span>
      )}
    </div>
  );
}

function MyRedemptionsPage() {
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const [selectedRedemption, setSelectedRedemption] =
    useState(null);

  const [toast, setToast] = useState(null);

  

  const fetchMyRedemptions = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        const response = await api.get(
          "/rewards/my/redemptions"
        );

        const payload = response.data;

        if (payload?.success === false) {
          throw new Error(
            payload.message ||
              "Unable to load redemptions."
          );
        }

        const records = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.redemptions)
          ? payload.redemptions
          : null;

        if (!records) {
          throw new Error(
            "Unexpected redemption API response."
          );
        }

        setRedemptions(records);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load redemption history."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchMyRedemptions();
  }, [fetchMyRedemptions]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!selectedRedemption) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedRedemption(null);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () =>
      document.removeEventListener(
        "keydown",
        handleEscape
      );
  }, [selectedRedemption]);

  const summary = useMemo(() => {
    const rewardRecords = redemptions.filter(
      (item) => !isBonus(item)
    );

    return {
      total: rewardRecords.length,
      pending: rewardRecords.filter(
        (item) =>
          String(item.status).toLowerCase() === "pending"
      ).length,
      ready: rewardRecords.filter(
        (item) =>
          String(item.status).toLowerCase() === "approved"
      ).length,
      completed: rewardRecords.filter((item) =>
        ["confirmed", "completed", "claimed"].includes(
          String(item.status).toLowerCase()
        )
      ).length,
      benefits: redemptions.filter(isBonus).length,
    };
  }, [redemptions]);

  const filteredRedemptions = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return redemptions
      .filter((item) => {
        const status = String(
          item.status || "pending"
        ).toLowerCase();

        const matchesSearch =
          !keyword ||
          [
            item.reward_name,
            item.category,
            item.partner_name,
            item.organization_name,
            item.redemption_id,
            getStatus(item).label,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(keyword)
          );

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "benefit"
            ? isBonus(item)
            : !isBonus(item) &&
              (status === statusFilter ||
                (statusFilter === "confirmed" &&
                  ["claimed", "completed"].includes(
                    status
                  ))));

        let matchesTab = true;

        if (activeTab === "pending") {
          matchesTab =
            !isBonus(item) && status === "pending";
        } else if (activeTab === "ready") {
          matchesTab =
            !isBonus(item) && status === "approved";
        } else if (activeTab === "completed") {
          matchesTab =
            !isBonus(item) &&
            ["confirmed", "completed", "claimed"].includes(
              status
            );
        } else if (activeTab === "benefits") {
          matchesTab = isBonus(item);
        }

        return (
          matchesSearch && matchesStatus && matchesTab
        );
      })
      .sort((a, b) => {
        const aTime = new Date(
          getDateValue(a) || 0
        ).getTime();
        const bTime = new Date(
          getDateValue(b) || 0
        ).getTime();

        return (
          (Number.isFinite(bTime) ? bTime : 0) -
          (Number.isFinite(aTime) ? aTime : 0)
        );
      });
  }, [
    redemptions,
    searchTerm,
    statusFilter,
    activeTab,
  ]);

  const changeTab = (tab) => {
    setActiveTab(tab);
    setStatusFilter("all");
  };

  const summaryCards = [
    {
      label: "Total Redemptions",
      count: summary.total,
      icon: "🎁",
      className: "total",
      tab: "all",
      description: "Reward requests",
    },
    {
      label: "Pending Approval",
      count: summary.pending,
      icon: "◷",
      className: "pending",
      tab: "pending",
      description: "Awaiting review",
    },
    {
      label: "Ready to Claim",
      count: summary.ready,
      icon: "✓",
      className: "ready",
      tab: "ready",
      description: "Approved rewards",
    },
    {
      label: "Completed",
      count: summary.completed,
      icon: "★",
      className: "completed",
      tab: "completed",
      description: "Claimed rewards",
    },
  ];

  return (
    <main className="cp-red-page">
      <style>{`
        .cp-red-page {
          --cp-blue: ${BLUE};
          --cp-navy: ${NAVY};
          width: 100%;
          min-height: 100vh;
          padding: 30px 34px 60px;
          background: #f4f7fc;
          color: var(--cp-navy);
          font-family: inherit;
          box-sizing: border-box;
        }

        .cp-red-page * {
          box-sizing: border-box;
        }

        .cp-red-page button,
        .cp-red-page input,
        .cp-red-page select {
          font: inherit;
        }

       
.cp-red-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 34px 38px;
  border-radius: 20px;

  background-image:
    linear-gradient(
      90deg,
      rgba(238, 247, 255, 0.96) 0%,
      rgba(238, 247, 255, 0.82) 28%,
      rgba(238, 247, 255, 0.30) 52%,
      rgba(238, 247, 255, 0.08) 100%
    ),
    url('/mandaue-banner.png');

  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;

  background-color: #eaf3ff;
  color: #123d7a;
  border: 1px solid #dbeafe;
  box-shadow: 0 4px 18px rgba(16, 42, 86, 0.08);
}


        .cp-red-hero:before,
        .cp-red-hero:after {
          content: "";
          position: absolute;
          border: 2px solid rgba(255,255,255,.1);
          width: 220px;
          height: 220px;
          transform: rotate(45deg);
          right: 9%;
          top: -155px;
          border-radius: 20px;
        }

        .cp-red-hero:after {
          width: 130px;
          height: 130px;
          right: 3%;
          top: 95px;
        }

        .cp-red-hero-content {
          position: relative;
          z-index: 1;
        }

        .cp-red-eyebrow {
          display: block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.3px;
          margin-bottom: 9px;
          color: #c9dcff;
        }

        .cp-red-hero h1 {
          margin: 0 0 9px;
          font-size: clamp(27px, 3vw, 38px);
          font-weight: 800;
          letter-spacing: -.8px;
          color: white;
        }

        .cp-red-hero p {
          margin: 0;
          font-size: 14px;
          color: #e1ebff;
          line-height: 1.6;
        }

        .cp-red-refresh {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #d9e5ff;
          border-radius: 10px;
          background: white;
          color: #1d4ed8;
          font-weight: 700;
          padding: 12px 19px;
          cursor: pointer;
          white-space: nowrap;
        }

        .cp-red-refresh:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .cp-red-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 16px;
          margin: 20px 0;
        }

        .cp-red-stat {
          display: flex;
          align-items: center;
          text-align: left;
          gap: 15px;
          min-width: 0;
          padding: 22px 19px;
          border: 1px solid #e1e8f2;
          background: white;
          border-radius: 15px;
          cursor: pointer;
          box-shadow: 0 5px 18px rgba(15,39,83,.035);
          transition: transform .15s, border-color .15s;
        }

        .cp-red-stat:hover {
          transform: translateY(-2px);
          border-color: #a9c7ff;
        }

        .cp-red-stat.active {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,.08);
        }

        .cp-red-stat-icon {
          flex: 0 0 51px;
          width: 51px;
          height: 51px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          font-size: 23px;
          font-weight: 800;
        }

        .cp-red-stat-icon.total {
          background: #eaf2ff;
          color: #2563eb;
        }

        .cp-red-stat-icon.pending {
          background: #fff3dd;
          color: #f59e0b;
        }

        .cp-red-stat-icon.ready {
          background: #e5f8ed;
          color: #16a34a;
        }

        .cp-red-stat-icon.completed {
          background: #eaf2ff;
          color: #2563eb;
        }

        .cp-red-stat-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .cp-red-stat-info span {
          font-size: 12px;
          font-weight: 700;
          color: #435777;
        }

        .cp-red-stat-info strong {
          font-size: 29px;
          line-height: 1.25;
          font-weight: 800;
          color: #10264b;
        }

        .cp-red-stat-info small {
          font-size: 11px;
          color: #8a99af;
        }

        .cp-red-content {
          background: white;
          border: 1px solid #e1e8f2;
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 5px 18px rgba(15,39,83,.035);
        }

        .cp-red-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 23px;
        }

        .cp-red-section-heading h2 {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 800;
        }

        .cp-red-section-heading p {
          margin: 0;
          font-size: 13px;
          color: #74849e;
        }

        .cp-red-count {
          padding: 8px 12px;
          background: #edf4ff;
          color: #2563eb;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .cp-red-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          border-bottom: 1px solid #e6ecf5;
          margin-bottom: 20px;
          padding-bottom: 14px;
        }

        .cp-red-tab {
          padding: 10px 15px;
          border-radius: 9px;
          border: 1px solid transparent;
          background: transparent;
          color: #60728e;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .cp-red-tab:hover {
          background: #f2f6fd;
        }

        .cp-red-tab.active {
          background: #2563eb;
          color: white;
        }

        .cp-red-filters {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 210px;
          gap: 12px;
          margin-bottom: 20px;
        }

        .cp-red-search {
          display: flex;
          align-items: center;
          gap: 11px;
          border: 1px solid #dce5f1;
          border-radius: 10px;
          padding: 0 15px;
          min-width: 0;
          color: #64748b;
          background: white;
        }

        .cp-red-search input {
          width: 100%;
          height: 46px;
          border: none;
          outline: none;
          color: #10264b;
          background: transparent;
          font-size: 13px;
        }

        .cp-red-search input::placeholder {
          color: #94a3b8;
        }

        .cp-red-filter {
          width: 100%;
          height: 46px;
          padding: 0 13px;
          border: 1px solid #dce5f1;
          border-radius: 10px;
          background: white;
          color: #10264b;
          font-size: 13px;
          font-weight: 600;
          outline: none;
        }

        .cp-red-table-head,
        .cp-red-item {
          display: grid;
          grid-template-columns:
            minmax(240px, 2.1fr)
            minmax(125px, 1fr)
            minmax(105px, .8fr)
            minmax(165px, 1.25fr)
            90px;
          align-items: center;
          gap: 15px;
        }

        .cp-red-table-head {
          padding: 16px 20px;
          background: #f3f6fb;
          border-radius: 11px;
          font-size: 12px;
          font-weight: 800;
          color: #263d60;
          margin-bottom: 10px;
        }

        .cp-red-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .cp-red-item {
          padding: 17px 20px;
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          background: #fff;
          transition: border-color .15s, box-shadow .15s;
        }

        .cp-red-item:hover {
          border-color: #bdd2fa;
          box-shadow: 0 5px 15px rgba(15,39,83,.04);
        }

        .cp-red-reward {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .cp-red-reward-image {
          width: 64px;
          height: 64px;
          flex: 0 0 64px;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #edf3ff;
          border-radius: 11px;
          font-size: 29px;
        }

        .cp-red-reward-image.large {
          width: 105px;
          height: 105px;
          flex-basis: 105px;
          font-size: 45px;
        }

        .cp-red-reward-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cp-red-reward-name {
          min-width: 0;
        }

        .cp-red-reward-name h3 {
          margin: 0 0 5px;
          font-size: 14px;
          font-weight: 800;
          color: #10264b;
          overflow-wrap: anywhere;
        }

        .cp-red-reward-name p {
          margin: 0 0 4px;
          font-size: 12px;
          color: #64748b;
        }

        .cp-red-reward-name small {
          color: #2563eb;
          font-size: 11px;
          font-weight: 600;
        }

        .cp-red-date strong,
        .cp-red-points strong {
          display: block;
          font-size: 13px;
          font-weight: 800;
          color: #10264b;
        }

        .cp-red-date span,
        .cp-red-points span {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          color: #7b8ba4;
        }

        .cp-red-points strong {
          color: #2563eb;
        }

        .cp-red-points.bonus strong {
          color: #16a34a;
        }

        .cp-red-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 11px;
          border-radius: 30px;
          font-size: 11px;
          line-height: 1.35;
          font-weight: 800;
          max-width: 100%;
        }

        .cp-red-status-icon {
          font-size: 15px;
          flex-shrink: 0;
        }

        .cp-red-view {
          padding: 10px 14px;
          border: 1px solid #cfe0ff;
          background: white;
          border-radius: 8px;
          color: #2563eb;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .cp-red-view:hover {
          background: #eff6ff;
        }

        .cp-red-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 22px;
          color: #64748b;
          font-size: 12px;
        }

        .cp-red-clear {
          border: none;
          background: transparent;
          color: #2563eb;
          cursor: pointer;
          font-weight: 700;
        }

        .cp-red-empty {
          display: flex;
          align-items: center;
          flex-direction: column;
          text-align: center;
          padding: 60px 20px;
        }

        .cp-red-empty-icon {
          width: 75px;
          height: 75px;
          display: grid;
          place-items: center;
          background: #edf4ff;
          border-radius: 50%;
          font-size: 33px;
          margin-bottom: 15px;
        }

        .cp-red-empty h3 {
          font-size: 17px;
          margin: 0 0 7px;
        }

        .cp-red-empty p {
          margin: 0;
          font-size: 13px;
          color: #71819a;
          line-height: 1.6;
        }

        .cp-red-error {
          margin-bottom: 15px;
          padding: 14px;
          border-radius: 10px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
          border: 1px solid #fecaca;
        }

       

        
       

       
        
       

       

        

        

       

      

       
       

        .cp-red-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          padding: 14px 20px;
          border-radius: 10px;
          color: white;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 10px 30px rgba(0,0,0,.15);
          max-width: 350px;
        }
        

        
.cp-red-modal-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.cp-red-modal-panel {
  min-width: 0;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.cp-red-modal-panel.claim-panel {
  background: #f5f9ff;
  border-color: #dbeafe;
}

.cp-red-modal-panel h4 {
  margin: 0 0 15px;
  font-size: 15px;
  font-weight: 800;
  color: #10264b;
}

.cp-red-claim-field {
  margin-top: 15px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #dbeafe;
  border-radius: 11px;
}

.cp-red-claim-field span {
  display: block;
  margin-bottom: 9px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.cp-red-claim-field strong {
  display: block;
  color: #10264b;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 700px) {
  .cp-red-modal-columns {
    grid-template-columns: 1fr;
  }

  .cp-red-modal-panel {
    padding: 16px;
  }
}


        @media (max-width: 1200px) {
          .cp-red-stats {
            grid-template-columns: repeat(2, minmax(0,1fr));
          }

          .cp-red-table-head {
            display: none;
          }

          .cp-red-item {
            grid-template-columns: minmax(0,1fr) auto;
            gap: 14px;
          }

          .cp-red-reward {
            grid-column: 1 / -1;
          }

          .cp-red-view {
            justify-self: end;
          }
        }

        @media (max-width: 650px) {
          .cp-red-page {
            padding: 16px 12px 40px;
          }

          .cp-red-hero {
            padding: 26px 21px;
            align-items: flex-start;
            flex-direction: column;
          }

          .cp-red-hero h1 {
            font-size: 28px;
          }

          .cp-red-stats {
            gap: 10px;
          }

          .cp-red-stat {
            padding: 14px 11px;
            gap: 10px;
          }

          .cp-red-stat-icon {
            width: 38px;
            height: 38px;
            flex-basis: 38px;
            font-size: 19px;
          }

          .cp-red-stat-info span {
            font-size: 10px;
          }

          .cp-red-stat-info strong {
            font-size: 23px;
          }

          .cp-red-stat-info small {
            font-size: 9px;
          }

          .cp-red-content {
            padding: 17px 13px;
          }

          .cp-red-filters {
            grid-template-columns: 1fr;
          }

          .cp-red-item {
            padding: 15px 12px;
          }

          .cp-red-status {
            font-size: 10px;
          }

          .cp-red-modal-head,
          .cp-red-modal-body,
          .cp-red-modal-footer {
            padding-left: 18px;
            padding-right: 18px;
          }

          .cp-red-modal-reward {
            gap: 10px;
          }

          .cp-red-reward-image.large {
            width: 75px;
            height: 75px;
            flex-basis: 75px;
          }
        }


/* MY REDEMPTIONS BANNER TEXT FIX */

.cp-red-page .cp-red-hero .cp-red-eyebrow {
  color: #1550a4 !important;
}

.cp-red-page .cp-red-hero h1 {
  color: #123d7a !important;
}

.cp-red-page .cp-red-hero p {
  color: #31577e !important;
}

      `}</style>

      {toast && (
        <div
          role="status"
          className="cp-red-toast"
          style={{
            background:
              toast.type === "error"
                ? "#dc2626"
                : "#16a34a",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* BLUE HEADER */}
      <section className="cp-red-hero">
        <div className="cp-red-hero-content">
          <span className="cp-red-eyebrow">
            CITIZEN REWARD MANAGEMENT
          </span>
          <h1>My Redemptions</h1>
          <p>
            Track your reward requests, claim approved
            rewards, and view your earned benefits.
          </p>
        </div>

        <button
          type="button"
          className="cp-red-refresh"
          disabled={refreshing}
          onClick={async () => {
            await fetchMyRedemptions(true);
          }}
        >
          <span>↻</span>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {/* SUMMARY CARDS */}
      <section className="cp-red-stats">
        {summaryCards.map((card) => (
          <button
            key={card.label}
            type="button"
            className={`cp-red-stat ${
              activeTab === card.tab ? "active" : ""
            }`}
            onClick={() => changeTab(card.tab)}
          >
            <div
              className={`cp-red-stat-icon ${card.className}`}
            >
              {card.icon}
            </div>

            <div className="cp-red-stat-info">
              <span>{card.label}</span>
              <strong>{card.count}</strong>
              <small>{card.description}</small>
            </div>
          </button>
        ))}
      </section>

      {/* REDEMPTION HISTORY */}
      <section className="cp-red-content">
        <div className="cp-red-section-heading">
          <div>
            <h2>Redemption History</h2>
            <p>
              View and monitor all your reward transactions
              and earned benefits.
            </p>
          </div>

          <span className="cp-red-count">
            {filteredRedemptions.length} Results
          </span>
        </div>

        {/* TABS */}
        <div className="cp-red-tabs">
          {[
            ["all", "All Activity"],
            ["pending", "Pending"],
            ["ready", "Ready to Claim"],
            ["completed", "Completed"],
            ["benefits", `Earned Benefits (${summary.benefits})`],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`cp-red-tab ${
                activeTab === value ? "active" : ""
              }`}
              onClick={() => changeTab(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* SEARCH AND FILTER */}
        <div className="cp-red-filters">
          <label className="cp-red-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search reward name, category, or partner..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
            />
          </label>

          <select
            className="cp-red-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Ready to Claim</option>
            <option value="confirmed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="benefit">Earned Benefits</option>
          </select>
        </div>

        {error && (
          <div className="cp-red-error" role="alert">
            <strong>Unable to load redemptions.</strong>
            <div style={{ marginTop: 5 }}>{error}</div>
            <button
              type="button"
              onClick={() => fetchMyRedemptions()}
              style={{
                marginTop: 10,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* TABLE HEADER */}
        <div className="cp-red-table-head">
          <span>Reward Details</span>
          <span>Date & Time</span>
          <span>Points</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {/* REDEMPTION ITEMS */}
        {loading ? (
          <div className="cp-red-empty">
            <div className="cp-red-empty-icon">◷</div>
            <h3>Loading your redemptions...</h3>
            <p>Please wait while we retrieve your records.</p>
          </div>
        ) : filteredRedemptions.length === 0 ? (
          <div className="cp-red-empty">
            <div className="cp-red-empty-icon">🎁</div>
            <h3>
              {error
                ? "Records unavailable"
                : redemptions.length === 0
                ? "No redemptions yet"
                : "No matching redemptions"}
            </h3>
            <p>
              {error
                ? "Please try refreshing your records."
                : redemptions.length === 0
                ? "Your redeemed rewards and earned benefits will appear here."
                : "Try changing your search, tab, or status filter."}
            </p>
          </div>
        ) : (
          <div className="cp-red-list">
            {filteredRedemptions.map((item, index) => {
              const keyValue = `${
                item.record_type || "redemption"
              }-${item.id ?? item.redemption_id ?? index}`;

              return (
                <article className="cp-red-item" key={keyValue}>
                  <div className="cp-red-reward">
                    <RewardImage item={item} />

                    <div className="cp-red-reward-name">
                      <h3>
                        {item.reward_name || "Unnamed Reward"}
                      </h3>
                      <p>{item.category || "Reward"}</p>
                      <small>{getOwner(item)}</small>
                    </div>
                  </div>

                  <div className="cp-red-date">
                    <strong>
                      {formatDate(getDateValue(item))}
                    </strong>
                    <span>
                      {formatTime(getDateValue(item))}
                    </span>
                  </div>

                  <div
                    className={`cp-red-points ${
                      isBonus(item) ? "bonus" : ""
                    }`}
                  >
                    <strong>{getPoints(item)}</strong>
                    <span>
                      {isBonus(item)
                        ? "Bonus points"
                        : "Smart Points"}
                    </span>
                  </div>

                  <div>
                    <StatusBadge item={item} />
                  </div>

                  <div>
                    <button
                      type="button"
                      className="cp-red-view"
                      onClick={() =>
                        setSelectedRedemption(item)
                      }
                    >
                      View Details
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="cp-red-footer">
          <span>
            Showing {filteredRedemptions.length} of{" "}
            {redemptions.length} activities
          </span>

          {(searchTerm ||
            statusFilter !== "all" ||
            activeTab !== "all") && (
            <button
              type="button"
              className="cp-red-clear"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setActiveTab("all");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </section>

    
      {/* DETAILS MODAL */}
      {selectedRedemption && (
        <div
          className="cp-red-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRedemption(null);
            }
          }}
        >
          <div
            className="cp-red-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Redemption Details"
          >
            {/* MODAL HEADER */}
            <div className="cp-red-modal-head">
              <div>
                <span>REWARD INFORMATION</span>
                <h2>Redemption Details</h2>
              </div>

              <button
                type="button"
                className="cp-red-close"
                onClick={() => setSelectedRedemption(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="cp-red-modal-body">
              <div className="cp-red-modal-columns">

                {/* LEFT: REWARD INFORMATION */}
                <section className="cp-red-modal-panel">
                  <h4>Reward Information</h4>

                  {[
                    [
                      "Reward",
                      selectedRedemption.reward_name ||
                        "Unnamed Reward",
                    ],
                    [
                      "Category",
                      selectedRedemption.category || "N/A",
                    ],
                    [
                      "Managed By",
                      getOwner(selectedRedemption),
                    ],
                    [
                      isBonus(selectedRedemption)
                        ? "Points Earned"
                        : "Points Cost",
                      `${getPoints(selectedRedemption)} points`,
                    ],
                    [
                      "Date Requested",
                      formatDate(
                        getDateValue(selectedRedemption)
                      ),
                    ],
                    [
                      "Time",
                      formatTime(
                        getDateValue(selectedRedemption)
                      ) || "—",
                    ],
                    [
                      "Last Updated",
                      formatDate(
                        selectedRedemption.updated_at
                      ),
                    ],
                    ...(
                      !isBonus(selectedRedemption) &&
                      selectedRedemption.redemption_id != null
                        ? [[
                            "Redemption ID",
                            `#${selectedRedemption.redemption_id}`,
                          ]]
                        : []
                    ),
                  ].map(([label, value]) => (
                    <div
                      className="cp-red-detail"
                      key={label}
                    >
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </section>

                {/* RIGHT: CLAIM INFORMATION */}
                <section className="cp-red-modal-panel claim-panel">
                  <h4>
                    {isBonus(selectedRedemption)
                      ? "Benefit Information"
                      : "Claim Information"}
                  </h4>

                  {isBonus(selectedRedemption) ? (
                    <div className="cp-red-claim-note">
                      <strong>Benefit Earned</strong>
                      <p>
                        Your bonus points have been credited
                        to your account. No physical claiming
                        is required.
                      </p>
                    </div>
                  ) : [
                      "approved",
                      "confirmed",
                      "completed",
                      "claimed",
                    ].includes(
                      String(
                        selectedRedemption.status || ""
                      ).toLowerCase()
                    ) ? (
                    <>
                      <div className="cp-red-claim-note">
                        <strong>
                          {String(
                            selectedRedemption.status
                          ).toLowerCase() === "approved"
                            ? "✓ Your reward is ready to claim"
                            : "✓ Reward claim completed"}
                        </strong>
                        <p>
                          {String(
                            selectedRedemption.status
                          ).toLowerCase() === "approved"
                            ? "Follow the instructions below to claim your reward."
                            : "This reward redemption has been completed."}
                        </p>
                      </div>

                      {/* CLAIM LOCATION */}
                      <div className="cp-red-claim-field">
                        <span>WHERE TO CLAIM</span>
                        <strong>
                          {selectedRedemption.claim_location ||
                            "Claim location not provided yet."}
                        </strong>
                      </div>

                      {/* CLAIM INSTRUCTIONS */}
                      <div className="cp-red-claim-field">
                        <span>CLAIM INSTRUCTIONS</span>
                        <strong>
                          {selectedRedemption.claim_instructions ||
                            "Claim instructions not provided yet."}
                        </strong>
                      </div>
                    </>
                  ) : String(
                      selectedRedemption.status || ""
                    ).toLowerCase() === "pending" ? (
                    <div className="cp-red-claim-note">
                      <strong>◷ Request Under Review</strong>
                      <p>
                        Your redemption request is waiting
                        for approval. Claim information will
                        appear once approved.
                      </p>
                    </div>
                  ) : (
                    <div className="cp-red-claim-note">
                      <strong>Redemption Status</strong>
                      <p>
                        Claim information is unavailable
                        for this redemption request.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="cp-red-modal-footer">
              <button
                type="button"
                onClick={() => setSelectedRedemption(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

export default MyRedemptionsPage;
