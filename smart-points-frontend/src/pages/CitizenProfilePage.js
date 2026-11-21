
import React, { useEffect, useState } from 'react';
import api from '../services/api';

const RANK_CONFIG = {
  New: { min: 0, next: 'Bronze', nextRequired: 100 },
  Bronze: { min: 100, next: 'Silver', nextRequired: 400 },
  Silver: { min: 400, next: 'Gold', nextRequired: 700 },
  Gold: { min: 700, next: 'Platinum', nextRequired: 1100 },
  Platinum: {
    min: 1100,
    next: 'Diamond',
    nextRequired: 1500
  },
  Diamond: {
    min: 1500,
    next: null,
    nextRequired: 1500
  }
};

const EMPTY_PASSWORD = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};
const CITIZEN_ID_TYPES = [
  { value: 'national_id', label: 'Philippine National ID' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'voters_id', label: "Voter's ID" },
  { value: 'senior_citizen_id', label: 'Senior Citizen ID' },
  { value: 'other', label: 'Others' }
];

const getCitizenResubmitInitial = (profile) => {
  const savedType = String(profile?.id_type || '');
  const custom = savedType.startsWith('Other:');

  return {
    id_type: custom ? 'other' : savedType,
    other_id_type: custom
      ? savedType.slice(6).trim()
      : '',
    id_number: profile?.id_number || ''
  };
};

function CitizenProfilePage() {
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  // CITIZEN VERIFICATION RESUBMISSION
const [showCitizenResubmitModal, setShowCitizenResubmitModal] = useState(false);
const [citizenResubmitForm, setCitizenResubmitForm] = useState({
  id_type: '',
  other_id_type: '',
  id_number: ''
});

const [citizenIDPhotos, setCitizenIDPhotos] = useState({
  front: null,
  back: null
});
const [citizenResubmitError, setCitizenResubmitError] = useState('');
const [citizenResubmitSaving, setCitizenResubmitSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editingPicture, setEditingPicture] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [imageObjectUrl, setImageObjectUrl] = useState('');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/citizen/profile');
      setProfile(response.data.profile);
    } catch (err) {
      console.error('PROFILE ERROR:', err);
      setError(
        err.response?.data?.message || 'Failed to load profile.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchProfilePicture = async () => {
    try {
      const response = await api.get('/citizen/profile/picture', {
        responseType: 'blob'
      });

      const url = URL.createObjectURL(response.data);

      setImageObjectUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
    } catch (err) {
      console.error('PROFILE PICTURE ERROR:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (profile?.profile_picture_type) {
      fetchProfilePicture();
    }
  }, [profile?.profile_picture_type]);

  useEffect(() => {
    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [imageObjectUrl]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowed.includes(file.type)) {
      showToast('error', 'Only JPG, PNG and WebP images are allowed.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Profile picture must not exceed 5 MB.');
      event.target.value = '';
      return;
    }

    setSelectedImage(file);
    setPreview(URL.createObjectURL(file));
    event.target.value = '';
  };

  const cancelPictureEdit = () => {
    setEditingPicture(false);
    setSelectedImage(null);
    setPreview('');
  };

  const handleSavePicture = async (event) => {
    event.preventDefault();

    if (!selectedImage) {
      showToast('error', 'Please select a profile picture.');
      return;
    }

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append('profile_picture', selectedImage);

      await api.put('/citizen/profile', formData);

      await fetchProfilePicture();

      setSelectedImage(null);
      setPreview('');
      setEditingPicture(false);

      showToast('success', 'Profile picture updated successfully.');
    } catch (err) {
      console.error('PROFILE PICTURE UPDATE ERROR:', err);
      showToast(
        'error',
        err.response?.data?.message ||
          'Failed to update profile picture.'
      );
    } finally {
      setSaving(false);
    }
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

    if (!passwordForm.currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }

    if (passwordForm.newPassword.length < 12) {
      setPasswordError(
        'New password must contain at least 12 characters.'
      );
      return;
    }

    if (
      passwordForm.newPassword !==
      passwordForm.confirmPassword
    ) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (
      passwordForm.currentPassword ===
      passwordForm.newPassword
    ) {
      setPasswordError(
        'Your new password must be different from your current password.'
      );
      return;
    }

    try {
      setChangingPassword(true);

      await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setShowPasswordModal(false);
      setPasswordForm(EMPTY_PASSWORD);

      showToast('success', 'Password changed successfully.');
    } catch (err) {
      console.error('CHANGE PASSWORD ERROR:', err);
      setPasswordError(
        err.response?.data?.message ||
          'Unable to change password. Please try again.'
      );
    } finally {
      setChangingPassword(false);
    }
  };
 // =====================================================
