import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

function PartnerRedemptionsPage() {
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // REDEMPTION APPROVAL DETAILS
const [approvalModal, setApprovalModal] = useState(null);

const [approvalLocation, setApprovalLocation] =
  useState('');

const [approvalInstructions, setApprovalInstructions] =
  useState('');

const [approvalError, setApprovalError] =
  useState('');

const [approving, setApproving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Confirm Claim modal
  const [claimModal, setClaimModal] = useState(null);
  const [confirmingClaim, setConfirmingClaim] = useState(false);

  // =====================================================
  // LOAD REDEMPTIONS
  // =====================================================

 

 const fetchRedemptions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(
        '/rewards/partner/redemptions'
      );

      setRedemptions(
        response.data.redemptions || []
      );
    } catch (err) {
      console.error(
        'LOAD PARTNER REDEMPTIONS ERROR:',
        err
      );

      setError(
        err.response?.data?.message ||
          'Failed to load redemption requests'
      );
       } finally {
      setLoading(false);
    }
  }, []);
    useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);
  // =====================================================
  // APPROVE REDEMPTION
  // =====================================================

  const openApprovalModal = (item) => {
  setApprovalModal(item);
  setApprovalLocation('');
  setApprovalInstructions('');
  setApprovalError('');
};

const closeApprovalModal = () => {
  if (approving) return;

  setApprovalModal(null);
  setApprovalLocation('');
  setApprovalInstructions('');
  setApprovalError('');
};

