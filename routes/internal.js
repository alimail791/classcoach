// Private API for the Raise Academy WhatsApp bot (wa-bot). Lets the bot recognise a classcoach.in teacher by
// phone and apply a plan they bought on WhatsApp to their classcoach.in account, so each teacher has one
// account and one subscription. Every request needs the header X-Internal-Key = WA_BOT_KEY; without that
// env var set, these routes are switched off.
const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db');
const { getPlan, applyPurchasedPlan, isPlanActive } = require('../lib/plans');
const { markPurchasedAndCheckReferral } = require('../lib/referrals');

const router = express.Router();

function requireBotKey(req, res, next) {
  const expected = process.env.WA_BOT_KEY;
  if (!expected) return res.status(503).json({ error: 'WhatsApp bot link is not configured.' });
  const given = String(req.get('x-internal-key') || '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);

function findTeacherByPhone(phone) {
  const want = last10(phone);
  if (want.length !== 10) return null;
  const rows = db.prepare("SELECT * FROM teachers WHERE phone <> '' ORDER BY id DESC").all();
  return rows.find((t) => last10(t.phone) === want) || null;
}

function teacherSummary(t) {
  const batches = db
    .prepare('SELECT b.id, b.name, b.subject, b.join_code, (SELECT COUNT(*) FROM students s WHERE s.batch_id = b.id) AS students FROM batches b WHERE b.teacher_id = ? ORDER BY b.id')
    .all(t.id);
  return {
    id: t.id,
    name: t.name,
    email: t.email,
    active: !!t.active,
    plan: t.plan,
    track: getPlan(t.plan)?.track || 'general',
    maxStudents: t.max_students,
    planExpiresAt: t.plan_expires_at || null,
    planActive: isPlanActive(t),
    hasPurchased: !!t.has_purchased,
    referralCode: t.referral_code || '',
    phoneVerified: !!t.phone_verified,
    emailVerified: !!t.email_verified,
    students: batches.reduce((n, b) => n + b.students, 0),
    batches
  };
}

router.get('/internal/wa/teacher', requireBotKey, (req, res) => {
  const t = findTeacherByPhone(req.query.phone);
  if (!t) return res.status(404).json({ found: false });
  res.json({ found: true, teacher: teacherSummary(t) });
});

// Apply a plan paid for on WhatsApp. Idempotent per payment id.
router.post('/internal/wa/apply-plan', requireBotKey, express.json(), (req, res) => {
  const { phone, planId, paymentId, amount } = req.body || {};
  const plan = getPlan(planId);
  if (!plan || plan.id === 'trial') return res.status(400).json({ error: 'Unknown plan.' });
  if (!paymentId) return res.status(400).json({ error: 'paymentId is required.' });
  const t = findTeacherByPhone(phone);
  if (!t) return res.status(404).json({ found: false });

  const orderRef = `wa_${paymentId}`;
  const existing = db.prepare('SELECT * FROM payments WHERE razorpay_order_id = ?').get(orderRef);
  if (existing && existing.status === 'paid') {
    return res.json({ ok: true, alreadyApplied: true, teacher: teacherSummary(db.prepare('SELECT * FROM teachers WHERE id = ?').get(t.id)) });
  }
  db.prepare("INSERT INTO payments (teacher_id, plan_id, amount, razorpay_order_id, razorpay_payment_id, status) VALUES (?, ?, ?, ?, ?, 'paid')").run(
    t.id,
    plan.id,
    Math.round(Number(amount) || plan.price) * 100,
    orderRef,
    String(paymentId)
  );
  applyPurchasedPlan(db, t.id, plan.id);
  markPurchasedAndCheckReferral(t.id);
  res.json({ ok: true, teacher: teacherSummary(db.prepare('SELECT * FROM teachers WHERE id = ?').get(t.id)) });
});

// Mark a teacher's phone as verified: the bot calls this when the teacher taps "Verify my number" or
// messages it from the number on their account (a message from a number proves the number is theirs).
router.post('/internal/wa/verify-phone', requireBotKey, express.json(), (req, res) => {
  const t = findTeacherByPhone((req.body || {}).phone);
  if (!t) return res.status(404).json({ found: false });
  if (!t.phone_verified) db.prepare('UPDATE teachers SET phone_verified = 1 WHERE id = ?').run(t.id);
  res.json({ ok: true, alreadyVerified: !!t.phone_verified, emailVerified: !!t.email_verified, name: t.name });
});

// Everyone the WhatsApp journey (welcome, verify, refer & earn, we miss you) may need to message: verified
// signups with a phone, still active, who joined in the last 120 days or were active in that time.
router.get('/internal/wa/journey', requireBotKey, (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.phone, t.email_verified, t.phone_verified, t.created_at, t.last_active_at, t.referral_code,
              t.institute_id, t.institute_role, t.plan, t.plan_expires_at, t.has_purchased,
              (SELECT COUNT(*) FROM students s JOIN batches b ON b.id = s.batch_id WHERE b.teacher_id = t.id) AS students,
              (SELECT COUNT(*) FROM batches b WHERE b.teacher_id = t.id) AS classes
       FROM teachers t
       WHERE t.active = 1 AND t.signup_verified = 1 AND t.phone <> ''
         AND (t.created_at >= datetime('now', '-120 days') OR t.last_active_at >= datetime('now', '-120 days'))`
    )
    .all();
  const origin = process.env.SITE_ORIGIN || 'https://www.classcoach.in';
  res.json({
    teachers: rows.map((t) => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      emailVerified: !!t.email_verified,
      phoneVerified: !!t.phone_verified,
      createdAt: t.created_at ? t.created_at.replace(' ', 'T') + (t.created_at.includes('T') ? '' : 'Z') : null,
      lastActiveAt: t.last_active_at || null,
      kind: t.institute_id ? (t.institute_role === 'owner' ? 'institute_owner' : 'institute_teacher') : 'teacher',
      referralUrl: t.referral_code ? `${origin}/signup?ref=${t.referral_code}` : null,
      students: t.students,
      classes: t.classes,
      planActive: isPlanActive(t),
      hasPurchased: !!t.has_purchased
    }))
  });
});

module.exports = router;
