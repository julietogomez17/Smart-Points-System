
const RESEND_API_URL = 'https://api.resend.com/emails';

const EMAIL_FROM =
  process.env.RESEND_FROM_EMAIL || 'CitiPoints <onboarding@resend.dev>';

const sendEmail = async (to, subject, message) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing.');
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject,
      text: message
    }),
    signal: AbortSignal.timeout(15000)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `Resend email error (${response.status}): ${
        result.message || 'Unknown error'
      }`
    );
  }

  return result;
};

// =====================================================
// SEND EMAIL VERIFICATION OTP
// =====================================================

const sendVerificationEmail = async (email, otp) => {
  if (!/^\d{6}$/.test(String(otp))) {
    throw new Error('Invalid OTP format.');
  }

  return sendEmail(
    email,
    'CitiPoints - Verify Your Email',
    [
      'Welcome to CitiPoints!',
      '',
      `Your verification code is: ${otp}`,
      '',
      'This code will expire in 5 minutes.',
      'Do not share this code with anyone.',
      '',
      'If you did not register for CitiPoints,',
      'you can ignore this email.'
    ].join('\n')
  );
};

// =====================================================
// SEND PASSWORD RESET OTP
// =====================================================

const sendPasswordResetEmail = async (email, otp) => {
  if (!/^\d{6}$/.test(String(otp))) {
    throw new Error('Invalid password reset OTP format.');
  }

  return sendEmail(
    email,
    'CitiPoints - Password Reset Code',
    [
      'CitiPoints Password Recovery',
      '',
      'We received a request to reset your CitiPoints password.',
      '',
      `Your password reset code is: ${otp}`,
      '',
      'This code will expire in 5 minutes.',
      'Do not share this code with anyone.',
      '',
      'If you did not request a password reset,',
      'you can safely ignore this email.',
      '',
      'CitiPoints - Mandaue City'
    ].join('\n')
  );
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
