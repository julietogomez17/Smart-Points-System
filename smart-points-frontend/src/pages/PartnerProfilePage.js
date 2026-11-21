
import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const EMPTY_PASSWORD = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};
const PARTNER_BARANGAYS = [
  'Alang-Alang', 'Bakilid', 'Banilad', 'Basak',
  'Cabancalan', 'Cambaro', 'Canduman', 'Casili',
  'Casuntingan', 'Centro', 'Cubacub', 'Guizo',
  'Ibabao-Estancia', 'Jagobiao', 'Labogon',
  'Looc', 'Maguikay', 'Mantuyong', 'Opao',
  'Pagsabungan', 'Paknaan', 'Subangdaku',
  'Tabok', 'Tawason', 'Tingub', 'Tipolo',
  'Umapad'
];

const getResubmitValues = (partner) => {
  const savedIdType = String(
    partner?.representative_id_type || ''
  );

  const isOther = savedIdType.startsWith('Other:');

  return {
    partner_name: partner?.organization_name || '',
    business_permit_number:
      partner?.business_permit_number || '',
    business_address: partner?.business_address || '',
    business_barangay: partner?.business_barangay || '',
    phone: partner?.phone || '',
    representative_id_type:
      isOther ? 'other' : savedIdType,
    other_id_type:
      isOther ? savedIdType.slice(6).trim() : '',
    id_number: partner?.representative_id_number || ''
  };
};

const styles = {
  page: {
    padding: '32px 24px 60px',
    background: '#f5f7fc',
    minHeight: '100vh'
  },
  container: {
    maxWidth: 1450,
    margin: '0 auto'
  },
  heading: {
    fontSize: 36,
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 8px'
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
    margin: '0 0 28px'
  },
  banner: {
    background:
      'linear-gradient(115deg, #2053b6 0%, #1762d5 65%, #256fe2 100%)',
    color: '#fff',
    borderRadius: 24,
    padding: '38px 42px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 30,
    minHeight: 180,
    boxShadow: '0 12px 30px rgba(30,86,180,0.12)',
    marginBottom: 28,
    position: 'relative',
    overflow: 'hidden'
  },
  avatar: {
    width: 115,
    height: 115,
    borderRadius: '50%',
    border: '5px solid #fff',
    background: '#dbeafe',
    color: '#1d4ed8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 46,
    fontWeight: 800,
    flexShrink: 0,
    position: 'relative',
    zIndex: 1
  },
  bannerInfo: {
    flex: '1 1 250px',
    position: 'relative',
    zIndex: 1,
    minWidth: 0
  },
  bannerName: {
    fontSize: 'clamp(24px, 3vw, 34px)',
    fontWeight: 800,
    margin: '10px 0',
    overflowWrap: 'anywhere'
  },
  bannerDetail: {
    fontSize: 14,
    margin: '7px 0',
    overflowWrap: 'anywhere'
  },
  tabBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    borderBottom: '1px solid #dce4f0',
    marginBottom: 24
  },
  card: {
    background: '#fff',
    border: '1px solid #e5eaf3',
    borderRadius: 18,
    padding: '26px',
    boxShadow: '0 5px 20px rgba(15,23,42,0.035)',
    marginBottom: 24,
    minWidth: 0
  },
  sectionTitle: {
    color: '#163b70',
    fontSize: 21,
    fontWeight: 800,
    margin: '0 0 6px'
  },
  sectionDescription: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 1.6,
    margin: '0 0 22px'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
    gap: 18
  },
  infoItem: {
    padding: '15px 17px',
    background: '#f8fafc',
    border: '1px solid #e8edf5',
    borderRadius: 12,
    minWidth: 0
  },
  fieldLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8
  },
  fieldValue: {
    color: '#1e293b',
    fontSize: 15,
    fontWeight: 700,
    overflowWrap: 'anywhere'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 15px',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    fontSize: 14,
    color: '#1e293b',
    background: '#fff',
    outlineColor: '#2563eb'
  },
  primaryButton: {
    border: 'none',
    borderRadius: 10,
    background: '#2563eb',
    color: '#fff',
    padding: '12px 20px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer'
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    background: '#fff',
    color: '#334155',
    padding: '12px 20px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer'
  },
  notice: {
    background: '#eff6ff',
    border: '1px solid #dbeafe',
    color: '#345b87',
    borderRadius: 12,
    padding: '13px 16px',
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 22
  }
};

