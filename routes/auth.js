const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { PLANS, trialExpiryFromNow, trackEnabled } = require('../lib/plans');
const mailer = require('../lib/mailer');

const router = express.Router();

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

router.get('/signup', (req, res) => {
  res.render('signup', { error: null, refCode: req.query.ref || '', track: req.query.track === 'neet_jee' ? 'neet_jee' : 'general' });
});

router.post('/signup', (req, res) => {
  const { name, email, phone, password, ref } = req.body;
  const examTrack = trackEnabled() && req.body.exam_track === 'neet_jee' ? 'neet_jee' : 'general';
  if (!name || !email || !phone || !password) {
    return res.render('signup', { error: 'All fields are required, including phone number.', refCode: ref || '', track: examTrack });
  }
  const existing = db.prepare('SELECT id FROM teachers WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.render('signup', { error: 'An account with that email already exists.', refCode: ref || '', track: examTrack });
  }
  const hash = bcrypt.hashSync(password, 10);
  const trial = PLANS.trial;
  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  let referredByTeacherId = null;
  if (ref && ref.trim()) {
    const referrer = db.prepare('SELECT id FROM teachers WHERE referral_code = ?').get(ref.trim());
    if (referrer) referredByTeacherId = referrer.id;
  }

  // A referral code needs to be unique and stable — base it on the name,
  // retrying with a fresh random suffix on the rare collision.
  let referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'teacher';
    const candidate = `${base}${crypto.randomInt(1000, 9999)}`;
    if (!db.prepare('SELECT id FROM teachers WHERE referral_code = ?').get(candidate)) {
      referralCode = candidate;
      break;
    }
  }

  const info = db
    .prepare(
      `INSERT INTO teachers
       (name, email, phone, password_hash, plan, max_students, ai_limit_monthly, plan_expires_at, referral_code, referred_by_teacher_id, signup_verified, email_otp, email_otp_expires, exam_track)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .run(
      name.trim(),
      email.toLowerCase().trim(),
      phone.trim(),
      hash,
      trial.id,
      trial.max_students,
      trial.ai_limit_monthly,
      trialExpiryFromNow(),
      referralCode,
      referredByTeacherId,
      otp,
      otpExpires,
      examTrack
    );
  req.session.teacherId = info.lastInsertRowid;

  if (mailer.isConfigured()) {
    mailer.sendOtpEmail({ to: email.toLowerCase().trim(), name: name.trim(), otp }).catch((err) => {
      console.error('OTP email failed to send:', err.message);
    });

    if (process.env.ADMIN_NOTIFY_EMAIL) {
      const notifyText = [
        'A new teacher just registered on ClassCoach:',
        '',
        `Name: ${name.trim()}`,
        `Email: ${email.toLowerCase().trim()}`,
        `Phone: ${phone.trim()}`,
        `Plan: ${trial.name} (free trial)`,
        `Signed up: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
      ].join('\n');
      mailer
        .sendPlainEmail({ to: process.env.ADMIN_NOTIFY_EMAIL, subject: `New ClassCoach signup: ${name.trim()}`, text: notifyText })
        .catch((err) => console.error('Admin signup notification failed to send:', err.message));
    }
  } else {
    console.log(`[Signup OTP] Email not configured. Code for ${email.toLowerCase().trim()}: ${otp}`);
  }

  res.redirect('/verify-otp');
});

router.get('/verify-otp', (req, res) => {
  if (!req.session.teacherId) return res.redirect('/login');
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.session.teacherId);
  if (!teacher) return res.redirect('/login');
  if (teacher.signup_verified && teacher.email_verified) return res.redirect('/dashboard');
  res.render('verify_otp', { email: teacher.email, error: null, resent: req.query.resent || null });
});

