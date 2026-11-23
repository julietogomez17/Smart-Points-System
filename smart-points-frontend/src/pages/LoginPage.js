import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import EmailVerification from '../components/EmailVerification';

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
  const [showPassword, setShowPassword] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
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
 if (user.role === 'partner') {
  if (user.partner_status === 'rejected') {
    navigate('/partner/profile', { replace: true });
  } else {
    navigate('/partner/dashboard', { replace: true });
  }
}
  
  else if (user.role === 'admin') {
    navigate('/admin/dashboard', { replace: true });
  } else if (user.role === 'lgu') {
    navigate('/admin/dashboard', { replace: true });
  } else if (user.role === 'community_member') {
    navigate('/dashboard', { replace: true });
  } else {
    navigate('/', { replace: true });
  }
}, 500);
   } catch (error) {
  if (error.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
    setVerificationEmail(form.email.trim().toLowerCase());
    return;
  }

  showMessage(
    error.response?.data?.message || 'Login failed',
    'error'
  );

    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await loginUser();
  };

  return (
   <div className="citipoints-auth-page citipoints-login-page">

   
{verificationEmail && (
  <EmailVerification
    email={verificationEmail}
    autoSend={true}
    onClose={() => setVerificationEmail('')}
    onVerified={() => {
      setVerificationEmail('');
      showMessage(
        'Email verified! Please sign in again.',
        'success'
      );
    }}
  />
)}

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
              <h4>
                {messageType === 'success' ? 'Success' : 'Error'}
              </h4>
              <p>{message}</p>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDE */}
<section
  className="citipoints-auth-hero login-hero"
  style={{
    backgroundImage: "url('/Mandaue.jpeg')"
  }}
>
  <div className="citipoints-auth-shade"></div>

  <div className="citipoints-hero-content">

    <img
      src="/CitiPoints Mandaue City Logo.png"
      alt="CitiPoints"
      className="citipoints-hero-logo"
    />

          <div className="citipoints-hero-message">
            <h1>
              Make Your Participation
              <span> Count.</span>
            </h1>

            <p>
              Join community activities, earn Smart Points,
              and make a difference in Mandaue City.
            </p>

            <div className="citipoints-benefits">
              <div>
                <span className="benefit-icon">👥</span>
                <strong>Join Activities</strong>
              </div>

              <div>
                <span className="benefit-icon">★</span>
                <strong>Earn Smart Points</strong>
              </div>

              <div>
                <span className="benefit-icon">🎁</span>
                <strong>Redeem Rewards</strong>
              </div>
            </div>

            <div className="citipoints-hero-quote">
              A Stronger Mandaue Starts with You.
            </div>
          </div>

        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="citipoints-auth-form-side">

        <div className="citipoints-top-message">
          Together for a Better Mandaue
        </div>

        <div className="citipoints-form-container">

          <img
            src="/citipoints-logo.png"
            alt="CitiPoints"
            className="citipoints-form-logo"
          />

          <div className="citipoints-form-heading">
            <h2>Welcome Back</h2>
            <p>Sign in to continue to CitiPoints</p>
          </div>

          <form onSubmit={handleSubmit} className="citipoints-form">

            <div className="citipoints-field">
              <label>Email Address</label>

              <div className="citipoints-input-wrap">
                <span className="field-icon">✉</span>

                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email address"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="citipoints-field">
              <label>Password</label>

              <div className="citipoints-input-wrap">
                <span className="field-icon">🔒</span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>

            
              </div>
            </div>

            {/* FORGOT PASSWORD */}
            <div className="citipoints-forgot-password">
              <Link to="/forgot-password">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              className="citipoints-submit-btn"

              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'SIGN IN →'}
            </button>

          </form>


          <div className="citipoints-divider">
            <span></span>
            <p>or</p>
            <span></span>
          </div>

          <p className="citipoints-switch-auth">
            Don't have an account?{' '}
            <Link to="/register">Register Now</Link>
          </p>

        </div>

        <div className="citipoints-location">
          <strong>Mandaue City</strong>
          <span>Cebu, Philippines</span>
        </div>

      </section>

    </div>
  );
}

export default LoginPage;