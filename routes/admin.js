const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db');
const { requireAdminSession } = require('../lib/auth');
const { getUsage, currentMonth } = require('../lib/usage');
const { PLANS, getPlan, addMonths, daysUntil, isPlanActive, isTrialPlan, durationLabel } = require('../lib/plans');
const { getInstitute, setInstitutePlan, teacherSeatsUsed } = require('../lib/institutes');
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
  const f = ['all', 'trial', 'paid', 'expiring', 'expired', 'institute', 'neet', 'inactive'].includes(req.query.f) ? req.query.f : 'all';
  const month = currentMonth();
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);

  const instNames = {};
  all('SELECT id, name FROM institutes').forEach((i) => (instNames[i.id] = i.name));
  const referrals = {};
  all('SELECT referred_by_teacher_id AS id, COUNT(*) AS n, SUM(has_purchased) AS bought FROM teachers WHERE referred_by_teacher_id IS NOT NULL GROUP BY referred_by_teacher_id').forEach(
    (r) => (referrals[r.id] = r)
  );

  const allTeachers = all('SELECT * FROM teachers ORDER BY created_at DESC').map((t) => {
    const plan = getPlan(t.plan) || {};
    const expiryDays = daysUntil(t.plan_expires_at);
    return {
      ...t,
      batchCount: one('SELECT COUNT(*) AS c FROM batches WHERE teacher_id = ?', t.id).c,
      studentCount: one('SELECT COUNT(*) AS c FROM students JOIN batches ON batches.id = students.batch_id WHERE batches.teacher_id = ?', t.id).c,
      testCount: one('SELECT COUNT(*) AS c FROM tests WHERE teacher_id = ?', t.id).c,
      aiUsed: getUsage(t.id),
      planName: plan.name || t.plan,
      isTrial: isTrialPlan(t.plan),
      instituteName: t.institute_id ? instNames[t.institute_id] || null : null,
      expiryDays,
      active_plan: isPlanActive(t),
      referred: (referrals[t.id] || {}).n || 0,
      referredBought: (referrals[t.id] || {}).bought || 0
    };
  });

  const matchesFilter = (t) => {
    if (f === 'trial') return t.isTrial && t.active_plan;
    if (f === 'paid') return !t.isTrial && t.active_plan;
    if (f === 'expiring') return t.expiryDays !== null && t.expiryDays >= 0 && t.expiryDays <= 7;
    if (f === 'expired') return t.expiryDays !== null && t.expiryDays < 0;
    if (f === 'institute') return !!t.institute_id;
    if (f === 'neet') return t.exam_track === 'neet_jee' && !t.institute_id;
    if (f === 'inactive') return !t.active;
    return true;
  };
  const teachers = allTeachers.filter(
    (t) => matchesFilter(t) && (!q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || (t.phone || '').includes(q) || (t.instituteName || '').toLowerCase().includes(q))
  );

  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().replace('T', ' ').slice(0, 19);
  const totals = {
    teachers: allTeachers.length,
    activeTeachers: allTeachers.filter((t) => t.active).length,
    newThisWeek: allTeachers.filter((t) => t.created_at >= daysAgo(7)).length,
    newThisMonth: allTeachers.filter((t) => t.created_at >= daysAgo(30)).length,
    onTrial: allTeachers.filter((t) => t.isTrial && t.active_plan).length,
    paid: allTeachers.filter((t) => !t.isTrial && t.active_plan).length,
    expiringSoon: allTeachers.filter((t) => t.expiryDays !== null && t.expiryDays >= 0 && t.expiryDays <= 7).length,
    expired: allTeachers.filter((t) => t.expiryDays !== null && t.expiryDays < 0).length,
    activeLast7: allTeachers.filter((t) => t.last_active_at && t.last_active_at >= new Date(Date.now() - 7 * 864e5).toISOString()).length,
    students: one('SELECT COUNT(*) AS c FROM students').c,
    tests: one('SELECT COUNT(*) AS c FROM tests').c,
    attempts: one('SELECT COUNT(*) AS c FROM attempts').c,
    aiUsedThisMonth: one('SELECT COALESCE(SUM(count), 0) AS c FROM ai_usage WHERE month = ?', month).c
  };

  // Revenue (amounts are stored in paise). WhatsApp payments have order ids starting "wa_".
  const paid = "status = 'paid'";
  const revenue = {
    total: one(`SELECT COALESCE(SUM(amount), 0) AS c FROM payments WHERE ${paid}`).c / 100,
    thisMonth: one(`SELECT COALESCE(SUM(amount), 0) AS c FROM payments WHERE ${paid} AND substr(created_at, 1, 7) = ?`, month).c / 100,
    last30: one(`SELECT COALESCE(SUM(amount), 0) AS c FROM payments WHERE ${paid} AND created_at >= ?`, daysAgo(30)).c / 100,
    count: one(`SELECT COUNT(*) AS c FROM payments WHERE ${paid}`).c,
    viaWhatsApp: one(`SELECT COALESCE(SUM(amount), 0) AS c FROM payments WHERE ${paid} AND substr(razorpay_order_id, 1, 3) = 'wa_'`).c / 100,
    abandoned: one("SELECT COUNT(*) AS c FROM payments WHERE status != 'paid' AND created_at >= ?", daysAgo(30)).c
  };
  const byPlanTrack = { general: 0, neet_jee: 0, institute: 0 };
  all(`SELECT plan_id, SUM(amount) AS amt FROM payments WHERE ${paid} GROUP BY plan_id`).forEach((r) => {
    const tr = (getPlan(r.plan_id) || {}).track || 'general';
    byPlanTrack[tr] = (byPlanTrack[tr] || 0) + r.amt / 100;
  });
  const payments = all(
    `SELECT p.*, t.name AS teacher_name, t.email AS teacher_email FROM payments p LEFT JOIN teachers t ON t.id = p.teacher_id
     ORDER BY p.created_at DESC LIMIT 25`
  ).map((p) => ({ ...p, planName: (getPlan(p.plan_id) || {}).name || p.plan_id, viaWhatsApp: String(p.razorpay_order_id).startsWith('wa_') }));

  const institutes = all('SELECT i.*, t.name AS owner_name, t.email AS owner_email, t.phone AS owner_phone FROM institutes i LEFT JOIN teachers t ON t.id = i.owner_teacher_id ORDER BY i.created_at DESC').map((i) => ({
    ...i,
    planName: (getPlan(i.plan) || {}).name || i.plan,
    isTrial: i.plan === 'inst_trial',
    expiryDays: daysUntil(i.plan_expires_at),
    seatsUsed: teacherSeatsUsed(i.id),
    studentsUsed: one('SELECT COUNT(*) AS c FROM students s JOIN batches b ON b.id = s.batch_id JOIN teachers t ON t.id = b.teacher_id WHERE t.institute_id = ?', i.id).c,
    aiUsed: one('SELECT COALESCE(SUM(u.count), 0) AS c FROM ai_usage u JOIN teachers t ON t.id = u.teacher_id WHERE t.institute_id = ? AND u.month = ?', i.id, month).c
  }));

  const usage = {
    liveGames: one('SELECT COUNT(*) AS c FROM live_sessions').c,
    liveGames30: one('SELECT COUNT(*) AS c FROM live_sessions WHERE created_at >= ?', daysAgo(30)).c,
    livePlayers: one('SELECT COALESCE(SUM(player_count), 0) AS c FROM live_sessions').c,
    videos: one('SELECT COUNT(*) AS c FROM video_lessons').c,
    materials: one('SELECT COUNT(*) AS c FROM materials').c,
    referralSignups: one('SELECT COUNT(*) AS c FROM teachers WHERE referred_by_teacher_id IS NOT NULL').c,
    referralBuyers: one('SELECT COUNT(*) AS c FROM teachers WHERE referred_by_teacher_id IS NOT NULL AND has_purchased = 1').c,
    referralRewards: one('SELECT COALESCE(SUM(referral_rewards_granted), 0) AS c FROM teachers').c,
    blogPublished: one("SELECT COUNT(*) AS c FROM blog_posts WHERE status = 'published'").c,
    blogDrafts: one("SELECT COUNT(*) AS c FROM blog_posts WHERE status != 'published'").c,
    neetTeachers: allTeachers.filter((t) => t.exam_track === 'neet_jee' && !t.institute_id).length
  };

  const planGroups = [
    { label: 'Individual · School & general', plans: Object.values(PLANS).filter((p) => p.track === 'general' || p.id === 'trial') },
    { label: 'Individual · NEET/JEE', plans: Object.values(PLANS).filter((p) => p.track === 'neet_jee') },
    { label: 'Institute', plans: Object.values(PLANS).filter((p) => p.track === 'institute') }
  ];

  res.render('admin_dashboard', {
    teachers,
    totals,
    revenue,
    byPlanTrack,
    payments,
    institutes,
    usage,
    filter: f,
    month,
    plans: Object.values(PLANS),
    planGroups,
    durationLabel,
    q: req.query.q || '',
    saved: req.query.saved || null,
    resetSent: req.query.resetSent || null,
    resetLink: req.query.resetLink || null,
    resetFor: req.query.resetFor || null,
    deleteError: req.query.deleteError || null,
    notifySent: req.query.notifySent || null,
    notifyEmailError: req.query.notifyEmailError || null
  });
});

