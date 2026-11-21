import React, { useEffect, useState } from 'react';
import api from '../services/api';
import LocationPickerModal from '../components/LocationPickerModal';
import ActivityImageUpload from '../components/ActivityImageUpload';
import CitizenQrScanner from '../components/CitizenQrScanner';
import MyParticipationsPage from './MyParticipationPage';


const API_BASE_URL = (
  api.defaults.baseURL || 'http://localhost:5000/api'
).replace(/\/+$/, '');

const BACKEND_ORIGIN = new URL(
  API_BASE_URL,
  window.location.origin
).origin;

const getActivityImageUrl = (imageUrl) => {
  if (!imageUrl) return null;

  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://')
  ) {
    return imageUrl;
  }

  return `${BACKEND_ORIGIN}/${imageUrl.replace(/^\/+/, '')}`;
};



function ActivitiesPage() {
  const [proofModalActivityId, setProofModalActivityId] = useState(null);

  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [unregisteringActivity, setUnregisteringActivity] = useState(false);
  
const [activityToRegister, setActivityToRegister] = useState(null);
const [isRegistering, setIsRegistering] = useState(false);
const [showActivityDetails, setShowActivityDetails] = useState(false);
const [detailsActivity, setDetailsActivity] = useState(null);


  const [showParticipationModal, setShowParticipationModal] =
    useState(false);

  const [showProofForm, setShowProofForm] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  /* CITIZEN FILTERS */
  const [activitySearch, setActivitySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [sortOrder, setSortOrder] = useState('latest');

  const [userRole, setUserRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const storedUser = JSON.parse(
  localStorage.getItem('user') || '{}'
);

const isCitizenVerified =
  storedUser.verification_status === 'verified';

  /* EDIT ACTIVITY */
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);

  /* PARTICIPANTS */
  const [showParticipantsModal, setShowParticipantsModal] =
    useState(false);

  const [participants, setParticipants] = useState([]);

  // QR CODE DISPLAY
const [showQrModal, setShowQrModal] = useState(false);
const [qrActivity, setQrActivity] = useState(null);
const [qrCodes, setQrCodes] = useState(null);
const [qrLoading, setQrLoading] = useState(false);
const [qrError, setQrError] = useState('');


// CITIZEN QR SCANNER
const [showCitizenScanner, setShowCitizenScanner] = useState(false);
const [scannerActivity, setScannerActivity] = useState(null);
const [scannerSubmitting, setScannerSubmitting] = useState(false);
const [scannerMessage, setScannerMessage] = useState('');
const [scannerResult, setScannerResult] = useState(null);

  /* ADMIN / PARTNER TABS */
  const [adminActivityTab, setAdminActivityTab] =
    useState('active');

  /* CREATE ACTIVITY */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createImageFile, setCreateImageFile] = useState(null);
const [editImageFile, setEditImageFile] = useState(null);

  const [mapTarget, setMapTarget] = useState(null);

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    image_url: '',
    category: '',
    location: '',
    latitude: null,
    longitude: null,
    coverage_radius_m: 500,
    date_start: '',
    date_end: '',
    points_value: '',
    capacity: '',
    validation_type: 'qr',
    status: 'open'
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));

    setUserRole(user?.role);
    setCurrentUserId(user?.user_id ?? null);

    fetchActivities();

    const interval = setInterval(() => {
      fetchActivities();
    }, 5000);

    return () => clearInterval(interval);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =====================================================
     LOAD ACTIVITIES
     ===================================================== */

 const fetchActivities = async () => {
  try {
    const res = await api.get('/activities');

    const data = res.data.activities || [];

    setActivities(data);

    const params = new URLSearchParams(
      window.location.search
    );

    const activityId = params.get('activity');

    if (activityId) {
      const activityFromDashboard = data.find(
        (activity) =>
          Number(activity.activity_id) ===
          Number(activityId)
      );

      if (activityFromDashboard) {
        setSelectedActivity(activityFromDashboard);
        return;
      }
    }

    setSelectedActivity((prevSelected) => {
      if (!prevSelected) {
        return data[0] || null;
      }

      return (
        data.find(
          (activity) =>
            activity.activity_id ===
            prevSelected.activity_id
        ) || prevSelected
      );
    });
  } catch (error) {
    alert(
      error.response?.data?.message ||
        'Failed to load activities'
    );
  }
};

  /* =====================================================
     CREATE ACTIVITY
     ===================================================== */

  const handleCreateChange = (e) => {
    setCreateForm({
      ...createForm,
      [e.target.name]: e.target.value
    });
  };

  const resetCreateForm = () => {
    setCreateForm({
      title: '',
      description: '',
      image_url: '',
      category: '',
      location: '',
      latitude: null,
      longitude: null,
      coverage_radius_m: 500,
      date_start: '',
      date_end: '',
      points_value: '',
      capacity: '',
      validation_type: 'manual',
      status: 'open'
        
      
     });

  setCreateImageFile(null);
};

const handleCreateActivity = async (e) => {
  e.preventDefault();

  const now = new Date();
  const startDate = new Date(createForm.date_start);
  const endDate = new Date(createForm.date_end);

  if (
    !createForm.date_start ||
    !createForm.date_end ||
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime())
  ) {
    alert('Please enter valid start and end dates.');
    return;
  }

  if (startDate <= now) {
    alert('Activity start date and time must be in the future.');
    return;
  }

  if (endDate <= startDate) {
    alert('Activity end date and time must be later than the start date.');
    return;
  }

  if (
    createForm.latitude == null ||
    createForm.longitude == null
  ) {
    alert('Please select an activity location on the map.');
    return;
  }

  try {
    const payload = {
      title: createForm.title,
      description: createForm.description || '',
      category: createForm.category || '',
      location: createForm.location || '',
      latitude: createForm.latitude,
      longitude: createForm.longitude,
      coverage_radius_m: Number(createForm.coverage_radius_m),
      date_start: createForm.date_start,
      date_end: createForm.date_end,
      points_value: Number(createForm.points_value),
      capacity:
        createForm.capacity === ''
          ? ''
          : Number(createForm.capacity),
     validation_type: 'qr',
      status: createForm.status
    };

    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    if (createImageFile) {
      formData.append('activity_image', createImageFile);
    }

    const res = await api.post('/activities', formData);

    alert(
      res.data.message || 'Activity created successfully'
    );

    resetCreateForm();
    setShowCreateModal(false);
    await fetchActivities();
  } catch (error) {
    console.error('Create activity error:', error);

    alert(
      error.response?.data?.message ||
      error.response?.data?.error ||
      'Failed to create activity'
    );
  }
};




const handleUnregisterActivity = async (activityId) => {
  if (!activityId || unregisteringActivity) return;

  try {
    setUnregisteringActivity(true);

    await api.delete(`/activities/${activityId}/join`);

    setShowParticipationModal(false);

    setActivities((previous) =>
      previous.map((activity) =>
        activity.activity_id === activityId
          ? {
              ...activity,
              is_joined: false,
              registration_status: null,
              participation_status: null
            }
          : activity
      )
    );

    await fetchActivities();

    alert('You have successfully unregistered from the activity.');
  } catch (error) {
    alert(
      error.response?.data?.message ||
      'Failed to unregister from the activity.'
    );
  } finally {
    setUnregisteringActivity(false);
  }
};



const openRegistrationConfirmation = (activity) => {
  if (!isCitizenVerified) {
  alert(
    'Account verification is required before joining activities.'
  );
  return;
}
  if (isRegistering || activity.is_joined || activity.status !== 'open') {
    return;
  }

  const capacity =
    activity.capacity == null || activity.capacity === ''
      ? null
      : Number(activity.capacity);

  if (
    capacity !== null &&
    Number(activity.joined_count || 0) >= capacity
  ) {
    alert('This activity is already full.');
    return;
  }

  setActivityToRegister(activity);
};

const closeRegistrationConfirmation = () => {
  if (isRegistering) return;
  setActivityToRegister(null);
};


