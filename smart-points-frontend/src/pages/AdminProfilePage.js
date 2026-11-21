
import React, { useEffect, useState } from 'react';
import api from '../services/api';

const EMPTY_PASSWORD = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

const styles = {
  page: {
    minHeight: '100vh',
    padding: '32px 24px 60px',
    background: '#f5f7fc'
  },
  container: {
    maxWidth: 1450,
    margin: '0 auto'
  },
  heading: {
    margin: '0 0 8px',
    color: '#0f172a',
    fontSize: 36,
    fontWeight: 800
  },
  subtitle: {
    color: '#64748b',
    margin: '0 0 28px',
    fontSize: 15
  },
  banner: {
    background:
      'linear-gradient(115deg, #2053b6, #1762d5 65%, #256fe2)',
    color: '#fff',
    borderRadius: 24,
    padding: '38px 42px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 30,
    marginBottom: 28,
    position: 'relative',
    overflow: 'hidden'
  },
  avatar: {
    width: 115,
    height: 115,
    borderRadius: '50%',
    border: '5px solid white',
    background: '#dbeafe',
    color: '#1d4ed8',
    display: 'grid',
    placeItems: 'center',
    fontSize: 45,
    fontWeight: 800,
    overflow: 'hidden',
    boxSizing: 'border-box'
  },
  card: {
    background: '#fff',
    border: '1px solid #e5eaf3',
    borderRadius: 18,
    padding: 26,
    marginBottom: 24,
    boxShadow: '0 5px 20px rgba(15,23,42,0.035)'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
    gap: 18
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 15px',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    fontSize: 14,
    outlineColor: '#2563eb'
  },
  primary: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer'
  },
  secondary: {
    background: '#fff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer'
  }
};

function InfoItem({ label, value }) {
  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e8edf5',
        borderRadius: 12,
        padding: '15px 17px',
        minWidth: 0
      }}
    >
      <div
        style={{
          color: '#64748b',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: '#1e293b',
          fontSize: 15,
          fontWeight: 700,
          overflowWrap: 'anywhere'
        }}
      >
        {value || 'Not provided'}
      </div>
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section style={styles.card}>
      <h2
        style={{
          color: '#163b70',
          fontSize: 21,
          fontWeight: 800,
          margin: '0 0 6px'
        }}
      >
        {title}
      </h2>

      <p
        style={{
          color: '#64748b',
          fontSize: 14,
          lineHeight: 1.6,
          margin: '0 0 22px'
        }}
      >
        {description}
      </p>

      {children}
    </section>
  );
}

function AdminProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [pictureUrl, setPictureUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');

  const [showPasswordModal, setShowPasswordModal] =
    useState(false);
  const [passwordForm, setPasswordForm] =
    useState(EMPTY_PASSWORD);
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] =
    useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const [toast, setToast] = useState(null);

const [showLguResubmit, setShowLguResubmit] = useState(false);
const [resubmitting, setResubmitting] = useState(false);

const [lguResubmitForm, setLguResubmitForm] = useState({
  lgu_office_address: '',
  lgu_office_contact: '',
  lgu_designation: '',
  representative_id_number: ''
});

const [lguResubmitFiles, setLguResubmitFiles] = useState({
  lgu_loi: null,
  lgu_id: null
});


  const notify = (type, message) => {
    setToast({
      type,
      message,
      id: Date.now()
    });
  };

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setLoadError('');

      const response = await api.get('/admin/profile');

      const data = response.data?.profile;

      if (!data) {
        throw new Error('Administrator profile not found.');
      }

      setProfile(data);
    } catch (error) {
      setLoadError(
        error.response?.data?.message ||
          error.message ||
          'Failed to load administrator profile.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchPicture = async () => {
    try {
      const response = await api.get(
        '/admin/profile/picture',
        { responseType: 'blob' }
      );

      const url = URL.createObjectURL(response.data);
      setPictureUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
    } catch (error) {
      setPictureUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return '';
      });
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchPicture();

    return () => {};
  }, []);

  useEffect(() => {
    return () => {
      if (pictureUrl) URL.revokeObjectURL(pictureUrl);
    };
  }, [pictureUrl]);

  const handlePictureUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(
        file.type
      )
    ) {
      notify('error', 'Only JPG, PNG, and WebP images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify('error', 'Image must not exceed 5 MB.');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('profile_picture', file);

      await api.put('/admin/profile/picture', formData);

      await fetchPicture();

      window.dispatchEvent(
        new Event('profile-picture-updated')
      );

      notify(
        'success',
        'Profile picture updated successfully.'
      );
    } catch (error) {
      notify(
        'error',
        error.response?.data?.message ||
          'Failed to update profile picture.'
      );
    } finally {
      setUploading(false);
    }
  };

