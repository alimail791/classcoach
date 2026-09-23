// Sends email via Resend's HTTPS API, not SMTP. This matters specifically
// for Railway: their Free/Trial/Hobby plans block all outbound SMTP ports
// (25, 465, 587) at the network/firewall level — confirmed directly by
// Railway's own support team, and unrelated to any app configuration. An
// HTTPS request on port 443 isn't affected by that block, which is why
// this works from Railway (or anywhere else) while raw SMTP silently
// doesn't. Same approach recommended in Railway's own docs.
//
// Reads the API key from RESEND_API_KEY if set, falling back to SMTP_PASS
// so an existing .env that already has the Resend key stored there (from
// when this app used SMTP) keeps working without needing a new variable.

function apiKey() {
  return process.env.RESEND_API_KEY || process.env.SMTP_PASS || '';
}

function isConfigured() {
  return Boolean(apiKey());
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
}

function fromAddress() {
  return process.env.SMTP_FROM || process.env.RESEND_FROM || 'ClassCoach <onboarding@resend.dev>';
}

async function sendViaResend({ to, subject, text }) {
  if (!isConfigured()) {
    throw new Error('Email is not configured yet. Add RESEND_API_KEY (or SMTP_PASS, either works) to .env to enable sending.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      text
    })
  });

  if (!res.ok) {
    let message = `Resend API request failed (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body && body.message) message = body.message;
    } catch (e) {
      // Response wasn't JSON — keep the generic message above.
    }
    throw new Error(message);
  }
}

async function sendReportEmail({ to, studentName, testTitle, score, total, reportUrl, note }) {
  const subject = `${studentName}'s result for ${testTitle}`;
  const text = [
    `${studentName} scored ${score} / ${total} on "${testTitle}".`,
    note ? `\nTeacher's note: ${note}` : '',
    `\nFull report: ${reportUrl}`
  ].join('\n');
  await sendViaResend({ to, subject, text });
}

async function sendVerificationEmail({ to, name, verifyUrl }) {
  const subject = 'Verify your ClassCoach email';
  const text = `Hi ${name},\n\nPlease verify your email address for ClassCoach:\n${verifyUrl}\n\nIf you didn't sign up for ClassCoach, you can ignore this email.`;
  await sendViaResend({ to, subject, text });
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const subject = 'Reset your ClassCoach password';
  const text = `Hi ${name},\n\nSomeone (hopefully you) asked to reset your ClassCoach password. Click the link below to set a new one — it expires in 1 hour:\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email and your password will stay the same.`;
  await sendViaResend({ to, subject, text });
}

async function sendPlainEmail({ to, subject, text }) {
  await sendViaResend({ to, subject, text });
}

module.exports = { isConfigured, looksLikeEmail, sendReportEmail, sendVerificationEmail, sendPasswordResetEmail, sendPlainEmail };
