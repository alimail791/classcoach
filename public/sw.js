// Intentionally does no caching. Its only job is to exist, so browsers
// that require a registered service worker before showing an "Install
// app" / "Add to Home Screen" prompt will offer one. Every request just
// passes straight through to the network as normal.
self.addEventListener('fetch', () => {});
