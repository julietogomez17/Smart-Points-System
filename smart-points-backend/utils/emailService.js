
const nodemailer = require("nodemailer");

const RESEND_API_URL = "https://api.resend.com/emails";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const EMAIL_PROVIDER = (
  process.env.EMAIL_PROVIDER || "resend"
).toLowerCase();

// =====================================================
// RESEND EMAIL
// =====================================================

const sendWithResend = async (to, subject, message) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "CitiPoints <onboarding@resend.dev>";

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
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
        result.message || "Unknown error"
      }`
    );
  }

  return result;
};

// =====================================================
// GMAIL SMTP
// =====================================================

const sendWithSMTP = async (to, subject, message) => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER or SMTP_PASS is missing.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });

  return transporter.sendMail({
    from: `"CitiPoints" <${user}>`,
    to,
    subject,
    text: message
  });
};

// =====================================================
// BREVO HTTPS API
// =====================================================

const sendWithBrevo = async (to, subject, message) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName =
    process.env.BREVO_SENDER_NAME || "CitiPoints";

  if (!apiKey || !senderEmail) {
    throw new Error(
      "BREVO_API_KEY or BREVO_SENDER_EMAIL is missing."
    );
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [{ email: to }],
      subject,
      textContent: message
    }),
    signal: AbortSignal.timeout(15000)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `Brevo email error (${response.status}): ${
        result.message || "Unknown error"
      }`
    );
  }

  return result;
};

// =====================================================
// EMAIL PROVIDER SELECTION
// =====================================================

const sendEmail = async (to, subject, message) => {
  if (EMAIL_PROVIDER === "smtp") {
    return sendWithSMTP(to, subject, message);
  }

  if (EMAIL_PROVIDER === "resend") {
    return sendWithResend(to, subject, message);
  }

  if (EMAIL_PROVIDER === "brevo") {
    return sendWithBrevo(to, subject, message);
  }

  throw new Error(
    `Unsupported EMAIL_PROVIDER: ${EMAIL_PROVIDER}`
  );
};

// =====================================================
// SEND EMAIL VERIFICATION OTP
// =====================================================

const sendVerificationEmail = async (email, otp) => {
  if (!/^\d{6}$/.test(String(otp))) {
    throw new Error("Invalid OTP format.");
  }

  return sendEmail(
    email,
    "CitiPoints - Verify Your Email",
    [
      "Welcome to CitiPoints!",
      "",
      `Your verification code is: ${otp}`,
      "",
      "This code will expire in 5 minutes.",
      "Do not share this code with anyone.",
      "",
      "If you did not register for CitiPoints,",
      "you can ignore this email."
    ].join("\n")
  );
};

// =====================================================
// SEND PASSWORD RESET OTP
// =====================================================

const sendPasswordResetEmail = async (email, otp) => {
  if (!/^\d{6}$/.test(String(otp))) {
    throw new Error("Invalid password reset OTP format.");
  }

  return sendEmail(
    email,
    "CitiPoints - Password Reset Code",
    [
      "CitiPoints Password Recovery",
      "",
      "We received a request to reset your CitiPoints password.",
      "",
      `Your password reset code is: ${otp}`,
      "",
      "This code will expire in 5 minutes.",
      "Do not share this code with anyone.",
      "",
      "If you did not request a password reset,",
      "you can safely ignore this email.",
      "",
      "CitiPoints - Mandaue City"
    ].join("\n")
  );
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
