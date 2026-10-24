// Keeps spam bots out of teacher/institute signup without bothering real
// teachers: a signed "form loaded at" token (bots that post straight to
// /signup don't have one, and humans can't fill the form in 2 seconds), a
// hidden honeypot field, a per-IP limit, and a check for random-letter
// names like "VLtdqqnSwheGjYwNXFzf". Unverified signups are also cleaned
// up after a day so they stop holding email addresses.
const crypto = require('crypto');
const db = require('./db');

const SECRET = process.env.SESSION_SECRET || 'classcoach-signup';
const MIN_FILL_MS = 2000;
const MAX_FORM_AGE_MS = 6 * 60 * 60 * 1000;
const IP_LIMIT = 8;
const IP_WINDOW_MS = 60 * 60 * 1000;

const sign = (ts) => crypto.createHmac('sha256', SECRET).update(`signup:${ts}`).digest('hex').slice(0, 20);

function issueFormToken() {
  const ts = Date.now();
  return `${ts}.${sign(ts)}`;
}

function formTokenOk(token) {
  const [tsStr, sig] = String(token || '').split('.');
  const ts = Number(tsStr);
  if (!ts || !sig || sig.length !== 20) return false;
  const expected = sign(ts);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const age = Date.now() - ts;
  return age >= MIN_FILL_MS && age <= MAX_FORM_AGE_MS;
}

// Random strings switch between upper and lower case far more than real
// names do ("McDonald" = 2 switches, "VLtdqqnSwheGjYwNXFzf" = 9, in runs of 1-2).
function looksRandom(text) {
  return String(text || '')
    .split(/\s+/)
    .some((word) => {
      const letters = word.replace(/[^A-Za-z]/g, '');
      if (letters.length < 8) return false;
      let switches = 0;
      for (let i = 1; i < letters.length; i++) {
        const a = letters[i - 1] === letters[i - 1].toUpperCase();
        const b = letters[i] === letters[i].toUpperCase();
        if (a !== b) switches++;
      }
      // camelCase names ("SmartKidsAcademy") keep lowercase runs of 3+
      // letters; random strings have many 1-2 letter lowercase runs.
      const shortLower = (letters.match(/[a-z]+/g) || []).filter((r) => r.length <= 2).length;
      return switches >= 5 && shortLower >= 3;
    });
}

const hits = new Map();
function ipAllowed(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  if (list.length >= IP_LIMIT) {
    hits.set(ip, list);
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return true;
}

// Returns null when the signup looks human, or a reason string for logs.
function checkSignup(req) {
  const b = req.body || {};
  if (b.website) return 'honeypot';
  if (!formTokenOk(b.ft)) return 'form-token';
  if (looksRandom(b.name) || looksRandom(b.institute_name)) return 'random-name';
  if (!ipAllowed(req.ip || 'unknown')) return 'ip-limit';
  return null;
}

let lastCleanup = 0;
function cleanupUnverified() {
  if (Date.now() - lastCleanup < 60 * 60 * 1000) return;
  lastCleanup = Date.now();
  const stale = db
    .prepare("SELECT id FROM teachers WHERE signup_verified = 0 AND has_purchased = 0 AND created_at < datetime('now', '-1 day')")
    .all();
  for (const { id } of stale) {
    try {
      db.prepare('UPDATE teachers SET institute_id = NULL WHERE id = ?').run(id);
      db.prepare('DELETE FROM institutes WHERE owner_teacher_id = ? AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.institute_id = institutes.id)').run(id);
      db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
    } catch (err) {
      console.error('Unverified signup cleanup skipped teacher', id, err.message);
    }
  }
  if (stale.length) console.log(`[Signup cleanup] Removed ${stale.length} unverified signup(s) older than a day`);
}

module.exports = { issueFormToken, checkSignup, cleanupUnverified, looksRandom };
