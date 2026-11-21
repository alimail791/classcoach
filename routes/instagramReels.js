// Daily promo video API for shorts-bot/ (see lib/instagramReels.js).
// Everything except the public video URL needs the header x-upload-key = PROMO_UPLOAD_KEY.
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../lib/db');
const { storeReel, tick, getAuth, igConfigured, videoPath } = require('../lib/instagramReels');

const router = express.Router();

function requireKey(req, res, next) {
  const expected = process.env.PROMO_UPLOAD_KEY;
  if (!expected) return res.status(503).json({ error: 'PROMO_UPLOAD_KEY is not set on classcoach.in.' });
  const a = Buffer.from(String(req.get('x-upload-key') || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Bad upload key' });
  next();
}
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

// PUT /api/instagram-reels/upload — body = MP4, x-reel-meta = base64 JSON { date, label, caption, publishAt }.
router.put('/api/instagram-reels/upload', requireKey, express.raw({ type: 'video/mp4', limit: '60mb' }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length < 10000 || req.body.subarray(4, 8).toString() !== 'ftyp') return res.status(400).json({ error: 'Body must be an MP4' });
  let m = {};
  try { m = JSON.parse(Buffer.from(req.get('x-reel-meta') || '', 'base64').toString('utf8') || '{}'); } catch (e) { /* keep {} */ }
  if (!isDate(m.date)) return res.status(400).json({ error: 'Bad date' });
  const r = storeReel({ ...m, body: req.body });
  res.json({ ok: true, ...r, instagramConnected: igConfigured() });
});

// GET /api/instagram-reels/video/:id.mp4 — public, so Instagram can fetch the video.
router.get('/api/instagram-reels/video/:id', (req, res) => {
  const r = db.prepare('SELECT file FROM insta_reels WHERE id = ?').get(Number(String(req.params.id).replace(/\.mp4$/, '')) || 0);
  if (!r || !r.file || !fs.existsSync(videoPath(r.file))) return res.status(404).end();
  res.set('cache-control', 'public, max-age=3600');
  res.type('video/mp4').sendFile(videoPath(r.file));
});

// YouTube upload record, so a re-run never uploads the same day twice.
router.get('/api/instagram-reels/youtube', requireKey, (req, res) => {
  if (!isDate(req.query.date)) return res.status(400).json({ error: 'Bad date' });
  const r = db.prepare('SELECT youtube_id FROM insta_reels WHERE rkey = ?').get(`promo|${req.query.date}`);
  res.json({ videoId: (r && r.youtube_id) || null });
});
router.post('/api/instagram-reels/youtube', requireKey, express.json(), (req, res) => {
  const { date, videoId } = req.body || {};
  if (!isDate(date) || !/^[\w-]{6,20}$/.test(String(videoId || ''))) return res.status(400).json({ error: 'Bad date or videoId' });
  const rkey = `promo|${date}`;
  db.prepare("INSERT INTO insta_reels (rkey, publish_at, status, youtube_id) VALUES (?, ?, 'skipped', ?) ON CONFLICT(rkey) DO UPDATE SET youtube_id = excluded.youtube_id")
    .run(rkey, new Date().toISOString(), videoId);
  res.json({ ok: true });
});

// GET /api/instagram-reels/status — connected account and the last Reels (?run=1 posts anything due now).
router.get('/api/instagram-reels/status', requireKey, async (req, res) => {
  let account = null;
  let error = '';
  if (igConfigured()) {
    try { const a = await getAuth(); account = { username: a.username, userId: a.user_id, tokenRefreshedAt: a.refreshed_at }; } catch (e) { error = e.message; }
  }
  if (req.query.run === '1') await tick();
  const reels = db.prepare('SELECT rkey, label, status, publish_at, posted_at, permalink, youtube_id, attempts, error FROM insta_reels ORDER BY id DESC LIMIT 14').all();
  res.json({ connected: igConfigured(), account, error, reels });
});

module.exports = router;