function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.fieldLabel}>{label}</span>
      <div style={styles.fieldValue}>
        {value === null ||
        value === undefined ||
        value === ''
          ? 'Not provided'
          : value}
      </div>
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section style={styles.card}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <p style={styles.sectionDescription}>
        {description}
      </p>
      {children}
    </section>
  );
}

function PartnerProfilePage() {
  const [profileImage, setProfileImage] = useState('');
const [, setSelectedPicture] = useState(null);
const [uploadingPicture, setUploadingPicture] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeTab, setActiveTab] = useState('overview');
  // RESUBMISSION MODAL
const [showResubmitModal, setShowResubmitModal] =
  useState(false);

const [resubmitForm, setResubmitForm] = useState({});
const [resubmitFiles, setResubmitFiles] = useState({});
const [resubmitError, setResubmitError] = useState('');
const [submittingResubmission, setSubmittingResubmission] =
  useState(false);

  const [showPasswordModal, setShowPasswordModal] =
    useState(false);
  const [passwordForm, setPasswordForm] =
    useState(EMPTY_PASSWORD);
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] =
    useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const [toast, setToast] = useState(null);

  const notify = (type, message) => {
    setToast({
      id: Date.now(),
      type,
      message
    });
  };

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [toast]);

  const fetchProfile = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setLoadError('');

      const response = await api.get('/partners/profile');
      const partner = response.data.partner;

      if (!partner) {
        throw new Error('Partner profile not found.');
      }

     setProfile(partner);
    } catch (error) {
      console.error('LOAD PARTNER PROFILE ERROR:', error);

      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to load partner profile.';

      setLoadError(message);

     if (!showLoader) {
  setToast({
    id: Date.now(),
    type: 'error',
    message
  });
}
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

 useEffect(() => {
  fetchProfile();
}, [fetchProfile]);



const fetchPartnerPicture = async () => {
  try {
    const response = await api.get(
      '/partners/profile/picture',
      { responseType: 'blob' }
    );

    const imageUrl = URL.createObjectURL(response.data);

    setProfileImage((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return imageUrl;
    });
  } catch (error) {
    // No image uploaded yet.
    setProfileImage((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return '';
    });
  }
};

useEffect(() => {
  if (profile?.partner_id) {
    fetchPartnerPicture();
  }
}, [profile?.partner_id]);

useEffect(() => {
  return () => {
    if (profileImage) URL.revokeObjectURL(profileImage);
  };
}, [profileImage]);

const handlePictureUpload = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';

  if (!file) return;

  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(
      file.type
    )
  ) {
    notify('error', 'Only JPG, PNG and WebP images are allowed.');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    notify('error', 'Profile picture must not exceed 5 MB.');
    return;
  }

  try {
    setUploadingPicture(true);
    setSelectedPicture(file);

    const formData = new FormData();
    formData.append('profile_picture', file);

    await api.put(
      '/partners/profile/picture',
      formData
    );

   await fetchPartnerPicture();

// Notify Navbar that the profile picture changed.
window.dispatchEvent(new Event('auth-changed'));

notify(
  'success',
  'Establishment profile picture updated successfully.'
);
  } catch (error) {
    notify(
      'error',
      error.response?.data?.message ||
        'Failed to upload profile picture.'
    );
  } finally {
    setUploadingPicture(false);
    setSelectedPicture(null);
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
      setPasswordError('Enter your current password.');
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

    if (newPassword === currentPassword) {
      setPasswordError(
        'New password must be different from your current password.'
      );
      return;
    }

    try {
      setChangingPassword(true);

      await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });

      setShowPasswordModal(false);
      setPasswordForm(EMPTY_PASSWORD);

      notify('success', 'Password changed successfully.');
    } catch (error) {
      console.error('CHANGE PASSWORD ERROR:', error);

      setPasswordError(
        error.response?.data?.message ||
          'Unable to change password.'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  // =====================================================
// ESTABLISHMENT RESUBMISSION MODAL
// =====================================================

const openResubmitModal = () => {
  if (!profile || profile.partner_status !== 'rejected') {
    return;
  }

  setResubmitForm(getResubmitValues(profile));
  setResubmitFiles({});
  setResubmitError('');
  setShowResubmitModal(true);
};

const closeResubmitModal = () => {
  if (submittingResubmission) return;

  setShowResubmitModal(false);
  setResubmitError('');
  setResubmitFiles({});
};

const handleResubmitChange = (event) => {
  const { name, value } = event.target;

  setResubmitForm((previous) => ({
    ...previous,
    [name]: value
  }));

  setResubmitError('');
};

const handleResubmitFile = (event) => {
  const { name, files } = event.target;
  const file = files?.[0];

  if (!file) {
    setResubmitFiles((previous) => ({
      ...previous,
      [name]: null
    }));
    return;
  }

  const allowedTypes =
    name === 'storefront_photo'
      ? ['image/jpeg', 'image/png']
      : ['image/jpeg', 'image/png', 'application/pdf'];

  if (!allowedTypes.includes(file.type)) {
    setResubmitError(
      'Invalid file type. Please select a supported document.'
    );
    event.target.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setResubmitError(
      'Each verification document must be 5 MB or smaller.'
    );
    event.target.value = '';
    return;
  }

  setResubmitFiles((previous) => ({
    ...previous,
    [name]: file
  }));

  setResubmitError('');
};

// Escape closes the modal.
// Disable background scrolling while modal is open.
useEffect(() => {
  if (!showResubmitModal) return;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const handleEscape = (event) => {
    if (event.key === 'Escape' && !submittingResubmission) {
      setShowResubmitModal(false);
    }
  };

  document.addEventListener('keydown', handleEscape);

  return () => {
    document.body.style.overflow = previousOverflow;
    document.removeEventListener('keydown', handleEscape);
  };
}, [showResubmitModal, submittingResubmission]);

const handleResubmitApplication = async (event) => {
  event.preventDefault();

  if (submittingResubmission || !profile) return;

  const original = getResubmitValues(profile);
  const formData = new FormData();

  let hasChanges = false;

  const editableFields = [
    'partner_name',
    'business_permit_number',
    'business_address',
    'business_barangay',
    'phone',
    'id_number'
  ];

  for (const field of editableFields) {
    const current = String(
      resubmitForm[field] || ''
    ).trim();

    const saved = String(original[field] || '').trim();

    if (current !== saved) {
      formData.append(field, current);
      hasChanges = true;
    }
  }

  const currentIdType =
    resubmitForm.representative_id_type;

  const currentOtherType = String(
    resubmitForm.other_id_type || ''
  ).trim();

  if (
    currentIdType !== original.representative_id_type ||
    (
      currentIdType === 'other' &&
      currentOtherType !== original.other_id_type
    )
  ) {
    formData.append(
      'representative_id_type',
      currentIdType
    );

    if (currentIdType === 'other') {
      formData.append(
        'other_id_type',
        currentOtherType
      );
    }

    hasChanges = true;
  }

  // Only send documents the applicant wants to replace.
  for (const field of [
    'business_permit',
    'storefront_photo',
    'representative_id'
  ]) {
    if (resubmitFiles[field]) {
      formData.append(field, resubmitFiles[field]);
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    setResubmitError(
      'Please correct at least one detail or replace a verification document.'
    );
    return;
  }

  try {
    setSubmittingResubmission(true);
    setResubmitError('');

    const response = await api.post(
      '/auth/partner/resubmit',
      formData
    );

    if (!response.data?.success) {
      throw new Error('Resubmission was not confirmed.');
    }

    setShowResubmitModal(false);

    // Update the currently displayed profile.
    setProfile((previous) => ({
      ...previous,
      organization_name: resubmitForm.partner_name,
      business_permit_number:
        resubmitForm.business_permit_number,
      business_address: resubmitForm.business_address,
      business_barangay: resubmitForm.business_barangay,
      phone: resubmitForm.phone,
      representative_id_number: resubmitForm.id_number,
      representative_id_type:
        currentIdType === 'other'
          ? `Other: ${currentOtherType}`
          : currentIdType,
      partner_status: 'pending'
    }));

    // Refresh locally stored verification status.
    const storedUser = JSON.parse(
      localStorage.getItem('user') || 'null'
    );

    if (storedUser?.role === 'partner') {
      localStorage.setItem(
        'user',
        JSON.stringify({
          ...storedUser,
          partner_status: 'pending'
        })
      );

      window.dispatchEvent(new Event('auth-changed'));
    }

    setResubmitFiles({});

    notify(
      'success',
      'Application resubmitted successfully. Awaiting LGU review.'
    );

    await fetchProfile(false);

  } catch (error) {
    setResubmitError(
      error.response?.data?.message ||
      error.message ||
      'Unable to resubmit application. Please try again.'
    );

  } finally {
    setSubmittingResubmission(false);
  }
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
            Loading establishment profile...
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
            <h2>Establishment Profile</h2>
            <p>{loadError || 'Profile unavailable.'}</p>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => fetchProfile()}
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const organizationName =
    profile.organization_name || 'Establishment';

  const contactPerson =
    profile.contact_person ||
    profile.full_name ||
    'Not provided';

  const email =
    profile.organization_email ||
    profile.email ||
    'Not provided';

  const partnerStatus = String(
    profile.partner_status || 'pending'
  ).toLowerCase();

  const statusConfig =
    partnerStatus === 'active'
      ? {
          label: '✓ Verified',
          background: '#dcfce7',
          color: '#166534',
          border: '#86efac'
        }
      : partnerStatus === 'pending'
        ? {
            label: '◷ Pending',
            background: '#fef3c7',
            color: '#92400e',
            border: '#fcd34d'
          }
        : partnerStatus === 'rejected'
          ? {
              label: '✕ Rejected',
              background: '#fee2e2',
              color: '#991b1b',
              border: '#fecaca'
            }
          : {
              label: partnerStatus,
              background: '#e2e8f0',
              color: '#334155',
              border: '#cbd5e1'
            };

 const tabItems = [
  ['overview', 'Overview'],
  ['security', 'Account Security']
];

  return (
    <main
      className="partner-profile-page"
      style={styles.page}
    >
      <div style={styles.container}>
        {/* PAGE HEADING */}

        <header>
          <h1 style={styles.heading}>
            My Profile
          </h1>

         <p style={styles.subtitle}>
  View your establishment information and
  keep your CitiPoints account secure.
</p>
        </header>

        {/* BLUE PROFILE BANNER */}

        <section style={styles.banner}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              width: 340,
              height: 340,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              right: -65,
              top: -150
            }}
          />

          
<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
    zIndex: 1
  }}
