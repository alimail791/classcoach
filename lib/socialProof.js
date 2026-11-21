// Homepage social proof: real counts from the database plus admin-added
// testimonials (routes/admin.js). A number only shows once it is big enough
// to help rather than hurt ("3 teachers" reads worse than nothing).
// Cached for 10 minutes so the homepage stays fast.
const db = require('./db');

const MIN = { tests: 50, answers: 1000, players: 200 };
const TTL_MS = 10 * 60 * 1000;
let cache = { at: 0, value: null };

const count = (sql) => {
  try {
    return db.prepare(sql).get().c || 0;
  } catch (e) {
    return 0;
  }
};
const round = (n) => (n >= 1000 ? `${Math.floor(n / 100) / 10}k+`.replace('.0k', 'k') : `${Math.floor(n / 10) * 10}+`);

function getSocialProof() {
  if (cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  const stats = [];
  const tests = count('SELECT COUNT(*) AS c FROM tests');
  const answers = count('SELECT COUNT(*) AS c FROM answers WHERE selected_index IS NOT NULL OR marks_awarded IS NOT NULL');
  const players = count('SELECT COUNT(*) AS c FROM live_players');
  if (tests >= MIN.tests) stats.push({ value: round(tests), label: 'tests created' });
  if (answers >= MIN.answers) stats.push({ value: round(answers), label: 'answers auto-graded' });
  if (players >= MIN.players) stats.push({ value: round(players), label: 'students played Live Quiz' });
  let reviews = [];
  try {
    reviews = db.prepare('SELECT name, role, quote FROM testimonials WHERE visible = 1 ORDER BY id DESC LIMIT 6').all();
  } catch (e) {
    reviews = [];
  }
  cache = { at: Date.now(), value: { stats, reviews } };
  return cache.value;
}

function clearSocialProofCache() {
  cache = { at: 0, value: null };
}

module.exports = { getSocialProof, clearSocialProofCache };
