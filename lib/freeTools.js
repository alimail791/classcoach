// Free, no-login tools for teachers (routes/freeTools.js). They exist to
// bring tutors to ClassCoach from Google: each one does a useful job for
// free and then invites the teacher to sign up to save, edit and grade.
//
// The AI tool is protected by a signed "form loaded at" token, a honeypot,
// a per-visitor daily limit and a site-wide daily cap, so bots can't run up
// the AI bill.
const crypto = require('crypto');
const db = require('./db');

const SECRET = process.env.SESSION_SECRET || 'classcoach-free-tools';
const PER_VISITOR_PER_DAY = parseInt(process.env.FREE_PAPER_PER_DAY, 10) || 3;
const SITE_CAP_PER_DAY = parseInt(process.env.FREE_PAPER_DAILY_CAP, 10) || 150;

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati'];
const LIMITS = { mcq: 15, short: 5, long: 3 };

const sign = (ts) => crypto.createHmac('sha256', SECRET).update(`free:${ts}`).digest('hex').slice(0, 20);
function issueToken() {
  const ts = Date.now();
  return `${ts}.${sign(ts)}`;
}
function tokenOk(token) {
  const [tsStr, sig] = String(token || '').split('.');
  const ts = Number(tsStr);
  if (!ts || !sig || sig.length !== 20) return false;
  const expected = sign(ts);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const age = Date.now() - ts;
  return age >= 3000 && age <= 6 * 60 * 60 * 1000;
}

const ipHash = (ip) => crypto.createHash('sha256').update(`${SECRET}:${ip || 'unknown'}`).digest('hex').slice(0, 24);

// Returns null if allowed, or a message for the visitor.
function checkAllowed(tool, ip) {
  const visitor = db
    .prepare("SELECT COUNT(*) AS c FROM free_tool_uses WHERE tool = ? AND ip_hash = ? AND created_at > datetime('now', '-1 day')")
    .get(tool, ipHash(ip)).c;
  if (visitor >= PER_VISITOR_PER_DAY) {
    return `You've made ${PER_VISITOR_PER_DAY} free papers today. Create a free ClassCoach account to keep going. It's free for 1 month, no card needed.`;
  }
  const site = db.prepare("SELECT COUNT(*) AS c FROM free_tool_uses WHERE tool = ? AND created_at > datetime('now', '-1 day')").get(tool).c;
  if (site >= SITE_CAP_PER_DAY) {
    return 'The free generator is very busy today. Create a free ClassCoach account to make papers right away. It\'s free for 1 month, no card needed.';
  }
  return null;
}

function recordUse(tool, ip) {
  db.prepare('INSERT INTO free_tool_uses (tool, ip_hash) VALUES (?, ?)').run(tool, ipHash(ip));
}

function savePaper(header, sections) {
  const token = crypto.randomBytes(9).toString('base64url');
  db.prepare('INSERT INTO free_papers (token, header_json, sections_json) VALUES (?, ?, ?)').run(token, JSON.stringify(header), JSON.stringify(sections));
  // Keep the table small: free papers live for 30 days.
  db.prepare("DELETE FROM free_papers WHERE created_at < datetime('now', '-30 days')").run();
  db.prepare("DELETE FROM free_tool_uses WHERE created_at < datetime('now', '-30 days')").run();
  return token;
}

function getPaper(token) {
  const p = db.prepare('SELECT * FROM free_papers WHERE token = ?').get(String(token || ''));
  if (!p) return null;
  // Shape it like a saved paper so lib/papers.setView and views/paper_print work unchanged.
  const header = JSON.parse(p.header_json);
  const title = [header.exam, header.className && `Class ${header.className}`, header.subject].filter(Boolean).join(' · ');
  return { ...p, id: 0, title, header, sets: 1, seed: 1 };
}

function stats() {
  const one = (sql) => db.prepare(sql).get().c;
  return {
    today: one("SELECT COUNT(*) AS c FROM free_tool_uses WHERE created_at > datetime('now', '-1 day')"),
    week: one("SELECT COUNT(*) AS c FROM free_tool_uses WHERE created_at > datetime('now', '-7 days')")
  };
}

module.exports = { LANGUAGES, LIMITS, PER_VISITOR_PER_DAY, issueToken, tokenOk, checkAllowed, recordUse, savePaper, getPaper, stats };