const confirmActivityRegistration = async () => {
  if (!activityToRegister || isRegistering) return;

  setIsRegistering(true);

  try {
    const success = await handleRegister(
      activityToRegister.activity_id
    );

    if (success) {
      setActivityToRegister(null);
    }
  } finally {
    setIsRegistering(false);
  }
};




  /* =====================================================
     CITIZEN REGISTER
     ===================================================== */

  const handleRegister = async (activityId) => {
    if (!isCitizenVerified) {
  alert(
    'Your account must be verified by the LGU Administrator before you can register for activities.'
  );
  return false;
}
    const clickedActivity = activities.find(
      (activity) =>
        activity.activity_id === activityId
    );

    try {
      await api.post(
        `/activities/${activityId}/join`
      );

      setActivities((previous) =>
        previous.map((activity) =>
          activity.activity_id === activityId
            ? {
                ...activity,
                is_joined: true,
                participation_status: 'pending'
              }
            : activity
        )
      );

      setSelectedActivity({
        ...clickedActivity,
        is_joined: true,
        participation_status: 'pending'
      });

      setShowParticipationModal(true);

      fetchActivities();
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        setActivities((previous) =>
          previous.map((activity) =>
            activity.activity_id === activityId
              ? {
                  ...activity,
                  is_joined: true,
                  participation_status: 'pending'
                }
              : activity
          )
        );

        setSelectedActivity({
          ...clickedActivity,
          is_joined: true,
          participation_status: 'pending'
        });

        setShowParticipationModal(true);

        return true;
      }

      alert(
        error.response?.data?.message ||
          'Failed to register activity'
      );
      return false;
    }
  };

  /* =====================================================
     PROOF SUBMISSION
     ===================================================== */

 

 
const submitProofForm = async () => {
  if (isSubmittingProof) return;

  if (!isCitizenVerified) {
    alert(
      'Your account must be verified before submitting participation proof.'
    );
    return;
  }

  if (!proofFile) {
    alert('Please select a participation proof image.');
    return;
  }

  if (!selectedActivity?.activity_id) {
    alert('Please select an activity first.');
    return;
  }

  setIsSubmittingProof(true);

  try {
    // ======================================
    // 1. GET CITIZEN'S CURRENT GPS LOCATION
    // ======================================

    const getCurrentGps = () =>
      new Promise((resolve) => {
        if (
          !window.isSecureContext ||
          !navigator.geolocation
        ) {
          resolve({
            available: false,
            reason: 'Location is unavailable in this browser or connection.'
          });
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const {
              latitude,
              longitude,
              accuracy
            } = position.coords;

            resolve({
              available: true,
              photo_lat: latitude,
              photo_lng: longitude,
              gps_accuracy_meters: accuracy
            });
          },

          (error) => {
            console.warn(
              'CitiPoints GPS unavailable:',
              error.message
            );

            resolve({
              available: false,
              reason: error.message
            });
          },

          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });

    const gps = await getCurrentGps();

    // ======================================
    // 2. PREPARE PARTICIPATION DATA
    // ======================================

    const formData = new FormData();

    formData.append('proof_file', proofFile);

    formData.append(
      'feedback_text',
      feedbackText
    );

    formData.append(
      'activity_id',
      String(selectedActivity.activity_id)
    );

    // Send GPS only when valid.
    // Missing GPS will be independently flagged
    // for LGU administrator review.

    if (gps.available) {
      formData.append(
        'photo_lat',
        String(gps.photo_lat)
      );

      formData.append(
        'photo_lng',
        String(gps.photo_lng)
      );

      formData.append(
        'gps_accuracy_meters',
        String(gps.gps_accuracy_meters)
      );
    }

    // ======================================
    // 3. SEND TO NODE.JS BACKEND
    // ======================================

    const response = await api.post(
      '/participations',
      formData
    );

    // ======================================
    // 4. DISPLAY SUBMISSION RESULT
    // ======================================

    const result = response.data;

    console.log(
      'CitiPoints Participation AI Assessment:',
      result.ai
    );

    if (result.status === 'pending') {
      alert(
        'Participation proof submitted successfully.\n\n' +
        'Status: Pending LGU Administrator review.\n' +
        'Smart Points will be awarded only after approval.'
      );
    } else {
      alert(
        result.message ||
        'Participation proof submitted successfully.'
      );
    }

    // ======================================
    // 5. RESET PROOF FORM
    // ======================================

    setShowProofForm(false);
    setProofFile(null);
    setFeedbackText('');

    await fetchActivities();

  } catch (error) {
    console.error(
      'CitiPoints participation submission error:',
      error
    );

    alert(
      error.response?.data?.message ||
      'Failed to submit participation proof.'
    );

  } finally {
    setIsSubmittingProof(false);
  }
};





  /* =====================================================
     EDIT ACTIVITY
     ===================================================== */

  const formatForDateTimeInput = (date) => {
    if (!date) return '';

    const d = new Date(date);

    const offset = d.getTimezoneOffset();

    const local = new Date(
      d.getTime() - offset * 60000
    );

    return local
      .toISOString()
      .slice(0, 16);
  };

  const handleEdit = (activity) => {
    setEditForm({
      activity_id:
        activity.activity_id,

      title:
        activity.title || '',

      description:
        activity.description || '',

      category:
        activity.category || '',

      location:
        activity.location || '',
        latitude: activity.latitude ?? null,
        longitude: activity.longitude ?? null,
        coverage_radius_m: Number(activity.coverage_radius_m ?? 500),

      date_start:
        formatForDateTimeInput(
          activity.date_start
        ),

      date_end:
        formatForDateTimeInput(
          activity.date_end
        ),

      points_value:
        activity.points_value || '',

      capacity:
        activity.capacity || '',

      validation_type:
        activity.validation_type ||
        'qr',

      status:
        activity.status || 'open',

      partner_id:
        activity.partner_id ?? '',

      image_url:
        activity.image_url || ''
    });

    setEditImageFile(null);

    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]:
        e.target.value
    });
  };

  
const handleUpdateActivity = async () => {
  if (!editForm) return;

  if (
    editForm.latitude == null ||
    editForm.longitude == null
  ) {
    alert('Please select an activity location on the map.');
    return;
  }

  const toMysqlDateTime = (value) => {
    if (!value) return null;

    return value.replace('T', ' ') +
      (value.length === 16 ? ':00' : '');
  };

  try {
    const payload = {
      title: editForm.title,
      description: editForm.description,
      category: editForm.category,
      location: editForm.location,
      latitude: editForm.latitude,
      longitude: editForm.longitude,
      coverage_radius_m: Number(editForm.coverage_radius_m),
      date_start: toMysqlDateTime(editForm.date_start),
      date_end: toMysqlDateTime(editForm.date_end),
      points_value: Number(editForm.points_value),
      capacity:
        editForm.capacity === ''
          ? ''
          : Number(editForm.capacity),
      validation_type: 'qr',
      status: editForm.status
    };

    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    if (editImageFile) {
      formData.append('activity_image', editImageFile);
    }

    await api.put(
      `/activities/${editForm.activity_id}`,
      formData
    );

    alert('Activity updated successfully');

    setEditImageFile(null);
    setShowEditModal(false);
    await fetchActivities();
  } catch (error) {
    console.error('Update activity error:', error);

    alert(
      error.response?.data?.message ||
      error.response?.data?.error ||
      'Failed to update activity'
    );
  }
};




  /* =====================================================
     DEACTIVATE ACTIVITY
     ===================================================== */

  const handleDeactivate = async (
    activityId
  ) => {
    const confirmDeactivate =
      window.confirm(
        'Are you sure you want to deactivate/cancel this activity?'
      );

    if (!confirmDeactivate) return;

    try {
      await api.delete(
        `/activities/${activityId}`
      );

      alert(
        'Activity deactivated successfully'
      );

      fetchActivities();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          'Failed to deactivate activity'
      );
    }
  };


  /* =====================================================
     ACTIVITY QR CODES — ADMIN AND PARTNER
     ===================================================== */

  const handleViewQrCodes = async (activity) => {
    if (qrLoading) return;

    setQrActivity(activity);
    setQrCodes(null);
    setQrError('');
    setShowQrModal(true);
    setQrLoading(true);

    try {
     const response = await api.get(
  `/activities/${activity.activity_id}/qr-codes`
);

      if (
        !response.data?.check_in_qr ||
        !response.data?.check_out_qr
      ) {
        throw new Error('QR images were not returned by the server.');
      }

      setQrCodes({
        checkIn: response.data.check_in_qr,
        checkOut: response.data.check_out_qr
      });
    } catch (error) {
      setQrError(
        error.response?.data?.message ||
        error.message ||
        'Failed to generate activity QR codes.'
      );
    } finally {
      setQrLoading(false);
    }
  };


