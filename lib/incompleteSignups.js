// Emails the owner about people who started a ClassCoach signup but didn't
// finish it (never entered the email OTP, or hit an error), so they can be
// followed up on WhatsApp the same day. Checks every 10 minutes; each
// person is reported once, 15+ minutes after they gave up.
const db = require('./db');
const mailer = require('./mailer');
const { buildWhatsAppLink } = require('./whatsapp');

const TO = () => process.env.INCOMPLETE_SIGNUP_EMAIL || 'alimail791@gmail.com';
const SITE = () => process.env.SITE_ORIGIN || 'https://www.classcoach.in';

function pending() {
  const rows = db
    .prepare(
      `SELECT * FROM signup_attempts
       WHERE status != 'verified' AND notified_at IS NULL
         AND created_at < datetime('now', '-15 minutes') AND created_at > datetime('now', '-2 days')
       ORDER BY id`
    )
    .all();
  // One line per person: skip anyone who has since verified, and keep only
  // their latest attempt.
  const byKey = new Map();
  rows.forEach((r) => {
    const key = r.email || r.phone;
    if (!key) return;
    const done = db.prepare("SELECT 1 FROM signup_attempts WHERE status = 'verified' AND email = ? AND email != ''").get(r.email);
    if (done) return;
    byKey.set(key, r);
  });
  return { rows, people: [...byKey.values()] };
}

async function run() {
  if (!mailer.isConfigured()) return;
  const { rows, people } = pending();
  if (!rows.length) return;
  const markAll = () => {
    const stmt = db.prepare("UPDATE signup_attempts SET notified_at = datetime('now') WHERE id = ?");
    rows.forEach((r) => stmt.run(r.id));
  };
  if (!people.length) return markAll();

  const ist = (t) => new Date(String(t).replace(' ', 'T') + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const lines = people.map((p, i) => {
    const msg = `Hi ${p.name || ''}, this is Akbar from ClassCoach. I saw you started signing up but couldn't finish. Can I help you set it up? It's free for 1 month.`;
    return [
      `${i + 1}. ${p.name || '(no name)'}${p.account_type === 'institute' ? ' (institute)' : ''}`,
      `   Email: ${p.email || '-'}`,
      `   Phone: ${p.phone || '-'}`,
      `   Status: ${p.status === 'failed' ? `got an error: "${p.error}"` : 'did not enter the email OTP'}`,
      `   Came from: ${p.source || 'unknown'}`,
      `   When: ${ist(p.created_at)}`,
      p.phone ? `   WhatsApp them: ${buildWhatsAppLink(p.phone, msg)}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  });
  const text = [
    `${people.length} ${people.length === 1 ? 'person' : 'people'} started a ClassCoach signup but did not finish:`,
    '',
    lines.join('\n\n'),
    '',
    `Full report: ${SITE()}/admin#traffic`
  ].join('\n');
  try {
    await mailer.sendPlainEmail({ to: TO(), subject: `ClassCoach: ${people.length} incomplete signup${people.length === 1 ? '' : 's'} to follow up`, text });
    markAll();
    console.log(`[Incomplete signups] Emailed ${people.length} to ${TO()}`);
  } catch (err) {
    console.error('[Incomplete signups] Email failed:', err.message);
  }
}

function startIncompleteSignupAlerts() {
  setTimeout(() => run().catch(() => {}), 60 * 1000).unref();
  setInterval(() => run().catch(() => {}), 10 * 60 * 1000).unref();
}

module.exports = { startIncompleteSignupAlerts, run, pending };
