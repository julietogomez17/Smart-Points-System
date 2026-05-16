import React, { useEffect, useState } from 'react';
import api from '../services/api';

function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showParticipationModal, setShowParticipationModal] = useState(false);
  const [showProofForm, setShowProofForm] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [showAllParticipations, setShowAllParticipations] = useState(false);

  const [userRole, setUserRole] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participants, setParticipants] = useState([]);

  const [adminActivityTab, setAdminActivityTab] = useState('active');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    image_url: '',
    category: '',
    location: '',
    date_start: '',
    date_end: '',
    points_value: '',
    capacity: '',
    validation_type: 'manual',
    status: 'open'
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    setUserRole(user?.role);

    fetchActivities();

    const interval = setInterval(() => {
      fetchActivities();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await api.get('/activities');
      const data = res.data.activities || [];

      setActivities(data);

      setSelectedActivity((prevSelected) => {
        if (!prevSelected) return data[0] || null;

        return (
          data.find((a) => a.activity_id === prevSelected.activity_id) ||
          prevSelected
        );
      });
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to load activities');
    }
  };

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
      date_start: '',
      date_end: '',
      points_value: '',
      capacity: '',
      validation_type: 'manual',
      status: 'open'
    });
  };

  const handleCreateActivity = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        title: createForm.title,
        description: createForm.description || null,
        category: createForm.category || null,
        location: createForm.location || null,
        date_start: createForm.date_start,
        date_end: createForm.date_end || null,
        points_value: Number(createForm.points_value),
        capacity: createForm.capacity === '' ? null : Number(createForm.capacity),
        validation_type: createForm.validation_type,
        status: createForm.status,
        image_url: createForm.image_url || null
      };

      const res = await api.post('/activities', payload);

      alert(res.data.message || 'Activity created successfully');
      resetCreateForm();
      setShowCreateModal(false);
      fetchActivities();
    } catch (error) {
      console.error('Create activity error:', error.response?.data || error);

      alert(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to create activity'
      );
    }
  };

  const handleRegister = async (activityId) => {
    const clickedActivity = activities.find((a) => a.activity_id === activityId);

    try {
      await api.post(`/activities/${activityId}/join`);

      setActivities((prevActivities) =>
        prevActivities.map((activity) =>
          activity.activity_id === activityId
            ? { ...activity, is_joined: true, participation_status: 'pending' }
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
    } catch (error) {
      if (error.response?.status === 409) {
        setActivities((prevActivities) =>
          prevActivities.map((activity) =>
            activity.activity_id === activityId
              ? { ...activity, is_joined: true, participation_status: 'pending' }
              : activity
          )
        );

        setSelectedActivity({
          ...clickedActivity,
          is_joined: true,
          participation_status: 'pending'
        });

        setShowParticipationModal(true);
        return;
      }

      alert(error.response?.data?.message || 'Failed to register activity');
    }
  };

  const handleSubmitProof = (activityId) => {
    const activity = activities.find((a) => a.activity_id === activityId);

    if (!activity?.is_joined) {
      alert('Please register first before submitting proof.');
      return;
    }

    setSelectedActivity(activity);
    setShowParticipationModal(false);
    setShowProofForm(true);
  };

  const submitProofForm = async () => {
    if (!proofFile) {
      alert('Please upload proof image.');
      return;
    }

    const formData = new FormData();
    formData.append('proof_file', proofFile);
    formData.append('feedback_text', feedbackText);
    formData.append('activity_id', selectedActivity.activity_id);

    try {
      await api.post('/participations', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Proof submitted successfully!');
      setShowProofForm(false);
      setProofFile(null);
      setFeedbackText('');
      fetchActivities();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to submit proof');
    }
  };

  const formatForDateTimeInput = (date) => {
    if (!date) return '';

    const d = new Date(date);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);

    return local.toISOString().slice(0, 16);
  };

  const handleEdit = (activity) => {
    setEditForm({
      activity_id: activity.activity_id,
      title: activity.title || '',
      description: activity.description || '',
      category: activity.category || '',
      location: activity.location || '',
      date_start: formatForDateTimeInput(activity.date_start),
      date_end: formatForDateTimeInput(activity.date_end),
      points_value: activity.points_value || '',
      capacity: activity.capacity || '',
      validation_type: activity.validation_type || 'manual',
      status: activity.status || 'open',
      partner_id: activity.partner_id ?? '',
      image_url: activity.image_url || ''
    });

    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    });
  };

  const handleUpdateActivity = async () => {
    try {
      const toMysqlDateTime = (value) => {
        if (!value) return null;
        return value.replace('T', ' ') + ':00';
      };

      const payload = {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        location: editForm.location,
        date_start: toMysqlDateTime(editForm.date_start),
        date_end: toMysqlDateTime(editForm.date_end),
        points_value: Number(editForm.points_value),
        capacity: editForm.capacity === '' ? null : Number(editForm.capacity),
        validation_type: editForm.validation_type,
        status: editForm.status,
        image_url: editForm.image_url || null,
        partner_id: null
      };

      await api.put(`/activities/${editForm.activity_id}`, payload);

      alert('Activity updated successfully');
      setShowEditModal(false);
      fetchActivities();
    } catch (error) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to update activity');
    }
  };

  const handleDeactivate = async (activityId) => {
    const confirmDeactivate = window.confirm(
      'Are you sure you want to deactivate/cancel this activity?'
    );

    if (!confirmDeactivate) return;

    try {
      await api.delete(`/activities/${activityId}`);
      alert('Activity deactivated successfully');
      fetchActivities();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to deactivate activity');
    }
  };

  const handleViewParticipants = async (activityId) => {
    try {
      const res = await api.get(`/participations/activity/${activityId}`);
      setParticipants(res.data.participants || []);
      setShowParticipantsModal(true);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to fetch participants');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';

    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return 'N/A';

    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

const isManager = userRole === 'admin' || userRole === 'partner';

const activeActivities =
  userRole === 'admin'
    ? activities.filter((a) =>
        adminActivityTab === 'active'
          ? a.status === 'open' || a.status === 'closed' || a.status === 'completed'
          : a.status === 'cancelled'
      )
    : userRole === 'partner'
    ? activities.filter((a) =>
        adminActivityTab === 'active'
          ? a.status !== 'cancelled'
          : a.status === 'cancelled'
      )
    : activities.filter((a) => a.status === 'open');

  return (
    <div className="member-activities-page">
      <div className="member-layout" style={{ gridTemplateColumns: '1fr' }}>
        <main className="member-main">
          <section className="member-header-card activity-admin-header">
            <div>
             <h1>
  {(userRole === 'admin' || userRole === 'partner')
    ? 'Activities Management'
    : 'Activities'}
</h1>

<p>
  {(userRole === 'admin' || userRole === 'partner')
    ? 'Manage activities, participants and verification.'
    : 'Explore engagement opportunities and manage community activities.'}
</p>
            </div>

           {(userRole === 'admin' || userRole === 'partner') && (
              <button
                type="button"
                className="add-activity-btn"
                onClick={() => setShowCreateModal(true)}
              >
                <span>＋</span>
                Add New Activity
              </button>
            )}
          </section>

          <div className="member-tabs">
          {(userRole === 'admin' || userRole === 'partner') ? (
              <>
                <button
                  className={adminActivityTab === 'active' ? 'member-tab active' : 'member-tab'}
                  onClick={() => setAdminActivityTab('active')}
                >
                  Active Activities ({activities.filter((a) => a.status !== 'cancelled').length})
                </button>

                <button
                  className={adminActivityTab === 'history' ? 'member-tab active' : 'member-tab'}
                  onClick={() => setAdminActivityTab('history')}
                >
                  History Record ({activities.filter((a) => a.status === 'cancelled').length})
                </button>
              </>
            ) : (
              <button className="member-tab active">
                Active Activities ({activeActivities.length})
              </button>
            )}
          </div>

          <h3 className="section-title">
            {userRole === 'admin' && adminActivityTab === 'history'
              ? 'History Record'
              : 'Active Activities'}
          </h3>

          <div className="activity-card-grid">
            {activeActivities.map((activity) => (
              <div
                className="member-activity-card"
                key={activity.activity_id}
                onClick={() => setSelectedActivity(activity)}
              >
                <div
                  className="activity-image-area"
                  style={{
                    backgroundImage: `linear-gradient(rgba(15,23,42,.08), rgba(15,23,42,.92)), url("${
                      activity.image_url ||
                      'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=900&q=80'
                    }")`
                  }}
                >
                  <span className="open-pill">{activity.status || 'Open'}</span>

                  <div className="activity-content">
                    <span className="category-chip">
                      {activity.category || 'Community'}
                    </span>

                    <h2>{activity.title}</h2>
                    <p>{activity.description || 'Join this community activity.'}</p>

                    <div className="activity-tags">
                      <span>📍 {activity.location || 'N/A'}</span>
                      <span>⭐ {activity.points_value || 0} pts</span>
                    </div>
                  </div>
                </div>

                <div className="activity-date-strip">
                  <div>
                    <small>Start Date</small>
                    <strong>{formatDate(activity.date_start)}</strong>
                    <strong>{formatTime(activity.date_start)}</strong>
                  </div>

                  <div>
                    <small>End Date</small>
                    <strong>{formatDate(activity.date_end)}</strong>
                    <strong>{formatTime(activity.date_end)}</strong>
                  </div>

                  <div>
                    <small>Slots</small>
                    <strong>{activity.joined_count || 0} / {activity.capacity || '∞'}</strong>
                  </div>
                </div>

                <div className="activity-status-strip">
                  <div>
                    <small>{userRole === 'admin' ? 'Status' : 'Registration'}</small>
                    <strong className={activity.is_joined ? 'green-text' : 'orange-text'}>
                      {userRole === 'admin'
                        ? activity.status
                        : activity.is_joined
                        ? '✅ Approved'
                        : '⏳ Not Registered'}
                    </strong>
                  </div>

                  <div>
                    <small>{userRole === 'admin' ? 'Participants' : 'Participation Proof'}</small>
                    <strong className="orange-text">
                      {userRole === 'admin'
                        ? `${activity.joined_count || 0} joined`
                        : activity.participation_status === 'approved'
                        ? '✅ Approved'
                        : activity.participation_status === 'rejected'
                        ? '❌ Rejected'
                        : '🕘 Pending'}
                    </strong>
                  </div>
                </div>

             {(userRole === 'admin' || userRole === 'partner') ? (
                  <div className="admin-card-actions">
                    {activity.status === 'cancelled' ? (
                      <button
                        className="admin-view-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleViewParticipants(activity.activity_id);
                        }}
                      >
                        History Record
                      </button>
                    ) : (
                      <>
                        <button
                          className="admin-edit-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEdit(activity);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="admin-view-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewParticipants(activity.activity_id);
                          }}
                        >
                          View Joined
                        </button>

                        <button
                          className="admin-delete-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeactivate(activity.activity_id);
                          }}
                        >
                          Deactivate
                        </button>
                      </>
                    )}
                  </div>
                ) : !activity.is_joined ? (
                  <button
                    className="member-register-btn"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRegister(activity.activity_id);
                    }}
                  >
                    Register Now
                  </button>
                ) : (
                  <div className="button-group">
                    <button className="member-register-btn registered" disabled>
                      Registered ✓
                    </button>

                    {activity.participation_status === 'approved' ? (
                      <button className="member-register-btn completed" disabled>
                        Completed ✓
                      </button>
                    ) : (
                      <button
                        className="member-register-btn completed"
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedActivity({
                            ...activity,
                            is_joined: true,
                            participation_status:
                              activity.participation_status || 'pending'
                          });
                          setShowParticipationModal(true);
                        }}
                      >
                        Submit Proof
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

        {userRole === 'community_member' && (
            <>
              <div className="how-it-works">
                <div><b>① Register</b><span>Auto-approved instantly</span></div>
                <div>→</div>
                <div><b>② Join Activity</b><span>Participate in the event</span></div>
                <div>→</div>
                <div><b>③ Submit Proof</b><span>Upload attendance proof</span></div>
                <div>→</div>
                <div><b>④ Earn Rewards</b><span>Admin verifies rewards</span></div>
              </div>

              <section className="recent-card">
                <div className="recent-header">
                  <h3>My Participations</h3>
                  <button
                    type="button"
                    onClick={() => setShowAllParticipations(!showAllParticipations)}
                  >
                    {showAllParticipations ? 'Show Less' : 'View All'}
                  </button>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Date</th>
                      <th>Registration</th>
                      <th>Proof Status</th>
                      <th>Points</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {activities
                      .filter((a) => a.is_joined)
                      .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))
                      .slice(
                        0,
                        showAllParticipations
                          ? activities.filter((a) => a.is_joined).length
                          : 3
                      )
                      .map((a) => (
                        <tr key={a.activity_id}>
                          <td>{a.title}</td>
                          <td>{formatDate(a.date_start)}</td>
                          <td className="green-text">Approved</td>

                          <td
                            className={
                              a.participation_status === 'approved'
                                ? 'green-text'
                                : a.participation_status === 'rejected'
                                ? 'red-text'
                                : 'orange-text'
                            }
                          >
                            {a.participation_status === 'approved'
                              ? 'Approved'
                              : a.participation_status === 'rejected'
                              ? 'Rejected'
                              : 'Under Review'}
                          </td>

                          <td>
                            {a.participation_status === 'approved'
                              ? `⭐ ${a.awarded_points || a.points_value || 0} pts`
                              : a.participation_status === 'rejected'
                              ? '0 pts'
                              : 'Under Review'}
                          </td>

                          <td>
                            <span
                              className={
                                a.participation_status === 'approved'
                                  ? 'approved-badge'
                                  : a.participation_status === 'rejected'
                                  ? 'rejected-badge hover-reason'
                                  : 'pending-badge'
                              }
                            >
                              {a.participation_status === 'approved'
                                ? 'Completed'
                                : a.participation_status === 'rejected'
                                ? (
                                    <>
                                      <span className="default-text">Rejected</span>
                                      <span className="hover-text">
                                        {a.rejection_reason || 'No reason'}
                                      </span>
                                    </>
                                  )
                                : 'Under Review'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </main>

        {showCreateModal && (
          <div className="participation-modal-backdrop">
            <div className="create-activity-modal">
              <button
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

              <form onSubmit={handleCreateActivity} className="create-activity-modal-form">
                <input
                  type="text"
                  name="title"
                  placeholder="Activity Title"
                  value={createForm.title}
                  onChange={handleCreateChange}
                  required
                />

                <input
                  type="text"
                  name="description"
                  placeholder="Description"
                  value={createForm.description}
                  onChange={handleCreateChange}
                />

                <input
                  type="text"
                  name="image_url"
                  placeholder="Image URL"
                  value={createForm.image_url}
                  onChange={handleCreateChange}
                />

                <input
                  type="text"
                  name="category"
                  placeholder="Category"
                  value={createForm.category}
                  onChange={handleCreateChange}
                />

                <input
                  type="text"
                  name="location"
                  placeholder="Location"
                  value={createForm.location}
                  onChange={handleCreateChange}
                />

                <input
                  type="datetime-local"
                  name="date_start"
                  value={createForm.date_start}
                  onChange={handleCreateChange}
                  required
                />

                <input
                  type="datetime-local"
                  name="date_end"
                  value={createForm.date_end}
                  onChange={handleCreateChange}
                />

                <input
                  type="number"
                  name="points_value"
                  placeholder="Points Value"
                  value={createForm.points_value}
                  onChange={handleCreateChange}
                  required
                />

                <input
                  type="number"
                  name="capacity"
                  placeholder="Capacity"
                  value={createForm.capacity}
                  onChange={handleCreateChange}
                />

                <select
                  name="validation_type"
                  value={createForm.validation_type}
                  onChange={handleCreateChange}
                >
                  <option value="manual">manual</option>
                  <option value="qr">qr</option>
                  <option value="proof_upload">proof_upload</option>
                </select>

                <select
                  name="status"
                  value={createForm.status}
                  onChange={handleCreateChange}
                >
                  <option value="draft">draft</option>
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>

                <button type="submit" className="create-activity-submit-btn">
                  Create Activity
                </button>
              </form>
            </div>
          </div>
        )}

        {showParticipationModal && selectedActivity && (
          <div className="participation-modal-backdrop">
            <div className="participation-modal">
              <button
                className="modal-close-btn"
                onClick={() => setShowParticipationModal(false)}
              >
                ×
              </button>

              <section className="side-card modal-side-card">
                <h2>My Participation</h2>
                <p>Track your activity participation and rewards.</p>

                <div className="status-panel">
                  <div className="icon green">✓</div>
                  <div>
                    <h4>Registration Status</h4>
                    <b className={selectedActivity?.is_joined ? 'green-text' : 'orange-text'}>
                      {selectedActivity?.is_joined ? 'Approved' : 'Not Registered'}
                    </b>
                    <p>
                      {selectedActivity?.is_joined
                        ? 'You are registered for this activity.'
                        : 'Click register to join this activity.'}
                    </p>
                  </div>
                </div>

                <div className="status-panel">
                  <div className="icon orange">⌚</div>
                  <div>
                    <h4>Participation Proof Status</h4>
                    <b
                      className={
                        selectedActivity?.participation_status === 'approved'
                          ? 'green-text'
                          : selectedActivity?.participation_status === 'rejected'
                          ? 'red-text'
                          : 'orange-text'
                      }
                    >
                      {selectedActivity?.participation_status === 'approved'
                        ? 'Approved'
                        : selectedActivity?.participation_status === 'rejected'
                        ? 'Rejected'
                        : 'Under Review'}
                    </b>
                    <p>Submit your proof after the activity.</p>
                  </div>
                </div>

                <div className="proof-box">
                  <h4>What is Participation Proof?</h4>
                  <p>▣ Photo proof/selfie/activity photo</p>

                  {selectedActivity?.participation_status !== 'approved' &&
                    selectedActivity?.participation_status !== 'rejected' && (
                      <button
                        onClick={() => handleSubmitProof(selectedActivity.activity_id)}
                      >
                        Submit Participation Proof
                      </button>
                    )}
                </div>

                <div className="details-box">
                  <h4>Activity Details</h4>
                  <p><span>Date</span>{formatDate(selectedActivity.date_start)}</p>
                  <p>
                    <span>Time</span>
                    {formatTime(selectedActivity.date_start)} - {formatTime(selectedActivity.date_end)}
                  </p>
                  <p><span>Location</span>{selectedActivity.location}</p>
                  <p><span>Points</span>⭐ {selectedActivity.points_value} pts</p>
                  <p><span>Organizer</span>{selectedActivity.partner_name || 'ASD Organization'}</p>
                </div>

                <div className="important-box">
                  <b>Important</b>
                  <p>Rewards will be given after admin verification of your participation proof.</p>
                </div>
              </section>
            </div>
          </div>
        )}

        {showProofForm && selectedActivity && (
          <div className="participation-modal-backdrop">
            <div className="participation-modal">
              <button
                className="modal-close-btn"
                onClick={() => setShowProofForm(false)}
              >
                ×
              </button>

              <section className="side-card modal-side-card">
                <h2>Submit Participation Proof</h2>
                <p>Upload your proof image and feedback.</p>

                <div className="proof-box">
                  <h4>{selectedActivity.title}</h4>

                  <label className="proof-label">Proof Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files[0])}
                  />

                  <label className="proof-label">Feedback</label>
                  <textarea
                    className="proof-textarea"
                    placeholder="Write your feedback about this activity..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />

                  <button onClick={submitProofForm}>Submit Proof</button>
                </div>
              </section>
            </div>
          </div>
        )}

        {showEditModal && editForm && (
          <div className="participation-modal-backdrop">
            <div className="participation-modal admin-edit-modal">
              <button
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>

              <section className="side-card modal-side-card">
                <h2>Edit Activity</h2>
                <p>Update activity details and status.</p>

                <div className="admin-edit-form">
                  <input name="title" value={editForm.title} onChange={handleEditChange} placeholder="Title" />
                  <textarea name="description" value={editForm.description} onChange={handleEditChange} placeholder="Description" />
                  <input name="category" value={editForm.category} onChange={handleEditChange} placeholder="Category" />
                  <input name="location" value={editForm.location} onChange={handleEditChange} placeholder="Location" />
                  <input name="image_url" value={editForm.image_url} onChange={handleEditChange} placeholder="Image URL" />
                  <input type="datetime-local" name="date_start" value={editForm.date_start} onChange={handleEditChange} />
                  <input type="datetime-local" name="date_end" value={editForm.date_end} onChange={handleEditChange} />
                  <input name="points_value" value={editForm.points_value} onChange={handleEditChange} placeholder="Points" />
                  <input name="capacity" value={editForm.capacity} onChange={handleEditChange} placeholder="Capacity" />

                  <select name="validation_type" value={editForm.validation_type} onChange={handleEditChange}>
                    <option value="manual">manual</option>
                    <option value="qr">qr</option>
                    <option value="proof_upload">proof_upload</option>
                  </select>

                  <select name="status" value={editForm.status} onChange={handleEditChange}>
                    <option value="draft">draft</option>
                    <option value="open">open</option>
                    <option value="closed">closed</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>

                  <button onClick={handleUpdateActivity}>Save Changes</button>
                </div>
              </section>
            </div>
          </div>
        )}

        {showParticipantsModal && (
          <div className="participation-modal-backdrop">
            <div className="participation-modal">
              <button
                className="modal-close-btn"
                onClick={() => setShowParticipantsModal(false)}
              >
                ×
              </button>

              <section className="side-card modal-side-card">
                <h2>Participants History</h2>
                <p>Users who registered for this activity.</p>

                {participants.length === 0 ? (
                  <div className="proof-box">
                    <p>No participants found.</p>
                  </div>
                ) : (
                  <div className="participants-list">
                    {participants.map((p, index) => (
                      <div key={index} className="participant-row">
                        <b>{p.full_name}</b>
                        <span>{p.email}</span>
                        <small>{new Date(p.created_at).toLocaleString()}</small>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivitiesPage;