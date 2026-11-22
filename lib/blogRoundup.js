// Weekly "new on the ClassCoach blog" email to registered teachers. Every
// Monday from 10 am India time it sends one email listing the articles
// published since the last roundup. No new articles → no email. Teachers can
// unsubscribe in one click (List-Unsubscribe + link), which sets
// teachers.blog_emails_opt_out. Runs on the live site only.
const db = require('./db');
const { signUnsubscribeToken } = require('./unsubscribe');

const APP = () => process.env.APP_URL || process.env.SITE_ORIGIN || 'https://www.classcoach.in';
const FROM = () => process.env.DRIP_FROM || process.env.SMTP_FROM || process.env.RESEND_FROM || 'Akbar from ClassCoach <info@classcoach.in>';
const KEY = () => process.env.RESEND_API_KEY || process.env.SMTP_PASS || '';
const META_KEY = 'blog_roundup_last_sent';
const unsubUrl = (email) => `${APP()}/unsubscribe?email=${encodeURIComponent(email)}&token=${signUnsubscribeToken(email)}`;
const live = () => !!process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';

// This week's Monday 10:00 India time, as a UTC Date.
function thisWeeksSlot(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000);
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  const monday = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysSinceMonday, 10, 0);
  return new Date(monday - 330 * 60000);
}

function lastSent() {
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(META_KEY);
  return row ? row.value : null;
}
function markSent(iso) {
  db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(META_KEY, iso);
}

function postsSince(iso, now = new Date()) {
  return db
    .prepare("SELECT slug, title, meta_description FROM blog_posts WHERE status = 'published' AND published_at > ? AND published_at <= ? ORDER BY published_at ASC")
    .all(iso, now.toISOString());
}

function recipients() {
  return db
    .prepare(
      `SELECT name, email FROM teachers
       WHERE active = 1 AND email_verified = 1 AND signup_verified = 1 AND blog_emails_opt_out = 0
         AND email LIKE '%@%'`
    )
    .all();
}

function emailText(name, posts, email) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const list = posts
    .map((p) => `• ${p.title}\n  ${p.meta_description ? p.meta_description + '\n  ' : ''}${APP()}/blog/${p.slug}`)
    .join('\n\n');
  return `Hi ${first},

${posts.length === 1 ? 'Here is the new guide' : `Here are the ${posts.length} new guides`} on the ClassCoach blog this week:

${list}

Each one shows how to do it inside ClassCoach, step by step.

Akbar
ClassCoach

---
You get this weekly email because you have a ClassCoach account. Unsubscribe: ${unsubUrl(email)}`;
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
      headers: { 'List-Unsubscribe': `<${unsubUrl(to)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

let running = false;
async function tick(now = new Date(), { force = false } = {}) {
  if (running || !KEY() || (!live() && !force)) return { skipped: true };
  const slot = thisWeeksSlot(now);
  if (now < slot) return { skipped: 'before Monday 10am' };
  const prev = lastSent();
  // First run ever: just record a starting point, so the first roundup covers
  // only articles published from now on (never old posts).
  if (!prev) {
    markSent(now.toISOString());
    return { skipped: 'first run, starting point recorded' };
  }
  if (new Date(prev) >= slot) return { skipped: 'already sent this week' };
  running = true;
  try {
    const posts = postsSince(prev, now);
    if (!posts.length) {
      markSent(now.toISOString());
      return { sent: 0, posts: 0 };
    }
    const subject = posts.length === 1 ? `New on ClassCoach: ${posts[0].title}` : `${posts.length} new teaching guides from ClassCoach`;
    let sent = 0;
    for (const t of recipients()) {
      try {
        await send(t.email, subject, emailText(t.name, posts, t.email));
        sent += 1;
      } catch (err) {
        console.error(`[blog roundup] ${t.email}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 600)); // stay under Resend's rate limit
    }
    markSent(now.toISOString());
    console.log(`[blog roundup] sent ${sent} email(s) about ${posts.length} post(s)`);
    return { sent, posts: posts.length };
  } finally {
    running = false;
  }
}

function startBlogRoundup() {
  const run = () => tick().catch((err) => console.error('[blog roundup] failed:', err.message));
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, 30 * 60 * 1000).unref();
}

module.exports = { startBlogRoundup, tick, thisWeeksSlot, emailText };
