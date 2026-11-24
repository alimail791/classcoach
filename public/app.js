// ClassCoach: Android app mode, push notifications and the "Get the app" bar.
(function () {
  var inApp = document.documentElement.classList.contains('cc-app');
  var CC = window.CC || {};
  var path = location.pathname;

  // --- App mode: no prices or payments inside the Play Store app ---
  if (inApp && /^\/(upgrade|pricing)(\/|$)/.test(path)) {
    var main = document.querySelector('.content') || document.querySelector('main') || document.body;
    main.innerHTML =
      '<div class="card cc-app-notice">' +
      '<h2 style="font-size:20px;margin:0;">Your plan</h2>' +
      '<p style="margin:0;color:var(--muted);font-size:14px;line-height:1.6;">Plans and credits aren\'t managed in the app. Your current plan works the same here as on the website.</p>' +
      '<a class="btn btn-primary" href="/dashboard">Back to dashboard</a></div>';
  }
  if (inApp) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (/^\/(upgrade|pricing)/.test(href)) { e.preventDefault(); location.href = '/dashboard'; }
    });
  }

  // --- Push notifications (teachers) ---
  function b64ToBytes(b64) {
    var pad = '='.repeat((4 - (b64.length % 4)) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function pushSupported() {
    return CC.push && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function getKey() {
    return fetch('/push/key', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; });
  }
  function subscribe() {
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('denied');
      return Promise.all([navigator.serviceWorker.ready, getKey()]);
    }).then(function (res) {
      var reg = res[0], k = res[1];
      if (!k || !k.key) throw new Error('off');
      return reg.pushManager.getSubscription().then(function (sub) {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.key) });
      });
    }).then(function (sub) {
      return fetch('/push/subscribe', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), inApp: inApp })
      });
    });
  }
  window.ccEnablePush = subscribe;

  // The "Turn on notifications" card on the dashboard (views/dashboard.ejs).
  var card = document.getElementById('push-card');
  if (card && pushSupported() && Notification.permission !== 'denied') {
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (sub && Notification.permission === 'granted') {
        // Already on in this browser/app: keep the server copy fresh (quietly).
        fetch('/push/key', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (k) {
          if (k && !k.subscribed) fetch('/push/subscribe', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), inApp: inApp }) });
        }).catch(function () {});
        return;
      }
      try { if (localStorage.getItem('cc_push_later') > Date.now()) return; } catch (e) {}
      card.style.display = '';
      var btn = card.querySelector('[data-push-on]'), later = card.querySelector('[data-push-later]'), msg = card.querySelector('[data-push-msg]');
      btn.addEventListener('click', function () {
        btn.disabled = true;
        subscribe().then(function () {
          msg.textContent = 'Done — notifications are on.';
          setTimeout(function () { card.style.display = 'none'; }, 2500);
        }).catch(function (err) {
          btn.disabled = false;
          msg.textContent = err && err.message === 'denied' ? 'Notifications are blocked. Allow them in your phone\'s settings for ClassCoach.' : 'Could not turn on notifications. Please try again.';
        });
      });
      later.addEventListener('click', function () {
        try { localStorage.setItem('cc_push_later', String(Date.now() + 7 * 864e5)); } catch (e) {}
        card.style.display = 'none';
      });
    }).catch(function () {});
  }

  // --- "Get the Android app" bar (website on Android phones only) ---
  var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  if (CC.play && !inApp && !standalone && /Android/i.test(navigator.userAgent) && !/^\/(student|parent|play|live\/join|join|r|c)(\/|$)/.test(path)) {
    var hidden = false;
    try { hidden = localStorage.getItem('cc_app_bar_hide') > Date.now(); } catch (e) {}
    if (!hidden) {
      var bar = document.createElement('div');
      bar.className = 'get-app-bar';
      bar.innerHTML = '<img src="/icon-192.png" alt=""><div class="txt"><strong>ClassCoach app</strong><br>Scan OMR sheets with your camera</div>' +
        '<a class="btn btn-primary" rel="noopener" href="' + CC.play + '">Get app</a><button class="x" aria-label="Close">×</button>';
      bar.querySelector('.x').addEventListener('click', function () {
        try { localStorage.setItem('cc_app_bar_hide', String(Date.now() + 14 * 864e5)); } catch (e) {}
        bar.remove();
      });
      document.body.appendChild(bar); // this script is deferred, so <body> is ready
    }
  }
})();