const handleApprove = async (event) => {
  event.preventDefault();

  if (!approvalModal || approving) return;

  const claimLocation = approvalLocation.trim();
  const claimInstructions = approvalInstructions.trim();

  if (!claimLocation || !claimInstructions) {
    setApprovalError(
      'Please provide both the claim location and claim instructions.'
    );
    return;
  }

  try {
    setApproving(true);
    setApprovalError('');

    await api.post(
      `/rewards/partner/redemptions/${approvalModal.redemption_id}/approve`,
      {
        claim_location: claimLocation,
        claim_instructions: claimInstructions
      }
    );

    setApprovalModal(null);
    setApprovalLocation('');
    setApprovalInstructions('');

    await fetchRedemptions();
  } catch (err) {
    console.error('APPROVE REDEMPTION ERROR:', err);

    setApprovalError(
      err.response?.data?.message ||
        'Failed to approve redemption.'
    );
  } finally {
    setApproving(false);
  }
};

  // =====================================================
  // REJECT REDEMPTION
  // =====================================================

  const handleReject = async (redemptionId) => {
    const confirmed = window.confirm(
      'Are you sure you want to reject this redemption request?'
    );

    if (!confirmed) {
      return;
    }

    try {
      setError('');

      await api.post(
        `/rewards/partner/redemptions/${redemptionId}/reject`
      );

      await fetchRedemptions();
    } catch (err) {
      console.error(
        'REJECT REDEMPTION ERROR:',
        err
      );

      setError(
        err.response?.data?.message ||
          'Failed to reject redemption'
      );
    }
  };

  // =====================================================
  // OPEN CONFIRM CLAIM MODAL
  // =====================================================

  const openClaimModal = (item) => {
    setClaimModal(item);
  };

  const closeClaimModal = () => {
    if (confirmingClaim) {
      return;
    }

    setClaimModal(null);
  };

  // =====================================================
  // CONFIRM PHYSICAL CLAIM
  // =====================================================

  const handleConfirmClaim = async () => {
    if (!claimModal) {
      return;
    }

    try {
      setConfirmingClaim(true);
      setError('');

      await api.post(
        `/rewards/partner/redemptions/${claimModal.redemption_id}/confirm`
      );

      setClaimModal(null);

      await fetchRedemptions();
    } catch (err) {
      console.error(
        'CONFIRM CLAIM ERROR:',
        err
      );

      setError(
        err.response?.data?.message ||
          'Failed to confirm reward claim'
      );

      setClaimModal(null);
    } finally {
      setConfirmingClaim(false);
    }
  };

  // =====================================================
  // COUNTS
  // =====================================================

  const pendingCount = redemptions.filter(
    (item) => item.status === 'pending'
  ).length;

  const readyCount = redemptions.filter(
    (item) => item.status === 'approved'
  ).length;

  const completedCount = redemptions.filter(
    (item) => item.status === 'confirmed'
  ).length;

  const rejectedCount = redemptions.filter(
    (item) => item.status === 'rejected'
  ).length;

  // =====================================================
  // SEARCH + FILTER
  // =====================================================

  const filteredRedemptions = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return redemptions.filter((item) => {
      const citizen = String(
        item.full_name || ''
      ).toLowerCase();

      const reward = String(
        item.reward_name || ''
      ).toLowerCase();

      const matchesSearch =
        !searchValue ||
        citizen.includes(searchValue) ||
        reward.includes(searchValue);

      const matchesStatus =
        statusFilter === 'all' ||
        item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [redemptions, search, statusFilter]);

  // =====================================================
  // STATUS LABEL
  // =====================================================

  const getStatusLabel = (status) => {
    if (status === 'pending') {
      return 'Waiting for Approval';
    }

    if (status === 'approved') {
      return 'Ready to Claim';
    }

    if (status === 'confirmed') {
      return 'Completed';
    }

    if (status === 'rejected') {
      return 'Rejected';
    }

    if (status === 'cancelled') {
      return 'Cancelled';
    }

    return status;
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="partner-redemptions-page">
        <div className="partner-redemptions-loading">
          Loading redemption requests...
        </div>
      </main>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="partner-redemptions-page">

      <section className="partner-redemptions-panel">

        {/* PAGE HEADER */}

        <div className="partner-redemptions-header">

          <div>
            <h1>Redemption Requests</h1>

            <p>
              Review and manage reward redemption
              requests from citizens.
            </p>
          </div>

          <button
            type="button"
            className="partner-redemptions-refresh-btn"
            onClick={fetchRedemptions}
          >
            ↻ Refresh
          </button>

        </div>

        {/* SUMMARY CARDS */}

        <div className="partner-redemption-stats">

          <div className="partner-redemption-stat-card">
            <div className="partner-redemption-stat-icon pending">
              ◷
            </div>

            <div>
              <strong>{pendingCount}</strong>
              <span>Pending Requests</span>
            </div>
          </div>

          <div className="partner-redemption-stat-card">
            <div className="partner-redemption-stat-icon ready">
              ✓
            </div>

            <div>
              <strong>{readyCount}</strong>
              <span>Ready to Claim</span>
            </div>
          </div>

          <div className="partner-redemption-stat-card">
            <div className="partner-redemption-stat-icon completed">
              ✓
            </div>

            <div>
              <strong>{completedCount}</strong>
              <span>Completed</span>
            </div>
          </div>

          <div className="partner-redemption-stat-card">
            <div className="partner-redemption-stat-icon rejected">
              ×
            </div>

            <div>
              <strong>{rejectedCount}</strong>
              <span>Rejected</span>
            </div>
          </div>

        </div>

        {/* SEARCH + FILTER */}

        <div className="partner-redemption-toolbar">

          <div className="partner-redemption-search">

            <span className="partner-redemption-search-icon">
              ⌕
            </span>

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search citizen name or reward..."
            />

          </div>

          <div className="partner-redemption-filter">

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
            >
              <option value="all">
                All Status
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="approved">
                Ready to Claim
              </option>

              <option value="confirmed">
                Completed
              </option>

              <option value="rejected">
                Rejected
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>

          </div>

        </div>

        {/* ERROR */}

        {error && (
          <div className="partner-redemption-error">
            {error}
          </div>
        )}

        {/* EMPTY */}

        {!error &&
          redemptions.length === 0 && (
            <div className="partner-redemption-empty">

              <div className="partner-redemption-empty-icon">
                ◇
              </div>

              <h3>No Redemption Requests</h3>

              <p>
                Redemption requests from citizens will
                appear here.
              </p>

            </div>
          )}

        {/* NO SEARCH RESULTS */}

        {!error &&
          redemptions.length > 0 &&
          filteredRedemptions.length === 0 && (
            <div className="partner-redemption-empty">

              <div className="partner-redemption-empty-icon">
                ⌕
              </div>

              <h3>No Results Found</h3>

              <p>
                Try changing your search or status filter.
              </p>

            </div>
          )}

        {/* TABLE */}

        {!error &&
          filteredRedemptions.length > 0 && (

            <div className="partner-redemption-table-wrap">

              <table className="partner-redemption-table">

                <thead>
                  <tr>
                    <th>Citizen</th>
                    <th>Reward</th>
                    <th>Points</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>

                  {filteredRedemptions.map((item) => (

                    <tr key={item.redemption_id}>

                      {/* CITIZEN */}

                      <td>

                        <div className="partner-redemption-citizen">

                          <div className="partner-redemption-avatar">

                            {item.full_name
                              ?.charAt(0)
                              .toUpperCase() || 'C'}

                          </div>

                          <div>

                            <strong>
                              {item.full_name || 'Citizen'}
                            </strong>

                            <small>
                              Redemption #{item.redemption_id}
                            </small>

                          </div>

                        </div>

                      </td>

                      {/* REWARD */}

                      <td>

                        <div className="partner-redemption-reward">

                          <strong>
                            {item.reward_name || 'Reward'}
                          </strong>

                        </div>

                      </td>

                      {/* POINTS */}

                      <td>

                        <strong className="partner-redemption-points">

                          {Number(
                            item.points_spent || 0
                          ).toLocaleString()}{' '}
                          pts

                        </strong>

                      </td>

                      {/* STATUS */}

                      <td>

                        <span
                          className={`partner-redemption-status ${
                            item.status || ''
                          }`}
                        >
                          {getStatusLabel(item.status)}
                        </span>

                      </td>

                      {/* ACTION */}

                      <td>

                        {item.status === 'pending' && (

                          <div className="partner-redemption-actions">

                            <button
                              type="button"
                              className="partner-redemption-approve-btn"
                            onClick={() => openApprovalModal(item)}
                            >
                              ✓ Approve
                            </button>

                            <button
                              type="button"
                              className="partner-redemption-reject-btn"
                              onClick={() =>
                                handleReject(
                                  item.redemption_id
                                )
                              }
                            >
                              ✕ Reject
                            </button>

                          </div>

                        )}

                        {item.status === 'approved' && (

                          <button
                            type="button"
                            className="partner-redemption-confirm-btn"
                            onClick={() =>
                              openClaimModal(item)
                            }
                          >
                            ✓ Confirm Claim
                          </button>

                        )}

                        {item.status === 'confirmed' && (

                          <span className="partner-redemption-action-done">
                            ✓ Claimed
                          </span>

                        )}

                        {item.status === 'rejected' && (
                          <span className="partner-redemption-no-action">
                            —
                          </span>
                        )}

                        {item.status === 'cancelled' && (
                          <span className="partner-redemption-no-action">
                            —
                          </span>
                        )}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

      </section>
          {/* REDEMPTION APPROVAL MODAL */}

{approvalModal && (
  <div
    className="partner-claim-modal-overlay"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        closeApprovalModal();
      }
    }}
  >
    <div
      className="partner-claim-modal partner-approval-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-approval-title"
    >
      <button
        type="button"
        className="partner-claim-modal-close"
        onClick={closeApprovalModal}
        disabled={approving}
      >
        ×
      </button>

      <div className="partner-claim-modal-icon">
        ✓
      </div>

      <h2 id="partner-approval-title">
        Approve Redemption
      </h2>

      <p className="partner-claim-modal-description">
        Provide the location and instructions
        the citizen will use to claim this reward.
      </p>

      <div className="partner-claim-modal-details">
        <div className="partner-claim-modal-row">
          <span>Citizen</span>
          <strong>
            {approvalModal.full_name || 'Citizen'}
          </strong>
        </div>

        <div className="partner-claim-modal-row">
          <span>Reward</span>
          <strong>
            {approvalModal.reward_name || 'Reward'}
          </strong>
        </div>

        <div className="partner-claim-modal-row">
          <span>Points</span>
          <strong>
            {Number(
              approvalModal.points_spent || 0
            ).toLocaleString()} pts
          </strong>
        </div>

        <div className="partner-claim-modal-row">
          <span>Redemption ID</span>
          <strong>
            #{approvalModal.redemption_id}
          </strong>
        </div>
      </div>

      <form
        className="partner-approval-form"
        onSubmit={handleApprove}
      >
        <label htmlFor="approvalClaimLocation">
          Where to Claim
        </label>

        <input
          id="approvalClaimLocation"
          type="text"
          value={approvalLocation}
          onChange={(event) =>
            setApprovalLocation(event.target.value)
          }
          placeholder="Enter the reward pickup location"
          required
          disabled={approving}
        />

        <label htmlFor="approvalClaimInstructions">
          Claim Instructions
        </label>

        <textarea
          id="approvalClaimInstructions"
          rows={4}
          value={approvalInstructions}
          onChange={(event) =>
            setApprovalInstructions(event.target.value)
          }
          placeholder="Example: Present your redemption ID and a valid ID to our staff."
          required
          disabled={approving}
        />

        {approvalError && (
          <p
            className="partner-approval-error"
            role="alert"
          >
            {approvalError}
          </p>
        )}

        <div className="partner-claim-modal-warning">
          <strong>Important</strong>

          <p>
            Confirming approval will deduct the
            required Smart Points, reduce reward
            stock, and send these claim details
            to the citizen.
          </p>
        </div>

        <div className="partner-claim-modal-actions">
          <button
            type="button"
            className="partner-claim-modal-cancel"
            onClick={closeApprovalModal}
            disabled={approving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="partner-claim-modal-confirm"
            disabled={
              approving ||
              !approvalLocation.trim() ||
              !approvalInstructions.trim()
            }
          >
            {approving
              ? 'Approving...'
              : '✓ Confirm Approval'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
      {/* =================================================
          CONFIRM CLAIM MODAL
          ================================================= */}

      {claimModal && (

        <div
          className="partner-claim-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeClaimModal();
            }
          }}
        >

          <div className="partner-claim-modal">

            <button
              type="button"
              className="partner-claim-modal-close"
              onClick={closeClaimModal}
              disabled={confirmingClaim}
            >
              ×
            </button>

            <div className="partner-claim-modal-icon">
              ✓
            </div>

            <h2>Confirm Reward Claim</h2>

            <p className="partner-claim-modal-description">
              Please confirm that the citizen has
              physically received this reward.
            </p>

            <div className="partner-claim-modal-details">

              <div className="partner-claim-modal-row">
                <span>Citizen</span>

                <strong>
                  {claimModal.full_name || 'Citizen'}
                </strong>
              </div>

              <div className="partner-claim-modal-row">
                <span>Reward</span>

                <strong>
                  {claimModal.reward_name || 'Reward'}
                </strong>
              </div>

              <div className="partner-claim-modal-row">
                <span>Points</span>

                <strong>
                  {Number(
                    claimModal.points_spent || 0
                  ).toLocaleString()}{' '}
                  pts
                </strong>
              </div>

              <div className="partner-claim-modal-row">
                <span>Redemption ID</span>

                <strong>
                  #{claimModal.redemption_id}
                </strong>
              </div>

            </div>

            <div className="partner-claim-modal-warning">

              <strong>Important</strong>

              <p>
                Once confirmed, this redemption will be
                marked as Completed.
              </p>

            </div>

            <div className="partner-claim-modal-actions">

              <button
                type="button"
                className="partner-claim-modal-cancel"
                onClick={closeClaimModal}
                disabled={confirmingClaim}
              >
                Cancel
              </button>

              <button
                type="button"
                className="partner-claim-modal-confirm"
                onClick={handleConfirmClaim}
                disabled={confirmingClaim}
              >
                {confirmingClaim
                  ? 'Confirming...'
                  : '✓ Confirm Claim'}
              </button>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}

export default PartnerRedemptionsPage;