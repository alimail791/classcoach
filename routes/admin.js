const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db');
const { requireAdminSession } = require('../lib/auth');
const { getUsage, currentMonth } = require('../lib/usage');
const { PLANS, getPlan, addMonths, daysUntil, isPlanActive } = require('../lib/plans');
const mailer = require('../lib/mailer');

const router = express.Router();

// --- Admin login: a completely separate credential from teacher accounts ---

const { notify } = require('../lib/notifications');
const { markPurchasedAndCheckReferral } = require('../lib/referrals');

router.get('/admin/login', (req, res) => {
  res.render('admin_login', { error: null });
});

router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminEmail || !adminPassword) {
    return res.render('admin_login', { error: 'Admin login is not configured — set ADMIN_EMAIL and ADMIN_PASSWORD in .env.' });
  }

  const emailMatches = (email || '').trim().toLowerCase() === adminEmail.toLowerCase();
  const passwordMatches = (password || '') === adminPassword;

  if (!emailMatches || !passwordMatches) {
    return res.render('admin_login', { error: 'Incorrect email or password.' });
  }

  req.session.isAdminSession = true;
  res.redirect('/admin');
});

router.post('/admin/logout', (req, res) => {
  req.session.isAdminSession = null;
  res.redirect('/admin/login');
});

// --- Dashboard ---

router.get('/admin', requireAdminSession, (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const teachers = db
    .prepare('SELECT * FROM teachers ORDER BY created_at DESC')
    .all()
    .filter((t) => !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q))
    .map((t) => {
      const batchCount = db.prepare('SELECT COUNT(*) AS c FROM batches WHERE teacher_id = ?').get(t.id).c;
      const studentCount = db
        .prepare(
          `SELECT COUNT(*) AS c FROM students
           JOIN batches ON batches.id = students.batch_id
           WHERE batches.teacher_id = ?`
        )
        .get(t.id).c;
      const testCount = db.prepare('SELECT COUNT(*) AS c FROM tests WHERE teacher_id = ?').get(t.id).c;
      const aiUsed = getUsage(t.id);
      return {
        ...t,
        batchCount,
        studentCount,
        testCount,
        aiUsed,
        planName: (getPlan(t.plan) || {}).name || t.plan,
        expiryDays: daysUntil(t.plan_expires_at),
        active_plan: isPlanActive(t)
      };
    });

  const totals = {
    teachers: teachers.length,
    activeTeachers: teachers.filter((t) => t.active).length,
    students: teachers.reduce((s, t) => s + t.studentCount, 0),
    tests: teachers.reduce((s, t) => s + t.testCount, 0),
    aiUsedThisMonth: teachers.reduce((s, t) => s + t.aiUsed, 0)
  };

  res.render('admin_dashboard', {
    teachers,
    totals,
    month: currentMonth(),
    plans: Object.values(PLANS),
    q: req.query.q || '',
    resetSent: req.query.resetSent || null,
    resetLink: req.query.resetLink || null,
    resetFor: req.query.resetFor || null,
    deleteError: req.query.deleteError || null,
    notifySent: req.query.notifySent || null,
    notifyEmailError: req.query.notifyEmailError || null
  });
});

router.post('/admin/teachers/:id/toggle-active', requireAdminSession, (req, res) => {
  const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).send('Not found');
  db.prepare('UPDATE teachers SET active = ? WHERE id = ?').run(target.active ? 0 : 1, target.id);
  res.redirect('/admin');
});