>
  <div
    style={{
      ...styles.avatar,
      overflow: 'hidden'
    }}
  >
    {profileImage ? (
      <img
        src={profileImage}
        alt="Establishment profile"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
    ) : (
      organizationName.charAt(0).toUpperCase()
    )}
  </div>

  <label
    htmlFor="partner-profile-picture"
    style={{
      background: '#fff',
      color: '#1d4ed8',
      borderRadius: 10,
      padding: '8px 13px',
      fontSize: 12,
      fontWeight: 800,
      cursor: uploadingPicture ? 'wait' : 'pointer',
      textAlign: 'center'
    }}
  >
    {uploadingPicture ? 'Uploading...' : 'Change Photo'}
  </label>

  <input
    id="partner-profile-picture"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={handlePictureUpload}
    disabled={uploadingPicture}
    hidden
  />
</div>


          <div style={styles.bannerInfo}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <span
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  color: '#fff',
                  borderRadius: 20,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.5
                }}
              >
                Establishment 
              </span>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 20,
                  padding: '6px 13px',
                  fontSize: 12,
                  fontWeight: 800,
                  background: statusConfig.background,
                  color: statusConfig.color,
                  border: `1px solid ${statusConfig.border}`
                }}
              >
                {statusConfig.label}
              </span>
            </div>

            <h2 style={styles.bannerName}>
              {organizationName}
            </h2>

            <p style={styles.bannerDetail}>
              {email}
              {profile.phone ? `  •  ${profile.phone}` : ''}
            </p>

            <p style={styles.bannerDetail}>
              {profile.business_address ||
                profile.address ||
                'Business address not available'}
            </p>

            <p style={styles.bannerDetail}>
              Contact Person: {contactPerson}
            </p>

            {profile.created_at && (
              <p
                style={{
                  ...styles.bannerDetail,
                  opacity: 0.85
                }}
              >
                Partner since {formatDate(profile.created_at)}
              </p>
            )}
          </div>
        </section>

            {/* REJECTED ESTABLISHMENT NOTICE */}
{/* REJECTED ESTABLISHMENT NOTICE */}
{partnerStatus === 'rejected' && (
  <div className="cp-resubmit-rejected-notice">
    <div className="cp-resubmit-rejected-icon">
      ✕
    </div>

    <div className="cp-resubmit-rejected-info">
      <h3>Application Rejected</h3>

      <p>
        Your establishment application was not approved
        by the LGU Administrator. Review the remarks
        and correct the necessary details.
      </p>

      <div className="cp-resubmit-reason">
        <strong>Remarks from LGU Administrator</strong>

        <p>
          {profile.rejection_reason ||
            'No rejection reason was provided. Please contact the LGU Administrator.'}
        </p>
      </div>
    </div>

    <button
      type="button"
      className="cp-resubmit-open-button"
      onClick={openResubmitModal}
    >
      ↻ Resubmit Application
    </button>
  </div>
)}
        {/* TABS */}

        <nav style={styles.tabBar}>
          {tabItems.map(([key, label]) => (
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
                background: 'transparent',
                padding: '14px 18px',
                fontSize: 14,
                fontWeight: 700,
                color:
                  activeTab === key
                    ? '#1d4ed8'
                    : '#64748b',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* OVERVIEW TAB */}

        {activeTab === 'overview' && (
          <>
            <Section
              title="Organization Information"
              description="Your registered establishment information."
            >
              <div style={styles.notice}>
                🔒 Your registered organization information
                is read-only. Contact the LGU Administrator
                if any details need to be corrected.
              </div>

              <div style={styles.infoGrid}>
                <InfoItem
                  label="Establishment Name"
                  value={organizationName}
                />

                <InfoItem
                  label="Contact Person"
                  value={contactPerson}
                />

                <InfoItem
                  label="Organization Email"
                  value={email}
                />

                <InfoItem
                  label="Contact Number"
                  value={profile.phone}
                />

                <InfoItem
                  label="Business Address"
                  value={
                    profile.business_address ||
                    profile.address
                  }
                />

                <InfoItem
                  label="Barangay"
                  value={
                    profile.business_barangay ||
                    profile.barangay
                  }
                />

                <InfoItem
                  label="Business Permit Number"
                  value={profile.business_permit_number}
                />

                <InfoItem
                  label="Approval Status"
                  value={statusConfig.label}
                />
              </div>
            </Section>

            <Section
              title="Account Information"
              description="Information about the account used to access CitiPoints."
            >
              <div style={styles.infoGrid}>
                <InfoItem
                  label="Account Holder"
                  value={profile.full_name}
                />

                <InfoItem
                  label="Email Address"
                  value={profile.email}
                />

                <InfoItem
                  label="Account Role"
                  value="Establishment "
                />

                <InfoItem
                  label="Account Status"
                  value={
                    profile.account_status ||
                    'Not available'
                  }
                />

                {profile.created_at && (
                  <InfoItem
                    label="Date Joined"
                    value={formatDate(profile.created_at)}
                  />
                )}
              </div>
            </Section>

            <Section
              title="Account Security"
              description="Protect your establishment account."
            >
              <button
                type="button"
                style={styles.primaryButton}
                onClick={openPasswordModal}
              >
                Change Password
              </button>
            </Section>
          </>
        )}

    


        {/* SECURITY TAB */}

        {activeTab === 'security' && (
          <>
            <Section
              title="Account Security"
              description="Manage the password for your CitiPoints establishment account."
            >
              <div style={styles.notice}>
                🔒 Your password is private. CitiPoints
                requires your current password before
                allowing you to set a new one.
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 20
                }}
              >
                <div>
                  <strong
                    style={{
                      color: '#1e293b',
                      display: 'block',
                      marginBottom: 6
                    }}
                  >
                    Password
                  </strong>

                  <span
                    style={{
                      color: '#64748b',
                      fontSize: 14
                    }}
                  >
                    Change your account password securely.
                  </span>
                </div>

                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={openPasswordModal}
                >
                  Change Password
                </button>
              </div>
            </Section>

            <Section
              title="Registered Information"
              description="Your establishment identity and registration information are protected."
            >
              <div style={styles.notice}>
                Your registered establishment name,
                representative details, contact information,
                and business address cannot be changed
                through this page.
              </div>

              <div style={styles.infoGrid}>
                <InfoItem
                  label="Establishment"
                  value={organizationName}
                />
                <InfoItem
                  label="Registered Email"
                  value={email}
                />
                <InfoItem
                  label="Partner Status"
                  value={statusConfig.label}
                />
              </div>
            </Section>
          </>
        )}
      </div>
        {/* =====================================================
    RESUBMIT APPLICATION MODAL
===================================================== */}

