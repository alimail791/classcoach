const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { PLANS, getPlan, applyPurchasedPlan, paidPlansForTrack, trackEnabled, durationLabel, addMonths } = require('../lib/plans');
const { instituteFor } = require('../lib/institutes');
const { INSTITUTE_DISCOUNT_PCT } = require('../lib/referrals');
const razorpay = require('../lib/razorpay');
const { markPurchasedAndCheckReferral } = require('../lib/referrals');
const { notify } = require('../lib/notifications');
const mailer = require('../lib/mailer');
const { getTopup, TOPUP_VALID_MONTHS } = require('../lib/credits');
const { creditSummary } = require('../lib/usage');
const { isTrialPlan, isPlanActive } = require('../lib/plans');
const careerSeats = require('../lib/career/seats');

const router = express.Router();

// Which plans this account may buy: institute admins buy institute plans;
// teachers inside an institute buy nothing (their admin pays).
function buyableTrack(teacher) {
  if (teacher.institute_id) return teacher.institute_role === 'owner' ? 'institute' : null;
  return teacher.exam_track;
}

// Top-ups are for accounts on an active paid plan: individual teachers, or
// institute admins (credits go to the shared institute pool).
function canBuyTopup(teacher) {
  if (teacher.institute_id && teacher.institute_role !== 'owner') return false;
  return isPlanActive(teacher) && !isTrialPlan(teacher.plan);
}

router.get('/upgrade', requireTeacher, (req, res) => {
  const planName = (getPlan(req.teacher.plan) || {}).name || req.teacher.plan;
  const track = buyableTrack(req.teacher);
  res.render('upgrade', {
    teacher: req.teacher,
    planName,
    institute: instituteFor(req.teacher),
    discountPct: req.teacher.institute_role === 'owner' && (instituteFor(req.teacher) || {}).referral_coupons > 0 ? INSTITUTE_DISCOUNT_PCT : 0,
    instituteRole: req.teacher.institute_id ? req.teacher.institute_role : null,
    plans: track ? paidPlansForTrack(track) : [],
    razorpayConfigured: razorpay.isConfigured(),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    error: req.query.error || null,
    upgraded: req.query.upgraded || null,
    toppedUp: req.query.toppedup || null,
    credits: creditSummary(req.teacher),
    canBuyTopup: canBuyTopup(req.teacher)
  });
});

// Switch category (General <-> NEET/JEE). Only while still on the free trial,
// so nobody can buy a cheaper category's plan and then flip categories.
router.post('/upgrade/track', requireTeacher, (req, res) => {
  const track = req.body.track === 'neet_jee' ? 'neet_jee' : 'general';
  if (!trackEnabled() && track === 'neet_jee') return res.redirect('/upgrade');
  if (req.teacher.institute_id || req.teacher.plan !== 'trial' || req.teacher.has_purchased) {
    return res.redirect('/upgrade?error=' + encodeURIComponent('Category can only be changed before your first purchase - contact us if you need help.'));
  }
  db.prepare('UPDATE teachers SET exam_track = ? WHERE id = ?').run(track, req.teacher.id);
  res.redirect('/upgrade');
});

