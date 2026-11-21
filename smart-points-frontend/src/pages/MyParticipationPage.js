

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';

function MyParticipationsPage({
  modalOnly = false,
  activityId = null,
  onClose = () => {},
  onSubmitted = () => {}
}) 
 {
  const [participations, setParticipations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
   const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
const [cameraError, setCameraError] = useState('');
const [capturedPhoto, setCapturedPhoto] = useState(null);
const [photoPreview, setPhotoPreview] = useState('');
const [cameraBusy, setCameraBusy] = useState(false);
const [gpsChecking, setGpsChecking] = useState(false);
const [gpsIssue, setGpsIssue] = useState('');
const [gpsIssueMessage, setGpsIssueMessage] = useState('');
const [uploadError, setUploadError] = useState('');
const [, setUploadSuccess] = useState('');

const videoRef = useRef(null);
const streamRef = useRef(null);

  const fetchParticipations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/participations/my');
      const records = Array.isArray(response.data?.participations)
  ? response.data.participations
  : [];

setParticipations(records);

if (modalOnly && activityId != null) {
  const matchingRecord = records.find(
    (item) =>
      String(item.activity_id) === String(activityId) &&
      Boolean(item.registration_id)
  );

  if (matchingRecord) {
    setSelectedSubmission(matchingRecord);
  } else {
    setError('Registration record not found for this activity.');
  }
}
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to load participation history.'
      );
    } finally {
      setLoading(false);
    }
}, [modalOnly, activityId]);

 
useEffect(() => {
  fetchParticipations();
}, [fetchParticipations]);
  



  const stopCamera = () => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }
};

const closeCamera = () => {
  stopCamera();
  setCameraOpen(false);
  setCapturedPhoto(null);
  setPhotoPreview('');
  setCameraError('');
  setUploadError('');
};

const checkGPSAccess = async () => {
  setGpsChecking(true);
  setGpsIssue('');
  setGpsIssueMessage('');

  try {
    if (!window.isSecureContext) {
      throw new Error('GPS requires HTTPS or localhost.');
    }

    if (!navigator.geolocation) {
      throw new Error('This browser does not support location access.');
    }

    // Request location directly so Chrome can show its permission
    // prompt again if the browser permits another request.
    await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000
        }
      );
    });

    return true;
  } catch (error) {
    if (error.code === 1) {
      setGpsIssue('permission');
      setGpsIssueMessage(
        'Location permission was denied or blocked by your browser.'
      );
    } else if (error.code === 2) {
      setGpsIssue('device');
      setGpsIssueMessage(
        'Your location is unavailable. Check that your phone Location service is turned on.'
      );
    } else if (error.code === 3) {
      setGpsIssue('device');
      setGpsIssueMessage(
        'Location timed out. Turn on device Location, move to an open area, and try again.'
      );
    } else {
      setGpsIssue('general');
      setGpsIssueMessage(
        error.message || 'Unable to access your location.'
      );
    }

    return false;
  } finally {
    setGpsChecking(false);
  }
};


const openCamera = async () => {
  if (cameraBusy || gpsChecking) return;

  setCameraError('');
  setUploadError('');
  setUploadSuccess('');
  setCameraBusy(true);

  try {
    // Check location before opening the camera.
    const gpsReady = await checkGPSAccess();

    if (!gpsReady) return;

    if (!window.isSecureContext) {
      setCameraError('Camera requires HTTPS or localhost.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera is not supported by this browser.');
      return;
    }

    stopCamera();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    streamRef.current = stream;
    setCapturedPhoto(null);
    setPhotoPreview('');
    setCameraOpen(true);

  } catch (error) {
    setCameraError(
      error.name === 'NotAllowedError'
        ? 'Camera access is blocked. Allow camera access in your browser settings.'
        : 'Unable to open camera. Check your camera permissions.'
    );
  } finally {
    setCameraBusy(false);
  }
};



useEffect(() => {
  if (!cameraOpen || capturedPhoto || !videoRef.current || !streamRef.current) {
    return;
  }

  const video = videoRef.current;
  video.srcObject = streamRef.current;

  video.play().catch(() => {
    setCameraError('Unable to start camera preview.');
  });
}, [cameraOpen, capturedPhoto]);

useEffect(() => {
  return () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };
}, []);





