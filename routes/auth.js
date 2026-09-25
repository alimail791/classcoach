const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { PLANS, trialExpiryFromNow } = require('../lib/plans');
const mailer = require('../lib/mailer');

const router = express.Router();

router.get('/signup', (req, res) => {
  res.render('signup', { error: null, refCode: req.query.ref || '' });
});

router.post('/signup', (req, res) => {
  const { name, email, phone, password, ref } = req.body;
  if (!name || !email || !phone || !password) {
    return res.render('signup', { error: 'All fields are required, including phone number.', refCode: ref || '' });
  }
  const existing = db.prepare('SELECT id FROM teachers WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.render('signup', { error: 'An account with that email already exists.', refCode: ref || '' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const trial = PLANS.trial;
  const verifyToken = crypto.randomBytes(20).toString('hex');

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
       (name, email, phone, password_hash, plan, max_students, ai_limit_monthly, plan_expires_at, email_verify_token, referral_code, referred_by_teacher_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      verifyToken,
      referralCode,
      referredByTeacherId
    );
  req.session.teacherId = info.lastInsertRowid;

  if (mailer.isConfigured()) {
    const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email/${verifyToken}`;
    mailer.sendVerificationEmail({ to: email.toLowerCase().trim(), name: name.trim(), verifyUrl }).catch((err) => {
      console.error('Verification email failed to send:', err.message);
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
  }

  res.redirect('/dashboard');
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

router.get('/verify-email/:token', (req, res) => {
  const teacher = db.prepare('SELECT * FROM teachers WHERE email_verify_token = ?').get(req.params.token);
  if (!teacher) return res.status(404).send('This verification link is not valid — it may have already been used.');
  db.prepare('UPDATE teachers SET email_verified = 1, email_verify_token = NULL WHERE id = ?').run(teacher.id);
  if (req.session.teacherId === teacher.id) return res.redirect('/dashboard?verified=1');
  res.send('<p>Email verified! You can close this tab and log in.</p><a href="/login">Go to login</a>');
});

router.post('/settings/resend-verification', requireTeacher, async (req, res) => {
  if (req.teacher.email_verified) return res.redirect('/settings');
  let token = req.teacher.email_verify_token;
  if (!token) {
    token = crypto.randomBytes(20).toString('hex');
    db.prepare('UPDATE teachers SET email_verify_token = ? WHERE id = ?').run(token, req.teacher.id);
  }
  try {
    const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email/${token}`;
    await mailer.sendVerificationEmail({ to: req.teacher.email, name: req.teacher.name, verifyUrl });
    res.redirect('/settings?verification_sent=1');
  } catch (err) {
    res.redirect(`/settings?verification_error=${encodeURIComponent(err.message)}`);
  }
});

router.get('/settings', requireTeacher, (req, res) => {
  const referredTeachers = db
    .prepare('SELECT name, has_purchased FROM teachers WHERE referred_by_teacher_id = ?')
    .all(req.teacher.id);
  const purchasedReferrals = referredTeachers.filter((t) => t.has_purchased).length;

  res.render('settings', {
    teacher: req.teacher,
    error: null,
    saved: req.query.saved || null,
    verificationSent: req.query.verification_sent || null,
    verificationError: req.query.verification_error || null,
    referralUrl: `${req.protocol}://${req.get('host')}/signup?ref=${req.teacher.referral_code}`,
    referredTeachers,
    purchasedReferrals
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
    // send a fresh link automatically if email sending is configured.
    const newToken = crypto.randomBytes(20).toString('hex');
    db.prepare(
      'UPDATE teachers SET name = ?, email = ?, phone = ?, email_verified = 0, email_verify_token = ? WHERE id = ?'
    ).run(name.trim(), email.toLowerCase().trim(), (phone || '').trim(), newToken, req.teacher.id);
    if (mailer.isConfigured()) {
      const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email/${newToken}`;
      mailer.sendVerificationEmail({ to: email.toLowerCase().trim(), name: name.trim(), verifyUrl }).catch(() => {});
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
