// First-party visitor and signup tracking for the Admin "Traffic & signups"
// report. No third-party scripts: a visitor id cookie (cc_vid) plus where
// they first came from (cc_src) and the latest ?src= / utm_source (cc_last).
//
//   site_visits     one row per new visitor (first touch): source + landing page
//   site_events     one row per visitor per event per day (e.g. signup_view)
//   signup_attempts every signup form submission, verified or not, kept even
//                   after unverified accounts are cleaned up
const crypto = require('crypto');
const db = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS site_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vid TEXT NOT NULL,
  source TEXT NOT NULL,
  landing TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_site_visits_created ON site_visits(created_at);
CREATE TABLE IF NOT EXISTS site_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vid TEXT NOT NULL,
  event TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(vid, event, day)
);
CREATE TABLE IF NOT EXISTS signup_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT 'teacher',
  source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'started', -- started | verified | failed
  error TEXT NOT NULL DEFAULT '',
  notified_at TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_created ON signup_attempts(created_at);
`);

const BOT_UA = /bot|crawl|spider|slurp|preview|headless|monitor|curl|wget|python|axios|httpclient|scan/i;
// Only count visits that land on public pages (not app pages, assets or APIs).
const PRIVATE = /^\/(dashboard|batches|tests|materials|students|classes|reports|question-bank|settings|admin|live|career|papers|c|play|student|parent|login|verify|verify-otp|forgot-password|reset-password|api|go|r|m|magic|institute|upgrade|payments?|omr|internal|unsubscribe|join|embed|widgets|yneet)(\/|$)/;

const cookieVal = (req, name) => {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(req.headers.cookie || '');
  try {
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e) {
    return '';
  }
};

// Turns a raw tag or referring host into a readable channel name.
function channel(tag, host) {
  const t = String(tag || '').toLowerCase();
  if (t) {
    if (/^(fb|facebook)/.test(t)) return 'facebook';
    if (/^(ig|insta)/.test(t)) return 'instagram';
    if (/^(wa|whatsapp)/.test(t)) return 'whatsapp';
    if (/^(yt|youtube)/.test(t)) return 'youtube';
    return t;
  }
  const h = String(host || '').toLowerCase();
  if (!h) return 'direct';
  if (/(^|\.)google\./.test(h)) return 'google';
  if (/bing\.com$|duckduckgo|yahoo\./.test(h)) return 'other search';
  if (/facebook\.com$|fb\.com$|fb\.me$/.test(h)) return 'facebook';
  if (/instagram\.com$/.test(h)) return 'instagram';
  if (/whatsapp\.(com|net)$|wa\.me$/.test(h)) return 'whatsapp';
  if (/youtube\.com$|youtu\.be$/.test(h)) return 'youtube';
  if (/linkedin\.com$|lnkd\.in$/.test(h)) return 'linkedin';
  if (/t\.co$|twitter\.com$|x\.com$/.test(h)) return 'twitter/x';
  if (/chatgpt\.com$|openai\.com$|perplexity\.ai$|claude\.ai$|gemini\.google/.test(h)) return 'ai assistant';
  if (/testmandi\.in$|yneet\.in$|vasulbook\.com$|raiseacademy\.in$/.test(h)) return h.split('.')[0];
  return h;
}

// Express middleware: sets the cookies and logs new visitors.
function middleware(req, res, next) {
  if (req.method !== 'GET') return next();
  const ua = req.get('user-agent') || '';
  if (!ua || BOT_UA.test(ua) || /\.[a-z0-9]{2,5}$/i.test(req.path)) return next();
  const opts = { maxAge: 60 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', secure: req.secure };
  const tag = String(req.query.utm_source || req.query.src || '').replace(/[^\w.\-]/g, '').slice(0, 40);
  let vid = cookieVal(req, 'cc_vid');
  const isPublic = !PRIVATE.test(req.path);

  if (!vid && isPublic) {
    vid = crypto.randomBytes(9).toString('base64url');
    res.cookie('cc_vid', vid, { ...opts, maxAge: 365 * 24 * 60 * 60 * 1000 });
    let host = '';
    try {
      host = new URL(req.get('referer') || '').hostname.replace(/^www\./, '');
      if (/classcoach\.in$/.test(host)) host = '';
    } catch (e) {
      host = '';
    }
    const source = channel(tag, host);
    req.trackSource = source;
    if (!cookieVal(req, 'cc_src')) res.cookie('cc_src', `${source}:${req.path.slice(0, 60)}`, opts);
    const landing = req.path.slice(0, 120);
    res.on('finish', () => {
      if (res.statusCode >= 400) return; // don't count 404s and errors
      try {
        db.prepare('INSERT INTO site_visits (vid, source, landing, device) VALUES (?, ?, ?, ?)').run(vid, source, landing, /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop');
      } catch (e) {
        /* tracking must never break a page */
      }
    });
  }
  if (tag) res.cookie('cc_last', channel(tag), opts);
  req.trackVid = vid;
  next();
}

function firstSource(req) {
  return (cookieVal(req, 'cc_src') || 'unknown').split(':')[0];
}

// Readable "where from" string saved on the teacher and the attempt.
function sourceLabel(req) {
  const first = cookieVal(req, 'cc_src');
  const last = cookieVal(req, 'cc_last');
  return [first || 'unknown', last && !first.startsWith(last + ':') ? `last: ${last}` : ''].filter(Boolean).join(' · ').slice(0, 160);
}

function event(req, name) {
  if (!req.trackVid) return;
  try {
    db.prepare("INSERT OR IGNORE INTO site_events (vid, event, source, day) VALUES (?, ?, ?, date('now'))").run(req.trackVid, name, req.trackSource || firstSource(req));
  } catch (e) {
    /* ignore */
  }
}

function recordAttempt(req, { teacherId = null, name = '', email = '', phone = '', accountType = 'teacher', status = 'started', error = '' }) {
  try {
    return db
      .prepare('INSERT INTO signup_attempts (teacher_id, name, email, phone, account_type, source, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(teacherId, String(name).slice(0, 120), String(email).toLowerCase().trim().slice(0, 160), String(phone).slice(0, 30), accountType, sourceLabel(req), status, String(error).slice(0, 200))
      .lastInsertRowid;
  } catch (e) {
    console.error('Could not record signup attempt:', e.message);
    return null;
  }
}

function markVerified(teacherId, email) {
  db.prepare("UPDATE signup_attempts SET status = 'verified', verified_at = datetime('now') WHERE status != 'verified' AND (teacher_id = ? OR email = ?)").run(
    teacherId,
    String(email || '').toLowerCase()
  );
}

// Report for Admin. days = 7 / 30 / 90.
function report(days = 30) {
  const since = `-${days} days`;
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const src = (s) => String(s || 'unknown').split(':')[0].split(' · ')[0] || 'unknown';

  const bySource = {};
  const row = (s) => (bySource[s] = bySource[s] || { source: s, visitors: 0, signupViews: 0, started: 0, verified: 0, paid: 0 });
  all("SELECT source, COUNT(*) AS n FROM site_visits WHERE created_at > datetime('now', ?) GROUP BY source", since).forEach((r) => (row(r.source).visitors = r.n));
  all("SELECT source, COUNT(*) AS n FROM site_events WHERE event = 'signup_view' AND created_at > datetime('now', ?) GROUP BY source", since).forEach(
    (r) => (row(r.source || 'unknown').signupViews += r.n)
  );
  // One person = one email, even if they submitted the form several times.
  all(
    `SELECT email, (SELECT b.source FROM signup_attempts b WHERE b.email = a.email ORDER BY b.id LIMIT 1) AS source, MAX(status = 'verified') AS verified
     FROM signup_attempts a WHERE status != 'failed' AND created_at > datetime('now', ?) GROUP BY CASE WHEN email = '' THEN id ELSE email END`,
    since
  ).forEach((r) => {
    const x = row(src(r.source));
    x.started += 1;
    if (r.verified) x.verified += 1;
  });
  all("SELECT signup_source, has_purchased FROM teachers WHERE has_purchased = 1 AND created_at > datetime('now', ?)", since).forEach((r) => (row(src(r.signup_source)).paid += 1));
  const sources = Object.values(bySource).sort((a, b) => b.verified - a.verified || b.visitors - a.visitors);

  const daily = all(
    `WITH RECURSIVE d(day) AS (SELECT date('now', ?) UNION ALL SELECT date(day, '+1 day') FROM d WHERE day < date('now'))
     SELECT d.day,
       (SELECT COUNT(*) FROM site_visits v WHERE date(v.created_at) = d.day) AS visitors,
       (SELECT COUNT(*) FROM site_events e WHERE e.event = 'signup_view' AND e.day = d.day) AS signupViews,
       (SELECT COUNT(DISTINCT a.email) FROM signup_attempts a WHERE a.status != 'failed' AND date(a.created_at) = d.day) AS started,
       (SELECT COUNT(DISTINCT a.email) FROM signup_attempts a WHERE a.status = 'verified' AND date(a.created_at) = d.day) AS verified
     FROM d ORDER BY d.day DESC`,
    `-${Math.min(days, 30) - 1} days`
  );

  const landings = all(
    "SELECT landing, COUNT(*) AS n FROM site_visits WHERE created_at > datetime('now', ?) GROUP BY landing ORDER BY n DESC LIMIT 10",
    since
  );
  const devices = all("SELECT device, COUNT(*) AS n FROM site_visits WHERE created_at > datetime('now', ?) GROUP BY device", since);

  const incomplete = all(
    `SELECT * FROM signup_attempts a
     WHERE a.status != 'verified' AND a.created_at > datetime('now', ?)
       AND a.id = (SELECT MAX(b.id) FROM signup_attempts b WHERE (b.email = a.email AND a.email != '') OR b.id = a.id)
       AND NOT EXISTS (SELECT 1 FROM signup_attempts c WHERE c.status = 'verified' AND c.email = a.email AND a.email != '')
     ORDER BY a.id DESC LIMIT 50`,
    since
  );
  const totals = sources.reduce(
    (t, s) => ({ visitors: t.visitors + s.visitors, signupViews: t.signupViews + s.signupViews, started: t.started + s.started, verified: t.verified + s.verified, paid: t.paid + s.paid }),
    { visitors: 0, signupViews: 0, started: 0, verified: 0, paid: 0 }
  );
  return { days, sources, daily, landings, devices, incomplete, totals };
}

module.exports = { middleware, event, recordAttempt, markVerified, sourceLabel, report, channel, cookieVal };
