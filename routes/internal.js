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

module.exports = router;