const downloadActivityQr = (qrDataUrl, type) => {
  if (!qrDataUrl || !qrDataUrl.startsWith("data:image/png;base64,")) {
    alert("QR code is not available for download.");
    return;
  }

  const activityId = qrActivity?.activity_id || "activity";

  const link = document.createElement("a");
  link.href = qrDataUrl;
  link.download = `CitiPoints_Activity_${activityId}_${type}_QR.png`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


  const closeQrModal = () => {
    if (qrLoading) return;

    setShowQrModal(false);
    setQrActivity(null);
    setQrCodes(null);
    setQrError('');
  };


/* ==========================================
   CITIZEN QR SCANNING
   ========================================== */

const openCitizenScanner = (activity) => {
  if (userRole !== 'community_member') return;

  if (!isCitizenVerified) {
    alert('Your citizen account must be verified first.');
    return;
  }

  if (!activity.is_joined) {
    alert('Register for this activity before scanning.');
    return;
  }

  setScannerActivity(activity);
  setScannerMessage('');
  setScannerResult(null);
  setScannerSubmitting(false);
  setShowParticipationModal(false);
  setShowCitizenScanner(true);
};

const closeCitizenScanner = () => {
  if (scannerSubmitting) return;

  setShowCitizenScanner(false);
  setScannerActivity(null);
  setScannerMessage('');
  setScannerResult(null);
};

const handleCitizenQrScan = async (decodedText) => {
  if (!scannerActivity || scannerSubmitting) return;

  setScannerSubmitting(true);
  setScannerMessage('Verifying QR code...');

  try {
    let qrData;

    try {
      qrData = JSON.parse(decodedText);
    } catch {
      throw new Error('This is not a valid CitiPoints QR code.');
    }

    if (
      !qrData ||
      typeof qrData !== 'object' ||
      Array.isArray(qrData) ||
      !['check_in', 'check_out'].includes(qrData.type) ||
      !/^[a-fA-F0-9]{64}$/.test(qrData.token || '')
    ) {
      throw new Error('Invalid CitiPoints QR code.');
    }

    if (
      Number(qrData.activity_id) !==
      Number(scannerActivity.activity_id)
    ) {
      throw new Error(
        'This QR code belongs to another activity.'
      );
    }

    const endpoint =
      qrData.type === 'check_in'
        ? 'check-in'
        : 'check-out';

    const response = await api.post(
      `/activities/${scannerActivity.activity_id}/${endpoint}`,
      {
        qr_data: decodedText
      }
    );

    setScannerResult({
      success: true,
      type: qrData.type
    });

    setScannerMessage(
      response.data?.message ||
      (qrData.type === 'check_in'
        ? 'Check-In successful!'
        : 'Check-Out successful!')
    );

    await fetchActivities();

  } catch (error) {
    setScannerResult({
      success: false
    });

    setScannerMessage(
      error.response?.data?.message ||
      error.message ||
      'Unable to verify QR code.'
    );
  } finally {
    setScannerSubmitting(false);
  }
};


  /* =====================================================
     VIEW PARTICIPANTS
     ===================================================== */

  const handleViewParticipants = async (
    activityId
  ) => {
    try {
      const res = await api.get(
        `/participations/activity/${activityId}`
      );

      setParticipants(
        res.data.participants || []
      );

      setShowParticipantsModal(true);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          'Failed to fetch participants'
      );
    }
  };

  /* =====================================================
     FORMATTERS
     ===================================================== */

  const formatDate = (date) => {
    if (!date) return 'N/A';

    return new Date(
      date
    ).toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }
    );
  };

  const formatTime = (date) => {
    if (!date) return 'N/A';

    return new Date(
      date
    ).toLocaleTimeString(
      'en-US',
      {
        hour: 'numeric',
        minute: '2-digit'
      }
    );
  };

const getActivityDisplayStatus = (activity) => {
  const status = String(activity.status || 'open').toLowerCase();

  // Respect manually closed or cancelled activities.
  if (status === 'cancelled') return 'cancelled';
  if (status === 'closed') return 'closed';
  if (status === 'completed') return 'completed';

  const now = Date.now();

  const startTime = activity.date_start
    ? new Date(activity.date_start).getTime()
    : NaN;

  const endTime = activity.date_end
    ? new Date(activity.date_end).getTime()
    : NaN;

  if (Number.isFinite(endTime) && now >= endTime) {
    return 'completed';
  }

  if (Number.isFinite(startTime) && now < startTime) {
    return 'upcoming';
  }

  if (
    Number.isFinite(startTime) &&
    now >= startTime &&
    (!Number.isFinite(endTime) || now < endTime)
  ) {
    return 'ongoing';
  }

  return status;
};



  /* =====================================================
     ACTIVITY FILTERING
     ===================================================== */

 