router.post('/verify-otp', (req, res) => {
  if (!req.session.teacherId) return res.redirect('/login');
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.session.teacherId);
  if (!teacher) return res.redirect('/login');

  const code = (req.body.code || '').trim();
  const valid =
    teacher.email_otp &&
    code === teacher.email_otp &&
    teacher.email_otp_expires &&
    new Date(teacher.email_otp_expires) > new Date();

  if (!valid) {
    return res.render('verify_otp', { email: teacher.email, error: 'That code is incorrect or has expired. Request a new one below.', resent: null });
  }

  db.prepare('UPDATE teachers SET signup_verified = 1, email_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?').run(teacher.id);
  res.redirect('/dashboard');
});

router.post('/verify-otp/resend', (req, res) => {
  if (!req.session.teacherId) return res.redirect('/login');
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.session.teacherId);
  if (!teacher) return res.redirect('/login');

  // A fresh 10-minute code always resets the expiry, so this also doubles
  // as the cooldown check: if the last one was sent under 30 seconds ago,
  // more than 9.5 minutes will still be left on it.
  const msRemaining = teacher.email_otp_expires ? new Date(teacher.email_otp_expires) - new Date() : 0;
  if (msRemaining > 9.5 * 60 * 1000) {
    return res.render('verify_otp', { email: teacher.email, error: 'Please wait a few seconds before requesting another code.', resent: null });
  }

  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('UPDATE teachers SET email_otp = ?, email_otp_expires = ? WHERE id = ?').run(otp, otpExpires, teacher.id);

  if (mailer.isConfigured()) {
    mailer.sendOtpEmail({ to: teacher.email, name: teacher.name, otp }).catch((err) => {
      console.error('OTP resend failed to send:', err.message);
    });
  } else {
    console.log(`[Signup OTP] Email not configured. Code for ${teacher.email}: ${otp}`);
  }

  res.redirect('/verify-otp?resent=1');
});

router.get('/forgot-password', (req, res) => {
  res.render('forgot_password', { error: null, sent: false });
});

router.post('/forgot-password', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const teacher = db.prepare('SELECT * FROM teachers WHERE email = ?').get(email);

  // Always show the same "sent" message whether or not the account exists —
  // otherwise this form could be used to check which emails have accounts.
  if (!teacher) {
    return res.render('forgot_password', { error: null, sent: true });
  }

  const token = crypto.randomBytes(20).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  db.prepare('UPDATE teachers SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?').run(
    token,
    expires,
    teacher.id
  );

  if (mailer.isConfigured()) {
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    try {
      await mailer.sendPasswordResetEmail({ to: teacher.email, name: teacher.name, resetUrl });
    } catch (err) {
      console.error('Password reset email failed to send:', err.message);
    }
  } else {
    console.log(`[Password reset] Email not configured. Reset link for ${teacher.email}: /reset-password/${token}`);
  }

  res.render('forgot_password', { error: null, sent: true });
});

router.get('/reset-password/:token', (req, res) => {
  const teacher = db.prepare('SELECT * FROM teachers WHERE password_reset_token = ?').get(req.params.token);
  if (!teacher || !teacher.password_reset_expires || new Date(teacher.password_reset_expires) < new Date()) {
    return res.render('reset_password', { error: 'This reset link is invalid or has expired. Request a new one.', token: null });
  }
  res.render('reset_password', { error: null, token: req.params.token });
});

router.post('/reset-password/:token', (req, res) => {
  const teacher = db.prepare('SELECT * FROM teachers WHERE password_reset_token = ?').get(req.params.token);
  if (!teacher || !teacher.password_reset_expires || new Date(teacher.password_reset_expires) < new Date()) {
    return res.render('reset_password', { error: 'This reset link is invalid or has expired. Request a new one.', token: null });
  }
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.render('reset_password', { error: 'Password must be at least 6 characters.', token: req.params.token });
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE teachers SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?').run(
    hash,
    teacher.id
  );
  res.render('login', { error: null, justReset: true });
});

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const teacher = db.prepare('SELECT * FROM teachers WHERE email = ?').get((email || '').toLowerCase().trim());
  if (!teacher || !bcrypt.compareSync(password || '', teacher.password_hash)) {
    return res.render('login', { error: 'Incorrect email or password.' });
  }
  if (!teacher.active) {
    return res.render('login', { error: 'This account has been deactivated. Contact support if you believe this is a mistake.' });
  }
  req.session.teacherId = teacher.id;
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.teacherId = null;
  res.redirect('/login');
});