// CITIZEN VERIFICATION RESUBMISSION
// =====================================================

const openCitizenResubmitModal = () => {
  setCitizenResubmitForm(getCitizenResubmitInitial(profile));

  setCitizenIDPhotos({
    front: null,
    back: null
  });

  setCitizenResubmitError('');
  setShowCitizenResubmitModal(true);
};

const closeCitizenResubmitModal = () => {
  if (citizenResubmitSaving) return;

  setShowCitizenResubmitModal(false);
  setCitizenResubmitError('');
};

// Close modal with Escape and prevent background scrolling.
useEffect(() => {
  if (!showCitizenResubmitModal) return;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const handleEscape = (event) => {
    if (
      event.key === 'Escape' &&
      !citizenResubmitSaving
    ) {
      setShowCitizenResubmitModal(false);
    }
  };

  document.addEventListener('keydown', handleEscape);

  return () => {
    document.body.style.overflow = previousOverflow;
    document.removeEventListener('keydown', handleEscape);
  };
}, [showCitizenResubmitModal, citizenResubmitSaving]);

// =====================================================
// UPLOAD ID PHOTO
// =====================================================

const handleCitizenIDUpload = (event, side) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    setCitizenResubmitError(
      'Only JPG or PNG ID photos are allowed.'
    );

    event.target.value = '';
    return;
  }

  if (
    file.size === 0 ||
    file.size > 5 * 1024 * 1024
  ) {
    setCitizenResubmitError(
      'ID photo must be non-empty and no larger than 5 MB.'
    );

    event.target.value = '';
    return;
  }

  setCitizenResubmitError('');

  const reader = new FileReader();

  reader.onload = () => {
    setCitizenIDPhotos((previous) => ({
      ...previous,
      [side]: {
        file,
        preview: String(reader.result || '')
      }
    }));
  };

  reader.onerror = () => {
    setCitizenResubmitError(
      'Could not read that photo. Please select another.'
    );
  };

  reader.readAsDataURL(file);

  event.target.value = '';
};

