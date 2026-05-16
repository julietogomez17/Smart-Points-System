import React, { useEffect, useState } from 'react';
import api from '../services/api';

function RewardsPage() {
  const [rewardTab, setRewardTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [rewards, setRewards] = useState([]);
  const [partners, setPartners] = useState([]);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [editForm, setEditForm] = useState({
    reward_name: '',
    description: '',
    category: '',
    points_cost: '',
    stock: '',
    availability_status: 'available',
    partner_id: '',
    image_url: ''
  });

  const [createForm, setCreateForm] = useState({
    reward_name: '',
    description: '',
    category: '',
    points_cost: '',
    stock: '',
    partner_id: '',
    image_url: ''
  });

  const user = JSON.parse(localStorage.getItem('user'));
  const userPoints = Number(user?.points_balance || 0);

useEffect(() => {
  fetchRewards();

  if (user?.role === 'admin') {
    fetchPartners();
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

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setShowToast(true);
  };

  const fetchRewards = async () => {
    try {
      const res = await api.get('/rewards');
      setRewards(res.data.rewards || []);
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to load rewards', 'error');
    }
  };

  const fetchPartners = async () => {
    try {
      const res = await api.get('/partners');
      setPartners(res.data.partners || res.data || []);
    } catch (error) {
      console.error('Failed to load partners:', error);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      reward_name: '',
      description: '',
      category: '',
      points_cost: '',
      stock: '',
      partner_id: '',
      image_url: ''
    });
  };

  const handleCreateChange = (e) => {
    setCreateForm({
      ...createForm,
      [e.target.name]: e.target.value
    });
  };

  const handleCreateReward = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        reward_name: createForm.reward_name,
        description: createForm.description,
        category: createForm.category,
        points_cost: Number(createForm.points_cost),
        stock: Number(createForm.stock),
        image_url: createForm.image_url,
        partner_id:
          user?.role === 'partner'
            ? user.user_id
            : createForm.partner_id === ''
              ? null
              : Number(createForm.partner_id)
      };

      const res = await api.post('/rewards', payload);

      showMessage(res.data.message || 'Reward created successfully', 'success');
      resetCreateForm();
      setShowCreateModal(false);
      fetchRewards();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to create reward', 'error');
    }
  };

  const getRewardProgress = (reward) => {
    const cost = Number(reward?.points_cost || 0);

    if (cost <= 0) {
      return {
        percent: 0,
        remaining: 0
      };
    }

    return {
      percent: Math.min((userPoints / cost) * 100, 100),
      remaining: Math.max(cost - userPoints, 0)
    };
  };

  const handleRedeem = async (rewardId) => {
    try {
      const res = await api.post(`/rewards/${rewardId}/redeem`);

      showMessage(res.data.message || 'Reward redeemed successfully', 'success');
      fetchRewards();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to redeem reward', 'error');
    }
  };

  const startEdit = (reward) => {
    setEditingId(reward.reward_id);

    setEditForm({
      reward_name: reward.reward_name || '',
      description: reward.description || '',
      category: reward.category || '',
      points_cost: reward.points_cost || '',
      stock: reward.stock || '',
      availability_status: reward.availability_status || 'available',
      partner_id: reward.partner_id || '',
      image_url: reward.image_url || ''
    });

    setShowEditModal(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowEditModal(false);
  };

  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    });
  };

  const handleUpdate = async (rewardId) => {
    try {
      const payload = {
        ...editForm,
        points_cost: Number(editForm.points_cost),
        stock: Number(editForm.stock),
        partner_id:
          editForm.partner_id === '' || editForm.partner_id === null
            ? null
            : Number(editForm.partner_id)
      };

      const res = await api.put(`/rewards/${rewardId}`, payload);

      showMessage(res.data.message || 'Reward updated successfully', 'success');
      setEditingId(null);
      setShowEditModal(false);
      fetchRewards();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to update reward', 'error');
    }
  };

  const handleDelete = async (rewardId) => {
    const confirmed = window.confirm('Are you sure you want to deactivate this reward?');

    if (!confirmed) return;

    try {
      const res = await api.delete(`/rewards/${rewardId}`);

      showMessage(res.data.message || 'Reward deactivated successfully', 'success');
      fetchRewards();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to deactivate reward', 'error');
    }
  };

  const categories = [...new Set(rewards.map((r) => r.category).filter(Boolean))];

  const filteredRewards = rewards.filter((reward) => {
    const name = reward.reward_name || '';
    const description = reward.description || '';

    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || reward.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const activeRewards = filteredRewards.filter(
    (reward) => reward.availability_status !== 'inactive'
  );

  const inactiveRewards = filteredRewards.filter(
    (reward) => reward.availability_status === 'inactive'
  );

  const visibleRewards = rewardTab === 'active' ? activeRewards : inactiveRewards;
  const featuredReward = visibleRewards[0];
  const otherRewards = visibleRewards.slice(1);

  const ProgressBlock = ({ reward }) => {
    const progress = getRewardProgress(reward);

    return (
      <>
        <div className="reward-progress">
          <div
            className="reward-progress-fill"
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <div className="reward-progress-text">
          <span>{Number(reward.points_cost).toLocaleString()} pts</span>
          <span className="points-remaining">
            {progress.remaining === 0
              ? 'Ready to redeem'
              : `${progress.remaining.toLocaleString()} to go`}
          </span>
        </div>
      </>
    );
  };

  const RewardActions = ({ reward }) => {
    const progress = getRewardProgress(reward);
    const canRedeem = progress.remaining === 0;

    return (
      <div className="action-row">
        {user?.role === 'community_member' &&
          reward.availability_status === 'available' && (
            <button
              className="primary-btn small-btn"
              disabled={!canRedeem}
              onClick={() => handleRedeem(reward.reward_id)}
              style={{
                opacity: canRedeem ? 1 : 0.5,
                cursor: canRedeem ? 'pointer' : 'not-allowed'
              }}
            >
              Redeem
            </button>
          )}

        {(user?.role === 'admin' || user?.role === 'partner') &&
          reward.availability_status !== 'inactive' && (
            <button
              className="primary-btn small-btn"
              onClick={() => startEdit(reward)}
            >
              Edit
            </button>
          )}

        {user?.role === 'admin' && reward.availability_status !== 'inactive' && (
          <button
            className="danger-btn small-btn"
            onClick={() => handleDelete(reward.reward_id)}
          >
            Deactivate
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="page-shell">
      {showToast && (
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
              <h4>{messageType === 'success' ? 'Success' : 'Error'}</h4>
              <p>{message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="page-header-card rewards-admin-header">
        <div>
          <h1>Rewards</h1>
          <p>Browse approved rewards and manage the catalog.</p>
        </div>

        {(user?.role === 'admin' || user?.role === 'partner') && (
          <button
            type="button"
            className="add-reward-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <span>＋</span>
            Add New Reward
          </button>
        )}
      </div>

      <div className="reward-tabs">
        <button
          className={rewardTab === 'active' ? 'reward-tab active' : 'reward-tab'}
          onClick={() => setRewardTab('active')}
        >
          Active Rewards ({activeRewards.length})
        </button>

        {user?.role === 'admin' && (
          <button
            className={rewardTab === 'inactive' ? 'reward-tab active' : 'reward-tab'}
            onClick={() => setRewardTab('inactive')}
          >
            Inactive Rewards ({inactiveRewards.length})
          </button>
        )}
      </div>

      <div className="reward-toolbar">
        <input
          type="text"
          placeholder="Search rewards..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">All Categories</option>

          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {featuredReward && (
        <div className="reward-showcase">
          <div className="reward-featured-card page-card">
            <div className="reward-banner">
              {featuredReward.image_url ? (
                <img src={featuredReward.image_url} alt={featuredReward.reward_name} />
              ) : (
                <div className="reward-gift-icon">🎁</div>
              )}
            </div>

            <div className="reward-featured-info">
              <span className={`badge badge-${featuredReward.availability_status}`}>
                {featuredReward.availability_status}
              </span>

              <h2>{featuredReward.reward_name}</h2>
              <p>{featuredReward.description || 'No description provided.'}</p>

              <div className="reward-points-big">
                {Number(featuredReward.points_cost).toLocaleString()} pts
              </div>

              <ProgressBlock reward={featuredReward} />
              <RewardActions reward={featuredReward} />
            </div>
          </div>

          <div className="reward-small-grid">
            {otherRewards.map((reward) => (
              <div
                key={reward.reward_id}
                id={`reward-${reward.reward_id}`}
                className="reward-small-card page-card"
              >
                <div className="reward-card-image">
                  {reward.image_url ? (
                    <img src={reward.image_url} alt={reward.reward_name} />
                  ) : (
                    <span>🎁</span>
                  )}
                </div>

                <div className="reward-card-body">
                  <div className="card-top-row">
                    <h3>{reward.reward_name}</h3>
                    <span className={`badge badge-${reward.availability_status}`}>
                      {reward.availability_status}
                    </span>
                  </div>

                  <p className="reward-description">
                    {reward.description || 'No description provided.'}
                  </p>

                  <div className="reward-meta-row">
                    <span>{reward.category || 'N/A'}</span>
                    <strong>{Number(reward.points_cost).toLocaleString()} pts</strong>
                  </div>

                  <div className="reward-meta-row">
                    <span>Stock</span>
                    <strong>{reward.stock}</strong>
                  </div>

                  <ProgressBlock reward={reward} />
                  <RewardActions reward={reward} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="participation-modal-backdrop">
          <div className="create-reward-modal">
            <button
              className="modal-close-btn"
              onClick={() => {
                setShowCreateModal(false);
                resetCreateForm();
              }}
            >
              ×
            </button>

            <div className="create-reward-modal-header">
              <h2>Create Reward</h2>
              <p>Submit a reward to the system.</p>
            </div>

            <form onSubmit={handleCreateReward} className="create-reward-modal-form">
              <input
                type="text"
                name="reward_name"
                placeholder="Reward Name"
                value={createForm.reward_name}
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
                type="number"
                name="points_cost"
                placeholder="Points Cost"
                value={createForm.points_cost}
                onChange={handleCreateChange}
                required
              />

              <input
                type="number"
                name="stock"
                placeholder="Stock"
                value={createForm.stock}
                onChange={handleCreateChange}
                required
              />

              {user?.role === 'admin' && (
                <select
                  name="partner_id"
                  value={createForm.partner_id}
                  onChange={handleCreateChange}
                >
                  <option value="">No Partner</option>

                  {partners.map((partner) => (
                    <option key={partner.partner_id} value={partner.partner_id}>
                      {partner.organization_name}
                    </option>
                  ))}
                </select>
              )}

              <button type="submit" className="create-reward-submit-btn">
                Create Reward
              </button>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingId && (
        <div className="participation-modal-backdrop">
          <div className="participation-modal admin-edit-modal">
            <button className="modal-close-btn" onClick={cancelEdit}>
              ×
            </button>

            <section className="side-card modal-side-card">
              <h2>Edit Reward</h2>
              <p>Update reward details and status.</p>

              <div className="admin-edit-form">
                <input
                  name="reward_name"
                  value={editForm.reward_name}
                  onChange={handleEditChange}
                  placeholder="Reward Name"
                />

                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  placeholder="Description"
                />

                <input
                  name="category"
                  value={editForm.category}
                  onChange={handleEditChange}
                  placeholder="Category"
                />

                <input
                  name="image_url"
                  value={editForm.image_url}
                  onChange={handleEditChange}
                  placeholder="Image URL"
                />

                <input
                  name="points_cost"
                  value={editForm.points_cost}
                  onChange={handleEditChange}
                  placeholder="Points Cost"
                />

                <input
                  name="stock"
                  value={editForm.stock}
                  onChange={handleEditChange}
                  placeholder="Stock"
                />

                <select
                  name="availability_status"
                  value={editForm.availability_status}
                  onChange={handleEditChange}
                >
                  <option value="pending">pending</option>
                  <option value="available">available</option>
                  <option value="out_of_stock">out_of_stock</option>
                  <option value="inactive">inactive</option>
                </select>

                <button onClick={() => handleUpdate(editingId)}>
                  Save Changes
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default RewardsPage;