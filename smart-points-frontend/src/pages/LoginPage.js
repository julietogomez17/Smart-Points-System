import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function LoginPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    password: ''
  });

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const loginUser = async () => {
    if (isLoading) return;

    if (!form.email.trim() || !form.password.trim()) {
      showMessage('Email and password are required', 'error');
      return;
    }

    try {
      setIsLoading(true);

      const res = await api.post('/auth/login', form);
      const user = res.data.user;

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(user));

      showMessage('Login successful', 'success');

      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (error) {
      showMessage(error.response?.data?.message || 'Login failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await loginUser();
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await loginUser();
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
            <h1>Welcome Back</h1>
            <p className="auth-text">
              Sign in to manage activities, rewards, submissions, and community engagement.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <input
              type="email"
              name="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              required
            />

            <button type="submit" className="primary-btn auth-btn" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="auth-footer">
            Don’t have an account? <Link to="/register">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;