// Submit corrected ID information and captured documents.
const handleCitizenResubmit = async (event) => {
  event.preventDefault();

  if (citizenResubmitSaving) return;

  const saved = getCitizenResubmitInitial(profile);

  const selectedType = citizenResubmitForm.id_type;
  const otherType = citizenResubmitForm.other_id_type.trim();
  const idNumber = citizenResubmitForm.id_number.trim();

  if (!selectedType || !idNumber) {
    setCitizenResubmitError(
      'Complete the required ID information.'
    );
    return;
  }

  if (
    selectedType === 'other' &&
    otherType.length < 3
  ) {
    setCitizenResubmitError(
      'Specify your government-issued ID type.'
    );
    return;
  }

  const formData = new FormData();
  let changed = false;

  if (
    selectedType !== saved.id_type ||
    (
      selectedType === 'other' &&
      otherType !== saved.other_id_type
    )
  ) {
    formData.append('id_type', selectedType);

    if (selectedType === 'other') {
      formData.append('other_id_type', otherType);
    }

    changed = true;
  }

  if (idNumber !== saved.id_number) {
    formData.append('id_number', idNumber);
    changed = true;
  }

  if (citizenIDPhotos.front) {
    formData.append(
      'id_front',
      citizenIDPhotos.front.file
    );
    changed = true;
  }

  if (citizenIDPhotos.back) {
    formData.append(
      'id_back',
      citizenIDPhotos.back.file
    );
    changed = true;
  }

  if (!changed) {
    setCitizenResubmitError(
      'Correct an ID detail or upload a replacement ID photo.'
    );
    return;
  }

  try {
    setCitizenResubmitSaving(true);
    setCitizenResubmitError('');

    const response = await api.post(
      '/citizen/verification/resubmit',
      formData
    );

    if (!response.data?.success) {
      throw new Error('Resubmission was not confirmed.');
    }

   setShowCitizenResubmitModal(false);

    // Immediately show the Pending badge.
    setProfile((previous) => ({
      ...previous,
      verification_status: 'pending'
    }));

    // Refresh the latest verification details.
    try {
      const refreshed = await api.get('/citizen/profile');

      if (refreshed.data?.profile) {
        setProfile(refreshed.data.profile);
      }
    } catch (refreshError) {
      console.warn(
        'Profile refresh failed:',
        refreshError
      );
    }

    showToast(
      'success',
      'Verification resubmitted successfully. Awaiting LGU review.'
    );

  } catch (error) {
    console.error('CITIZEN RESUBMISSION ERROR:', error);

    setCitizenResubmitError(
      error.response?.data?.message ||
      error.message ||
      'Unable to resubmit verification.'
    );
  } finally {
    setCitizenResubmitSaving(false);
  }
};
  const formatDate = (value) => {
    if (!value) return 'Not available';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not available';

    return date.toLocaleDateString('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <main className="citizen-profile-page">
        <div className="profile-loading">
          Loading your profile...
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="citizen-profile-page">
        <div className="profile-error">
          {error || 'Profile not found.'}
        </div>
      </main>
    );
  }

  const rank =
    RANK_CONFIG[profile.current_rank] || RANK_CONFIG.New;

  const points = Number(profile.points_balance || 0);

  const progress = rank.next
    ? Math.min(
        Math.max(
          ((points - rank.min) /
            (rank.nextRequired - rank.min)) * 100,
          0
        ),
        100
      )
    : 100;

  const remaining = rank.next
    ? Math.max(rank.nextRequired - points, 0)
    : 0;

  const avatarSource = preview || imageObjectUrl;

  return (
    <main className="citizen-profile-page">
      <div className="citizen-profile-container">

        <div className="profile-page-heading">
          <div>
            <h1>My Profile</h1>
            <p>
              View your account information, manage security,
              and track your CitiPoints progress.
            </p>
          </div>
        </div>

        {error && (
          <div className="profile-message error">{error}</div>
        )}

        {/* PROFILE BANNER */}

        <section className="profile-banner">
          <div className="profile-avatar-wrapper">
            {avatarSource ? (
              <img
                src={avatarSource}
                alt={profile.full_name}
                className="profile-avatar-image"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {profile.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>

          <div className="profile-banner-info">
            
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '10px'
  }}
>
  <span className="profile-member-label">
    CITIZEN MEMBER
  </span>

  {(() => {
    const status = String(
      profile.verification_status || 'not_submitted'
    ).toLowerCase();

    const verified = status === 'verified';
    const pending = status === 'pending';

    const label = verified
      ? '✓ Verified'
      : pending
        ? '◷ Pending'
        : status === 'rejected'
          ? '✕ Rejected'
          : 'Not Verified';

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: '20px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 700,
          color: verified
            ? '#166534'
            : pending
              ? '#92400e'
              : '#991b1b',
          background: verified
            ? '#dcfce7'
            : pending
              ? '#fef3c7'
              : '#fee2e2',
          border: `1px solid ${
            verified
              ? '#86efac'
              : pending
                ? '#fcd34d'
                : '#fecaca'
          }`
        }}
      >
        {label}
      </span>
    );
  })()}