// Old link-based verification is kept only as a harmless fallback for any
// email already sent before the switch to OTP — new sends always use a code.
router.get('/verify-email/:token', (req, res) => {
  const teacher = db.prepare('SELECT * FROM teachers WHERE email_verify_token = ?').get(req.params.token);
  if (!teacher) return res.status(404).send('This verification link is not valid — it may have already been used.');
  db.prepare('UPDATE teachers SET email_verified = 1, email_verify_token = NULL WHERE id = ?').run(teacher.id);
  if (req.session.teacherId === teacher.id) return res.redirect('/dashboard?verified=1');
  res.send('<p>Email verified! You can close this tab and log in.</p><a href="/login">Go to login</a>');
});

router.post('/settings/resend-verification', requireTeacher, async (req, res) => {
  if (req.teacher.email_verified) return res.redirect('/settings');

  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('UPDATE teachers SET email_otp = ?, email_otp_expires = ? WHERE id = ?').run(otp, otpExpires, req.teacher.id);

  try {
    await mailer.sendOtpEmail({ to: req.teacher.email, name: req.teacher.name, otp });
  } catch (err) {
    return res.redirect(`/settings?verification_error=${encodeURIComponent(err.message)}`);
  }
  res.redirect('/verify-otp?resent=1');
});

router.get('/settings', requireTeacher, (req, res) => {
  // Refer & earn moved to the dashboard — see routes/dashboard.js.
  res.render('settings', {
    teacher: req.teacher,
    error: null,
    saved: req.query.saved || null,
    verificationSent: req.query.verification_sent || null,
    verificationError: req.query.verification_error || null
  });
});

router.post('/settings', requireTeacher, (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) {
    return res.render('settings', { teacher: req.teacher, error: 'Name and email are required.', saved: null, verificationSent: null, verificationError: null });
  }
  const existing = db.prepare('SELECT id FROM teachers WHERE email = ? AND id != ?').get(email.toLowerCase().trim(), req.teacher.id);
  if (existing) {
    return res.render('settings', { teacher: req.teacher, error: 'Another account already uses that email.', saved: null, verificationSent: null, verificationError: null });
  }

  const emailChanged = email.toLowerCase().trim() !== req.teacher.email;
  if (emailChanged) {
    // A changed email needs to be re-verified — clear the old status and
    // send a fresh OTP automatically if email sending is configured. This
    // only resets email_verified, never signup_verified, so it can never
    // re-trigger the hard signup gate in requireTeacher.
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.prepare(
      'UPDATE teachers SET name = ?, email = ?, phone = ?, email_verified = 0, email_otp = ?, email_otp_expires = ? WHERE id = ?'
    ).run(name.trim(), email.toLowerCase().trim(), (phone || '').trim(), otp, otpExpires, req.teacher.id);
    if (mailer.isConfigured()) {
      mailer.sendOtpEmail({ to: email.toLowerCase().trim(), name: name.trim(), otp }).catch(() => {});
    } else {
      console.log(`[Settings OTP] Email not configured. Code for ${email.toLowerCase().trim()}: ${otp}`);
    }
  } else {
    db.prepare('UPDATE teachers SET name = ?, email = ?, phone = ? WHERE id = ?').run(
      name.trim(),
      email.toLowerCase().trim(),
      (phone || '').trim(),
      req.teacher.id
    );
  }
  res.redirect('/settings?saved=profile');
});

router.post('/settings/password', requireTeacher, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!bcrypt.compareSync(current_password || '', req.teacher.password_hash)) {
    return res.render('settings', { teacher: req.teacher, error: 'Current password is incorrect.', saved: null, verificationSent: null, verificationError: null });
  }
  if (!new_password || new_password.length < 6) {
    return res.render('settings', { teacher: req.teacher, error: 'New password must be at least 6 characters.', saved: null, verificationSent: null, verificationError: null });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?').run(hash, req.teacher.id);
  res.redirect('/settings?saved=password');
});

module.exports = router;
