// Deliberately does nothing. Registering a service worker at all is
// enough for "Add to Home Screen" on iOS and the manual "Install app"
// option in Chrome's menu — a fetch event handler isn't needed for
// either, and Chrome now explicitly ignores no-op fetch handlers
// (it used to require one, but stopped once sites started adding
// empty handlers just to satisfy that check). Adding one back would
// only reintroduce the exact console warning this avoids, for no
// actual benefit.
