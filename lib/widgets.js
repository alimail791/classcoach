// Website widgets tutors (and anyone) can embed with one <iframe> line.
// Each one carries a "Powered by ClassCoach" link back to classcoach.in.
//   join:<batch id>  — "Join my class" card → /join/<code>
//   quiz:<test id>   — a published MCQ test as a public practice quiz (teacher opts in)
//   qotd             — daily NEET-level Physics / Chemistry / Biology question from the bank
const crypto = require('crypto');
const db = require('./db');

const SITE = process.env.SITE_ORIGIN || 'https://www.classcoach.in';
const SUBJECTS = ['Physics', 'Chemistry', 'Biology'];

const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // IST date

function count(key) {
  try {
    db.prepare('INSERT INTO widget_views (key, day, views) VALUES (?, ?, 1) ON CONFLICT(key, day) DO UPDATE SET views = views + 1').run(key, today());
  } catch (e) {
    /* counting is best-effort */
  }
}

// Views in the last `days` days, for many keys at once → { key: n }
function viewsFor(keys, days = 30) {
  if (!keys.length) return {};
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const rows = db
    .prepare(`SELECT key, SUM(views) AS n FROM widget_views WHERE day >= ? AND key IN (${keys.map(() => '?').join(',')}) GROUP BY key`)
    .all(since, ...keys);
  return Object.fromEntries(rows.map((r) => [r.key, r.n]));
}

const newToken = () => crypto.randomBytes(8).toString('base64url');

// Same question for everyone on a given day (per subject), changes at midnight IST.
function questionOfTheDay(subject, day = today()) {
  const sub = SUBJECTS.includes(subject) ? subject : SUBJECTS[parseInt(crypto.createHash('md5').update(day).digest('hex').slice(0, 6), 16) % 3];
  const total = db.prepare('SELECT COUNT(*) AS n FROM bank_questions WHERE subject = ?').get(sub).n;
  if (!total) return null;
  const idx = parseInt(crypto.createHash('md5').update(`${day}:${sub}`).digest('hex').slice(0, 8), 16) % total;
  const q = db.prepare('SELECT * FROM bank_questions WHERE subject = ? ORDER BY id LIMIT 1 OFFSET ?').get(sub, idx);
  if (!q) return null;
  let options = [];
  try { options = JSON.parse(q.options_json); } catch (e) { /* ignore */ }
  return { day, subject: sub, chapter: q.chapter, text: q.text, options, correct: q.correct_index, explanation: q.explanation || '', pyq: !!q.is_pyq };
}

const iframe = (src, height) =>
  `<iframe src="${src}" width="100%" height="${height}" style="border:0;max-width:520px;border-radius:12px;" loading="lazy" title="ClassCoach widget"></iframe>`;

const poweredBy = (medium) => `${SITE}/?utm_source=widget&utm_medium=${medium}`;

module.exports = { SITE, SUBJECTS, count, viewsFor, newToken, questionOfTheDay, iframe, poweredBy, today };