const capturePhoto = () => {
  const video = videoRef.current;

  if (!video || !video.videoWidth || !video.videoHeight) {
    setCameraError('Camera is not ready. Please try again.');
    return;
  }

  const canvas = document.createElement('canvas');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    setCameraError('Unable to capture photo.');
    return;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (!blob) {
      setCameraError('Photo capture failed.');
      return;
    }

    const file = new File(
      [blob],
      `citipoints-proof-${Date.now()}.jpg`,
      { type: 'image/jpeg' }
    );

    setCapturedPhoto(file);
    setPhotoPreview(URL.createObjectURL(blob));
    stopCamera();
  }, 'image/jpeg', 0.9);
};

const retakePhoto = async () => {
  if (photoPreview) {
    URL.revokeObjectURL(photoPreview);
  }

  setCapturedPhoto(null);
  setPhotoPreview('');
  setCameraOpen(false);
  await openCamera();
};





const getBrowserLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error('Geolocation is not supported by this browser.')
      );
      return;
    }

    const TARGET_ACCURACY = 20;
    const MAX_WAIT_TIME = 20000;
    const MAX_READING_AGE = 5000;

    let bestLocation = null;
    let watchId = null;
    let timerId = null;
    let finished = false;

    const cleanup = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
      }

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };

    const finish = (error = null) => {
      if (finished) return;

      finished = true;
      cleanup();

      if (error) {
        reject(error);
      } else if (bestLocation) {
        console.log(
          'CITIPOINTS BEST GPS:',
          bestLocation
        );

        resolve(bestLocation);
      } else {
        reject(
          new Error(
            'Unable to obtain your location. Please check location services and try again.'
          )
        );
      }
    };

    const handlePosition = (position) => {
      if (finished) return;

      const { latitude, longitude, accuracy } = position.coords;

      const readingAge = Date.now() - position.timestamp;

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(accuracy) ||
        accuracy < 0 ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        readingAge < 0 ||
        readingAge > MAX_READING_AGE
      ) {
        return;
      }

      const reading = {
        latitude,
        longitude,
        accuracy,
        timestamp: position.timestamp
      };

      console.log('CITIPOINTS GPS READING:', reading);

      if (
        !bestLocation ||
        reading.accuracy < bestLocation.accuracy
      ) {
        bestLocation = reading;
      }

      if (reading.accuracy <= TARGET_ACCURACY) {
        finish();
      }
    };

    const handleError = (error) => {
      if (finished) return;

      if (error.code === 1) {
        finish(error);
      } else {
        console.warn(
          'CITIPOINTS GPS WARNING:',
          error.message
        );
      }
    };

    timerId = setTimeout(() => {
      finish();
    }, MAX_WAIT_TIME);

    try {
      watchId = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );

      if (finished) {
        cleanup();
      }
    } catch (error) {
      finish(error);
    }
  });


const submitCapturedProof = async () => {
  if (!capturedPhoto || !selectedSubmission || submitting) return;

  setSubmitting(true);
  setUploadError('');

  try {
    // Obtain location when the citizen submits proof.
    const location = await getBrowserLocation();

    if (
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      !Number.isFinite(location.accuracy)
    ) {
      throw new Error('Unable to obtain valid location coordinates.');
    }

    const data = new FormData();

    data.append('activity_id', String(selectedSubmission.activity_id));
    data.append('feedback_text', '');
    data.append('proof_file', capturedPhoto);

    data.append('browser_latitude', String(location.latitude));
    data.append('browser_longitude', String(location.longitude));
    data.append('browser_accuracy_meters', String(location.accuracy));

    await api.post('/participations', data);

    setUploadSuccess('Participation proof submitted successfully.');

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    
  closeCamera();
setSelectedSubmission(null);

if (modalOnly) {
  onSubmitted();
  onClose();
} else {
  await fetchParticipations();
}
  } catch (error) {
    let message =
      error.response?.data?.message ||
      error.message ||
      'Unable to submit proof. Please try again.';

    if (error.code === 1) {
      message = 'Location permission denied. Please allow location access.';
    } else if (error.code === 2) {
      message = 'Your location is unavailable. Check device location settings.';
    } else if (error.code === 3) {
      message = 'Location request timed out. Please try again.';
    }

    setUploadError(message);
  } finally {
    setSubmitting(false);
  }
};


