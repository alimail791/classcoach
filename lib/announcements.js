// One-time product announcement emails to registered teachers. Each announcement
// has an id; every teacher gets it at most once (announcement_sends), so it is safe
// across restarts and redeploys. Same recipients and one-click unsubscribe as the
// weekly blog roundup (teachers.blog_emails_opt_out). Live site only, and only
// between 10 am and 7 pm India time.
// To send a new announcement: add it to ANNOUNCEMENTS with a new id and deploy.
const db = require('./db');
const { signUnsubscribeToken } = require('./unsubscribe');

const APP = () => process.env.APP_URL || process.env.SITE_ORIGIN || 'https://www.classcoach.in';
const FROM = () => process.env.DRIP_FROM || process.env.SMTP_FROM || process.env.RESEND_FROM || 'Akbar from ClassCoach <info@classcoach.in>';
const KEY = () => process.env.RESEND_API_KEY || process.env.SMTP_PASS || '';
const live = () => !!process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
const unsubUrl = (email) => `${APP()}/unsubscribe?email=${encodeURIComponent(email)}&token=${signUnsubscribeToken(email)}`;

db.exec(`CREATE TABLE IF NOT EXISTS announcement_sends (
  announcement TEXT NOT NULL,
  teacher_id INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (announcement, teacher_id)
)`);

const ANNOUNCEMENTS = [
  {
    id: '2026-11-tutor-directory',
    until: '2026-12-10', // don't send to teachers who sign up after this
    skip: (t) => !!t.dir_listed, // already listed
    subject: 'Get new students from classcoach.in — free listing',
    text: (first, email) => `Hi ${first},

Three new things in ClassCoach, all free with your account:

1. Get listed in the tutor directory
Students and parents searching for tutors in your city find your profile on classcoach.in/tutors and join your class in one tap. Teach NEET? Tick one box and you're also listed on YNeet's NEET coaching directory.
Fill it in (2 minutes): ${APP()}/widgets#listing

2. Widgets for your website or Linktree
A "Join my class" button, a free practice quiz from your own test, and a daily NEET question. Copy one line, paste it on your site.
${APP()}/widgets

3. YNeet for your students
Send your students free NEET practice on YNeet, and earn up to 20% commission by introducing coaching centres to YNeet.
${APP()}/yneet

Reply to this email if you'd like help setting up your listing.

Akbar
ClassCoach

---
You get this because you have a ClassCoach account. Unsubscribe: ${unsubUrl(email)}`,
  },
];

function recipients(a) {
  return db
    .prepare(
      `SELECT t.* FROM teachers t
       WHERE t.active = 1 AND t.email_verified = 1 AND t.signup_verified = 1 AND t.blog_emails_opt_out = 0
         AND t.email LIKE '%@%' AND date(t.created_at) <= ?
         AND NOT EXISTS (SELECT 1 FROM announcement_sends s WHERE s.announcement = ? AND s.teacher_id = t.id)`
    )
    .all(a.until, a.id)
    .filter((t) => !(a.skip && a.skip(t)));
}

async function send(to, subject, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM(),
      to: [to],
      reply_to: process.env.DRIP_REPLY_TO || 'info@classcoach.in',
      subject,
      text,
      headers: { 'List-Unsubscribe': `<${unsubUrl(to)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

const istHour = (now) => new Date(now.getTime() + 330 * 60000).getUTCHours();

let running = false;
async function tick(now = new Date(), { force = false } = {}) {
  if (running || !KEY() || (!live() && !force)) return { skipped: true };
  const h = istHour(now);
  if (!force && (h < 10 || h >= 19)) return { skipped: 'outside 10am–7pm IST' };
  running = true;
  const result = {};
  try {
    for (const a of ANNOUNCEMENTS) {
      if (now.toISOString().slice(0, 10) > a.until) continue;
      let sent = 0;
      for (const t of recipients(a)) {
        const first = String(t.name || '').trim().split(/\s+/)[0] || 'there';
        try {
          // Claim first, so a restart mid-run never sends twice.
          db.prepare('INSERT INTO announcement_sends (announcement, teacher_id) VALUES (?, ?)').run(a.id, t.id);
          await send(t.email, a.subject, a.text(first, t.email));
          sent += 1;
        } catch (err) {
          if (!/UNIQUE/.test(err.message)) {
            console.error(`[announce ${a.id}] ${t.email}: ${err.message}`);
            db.prepare('DELETE FROM announcement_sends WHERE announcement = ? AND teacher_id = ?').run(a.id, t.id); // retry next tick
          }
        }
        await new Promise((r) => setTimeout(r, 600)); // Resend rate limit
      }
      if (sent) console.log(`[announce ${a.id}] sent ${sent} email(s)`);
      result[a.id] = sent;
    }
    return result;
  } finally {
    running = false;
  }
}

function startAnnouncements() {
  setTimeout(() => tick().catch((e) => console.error('[announce]', e.message)), 60 * 1000).unref();
  setInterval(() => tick().catch((e) => console.error('[announce]', e.message)), 30 * 60 * 1000).unref();
}

module.exports = { startAnnouncements, tick, recipients, ANNOUNCEMENTS };
