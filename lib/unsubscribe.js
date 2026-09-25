const crypto = require('crypto');

function secret() {
  return process.env.SESSION_SECRET || 'classcoach-dev-secret-change-me';
}

// A short signature over the email, not a random token stored anywhere —
// this means the broadcast script can generate valid unsubscribe links
// without needing to look anything up first, and the app can verify them
// without a database round-trip either. Anyone without the secret can't
// forge a link to unsubscribe an email that isn't theirs.
function signUnsubscribeToken(email) {
  return crypto.createHmac('sha256', secret()).update(email.toLowerCase().trim()).digest('hex').slice(0, 32);
}

function verifyUnsubscribeToken(email, token) {
  if (!email || !token) return false;
  const expected = signUnsubscribeToken(email);
  // Constant-time comparison so this can't be brute-forced via timing.
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signUnsubscribeToken, verifyUnsubscribeToken };