const activeActivities =
  userRole === 'admin' || userRole === 'partner' || userRole === 'lgu'
    ? activities.filter((activity) =>
        adminActivityTab === 'active'
          ? activity.status !== 'closed' &&
            activity.status !== 'cancelled' &&
            activity.status !== 'completed'
          : activity.status === 'closed' ||
            activity.status === 'cancelled' ||
            activity.status === 'completed'
      )
    : activities

          .filter((activity) => {
            const search =
              activitySearch
                .trim()
                .toLowerCase();

            const matchesSearch =
              !search ||
              (activity.title || '')
                .toLowerCase()
                .includes(search) ||
              (activity.description || '')
                .toLowerCase()
                .includes(search) ||
              (activity.location || '')
                .toLowerCase()
                .includes(search) ||
              (activity.category || '')
                .toLowerCase()
                .includes(search);

            const matchesCategory =
              categoryFilter === 'all' ||
              (activity.category || '')
                .toLowerCase() ===
                categoryFilter.toLowerCase();

            const matchesStatus =
              statusFilter === 'all' ||
              activity.status ===
                statusFilter;

            const startDate =
              activity.date_start
                ? new Date(
                    activity.date_start
                  )
                : null;

            const now = new Date();

            let matchesDate = true;

            if (
              startDate &&
              dateFilter === 'today'
            ) {
              matchesDate =
                startDate.toDateString() ===
                now.toDateString();
            }

            if (
              startDate &&
              dateFilter === 'week'
            ) {
              const weekFromNow =
                new Date();

              weekFromNow.setDate(
                now.getDate() + 7
              );

              matchesDate =
                startDate >= now &&
                startDate <=
                  weekFromNow;
            }

            if (
              startDate &&
              dateFilter === 'month'
            ) {
              matchesDate =
                startDate.getMonth() ===
                  now.getMonth() &&
                startDate.getFullYear() ===
                  now.getFullYear();
            }

            return (
              matchesSearch &&
              matchesCategory &&
              matchesStatus &&
              matchesDate
            );
          })
          .sort((a, b) => {
            const first = new Date(
              a.date_start || 0
            );

            const second = new Date(
              b.date_start || 0
            );

            return sortOrder === 'latest'
              ? second - first
              : first - second;
          });

  const activityCategories = [
    ...new Set(
      activities
        .map(
          (activity) =>
            activity.category
        )
        .filter(Boolean)
    )
  ].sort();

    return (
    <div className="member-activities-page">
      <div
        className="member-layout"
        style={{ gridTemplateColumns: '1fr' }}
      >
        <main className="member-main">

          {/* =====================================================
              PAGE HEADER
              ===================================================== */}

          <section className="member-header-card activity-admin-header">
            <div>
              <h1>
            {userRole === 'admin' || userRole === 'lgu'
  ? 'Activities Management'
  : 'Activities'}
              </h1>

              <p>
            {userRole === 'admin' || userRole === 'lgu'
  ? 'Manage activities, participants and verification.'
  : 'Explore community engagement activities in Mandaue City.'}
              </p>
            </div>

       {(userRole === 'admin' || userRole === 'lgu') && (
              <button
                type="button"
                className="add-activity-btn"
                onClick={() =>
                  setShowCreateModal(true)
                }
              >
                <span>＋</span>
                Add New Activity
              </button>
            )}
          </section>

          {/* =====================================================
              ADMIN / PARTNER TABS
              ===================================================== */}

         {(userRole === 'admin' ||
  userRole === 'partner' ||
  userRole === 'lgu') && (
            <div className="member-tabs">
              <button
                type="button"
                className={
                  adminActivityTab === 'active'
                    ? 'member-tab active'
                    : 'member-tab'
                }
                onClick={() =>
                  setAdminActivityTab('active')
                }
              >
                Active Activities (
                {
                  activities.filter(
    (activity) =>
      activity.status !== 'closed' &&
      activity.status !== 'cancelled' &&
      activity.status !== 'completed'
  ).length
                }
                )
              </button>

              <button
                type="button"
                className={
                  adminActivityTab === 'history'
                    ? 'member-tab active'
                    : 'member-tab'
                }
                onClick={() =>
                  setAdminActivityTab('history')
                }
              >
                History Record (
                {
                   activities.filter(
    (activity) =>
      activity.status === 'closed' ||
      activity.status === 'cancelled' ||
      activity.status === 'completed'
  ).length
                }
                )
              </button>
            </div>
          )}

          {/* =====================================================
              CITIZEN FILTERS
              ===================================================== */}

          {userRole === 'community_member' && (
            <section className="citizen-activity-toolbar">

              <div className="citizen-activity-search">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search activities..."
                  value={activitySearch}
                  onChange={(e) =>
                    setActivitySearch(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="citizen-filter-field">
                <label>Category</label>

                <select
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(
                      e.target.value
                    )
                  }
                >
                  <option value="all">
                    All Categories
                  </option>

                  {activityCategories.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="citizen-filter-field">
                <label>Date</label>

                <select
                  value={dateFilter}
                  onChange={(e) =>
                    setDateFilter(
                      e.target.value
                    )
                  }
                >
                  <option value="all">
                    All Dates
                  </option>

                  <option value="today">
                    Today
                  </option>

                  <option value="week">
                    Next 7 Days
                  </option>

                  <option value="month">
                    This Month
                  </option>
                </select>
              </div>

              <div className="citizen-filter-field">
                <label>Status</label>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value
                    )
                  }
                >
                  <option value="open">
                    Open
                  </option>

                  <option value="all">
                    All Status
                  </option>

                  <option value="closed">
                    Closed
                  </option>

                  <option value="completed">
                    Completed
                  </option>
                </select>
              </div>
            </section>
          )}

          {/* =====================================================
              SECTION TITLE
              ===================================================== */}

          <h3 className="section-title">
           {(userRole === 'admin' ||
  userRole === 'partner' ||
  userRole === 'lgu') &&
adminActivityTab === 'history'
              ? 'History Record'
              : 'Active Activities'}
          </h3>

          {/* CITIZEN RESULT COUNT + SORT */}

          {userRole === 'community_member' && (
            <div className="citizen-activity-results-row">
              <span>
                Showing{' '}
                <strong>
                  {activeActivities.length}
                </strong>{' '}
                {activeActivities.length === 1
                  ? 'activity'
                  : 'activities'}
              </span>

              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value)
                }
              >
                <option value="latest">
                  Sort by: Latest
                </option>

                <option value="oldest">
                  Sort by: Oldest
                </option>
              </select>
            </div>
          )}

          {/* =====================================================
              ACTIVITY CARDS
              ===================================================== */}

          <div className="activity-card-grid">

            {/* ===================================================
                CITIZEN CARDS
                =================================================== */}

            {userRole === 'community_member' ? (
              <>
                {activeActivities.length === 0 ? (
                  <div className="citizen-activities-empty">
                    <div className="citizen-empty-icon">
                      📅
                    </div>

                    <h3>
                      No activities found
                    </h3>

                    <p>
                      Try changing your search
                      or filters.
                    </p>
                  </div>
                ) : (
                 
activeActivities.map((activity) => {
 

  const joinedCount = Number(activity.joined_count || 0);


                      const capacity =
                        activity.capacity
                          ? Number(
                              activity.capacity
                            )
                          : null;

                      const availableSlots =
                        capacity !== null
                          ? Math.max(
                              capacity -
                                joinedCount,
                              0
                            )
                          : null;

                      const isFull =
                        capacity !== null &&
                        joinedCount >=
                          capacity;

                      return (
                       
<article
  className="citizen-activity-card"
  key={activity.activity_id}
  role="button"
  tabIndex={0}
 onClick={() => {
  setSelectedActivity(activity);
  setShowParticipationModal(true);
}}
  onKeyDown={(e) => {
    if (e.target !== e.currentTarget) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setDetailsActivity(activity);
      setShowActivityDetails(true);
    }
  }}
  style={{ cursor: 'pointer' }}
>


                          {/* IMAGE */}

                          <div className="citizen-activity-image">
                            <img
                             src={
  getActivityImageUrl(activity.image_url) ||
  'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=900&q=80'
}
                              alt={
                                activity.title
                              }
                            />

                           <span
  className={`citizen-activity-status ${getActivityDisplayStatus(activity)}`}
>
  {isFull && activity.status === 'open'
    ? 'Full'
    : {
        upcoming: 'Upcoming',
        ongoing: 'Ongoing',
        completed: 'Completed',
        cancelled: 'Cancelled',
        closed: 'Closed',
        open: 'Open'
      }[getActivityDisplayStatus(activity)] || 'Open'}
</span>

                            <span className="citizen-category-chip">
                              {activity.category ||
                                'Community'}
                            </span>
                          </div>

                          {/* CONTENT */}

                          <div className="citizen-activity-body">
                            <h3>
                              {activity.title}
                            </h3>

                            <p className="citizen-activity-description">
                              {activity.description ||
                                'Join this community activity and earn Smart Points.'}
                            </p>

                            <div className="citizen-activity-info">

                              <div>
                                <span className="citizen-info-icon">
                                  📍
                                </span>

                                <span>
                                  {activity.location ||
                                    'Location not specified'}
                                </span>
                              </div>

                              <div>
                                <span className="citizen-info-icon">
                                  📅
                                </span>

                                <span>
                                  {formatDate(
                                    activity.date_start
                                  )}
                                </span>
                              </div>

                              <div>
                                <span className="citizen-info-icon">
                                  🕐
                                </span>

                                <span>
                                  {formatTime(
                                    activity.date_start
                                  )}

                                  {activity.date_end
                                    ? ` – ${formatTime(
                                        activity.date_end
                                      )}`
                                    : ''}
                                </span>
                              </div>

                            </div>

                            {/* POINTS + SLOTS */}

                            <div className="citizen-activity-meta">

                              <div className="citizen-points-info">
                                <span className="citizen-meta-icon points">
                                  ★
                                </span>

                                <div>
                                  <strong>
                                    {Number(
                                      activity.points_value ||
                                        0
                                    ).toLocaleString()}
                                  </strong>

                                  <small>
                                    Smart Points
                                  </small>
                                </div>
                              </div>

                              <div className="citizen-slots-info">
                                <span className="citizen-meta-icon people">
                                  ♟
                                </span>

                                <div>
                                  <strong>
                                    {capacity !==
                                    null
                                      ? `${joinedCount} / ${capacity}`
                                      : `${joinedCount} / ∞`}
                                  </strong>

                                  <small>
                                    {availableSlots !==
                                    null
                                      ? `${availableSlots} slots available`
                                      : 'No slot limit'}
                                  </small>
                                </div>
                              </div>

                            </div>

                            {/* REGISTER / PROOF */}

                            {!activity.is_joined ? (
                              <button
                                type="button"
                                className="citizen-register-button"
                                disabled={
  activity.status !== 'open' ||
  isFull ||
  !isCitizenVerified
}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  openRegistrationConfirmation(activity);
                                }}
                              >
                                {isFull
                                  ? 'Activity Full'
                                  : activity.status !==
                                    'open'
                                  ? 'Registration Closed'
                                 : !isCitizenVerified
                                  ? 'Verification Required'
                                  : 'Register Now'}
                              </button>
                            ) : (
                              <div className="citizen-registered-actions">

<button
  type="button"
  className="citizen-scan-qr-button"
  disabled={
    !isCitizenVerified ||
    activity.status !== 'open'
  }
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    openCitizenScanner(activity);
  }}
>
  ▦ Scan QR Code
</button>


                               

<button
  type="button"
className="citizen-unregister-button"
disabled={
  unregisteringActivity ||
  Boolean(activity.proof_url)
}
title={
  activity.proof_url
    ? 'You cannot unregister after submitting participation proof.'
    : 'Unregister from this activity'
}


  onClick={(e) => {
    e.preventDefault();
    if (activity.proof_url) {
  alert('You cannot unregister after submitting participation proof.');
  return;
}
    e.stopPropagation();

    setSelectedActivity(activity);

    if (
      !window.confirm(
        `Are you sure you want to unregister from "${activity.title}"?`
      )
    ) {
      return;
    }

    handleUnregisterActivity(activity.activity_id);
  }}
>
  {unregisteringActivity ? 'Unregistering...' : 'Unregister'}
</button>



                                {activity.participation_status ===
                                'approved' ? (
                                  <button
                                    type="button"
                                    className="citizen-completed-button"
                                    disabled
                                  >
                                    ✓ Completed
                                  </button>
                                ) : activity.participation_status ===
                                  'rejected' ? (
                                  <button
                                    type="button"
                                    className="citizen-rejected-button"
                                    disabled
                                  >
                                    Proof Rejected
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="citizen-proof-button"
                                    disabled={!isCitizenVerified}
                                onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();

  setProofModalActivityId(activity.activity_id);
}}
  
 
                                  >
                                    
                                    Submit Proof
                                  </button>
                                )}

                              </div>
                            )}

                          </div>
                        </article>
                      );
                    }
                  )
                )}
              </>
            ) : (

              /* =================================================
   ADMIN / PARTNER CARDS
   ================================================= */

<>
  {activeActivities.length === 0 ? (
    <div className="citizen-activities-empty">
      <div className="citizen-empty-icon">📅</div>
      <h3>No activities found</h3>
      <p>No activity records are available in this section.</p>
    </div>
  ) : (
   
activeActivities.map((activity) => {
const isOwner =
  userRole === 'admin' ||
  (
    userRole === 'lgu' &&
    currentUserId !== null &&
    activity.created_by != null &&
    Number(activity.created_by) === Number(currentUserId)
  );

  const joinedCount = Number(activity.joined_count || 0);


      const capacity =
        activity.capacity !== null &&
        activity.capacity !== undefined &&
        activity.capacity !== ''
          ? Number(activity.capacity)
          : null;

      const availableSlots =
        capacity !== null
          ? Math.max(capacity - joinedCount, 0)
          : null;

      const isFull =
        capacity !== null && joinedCount >= capacity;

      return (
        
<article
  className="citizen-activity-card management-activity-card"
  key={activity.activity_id}
  role="button"
  tabIndex={0}
 onClick={() => {
  if (userRole === 'partner') {
    setDetailsActivity(activity);
    setShowActivityDetails(true);
  } else {
    setSelectedActivity(activity);
    setShowParticipationModal(true);
  }
}}
  onKeyDown={(e) => {
    if (e.target !== e.currentTarget) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setDetailsActivity(activity);
      setShowActivityDetails(true);
    }
  }}
  style={{ cursor: 'pointer' }}
>

          {/* IMAGE */}
          <div className="citizen-activity-image">
           <img
  src={
    getActivityImageUrl(activity.image_url) ||
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=900&q=80'
  }
  alt={activity.title}
/>

            <span
  className={`citizen-activity-status ${getActivityDisplayStatus(activity)}`}
>
  {isFull && activity.status === 'open'
    ? 'Full'
    : {
        upcoming: 'Upcoming',
        ongoing: 'Ongoing',
        completed: 'Completed',
        cancelled: 'Cancelled',
        closed: 'Closed',
        open: 'Open'
      }[getActivityDisplayStatus(activity)] || 'Open'}
</span>

            <span className="citizen-category-chip">
              {activity.category || 'Community'}
            </span>
          </div>

          {/* BODY */}
          <div className="citizen-activity-body">
            <h3>{activity.title}</h3>

            <p className="citizen-activity-description">
              {activity.description || 'Community activity'}
            </p>

            {/* INFORMATION */}
            <div className="citizen-activity-info">
              <div>
                <span className="citizen-info-icon">📍</span>
                <span>
                  {activity.location || 'Location not specified'}
                </span>
              </div>

              <div>
                <span className="citizen-info-icon">📅</span>
                <span>{formatDate(activity.date_start)}</span>
              </div>

              <div>
                <span className="citizen-info-icon">🕐</span>
                <span>
                  {formatTime(activity.date_start)}
                  {activity.date_end
                    ? ` – ${formatTime(activity.date_end)}`
                    : ''}
                </span>
              </div>
            </div>

            {/* POINTS / PARTICIPANTS */}
            <div className="citizen-activity-meta">
              <div className="citizen-points-info">
                <span className="citizen-meta-icon points">★</span>

                <div>
                  <strong>
                    {Number(
                      activity.points_value || 0
                    ).toLocaleString()}
                  </strong>

                  <small>Smart Points</small>
                </div>
              </div>

              <div className="citizen-slots-info">
                <span className="citizen-meta-icon people">♟</span>

                <div>
                  <strong>
                    {capacity !== null
                      ? `${joinedCount} / ${capacity}`
                      : `${joinedCount} / ∞`}
                  </strong>

                  <small>
                    {availableSlots !== null
                      ? `${availableSlots} slots available`
                      : `${joinedCount} participants`}
                  </small>
                </div>
              </div>
            </div>

            

{/* MANAGEMENT ACTIONS */}
{(() => {
  const isHistory =
    ['closed', 'completed', 'cancelled'].includes(activity.status) ||
    (
      activity.date_end &&
      new Date(activity.date_end).getTime() <= Date.now()
    );

  return (
    <div className={`management-card-actions ${isHistory ? 'history' : ''}`}>
      {isOwner ? (
        <>
          {!isHistory && (
            <button
              type="button"
              className="management-edit-button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleEdit(activity);
              }}
            >
              Edit
            </button>
          )}

          <button
            type="button"
            className="management-view-button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleViewParticipants(activity.activity_id);
            }}
          >
            View Joined
          </button>

{!isHistory && activity.status === 'open' && (
  <button
    type="button"
    className="management-qr-button"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      handleViewQrCodes(activity);
    }}
  >
    <span aria-hidden="true">▦</span>
    View QR Codes
  </button>
)}


          {!isHistory && (
            <button
              type="button"
              className="management-deactivate-button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeactivate(activity.activity_id);
              }}
            >
              Deactivate
            </button>
          )}
        </>
      ) : (
        <span className="management-view-only">
          View Only
        </span>
      )}
    </div>
  );
})()}

          </div>
        </article>
      );
    })
  )}