router.post('/admin/teachers/:id/plan', requireAdminSession, (req, res) => {
  const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).send('Not found');

  const chosen = getPlan(req.body.plan_id);
  const maxStudents = chosen ? chosen.max_students : target.max_students;
  const aiLimit = chosen ? chosen.ai_limit_monthly : target.ai_limit_monthly;
  const planId = chosen ? chosen.id : target.plan;

  let expiresAt = target.plan_expires_at;
  if (req.body.extend_months) {
    const months = parseInt(req.body.extend_months, 10) || 0;
    const base = expiresAt && new Date(expiresAt) > new Date() ? expiresAt : new Date();
    expiresAt = addMonths(base, months).toISOString();
  } else if (req.body.clear_expiry === '1') {
    expiresAt = null;
  }

  db.prepare('UPDATE teachers SET plan = ?, max_students = ?, ai_limit_monthly = ?, plan_expires_at = ? WHERE id = ?').run(
    planId,
    maxStudents,
    aiLimit,
    expiresAt,
    target.id
  );

  // First time this teacher goes onto a paid plan, mark it and check
  // whether whoever referred them has now earned a referral reward.
  if (planId !== 'trial') {
    markPurchasedAndCheckReferral(target.id);
  }

  res.redirect('/admin');
});

router.get('/admin/export', requireAdminSession, (req, res) => {
  const tableNames = [
    'teachers',
    'batches',
    'students',
    'tests',
    'questions',
    'attempts',
    'answers',
    'materials',
    'attendance_sessions',
    'attendance_records',
    'homework',
    'homework_completion',
    'report_tokens',
    'ai_usage'
  ];
  const dump = { exported_at: new Date().toISOString() };
  tableNames.forEach((t) => {
    try {
      dump[t] = db.prepare(`SELECT * FROM ${t}`).all();
    } catch (e) {
      dump[t] = [];
    }
  });
  // Never export password hashes in a backup file that might be shared.
  dump.teachers = dump.teachers.map(({ password_hash, ...rest }) => rest);

  res.set('Content-Type', 'application/json');
  res.set('Content-Disposition', `attachment; filename="classcoach_backup_${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(dump, null, 2));
});

router.post('/admin/teachers/:id/notify', requireAdminSession, async (req, res) => {
  const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).send('Not found');
  const message = (req.body.message || '').trim();
  if (!message) return res.redirect('/admin');

  notify('teacher', target.id, message, 'ClassCoach Admin');

  if (req.body.also_email && mailer.isConfigured()) {
    try {
      await mailer.sendPlainEmail({ to: target.email, subject: 'A message from ClassCoach', text: message });
      return res.redirect(`/admin?notifySent=${encodeURIComponent(target.name)}`);
    } catch (err) {
      return res.redirect(`/admin?notifyEmailError=${encodeURIComponent(err.message)}`);
    }
  }
  res.redirect(`/admin?notifySent=${encodeURIComponent(target.name)}`);
});

router.post('/admin/teachers/:id/reset-password', requireAdminSession, async (req, res) => {
  const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).send('Not found');

  const token = crypto.randomBytes(20).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE teachers SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?').run(
    token,
    expires,
    target.id
  );
  const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;

  if (mailer.isConfigured()) {
    try {
      await mailer.sendPasswordResetEmail({ to: target.email, name: target.name, resetUrl });
      return res.redirect(`/admin?resetSent=${encodeURIComponent(target.email)}`);
    } catch (err) {
      return res.redirect(`/admin?resetLink=${encodeURIComponent(resetUrl)}&resetFor=${encodeURIComponent(target.name)}`);
    }
  }
  res.redirect(`/admin?resetLink=${encodeURIComponent(resetUrl)}&resetFor=${encodeURIComponent(target.name)}`);
});

router.post('/admin/teachers/:id/verify-email', requireAdminSession, (req, res) => {
  const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).send('Not found');
  db.prepare('UPDATE teachers SET email_verified = 1, email_verify_token = NULL WHERE id = ?').run(target.id);
  res.redirect('/admin');
});

router.post('/admin/teachers/:id/delete', requireAdminSession, (req, res) => {
  const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).send('Not found');
  if (req.body.confirm_name !== target.name) {
    return res.redirect('/admin?deleteError=1');
  }
  db.prepare('DELETE FROM teachers WHERE id = ?').run(target.id);
  res.redirect('/admin');
});

module.exports = router;
