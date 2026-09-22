const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: (process.env.SMTP_PORT || '587') === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

async function sendReportEmail({ to, studentName, testTitle, score, total, reportUrl, note }) {
  if (!isConfigured()) {
    throw new Error('Email is not configured yet. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to .env to enable sending.');
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = `${studentName}'s result for ${testTitle}`;
  const text = [
    `${studentName} scored ${score} / ${total} on "${testTitle}".`,
    note ? `\nTeacher's note: ${note}` : '',
    `\nFull report: ${reportUrl}`
  ].join('\n');

  await getTransporter().sendMail({ from, to, subject, text });
}

async function sendVerificationEmail({ to, name, verifyUrl }) {
  if (!isConfigured()) {
    throw new Error('Email is not configured — add SMTP_HOST, SMTP_USER, and SMTP_PASS to .env.');
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = 'Verify your ClassCoach email';
  const text = `Hi ${name},\n\nPlease verify your email address for ClassCoach:\n${verifyUrl}\n\nIf you didn't sign up for ClassCoach, you can ignore this email.`;
  await getTransporter().sendMail({ from, to, subject, text });
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!isConfigured()) {
    throw new Error('Email is not configured — add SMTP_HOST, SMTP_USER, and SMTP_PASS to .env.');
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = 'Reset your ClassCoach password';
  const text = `Hi ${name},\n\nSomeone (hopefully you) asked to reset your ClassCoach password. Click the link below to set a new one — it expires in 1 hour:\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email and your password will stay the same.`;
  await getTransporter().sendMail({ from, to, subject, text });
}

async function sendPlainEmail({ to, subject, text }) {
  if (!isConfigured()) {
    throw new Error('Email is not configured — add SMTP_HOST, SMTP_USER, and SMTP_PASS to .env.');
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({ from, to, subject, text });
}

module.exports = { isConfigured, looksLikeEmail, sendReportEmail, sendVerificationEmail, sendPasswordResetEmail, sendPlainEmail };
