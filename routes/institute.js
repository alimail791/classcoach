// Institute admin: create and manage teacher logins, watch the shared
// student and AI limits, and see every class's results.
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { getPlan, daysUntil, isPlanActive } = require('../lib/plans');
const { currentMonth } = require('../lib/usage');
const inst = require('../lib/institutes');
const { chapterBreakdownFor } = require('../lib/studentStats');
const mailer = require('../lib/mailer');
const { buildWhatsAppLink } = require('../lib/whatsapp');

const router = express.Router();

function requireInstituteOwner(req, res, next) {
  if (!inst.isOwner(req.teacher)) return res.redirect('/dashboard');
  req.institute = inst.instituteFor(req.teacher);
  if (!req.institute) return res.redirect('/dashboard');
  next();
}

// Easy to read aloud or type on a phone: no 0/O or 1/l/I.
function tempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[crypto.randomInt(0, chars.length)];
  return out;
}

function uniqueReferralCode(name) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'teacher';
  for (let i = 0; i < 8; i++) {
    const c = `${base}${crypto.randomInt(1000, 9999)}`;
    if (!db.prepare('SELECT id FROM teachers WHERE referral_code = ?').get(c)) return c;
  }
  return `${base}${Date.now()}`;
}

function memberOr404(req, res) {
  const t = db.prepare("SELECT * FROM teachers WHERE id = ? AND institute_id = ? AND institute_role = 'teacher'").get(req.params.id, req.institute.id);
  if (!t) res.status(404).send('Teacher not found');
  return t;
}

// Shows a one-time message (e.g. a new temporary password) after a redirect.
function flash(req, msg) {
  if (msg.password) {
    const text = `Hi ${msg.name}, your ClassCoach teacher login${msg.instituteName ? ` for ${msg.instituteName}` : ''}:\n${msg.loginUrl}\nEmail: ${msg.email}\nPassword: ${msg.password}\nPlease change the password in Settings after logging in.`;
    msg.waLink = buildWhatsAppLink(msg.phone || '', text);
  }
  req.session.instituteFlash = msg;
}

router.get('/institute', requireTeacher, requireInstituteOwner, (req, res) => {
  const i = req.institute;
  const plan = getPlan(i.plan) || {};
  const members = inst.members(i.id);
  const classes = db
    .prepare(
      `SELECT b.*, t.name AS teacher_name, t.active AS teacher_active,
        (SELECT COUNT(*) FROM students s WHERE s.batch_id = b.id) AS student_count,
        (SELECT COUNT(*) FROM tests x WHERE x.batch_id = b.id) AS test_count,
        (SELECT ROUND(AVG(CASE WHEN a.total > 0 THEN 100.0 * a.score / a.total END)) FROM attempts a JOIN tests x ON x.id = a.test_id WHERE x.batch_id = b.id AND a.status = 'graded') AS avg_pct
       FROM batches b JOIN teachers t ON t.id = b.teacher_id
       WHERE t.institute_id = ? ORDER BY t.name, b.name`
    )
    .all(i.id);
  const message = req.session.instituteFlash || null;
  req.session.instituteFlash = null;
  res.render('institute', {
    teacher: req.teacher,
    institute: i,
    planName: plan.name || i.plan,
    onTrial: i.plan === 'inst_trial',
    planActive: isPlanActive(i),
    daysLeft: daysUntil(i.plan_expires_at),
    members,
    classes,
    seatsUsed: inst.teacherSeatsUsed(i.id),
    studentsUsed: inst.studentTotalFor(req.teacher),
    aiUsed: inst.aiUsedFor(req.teacher, currentMonth()),
    message,
    error: req.query.error || null
  });
});

router.post('/institute/name', requireTeacher, requireInstituteOwner, (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 120);
  if (name) db.prepare('UPDATE institutes SET name = ? WHERE id = ?').run(name, req.institute.id);
  res.redirect('/institute');
});

