// Automatic follow-up email sequence for the tutor leads in email_leads
// (imported by broadcast.js or from Admin). Runs inside the server, so
// nobody has to run a script every day.
//
// - Starts PAUSED. The owner previews the emails in Admin, sends a test to
//   himself, and presses Start (stored in app_meta 'drip_enabled').
// - Sends only 9am–7pm India time, in small batches, up to DRIP_DAILY_CAP
//   per day (default 70, leaving room under Resend's free 100/day for OTP
//   and alert emails).
// - Skips anyone who unsubscribed, whose earlier email failed, or who has
//   already signed up as a teacher. Each step waits GAP days after the
//   previous one. One-click unsubscribe link + List-Unsubscribe header.
const db = require('./db');
const { signUnsubscribeToken } = require('./unsubscribe');

db.exec(`
CREATE TABLE IF NOT EXISTS email_drip (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES email_leads(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- sent | failed
  error TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(lead_id, step)
);
CREATE INDEX IF NOT EXISTS idx_email_drip_sent ON email_drip(sent_at);
`);

const APP = () => process.env.APP_URL || process.env.SITE_ORIGIN || 'https://www.classcoach.in';
const FROM = () => process.env.DRIP_FROM || process.env.SMTP_FROM || process.env.RESEND_FROM || 'Akbar from ClassCoach <info@classcoach.in>';
const KEY = () => process.env.RESEND_API_KEY || process.env.SMTP_PASS || '';
const DAILY_CAP = () => parseInt(process.env.DRIP_DAILY_CAP, 10) || 70;
const PER_TICK = 12;

const link = (path, step) => {
  const [p, hash] = path.split('#');
  return `${APP()}${p}${p.includes('?') ? '&' : '?'}utm_source=email&utm_campaign=drip${step}${hash ? '#' + hash : ''}`;
};
const hi = (name) => (name ? `Hi ${String(name).split(' ')[0]},` : 'Hi,');

// gapDays = days after the previous step (step 1 = the first broadcast email, if they got it).
const STEPS = [
  {
    step: 2,
    gapDays: 0,
    subject: 'Make a question paper in 1 minute (free, no login)',
    body: (name) => `${hi(name)}

Quick one: we've built a free question paper generator for teachers.

Type the class, subject and chapters, and in about a minute you get a printable paper with MCQs, short and long answer questions, plus an answer key. It works in English, Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, Bengali and Gujarati.

No login, no payment:
${link('/free-question-paper-generator', 2)}

Need OMR answer sheets for the same test? Also free:
${link('/free-omr-sheet-generator', 2)}

— Akbar, ClassCoach`
  },
  {
    step: 3,
    gapDays: 4,
    subject: 'Stop correcting MCQ papers by hand',
    body: (name) => `${hi(name)}

When your students take a test on ClassCoach (on any phone, no app to install):

- MCQs are marked the moment they submit
- you see each student's weak chapters, not just a total
- parents get the result on WhatsApp in one tap

See it in 90 seconds:
${link('/#demo', 3)}

It's free for 1 month, no card needed:
${link('/signup?src=email3', 3)}

— Akbar, ClassCoach`
  },
  {
    step: 4,
    gapDays: 7,
    subject: 'Can I set it up for you?',
    body: (name) => `${hi(name)}

Akbar here, founder of ClassCoach.

If you'd like to try it but don't have time to set it up, reply with your class and subject and I'll create your first test for you. Or message me on WhatsApp: https://wa.me/919443424064

If it's not for you, no problem at all. This is my last email about it.

— Akbar
ClassCoach · ${APP().replace(/^https?:\/\//, '')}`
  }
];

const footer = (email) =>
  `\n\n---\nYou're receiving this because you're a teacher or coaching centre we thought ClassCoach might help.\nUnsubscribe: ${unsubUrl(email)}`;
const unsubUrl = (email) => `${APP()}/unsubscribe?email=${encodeURIComponent(email)}&token=${signUnsubscribeToken(email)}`;

function meta(key, value) {
  if (value === undefined) {
    const r = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
    return r ? r.value : null;
  }
  db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}
const isEnabled = () => meta('drip_enabled') === '1';
const setEnabled = (on) => meta('drip_enabled', on ? '1' : '0');

// Leads due for a given step right now.
function dueFor(s, limit) {
  const prev = s.step - 1;
  const prevSent =
    prev === 1
      ? '1' // step 2 goes to everyone still eligible, whether or not they got the first broadcast
      : `EXISTS (SELECT 1 FROM email_drip d WHERE d.lead_id = l.id AND d.step = ${prev} AND d.status = 'sent' AND d.sent_at <= datetime('now', '-${s.gapDays} days'))`;
  return db
    .prepare(
      `SELECT l.* FROM email_leads l
       WHERE l.campaign = 'tutors' AND l.status IN ('pending', 'sent')
         AND ${prevSent}
         AND NOT EXISTS (SELECT 1 FROM email_drip d WHERE d.lead_id = l.id AND d.step = ?)
         AND NOT EXISTS (SELECT 1 FROM email_drip d WHERE d.lead_id = l.id AND d.status = 'failed')
         AND NOT EXISTS (SELECT 1 FROM teachers t WHERE lower(t.email) = lower(l.email))
       ORDER BY l.id LIMIT ?`
    )
    .all(s.step, limit);
}

