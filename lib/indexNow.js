// IndexNow: tells Bing, Yandex, Seznam and Naver about our public pages right
// away instead of waiting for a crawl. Bing's index also feeds ChatGPT
// search, Copilot and DuckDuckGo. Runs once after each deploy, and only
// when the list of public URLs has changed since the last ping.
// Key file is served at /<key>.txt (see server.js).
const crypto = require('crypto');
const db = require('./db');

const KEY = process.env.INDEXNOW_KEY || crypto.createHash('sha256').update(`${process.env.SESSION_SECRET || 'classcoach'}:indexnow`).digest('hex').slice(0, 32);

async function ping(urls, siteOrigin) {
  if (!process.env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV !== 'production') return; // live site only
  const list = [...new Set(urls)].slice(0, 10000);
  const hash = crypto.createHash('sha256').update(list.join('\n')).digest('hex');
  const last = db.prepare("SELECT value FROM app_meta WHERE key = 'indexnow_hash'").get();
  if (last && last.value === hash) return;
  const host = new URL(siteOrigin).host;
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: KEY, keyLocation: `${siteOrigin}/${KEY}.txt`, urlList: list })
    });
    if (res.ok || res.status === 202) {
      db.prepare("INSERT INTO app_meta (key, value) VALUES ('indexnow_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(hash);
      console.log(`[IndexNow] Submitted ${list.length} URLs (HTTP ${res.status})`);
    } else {
      console.error(`[IndexNow] HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  } catch (err) {
    console.error('[IndexNow] failed:', err.message);
  }
}

module.exports = { KEY, ping };
