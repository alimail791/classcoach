// Web push notifications for teachers. The same subscription also works in
// the ClassCoach Android app from the Play Store (a Trusted Web Activity):
// Chrome hands the notification to Android, so it shows as a normal app
// notification with the ClassCoach icon.
//
// Railway variables: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (default mailto:info@classcoach.in). Without the keys push is
// simply off: the "Turn on notifications" card is hidden and nothing is sent.
const webpush = require('web-push');
const db = require('./db');

const enabled = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (enabled) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:info@classcoach.in',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    console.error('[push] bad VAPID keys, push is off:', err.message);
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  in_app INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_sent_at TEXT
);
CREATE INDEX IF NOT EXISTS push_subscriptions_teacher ON push_subscriptions (teacher_id);
`);

function isEnabled() {
  return enabled;
}

function publicKey() {
  return enabled ? process.env.VAPID_PUBLIC_KEY : '';
}

function save(teacherId, sub, inApp) {
  const endpoint = sub && sub.endpoint;
  const keys = (sub && sub.keys) || {};
  if (!endpoint || !/^https:\/\//.test(endpoint) || !keys.p256dh || !keys.auth) throw new Error('Invalid subscription');
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, teacher_id, p256dh, auth, in_app) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET teacher_id = excluded.teacher_id, p256dh = excluded.p256dh,
       auth = excluded.auth, in_app = excluded.in_app`
  ).run(endpoint, teacherId, keys.p256dh, keys.auth, inApp ? 1 : 0);
}

function remove(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(String(endpoint || ''));
}

function hasSubscription(teacherId) {
  return !!db.prepare('SELECT 1 FROM push_subscriptions WHERE teacher_id = ? LIMIT 1').get(teacherId);
}

// payload: { title, body, url, tag }. Never throws; push is best-effort.
// A tag makes a newer notification replace the older one on the phone, so
// 30 students submitting the same test give one updating notification.
async function sendToTeacher(teacherId, payload) {
  if (!enabled || !teacherId) return 0;
  let rows;
  try {
    rows = db.prepare('SELECT * FROM push_subscriptions WHERE teacher_id = ?').all(teacherId);
  } catch (err) {
    return 0;
  }
  let sent = 0;
  for (const r of rows) {
    // Inside the Play Store app, tapping keeps the page in app mode (no prices).
    const url = payload.url ? payload.url + (r.in_app ? (payload.url.includes('?') ? '&' : '?') + 'app=1' : '') : '/dashboard';
    try {
      await webpush.sendNotification(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        JSON.stringify({ title: payload.title || 'ClassCoach', body: payload.body || '', url, tag: payload.tag || '' }),
        { TTL: 12 * 60 * 60 }
      );
      sent += 1;
      db.prepare("UPDATE push_subscriptions SET last_sent_at = datetime('now') WHERE endpoint = ?").run(r.endpoint);
    } catch (err) {
      // 404/410: notifications turned off or app uninstalled — forget this one.
      if (err.statusCode === 404 || err.statusCode === 410) remove(r.endpoint);
      else console.warn('[push] send failed:', err.statusCode || '', err.body || err.message);
    }
  }
  return sent;
}

function sendToTeacherLater(teacherId, payload) {
  setImmediate(() => sendToTeacher(teacherId, payload).catch(() => {}));
}

// A student submitted a test: tell the teacher how far the class has got and
// how many answers are waiting to be graded.
function notifySubmission(testId, studentName) {
  if (!enabled) return;
  try {
    const t = db
      .prepare('SELECT tests.id, tests.title, tests.batch_id, batches.teacher_id FROM tests JOIN batches ON batches.id = tests.batch_id WHERE tests.id = ?')
      .get(testId);
    if (!t) return;
    const done = db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE test_id = ?').get(t.id).n;
    const total = db.prepare('SELECT COUNT(*) AS n FROM students WHERE batch_id = ?').get(t.batch_id).n;
    const pending = db.prepare("SELECT COUNT(*) AS n FROM attempts WHERE test_id = ? AND status = 'pending'").get(t.id).n;
    const body =
      `${studentName || 'A student'} submitted. ${done} of ${total} done` +
      (pending ? ` · ${pending} to grade` : '') +
      '.';
    sendToTeacherLater(t.teacher_id, { title: `📝 ${t.title}`, body, url: `/tests/${t.id}/results`, tag: `test-${t.id}` });
  } catch (err) {
    console.warn('[push] submission notice failed:', err.message);
  }
}

module.exports = { isEnabled, publicKey, save, remove, hasSubscription, sendToTeacher, sendToTeacherLater, notifySubmission };
