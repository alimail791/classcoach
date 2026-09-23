const { Store } = require('express-session');
const db = require('./db');

const getStmt = db.prepare('SELECT session, expires FROM sessions WHERE sid = ?');
const setStmt = db.prepare(
  'INSERT INTO sessions (sid, session, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET session = excluded.session, expires = excluded.expires'
);
const destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
const touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
const pruneStmt = db.prepare('DELETE FROM sessions WHERE expires <= ?');

// A small, dependency-free express-session Store using the same SQLite
// database as everything else in the app — deliberately not one of the
// npm session-store packages, since most of those (connect-sqlite3,
// better-sqlite3-session-store, etc.) depend on a *different* SQLite
// binding than this project's node:sqlite, which would reintroduce the
// native-compilation problem this app has avoided everywhere else.
class SqliteSessionStore extends Store {
  get(sid, callback) {
    try {
      const row = getStmt.get(sid);
      if (!row || row.expires <= Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.session));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, session, callback) {
    try {
      const maxAge = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 1000 * 60 * 60 * 24 * 7;
      const expires = Date.now() + maxAge;
      setStmt.run(sid, JSON.stringify(session), expires);
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      destroyStmt.run(sid);
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }

  touch(sid, session, callback) {
    try {
      const maxAge = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 1000 * 60 * 60 * 24 * 7;
      touchStmt.run(Date.now() + maxAge, sid);
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }
}

// Sweep expired sessions periodically so the table doesn't grow forever —
// every 6 hours is plenty for how few concurrent users this app expects.
setInterval(() => {
  try {
    pruneStmt.run(Date.now());
  } catch (err) {
    console.error('Session cleanup failed:', err.message);
  }
}, 1000 * 60 * 60 * 6).unref();

module.exports = SqliteSessionStore;
