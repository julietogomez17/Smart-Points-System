
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendVerificationEmail = async (email, otp) => {
  if (!/^\d{6}$/.test(String(otp))) {
    throw new Error('Invalid OTP format.');
  }

  await transporter.sendMail({
    from: {
      name: 'CitiPoints',
      address: process.env.SMTP_USER
    },
    to: email,
    subject: 'CitiPoints - Verify Your Email',
    text: [
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
  });
};



/* =====================================================
   SEND PASSWORD RESET EMAIL
   ===================================================== */

const sendPasswordResetEmail = async (email, otp) => {
  if (!/^\d{6}$/.test(String(otp))) {
    throw new Error('Invalid password reset OTP format.');
  }

  await transporter.sendMail({
    from: {
      name: 'CitiPoints',
      address: process.env.SMTP_USER
    },

    to: email,

    subject: 'CitiPoints - Password Reset Code',

    text: [
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
  });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
