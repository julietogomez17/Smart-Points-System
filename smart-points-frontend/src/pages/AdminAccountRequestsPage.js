
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import api from '../services/api';

const emptySummary = {
  pending: 0,
  approved: 0,
  rejected: 0
};

const getAccountLabel = (type) => {
  if (type === 'citizen') return 'Citizen';
  if (type === 'establishment') return 'Establishment';
  if (type === 'lgu') return 'Lgu Administrator';
  return 'Unknown';
};

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
};

const getDocuments = (account) => {
  if (!account) return [];

  if (account.account_type === 'citizen') {
    return [
      ['id_front', 'Front of Valid ID', 'has_id_front'],
      ['id_back', 'Back of Valid ID', 'has_id_back']
    ];
  }

  if (account.account_type === 'establishment') {
    return [
      [
        'business_permit',
        'Business Permit',
        'has_business_permit'
      ],
      [
        'storefront_photo',
        'Storefront Photo',
        'has_storefront_photo'
      ],
      [
        'representative_id',
        'Representative ID',
        'has_representative_id'
      ]
    ];
  }

  if (account.account_type === 'lgu') {
    return [
      ['lgu_loi', 'Signed Letter of Intent', 'has_lgu_loi'],
      ['lgu_id', 'Representative ID', 'has_lgu_id']
    ];
  }

  return [];
};

function AdminAccountRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(emptySummary);

  const [accountType, setAccountType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [canVerifyCitizens, setCanVerifyCitizens] = useState(false);
  const [canVerifyPartners, setCanVerifyPartners] = useState(false);

  const [documentPreview, setDocumentPreview] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // ====================================================
  // LOAD ACCOUNT REQUESTS
  // ====================================================

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const baseResponse = await api.get(
        '/admin/account-requests'
      );

      const baseRequests = baseResponse.data.requests || [];

      let lguRequests = [];
      let superAdminAccess = false;
      let lguLoadError = '';

      try {
        // The backend authorizes only the designated
        // City Super Admin to access this endpoint.
        const lguResponse = await api.get(
          '/admin/account-requests/lgu/list'
        );

        superAdminAccess = true;
        lguRequests = lguResponse.data.requests || [];
      } catch (lguError) {
        if (lguError.response?.status === 403) {
          // An ordinary authorized verifier cannot
          // access LGU registration applications.
          superAdminAccess = false;
        } else {
          // Do not silently hide genuine server errors.
          lguLoadError =
            lguError.response?.data?.message ||
            'Unable to load LGU registration requests.';
        }
      }

      const combined = [
        ...baseRequests,
        ...lguRequests
      ];

      combined.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

      setRequests(combined);
      setIsSuperAdmin(superAdminAccess);

      if (!superAdminAccess) {
        setAccountType((previous) =>
          previous === 'lgu' ? 'all' : previous
        );
      }

      setSummary({
        pending: combined.filter(
          (item) => item.status === 'pending'
        ).length,
        approved: combined.filter(
          (item) => item.status === 'approved'
        ).length,
        rejected: combined.filter(
          (item) => item.status === 'rejected'
        ).length
      });

      if (lguLoadError) {
        setError(lguLoadError);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to load account requests.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // ====================================================
  // CLOSE REVIEW MODAL
  // ====================================================

  const closeReview = () => {
    if (documentPreview?.url) {
      URL.revokeObjectURL(documentPreview.url);
    }

    setDocumentPreview(null);
    setSelectedAccount(null);
    setReviewError('');
    setShowRejectForm(false);
    setRejectionReason('');
    setCanVerifyCitizens(false);
    setCanVerifyPartners(false);
  };

  // ====================================================
  // OPEN ACCOUNT REVIEW
  // ====================================================

  const openReview = async (request) => {
    if (reviewLoading || decisionLoading) return;

    if (documentPreview?.url) {
      URL.revokeObjectURL(documentPreview.url);
    }

    setDocumentPreview(null);
    setSelectedAccount(null);
    setReviewError('');
    setShowRejectForm(false);
    setRejectionReason('');
    setCanVerifyCitizens(false);
    setCanVerifyPartners(false);

    setReviewLoading(true);

    try {
      const response = await api.get(
        `/admin/account-requests/${request.account_type}/${request.id}`
      );

      const account = response.data.account;

      if (!account) {
        throw new Error('Account details were not returned.');
      }

      setSelectedAccount(account);

      if (account.account_type === 'lgu') {
        setCanVerifyCitizens(
          Number(account.can_verify_citizens) === 1
        );

        setCanVerifyPartners(
          Number(account.can_verify_partners) === 1
        );
      }
    } catch (err) {
      setReviewError(
        err.response?.data?.message ||
        err.message ||
        'Unable to load account details.'
      );
    } finally {
      setReviewLoading(false);
    }
  };

  // ====================================================
  // DOCUMENT PREVIEW
  // ====================================================

  const openDocument = async (documentType) => {
    if (!selectedAccount) return;

    setReviewError('');

    try {
      const response = await api.get(
        `/admin/account-requests/${selectedAccount.account_type}/${selectedAccount.id}/documents/${documentType}`,
        { responseType: 'blob' }
      );

      const blob = response.data;
      const url = URL.createObjectURL(blob);

      setDocumentPreview((previous) => {
        if (previous?.url) {
          URL.revokeObjectURL(previous.url);
        }

        return {
          url,
          mime: blob.type,
          name: documentType.replaceAll('_', ' ')
        };
      });
    } catch (err) {
      setReviewError(
        err.response?.status === 403
          ? 'You do not have permission to view this document.'
          : 'Unable to open the selected document.'
      );
    }
  };

  // ====================================================
  // APPROVE OR REJECT
  // ====================================================

  const submitDecision = async (decision) => {
    if (!selectedAccount || decisionLoading) return;

    if (
      decision === 'reject' &&
      (
        rejectionReason.trim().length < 5 ||
        rejectionReason.trim().length > 1000
      )
    ) {
      setReviewError(
        'Enter a rejection reason between 5 and 1000 characters.'
      );
      return;
    }

    if (decision === 'approve') {
      const confirmed = window.confirm(
        `Approve the account of ${selectedAccount.full_name}?`
      );

      if (!confirmed) return;
    }

    const isLGU = selectedAccount.account_type === 'lgu';

    let payload = {};

    if (decision === 'reject') {
      payload = {
        reason: rejectionReason.trim()
      };
    } else if (isLGU) {
      payload = {
        can_verify_citizens:
          selectedAccount.lgu_level === 'barangay'
            ? canVerifyCitizens
            : false,
        can_verify_partners:
          selectedAccount.lgu_level === 'city'
            ? canVerifyPartners
            : false
      };
    }

    setDecisionLoading(true);
    setReviewError('');
    setSuccessMessage('');

    try {
      await api.patch(
        `/admin/account-requests/${selectedAccount.account_type}/${selectedAccount.id}/${decision}`,
        payload
      );

      closeReview();

      setSuccessMessage(
        decision === 'approve'
          ? 'Account approved successfully.'
          : 'Account rejected successfully.'
      );

      await loadRequests();
    } catch (err) {
      setReviewError(
        err.response?.data?.message ||
        'Unable to process account request.'
      );
    } finally {
      setDecisionLoading(false);
    }
  };

  // ====================================================
  // FILTER REQUESTS
  // ====================================================

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesType =
        accountType === 'all' ||
        request.account_type === accountType;

      const matchesStatus =
        statusFilter === 'all' ||
        request.status === statusFilter;

      const searchable = [
        request.full_name,
        request.email,
        request.organization_name,
        request.barangay,
        request.lgu_office,
        request.lgu_level
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        matchesType &&
        matchesStatus &&
        searchable.includes(search.toLowerCase().trim())
      );
    });
  }, [requests, accountType, statusFilter, search]);

  const unassignedCitizens = requests.filter(
    (request) =>
      request.account_type === 'citizen' &&
      request.status === 'pending' &&
      request.needs_super_admin_attention === true
  ).length;

  const isLGUReview =
    selectedAccount?.account_type === 'lgu';

  // ====================================================
  // PAGE
  // ====================================================

  return (
    <main className="admin-ref-dashboard">

      {/* HEADER */}
      <section className="admin-ref-welcome">
        <div className="admin-ref-welcome-content">
          <span className="admin-ref-welcome-small">
            ACCOUNT MANAGEMENT
          </span>

          <h1>Account Requests</h1>

          <p>
            Review registrations, verify submitted documents,
            and manage authorized account approvals.
          </p>
        </div>

        <div className="admin-ref-welcome-message">
          <span>Secure Verification</span>
          <strong>Trusted Citizens</strong>
          <span>Verified Establishments & LGUs</span>
        </div>
      </section>

      {/* SUMMARY CARDS */}
      <section className="admin-ref-summary-grid">
        {[
          {
            label: 'Pending Requests',
            value: summary.pending,
            color: 'orange',
            description: 'Awaiting verification'
          },
          {
            label: 'Approved Accounts',
            value: summary.approved,
            color: 'blue',
            description: 'Verified registrations'
          },
          {
            label: 'Rejected Requests',
            value: summary.rejected,
            color: 'red',
            description: 'Declined registrations'
          }
        ].map((item) => (
          <article
            className="admin-ref-summary-card"
            key={item.label}
          >
            <div className={`admin-ref-summary-icon ${item.color}`}>
              {item.color === 'orange'
                ? '◷'
                : item.color === 'blue'
                  ? '✓'
                  : '×'}
            </div>

            <div className="admin-ref-summary-info">
              <span>{item.label}</span>
              <strong>
                {Number(item.value).toLocaleString()}
              </strong>
              <small>{item.description}</small>
            </div>
          </article>
        ))}
      </section>

      {/* FEEDBACK */}
      {successMessage && (
        <p
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: '#e9f7ef',
            color: '#216e3f',
            marginBottom: 16
          }}
        >
          {successMessage}
        </p>
      )}

      {/* UNASSIGNED CITIZEN REQUESTS */}
      {isSuperAdmin && unassignedCitizens > 0 && (
        <section
          className="admin-ref-card"
          style={{ marginBottom: 20 }}
        >
          <h3>Citizen Requests Needing LGU Assignment</h3>

          <p>
            {unassignedCitizens} pending citizen request(s)
            belong to barangays without an authorized
            Citizen Account Verifier.
          </p>

          <button
            type="button"
            className="account-review-button"
            onClick={() => {
              setAccountType('citizen');
              setStatusFilter('pending');
              setSearch('');
            }}
          >
            View Citizen Requests
          </button>
        </section>
      )}

      {/* REGISTRATION TABLE */}
      <section className="admin-ref-card">
        <div className="admin-ref-card-header">
          <h2>Registration Requests</h2>
          <span>{filteredRequests.length} results</span>
        </div>

        <div className="account-requests-filters">
          <input
            type="search"
            placeholder="Search name, email, office, barangay..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search account requests"
          />

          <select
            value={accountType}
            onChange={(event) => setAccountType(event.target.value)}
            aria-label="Filter account type"
          >
            <option value="all">All Account Types</option>
            <option value="citizen">Citizens</option>
            <option value="establishment">Establishments</option>

            {isSuperAdmin && (
              <option value="lgu">
                LGU Representatives
              </option>
            )}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter request status"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            type="button"
            className="account-review-button"
            onClick={loadRequests}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {error && (
          <p role="alert" className="account-requests-error">
            {error}
          </p>
        )}

        {loading ? (
          <div className="admin-ref-empty">
            Loading account requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="admin-ref-empty">
            <strong>No matching requests</strong>
            <span>
              Try another account type, status, or search term.
            </span>
          </div>
        ) : (
          <div className="admin-ref-table-wrap">
            <table className="admin-ref-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Account Type</th>
                  <th>Barangay / Office</th>
                  <th>Date Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => (
                  <tr
                    key={`${request.account_type}-${request.id}`}
                  >
                    <td>
                      <strong>
                        {request.full_name || '—'}
                      </strong>

                      <div className="account-requests-muted">
                        {request.organization_name && (
                          <div>
                            {request.organization_name}
                          </div>
                        )}

                        <div>{request.email || '—'}</div>
                      </div>
                    </td>

                    <td>
                      {getAccountLabel(request.account_type)}

                      {request.account_type === 'lgu' && (
                        <div className="account-requests-muted">
                          {request.lgu_level === 'city'
                            ? 'City Government'
                            : 'Barangay Government'}
                        </div>
                      )}
                    </td>

                    <td>
                      {request.account_type === 'lgu'
                        ? request.lgu_level === 'barangay'
                          ? request.lgu_barangay || '—'
                          : request.lgu_office || '—'
                        : request.barangay || '—'}

                      {request.account_type === 'lgu' &&
                        request.lgu_level === 'barangay' && (
                          <div className="account-requests-muted">
                            {request.lgu_office}
                          </div>
                        )}

                      {isSuperAdmin &&
                        request.needs_super_admin_attention && (
                          <div
                            style={{
                              color: '#a36b00',
                              fontSize: 12,
                              marginTop: 4
                            }}
                          >
                            No authorized barangay verifier
                          </div>
                        )}
                    </td>

                    <td>{formatDate(request.created_at)}</td>

                    <td>
                      <span
                        className={`account-requests-status ${
                          request.status || 'pending'
                        }`}
                      >
                        {request.status || 'Pending'}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="account-review-button"
                        onClick={() => openReview(request)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* LOADING MODAL */}
      {reviewLoading && (
        <div className="account-review-overlay">
          <div className="account-review-modal">
            <p>Loading registration details...</p>
          </div>
        </div>
      )}

      {/* ERROR MODAL */}
      {reviewError && !selectedAccount && !reviewLoading && (
        <div className="account-review-overlay">
          <div className="account-review-modal">
            <h2>Unable to Open Request</h2>
            <p role="alert">{reviewError}</p>

            <button type="button" onClick={closeReview}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {selectedAccount && (
        <div className="account-review-overlay">
          <div
            className="account-review-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Account verification details"
          >

            <div className="account-review-header">
              <div>
                <h2>Account Verification</h2>

                <p>
                  {getAccountLabel(
                    selectedAccount.account_type
                  )} Registration
                </p>
              </div>

              <button
                type="button"
                onClick={closeReview}
                disabled={decisionLoading}
                aria-label="Close review"
              >
                ✕
              </button>
            </div>

            {/* APPLICANT INFORMATION */}
            <h3>Applicant Information</h3>

            <div className="account-review-details">
              {[
                ['Full Name', selectedAccount.full_name],
                ['Email Address', selectedAccount.email],
                ['Phone Number', selectedAccount.phone],
                [
                  'Date of Birth',
                  formatDate(selectedAccount.date_of_birth)
                ],
                [
                  'Registration Status',
                  ['active', 'verified', 'approved'].includes(
                    selectedAccount.status
                  )
                    ? 'Approved'
                    : selectedAccount.status
                ]
              ].map(([label, value]) => (
                <div key={label}>
                  <label>{label}</label>
                  <strong>{value || '—'}</strong>
                </div>
              ))}
            </div>

            {/* CITIZEN INFORMATION */}
            {selectedAccount.account_type === 'citizen' && (
              <>
                <h3>Citizen Information</h3>

                <div className="account-review-details">
                  <div>
                    <label>Barangay</label>
                    <strong>
                      {selectedAccount.barangay || '—'}
                    </strong>
                  </div>

                  <div>
                    <label>Residential Address</label>
                    <strong>
                      {selectedAccount.address || '—'}
                    </strong>
                  </div>

                  <div>
                    <label>Government ID Type</label>
                    <strong>
                      {selectedAccount.id_type || '—'}
                    </strong>
                  </div>
                </div>
              </>
            )}

            {/* ESTABLISHMENT INFORMATION */}
            {selectedAccount.account_type === 'establishment' && (
              <>
                <h3>Establishment Information</h3>

                <div className="account-review-details">
                  <div>
                    <label>Business Name</label>
                    <strong>
                      {selectedAccount.organization_name || '—'}
                    </strong>
                  </div>

                  <div>
                    <label>Business Permit Number</label>
                    <strong>
                      {selectedAccount.business_permit_number || '—'}
                    </strong>
                  </div>

                  <div>
                    <label>Business Barangay</label>
                    <strong>
                      {selectedAccount.business_barangay || '—'}
                    </strong>
                  </div>

                  <div>
                    <label>Business Address</label>
                    <strong>
                      {selectedAccount.business_address || '—'}
                    </strong>
                  </div>

                  <div>
                    <label>Representative ID Type</label>
                    <strong>
                      {selectedAccount.representative_id_type || '—'}
                    </strong>
                  </div>
                </div>
              </>
            )}

            {/* LGU INFORMATION */}
            {isLGUReview && (
              <>
                <h3>LGU Office Information</h3>

                <div className="account-review-details">
                  {[
                    [
                      'LGU Level',
                      selectedAccount.lgu_level === 'city'
                        ? 'City Government'
                        : 'Barangay Government'
                    ],
                    [
                      'Barangay',
                      selectedAccount.lgu_barangay ||
                        'Not applicable'
                    ],
                    [
                      'Office / Department',
                      selectedAccount.lgu_office
                    ],
                    [
                      'Official Address',
                      selectedAccount.lgu_office_address
                    ],
                    [
                      'Office Contact',
                      selectedAccount.lgu_office_contact
                    ],
                    [
                      'Representative Designation',
                      selectedAccount.lgu_designation
                    ]
                  ].map(([label, value]) => (
                    <div key={label}>
                      <label>{label}</label>
                      <strong>{value || '—'}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* SUBMITTED DOCUMENTS */}
            <h3>Submitted Documents</h3>

            <div className="account-review-documents">
              {getDocuments(selectedAccount).map(
                ([key, label, exists]) => (
                  <button
                    key={key}
                    type="button"
                    disabled={!selectedAccount[exists]}
                    onClick={() => openDocument(key)}
                  >
                    <span>📄</span>
                    <strong>{label}</strong>

                    <small>
                      {selectedAccount[exists]
                        ? 'View Document'
                        : 'Not Submitted'}
                    </small>
                  </button>
                )
              )}
            </div>

            {/* DOCUMENT PREVIEW */}
            {documentPreview && (
              <div className="account-document-preview">
                <div className="account-document-heading">
                  <strong>{documentPreview.name}</strong>

                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(
                        documentPreview.url
                      );
                      setDocumentPreview(null);
                    }}
                  >
                    Close Preview
                  </button>
                </div>

                {documentPreview.mime === 'application/pdf' ? (
                  <iframe
                    src={documentPreview.url}
                    title="Verification document"
                  />
                ) : (
                  <img
                    src={documentPreview.url}
                    alt={documentPreview.name}
                  />
                )}
              </div>
            )}

            {/* LGU PERMISSION ASSIGNMENT */}
            {isLGUReview &&
              selectedAccount.status === 'pending' && (
                <div
                  className="account-review-permissions"
                  style={{
                    marginTop: 22,
                    padding: 18,
                    border: '1px solid #dbe5f1',
                    borderRadius: 12
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    Assign Verification Permissions
                  </h3>

                  <p>
                    The representative can only verify
                    account types authorized by the City
                    Super Admin.
                  </p>

                  {selectedAccount.lgu_level === 'barangay' && (
                    <label
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        marginBottom: 14
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={canVerifyCitizens}
                        onChange={(event) =>
                          setCanVerifyCitizens(
                            event.target.checked
                          )
                        }
                        disabled={decisionLoading}
                      />

                      <span>
                        <strong>
                          Allow Citizen Account Verification
                        </strong>

                        <small
                          style={{
                            display: 'block',
                            marginTop: 5
                          }}
                        >
                          Verify citizens registered under
                          Barangay {selectedAccount.lgu_barangay}.
                        </small>
                      </span>
                    </label>
                  )}

                  {selectedAccount.lgu_level === 'city' && (
                    <label
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        marginBottom: 14
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={canVerifyPartners}
                        onChange={(event) =>
                          setCanVerifyPartners(
                            event.target.checked
                          )
                        }
                        disabled={decisionLoading}
                      />

                      <span>
                        <strong>
                          Allow Establishment  Verification
                        </strong>

                        <small
                          style={{
                            display: 'block',
                            marginTop: 5
                          }}
                        >
                          Review and approve establishment
                          registrations.
                        </small>
                      </span>
                    </label>
                  )}

                  <p style={{ fontSize: 13 }}>
                    These permissions are optional.
                    An LGU account can be approved without
                    being authorized to verify registrations.
                  </p>
                </div>
              )}

            {/* EXISTING PERMISSIONS FOR REVIEWED LGU */}
            {isLGUReview &&
              selectedAccount.status !== 'pending' && (
                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    border: '1px solid #dbe5f1',
                    borderRadius: 10
                  }}
                >
                  <h3>Assigned Verification Permissions</h3>

                  <p>
                    Citizen Verification:{' '}
                    <strong>
                      {Number(
                        selectedAccount.can_verify_citizens
                      ) === 1
                        ? 'Authorized'
                        : 'Not authorized'}
                    </strong>
                  </p>

                  <p>
                    Partner Verification:{' '}
                    <strong>
                      {Number(
                        selectedAccount.can_verify_partners
                      ) === 1
                        ? 'Authorized'
                        : 'Not authorized'}
                    </strong>
                  </p>
                </div>
              )}

            {/* ERROR MESSAGE */}
            {reviewError && (
              <p
                role="alert"
                className="account-requests-error"
              >
                {reviewError}
              </p>
            )}

            {/* APPROVAL / REJECTION ACTIONS */}
            <div className="account-review-actions">
              {selectedAccount.status === 'pending' ? (
                !showRejectForm ? (
                  <>
                    <button
                      type="button"
                      onClick={closeReview}
                      disabled={decisionLoading}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="account-reject-button"
                      onClick={() => {
                        setShowRejectForm(true);
                        setReviewError('');
                      }}
                      disabled={decisionLoading}
                    >
                      Reject Account
                    </button>

                    <button
                      type="button"
                      className="account-approve-button"
                      onClick={() =>
                        submitDecision('approve')
                      }
                      disabled={decisionLoading}
                    >
                      {decisionLoading
                        ? 'Processing...'
                        : 'Approve Account'}
                    </button>
                  </>
                ) : (
                  <div className="account-rejection-form">
                    <h3>Reject Account Request</h3>

                    <p>
                      Please provide a reason for rejecting
                      this account.
                    </p>

                    <textarea
                      value={rejectionReason}
                      onChange={(event) =>
                        setRejectionReason(
                          event.target.value
                        )
                      }
                      placeholder="Enter rejection reason..."
                      rows={4}
                      maxLength={1000}
                      disabled={decisionLoading}
                    />

                    <div className="account-rejection-buttons">
                      <button
                        type="button"
                        onClick={() =>
                          setShowRejectForm(false)
                        }
                        disabled={decisionLoading}
                      >
                        Back
                      </button>

                      <button
                        type="button"
                        className="account-reject-button"
                        onClick={() =>
                          submitDecision('reject')
                        }
                        disabled={
                          decisionLoading ||
                          rejectionReason.trim().length < 5
                        }
                      >
                        {decisionLoading
                          ? 'Processing...'
                          : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <button
                  type="button"
                  onClick={closeReview}
                >
                  Close Review
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </main>
  );
}

export default AdminAccountRequestsPage;