</>
            )}

          </div>

          {/* =====================================================
              CITIZEN PROCESS GUIDE
              NOTE: MY PARTICIPATIONS TABLE HAS BEEN REMOVED
              ===================================================== */}

          {userRole === 'community_member' && (
            <div className="how-it-works">
              <div>
                <b>① Register</b>
                <span>
                  Join an available activity
                </span>
              </div>

              <div>→</div>

              <div>
                <b>② Join Activity</b>
                <span>
                  Participate in the event
                </span>
              </div>

              <div>→</div>

              <div>
                <b>③ Submit Proof</b>
                <span>
                  Upload participation proof
                </span>
              </div>

              <div>→</div>

              <div>
                <b>④ Earn Points</b>
                <span>
                  Points are awarded after
                  verification
                </span>
              </div>
            </div>
          )}

{proofModalActivityId !== null && (
  <MyParticipationsPage
    modalOnly
    activityId={proofModalActivityId}
    onClose={() => setProofModalActivityId(null)}
    onSubmitted={() => {
      fetchActivities();
    }}
  />
)}
{/* CITIZEN QR SCANNER MODAL */}

{showCitizenScanner &&
  scannerActivity &&
  userRole === 'community_member' && (
    <div className="cp-modal-backdrop">
      <div className="cp-modal citizen-qr-modal">

        <div className="cp-modal-header">
          <h2>Scan Activity QR</h2>

          <button
            type="button"
            className="cp-modal-close"
            onClick={closeCitizenScanner}
            disabled={scannerSubmitting}
          >
            ×
          </button>
        </div>

        <div className="cp-modal-content">

          <h3>{scannerActivity.title}</h3>

          <p>
            Scan the Check-In QR when you arrive.
            After submitting your participation proof,
            scan the Check-Out QR.
          </p>

          {!scannerResult ? (
            <CitizenQrScanner
              onScan={handleCitizenQrScan}
              onClose={closeCitizenScanner}
              disabled={scannerSubmitting}
            />
          ) : (
            <div
              className={
                scannerResult.success
                  ? 'citizen-qr-success'
                  : 'citizen-qr-error'
              }
            >
              <h3>
                {scannerResult.success
                  ? '✓ QR Verified'
                  : 'QR Verification Failed'}
              </h3>

              <p>{scannerMessage}</p>

              {scannerResult.success && (
                <p>
                  {scannerResult.type === 'check_in'
                    ? 'You may now participate and submit your proof.'
                    : 'Your Check-Out has been recorded.'}
                </p>
              )}

              <button
                type="button"
                className="citizen-qr-close-btn"
                onClick={closeCitizenScanner}
              >
                Done
              </button>
            </div>
          )}

          {scannerSubmitting && (
            <p className="citizen-qr-processing">
              Verifying attendance...
            </p>
          )}

          {scannerMessage &&
            !scannerResult && (
              <p>{scannerMessage}</p>
            )}

        </div>
      </div>
    </div>
  )}


{/* =====================================================
    ACTIVITY QR CODE MODAL
    ===================================================== */}