async function send(to, subject, text) {
  if (!KEY()) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM(),
      to: [to],
      reply_to: process.env.DRIP_REPLY_TO || 'info@classcoach.in',
      subject,
      text,
      headers: { 'List-Unsubscribe': `<${unsubUrl(to)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    })
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      if (b && b.message) message = b.message;
    } catch (e) {
      /* keep generic */
    }
    throw new Error(message);
  }
}

const sentToday = () => db.prepare("SELECT COUNT(*) AS c FROM email_drip WHERE sent_at > datetime('now', 'start of day')").get().c;
const istHour = () => Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })) % 24;

let running = false;
async function tick() {
  if (running || !isEnabled() || !KEY()) return;
  const h = istHour();
  if (h < 9 || h >= 19) return;
  running = true;
  try {
    let budget = Math.min(PER_TICK, DAILY_CAP() - sentToday());
    // Later steps first, so people already in the sequence keep their rhythm.
    for (const s of [...STEPS].reverse()) {
      if (budget <= 0) break;
      for (const lead of dueFor(s, budget)) {
        try {
          await send(lead.email, s.subject, s.body(lead.name) + footer(lead.email));
          db.prepare('INSERT OR IGNORE INTO email_drip (lead_id, step) VALUES (?, ?)').run(lead.id, s.step);
        } catch (err) {
          db.prepare("INSERT OR IGNORE INTO email_drip (lead_id, step, status, error) VALUES (?, ?, 'failed', ?)").run(lead.id, s.step, err.message.slice(0, 200));
          console.error(`[Drip] step ${s.step} to ${lead.email} failed: ${err.message}`);
        }
        budget -= 1;
        await new Promise((r) => setTimeout(r, 700)); // Resend: max 2 requests/second
      }
    }
  } finally {
    running = false;
  }
}

function startDrip() {
  setInterval(() => tick().catch((e) => console.error('[Drip]', e.message)), 20 * 60 * 1000).unref();
  setTimeout(() => tick().catch(() => {}), 2 * 60 * 1000).unref();
}

async function sendTest(to) {
  for (const s of STEPS) await send(to, `[TEST] ${s.subject}`, s.body('Akbar') + footer(to));
}

function importCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { added: 0, skipped: 0 };
  const cells = (l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
  const head = cells(lines[0]).map((h) => h.toLowerCase());
  let emailCol = head.findIndex((h) => h.includes('email'));
  let nameCol = head.findIndex((h) => h.includes('name'));
  let rows = lines.slice(1);
  if (emailCol === -1) {
    // No header: treat each line as "email" or "name,email" / "email,name".
    rows = lines;
    emailCol = -2;
    nameCol = -1;
  }
  const ins = db.prepare("INSERT INTO email_leads (email, name, campaign) VALUES (?, ?, 'tutors') ON CONFLICT(email) DO NOTHING");
  let added = 0;
  let skipped = 0;
  rows.forEach((l) => {
    const c = cells(l);
    const email = (emailCol === -2 ? c.find((x) => x.includes('@')) : c[emailCol]) || '';
    const name = emailCol === -2 ? c.find((x) => x && !x.includes('@')) || '' : nameCol >= 0 ? c[nameCol] || '' : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (skipped += 1);
    if (ins.run(email.toLowerCase(), name.slice(0, 80)).changes) added += 1;
    else skipped += 1;
  });
  return { added, skipped };
}

function stats() {
  const one = (sql, ...p) => db.prepare(sql).get(...p).c;
  const leads = db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(status = 'unsubscribed') AS unsubscribed,
        SUM(status IN ('pending', 'sent')) AS eligible,
        SUM(EXISTS (SELECT 1 FROM teachers t WHERE lower(t.email) = lower(email_leads.email))) AS signedUp
       FROM email_leads WHERE campaign = 'tutors'`
    )
    .get();
  return {
    enabled: isEnabled(),
    configured: !!KEY(),
    dailyCap: DAILY_CAP(),
    sentToday: sentToday(),
    leads,
    steps: STEPS.map((s) => ({
      step: s.step,
      gapDays: s.gapDays,
      subject: s.subject,
      preview: s.body('Priya') + footer('priya@example.com'),
      sent: one("SELECT COUNT(*) AS c FROM email_drip WHERE step = ? AND status = 'sent'", s.step),
      failed: one("SELECT COUNT(*) AS c FROM email_drip WHERE step = ? AND status = 'failed'", s.step),
      dueNow: dueFor(s, 100000).length
    }))
  };
}

module.exports = { STEPS, startDrip, tick, sendTest, setEnabled, isEnabled, stats, importCsv, dueFor };
