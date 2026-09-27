const crypto = require('crypto');
const db = require('./db');

const DEFAULT_VALID_DAYS = 30;

// Creates a fresh, single-purpose login link for one student. redirectPath
// controls where it lands them after auto-login — the test itself if this
// was generated for a specific test, or their dashboard otherwise.
function createMagicLink(studentId, redirectPath = '/student/dashboard', validDays = DEFAULT_VALID_DAYS) {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO magic_link_tokens (token, student_id, redirect_path, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    studentId,
    redirectPath,
    expiresAt
  );
  return token;
}

// Returns { student, redirectPath } if the token is valid and not expired,
// else null. Does not consume/invalidate the token — a student can
// reasonably tap the same WhatsApp link again later to get back into the
// same test's page.
function resolveMagicLink(token) {
  const row = db
    .prepare(
      `SELECT magic_link_tokens.redirect_path, magic_link_tokens.expires_at, students.*
       FROM magic_link_tokens
       JOIN students ON students.id = magic_link_tokens.student_id
       WHERE magic_link_tokens.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  db.prepare("UPDATE magic_link_tokens SET used_at = datetime('now') WHERE token = ?").run(token);
  const { redirect_path, expires_at, ...student } = row;
  return { student, redirectPath: redirect_path };
}

module.exports = { createMagicLink, resolveMagicLink };
