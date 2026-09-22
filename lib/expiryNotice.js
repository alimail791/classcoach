const db = require('./db');
const { daysUntil, getPlan } = require('./plans');
const { notify } = require('./notifications');
const mailer = require('./mailer');

const WARNING_WINDOW_DAYS = 7;

// Called on teacher dashboard load. Sends at most one notice per distinct
// expiry date — tracked via last_expiry_notified_for — so it doesn't spam
// a notification/email on every single page load while a plan is expiring
// or has expired. Renewing (which changes plan_expires_at) naturally
// re-arms this for the next time it approaches expiry.
function checkAndSendExpiryNotice(teacher) {
  if (!teacher.plan_expires_at) return; // no expiry set — nothing to warn about
  const days = daysUntil(teacher.plan_expires_at);
  const withinWarningWindow = days <= WARNING_WINDOW_DAYS; // covers "expiring soon" and "already expired"
  if (!withinWarningWindow) return;
  if (teacher.last_expiry_notified_for === teacher.plan_expires_at) return; // already notified for this exact expiry

  const planName = (getPlan(teacher.plan) || {}).name || teacher.plan;
  const message =
    days < 0
      ? `Your ${planName} plan expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago. No new students can be added and AI generation is paused until it's renewed.`
      : `Your ${planName} plan expires in ${days} day${days === 1 ? '' : 's'}. Contact your admin to renew if you'd like to keep growing past your current limits.`;

  notify('teacher', teacher.id, message, 'ClassCoach');

  if (mailer.isConfigured()) {
    mailer
      .sendPlainEmail({
        to: teacher.email,
        subject: days < 0 ? 'Your ClassCoach plan has expired' : 'Your ClassCoach plan is expiring soon',
        text: `Hi ${teacher.name},\n\n${message}\n\n— ClassCoach`
      })
      .catch((err) => console.error('Expiry notice email failed:', err.message));
  }

  db.prepare('UPDATE teachers SET last_expiry_notified_for = ? WHERE id = ?').run(teacher.plan_expires_at, teacher.id);
}

module.exports = { checkAndSendExpiryNotice };