const closeSubmissionModal = () => {
  if (submitting) return;

  setGpsIssue('');
  setGpsIssueMessage('');

  if (photoPreview) {
    URL.revokeObjectURL(photoPreview);
  }

  closeCamera();
  setSelectedSubmission(null);

  if (modalOnly) {
    onClose();
  }
};




  const getStatus = (item) => {
    if (!item.participation_id) return 'not_submitted';
    return (
      item.participation_status ||
      item.status ||
      'pending'
    ).toLowerCase();
  };

  const hasAiAssessment = (item) =>
    item.ai_score !== null &&
    item.ai_score !== undefined;

 
const getStatusLabel = (item) => {
  const status = getStatus(item);

  if (status === 'not_submitted') {
    return 'Registered';
  }

  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'flagged') return 'Human Review';

  if (status === 'pending' && hasAiAssessment(item)) {
    return 'Human Review';
  }

  if (status === 'pending' && item.proof_url) {
    return 'AI Assessment';
  }

  return 'Submitted';
};

const getActivityImageUrl = (imageUrl) => {
  if (!imageUrl) return null;

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  const backendURL = api.defaults.baseURL.replace(/\/api\/?$/, '');
  const path = imageUrl.replace(/^\/+/, '');

  return `${backendURL}/${path}`;
};

  const formatDate = (value) => {
    if (!value) return 'Not specified';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not specified';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };


  const filteredParticipations = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return participations.filter((item) => {
     if (!item.registration_id || !item.activity_id) {
  return false;
}

      const searchable = [
        item.activity_title,
        item.description,
        item.category,
        item.location
      ].filter(Boolean).join(' ').toLowerCase();

      const status = getStatus(item);
      const aiComplete = hasAiAssessment(item);
      const isCompleted =
  status === 'approved' || status === 'rejected';

if (activeTab === 'pending' && isCompleted) {
  return false;
}

if (activeTab === 'completed' && !isCompleted) {
  return false;
}

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'ai_assessment' &&
          status === 'pending' && !aiComplete) ||
        (statusFilter === 'human_review' &&
          (status === 'flagged' ||
            (status === 'pending' && aiComplete))) ||
        status === statusFilter;

      return (
        (!keyword || searchable.includes(keyword)) &&
        matchesStatus
      );
    });
  }, [participations, search, statusFilter, activeTab]);

  

