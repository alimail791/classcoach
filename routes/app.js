// Everything the ClassCoach Android app (Play Store) needs from the website.
//
// The app is a Trusted Web Activity: a thin Android wrapper that opens
// https://www.classcoach.in full screen in Chrome. For Android to drop the
// browser address bar it checks /.well-known/assetlinks.json, which lists the
// app's package name and signing-key fingerprints.
//
// Railway variables:
//   ANDROID_PACKAGE               default "in.classcoach.app"
//   ANDROID_SHA256_FINGERPRINTS   comma-separated SHA-256 fingerprints from
//                                 Play Console → Test and release → App integrity
//                                 → App signing (app signing key + upload key)
//   PLAY_STORE_URL                optional; shows "Get the Android app" links on
//                                 the website once the app is live
const express = require('express');
const { requireTeacher } = require('../lib/auth');
const push = require('../lib/push');

const router = express.Router();

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

router.get('/.well-known/assetlinks.json', (req, res) => {
  const pkg = (process.env.ANDROID_PACKAGE || 'in.classcoach.app').trim();
  const prints = String(process.env.ANDROID_SHA256_FINGERPRINTS || '')
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => FINGERPRINT.test(s));
  const body = prints.length
    ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints } }]
    : [];
  res.set('Cache-Control', 'public, max-age=300');
  res.json(body);
});

// Start page of the Android app (its start URL is /app). Logged-in teachers,
// students and parents go to their dashboards; everyone else gets the app
// welcome screen instead of the marketing home page with prices.
router.get('/app', (req, res) => {
  if (req.session.teacherId) return res.redirect('/dashboard?app=1');
  if (req.session.studentId) return res.redirect('/student/dashboard?app=1');
  if (req.session.parentStudentId) return res.redirect('/parent/dashboard?app=1');
  res.set('Cache-Control', 'no-store');
  res.render('app_welcome');
});

// Offline page cached by the service worker.
router.get('/offline', (req, res) => {
  res.render('offline');
});

// --- Push notifications (teachers) ---
router.get('/push/key', requireTeacher, (req, res) => {
  res.json({ key: push.publicKey(), subscribed: push.hasSubscription(req.teacher.id) });
});

router.post('/push/subscribe', requireTeacher, express.json(), (req, res) => {
  try {
    push.save(req.teacher.id, req.body && req.body.subscription, req.body && req.body.inApp);
    // A welcome notification confirms it works straight away.
    push.sendToTeacherLater(req.teacher.id, {
      title: 'Notifications are on ✅',
      body: "We'll tell you when students submit tests and when answers are waiting to be graded.",
      url: '/dashboard',
      tag: 'welcome'
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/push/unsubscribe', requireTeacher, express.json(), (req, res) => {
  push.remove(req.body && req.body.endpoint);
  res.json({ ok: true });
});

module.exports = router;