{showQrModal && (
  <div
    className="participation-modal-backdrop activity-qr-backdrop"
    onClick={closeQrModal}
  >
    <div
      className="activity-qr-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Activity QR Codes"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="activity-qr-close"
        onClick={closeQrModal}
        disabled={qrLoading}
        aria-label="Close QR modal"
      >
        ×
      </button>

      <div className="activity-qr-header">
        <div className="activity-qr-header-icon">▦</div>

        <h2>Activity QR Codes</h2>

        <p>
          {qrActivity?.title || 'Activity'}
        </p>
      </div>

      {qrLoading ? (
        <div className="activity-qr-message">
          Generating secure QR codes...
        </div>
      ) : qrError ? (
        <div className="activity-qr-error">
          {qrError}
        </div>
      ) : qrCodes ? (
        <>
          <div className="activity-qr-grid">
            <div className="activity-qr-panel">
              <span className="activity-qr-tag check-in">
                CHECK-IN
              </span>

              <h3>Check-In QR</h3>

              <p>
                Display this code when citizens arrive
                at the activity.
              </p>

              <img
                src={qrCodes.checkIn}
                alt="Activity Check-In QR Code"
                className="activity-qr-image"
              />

<button
  type="button"
  className="activity-qr-download"
  onClick={() => downloadActivityQr(qrCodes.checkIn, "CheckIn")}
>
  ↓ Download Check-In QR
</button>


              <small>
                Citizens must register before checking in.
              </small>
            </div>

            <div className="activity-qr-panel">
              <span className="activity-qr-tag check-out">
                CHECK-OUT
              </span>

              <h3>Check-Out QR</h3>

              <p>
                Display this code after citizens have
                submitted their participation proof.
              </p>

              <img
                src={qrCodes.checkOut}
                alt="Activity Check-Out QR Code"
                className="activity-qr-image"
              />

<button
  type="button"
  className="activity-qr-download"
  onClick={() => downloadActivityQr(qrCodes.checkOut, "CheckOut")}
>
  ↓ Download Check-Out QR
</button>


              <small>
                Check-out follows successful proof submission.
              </small>
            </div>
          </div>


<button
  type="button"
  className="activity-qr-regenerate"
  disabled={qrLoading}
  onClick={async () => {
    const confirmed = window.confirm(
      "Regenerate both QR codes? Previously downloaded or printed QR codes will stop working."
    );

    if (!confirmed || !qrActivity) return;

    setQrLoading(true);
    setQrError("");

    try {
      const response = await api.post(
        `/activities/${qrActivity.activity_id}/qr-codes/regenerate`
      );

      setQrCodes({
        checkIn: response.data.check_in_qr,
        checkOut: response.data.check_out_qr
      });
    } catch (error) {
      setQrError(
        error.response?.data?.message ||
        "Failed to regenerate QR codes."
      );
    } finally {
      setQrLoading(false);
    }
  }}
>
  Regenerate QR Codes
</button>

          <p className="activity-qr-warning">
           These QR codes remain valid until they are regenerated.
  Regenerating invalidates previously downloaded or printed codes.
  Keep QR codes accessible only to authorized activity organizers.
          </p>
        </>
      ) : null}

      <button
        type="button"
        className="activity-qr-done"
        onClick={closeQrModal}
        disabled={qrLoading}
      >
        Close
      </button>
    </div>
  </div>
)}



                   {/* =====================================================
    CREATE ACTIVITY MODAL
    ===================================================== */}

{showCreateModal && (
  <div
    className="participation-modal-backdrop"
    style={{ padding: '20px' }}
  >
    <div
      className="create-activity-modal"
      style={{
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        borderRadius: '16px',
        boxSizing: 'border-box'
      }}
    >
      <button
        type="button"
        className="modal-close-btn"
        onClick={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
      >
        ×
      </button>

      <div className="create-activity-modal-header">
        <h2>Create Activity</h2>
        <p>Add a new community engagement activity.</p>
      </div>

      <form
        onSubmit={handleCreateActivity}
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: '16px',
          marginTop: '24px'
        }}
      >
        {/* ACTIVITY TITLE */}
        <div style={{ minWidth: 0 }}>
          <label htmlFor="create-title">Activity Title</label>
          <input
            id="create-title"
            type="text"
            name="title"
            placeholder="Enter activity title"
            value={createForm.title}
            onChange={handleCreateChange}
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        
{/* CATEGORY */}
<div style={{ minWidth: 0 }}>
  <label htmlFor="create-category">Category</label>

  <select
    id="create-category"
    name="category"
    value={createForm.category}
    onChange={handleCreateChange}
    required
    style={{
      width: '100%',
      boxSizing: 'border-box'
    }}
  >
    <option value="" disabled>
      Select Activity Category
    </option>

    <option value="Environmental Protection">
      Environmental Protection
    </option>

    <option value="Community Cleanliness and Sanitation">
      Community Cleanliness and Sanitation
    </option>

    <option value="Health and Wellness">
      Health and Wellness
    </option>

    <option value="Disaster Risk Reduction and Management">
      Disaster Risk Reduction and Management
    </option>

    <option value="Community Volunteerism">
      Community Volunteerism
    </option>

    <option value="Public Consultation and Governance">
      Public Consultation and Governance
    </option>

    <option value="Education and Skills Development">
      Education and Skills Development
    </option>

    <option value="Livelihood and Employment">
      Livelihood and Employment
    </option>

    <option value="Youth Development">
      Youth Development
    </option>

    <option value="Senior Citizen Programs">
      Senior Citizen Programs
    </option>

    <option value="Persons with Disabilities (PWD) Programs">
      Persons with Disabilities (PWD) Programs
    </option>

    <option value="Women and Family Development">
      Women and Family Development
    </option>

    <option value="Peace and Public Safety">
      Peace and Public Safety
    </option>

    <option value="Cultural and Heritage Programs">
      Cultural and Heritage Programs
    </option>

    <option value="Sports and Recreation">
      Sports and Recreation
    </option>

    <option value="Agriculture and Urban Gardening">
      Agriculture and Urban Gardening
    </option>

    <option value="Social Welfare and Community Assistance">
      Social Welfare and Community Assistance
    </option>

    <option value="Civic Awareness and Citizenship">
      Civic Awareness and Citizenship
    </option>
  </select>
</div>


        {/* DESCRIPTION */}
        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <label htmlFor="create-description">Description</label>
          <textarea
            id="create-description"
            name="description"
            placeholder="Describe the activity..."
            value={createForm.description}
            onChange={handleCreateChange}
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical'
            }}
          />
        </div>

        

{/* LOCATION */}
<div style={{ minWidth: 0 }}>
  <label htmlFor="create-location">Location</label>

  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}
  >
    <input
      id="create-location"
      type="text"
      readOnly
      required
      placeholder="Select location on map"
      value={createForm.location || ''}
      style={{
        width: '100%',
        flex: 1,
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    />

    <button
      type="button"
      onClick={() => setMapTarget('create')}
      style={{
        padding: '10px 12px',
        background: '#1d4ed8',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      📍 Select
    </button>
  </div>
</div>



        {/* IMAGE URL */}
       {/* ACTIVITY IMAGE UPLOAD */}
<ActivityImageUpload
  id="create-activity-image"
  file={createImageFile}
  onFileChange={setCreateImageFile}
/>
        {/* START DATE */}
        <div style={{ minWidth: 0 }}>
          <label htmlFor="create-start">Start Date & Time</label>
          <input
            id="create-start"
            type="datetime-local"
            name="date_start"
            min={formatForDateTimeInput(new Date())}
            value={createForm.date_start}
            onChange={handleCreateChange}
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* END DATE */}
        <div style={{ minWidth: 0 }}>
          <label htmlFor="create-end">End Date & Time</label>
          <input
            id="create-end"
            type="datetime-local"
            name="date_end"
            min={
              createForm.date_start ||
              formatForDateTimeInput(new Date())
            }
            value={createForm.date_end}
            onChange={handleCreateChange}
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* POINTS VALUE */}
        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <label htmlFor="create-points">Points Value</label>
          <input
            id="create-points"
            type="number"
            name="points_value"
            placeholder="Enter points value"
            min="0"
            step="1"
            value={createForm.points_value}
            onChange={handleCreateChange}
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* SUBMIT */}
        <button
          type="submit"
          className="create-activity-submit-btn"
          style={{
            gridColumn: '1 / -1',
            width: '100%',
            marginTop: '8px'
          }}
        >
          Create Activity
        </button>
      </form>
    </div>
  </div>
)}



{/* ACTIVITY LOCATION MAP MODAL */}
{mapTarget && (
  <LocationPickerModal
    initialLocation={
      mapTarget === 'create'
        ? createForm.location
        : editForm?.location
    }
    initialLatitude={
      mapTarget === 'create'
        ? createForm.latitude
        : editForm?.latitude
    }
    initialLongitude={
      mapTarget === 'create'
        ? createForm.longitude
        : editForm?.longitude
    }
    initialCoverageRadius={
  mapTarget === 'create'
    ? createForm.coverage_radius_m
    : editForm?.coverage_radius_m
}
    onClose={() => setMapTarget(null)}
    onConfirm={(selection) => {
      if (mapTarget === 'create') {
        setCreateForm((prev) => ({
          ...prev,
          ...selection
        }));
      } else {
        setEditForm((prev) => ({
          ...prev,
          ...selection
        }));
      }

      setMapTarget(null);
    }}
  />
)}