router.post('/upgrade/create-order', requireTeacher, express.json(), async (req, res) => {
  if (!razorpay.isConfigured()) {
    return res.status(400).json({ error: 'Payments are not configured yet. Ask your admin to add Razorpay keys to .env.' });
  }
  const topup = getTopup(req.body.plan_id);
  if (topup) {
    if (!canBuyTopup(req.teacher)) {
      return res.status(400).json({ error: req.teacher.institute_id && req.teacher.institute_role !== 'owner' ? 'Your institute admin buys credits for the institute.' : 'Top-up packs need an active paid plan. Choose a plan first.' });
    }
    try {
      const order = await razorpay.createOrder({
        amountPaise: topup.price * 100,
        receipt: `teacher_${req.teacher.id}_${topup.id}_${Date.now()}`,
        notes: { teacher_id: String(req.teacher.id), plan_id: topup.id }
      });
      db.prepare(
        'INSERT INTO payments (teacher_id, plan_id, amount, currency, razorpay_order_id, status, discount_pct) VALUES (?, ?, ?, ?, ?, ?, 0)'
      ).run(req.teacher.id, topup.id, order.amount, order.currency, order.id, 'created');
      return res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        planName: topup.name,
        teacherName: req.teacher.name,
        teacherEmail: req.teacher.email,
        teacherPhone: req.teacher.phone
      });
    } catch (err) {
      console.error('Razorpay order creation failed:', err.message);
      return res.status(500).json({ error: 'Could not start payment: ' + err.message });
    }
  }

  // Career test seats (routes/career.js). Any teacher can buy them except
  // teachers inside an institute, whose admin buys for the institute.
  const career = careerSeats.parseProduct(req.body.plan_id);
  if (career) {
    if (req.teacher.institute_id && req.teacher.institute_role !== 'owner') {
      return res.status(400).json({ error: 'Your institute admin buys career test seats for the institute.' });
    }
    try {
      const order = await razorpay.createOrder({
        amountPaise: career.total * 100,
        receipt: `teacher_${req.teacher.id}_career_${Date.now()}`,
        notes: { teacher_id: String(req.teacher.id), plan_id: req.body.plan_id }
      });
      db.prepare(
        'INSERT INTO payments (teacher_id, plan_id, amount, currency, razorpay_order_id, status, discount_pct) VALUES (?, ?, ?, ?, ?, ?, 0)'
      ).run(req.teacher.id, req.body.plan_id, order.amount, order.currency, order.id, 'created');
      return res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        planName: career.name,
        teacherName: req.teacher.name,
        teacherEmail: req.teacher.email,
        teacherPhone: req.teacher.phone
      });
    } catch (err) {
      console.error('Razorpay order creation failed:', err.message);
      return res.status(500).json({ error: 'Could not start payment: ' + err.message });
    }
  }

  const plan = getPlan(req.body.plan_id);
  if (!plan || plan.id === 'trial') {
    return res.status(400).json({ error: 'Invalid plan selected.' });
  }
  // A teacher can only buy plans from their own category.
  const track = buyableTrack(req.teacher);
  if (!track) return res.status(400).json({ error: 'Your institute admin manages your plan.' });
  const allowed = paidPlansForTrack(track).some((p) => p.id === plan.id);
  if (!allowed) {
    return res.status(400).json({ error: 'That plan is not available for your account category.' });
  }

  // Institute Refer & earn: an unused coupon takes 40% off this purchase.
  const inst = plan.track === 'institute' ? instituteFor(req.teacher) : null;
  const discountPct = inst && inst.referral_coupons > 0 ? INSTITUTE_DISCOUNT_PCT : 0;
  const amountRupees = discountPct ? Math.round((plan.price * (100 - discountPct)) / 100) : plan.price;

  try {
    const order = await razorpay.createOrder({
      amountPaise: amountRupees * 100,
      receipt: `teacher_${req.teacher.id}_${plan.id}_${Date.now()}`,
      notes: { teacher_id: String(req.teacher.id), plan_id: plan.id }
    });

    db.prepare(
      'INSERT INTO payments (teacher_id, plan_id, amount, currency, razorpay_order_id, status, discount_pct) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.teacher.id, plan.id, order.amount, order.currency, order.id, 'created', discountPct);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planName: discountPct ? `${plan.name} (${discountPct}% referral discount)` : plan.name,
      teacherName: req.teacher.name,
      teacherEmail: req.teacher.email,
      teacherPhone: req.teacher.phone
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err.message);
    res.status(500).json({ error: 'Could not start payment: ' + err.message });
  }
});

router.post('/upgrade/verify', requireTeacher, express.json(), (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment details.' });
  }

  const payment = db
    .prepare('SELECT * FROM payments WHERE razorpay_order_id = ? AND teacher_id = ?')
    .get(razorpay_order_id, req.teacher.id);
  if (!payment) return res.status(404).json({ error: 'Order not found.' });

  const valid = razorpay.verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature
  });
  if (!valid) {
    db.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").run(payment.id);
    return res.status(400).json({ error: 'Payment could not be verified. If money was deducted, contact support.' });
  }

  applyAndFinalizePayment(payment, razorpay_payment_id);
  res.json({ success: true, topup: !!getTopup(payment.plan_id), career: !!careerSeats.parseProduct(payment.plan_id) });
});

// Webhook backstop: fires server-to-server from Razorpay even if the
// customer's browser closed right after paying, before the client-side
// verify above would have run. Configure this URL in your Razorpay
// dashboard's webhook settings, with the same secret as
// RAZORPAY_WEBHOOK_SECRET in .env.
router.post('/webhooks/razorpay', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!razorpay.verifyWebhookSignature(req.body, signature)) {
    return res.status(400).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch (e) {
    return res.status(400).send('Invalid payload');
  }

  if (event.event === 'payment.captured') {
    const paymentEntity = event.payload.payment.entity;
    const payment = db.prepare('SELECT * FROM payments WHERE razorpay_order_id = ?').get(paymentEntity.order_id);
    if (payment && payment.status !== 'paid') {
      applyAndFinalizePayment(payment, paymentEntity.id);
    }
  }

  res.json({ received: true });
});