{showResubmitModal && partnerStatus === 'rejected' && (
  <div
    className="cp-resubmit-overlay"
    onClick={(event) => {
      // Clicking the dark area closes the modal.
      // Clicking inside the modal does not.
      if (
        event.target === event.currentTarget &&
        !submittingResubmission
      ) {
        closeResubmitModal();
      }
    }}
  >
    <div
      className="cp-resubmit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cp-resubmit-modal-title"
      onClick={(event) => event.stopPropagation()}
    >
      {/* HEADER */}
      <div className="cp-resubmit-modal-header">
        <div>
          <h2 id="cp-resubmit-modal-title">
            Resubmit Application
          </h2>

          <p>
            Correct your establishment information or
            replace verification documents.
          </p>
        </div>

        <button
          type="button"
          className="cp-resubmit-close"
          onClick={closeResubmitModal}
          disabled={submittingResubmission}
          aria-label="Close resubmission modal"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleResubmitApplication}>
        <div className="cp-resubmit-modal-content">

          {/* ORGANIZATION INFORMATION */}
          <h3 className="cp-resubmit-section-title">
            Establishment Information
          </h3>

          <div className="cp-resubmit-form-grid">

            <label>
              Establishment Name *
              <input
                type="text"
                name="partner_name"
                required
                maxLength={150}
                value={resubmitForm.partner_name || ''}
                onChange={handleResubmitChange}
              />
            </label>

            <label>
              Business Permit Number *
              <input
                type="text"
                name="business_permit_number"
                required
                maxLength={100}
                value={
                  resubmitForm.business_permit_number || ''
                }
                onChange={handleResubmitChange}
              />
            </label>

            <label className="cp-resubmit-full-width">
              Business Address *
              <input
                type="text"
                name="business_address"
                required
                maxLength={255}
                value={resubmitForm.business_address || ''}
                onChange={handleResubmitChange}
              />
            </label>

            <label>
              Business Barangay *
              <select
                name="business_barangay"
                required
                value={resubmitForm.business_barangay || ''}
                onChange={handleResubmitChange}
              >
                <option value="">Select Barangay</option>

                {PARTNER_BARANGAYS.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Contact Number *
              <input
                type="tel"
                name="phone"
                required
                maxLength={11}
                pattern="09[0-9]{9}"
                value={resubmitForm.phone || ''}
                onChange={handleResubmitChange}
              />
            </label>
          </div>

          {/* REPRESENTATIVE INFORMATION */}
          <h3 className="cp-resubmit-section-title">
            Representative Information
          </h3>

          <div className="cp-resubmit-form-grid">

            <label>
              Representative ID Type *
              <select
                name="representative_id_type"
                required
                value={
                  resubmitForm.representative_id_type || ''
                }
                onChange={handleResubmitChange}
              >
                <option value="">Select ID Type</option>
                <option value="national_id">
                  National ID
                </option>
                <option value="drivers_license">
                  Driver's License
                </option>
                <option value="voters_id">
                  Voter's ID
                </option>
                <option value="senior_citizen_id">
                  Senior Citizen ID
                </option>
                <option value="other">
                  Others
                </option>
              </select>
            </label>

            <label>
              Representative ID Number *
              <input
                type="text"
                name="id_number"
                required
                minLength={3}
                maxLength={50}
                value={resubmitForm.id_number || ''}
                onChange={handleResubmitChange}
              />
            </label>

            {resubmitForm.representative_id_type ===
              'other' && (
              <label className="cp-resubmit-full-width">
                Specify ID Type *
                <input
                  type="text"
                  name="other_id_type"
                  required
                  minLength={3}
                  maxLength={40}
                  value={resubmitForm.other_id_type || ''}
                  onChange={handleResubmitChange}
                  placeholder="Enter government-issued ID type"
                />
              </label>
            )}
          </div>

          {/* VERIFICATION DOCUMENTS */}
          <h3 className="cp-resubmit-section-title">
            Verification Documents
          </h3>

          <p className="cp-resubmit-document-help">
            Upload only documents that need replacing.
            Leave other uploads empty to keep the existing
            documents.
          </p>

          <div className="cp-resubmit-document-list">

            {[
              [
                'business_permit',
                'Business Permit',
                'JPG, PNG or PDF'
              ],
              [
                'storefront_photo',
                'Storefront Photo',
                'JPG or PNG'
              ],
              [
                'representative_id',
                'Representative ID',
                'JPG, PNG or PDF'
              ]
            ].map(([name, label, formats]) => (
              <div
                key={name}
                className="cp-resubmit-document-item"
              >
                <div>
                  <strong>{label}</strong>
                  <small>
                    {formats} — Maximum 5 MB
                  </small>
                </div>

                <input
                  type="file"
                  name={name}
                  accept={
                    name === 'storefront_photo'
                      ? 'image/jpeg,image/png'
                      : 'image/jpeg,image/png,application/pdf'
                  }
                  onChange={handleResubmitFile}
                />

                {resubmitFiles[name] && (
                  <small className="cp-resubmit-selected-file">
                    Selected: {resubmitFiles[name].name}
                  </small>
                )}
              </div>
            ))}
          </div>

          {resubmitError && (
            <div
              className="cp-resubmit-error"
              role="alert"
            >
              {resubmitError}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="cp-resubmit-modal-footer">
          <button
            type="button"
            className="cp-resubmit-cancel"
            onClick={closeResubmitModal}
            disabled={submittingResubmission}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="cp-resubmit-submit"
            disabled={submittingResubmission}
          >
            {submittingResubmission
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
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-password-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              background: '#fff',
              width: '100%',
              maxWidth: 440,
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 22,
              padding: '28px',
              boxSizing: 'border-box',
              boxShadow: '0 25px 70px rgba(0,0,0,0.2)'
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#dbeafe',
                color: '#2563eb',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 18px',
                fontSize: 28
              }}
            >
              🔒
            </div>

            <h2
              id="partner-password-title"
              style={{
                textAlign: 'center',
                color: '#163b70',
                margin: '0 0 10px'
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
              ].map(([key, label]) => (
                <div
                  key={key}
                  style={{ marginBottom: 18 }}
                >
                  <label
                    htmlFor={`partner-${key}`}
                    style={{
                      ...styles.fieldLabel,
                      color: '#334155',
                      fontWeight: 700
                    }}
                  >
                    {label}
                  </label>

                  <input
                    id={`partner-${key}`}
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
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: '#475569',
                  marginBottom: 16,
                  cursor: 'pointer'
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
                Your new password must contain at least
                12 characters.
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: 12
                }}
              >
                <button
                  type="button"
                  disabled={changingPassword}
                  style={{
                    ...styles.secondaryButton,
                    flex: 1
                  }}
                  onClick={closePasswordModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={changingPassword}
                  style={{
                    ...styles.primaryButton,
                    flex: 1
                  }}
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

      {/* TOAST NOTIFICATION */}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 100000,
            background: '#fff',
            width: 'min(360px, calc(100vw - 48px))',
            boxSizing: 'border-box',
            borderRadius: 14,
            padding: '16px 18px',
            boxShadow: '0 15px 45px rgba(0,0,0,0.16)',
            borderLeft: `5px solid ${
              toast.type === 'success'
                ? '#16a34a'
                : '#dc2626'
            }`,
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
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              fontWeight: 800
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

export default PartnerProfilePage;