const openLguResubmitModal = () => {
  setLguResubmitForm({
    lgu_office_address: profile?.lgu_office_address || '',
    lgu_office_contact: profile?.lgu_office_contact || '',
    lgu_designation: profile?.lgu_designation || '',
    representative_id_number:
      profile?.representative_id_number || ''
  });

  setLguResubmitFiles({
    lgu_loi: null,
    lgu_id: null
  });

  setShowLguResubmit(true);
};

const handleLguResubmit = async (event) => {
  event.preventDefault();

  if (resubmitting) return;

  const formData = new FormData();

  Object.entries(lguResubmitForm).forEach(([key, value]) => {
    formData.append(key, value.trim());
  });

  if (lguResubmitFiles.lgu_loi) {
    formData.append('lgu_loi', lguResubmitFiles.lgu_loi);
  }

  if (lguResubmitFiles.lgu_id) {
    formData.append('lgu_id', lguResubmitFiles.lgu_id);
  }

  try {
    setResubmitting(true);

    await api.put('/admin/profile/resubmit', formData);

    setShowLguResubmit(false);
    await fetchProfile();

    const storedUser = JSON.parse(
      localStorage.getItem('user') || 'null'
    );

    if (storedUser?.role === 'lgu') {
      storedUser.lgu_verification_status = 'pending';

      localStorage.setItem(
        'user',
        JSON.stringify(storedUser)
      );

      window.dispatchEvent(new Event('auth-changed'));
    }

    notify(
      'success',
      'Verification resubmitted. Awaiting Super Admin review.'
    );

  } catch (error) {
    notify(
      'error',
      error.response?.data?.message ||
        'Unable to resubmit verification.'
    );
  } finally {
    setResubmitting(false);
  }
};

  const openPasswordModal = () => {
    setPasswordForm(EMPTY_PASSWORD);
    setPasswordError('');
    setShowPasswords(false);
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    if (changingPassword) return;
    setShowPasswordModal(false);
    setPasswordForm(EMPTY_PASSWORD);
    setPasswordError('');
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');

    const {
      currentPassword,
      newPassword,
      confirmPassword
    } = passwordForm;

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }

    if (newPassword.length < 12) {
      setPasswordError(
        'New password must contain at least 12 characters.'
      );
      return;
    }

    if (
      new TextEncoder().encode(newPassword).length > 72
    ) {
      setPasswordError(
        'New password must not exceed 72 UTF-8 bytes.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        'New password must be different.'
      );
      return;
    }

    try {
      setChangingPassword(true);

      await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });

      closePasswordModalAfterSuccess();
      notify('success', 'Password changed successfully.');
    } catch (error) {
      setPasswordError(
        error.response?.data?.message ||
          'Unable to change password.'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const closePasswordModalAfterSuccess = () => {
    setShowPasswordModal(false);
    setPasswordForm(EMPTY_PASSWORD);
    setPasswordError('');
  };

  const formatDate = (value) => {
    if (!value) return 'Not available';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Not available';
    }

    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            Loading administrator profile...
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h2>Administrator Profile</h2>
            <p>{loadError}</p>
            <button
              type="button"
              style={styles.primary}
              onClick={fetchProfile}
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const fullName = profile.full_name || 'Administrator';
  const accountStatus = String(
    profile.status || 'unknown'
  ).toLowerCase();

  const isActive = accountStatus === 'active';
  const lguVerificationStatus = String(
  profile.lgu_verification_status || 'pending'
).toLowerCase();

const verificationBadge = {
  approved: '✓ Verified',
  pending: '◷ Pending',
  rejected: '✕ Rejected'
};

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>My Profile</h1>

        <p style={styles.subtitle}>
          View your administrator account information,
          manage security, and maintain your CitiPoints profile.
        </p>

        {/* PROFILE BANNER */}

        <section style={styles.banner}>
          <div
            style={{
              position: 'absolute',
              width: 340,
              height: 340,
              right: -65,
              top: -150,
              background: 'rgba(255,255,255,0.07)',
              borderRadius: '50%'
            }}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10
            }}
          >
            <div style={styles.avatar}>
              {pictureUrl ? (
                <img
                  src={pictureUrl}
                  alt="Administrator profile"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                fullName.charAt(0).toUpperCase()
              )}
            </div>

            <label
              htmlFor="admin-profile-picture"
              style={{
                background: '#fff',
                color: '#1d4ed8',
                padding: '8px 13px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: uploading ? 'wait' : 'pointer'
              }}
            >
              {uploading ? 'Uploading...' : 'Change Photo'}
            </label>

            <input
              id="admin-profile-picture"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePictureUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </div>

          <div
            style={{
              flex: '1 1 250px',
              minWidth: 0,
              position: 'relative',
              zIndex: 1
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              <span
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: 20,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 800
                }}
              >
                LGU ADMINISTRATOR
              </span>

            <span
  className={`lgu-profile-status ${
    profile.role === 'lgu'
      ? lguVerificationStatus
      : isActive
        ? 'approved'
        : 'rejected'
  }`}
