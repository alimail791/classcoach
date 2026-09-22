const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { PLANS, getPlan, applyPurchasedPlan } = require('../lib/plans');
const razorpay = require('../lib/razorpay');
const { markPurchasedAndCheckReferral } = require('../lib/referrals');
const { notify } = require('../lib/notifications');
const mailer = require('../lib/mailer');

const router = express.Router();

const PAID_PLANS = Object.values(PLANS).filter((p) => p.id !== 'trial');

router.get('/upgrade', requireTeacher, (req, res) => {
  res.render('upgrade', {
    teacher: req.teacher,
    plans: PAID_PLANS,
    razorpayConfigured: razorpay.isConfigured(),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    error: req.query.error || null,
    upgraded: req.query.upgraded || null
  });
});

router.post('/upgrade/create-order', requireTeacher, express.json(), async (req, res) => {
  if (!razorpay.isConfigured()) {
    return res.status(400).json({ error: 'Payments are not configured yet. Ask your admin to add Razorpay keys to .env.' });
  }
  const plan = getPlan(req.body.plan_id);
  if (!plan || plan.id === 'trial') {
    return res.status(400).json({ error: 'Invalid plan selected.' });
  }

  try {
    const order = await razorpay.createOrder({
      amountPaise: plan.price * 100,
      receipt: `teacher_${req.teacher.id}_${plan.id}_${Date.now()}`,
      notes: { teacher_id: String(req.teacher.id), plan_id: plan.id }
    });

    db.prepare(
      'INSERT INTO payments (teacher_id, plan_id, amount, currency, razorpay_order_id, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.teacher.id, plan.id, order.amount, order.currency, order.id, 'created');

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planName: plan.name,
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
  res.json({ success: true });
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
  applyPurchasedPlan(db, payment.teacher_id, payment.plan_id);
  markPurchasedAndCheckReferral(payment.teacher_id);

  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(payment.teacher_id);
  const plan = getPlan(payment.plan_id);
  const message = `Payment received — you're now on the ${plan.name} plan (${plan.max_students} students, ${plan.ai_limit_monthly} AI generations/month) for the next ${plan.duration_months} months.`;
  notify('teacher', teacher.id, message, 'ClassCoach');
  if (mailer.isConfigured()) {
    mailer
      .sendPlainEmail({ to: teacher.email, subject: 'Payment received — plan upgraded', text: `Hi ${teacher.name},\n\n${message}\n\n— ClassCoach` })
      .catch((err) => console.error('Payment confirmation email failed:', err.message));
  }
}

module.exports = router;