</div>


            <h2>{profile.full_name}</h2>

            <div className="profile-contact-line">
              <span>{profile.email}</span>
              {profile.phone && (
                <>
                  <span>•</span>
                  <span>{profile.phone}</span>
                </>
              )}
            </div>

            <div className="profile-location-line">
              {profile.barangay || profile.city ? (
                <>
                  {profile.barangay &&
                    `Barangay ${profile.barangay}`}
                  {profile.barangay && profile.city && ', '}
                  {profile.city}
                </>
              ) : (
                'Location not yet provided'
              )}
            </div>

            <small>
              Member since {formatDate(profile.created_at)}
            </small>
          </div>
        </section>

        {/* PROFILE STATS */}

        <section className="profile-stats">
          <StatCard
            icon="◎"
            value={points.toLocaleString()}
            label="Smart Points"
          />
          <StatCard
            icon="★"
            value={profile.current_rank || 'New'}
            label="Current Rank"
          />
          <StatCard
            icon="▣"
            value={profile.activities_joined || 0}
            label="Activities Joined"
          />
          <StatCard
            icon="✓"
            value={profile.activities_completed || 0}
            label="Completed"
          />
          <StatCard
            icon="◇"
            value={profile.rewards_redeemed || 0}
            label="Rewards Redeemed"
          />
        </section>
              {/* =====================================================
    CITIZEN VERIFICATION REJECTED NOTICE
===================================================== */}