// Shared by both the client-side verify and the webhook — whichever
// arrives first wins; the other is a no-op thanks to the status check.
function applyAndFinalizePayment(payment, razorpayPaymentId) {
  const fresh = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id);
  if (fresh.status === 'paid') return; // already processed by the other path

  db.prepare("UPDATE payments SET status = 'paid', razorpay_payment_id = ? WHERE id = ?").run(razorpayPaymentId, payment.id);

  const career = careerSeats.parseProduct(fresh.plan_id);
  if (career) {
    const buyer = db.prepare('SELECT * FROM teachers WHERE id = ?').get(payment.teacher_id);
    careerSeats.addSeats({ teacher: buyer, tier: career.tier, qty: career.qty, paymentId: payment.id });
    const msg = `Payment received — ${career.name} added${buyer.institute_id ? ' to your institute' : ''}. Each student who finishes the test uses one seat.`;
    notify('teacher', buyer.id, msg, 'ClassCoach');
    if (mailer.isConfigured()) {
      mailer
        .sendPlainEmail({ to: buyer.email, subject: 'Career test seats added', text: `Hi ${buyer.name},\n\n${msg}\n\n— ClassCoach` })
        .catch((err) => console.error('Career seats confirmation email failed:', err.message));
    }
    return;
  }

  const topup = getTopup(fresh.plan_id);
  if (topup) {
    const buyer = db.prepare('SELECT * FROM teachers WHERE id = ?').get(payment.teacher_id);
    const expires = addMonths(new Date(), TOPUP_VALID_MONTHS).toISOString();
    db.prepare('INSERT INTO credit_topups (teacher_id, institute_id, credits, remaining, expires_at, payment_id) VALUES (?, ?, ?, ?, ?, ?)').run(
      buyer.institute_id ? null : buyer.id,
      buyer.institute_id || null,
      topup.credits,
      topup.credits,
      expires,
      payment.id
    );
    const msg = `Payment received — ${topup.credits.toLocaleString('en-IN')} AI credits added${buyer.institute_id ? ' to your institute' : ''}. They're used after your monthly credits run out and stay valid for ${TOPUP_VALID_MONTHS} months.`;
    notify('teacher', buyer.id, msg, 'ClassCoach');
    if (mailer.isConfigured()) {
      mailer
        .sendPlainEmail({ to: buyer.email, subject: 'AI credits added', text: `Hi ${buyer.name},\n\n${msg}\n\n— ClassCoach` })
        .catch((err) => console.error('Top-up confirmation email failed:', err.message));
    }
    return;
  }
  // A discounted purchase uses up one of the institute's referral coupons.
  if (fresh.discount_pct > 0) {
    const buyer = db.prepare('SELECT institute_id FROM teachers WHERE id = ?').get(payment.teacher_id);
    if (buyer && buyer.institute_id) {
      db.prepare('UPDATE institutes SET referral_coupons = MAX(referral_coupons - 1, 0) WHERE id = ?').run(buyer.institute_id);
    }
  }
  applyPurchasedPlan(db, payment.teacher_id, payment.plan_id);
  markPurchasedAndCheckReferral(payment.teacher_id);

  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(payment.teacher_id);
  const plan = getPlan(payment.plan_id);
  const message =
    plan.track === 'institute'
      ? `Payment received — your institute is now on the ${plan.name} plan (${plan.max_teachers} teachers, ${plan.max_students} students, ${plan.ai_limit_monthly} AI credits/month shared) for the next ${durationLabel(plan.duration_months)}.`
      : `Payment received — you're now on the ${plan.name} plan (${plan.max_students} students, ${plan.ai_limit_monthly} AI credits/month) for the next ${durationLabel(plan.duration_months)}.`;
  notify('teacher', teacher.id, message, 'ClassCoach');
  if (mailer.isConfigured()) {
    mailer
      .sendPlainEmail({ to: teacher.email, subject: 'Payment received — plan upgraded', text: `Hi ${teacher.name},\n\n${message}\n\n— ClassCoach` })
      .catch((err) => console.error('Payment confirmation email failed:', err.message));
  }
}

module.exports = router;