const steps = [
  {
    key: 'registered',
    title: 'Registered',
    description: 'You successfully registered for this activity.'
  },
  {
    key: 'check_in',
    title: 'QR Check-In',
    description: 'Scan the activity QR code upon arrival.'
  },
  {
    key: 'submitted',
    title: 'Proof Submitted',
    description: 'Capture and submit your participation proof.'
  },
  {
    key: 'check_out',
    title: 'QR Check-Out',
    description: 'Scan the activity QR code before leaving.'
  },
  {
    key: 'ai_assessment',
    title: 'AI Assessment',
    description: 'AI checks for unusual patterns and fraud-risk indicators.'
  },
  {
    key: 'human_review',
    title: 'Human Review',
    description: 'An authorized LGU reviewer examines your participation.'
  },
  {
    key: 'final',
    title: 'Final Decision',
    description: 'Participation is approved or rejected. Smart Points are awarded upon approval.'
  }
];




 
 return (
  <div className={modalOnly ? 'myp-page myp-modal-only' : 'myp-page'}>
    {!modalOnly && (
      <>
        <div className="myp-header">
        <div>
          <h1>My Participation</h1>
          <p>
            Submit participation proofs, track AI assessment,
            review status, and earned Smart Points.
          </p>
        </div>
      </div>

      <div className="myp-participation-tabs">
  <button
    type="button"
    className={activeTab === 'pending' ? 'active' : ''}
    onClick={() => {
      setActiveTab('pending');
      setStatusFilter('all');
    }}
  >
    Pending (
    {participations.filter(item =>
      !['approved', 'rejected'].includes(getStatus(item))
    ).length}
    )
  </button>

  <button
    type="button"
    className={activeTab === 'completed' ? 'active' : ''}
    onClick={() => {
      setActiveTab('completed');
      setStatusFilter('all');
    }}
  >
    Completed (
    {participations.filter(item =>
      ['approved', 'rejected'].includes(getStatus(item))
    ).length}
    )
  </button>
</div>

      {/* HISTORY FILTERS */}
      <div className="myp-toolbar">
        <div className="myp-search-box">
          <span className="myp-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search your activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="myp-status-filter">
          <label htmlFor="participation-status">Status</label>
          <select
            id="participation-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
           <option value="all">All Statuses</option>

{activeTab === 'pending' ? (
  <>
    <option value="not_submitted">Registered</option>
    <option value="ai_assessment">AI Assessment</option>
    <option value="human_review">Human Review</option>
  </>
) : (
  <>
    <option value="approved">Approved</option>
    <option value="rejected">Rejected</option>
  </>
)}
          </select>
        </div>
      </div>

      <div className="myp-section-header">
        <div>
          <h2>Participation History</h2>
          <p>
            Showing <strong>{filteredParticipations.length}</strong>{' '}
            {filteredParticipations.length === 1
              ? 'activity' : 'activities'}
          </p>
        </div>
      </div>

      {error && (
        <div className="myp-error">
          <span>{error}</span>
          <button type="button" onClick={fetchParticipations}>
            Try Again
          </button>
        </div>
      )}

      {loading ? (
        <div className="myp-loading">
          <div className="myp-spinner" />
          <p>Loading your participation history...</p>
        </div>
      ) : filteredParticipations.length === 0 ? (
        <div className="myp-empty">
          <div className="myp-empty-icon">✓</div>
          <h3>
           {participations.some((item) =>
  item.registration_id && item.activity_id
)
              ? 'No matching participation found'
              : 'No submissions yet'}
          </h3>
          <p>
           Your registered activities will appear here,
even before you submit participation proof.
          </p>
        </div>
      ) : (
        <div className="myp-list">
          {filteredParticipations.map((item, index) => {
            const status = getStatus(item);
            const title = item.activity_title ||
              `Activity #${item.activity_id}`;

            const points = status === 'approved'
              ? Number(item.awarded_points || 0)
              : Number(item.points_value || 0);

            return (
              <div
                className="myp-card"
                key={
                  item.registration_id ||
                  item.participation_id ||
                  `${item.activity_id}-${index}`
                }
              >
                <div className="myp-image-wrapper">
                  {item.image_url ? (
                    <img
                      src={getActivityImageUrl(item.image_url)}
                      alt={title}
                      className="myp-image"
                    />
                  ) : (
                    <div className="myp-image-placeholder">
                      <span>★</span>
                      <small>CitiPoints Activity</small>
                    </div>
                  )}
                  <span className="myp-category">
                    {item.category || 'Community'}
                  </span>
                </div>

                <div className="myp-card-content">
                  <div className="myp-card-top">
                    <div className="myp-title-area">
                      <h3>{title}</h3>
                      <p>
                        {item.description ||
                          'Community participation activity'}
                      </p>
                    </div>
                    <span className={`myp-status myp-status-${status}`}>
                      {getStatusLabel(item)}
                    </span>
                  </div>

                  <div className="myp-details">
                    <div className="myp-detail">
                      <span className="myp-detail-icon">📍</span>
                      <div>
                        <small>Location</small>
                        <strong>
                          {item.location || 'Not specified'}
                        </strong>
                      </div>
                    </div>

                    <div className="myp-detail">
                      <span className="myp-detail-icon">📅</span>
                      <div>
                        <small>Activity Date</small>
                        <strong>{formatDate(item.date_start)}</strong>
                        {item.date_start && (
                          <em>{formatTime(item.date_start)}</em>
                        )}
                      </div>
                    </div>

                    <div className="myp-detail">
                      <span className="myp-detail-icon">↑</span>
                      <div>
                        <small>Proof Submission</small>
                        <strong>
                          {item.proof_url
                            ? 'Submitted' : 'Not Submitted'}
                        </strong>
                        {item.submitted_at && (
                          <em>{formatDate(item.submitted_at)}</em>
                        )}
                      </div>
                    </div>

                    <div className="myp-detail">
                      <span className="myp-detail-icon">★</span>
                      <div>
                        <small>
                          {status === 'approved'
                            ? 'Points Earned'
                            : 'Activity Points'}
                        </small>
                        <strong className="myp-points">
                          {points} pts
                        </strong>
                      </div>
                    </div>
                  </div>

                  {status === 'pending' && (
                    <div className="myp-message myp-message-pending">
                      <span>◷</span>
                      <p>
                        {hasAiAssessment(item)
                          ? 'AI assessment completed. Waiting for human review.'
                          : 'Your proof is undergoing AI-assisted assessment.'}
                      </p>
                    </div>
                  )}

                  {status === 'flagged' && (
                    <div className="myp-message myp-message-flagged">
                      <span>!</span>
                      <p>
                        Additional human review is required.
                        An authorized LGU reviewer makes the final decision.
                      </p>
                    </div>
                  )}

                  {status === 'approved' && (
                    <div className="myp-message myp-message-approved">
                      <span>✓</span>
                      <p>
                        Participation verified. Smart Points awarded.
                      </p>
                    </div>
                  )}

                  {status === 'rejected' && (
                    <div className="myp-message myp-message-rejected">
                      <span>×</span>
                      <p>Your participation was not approved.</p>
                    </div>
                  )}

                  <div className="myp-card-footer">
                    <div className="myp-id-area">
                      <div>
                        <small>Registration ID</small>
                        <strong>#{item.registration_id || '—'}</strong>
                      </div>
                      <div>
                        <small>Participation ID</small>
                      <strong>
  {item.participation_id
    ? `#${item.participation_id}`
    : 'Not yet submitted'}
</strong>
                      </div>
                    </div>

                    <div className="myp-actions">
                      <button
                        type="button"
                        className="myp-primary-btn"
                        onClick={() => setSelectedSubmission(item)}
                      >
                        Review Submission
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}



      </>
    )}

    {modalOnly && error && !selectedSubmission && (
      <div className="myp-modal-backdrop" onClick={onClose}>
        <div
          className="myp-status-modal"
          role="alertdialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <p>{error}</p>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    )}
      {/* SUBMISSION STATUS MODAL */}
      {selectedSubmission && (
        <div
          className="myp-modal-backdrop"
          onClick={closeSubmissionModal}
        >
          <div
            className="myp-status-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Submission Status"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="myp-status-modal-header">
              <div>
                <h2>Submission Status</h2>
                <p>Track your participation review progress.</p>
              </div>
              <button
                type="button"
                className="myp-status-close"
                onClick={closeSubmissionModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="myp-status-activity">
              <span>Activity</span>
              <h3>
                {selectedSubmission.activity_title ||
                  selectedSubmission.title}
              </h3>
              <p>{formatDate(selectedSubmission.date_start)}</p>
            </div>

          

<div className="myp-status-timeline">
{steps.map((step, index) => {
      const status = getStatus(selectedSubmission);

      const hasProof = Boolean(selectedSubmission.proof_url);
      const hasCheckIn = Boolean(selectedSubmission.check_in_at);
      const hasCheckOut = Boolean(selectedSubmission.check_out_at);
      const aiCompleted =
        hasProof && hasAiAssessment(selectedSubmission);

      const isFinal =
        status === 'approved' || status === 'rejected';

     const isQrActivity = true;

      let completed = false;
      let active = false;
      let timestamp = null;

      switch (step.key) {
        case 'registered':
          completed = Boolean(selectedSubmission.registration_id);
          timestamp = selectedSubmission.registered_at;
          break;

        case 'check_in':
          completed = hasCheckIn;
          active = !hasCheckIn;
          timestamp = selectedSubmission.check_in_at;
          break;

        case 'submitted':
          completed = hasProof;
          active = !hasProof && (!isQrActivity || hasCheckIn);
          timestamp = selectedSubmission.submitted_at;
          break;

        case 'check_out':
          completed = hasCheckOut;
          active = hasCheckIn && !hasCheckOut;
          timestamp = selectedSubmission.check_out_at;
          break;

        case 'ai_assessment':
          completed = aiCompleted;
          active = hasProof && !aiCompleted;
          break;

        case 'human_review':
          completed = isFinal;
          active = aiCompleted && !isFinal;
          break;

        case 'final':
          completed = isFinal;
          timestamp = selectedSubmission.reviewed_at;
          break;

        default:
          break;
      }

      let title = step.title;
      let description = step.description;

      if (step.key === 'final' && isFinal) {
        title = status === 'approved' ? 'Approved' : 'Rejected';
        description =
          status === 'approved'
            ? 'Participation approved. Smart Points awarded.'
            : 'Your participation was rejected.';
      }

      if (step.key === 'submitted' && !hasProof) {
        description = 'Participation proof has not been submitted yet.';
      }

      return (
        <div
          key={step.key}
          className={`myp-timeline-item ${
            completed ? 'completed' : active ? 'active' : ''
          }`}
        >
          <div className="myp-timeline-marker">
            {completed ? '✓' : index + 1}
          </div>

          <div className="myp-timeline-content">
            <h4>{title}</h4>
            <p>{description}</p>

            {timestamp && (
              <small>{new Date(timestamp).toLocaleString()}</small>
            )}

            {(step.key === 'check_in' ||
              step.key === 'check_out') &&
              !completed && (
                <small>Not yet recorded</small>
              )}
          </div>
        </div>
      );
    })}
</div>


    {gpsIssue && (
  <div className="myp-gps-alert" role="alert">
    <div className="myp-gps-alert-header">
      <div className="myp-gps-alert-icon">📍</div>
      <div>
        <h3>Location Access Required</h3>
        <p>{gpsIssueMessage}</p>
      </div>
    </div>

   <div className="myp-gps-instructions">

  {gpsIssue === 'permission' && (
    <div className="myp-gps-instruction-card">
      <h4>🌐 Browser Location Permission</h4>
      <p>Chrome has denied or blocked location access.</p>

      <ol>
        <li>Open CitiPoints directly in Chrome.</li>
       <li>
  Tap the Site Information icon
  <span className="myp-site-info-icon" aria-label="Site Information">
    ⓘ
  </span>
  beside the website address in Chrome.
</li>
        <li>Open Permissions or Site settings.</li>
        <li>Find Location and select Allow.</li>
        <li>Return to CitiPoints and tap Try Again.</li>
      </ol>
    </div>
  )}

  {gpsIssue === 'device' && (
    <div className="myp-gps-instruction-card">
      <h4>📱 Device Location Settings</h4>
      <p>Check that your phone's location service is enabled.</p>

      <ol>
        <li>Open your phone Settings.</li>
        <li>Go to Location.</li>
        <li>Turn on Use location.</li>
        <li>Enable Precise location if available.</li>
        <li>Return to CitiPoints and tap Try Again.</li>
      </ol>
    </div>
  )}

  {gpsIssue === 'general' && (
    <div className="myp-gps-instruction-card">
      <h4>⚠️ Location Troubleshooting</h4>
      <p>CitiPoints could not access your location.</p>

      <ol>
        <li>Make sure your device Location is turned on.</li>
        <li>Check that Chrome is allowed to use Location.</li>
        <li>Open CitiPoints using HTTPS.</li>
        <li>Return to CitiPoints and tap Try Again.</li>
      </ol>
    </div>
  )}

</div>

    <div className="myp-gps-alert-footer">
      <span>
        After updating your settings, check your location again.
      </span>

      <button
        type="button"
        className="myp-primary-btn"
        onClick={openCamera}
        disabled={cameraBusy || gpsChecking}
      >
        {cameraBusy || gpsChecking
          ? 'Checking Location...'
          : '🔄 Try Again'}
      </button>
    </div>
  </div>
)}

{uploadError && (
  <div className="myp-camera-error">
    {uploadError}
  </div>
)}
{cameraError && (
  <div className="myp-camera-error" role="alert">
    {cameraError}
  </div>
)}

{cameraOpen && (
  <div className="myp-camera-section">
    <h3>Capture Participation Proof</h3>

    <p>Take a clear photo of your participation in this activity.</p>

    <div className="myp-camera-preview">
      {capturedPhoto ? (
        <img
          src={photoPreview}
          alt="Captured participation proof"
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
        />
      )}
    </div>

    <div className="myp-camera-actions">
      {!capturedPhoto ? (
        <button
          type="button"
          className="myp-primary-btn"
          onClick={capturePhoto}
        >
          📷 Capture Photo
        </button>
      ) : (
        <>
          <button
            type="button"
            className="myp-primary-btn"
            onClick={retakePhoto}
            disabled={submitting}
          >
            Retake
          </button>

          <button
            type="button"
            className="myp-primary-btn"
            onClick={submitCapturedProof}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Confirm & Submit Proof'}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={closeCamera}
        disabled={submitting}
      >
        Cancel Camera
      </button>
    </div>
  </div>
)}

<div className="myp-status-modal-footer">
  {!cameraOpen &&
    !selectedSubmission.proof_url &&
    !['approved', 'rejected'].includes(getStatus(selectedSubmission)) && (
      <button
        type="button"
        className="myp-primary-btn"
       onClick={openCamera}
disabled={cameraBusy || gpsChecking}
      >
      {cameraBusy || gpsChecking
  ? 'Checking Location...'
  : '📷 Submit Proof'}
      </button>
    )}

  <button
    type="button"
    className="myp-primary-btn"
    onClick={closeSubmissionModal}
    disabled={submitting}
  >
    Close
  </button>
</div>

          </div>
        </div>
      )}
    </div>
  );
}

export default MyParticipationsPage;