{String(profile.verification_status || '').toLowerCase() === 'rejected' && (
  <section className="citizen-rejected-notice">

    <div className="citizen-rejected-icon">
      ✕
    </div>

    <div className="citizen-rejected-content">

      <h3>Identity Verification Rejected</h3>

      <p>
        Your identity verification was rejected by the
        LGU Administrator. Please review the remarks
        and resubmit your corrected verification details.
      </p>

      <div className="citizen-rejected-reason">
        <strong>Remarks from LGU Administrator</strong>

        <p>
          {profile.rejection_reason ||
            'No rejection reason was recorded. Please review your ID information and verification documents.'}
        </p>
      </div>

    </div>

   <button
  type="button"
  className="citizen-resubmit-button"
  onClick={openCitizenResubmitModal}
>
  ↻ Resubmit Application
</button>

  </section>
)}
        {/* TABS */}

        <div className="profile-tabs">
          {[
            ['overview', 'Overview'],
            ['activities', 'Activities'],
            ['points', 'Points History'],
            ['rewards', 'Rewards']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? 'active' : ''}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}

        {activeTab === 'overview' && (
          <div className="profile-content-grid">

            <section className="profile-panel">
              <div className="profile-panel-header">
                <div>
                  <h2>Personal Information</h2>
                  <p>
                    Your registered citizen account information
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                  borderRadius: 12,
                  padding: '12px 16px',
                  color: '#345b87',
                  fontSize: 13,
                  lineHeight: 1.6,
                  marginBottom: 22
                }}
              >
                🔒 Your personal information is read-only.
                Contact the LGU Administrator if any information
                needs to be corrected.
              </div>

              <div className="profile-info-grid">
                <InfoItem
                  label="Full Name"
                  value={profile.full_name}
                />
                <InfoItem
                  label="Email Address"
                  value={profile.email}
                />
                <InfoItem
                  label="Contact Number"
                  value={profile.phone || 'Not provided'}
                />
                <InfoItem
                  label="Barangay"
                  value={profile.barangay || 'Not provided'}
                />
                <InfoItem
                  label="City"
                  value={profile.city || 'Not provided'}
                />
                <InfoItem
                  label="Date Joined"
                  value={formatDate(profile.created_at)}
                />
              </div>

              {/* PROFILE PICTURE MANAGEMENT */}

              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  marginTop: 28,
                  paddingTop: 24
                }}
              >
                <h3 style={{ color: '#163b70', marginBottom: 6 }}>
                  Profile Picture
                </h3>
                <p
                  style={{
                    color: '#64748b',
                    fontSize: 14,
                    marginBottom: 18
                  }}
                >
                  You can update your profile picture anytime.
                </p>

                {editingPicture ? (
                  <form onSubmit={handleSavePicture}>
                    <div className="profile-photo-editor">
                      <div className="profile-edit-avatar">
                        {avatarSource ? (
                          <img
                            src={avatarSource}
                            alt="Profile preview"
                          />
                        ) : (
                          <span>
                            {profile.full_name
                              ?.charAt(0)
                              .toUpperCase() || 'U'}
                          </span>
                        )}
                      </div>

                      <div>
                        <label
                          className="profile-upload-button"
                          htmlFor="profile-picture"
                        >
                          Choose Picture
                        </label>

                        <input
                          id="profile-picture"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleImageChange}
                          hidden
                        />

                        <small
                          style={{
                            display: 'block',
                            marginTop: 10
                          }}
                        >
                          JPG, PNG or WebP. Maximum 5 MB.
                        </small>
                      </div>
                    </div>

                    <div className="profile-form-actions">
                      <button
                        type="button"
                        className="profile-cancel-button"
                        disabled={saving}
                        onClick={cancelPictureEdit}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="profile-save-button"
                        disabled={saving || !selectedImage}
                      >
                        {saving ? 'Saving...' : 'Save Picture'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="profile-edit-button"
                    onClick={() => setEditingPicture(true)}
                  >
                    Change Profile Picture
                  </button>
                )}
              </div>

              {/* ACCOUNT SECURITY */}

              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  marginTop: 28,
                  paddingTop: 24
                }}
              >
                <h3 style={{ color: '#163b70', marginBottom: 6 }}>
                  Account Security
                </h3>

                <p
                  style={{
                    color: '#64748b',
                    fontSize: 14,
                    marginBottom: 18
                  }}
                >
                  Keep your CitiPoints account secure by
                  updating your password when necessary.
                </p>

                <button
                  type="button"
                  className="profile-edit-button"
                  onClick={() => {
                    setPasswordError('');
                    setPasswordForm(EMPTY_PASSWORD);
                    setShowPasswordModal(true);
                  }}
                >
                  Change Password
                </button>
              </div>
            </section>

            {/* RANK PROGRESS */}

            <section className="profile-panel">
              <div className="profile-panel-header">
                <div>
                  <h2>My Progress</h2>
                  <p>Your current CitiPoints rank progress</p>
                </div>
              </div>

              <div className="profile-progress-rank">
                <span>★</span>
                <div>
                  <small>Current Rank</small>
                  <strong>
                    {profile.current_rank || 'New'}
                  </strong>
                </div>
              </div>

              <div className="profile-progress-bar">
                <div
                  className="profile-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {rank.next ? (
                <p className="profile-progress-text">
                  <strong>
                    {remaining.toLocaleString()}
                  </strong>{' '}
                  more points to reach{' '}
                  <strong>{rank.next}</strong>
                </p>
              ) : (
                <p className="profile-progress-text">
                  Highest rank reached.
                </p>
              )}
            </section>
          </div>
        )}

        {/* OTHER TABS */}

        {activeTab === 'activities' && (
          <ProfileLinkPanel
            title="My Activities"
            text="View activities you joined and your participation status."
            button="View My Participation"
            path="/my-participation"
          />
        )}

        {activeTab === 'points' && (
          <ProfileLinkPanel
            title="Points History"
            text="View your Smart Points transaction records."
            button="Go to Dashboard"
            path="/dashboard"
          />
        )}

        {activeTab === 'rewards' && (
          <ProfileLinkPanel
            title="My Rewards"
            text="View your reward redemption history and status."
            button="View My Redemptions"
            path="/my-redemptions"
          />
        )}
      </div>
        {/* =====================================================
    CITIZEN VERIFICATION RESUBMISSION MODAL
===================================================== */}