{/* ACTIVITY REGISTRATION CONFIRMATION MODAL */}
{activityToRegister && userRole === 'community_member' && (
  <div
    className="cp-modal-backdrop"
    onClick={closeRegistrationConfirmation}
  >
    <div
      className="cp-modal cp-registration-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-registration-title"
      onClick={(e) => e.stopPropagation()}
      style={{ maxWidth: 480, width: 'calc(100% - 32px)' }}
    >
      <div className="cp-modal-header">
        <h2 id="confirm-registration-title">
          Confirm Activity Registration
        </h2>

        <button
          type="button"
          className="cp-modal-close"
          onClick={closeRegistrationConfirmation}
          disabled={isRegistering}
        >
          ×
        </button>
      </div>

      <div className="cp-modal-content">
        <p>
          Are you sure you want to register for this activity?
        </p>

        <div className="cp-modal-activity">
          {activityToRegister.image_url && (
            <img
              src={getActivityImageUrl(activityToRegister.image_url)}
              alt={activityToRegister.title}
            />
          )}

          <div>
            <h3>{activityToRegister.title}</h3>

            <p>
              📍 {activityToRegister.location || 'Location not specified'}
            </p>

            <p>
              📅 {formatDate(activityToRegister.date_start)}
            </p>

            <p>
              🕐 {formatTime(activityToRegister.date_start)}
            </p>

            <p>
              ★ {Number(activityToRegister.points_value || 0).toLocaleString()}
              {' '}Smart Points
            </p>
          </div>
        </div>

        <p style={{ fontSize: 13, marginTop: 16 }}>
          Your registration will be recorded immediately after
          confirmation. Smart Points will only be awarded after
          your participation proof has been verified.
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 24
          }}
        >
          <button
            type="button"
            className="registration-back-btn"
            onClick={closeRegistrationConfirmation}
            disabled={isRegistering}
          >
            Cancel
          </button>

          <button
            type="button"
            className="citizen-register-button"
            onClick={confirmActivityRegistration}
            disabled={isRegistering}
          >
            {isRegistering
              ? 'Registering...'
              : 'Confirm Registration'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}


          {/* =====================================================
              REGISTERED / PARTICIPATION MODAL
              ===================================================== */}

 {showParticipationModal && selectedActivity && (
  <div
    className="cp-modal-backdrop"
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        setShowParticipationModal(false);
      }
    }}
  >
    <div
      className="cp-modal cp-registration-modal"
      onClick={(e) => e.stopPropagation()}
    >

      {/* HEADER */}
      <div className="cp-modal-header">
        <h2>Activity Registration</h2>

        <button
          type="button"
          className="cp-modal-close"
          onClick={() => setShowParticipationModal(false)}
        >
          ×
        </button>
      </div>

      <div className="cp-modal-content">

        {/* ACTIVITY */}
        <div className="cp-modal-activity">
          <img
           src={
  getActivityImageUrl(selectedActivity.image_url) ||
  'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=900&q=80'
}
            alt={selectedActivity.title}
          />

          <div>
            <h3>{selectedActivity.title}</h3>

            <span className="cp-modal-category">
              {selectedActivity.category || 'Community'}
            </span>

            <p>
              {selectedActivity.description ||
                'Participate in this community activity.'}
            </p>
          </div>
        </div>

        {/* REGISTRATION STATUS */}
        <div className="cp-status-box registered">
          <div className="cp-status-icon">✓</div>

          <div>
            <small>Registration Status</small>
            <h3>Registered</h3>

            <p>
              You are registered for this activity.
            </p>
          </div>
        </div>

        {/* PROOF STATUS */}
        <div className="cp-status-box proof">
          <div className="cp-status-icon">◷</div>

          <div>
            <small>Participation Proof</small>
            <h3>Awaiting Proof</h3>

            <p>
              After participating in the activity,
              submit your proof for verification.
            </p>
          </div>
        </div>

        {/* DETAILS */}
        <div className="cp-activity-details">
          <h4>Activity Details</h4>

          <div className="cp-details-grid">

            <div className="cp-detail-item">
              <span className="cp-detail-icon">▣</span>

              <div>
                <small>Date</small>
                <strong>
                  {formatDate(selectedActivity.date_start)}
                </strong>
                <span>
                  {formatTime(selectedActivity.date_start)}
                </span>
              </div>
            </div>

            <div className="cp-detail-item">
              <span className="cp-detail-icon">⌖</span>

              <div>
                <small>Location</small>
                <strong>
                  {selectedActivity.location ||
                    'Not specified'}
                </strong>
              </div>
            </div>

            <div className="cp-detail-item">
              <span className="cp-detail-icon points">★</span>

              <div>
                <small>Smart Points</small>
                <strong>
                  {Number(
                    selectedActivity.points_value || 0
                  ).toLocaleString()}{' '}
                  pts
                </strong>
              </div>
            </div>

          </div>
        </div>


      </div>
    </div>
  </div>
)}

          {/* =====================================================
              PROOF SUBMISSION MODAL
              ===================================================== */}

         {showProofForm && selectedActivity && (
  <div className="cp-modal-backdrop">
    <div className="cp-modal cp-proof-modal">

      {/* HEADER */}
      <div className="cp-modal-header">
        <h2>Submit Participation Proof</h2>

        <button
          type="button"
          className="cp-modal-close"
          onClick={() => {
            setShowProofForm(false);
            setProofFile(null);
            setFeedbackText('');
          }}
        >
          ×
        </button>
      </div>

      <div className="cp-modal-content">

        {/* ACTIVITY */}
        <div className="cp-modal-activity">
          <img
           src={
  getActivityImageUrl(selectedActivity.image_url) ||
  'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=900&q=80'
}
            alt={selectedActivity.title}
          />

          <div>
            <h3>{selectedActivity.title}</h3>

            <span className="cp-modal-category">
              {selectedActivity.category || 'Community'}
            </span>

            <p>
              {selectedActivity.description ||
                'Submit proof of your participation.'}
            </p>
          </div>
        </div>

        {/* UPLOAD */}
        <div className="cp-proof-section">
          <label>
            Upload Proof <span>*</span>
          </label>

          <label className="cp-upload-box">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) =>
                setProofFile(
                  e.target.files?.[0] || null
                )
              }
            />

            <div className="cp-upload-icon">
              ↑
            </div>

            {proofFile ? (
              <>
                <strong className="cp-file-selected">
                  ✓ {proofFile.name}
                </strong>

                <p>Click to choose another file</p>
              </>
            ) : (
              <>
                <strong>
                  <span>Click to upload</span>
                  {' '}or drag and drop
                </strong>

                <p>
                  Supported formats: JPG, PNG, WEBP
                </p>
              </>
            )}
          </label>
        </div>




<div
  style={{
    marginTop: '12px',
    marginBottom: '12px',
    padding: '12px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    color: '#1e3a8a',
    fontSize: '13px',
    lineHeight: '1.6'
  }}
>
  <strong>📍 Location Verification</strong>

  <p style={{ margin: '6px 0 0' }}>
    CitiPoints will request your current device
    location when you submit your proof.
    Your location will be compared with the
    activity's coverage area for LGU review.
    If location access is unavailable,
    your submission will be marked as
    location unverified.
  </p>
</div>



        {/* FEEDBACK */}
        <div className="cp-feedback-section">
          <label>Feedback (Optional)</label>

          <textarea
            maxLength="500"
            value={feedbackText}
            onChange={(e) =>
              setFeedbackText(e.target.value)
            }
            placeholder="Share your experience in this activity..."
          />

          <small>
            {feedbackText.length} / 500
          </small>
        </div>

        {/* ACTIONS */}
        <div className="cp-modal-actions">
          <button
            type="button"
            className="cp-cancel-btn"
            onClick={() => {
              setShowProofForm(false);
              setProofFile(null);
              setFeedbackText('');
            }}
          >
            Cancel
          </button>

         
<button
  type="button"
  className="cp-primary-btn"
  disabled={!proofFile || isSubmittingProof}
  onClick={submitProofForm}
>
  {isSubmittingProof
    ? 'Checking Location & Submitting...'
    : '➤ Submit Proof'}
</button>

        </div>

      </div>
    </div>
  </div>
)}

          {/* =====================================================
           EDIT ACTIVITY MODAL
           ===================================================== */}