>
  {profile.role === 'lgu'
    ? verificationBadge[lguVerificationStatus] ||
      lguVerificationStatus
    : isActive
      ? '✓ Active'
      : accountStatus}
</span>
            </div>

            <h2
              style={{
                fontSize: 'clamp(24px, 3vw, 34px)',
                fontWeight: 800,
                margin: '12px 0',
                overflowWrap: 'anywhere'
              }}
            >
              {fullName}
            </h2>

            <p style={{ margin: '8px 0' }}>
              {profile.email || 'No email available'}
            </p>

            <p style={{ margin: '8px 0' }}>
              CitiPoints Administration
            </p>

            <p style={{ margin: '8px 0', opacity: 0.85 }}>
              Member since {formatDate(profile.created_at)}
            </p>
          </div>
        </section>
                {profile.role === 'lgu' && (
  <Section
    title="LGU Verification"
    description="View your LGU registration details and verification status."
  >
    <div className="lgu-verification-details">
      <InfoItem
        label="Verification Status"
        value={
          verificationBadge[lguVerificationStatus] ||
          lguVerificationStatus
        }
      />

      <InfoItem
        label="LGU Office"
        value={profile.lgu_office}
      />

      <InfoItem
        label="LGU Level"
        value={
          profile.lgu_level === 'barangay'
            ? 'Barangay LGU'
            : 'City LGU'
        }
      />

      <InfoItem
        label="Assigned Barangay"
        value={profile.lgu_barangay || 'City Level'}
      />
    </div>

    {lguVerificationStatus === 'rejected' && (
      <div className="lgu-rejected-notice">
        <div className="lgu-rejected-icon">✕</div>

        <div className="lgu-rejected-content">
          <h3>LGU Verification Rejected</h3>

          <p>
            Your LGU registration was rejected by the
            City Super Admin. Please review the remarks
            and resubmit your corrected information.
          </p>

          <div className="lgu-rejected-reason">
            <strong>Remarks from City Super Admin</strong>

            <p>
              {profile.rejection_reason ||
                'No rejection reason was recorded.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="lgu-resubmit-button"
          onClick={openLguResubmitModal}
        >
          ↻ Resubmit Application
        </button>
      </div>
    )}

    {lguVerificationStatus === 'pending' && (
      <div className="lgu-pending-notice">
        <span className="lgu-notice-icon">◷</span>

        <div>
          <h3>Verification Pending</h3>

          <p>
            Your LGU application is awaiting review by
            the City Super Admin. Administrative features
            remain restricted until approval.
          </p>
        </div>
      </div>
    )}

    {lguVerificationStatus === 'approved' && (
      <div className="lgu-approved-notice">
        <span className="lgu-notice-icon">✓</span>

        <div>
          <h3>LGU Verification Approved</h3>

          <p>
            Your LGU registration has been approved.
            You may use your authorized LGU features.
          </p>
        </div>
      </div>
    )}
  </Section>
)}
        {/* TABS */}

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            borderBottom: '1px solid #dce4f0',
            marginBottom: 24
          }}
        >
          {[
            ['overview', 'Overview'],
            ['security', 'Account Security']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                border: 'none',
                borderBottom:
                  activeTab === key
                    ? '3px solid #2563eb'
                    : '3px solid transparent',
                padding: '14px 18px',
                background: 'transparent',
                color:
                  activeTab === key
                    ? '#1d4ed8'
                    : '#64748b',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <Section
              title="Personal Information"
              description="Your registered administrator account information."
            >
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                  color: '#345b87',
                  padding: 15,
                  borderRadius: 12,
                  fontSize: 13,
                  marginBottom: 22
                }}
              >
                🔒 Your administrator account information
                is read-only. Contact the system administrator
                if corrections are required.
              </div>

              <div style={styles.grid}>
                <InfoItem
                  label="Full Name"
                  value={profile.full_name}
                />
                <InfoItem
                  label="Email Address"
                  value={profile.email}
                />
                <InfoItem
                  label="Account Role"
                  value="LGU Administrator"
                />
                <InfoItem
                  label="Account Status"
                  value={accountStatus}
                />
                <InfoItem
                  label="Date Joined"
                  value={formatDate(profile.created_at)}
                />
              </div>
            </Section>




            <Section
              title="Account Security"
              description="Manage your administrator password securely."
            >
              <button
                type="button"
                style={styles.primary}
                onClick={openPasswordModal}
              >
                Change Password
              </button>
            </Section>
          </>
        )}

        {activeTab === 'security' && (
          <Section
            title="Account Security"
            description="Protect your administrator account."
          >
            <div style={styles.grid}>
              <InfoItem
                label="Account Email"
                value={profile.email}
              />
              <InfoItem
                label="Account Status"
                value={accountStatus}
              />
            </div>

            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                style={styles.primary}
                onClick={openPasswordModal}
              >
                Change Password
              </button>
            </div>
          </Section>
        )}
      </div>