{showCitizenResubmitModal &&
  profile.verification_status === 'rejected' && (

  <div
    className="citizen-resubmit-overlay"
    onClick={(event) => {
      if (event.target === event.currentTarget) {
        closeCitizenResubmitModal();
      }
    }}
  >
    <div
      className="citizen-resubmit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citizen-resubmit-title"
      onClick={(event) => event.stopPropagation()}
    >
      {/* HEADER */}

      <div className="citizen-resubmit-header">
        <div>
          <h2 id="citizen-resubmit-title">
            Resubmit Identity Verification
          </h2>
          <p>
Correct your ID details and upload replacement
documents from your device.
          </p>
        </div>

        <button
          type="button"
          className="citizen-resubmit-close"
          onClick={closeCitizenResubmitModal}
          disabled={citizenResubmitSaving}
          aria-label="Close modal"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleCitizenResubmit}>
        <div className="citizen-resubmit-content">

          <div className="citizen-resubmit-info">
            <strong>LGU Administrator's Remarks</strong>
            <p>
              {profile.rejection_reason ||
                'No rejection reason was recorded.'}
            </p>
          </div>

          {/* ID DETAILS */}

          <h3 className="citizen-resubmit-section-title">
            Identification Details
          </h3>

          <div className="citizen-resubmit-grid">
            <label>
              Government ID Type *
              <select
                required
                value={citizenResubmitForm.id_type}
                onChange={(event) => {
                  setCitizenResubmitForm((previous) => ({
                    ...previous,
                    id_type: event.target.value,
                    other_id_type:
                      event.target.value === 'other'
                        ? previous.other_id_type
                        : ''
                  }));
                }}
              >
                <option value="">Select ID Type</option>

                {CITIZEN_ID_TYPES.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              ID Number *
              <input
                type="text"
                required
                minLength={3}
                maxLength={50}
                value={citizenResubmitForm.id_number}
                onChange={(event) => {
                  setCitizenResubmitForm((previous) => ({
                    ...previous,
                    id_number: event.target.value
                  }));
                }}
                placeholder="Enter ID number"
              />
            </label>

            {citizenResubmitForm.id_type === 'other' && (
              <label className="citizen-resubmit-full">
                Specify Government ID Type *
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={40}
                  value={citizenResubmitForm.other_id_type}
                  onChange={(event) => {
                    setCitizenResubmitForm((previous) => ({
                      ...previous,
                      other_id_type: event.target.value
                    }));
                  }}
                  placeholder="Specify ID type"
                />
              </label>
            )}
          </div>

         {/* DOCUMENTS */}

<h3 className="citizen-resubmit-section-title">
  Verification Documents
</h3>

<p className="citizen-resubmit-help">
  Upload clear JPG or PNG photos of your ID
  (maximum 5 MB each). Existing photos are
  retained unless replaced.
</p>

<div className="citizen-resubmit-photos">
  {[
    ['front', 'Front of ID'],
    ['back', 'Back of ID']
  ].map(([side, label]) => (
    <div
      key={side}
      className="citizen-resubmit-photo-card"
    >
      <h4>{label}</h4>

      {citizenIDPhotos[side] ? (
        <img
          src={citizenIDPhotos[side].preview}
          alt={`Uploaded ${label}`}
          className="citizen-resubmit-photo-preview"
        />
      ) : (
        <div className="citizen-resubmit-photo-placeholder">
          <span>▣</span>
          <p>Existing ID photo retained</p>
        </div>
      )}

      <input
        type="file"
        accept="image/jpeg,image/png"
        className="citizen-resubmit-file-input"
        disabled={citizenResubmitSaving}
        aria-label={`Upload ${label}`}
        onChange={(event) =>
          handleCitizenIDUpload(event, side)
        }
      />

      {citizenIDPhotos[side] && (
        <small className="citizen-resubmit-uploaded-name">
          ✓ {citizenIDPhotos[side].file.name}
        </small>
      )}
    </div>
  ))}
</div>

          {citizenResubmitError && (
            <div
              className="citizen-resubmit-error"
              role="alert"
            >
              {citizenResubmitError}
            </div>
          )}

        </div>

        {/* FOOTER */}

        <div className="citizen-resubmit-footer">

          <button
            type="button"
            className="citizen-resubmit-cancel"
            disabled={citizenResubmitSaving}
            onClick={closeCitizenResubmitModal}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="citizen-resubmit-submit"
           disabled={citizenResubmitSaving}
          >
            {citizenResubmitSaving
              ? 'Submitting...'
              : 'Submit for Review'}
          </button>

        </div>
      </form>
    </div>
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
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 22,
              padding: 30,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 25px 70px rgba(0,0,0,0.2)'
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: '#dbeafe',
                color: '#2563eb',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 18px',
                fontSize: 28
              }}
            >
              🔒
            </div>

            <h2
              id="change-password-title"
              style={{
                textAlign: 'center',
                color: '#163b70',
                marginBottom: 10
              }}
            >
              Change Password
            </h2>

            <p
              style={{
                textAlign: 'center',
                color: '#64748b',
                fontSize: 14,
                lineHeight: 1.6,
                marginBottom: 24
              }}
            >
              Enter your current password and create
              a secure new password.
            </p>

            <form onSubmit={handleChangePassword}>
              {[
                ['currentPassword', 'Current Password'],
                ['newPassword', 'New Password'],
                ['confirmPassword', 'Confirm New Password']
              ].map(([name, label]) => (
                <div
                  key={name}
                  style={{ marginBottom: 16 }}
                >
                  <label
                    htmlFor={name}
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: 8
                    }}
                  >
                    {label}
                  </label>

                  <input
                    id={name}
                    type="password"
                    autoComplete={
                      name === 'currentPassword'
                        ? 'current-password'
                        : 'new-password'
                    }
                    value={passwordForm[name]}
                    onChange={(event) => {
                      setPasswordForm((previous) => ({
                        ...previous,
                        [name]: event.target.value
                      }));
                    }}
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 10,
                      fontSize: 14
                    }}
                  />
                </div>
              ))}

              {passwordError && (
                <div
                  role="alert"
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 10,
                    color: '#b91c1c',
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
                  disabled={changingPassword}
                  onClick={closePasswordModal}
                  style={{
                    flex: 1,
                    padding: 13,
                    borderRadius: 11,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={changingPassword}
                  style={{
                    flex: 1,
                    padding: 13,
                    borderRadius: 11,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {changingPassword
                    ? 'Updating...'
                    : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 100000,
            width: 'min(360px, calc(100vw - 48px))',
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 15px 45px rgba(0,0,0,0.16)',
            borderLeft: `5px solid ${
              toast.type === 'success'
                ? '#16a34a'
                : '#dc2626'
            }`,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div
            style={{
              background:
                toast.type === 'success'
                  ? '#dcfce7'
                  : '#fee2e2',
              color:
                toast.type === 'success'
                  ? '#16a34a'
                  : '#dc2626',
              borderRadius: '50%',
              width: 40,
              height: 40,
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              fontWeight: 700,
              flexShrink: 0
            }}
          >
            {toast.type === 'success' ? '✓' : '!'}
          </div>

          <div>
            <strong style={{ color: '#163b70' }}>
              {toast.type === 'success'
                ? 'Success'
                : 'Error'}
            </strong>
            <div
              style={{
                color: '#64748b',
                fontSize: 13,
                marginTop: 4
              }}
            >
              {toast.message}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <div className="profile-stat-card">
      <span className="profile-stat-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="profile-info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfileLinkPanel({ title, text, button, path }) {
  return (
    <section className="profile-panel profile-link-panel">
      <h2>{title}</h2>
      <p>{text}</p>
      <button
        type="button"
        onClick={() => {
          window.location.href = path;
        }}
      >
        {button} →
      </button>
    </section>
  );
}

export default CitizenProfilePage;