{/* ACTIVITY DETAILS MODAL */}
{showActivityDetails && detailsActivity && (
  <div
    className="cp-modal-backdrop"
    onClick={() => {
      setShowActivityDetails(false);
      setDetailsActivity(null);
    }}
  >
    <div
      className="cp-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Activity Details"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 'calc(100% - 32px)',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}
    >
      <div className="cp-modal-header">
        <h2>Activity Details</h2>
        <button
          type="button"
          className="cp-modal-close"
          onClick={() => {
            setShowActivityDetails(false);
            setDetailsActivity(null);
          }}
        >
          ×
        </button>
      </div>

      <div className="cp-modal-content">
      <div className="partner-activity-details-image">
  <div className="partner-activity-image-fallback">
    <span aria-hidden="true">📅</span>
    <span>Community Activity</span>
  </div>

  {detailsActivity.image_url && (
    <img
      src={getActivityImageUrl(detailsActivity.image_url)}
      alt={detailsActivity.title}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  )}
</div>

        <h2>{detailsActivity.title}</h2>
        <p>{detailsActivity.description || 'No description provided.'}</p>

        <p><strong>Status:</strong> {detailsActivity.status}</p>
        <p><strong>Category:</strong> {detailsActivity.category || 'N/A'}</p>
        <p><strong>Location:</strong> {detailsActivity.location || 'N/A'}</p>

        <p>
          <strong>Start:</strong>{' '}
          {formatDate(detailsActivity.date_start)} at{' '}
          {formatTime(detailsActivity.date_start)}
        </p>

        <p>
          <strong>End:</strong>{' '}
          {detailsActivity.date_end
            ? `${formatDate(detailsActivity.date_end)} at ${formatTime(detailsActivity.date_end)}`
            : 'Not specified'}
        </p>

        <p>
          <strong>Smart Points:</strong>{' '}
          {Number(detailsActivity.points_value || 0).toLocaleString()}
        </p>

        <p>
          <strong>Registered Citizens:</strong>{' '}
          {Number(detailsActivity.joined_count || 0)}
        </p>

        <p>
          <strong>Capacity:</strong>{' '}
          {detailsActivity.capacity == null
            ? 'Unlimited'
            : detailsActivity.capacity}
        </p>

        <div className="cp-modal-actions">
          <button
            type="button"
            className="cp-cancel-btn"
            onClick={() => {
              setShowActivityDetails(false);
              setDetailsActivity(null);
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
)}



{showEditModal && editForm && (
  <div
    className="participation-modal-backdrop"
    style={{ padding: '20px' }}
  >
    <div
      className="create-activity-modal"
      style={{
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        borderRadius: '16px',
        boxSizing: 'border-box'
      }}
    >
      <button
        type="button"
        className="modal-close-btn"
        onClick={() => setShowEditModal(false)}
      >
        ×
      </button>

      <div className="create-activity-modal-header">
        <h2>Edit Activity</h2>
        <p>Update community engagement activity details.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleUpdateActivity();
        }}
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: '16px',
          marginTop: '24px'
        }}
      >
        {/* ACTIVITY TITLE */}
        <div style={{ minWidth: 0 }}>
          <label htmlFor="edit-title">Activity Title</label>
          <input
            id="edit-title"
            type="text"
            name="title"
            placeholder="Enter activity title"
            value={editForm.title}
            onChange={handleEditChange}
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* CATEGORY */}
        <div style={{ minWidth: 0 }}>
          <label htmlFor="edit-category">Category</label>
          <select
            id="edit-category"
            name="category"
            value={editForm.category}
            onChange={handleEditChange}
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            <option value="" disabled>
              Select Activity Category
            </option>

            {[
              'Environmental Protection',
              'Community Cleanliness and Sanitation',
              'Health and Wellness',
              'Disaster Risk Reduction and Management',
              'Community Volunteerism',
              'Public Consultation and Governance',
              'Education and Skills Development',
              'Livelihood and Employment',
              'Youth Development',
              'Senior Citizen Programs',
              'Persons with Disabilities (PWD) Programs',
              'Women and Family Development',
              'Peace and Public Safety',
              'Cultural and Heritage Programs',
              'Sports and Recreation',
              'Agriculture and Urban Gardening',
              'Social Welfare and Community Assistance',
              'Civic Awareness and Citizenship'
            ].map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* DESCRIPTION */}
        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <label htmlFor="edit-description">Description</label>
          <textarea
            id="edit-description"
            name="description"
            placeholder="Describe the activity..."
            value={editForm.description}
            onChange={handleEditChange}
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical'
            }}
          />
        </div>

       
{/* LOCATION */}
<div style={{ minWidth: 0 }}>
  <label htmlFor="edit-location">Location</label>

  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}
  >
    <input
      id="edit-location"
      type="text"
      readOnly
      required
      placeholder="Select location on map"
      value={editForm.location || ''}
      style={{
        width: '100%',
        flex: 1,
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    />

    <button
      type="button"
      onClick={() => setMapTarget('edit')}
      style={{
        padding: '10px 12px',
        background: '#1d4ed8',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      📍 Select
    </button>
  </div>
</div>


        {/* EDIT ACTIVITY IMAGE UPLOAD */}
<ActivityImageUpload
  id="edit-activity-image"
  file={editImageFile}
  onFileChange={setEditImageFile}
  existingImage={getActivityImageUrl(editForm.image_url)}
/>
        {/* START DATE */}
        <div style={{ minWidth: 0 }}>
          <label htmlFor="edit-start">Start Date & Time</label>
          <input
            id="edit-start"
            type="datetime-local"
            name="date_start"
            value={editForm.date_start}
            onChange={handleEditChange}
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* END DATE */}
        <div style={{ minWidth: 0 }}>
          <label htmlFor="edit-end">End Date & Time</label>
          <input
            id="edit-end"
            type="datetime-local"
            name="date_end"
            min={editForm.date_start}
            value={editForm.date_end}
            onChange={handleEditChange}
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* POINTS VALUE */}
        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <label htmlFor="edit-points">Points Value</label>
          <input
            id="edit-points"
            type="number"
            name="points_value"
            placeholder="Enter points value"
            min="0"
            step="1"
            value={editForm.points_value}
            onChange={handleEditChange}
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* SAVE CHANGES */}
        <button
          type="submit"
          className="create-activity-submit-btn"
          style={{
            gridColumn: '1 / -1',
            width: '100%',
            marginTop: '8px'
          }}
        >
          Save Changes
        </button>
      </form>
    </div>
  </div>
)}


          {/* =====================================================
              PARTICIPANTS MODAL
              ===================================================== */}

          {showParticipantsModal && (
  <div className="participation-modal-backdrop">
    <div className="participation-modal participants-modal">
      {/* CLOSE */}
      <button
        type="button"
        className="modal-close-btn"
        onClick={() => {
          setShowParticipantsModal(false);
          setParticipants([]);
        }}
      >
        ×
      </button>

      <section className="side-card modal-side-card">
        <div className="participants-modal-header">
          <div>
            <h2>Activity Participants</h2>
            <p>
              View citizens who registered for this activity.
            </p>
          </div>

          <div className="participants-count-badge">
            {participants.length}{' '}
            {participants.length === 1
              ? 'Participant'
              : 'Participants'}
          </div>
        </div>

        {participants.length === 0 ? (
          <div className="participants-empty-state">
            <div className="participants-empty-icon">
              ♙
            </div>

            <h3>No participants yet</h3>

            <p>
              No citizen has registered for this activity.
            </p>
          </div>
        ) : (
          <div className="participants-list">
            {participants.map((participant, index) => {
              const status =
                participant.participation_status ||
                participant.registration_status ||
                'registered';

              return (
                <div
                  className="participant-row"
                  key={
                    participant.participation_id ||
                    `${participant.user_id}-${index}`
                  }
                >
                  <div className="participant-avatar">
                    {(participant.full_name ||
                      participant.username ||
                      'U')
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="participant-person">
                    <strong>
                      {participant.full_name ||
                        participant.username ||
                        `Citizen #${participant.user_id}`}
                    </strong>

                    <span>
                      {participant.email ||
                        'Registered citizen'}
                    </span>
                  </div>

                  <div className="participant-status">
                    <small>Status</small>

                    <span
                      className={`participant-status-badge ${status}`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="participant-proof">
                    <small>Proof</small>

                    {participant.proof_url ? (
                      <a
                        href={participant.proof_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View Proof
                      </a>
                    ) : (
                      <span>Not submitted</span>
                    )}
                  </div>

                  <div className="participant-points">
                    <small>Points</small>

                    <strong>
                      {Number(
                        participant.awarded_points || 0
                      ).toLocaleString()}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="participants-modal-footer">
          <button
            type="button"
            onClick={() => {
              setShowParticipantsModal(false);
              setParticipants([]);
            }}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  </div>
)}

        </main>
      </div>
    </div>
  );
}

export default ActivitiesPage;