{showLguResubmit && (
  <div
    className="lgu-resubmit-overlay"
    onClick={(event) => {
      if (
        event.target === event.currentTarget &&
        !resubmitting
      ) {
        setShowLguResubmit(false);
      }
    }}
  >
    <form
      className="lgu-resubmit-modal"
      onSubmit={handleLguResubmit}
    >
      <h2>Resubmit LGU Verification</h2>

      <p className="lgu-resubmit-description">
        Correct your LGU information and upload replacement
        documents where needed. Your application will return
        to Pending Review.
      </p>

      <div className="lgu-resubmit-fields">
        {[
          ['lgu_office_address', 'Office Address'],
          ['lgu_office_contact', 'Office Contact Number'],
          ['lgu_designation', 'Official Designation'],
          ['representative_id_number', 'Representative ID Number']
        ].map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>

            <input
              type="text"
              required
              maxLength={
                key === 'lgu_office_address' ? 255 :
                key === 'lgu_office_contact' ? 50 :
                key === 'lgu_designation' ? 150 : 50
              }
              value={lguResubmitForm[key]}
              onChange={(event) =>
                setLguResubmitForm((previous) => ({
                  ...previous,
                  [key]: event.target.value
                }))
              }
            />
          </label>
        ))}

        {[
          ['lgu_loi', 'Replacement Letter of Intent'],
          ['lgu_id', 'Replacement Government / Employee ID']
        ].map(([key, label]) => (
          <label key={key}>
            <span>{label} (Optional)</span>

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;

                if (file && file.size > 5 * 1024 * 1024) {
                  notify('error', 'Maximum file size is 5 MB.');
                  event.target.value = '';
                  return;
                }

                setLguResubmitFiles((previous) => ({
                  ...previous,
                  [key]: file
                }));
              }}
            />
          </label>
        ))}
      </div>

      <p className="lgu-resubmit-hint">
        Accepted files: JPG, PNG, PDF — maximum 5 MB each.
        You must change at least one detail or document.
      </p>

      <div className="lgu-resubmit-actions">
        <button
          type="button"
          className="lgu-resubmit-cancel"
          disabled={resubmitting}
          onClick={() => setShowLguResubmit(false)}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="lgu-resubmit-button"
          disabled={resubmitting}
        >
          {resubmitting
            ? 'Submitting...'
            : 'Submit for Review'}
        </button>
      </div>
    </form>
  </div>
)}

      {/* CHANGE PASSWORD MODAL */}

      {showPasswordModal && (
        <div
          role="presentation"
          onClick={closePasswordModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-password-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              background: '#fff',
              width: '100%',
              maxWidth: 440,
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 22,
              padding: 28,
              boxSizing: 'border-box'
            }}
          >
            <h2
              id="admin-password-title"
              style={{
                color: '#163b70',
                textAlign: 'center',
                marginTop: 0
              }}
            >
              Change Password
            </h2>

            <p
              style={{
                color: '#64748b',
                textAlign: 'center',
                fontSize: 14,
                marginBottom: 24
              }}
            >
              Enter your current password and choose a new one.
            </p>

            <form onSubmit={handleChangePassword}>
              {[
                ['currentPassword', 'Current Password'],
                ['newPassword', 'New Password'],
                ['confirmPassword', 'Confirm New Password']
              ].map(([key, label]) => (
                <div
                  key={key}
                  style={{ marginBottom: 18 }}
                >
                  <label
                    htmlFor={`admin-${key}`}
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      color: '#334155',
                      fontSize: 13,
                      fontWeight: 700
                    }}
                  >
                    {label}
                  </label>

                  <input
                    id={`admin-${key}`}
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete={
                      key === 'currentPassword'
                        ? 'current-password'
                        : 'new-password'
                    }
                    style={styles.input}
                    value={passwordForm[key]}
                    onChange={(event) =>
                      setPasswordForm((previous) => ({
                        ...previous,
                        [key]: event.target.value
                      }))
                    }
                    required
                  />
                </div>
              ))}

              <label
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 13,
                  color: '#475569',
                  marginBottom: 16
                }}
              >
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(event) =>
                    setShowPasswords(event.target.checked)
                  }
                />
                Show passwords
              </label>

              {passwordError && (
                <div
                  role="alert"
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 13,
                    marginBottom: 16
                  }}
                >
                  {passwordError}
                </div>
              )}

              <p
                style={{
                  color: '#64748b',
                  fontSize: 12,
                  marginBottom: 20
                }}
              >
                Use at least 12 characters for your new password.
              </p>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  style={{ ...styles.secondary, flex: 1 }}
                  disabled={changingPassword}
                  onClick={closePasswordModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{ ...styles.primary, flex: 1 }}
                  disabled={changingPassword}
                >
                  {changingPassword
                    ? 'Updating...'
                    : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST */}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 100000,
            background: '#fff',
            padding: '16px 18px',
            borderRadius: 14,
            width: 'min(360px, calc(100vw - 48px))',
            boxSizing: 'border-box',
            boxShadow: '0 15px 45px rgba(0,0,0,0.16)',
            borderLeft: `5px solid ${
              toast.type === 'success'
                ? '#16a34a'
                : '#dc2626'
            }`
          }}
        >
          <strong
            style={{
              color:
                toast.type === 'success'
                  ? '#166534'
                  : '#b91c1c'
            }}
          >
            {toast.type === 'success'
              ? '✓ Success'
              : '✕ Error'}
          </strong>

          <p
            style={{
              color: '#64748b',
              fontSize: 13,
              margin: '5px 0 0'
            }}
          >
            {toast.message}
          </p>
        </div>
      )}
    </main>
  );
}

export default AdminProfilePage;