router.post('/institute/teachers', requireTeacher, requireInstituteOwner, (req, res) => {
  const i = req.institute;
  const back = (error) => res.redirect('/institute?error=' + encodeURIComponent(error) + '#teachers');
  const name = String(req.body.name || '').trim().slice(0, 100);
  const email = String(req.body.email || '').toLowerCase().trim();
  const phone = String(req.body.phone || '').trim().slice(0, 20);
  let password = String(req.body.password || '').trim();
  if (!name || !email) return back('Enter the teacher’s name and email.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return back('That email address doesn’t look right.');
  if (password && password.length < 6) return back('The password must be at least 6 characters, or leave it blank to create one.');
  if (!isPlanActive(i)) return back('Your institute plan has expired. Renew it to add teachers.');
  if (inst.teacherSeatsUsed(i.id) >= i.max_teachers) {
    return back(`Your plan allows ${i.max_teachers} teachers and all are in use. Upgrade, or deactivate a teacher who has left.`);
  }
  if (db.prepare('SELECT id FROM teachers WHERE email = ?').get(email)) {
    return back('That email already has a ClassCoach account. Use a different email for this teacher, or contact us to move the account into your institute.');
  }
  const generated = !password;
  if (generated) password = tempPassword();
  const id = Number(
    db
      .prepare(
        `INSERT INTO teachers (name, email, phone, password_hash, plan, max_students, ai_limit_monthly, plan_expires_at, referral_code,
           signup_verified, email_verified, exam_track, institute_id, institute_role, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'neet_jee', ?, 'teacher', 1)`
      )
      .run(name, email, phone, bcrypt.hashSync(password, 10), i.plan, i.max_students, i.ai_limit_monthly, i.plan_expires_at, uniqueReferralCode(name), i.id).lastInsertRowid
  );
  inst.syncMembers(i.id);

  const loginUrl = `${req.protocol}://${req.get('host')}/login`;
  if (mailer.isConfigured()) {
    mailer
      .sendPlainEmail({
        to: email,
        subject: `${i.name} added you to ClassCoach`,
        text: `Hi ${name},\n\n${req.teacher.name} has created a ClassCoach teacher account for you at ${i.name}.\n\nLog in: ${loginUrl}\nEmail: ${email}\nPassword: ${password}\n\nPlease change your password in Settings after you log in.\n\n— ClassCoach`
      })
      .catch((err) => console.error('Institute teacher welcome email failed:', err.message));
  }
  flash(req, {
    kind: 'created',
    teacherId: id,
    name,
    email,
    password,
    loginUrl,
    emailed: mailer.isConfigured(),
    phone,
    instituteName: i.name
  });
  res.redirect('/institute#teachers');
});

router.post('/institute/teachers/:id/reset-password', requireTeacher, requireInstituteOwner, (req, res) => {
  const t = memberOr404(req, res);
  if (!t) return;
  const password = tempPassword();
  // A fresh session_token signs the teacher out of every open session.
  db.prepare('UPDATE teachers SET password_hash = ?, must_change_password = 1, session_token = ? WHERE id = ?').run(
    bcrypt.hashSync(password, 10),
    crypto.randomBytes(16).toString('hex'),
    t.id
  );
  flash(req, { kind: 'reset', teacherId: t.id, name: t.name, email: t.email, password, loginUrl: `${req.protocol}://${req.get('host')}/login`, emailed: false, phone: t.phone, instituteName: req.institute.name });
  res.redirect('/institute#teachers');
});

router.post('/institute/teachers/:id/toggle', requireTeacher, requireInstituteOwner, (req, res) => {
  const t = memberOr404(req, res);
  if (!t) return;
  if (!t.active && inst.teacherSeatsUsed(req.institute.id) >= req.institute.max_teachers) {
    return res.redirect('/institute?error=' + encodeURIComponent(`All ${req.institute.max_teachers} teacher seats are in use. Upgrade or deactivate someone first.`) + '#teachers');
  }
  db.prepare('UPDATE teachers SET active = ?, session_token = ? WHERE id = ?').run(t.active ? 0 : 1, crypto.randomBytes(16).toString('hex'), t.id);
  flash(req, { kind: t.active ? 'deactivated' : 'activated', name: t.name });
  res.redirect('/institute#teachers');
});

// Read-only class report for the institute admin.
router.get('/institute/classes/:batchId', requireTeacher, requireInstituteOwner, (req, res) => {
  const batch = db.prepare('SELECT b.*, t.name AS teacher_name FROM batches b JOIN teachers t ON t.id = b.teacher_id WHERE b.id = ?').get(req.params.batchId);
  if (!inst.canViewBatch(req.teacher, batch)) return res.status(404).send('Class not found');
  const tests = db
    .prepare(
      `SELECT x.*, (SELECT COUNT(*) FROM attempts a WHERE a.test_id = x.id) AS attempt_count,
        (SELECT ROUND(AVG(CASE WHEN a.total > 0 THEN 100.0 * a.score / a.total END)) FROM attempts a WHERE a.test_id = x.id AND a.status = 'graded') AS avg_pct
       FROM tests x WHERE x.batch_id = ? AND x.status != 'draft' ORDER BY x.created_at DESC`
    )
    .all(batch.id);
  const students = db
    .prepare('SELECT * FROM students WHERE batch_id = ? ORDER BY roll_no')
    .all(batch.id)
    .map((s) => {
      const row = db
        .prepare("SELECT COUNT(*) AS n, ROUND(AVG(CASE WHEN total > 0 THEN 100.0 * score / total END)) AS avg FROM attempts WHERE student_id = ? AND status = 'graded'")
        .get(s.id);
      const weak = chapterBreakdownFor(s.id).filter((c) => c.pct !== null && c.pct < 60).slice(0, 3);
      return { ...s, attempts: row.n, avg: row.avg, weak };
    });
  res.render('institute_class', { teacher: req.teacher, institute: req.institute, batch, tests, students });
});

module.exports = router;
