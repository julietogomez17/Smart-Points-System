import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'community_member',
    partner_name: ''
  });

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);

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

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedRole = form.role.toLowerCase();

    if (normalizedRole === 'partner' && !form.partner_name.trim()) {
      showMessage('Organization name is required for partners', 'error');
      return;
    }

    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: normalizedRole,
        partner_name: normalizedRole === 'partner' ? form.partner_name.trim() : null
      };

      const res = await api.post('/auth/register', payload);

      showMessage(res.data.message || 'Registration successful', 'success');

      setTimeout(() => {
        navigate('/');
      }, 1200);
    } catch (error) {
      showMessage(error.response?.data?.message || 'Registration failed', 'error');
    }
  };

  return (
    <div className="auth-page">
      {showToast && (
        <div className="floating-toast-wrap">
          <div className={`floating-toast ${messageType === 'success' ? 'floating-toast-success' : 'floating-toast-error'}`}>
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

      <div className="auth-overlay">
        <div className="auth-box">
          <div className="auth-brand">
            <p className="auth-subtitle">Smart Points Engine</p>
            <h1>Create Account</h1>
            <p className="auth-text">
              Join the platform as a member, partner, or admin-authorized user.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <input
              type="text"
              name="full_name"
              placeholder="Full name"
              value={form.full_name}
              onChange={handleChange}
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
            />

            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              required
            >
              <option value="community_member">Community Member</option>
              <option value="partner">Partner</option>
              <option value="admin">Admin</option>
            </select>

            {form.role === 'partner' && (
              <input
                type="text"
                name="partner_name"
                placeholder="Organization Name"
                value={form.partner_name}
                onChange={handleChange}
                required
              />
            )}

            <button type="submit" className="primary-btn auth-btn">
              Register
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;