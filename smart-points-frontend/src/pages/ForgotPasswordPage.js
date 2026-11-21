
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  
const handleRequestOTP = async (e) => {
  e?.preventDefault();

  setError('');
  setMessage('');

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
    setError('Enter a valid email address.');
    return;
  }

  setLoading(true);

  try {

      await api.post('/auth/forgot-password', {
        email: email.trim().toLowerCase()
      });

      setStep(2);
      setMessage(
        'If your email is registered, a reset code has been sent.'
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to send reset code.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await api.post(
        '/auth/verify-reset-otp',
        {
          email: email.trim().toLowerCase(),
          otp
        }
      );

      if (!response.data.resetToken) {
        throw new Error('Reset authorization was not returned.');
      }

      setResetToken(response.data.resetToken);
      setStep(3);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Invalid or expired verification code.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 12) {
      setError('Password must contain at least 12 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        resetToken,
        newPassword
      });

      setStep(4);
      setResetToken('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to reset password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="citipoints-auth-page citipoints-login-page">
      <section
        className="citipoints-auth-hero login-hero"
        style={{ backgroundImage: "url('/Mandaue.jpeg')" }}
      >
        <div className="citipoints-auth-shade" />

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
              Secure your account and continue making
              a difference in Mandaue City.
            </p>
          </div>
        </div>
      </section>

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

          {step !== 4 && (
            <div className="citipoints-form-heading">
              <h2>
                {step === 1
                  ? 'Forgot Password?'
                  : step === 2
                  ? 'Verify Reset Code'
                  : 'Create New Password'}
              </h2>
              <p>
                {step === 1
                  ? 'Enter your registered email address.'
                  : step === 2
                  ? 'Enter the 6-digit code sent to your email.'
                  : 'Choose a secure new password.'}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="forgot-password-error">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="forgot-password-message">
              {message}
            </p>
          )}

          {step === 1 && (
            <form
  onSubmit={handleRequestOTP}
  className="citipoints-form"
  noValidate
>
              <div className="citipoints-field">
                <label htmlFor="forgot-email">
                  Email Address
                </label>

                <div className="citipoints-input-wrap">
                  <span className="field-icon">✉</span>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="citipoints-submit-btn"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'SEND RESET CODE'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={handleVerifyOTP}
              className="citipoints-form"
            >
              <div className="citipoints-field">
                <label htmlFor="forgot-otp">
                  Verification Code
                </label>

                <div className="citipoints-input-wrap">
                  <span className="field-icon">🔒</span>
                  <input
                    id="forgot-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(
                        e.target.value.replace(/\D/g, '').slice(0, 6)
                      )
                    }
                    placeholder="Enter 6-digit OTP"
                    required
                  />
                </div>
              </div>

              <p className="forgot-password-hint">
                Code expires after 5 minutes.
              </p>

              <button
                type="submit"
                className="citipoints-submit-btn"
                disabled={loading || otp.length !== 6}
              >
                {loading ? 'Verifying...' : 'VERIFY CODE'}
              </button>

              <button
                type="button"
                className="forgot-password-text-btn"
                onClick={handleRequestOTP}
                disabled={loading}
              >
                Resend Code
              </button>
            </form>
          )}

          {step === 3 && (
            <form
              onSubmit={handleResetPassword}
              className="citipoints-form"
            >
              <div className="citipoints-field">
                <label htmlFor="forgot-new-password">
                  New Password
                </label>
                <div className="citipoints-input-wrap">
                  <span className="field-icon">🔒</span>
                  <input
                    id="forgot-new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) =>
                      setNewPassword(e.target.value)
                    }
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className="citipoints-field">
                <label htmlFor="forgot-confirm-password">
                  Confirm New Password
                </label>
                <div className="citipoints-input-wrap">
                  <span className="field-icon">🔒</span>
                  <input
                    id="forgot-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <label className="forgot-password-show">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) =>
                    setShowPassword(e.target.checked)
                  }
                />
                Show passwords
              </label>

              <p className="forgot-password-hint">
                Use at least 12 characters.
              </p>

              <button
                type="submit"
                className="citipoints-submit-btn"
                disabled={loading}
              >
                {loading ? 'Resetting...' : 'RESET PASSWORD'}
              </button>
            </form>
          )}

          {step === 4 && (
            <div className="forgot-password-success">
              <div className="forgot-password-success-icon">
                ✓
              </div>
              <h2>Password Reset Successful!</h2>
              <p>
                Your password has been updated.
                You can now sign in using your new password.
              </p>
              <button
                type="button"
                className="citipoints-submit-btn"
                onClick={() => navigate('/login')}
              >
                BACK TO LOGIN
              </button>
            </div>
          )}

          {step !== 4 && (
            <p className="citipoints-switch-auth">
              <Link to="/login">← Back to Login</Link>
            </p>
          )}
        </div>

        <div className="citipoints-location">
          <strong>Mandaue City</strong>
          <span>Cebu, Philippines</span>
        </div>
      </section>
    </div>
  );
}

export default ForgotPasswordPage;
