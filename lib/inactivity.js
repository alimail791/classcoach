const db = require('./db');
const mailer = require('./mailer');
const { daysUntil, getPlan } = require('./plans');

const INACTIVE_AFTER_DAYS = 5;
const MAX_PER_RUN = 50;

function appUrl() {
  return (process.env.APP_URL || 'https://www.classcoach.in').replace(/\/$/, '');
}

// Emails teachers who haven't been seen for 5+ days — once per absence.
// last_inactivity_email_at < last_active_at means "we haven't emailed since
// they were last here", so coming back and then drifting away again re-arms
// it, while someone who never returns gets exactly one email, not a drip.
// Runs on a timer (see server.js) because an absent teacher by definition
// never triggers a page-load check.
async function sendInactivityReminders() {
  if (!mailer.isConfigured()) return 0;
  const cutoff = new Date(Date.now() - INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const due = db
    .prepare(
      `SELECT * FROM teachers
       WHERE active = 1 AND signup_verified = 1
         AND last_active_at IS NOT NULL AND last_active_at <= ?
         AND (last_inactivity_email_at IS NULL OR last_inactivity_email_at < last_active_at)
       LIMIT ?`
    )
    .all(cutoff, MAX_PER_RUN);

  let sent = 0;
  for (const t of due) {
    try {
      const days = Math.floor((Date.now() - new Date(t.last_active_at).getTime()) / (24 * 60 * 60 * 1000));
      const left = daysUntil(t.plan_expires_at);
      const planName = (getPlan(t.plan) || {}).name || t.plan;
      const planLine =
        left === null
          ? ''
          : left < 0
            ? `\nYour ${planName} plan has expired — renew any time to unlock AI test generation again.\n`
            : `\nYour ${planName} plan has ${left} day${left === 1 ? '' : 's'} left — make the most of it.\n`;
      const text = [
        `Hi ${t.name},`,
        '',
        `We haven't seen you on ClassCoach for ${days} days. Your classes and students are exactly as you left them.`,
        planLine,
        'A quick way back in: generate a test from your next chapter, and the weak-chapter report will update the moment students submit.',
        '',
        `Log in: ${appUrl()}/login`,
        '',
        `Tip: refer 2 teachers who buy a plan and you get 3 months free — your link is on your dashboard.`,
        '',
        'Questions? Reply to info@classcoach.in or WhatsApp +91 94434 24064.',
        '',
        '— ClassCoach'
      ].join('\n');
      await mailer.sendPlainEmail({ to: t.email, subject: 'Your ClassCoach classes are waiting', text });
      db.prepare('UPDATE teachers SET last_inactivity_email_at = ? WHERE id = ?').run(new Date().toISOString(), t.id);
      sent += 1;
    } catch (err) {
      console.error(`Inactivity email failed for teacher ${t.id}:`, err.message);
    }
  }
  return sent;
}

function startInactivityScheduler() {
  const run = () => sendInactivityReminders().catch((err) => console.error('Inactivity job failed:', err.message));
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}

module.exports = { sendInactivityReminders, startInactivityScheduler, INACTIVE_AFTER_DAYS };
