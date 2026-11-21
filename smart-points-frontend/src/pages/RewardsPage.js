import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const API_BASE_URL = api.defaults.baseURL.replace(/\/+$/, '');

const BACKEND_ORIGIN = new URL(
  API_BASE_URL,
  window.location.origin
).origin;

const getRewardImageUrl = (imageUrl) => {
  if (!imageUrl) return null;

  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('blob:')
  ) {
    return imageUrl;
  }

  return `${BACKEND_ORIGIN}/${imageUrl.replace(/^\/+/, '')}`;
};


function PartnerBrandLogo({ reward, providerName }) {
  const partnerId = Number(reward?.partner_id);

  const hasPartnerLogo =
    Number(reward?.has_partner_logo) === 1 &&
    Number.isSafeInteger(partnerId) &&
    partnerId > 0;

  return (
    <div className="cp-reward-store-icon">
      {/* Default icon if there is no logo */}
      <span aria-hidden="true">🏬</span>

      {/* Actual Partner Profile Picture */}
      {hasPartnerLogo && (
        <img
          src={`${BACKEND_ORIGIN}/api/partners/public/${partnerId}/logo`}
          alt={`${providerName} logo`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

function RewardsPage() {
 
  const [rewards, setRewards] = useState([]);
  const [createImagePreview, setCreateImagePreview] = useState(null);
const [editImagePreview, setEditImagePreview] = useState(null);
  const [recommendedRewards, setRecommendedRewards] = useState([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationBalance, setRecommendationBalance] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createImageFile, setCreateImageFile] = useState(null);
const [editImageFile, setEditImageFile] = useState(null);

useEffect(() => {
  if (!createImageFile) {
    setCreateImagePreview(null);
    return;
  }

  const previewUrl = URL.createObjectURL(createImageFile);
  setCreateImagePreview(previewUrl);

  return () => URL.revokeObjectURL(previewUrl);
}, [createImageFile]);

useEffect(() => {
  if (!editImageFile) {
    setEditImagePreview(null);
    return;
  }

  const previewUrl = URL.createObjectURL(editImageFile);
  setEditImagePreview(previewUrl);

  return () => URL.revokeObjectURL(previewUrl);
}, [editImageFile]);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [previewReward, setPreviewReward] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  const [editForm, setEditForm] = useState({
    reward_name: '',
    description: '',
    category: '',
    points_cost: '',
    stock: '',
    availability_status: 'available',
    partner_id: '',
    image_url: '',
  });

  const [createForm, setCreateForm] = useState({
    reward_name: '',
    description: '',
    category: '',
    points_cost: '',
    stock: '',
    partner_id: '',
    image_url: '',
  });

 
const user = JSON.parse(localStorage.getItem('user') || '{}');
const role = user?.role;

// Super Admin and LGU use the same Rewards interface.
const isAdmin = role === 'admin' || role === 'lgu';

const isPartner = role === 'partner';
const isCitizen = role === 'community_member';

const canManageReward = (reward) => {
  if (role === 'admin') {
    return true;
  }

  if (role !== 'lgu' && role !== 'partner') {
    return false;
  }

  if (
    user?.user_id == null ||
    reward?.created_by_user_id == null
  ) {
    return false;
  }

  return (
    String(reward.created_by_user_id) ===
    String(user.user_id)
  );
};



  /* =========================================================
     INITIAL LOAD
     ========================================================= */

  useEffect(() => {
    fetchRewards();

    if (isCitizen) {
      fetchRecommendations();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer;

    if (showToast) {
      timer = setTimeout(() => {
        setShowToast(false);
        setMessage('');
        setMessageType('');
      }, 3000);
    }

    return () => clearTimeout(timer);
  }, [showToast]);

  /* =========================================================
     MESSAGE
     ========================================================= */

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setShowToast(true);
  };

  /* =========================================================
     FETCH REWARDS
     ========================================================= */

  const fetchRewards = async () => {
    try {
      const res = await api.get('/rewards');
      setRewards(res.data.rewards || []);
    } catch (error) {
      showMessage(
        error.response?.data?.message || 'Failed to load rewards',
        'error'
      );
    }
  };

  /* =========================================================
     AI RECOMMENDATIONS
     ========================================================= */

  const fetchRecommendations = async () => {
    try {
      setRecommendationLoading(true);

      const res = await api.get('/recommendations/rewards');

      setRecommendedRewards(res.data.recommendations || []);

      setRecommendationBalance(
        Number(res.data.current_points || 0)
      );
    } catch (error) {
      console.error(
        'Failed to load AI recommendations:',
        error.response?.data || error.message
      );

      setRecommendedRewards([]);
    } finally {
      setRecommendationLoading(false);
    }
  };

  /* =========================================================
     PARTNERS
     ========================================================= */


  /* =========================================================
     CREATE
     ========================================================= */

  const resetCreateForm = () => {
    setCreateImageFile(null);
    setCreateForm({
      
      reward_name: '',
      description: '',
      category: '',
      points_cost: '',
      stock: '',
      image_url: '',
    });
  };

  const handleRewardImageChange = (event, mode) => {
   
  const file = event.target.files?.[0];

  if (!file) return;

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.type)) {
    showMessage(
      'Please select a JPG, PNG, or WebP image.',
      'error'
    );
    event.target.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showMessage(
      'Reward image must not exceed 5 MB.',
      'error'
    );
    event.target.value = '';
    return;
  }

  if (mode === 'create') {
    setCreateImageFile(file);
  } else {
    setEditImageFile(file);
  }
};
  const handleCreateChange = (event) => {
    setCreateForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

 const handleCreateReward = async (event) => {
  event.preventDefault();

  try {
    const payload = new FormData();

    payload.append('reward_name', createForm.reward_name);
    payload.append('description', createForm.description);
    payload.append('category', createForm.category);
    payload.append('points_cost', Number(createForm.points_cost));
    payload.append('stock', Number(createForm.stock));

    if (createImageFile) {
      payload.append('reward_image', createImageFile);
    }

    const res = await api.post('/rewards', payload);

    showMessage(
      res.data.message || 'Reward created successfully',
      'success'
    );

    resetCreateForm();
    setShowCreateModal(false);
    await fetchRewards();
  } catch (error) {
    showMessage(
      error.response?.data?.message || 'Failed to create reward',
      'error'
    );
  }
};

  /* =========================================================
     EDIT
     ========================================================= */

  const startEdit = (reward) => {
    
    setEditingId(reward.reward_id);

    setEditForm({
      reward_name: reward.reward_name || '',
      description: reward.description || '',
      category: reward.category || '',
      points_cost: reward.points_cost || '',
      stock: reward.stock || '',
      availability_status:
        reward.availability_status || 'available',
     
      image_url: reward.image_url || '',
    });
    setEditImageFile(null);
    setShowEditModal(true);
  };

  const cancelEdit = () => {
    setEditImageFile(null);
    setEditingId(null);
    setShowEditModal(false);
  };

  const handleEditChange = (event) => {
    setEditForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleUpdate = async (rewardId) => {
  try {
    const payload = new FormData();

    payload.append('reward_name', editForm.reward_name);
    payload.append('description', editForm.description);
    payload.append('category', editForm.category);
    payload.append('points_cost', Number(editForm.points_cost));
    payload.append('stock', Number(editForm.stock));
    payload.append('availability_status', editForm.availability_status);

    if (editImageFile) {
      payload.append('reward_image', editImageFile);
    }

    const res = await api.put(`/rewards/${rewardId}`, payload);

    showMessage(
      res.data.message || 'Reward updated successfully',
      'success'
    );

    setEditImageFile(null);
    setEditingId(null);
    setShowEditModal(false);

    await fetchRewards();
  } catch (error) {
    showMessage(
      error.response?.data?.message || 'Failed to update reward',
      'error'
    );
  }
};

  /* =========================================================
     DEACTIVATE
     ========================================================= */

  const handleDelete = async (rewardId) => {
    const confirmed = window.confirm(
      'Are you sure you want to deactivate this reward?'
    );

    if (!confirmed) return;

    try {
      const res = await api.delete(
        `/rewards/${rewardId}`
      );

      showMessage(
        res.data.message ||
          'Reward deactivated successfully',
        'success'
      );

      setShowEditModal(false);
      setEditingId(null);

      await fetchRewards();
    } catch (error) {
      showMessage(
        error.response?.data?.message ||
          'Failed to deactivate reward',
        'error'
      );
    }
  };

const openRedeemModal = (reward) => {
  setSelectedReward(reward);
  setShowRedeemModal(true);
};

const closeRedeemModal = () => {
  if (redeeming) return;

  setShowRedeemModal(false);
  setSelectedReward(null);
};

  /* =========================================================
     REDEEM
     ========================================================= */

const handleRedeem = async () => {
  if (!selectedReward?.reward_id) return;

  try {
    setRedeeming(true);

    const res = await api.post(
      `/rewards/${selectedReward.reward_id}/redeem`
    );

    showMessage(
      res.data.message ||
        'Redemption request submitted successfully',
      'success'
    );

    setShowRedeemModal(false);
    setSelectedReward(null);

    await fetchRewards();

    if (isCitizen) {
      await fetchRecommendations();
    }
  } catch (error) {
    showMessage(
      error.response?.data?.message ||
        'Failed to submit redemption request',
      'error'
    );
  } finally {
    setRedeeming(false);
  }
};

  /* =========================================================
     HELPERS
     ========================================================= */

  const categories = useMemo(() => {
    return [
      ...new Set(
        rewards
          .map((reward) => reward.category)
          .filter(Boolean)
      ),
    ];
  }, [rewards]);

  const getPartnerName = (reward) => {
    return (
      reward.organization_name ||
      reward.partner_name ||
      reward.partner_organization ||
      'CitiPoints'
    );
  };

  const getStatus = (reward) => {
    if (Number(reward.stock || 0) <= 0) {
      return 'out_of_stock';
    }

    return reward.availability_status || 'available';
  };

  const formatStatus = (status) => {
    if (status === 'available') return 'Available';
    if (status === 'inactive') return 'Inactive';
    if (status === 'out_of_stock') return 'Out of Stock';
    if (status === 'pending') return 'Pending';

    return status || 'Unknown';
  };

  const filteredRewards = useMemo(() => {
    return rewards.filter((reward) => {
      const searchValue = searchTerm
        .trim()
        .toLowerCase();

      const searchable = [
        reward.reward_name,
        reward.description,
        reward.category,
        reward.organization_name,
        reward.partner_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !searchValue ||
        searchable.includes(searchValue);

      const matchesCategory =
        selectedCategory === 'all' ||
        reward.category === selectedCategory;

      const status = getStatus(reward);

      const matchesStatus =
        statusFilter === 'all' ||
        status === statusFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus
      );
    });
  }, [
    rewards,
    searchTerm,
    selectedCategory,
    statusFilter,
  ]);

  const availableRewards = rewards.filter(
    (reward) =>
      getStatus(reward) === 'available'
  );

  const inactiveRewards = rewards.filter(
    (reward) =>
      getStatus(reward) === 'inactive'
  );

  const unavailableRewards = rewards.filter(
    (reward) =>
      getStatus(reward) === 'out_of_stock'
  );

  /* =========================================================
     CITIZEN RECOMMENDATIONS
     ========================================================= */

  const citizenRecommendations = useMemo(() => {
    return recommendedRewards.map(
      (recommendedReward) => {
        const catalogReward =
          rewards.find(
            (reward) =>
              Number(reward.reward_id) ===
              Number(recommendedReward.reward_id)
          ) || {};

        return {
          ...catalogReward,
          ...recommendedReward,
        };
      }
    );
  }, [recommendedRewards, rewards]);

  /* =========================================================
     TOAST
     ========================================================= */

  const Toast = () => {
    if (!showToast) return null;

    return (
      <div className="floating-toast-wrap">
        <div
          className={`floating-toast ${
            messageType === 'success'
              ? 'floating-toast-success'
              : 'floating-toast-error'
          }`}
        >
          <div className="floating-toast-icon">
            {messageType === 'success' ? '✓' : '!'}
          </div>

          <div className="floating-toast-content">
            <h4>
              {messageType === 'success'
                ? 'Success'
                : 'Error'}
            </h4>

            <p>{message}</p>
          </div>
        </div>
      </div>
    );
  };

  /* =========================================================
     ADMIN / PARTNER TABLE
     ========================================================= */

  const ManagementTable = () => (
    <section className="role-reward-panel">
      <div className="role-reward-panel-heading">
        <div>
          <h2>
            {isAdmin
              ? 'Rewards List'
              : 'My Reward Items'}
          </h2>

          <p>
            {isAdmin
              ? 'Manage reward items, point costs, availability, and partner information.'
              : 'Create, update, and manage your reward items.'}
          </p>
        </div>

        <button
          type="button"
          className="role-reward-add-btn"
          onClick={() =>
            setShowCreateModal(true)
          }
        >
          + Add Reward
        </button>
      </div>

      <div className="role-reward-toolbar">
        <div className="role-reward-search">
          <span>⌕</span>

          <input
            type="text"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search reward name or description..."
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(event) =>
            setSelectedCategory(event.target.value)
          }
        >
          <option value="all">
            All Categories
          </option>

          {categories.map((category) => (
            <option
              key={category}
              value={category}
            >
              {category}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
        >
          <option value="all">
            All Status
          </option>

          <option value="available">
            Available
          </option>

          <option value="out_of_stock">
            Out of Stock
          </option>

          <option value="inactive">
            Inactive
          </option>

          <option value="pending">
            Pending
          </option>
        </select>
      </div>

      <div className="role-reward-table-wrap">
        <table className="role-reward-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Reward</th>

              {isAdmin && (
                <th>Partner</th>
              )}

              <th>Category</th>
              <th>Point Cost</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRewards.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 8 : 7}
                  className="role-reward-empty-cell"
                >
                  <div className="role-reward-empty">
                    <span>🎁</span>

                    <strong>
                      No rewards found
                    </strong>

                    <p>
                      No reward items match your
                      current filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRewards.map((reward) => {
                const status =
                  getStatus(reward);

                return (
                  <tr key={reward.reward_id}>
                    <td>
                      #{reward.reward_id}
                    </td>

                    <td>
                      <div className="role-reward-item">
                        <div className="role-reward-thumb">
                          {reward.image_url ? (
                            <img
                            src={getRewardImageUrl(reward.image_url)}
                              alt={
                                reward.reward_name
                              }
                            />
                          ) : (
                            <span>🎁</span>
                          )}
                        </div>

                        <div>
                          <strong>
                            {reward.reward_name}
                          </strong>

                          <span>
                            {reward.description ||
                              'No description'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {isAdmin && (
                      <td>
                        {getPartnerName(
                          reward
                        )}
                      </td>
                    )}

                    <td>
                      {reward.category ||
                        'General'}
                    </td>

                    <td>
                      <span className="role-reward-points">
                        {Number(
                          reward.points_cost || 0
                        ).toLocaleString()}{' '}
                        pts
                      </span>
                    </td>

                    <td>
                      {Number(
                        reward.stock || 0
                      ).toLocaleString()}
                    </td>

                    <td>
                      <span
                        className={`role-reward-status ${status}`}
                      >
                        <i />
                        {formatStatus(status)}
                      </span>
                    </td>

                   
<td>
  <div className="role-reward-actions">
    {canManageReward(reward) &&
      status !== 'inactive' &&
      !(isPartner && status === 'pending') && (
        <>
          <button
            type="button"
            onClick={() => startEdit(reward)}
          >
            Edit
          </button>

          <button
            type="button"
            className="role-reward-more"
            onClick={() =>
              handleDelete(reward.reward_id)
            }
            title="Deactivate"
          >
            •••
          </button>
        </>
      )}
  </div>
</td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  /* =========================================================
     ADMIN
     ========================================================= */

  const AdminRewards = () => (
    <main className="role-rewards-page">
      <section className="role-rewards-hero">
        <div>
          <span>REWARDS MANAGEMENT</span>

          <h1>Manage Rewards</h1>

          <p>
            Create and manage rewards that citizens
            can redeem using their Smart Points.
          </p>
        </div>

      </section>

      <section className="role-reward-stats role-reward-stats-admin">
        <RewardStat
          icon="🎁"
          title="Total Rewards"
          value={rewards.length}
          description="Reward items"
          type="blue"
        />

        <RewardStat
          icon="✓"
          title="Available Rewards"
          value={availableRewards.length}
          description="Currently available"
          type="green"
        />

        <RewardStat
          icon="◷"
          title="Inactive Rewards"
          value={inactiveRewards.length}
          description="Currently inactive"
          type="orange"
        />

        <RewardStat
          icon="◎"
          title="Out of Stock"
          value={unavailableRewards.length}
          description="No remaining stock"
          type="red"
        />
      </section>

      <ManagementTable />

      <section className="role-reward-info-grid">
        <InfoCard
          icon="⚙"
          title="Reward Management"
          text="Manage reward details, point costs, stock, and availability."
        />

        <InfoCard
          icon="♟"
          title="Partner Integration"
          text="Rewards may be offered through approved CitiPoints partners."
        />

        <InfoCard
          icon="★"
          title="Citizen Engagement"
          text="Citizens can use accumulated Smart Points to redeem available rewards."
        />
      </section>
    </main>
  );

  /* =========================================================
     PARTNER
     ========================================================= */

  const PartnerRewards = () => (
    <main className="role-rewards-page">
      <section className="role-rewards-hero">
        <div>
          <span>PARTNER REWARDS</span>

          <h1>My Rewards</h1>

          <p>
            Manage the reward items offered by your
            organization.
          </p>
        </div>
      </section>

      <section className="role-reward-stats role-reward-stats-partner">
        <RewardStat
          icon="🎁"
          title="My Rewards"
          value={rewards.length}
          description="Total reward items"
          type="blue"
        />

        <RewardStat
          icon="✓"
          title="Available"
          value={availableRewards.length}
          description="Currently available"
          type="green"
        />

        <RewardStat
          icon="!"
          title="Out of Stock"
          value={unavailableRewards.length}
          description="Unavailable"
          type="red"
        />
      </section>

      <ManagementTable />
    </main>
  );

  /* =========================================================
     COMMUNITY MEMBER
     ========================================================= */

  const CitizenRewards = () => (
    <main className="citizen-rewards-page">
      <div className="citizen-rewards-top">
        <section className="citizen-rewards-hero">
          <div>
            <span>REWARDS CATALOG</span>

            <h1>Redeem Rewards</h1>

            <p>
              Use your Smart Points to claim rewards
              from available CitiPoints partners.
            </p>
          </div>

         
        </section>

        <section className="citizen-points-card">
          <div className="citizen-points-icon">
            ★
          </div>

          <div>
            <span>Your Smart Points</span>

            <strong>
  {Number(
    recommendationBalance
  ).toLocaleString()}{' '}
  pts
</strong>

            <small>
              Keep participating to earn more points!
            </small>
          </div>
        </section>
      </div>

      {/* AI RECOMMENDATIONS */}

      <section className="citizen-ai-rewards">
        <div className="citizen-section-heading">
          <div>
            <h2>
              <span className="citizen-ai-icon">
                AI
              </span>
              AI Recommended for You
            </h2>

            <p>
              Personalized reward suggestions based
              on your participation and reward
              history.
            </p>
          </div>
        </div>

        {recommendationLoading ? (
          <div className="citizen-rewards-empty">
            Loading recommendations...
          </div>
        ) : citizenRecommendations.length ===
          0 ? (
          <div className="citizen-rewards-empty">
            No recommendations available right now.
          </div>
        ) : (
          <div className="citizen-recommendation-grid">
            {citizenRecommendations
              .slice(0, 4)
              .map((reward) => (
                <CitizenRewardCard
                  key={reward.reward_id}
                  reward={reward}
                  balance={
                    recommendationBalance
                  }
                  recommended
                 onRedeem={openRedeemModal}
                 onViewDetails={setPreviewReward}
                />
              ))}
          </div>
        )}
      </section>

      {/* ALL REWARDS */}

      <section className="citizen-all-rewards">
        <div className="citizen-section-heading">
          <div>
            <h2>All Rewards</h2>

            <p>
              Browse available rewards from our
              partners.
            </p>
          </div>
        </div>

        <div className="citizen-reward-toolbar">
          <div className="citizen-reward-search">
            <span>⌕</span>

            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder="Search rewards..."
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(event) =>
              setSelectedCategory(
                event.target.value
              )
            }
          >
            <option value="all">
              All Categories
            </option>

            {categories.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>
        </div>

        {filteredRewards.filter(
          (reward) =>
            getStatus(reward) === 'available'
        ).length === 0 ? (
          <div className="citizen-rewards-empty">
            No available rewards found.
          </div>
        ) : (
          <div className="citizen-reward-grid">
            {filteredRewards
              .filter(
                (reward) =>
                  getStatus(reward) ===
                  'available'
              )
              .map((reward) => (
                <CitizenRewardCard
                  key={reward.reward_id}
                  reward={reward}
                  balance={recommendationBalance}
                 onRedeem={openRedeemModal}
                 onViewDetails={setPreviewReward}
                />
              ))}
          </div>
        )}
      </section>
    </main>
  );

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <>
      <Toast />

      {isAdmin && <AdminRewards />}

      {isPartner && <PartnerRewards />}

      {isCitizen && <CitizenRewards />}

      {/* =====================================================
          CREATE MODAL
          ===================================================== */}

      {showCreateModal && (
        <div
          className="reward-role-modal-overlay"
          onClick={() => {
            setShowCreateModal(false);
            resetCreateForm();
          }}
        >
          <div
            className="reward-role-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="reward-role-modal-header">
              <div>
                <span>REWARD MANAGEMENT</span>
                <h2>Add New Reward</h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
              >
                ×
              </button>
            </div>

            <form
              className="reward-role-form"
              onSubmit={handleCreateReward}
            >
              <RewardField
                label="Reward Name"
                required
              >
                <input
                  type="text"
                  name="reward_name"
                  value={
                    createForm.reward_name
                  }
                  onChange={
                    handleCreateChange
                  }
                  placeholder="Enter reward name"
                  required
                />
              </RewardField>

              <RewardField label="Description">
                <textarea
                  name="description"
                  value={
                    createForm.description
                  }
                  onChange={
                    handleCreateChange
                  }
                  placeholder="Enter reward description"
                />
              </RewardField>

              <div className="reward-role-form-row">
                <RewardField label="Category" required>
  <select
    name="category"
    value={createForm.category}
    onChange={handleCreateChange}
    required
  >
    <option value="">
      Select reward category
    </option>

    <option value="Vouchers">
      Vouchers
    </option>

    <option value="Essentials & Relief">
      Essentials & Relief
    </option>

    <option value="Gadgets & Electronics">
      Gadgets & Electronics
    </option>

    <option value="Merchandise / Goods">
      Merchandise / Goods
    </option>

    <option value="Services">
      Services
    </option>
  </select>
</RewardField>

                <RewardField
                  label="Points Cost"
                  required
                >
                  <input
                    type="number"
                    min="0"
                    name="points_cost"
                    value={
                      createForm.points_cost
                    }
                    onChange={
                      handleCreateChange
                    }
                    placeholder="0"
                    required
                  />
                </RewardField>
              </div>

              <div className="reward-role-form-row">
                <RewardField
                  label="Stock Quantity"
                  required
                >
                  <input
                    type="number"
                    min="0"
                    name="stock"
                    value={
                      createForm.stock
                    }
                    onChange={
                      handleCreateChange
                    }
                    placeholder="0"
                    required
                  />
                </RewardField>

                
                
              </div>

            <RewardField label="Reward Image">
  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={(event) =>
      handleRewardImageChange(event, 'create')
    }
  />

  <small>
    Accepted formats: JPG, PNG, WebP (maximum 5 MB)
  </small>

  {createImagePreview && (
    <div className="reward-role-image-preview">
      <img
        src={createImagePreview}
        alt="New reward preview"
        style={{
          width: '100%',
          maxHeight: '180px',
          objectFit: 'contain',
          borderRadius: '10px'
        }}
      />
    </div>
  )}
</RewardField>

              <div className="reward-role-modal-footer">
                <button
                  type="button"
                  className="reward-role-cancel"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="reward-role-save"
                >
                  Create Reward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          EDIT MODAL
          ===================================================== */}

      {showEditModal && editingId && (
        <div
          className="reward-role-modal-overlay"
          onClick={cancelEdit}
        >
          <div
            className="reward-role-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="reward-role-modal-header">
              <div>
                <span>REWARD MANAGEMENT</span>
                <h2>Edit Reward Item</h2>
              </div>

              <button
                type="button"
                onClick={cancelEdit}
              >
                ×
              </button>
            </div>

            <div className="reward-role-form">
             {editForm.image_url && !editImagePreview && (
  <div className="reward-role-image-preview">
    <img
      src={getRewardImageUrl(editForm.image_url)}
      alt={editForm.reward_name}
    />
  </div>
)}

              <RewardField
                label="Reward Name"
                required
              >
                <input
                  name="reward_name"
                  value={
                    editForm.reward_name
                  }
                  onChange={handleEditChange}
                />
              </RewardField>

              <RewardField label="Description">
                <textarea
                  name="description"
                  value={
                    editForm.description
                  }
                  onChange={handleEditChange}
                />
              </RewardField>

              <div className="reward-role-form-row">
                <RewardField label="Category">
                  <input
                    name="category"
                    value={
                      editForm.category
                    }
                    onChange={
                      handleEditChange
                    }
                  />
                </RewardField>

                <RewardField label="Points Cost">
                  <input
                    type="number"
                    min="0"
                    name="points_cost"
                    value={
                      editForm.points_cost
                    }
                    onChange={
                      handleEditChange
                    }
                  />
                </RewardField>
              </div>

              <div className="reward-role-form-row">
                <RewardField label="Stock Quantity">
                  <input
                    type="number"
                    min="0"
                    name="stock"
                    value={editForm.stock}
                    onChange={
                      handleEditChange
                    }
                  />
                </RewardField>

                <RewardField label="Status">
                  <select
                    name="availability_status"
                    value={
                      editForm.availability_status
                    }
                    onChange={
                      handleEditChange
                    }
                  >
                    <option value="pending">
                      Pending
                    </option>

                    <option value="available">
                      Available
                    </option>

                    <option value="out_of_stock">
                      Out of Stock
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </RewardField>
              </div>

             <RewardField label="Reward Image">
  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={(event) =>
      handleRewardImageChange(event, 'edit')
    }
  />

  <small>
    Select a new image to replace the existing one.
    Maximum size: 5 MB.
  </small>

  {editImagePreview && (
    <div className="reward-role-image-preview">
      <img
        src={editImagePreview}
        alt="Replacement reward preview"
        style={{
          width: '100%',
          maxHeight: '180px',
          objectFit: 'contain',
          borderRadius: '10px'
        }}
      />
    </div>
  )}
</RewardField>

              <div className="reward-role-modal-footer reward-role-edit-footer">
             
{canManageReward(
  rewards.find(
    (reward) =>
      String(reward.reward_id) === String(editingId)
  )
) &&
  !(isPartner &&
    rewards.find(
      (reward) =>
        String(reward.reward_id) === String(editingId)
    )?.availability_status === 'pending') && (
    <button
      type="button"
      className="reward-role-delete"
      onClick={() => handleDelete(editingId)}
    >
      Deactivate
    </button>
  )}


                <div>
                  <button
                    type="button"
                    className="reward-role-cancel"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="reward-role-save"
                    onClick={() =>
                      handleUpdate(editingId)
                    }
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


{/* REWARD DETAILS MODAL */}

{isCitizen && previewReward && (
  <div
    className="reward-role-modal-overlay cp-reward-preview-overlay"
    onClick={() => setPreviewReward(null)}
  >
    <div
      className="cp-reward-preview-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cp-reward-preview-title"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="cp-reward-preview-close"
        aria-label="Close reward details"
        onClick={() => setPreviewReward(null)}
      >
        ×
      </button>

      <div className="cp-reward-preview-image">
        <div className="cp-reward-photo-fallback">
          <span aria-hidden="true">🎁</span>
          <small>Reward image</small>
        </div>

        {previewReward.image_url && (
          <img
            src={getRewardImageUrl(previewReward.image_url)}
            alt={previewReward.reward_name}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>

      <div className="cp-reward-preview-content">
        <div className="cp-reward-preview-brand">
          <span aria-hidden="true">🏬</span>

          <div>
            <strong>
              {getPartnerName(previewReward)}
            </strong>
            <small>
              Reward Provider
            </small>
          </div>
        </div>

        {previewReward.category && (
          <span className="cp-reward-category-pill">
            {previewReward.category}
          </span>
        )}

        <h2 id="cp-reward-preview-title">
          {previewReward.reward_name}
        </h2>

        <p className="cp-reward-preview-description">
          {previewReward.description ||
            'No additional reward description provided.'}
        </p>

        <div className="cp-reward-preview-stats">
          <div>
            <small>Required Points</small>
            <strong>
              {Number(
                previewReward.points_cost || 0
              ).toLocaleString()} pts
            </strong>
          </div>

          <div>
            <small>Available Stock</small>
            <strong>
              {Number(
                previewReward.stock || 0
              ).toLocaleString()}
            </strong>
          </div>
        </div>

        <p className="cp-reward-preview-note">
          Claim location and instructions will be provided
          when your redemption request is approved.
        </p>

        <div className="cp-reward-preview-actions">
          <button
            type="button"
            className="cp-reward-detail-btn"
            onClick={() => setPreviewReward(null)}
          >
            Close
          </button>

          <button
            type="button"
            className="cp-reward-redeem-btn"
            disabled={
              Number(previewReward.stock || 0) <= 0 ||
              Number(recommendationBalance || 0) <
                Number(previewReward.points_cost || 0)
            }
            onClick={() => {
              const rewardToRedeem = previewReward;
              setPreviewReward(null);
              openRedeemModal(rewardToRedeem);
            }}
          >
            Redeem Reward
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {/* =====================================================
    REDEEM CONFIRMATION MODAL
    ===================================================== */}

{showRedeemModal && selectedReward && (
  <div
    className="reward-role-modal-overlay"
    onClick={closeRedeemModal}
  >
    <div
      className="reward-role-modal citizen-redeem-modal"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="reward-role-modal-header">
        <div>
          <span>REWARD REDEMPTION</span>
          <h2>Redeem Reward?</h2>
        </div>

        <button
          type="button"
          onClick={closeRedeemModal}
          disabled={redeeming}
        >
          ×
        </button>
      </div>

      <div className="citizen-redeem-content">
        <div className="citizen-redeem-reward">
          <div className="citizen-redeem-image">
            {selectedReward.image_url ? (
              <img
                src={getRewardImageUrl(selectedReward.image_url)}
                alt={selectedReward.reward_name}
              />
            ) : (
              <span>🎁</span>
            )}
          </div>

          <div>
            <h3>{selectedReward.reward_name}</h3>

            <p>
  <strong>Partner:</strong>{' '}
  {getPartnerName(selectedReward)}
</p>
          </div>
        </div>

        <div className="citizen-redeem-summary">
          <div>
            <span>Reward Cost</span>
            <strong>
              {Number(
                selectedReward.points_cost || 0
              ).toLocaleString()}{' '}
              pts
            </strong>
          </div>

          <div>
            <span>Current Balance</span>
            <strong>
              {Number(
                recommendationBalance || 0
              ).toLocaleString()}{' '}
              pts
            </strong>
          </div>

          <div>
            <span>Balance After Approval</span>
            <strong>
              {Math.max(
                0,
                Number(recommendationBalance || 0) -
                  Number(selectedReward.points_cost || 0)
              ).toLocaleString()}{' '}
              pts
            </strong>
          </div>
        </div>

        <div className="citizen-redeem-notice">
          <span>!</span>

          <p>
            Your Smart Points will not be deducted yet.
            They will only be deducted if the partner
            approves this redemption request.
          </p>
        </div>
      </div>

      <div className="reward-role-modal-footer">
        <button
          type="button"
          className="reward-role-cancel"
          onClick={closeRedeemModal}
          disabled={redeeming}
        >
          Cancel
        </button>

        <button
          type="button"
          className="reward-role-save"
          onClick={handleRedeem}
          disabled={redeeming}
        >
          {redeeming
            ? 'Submitting...'
            : 'Confirm Redemption'}
        </button>
      </div>
    </div>
  </div>
)}
    </>
    
  );
}

/* =========================================================
   REWARD STAT
   ========================================================= */

function RewardStat({
  icon,
  title,
  value,
  description,
  type,
}) {
  return (
    <article className="role-reward-stat">
      <div
        className={`role-reward-stat-icon ${type}`}
      >
        {icon}
      </div>

      <div>
        <span>{title}</span>

        <strong>
          {Number(value || 0).toLocaleString()}
        </strong>

        <small>{description}</small>
      </div>
    </article>
  );
}

/* =========================================================
   INFO CARD
   ========================================================= */

function InfoCard({ icon, title, text }) {
  return (
    <article className="role-reward-info-card">
      <div>{icon}</div>

      <section>
        <strong>{title}</strong>
        <p>{text}</p>
      </section>
    </article>
  );
}

/* =========================================================
   FORM FIELD
   ========================================================= */

function RewardField({
  label,
  required,
  children,
}) {
  return (
    <label className="reward-role-field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>

      {children}
    </label>
  );
}

/* =========================================================
   CITIZEN REWARD CARD
   ========================================================= */


function CitizenRewardCard({
  reward,
  balance,
  onRedeem,
  onViewDetails,
  recommended = false,
}) {
  const cost = Number(reward.points_cost || 0);
  const stock = Number(reward.stock || 0);
  const currentBalance = Number(balance || 0);

  const partnerName =
    reward.organization_name ||
    reward.partner_name ||
    reward.partner_organization ||
    '';

  const providerName = partnerName || 'CitiPoints';

  const canRedeem =
    currentBalance >= cost && stock > 0;

  const missingPoints = Math.max(
    0,
    cost - currentBalance
  );

  const description =
    reward.description?.trim() ||
    'Discover this reward and redeem it using your Smart Points.';

  return (
    <article
      className={`citizen-reward-card ${
        recommended ? 'recommended' : ''
      }`}
    >
      {/* REWARD PHOTO */}
      <div className="citizen-reward-image">
        <div className="cp-reward-photo-fallback">
          <span aria-hidden="true">🎁</span>
          <small>Reward image</small>
        </div>

        {reward.image_url && (
          <img
            src={getRewardImageUrl(reward.image_url)}
            alt={reward.reward_name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}

        {recommended && (
          <span className="citizen-recommended-label">
            ✦ AI Recommended
          </span>
        )}
      </div>

      <div className="citizen-reward-card-body">
        {/* ESTABLISHMENT BRANDING */}
        <div className="cp-reward-provider">
         <PartnerBrandLogo
  reward={reward}
  providerName={providerName}
/>

          <div className="cp-reward-provider-info">
            <strong title={providerName}>
              {providerName}
            </strong>

            <span>
              {partnerName
                ? 'Partner Establishment'
                : 'CitiPoints Reward'}
            </span>
          </div>
        </div>

        {/* CATEGORY */}
        {reward.category && (
          <span className="cp-reward-category-pill">
            {reward.category}
          </span>
        )}

        {/* REWARD NAME */}
        <h3 title={reward.reward_name}>
          {reward.reward_name}
        </h3>

        {/* DESCRIPTION */}
        <p className="cp-reward-description">
          {description}
        </p>

        {/* AI EXPLANATION */}
        {recommended &&
          reward.reasons?.length > 0 && (
            <small className="citizen-reward-reason">
              ✦ {reward.reasons[0]}
            </small>
          )}

        {/* POINTS AND AVAILABILITY */}
        <div className="cp-reward-value-row">
          <div>
            <span className="cp-reward-points-label">
              REDEMPTION COST
            </span>

            <strong className="citizen-reward-cost">
              {cost.toLocaleString()} pts
            </strong>
          </div>

          <span
            className={`cp-reward-stock ${
              stock <= 0 ? 'unavailable' : ''
            }`}
          >
            {stock <= 0
              ? 'Out of Stock'
              : stock <= 5
              ? `${stock} left`
              : 'Available'}
          </span>
        </div>

        {/* AFFORDABILITY */}
        <p
          className={`cp-reward-affordability ${
            missingPoints > 0 ? 'missing' : ''
          }`}
        >
          {stock <= 0
            ? 'Currently unavailable for redemption'
            : missingPoints > 0
            ? `Earn ${missingPoints.toLocaleString()} more points`
            : '✓ You have enough Smart Points'}
        </p>

        {/* BUTTONS */}
        <div className="cp-reward-card-buttons">
          <button
            type="button"
            className="cp-reward-detail-btn"
            onClick={() => onViewDetails(reward)}
          >
            View Details
          </button>

          <button
            type="button"
            className="cp-reward-redeem-btn"
            disabled={!canRedeem}
            onClick={() => onRedeem(reward)}
          >
            {stock <= 0
              ? 'Unavailable'
              : missingPoints > 0
              ? 'Not Enough Points'
              : 'Redeem'}
          </button>
        </div>
      </div>
    </article>
  );
}


export default RewardsPage;