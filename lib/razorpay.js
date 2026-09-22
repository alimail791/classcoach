const crypto = require('crypto');
const Razorpay = require('razorpay');

function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

let client = null;
function getClient() {
  if (!isConfigured()) {
    throw new Error('Payments are not configured yet — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.');
  }
  if (!client) {
    client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return client;
}

// amountPaise: the charge in paise (₹1 = 100 paise) — Razorpay always
// works in the smallest currency unit.
async function createOrder({ amountPaise, receipt, notes }) {
  const order = await getClient().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes
  });
  return order;
}

// Verifies the signature Razorpay's checkout returns to the browser after
// a successful payment (HMAC-SHA256 of "order_id|payment_id" using your
// key secret). This is what stops someone from faking a "success" callback
// without actually having paid.
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

// Verifies a Razorpay webhook's signature (separate secret, set when you
// configure the webhook URL in the Razorpay dashboard). This is the
// reliable backstop path — it fires server-to-server even if the
// customer's browser closes right after paying, before the client-side
// callback above would have run.
function verifyWebhookSignature(rawBody, signature) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return expected === signature;
}

module.exports = { isConfigured, createOrder, verifyPaymentSignature, verifyWebhookSignature };
