
import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export default function EmailVerification({
  email,
  onClose,
  onVerified,
   initialEmailSent = false,
  autoSend = false
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(
    initialEmailSent
      ? 'A 6-digit code was sent to your email.'
      : 'Request a verification code to continue.'
  );
  const [error, setError] = useState('');

  // Automatically request an OTP only when explicitly enabled.
  // Registration keeps its existing OTP behavior.
  const autoSendStarted = useRef(false);

  useEffect(() => {
    if (!autoSend || initialEmailSent || autoSendStarted.current) {
      return;
    }

    autoSendStarted.current = true;

    let cancelled = false;

    const requestOTP = async () => {
      setResending(true);
      setError('');
      setMessage('Requesting your verification code...');

      try {
        const response = await api.post('/auth/resend-otp', {
          email: email.trim().toLowerCase()
        });

        if (!cancelled) {
          setMessage(
            response.data.message ||
            'If verification is required, a code will be sent.'
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
            'Unable to send a code. Please try again.'
          );
          setMessage('You can request a code using the button below.');
        }
      } finally {
        if (!cancelled) {
          setResending(false);
        }
      }
    };

    requestOTP();

    return () => {
      cancelled = true;
    };
  }, [autoSend, initialEmailSent, email]);


  const verify = async (e) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      setError('Enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/verify-email', {
        email: email.trim().toLowerCase(),
        otp: code
      });

      if (response.data.success) {
        onVerified();
      } else {
        setError('Unable to verify your email.');
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Verification failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resending) return;

    setResending(true);
    setError('');

    try {
      const response = await api.post('/auth/resend-otp', {
        email: email.trim().toLowerCase()
      });

      setMessage(
        response.data.message ||
        'If verification is required, a code will be sent.'
      );
      setCode('');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to send a code. Please try again.'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Email Verification"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(12, 30, 55, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          padding: 30,
          width: '100%',
          maxWidth: 430,
          textAlign: 'center',
          color: '#17345c',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ fontSize: 38 }}>✉️</div>

        <h2>Verify Your Email</h2>

        <p>
          Verification for <strong>{email}</strong>
        </p>

        <p aria-live="polite">{message}</p>

        <form onSubmit={verify}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, ''))
            }
            style={{
              width: '100%',
              padding: 14,
              fontSize: 23,
              textAlign: 'center',
              letterSpacing: 6,
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              boxSizing: 'border-box'
            }}
          />

          {error && (
            <p role="alert" style={{ color: '#b42318' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="citipoints-submit-btn"
            disabled={loading || code.length !== 6}
            style={{ marginTop: 18, width: '100%' }}
          >
            {loading ? 'Verifying...' : 'VERIFY EMAIL'}
          </button>
        </form>

        <button
          type="button"
          onClick={resend}
          disabled={resending || loading}
          style={{
            marginTop: 18,
            background: 'none',
            border: 'none',
            color: '#2563eb',
            cursor: 'pointer'
          }}
        >
          {resending ? 'Sending...' : 'Send / Resend Code'}
        </button>

        <p style={{ fontSize: 12 }}>
          Codes expire after 5 minutes. Resending is limited
          to once every 60 seconds.
        </p>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer'
          }}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
