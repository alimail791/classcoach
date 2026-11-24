// ClassCoach service worker — used by the website ("Install app") and by the
// Android app from the Play Store.
//
// - Page loads always go to the network (fresh after every deploy). If the
//   phone is offline, a small "You're offline" page is shown instead of
//   Chrome's error page (Google Play checks for this in web-based apps).
// - Push notifications: shows them and opens the right page when tapped.
// It never caches logged-in pages, API calls or anything from other sites.
const VERSION = 'cc-v2';
const CACHE = VERSION + '-shell';
const SHELL = ['/offline', '/style.css', '/icon-192.png', '/favicon.svg'];

const OFFLINE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>ClassCoach — Offline</title>' +
  '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#FBF6EE;color:#2B2118;text-align:center;padding:24px}p{color:#6B5D50;line-height:1.5}button{background:#B4501C;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:700}</style></head>' +
  '<body><div><h1>You\'re offline</h1><p>ClassCoach needs the internet. This page reloads by itself when you\'re back online.</p><button onclick="location.reload()">Try again</button></div>' +
  '<script>addEventListener("online",function(){location.reload()})</script></body></html>';

async function offlineResponse() {
  const cached = await caches.match('/offline');
  return cached || new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Mobile data often drops for a second: retry twice before giving up.
async function navigate(req) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(req);
    } catch (e) {
      if (attempt < 2) await wait(attempt === 0 ? 700 : 1500);
    }
  }
  return offlineResponse();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return; // only page loads
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(navigate(req).catch(offlineResponse));
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data && event.data.text() };
  }
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/dashboard' }
  };
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(data.title || 'ClassCoach', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && 'navigate' in w) {
          return w.focus().then(() => w.navigate(url));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
