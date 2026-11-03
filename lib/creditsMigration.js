// One-time switch from "AI generations" to "AI credits" (runs at startup,
// only once — recorded in app_meta). Nobody loses value:
// - Accounts whose limit equals their plan's old default get the plan's new
//   credit allowance.
// - Accounts with a custom (admin-set) limit get it multiplied by 2.5.
// - This month's usage is multiplied by 2.5 so the remaining share stays the same.
const db = require('./db');
const { getPlan } = require('./plans');
const { syncMembers } = require('./institutes');

const KEY = 'credits_v1';
const FACTOR = 2.5;

// AI generations each plan gave before credits existed.
function oldDefault(planId) {
  const id = String(planId || '');
  const base = id.replace(/_(m|y|c\d+)$/, '').replace(/_y$/, '');
  const OLD = { trial: 20, free: 20, starter: 40, growth: 100, pro: 250, nj20: 40, nj50: 100, nj100: 250, inst10: 300, inst20: 800, inst30: 1500, inst_trial: 40 };
  return OLD[base] ?? OLD[id] ?? null;
}

function newLimit(row) {
  const plan = getPlan(row.plan);
  if (plan && row.ai_limit_monthly === oldDefault(row.plan)) return plan.ai_limit_monthly;
  return Math.round(row.ai_limit_monthly * FACTOR);
}

function migrateToCredits() {
  if (db.prepare('SELECT value FROM app_meta WHERE key = ?').get(KEY)) return;
  const month = new Date().toISOString().slice(0, 7);
  const run = db.transaction(() => {
    for (const inst of db.prepare('SELECT id, plan, ai_limit_monthly FROM institutes').all()) {
      db.prepare('UPDATE institutes SET ai_limit_monthly = ? WHERE id = ?').run(newLimit(inst), inst.id);
    }
    for (const t of db.prepare('SELECT id, plan, ai_limit_monthly FROM teachers WHERE institute_id IS NULL').all()) {
      db.prepare('UPDATE teachers SET ai_limit_monthly = ? WHERE id = ?').run(newLimit(t), t.id);
    }
    db.prepare('UPDATE ai_usage SET count = CAST(ROUND(count * ?) AS INTEGER) WHERE month = ?').run(FACTOR, month);
    db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)').run(KEY, new Date().toISOString());
  });
  run();
  for (const inst of db.prepare('SELECT id FROM institutes').all()) syncMembers(inst.id);
  console.log('[Credits] Switched AI generations to AI credits for existing accounts');
}

module.exports = { migrateToCredits };
