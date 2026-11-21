// Daily ClassCoach promo Reels → Instagram (Instagram API with Instagram Login).
// shorts-bot/ (GitHub Actions) renders one promo video a day and PUTs it to
// /api/instagram-reels/upload; this stores it next to the database and, every
// 5 minutes, posts any Reel whose time has come: create a container from the
// public video URL, wait until Instagram has processed it, publish.
//
// Railway variables:
//   PROMO_UPLOAD_KEY  shared secret with the GitHub workflow (required)
//   IG_ACCESS_TOKEN   ClassCoach Instagram account's token. "IG…" (Instagram Login, 60 days,
//                     refreshed weekly here) → graph.instagram.com; "EAA…" (Facebook system-user
//                     token) → graph.facebook.com, also set IG_USER_ID.
//   IG_USER_ID, PUBLIC_URL (default https://www.classcoach.in) optional.
const fs = require('fs');
const path = require('path');
const db = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS insta_reels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rkey TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  file TEXT NOT NULL DEFAULT '',
  publish_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  container_id TEXT NOT NULL DEFAULT '',
  media_id TEXT NOT NULL DEFAULT '',
  permalink TEXT NOT NULL DEFAULT '',
  youtube_id TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  posted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ig_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token TEXT NOT NULL,
  from_env TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  refreshed_at TEXT NOT NULL
);
`);

// Videos live beside the database, so on Railway they sit on the same Volume.
const DIR = path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, '..', 'classcoach.sqlite')), 'reels');
const TICK_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const LATE_MS = 3 * 3600 * 1000; // first seen this long after its time → skip rather than flood

const fbToken = (t) => /^EAA/.test(t || '');
const graphFor = (t) => (fbToken(t) ? 'https://graph.facebook.com/v21.0' : 'https://graph.instagram.com/v21.0');
const publicBase = () => (process.env.PUBLIC_URL || 'https://www.classcoach.in').replace(/\/$/, '');
const igConfigured = () => !!process.env.IG_ACCESS_TOKEN;
const videoUrl = (r) => `${publicBase()}/api/instagram-reels/video/${r.id}.mp4`;
const videoPath = (name) => path.join(DIR, path.basename(name));

async function ig(p, { method = 'GET', token, body } = {}) {
  const url = new URL(p.startsWith('http') ? p : `${graphFor(token)}${p}`);
  if (method === 'GET') url.searchParams.set('access_token', token);
  const res = await fetch(url, {
    method,
    headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify({ ...body, access_token: token }),
    signal: AbortSignal.timeout(60000)
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error((j.error && j.error.message) || `Instagram responded ${res.status}`);
  return j;
}

async function getAuth() {
  const env = process.env.IG_ACCESS_TOKEN;
  if (!env) return null;
  let a = db.prepare('SELECT * FROM ig_auth WHERE id = 1').get();
  if (!a || a.from_env !== env) {
    db.prepare("INSERT OR REPLACE INTO ig_auth (id, token, from_env, user_id, username, refreshed_at) VALUES (1, ?, ?, '', '', ?)").run(env, env, new Date().toISOString());
    a = db.prepare('SELECT * FROM ig_auth WHERE id = 1').get();
  }
  if (!fbToken(a.token) && Date.now() - Date.parse(a.refreshed_at) > 7 * 864e5) {
    try {
      const r = await ig('https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token', { token: a.token });
      if (r.access_token) {
        db.prepare('UPDATE ig_auth SET token = ?, refreshed_at = ? WHERE id = 1').run(r.access_token, new Date().toISOString());
        a.token = r.access_token;
        console.log('Instagram: token refreshed');
      }
    } catch (e) { console.warn(`Instagram: token refresh failed — ${e.message}`); }
  }
  if (!a.user_id) {
    let userId = process.env.IG_USER_ID || '';
    let username = '';
    if (fbToken(a.token)) {
      if (!userId) {
        const pages = await ig('/me/accounts?fields=instagram_business_account{id,username}&limit=50', { token: a.token });
        const hit = (pages.data || []).find((p) => p.instagram_business_account);
        if (!hit) throw new Error('No Instagram account linked to the Pages this token can see; set IG_USER_ID');
        userId = hit.instagram_business_account.id;
      }
      try { username = (await ig(`/${userId}?fields=username`, { token: a.token })).username || ''; } catch (e) { /* optional */ }
    } else {
      const me = await ig('/me?fields=user_id,username', { token: a.token });
      userId = userId || me.user_id || me.id;
      username = me.username || '';
    }
    db.prepare('UPDATE ig_auth SET user_id = ?, username = ? WHERE id = 1').run(String(userId), username);
    a.user_id = String(userId);
    a.username = username;
  }
  return a;
}

const save = (r, fields) => {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE insta_reels SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...keys.map((k) => fields[k]), r.id);
  Object.assign(r, fields);
};

async function step(r, auth) {
  if (!r.container_id) {
    const c = await ig(`/${auth.user_id}/media`, { method: 'POST', token: auth.token, body: { media_type: 'REELS', video_url: videoUrl(r), caption: r.caption, share_to_feed: true } });
    save(r, { container_id: c.id, status: 'posting' });
    return; // Instagram needs a minute or two to fetch and process the video
  }
  const s = await ig(`/${r.container_id}?fields=status_code,status`, { token: auth.token });
  if (s.status_code === 'IN_PROGRESS') return;
  if (s.status_code !== 'FINISHED') throw new Error(`Processing ${s.status_code}: ${s.status || ''}`);
  const p = await ig(`/${auth.user_id}/media_publish`, { method: 'POST', token: auth.token, body: { creation_id: r.container_id } });
  let permalink = '';
  try { permalink = (await ig(`/${p.id}?fields=permalink`, { token: auth.token })).permalink || ''; } catch (e) { /* optional */ }
  save(r, { media_id: p.id, status: 'posted', posted_at: new Date().toISOString(), error: '', permalink });
  console.log(`Instagram: posted ${r.rkey} ${permalink}`);
}

let running = false;
async function tick() {
  if (running || !igConfigured()) return;
  running = true;
  try {
    const now = Date.now();
    const due = db.prepare("SELECT * FROM insta_reels WHERE status IN ('pending','posting') AND publish_at <= ? ORDER BY publish_at LIMIT 5").all(new Date(now).toISOString());
    if (due.length) {
      const auth = await getAuth();
      for (const r of due) {
        if (r.status === 'pending' && !r.container_id && now - Date.parse(r.publish_at) > LATE_MS) { save(r, { status: 'skipped', error: 'Too late when first seen' }); continue; }
        try { await step(r, auth); } catch (e) {
          const attempts = r.attempts + 1;
          save(r, { attempts, error: e.message.slice(0, 300), container_id: '', status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending' });
          console.warn(`Instagram: ${r.rkey} attempt ${attempts} failed — ${e.message}`);
        }
      }
    }
    // Videos are only needed until Instagram has them.
    const old = db.prepare("SELECT * FROM insta_reels WHERE status IN ('posted','skipped','failed') AND file <> '' AND updated_at < datetime('now', '-3 days') LIMIT 20").all();
    for (const r of old) { fs.rm(videoPath(r.file), { force: true }, () => {}); save(r, { file: '' }); }
  } catch (e) {
    console.warn(`Instagram: ${e.message}`);
  } finally { running = false; }
}

// Stores a video for `date` (one promo per day). A re-run replaces a not-yet-posted video.
function storeReel({ date, label, caption, publishAt, body }) {
  const rkey = `promo|${date}`;
  const existing = db.prepare('SELECT * FROM insta_reels WHERE rkey = ?').get(rkey);
  if (existing && (existing.status === 'posted' || existing.status === 'posting' || existing.media_id)) return { key: rkey, status: existing.status, note: 'Already handled; not replaced' };
  fs.mkdirSync(DIR, { recursive: true });
  const file = `${date}-${Date.now()}.mp4`;
  fs.writeFileSync(videoPath(file), body);
  if (existing && existing.file) fs.rm(videoPath(existing.file), { force: true }, () => {});
  const when = publishAt ? new Date(publishAt).toISOString() : new Date().toISOString();
  db.prepare(`INSERT INTO insta_reels (rkey, label, caption, file, publish_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(rkey) DO UPDATE SET label = excluded.label, caption = excluded.caption, file = excluded.file, publish_at = excluded.publish_at,
      status = 'pending', container_id = '', attempts = 0, error = '', updated_at = datetime('now')`)
    .run(rkey, String(label || '').slice(0, 120), String(caption || '').slice(0, 2200), file, when);
  return { key: rkey, publishAt: when };
}

function startInstagramReelsJob() {
  if (igConfigured()) {
    setTimeout(() => getAuth()
      .then((a) => console.log(`Instagram: connected as @${a.username || '?'} (id ${a.user_id})`))
      .catch((e) => console.warn(`Instagram: NOT connected — ${e.message}`)), 15 * 1000);
  }
  setTimeout(tick, 30 * 1000);
  setInterval(tick, TICK_MS);
}

module.exports = { storeReel, startInstagramReelsJob, tick, getAuth, igConfigured, videoPath };