router.post('/admin/institutes/:id/plan', requireAdminSession, (req, res) => {
  const i = getInstitute(req.params.id);
  if (!i) return res.status(404).send('Not found');
  const chosen = getPlan(req.body.plan_id);
  let expiresAt = i.plan_expires_at;
  if (req.body.extend_months) {
    const months = parseInt(req.body.extend_months, 10) || 0;
    const base = expiresAt && new Date(expiresAt) > new Date() ? expiresAt : new Date();
    expiresAt = addMonths(base, months).toISOString();
  } else if (req.body.clear_expiry === '1') {
    expiresAt = null;
  }
  const planId = chosen && chosen.track === 'institute' ? chosen.id : i.plan;
  setInstitutePlan(i.id, { planId, expiresAt });
  if (planId !== 'inst_trial' && i.owner_teacher_id) markPurchasedAndCheckReferral(i.owner_teacher_id);
  res.redirect('/admin?saved=' + encodeURIComponent(i.name) + '#institutes');
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

  // Institute accounts: the plan lives on the institute and applies to every
  // teacher in it, so change it there (the chosen plan must be an institute plan).
  if (target.institute_id) {
    const i = getInstitute(target.institute_id);
    let expiresAt = i.plan_expires_at;
    if (req.body.extend_months) {
      const months = parseInt(req.body.extend_months, 10) || 0;
      const base = expiresAt && new Date(expiresAt) > new Date() ? expiresAt : new Date();
      expiresAt = addMonths(base, months).toISOString();
    } else if (req.body.clear_expiry === '1') {
      expiresAt = null;
    }
    const planId = chosen && chosen.track === 'institute' ? chosen.id : i.plan;
    setInstitutePlan(i.id, { planId, expiresAt });
    if (planId !== 'inst_trial' && i.owner_teacher_id) markPurchasedAndCheckReferral(i.owner_teacher_id);
    return res.redirect('/admin');
  }
  if (chosen && chosen.track === 'institute') return res.redirect('/admin');

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

  res.redirect('/admin?saved=' + encodeURIComponent(target.name));
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
    'ai_usage',
    'payments',
    'institutes',
    'video_lessons',
    'live_sessions',
    'live_players',
    'notifications',
    'practice_recommendations',
    'blog_posts',
    'email_leads'
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
  dump.teachers = dump.teachers.map(({ password_hash, session_token, email_otp, password_reset_token, email_verify_token, ...rest }) => rest);

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
  if (target.institute_role === 'owner' && db.prepare("SELECT COUNT(*) AS c FROM teachers WHERE institute_id = ? AND institute_role = 'teacher'").get(target.institute_id).c > 0) {
    return res.redirect('/admin?deleteError=owner');
  }
  db.prepare('DELETE FROM teachers WHERE id = ?').run(target.id);
  res.redirect('/admin');
});

module.exports = router;
