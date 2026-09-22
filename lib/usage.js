const db = require('./db');
const { effectiveAiLimit } = require('./plans');

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function getUsage(teacherId, month = currentMonth()) {
  const row = db.prepare('SELECT count FROM ai_usage WHERE teacher_id = ? AND month = ?').get(teacherId, month);
  return row ? row.count : 0;
}

// Returns {allowed, used, limit} without incrementing anything —
// call this BEFORE attempting an AI generation. The limit used here
// already accounts for plan expiry (drops to 0 once a plan expires).
function checkAiLimit(teacher) {
  const used = getUsage(teacher.id);
  const limit = effectiveAiLimit(teacher);
  return { allowed: used < limit, used, limit };
}

// Call this only after a generation actually succeeds.
function recordAiUsage(teacherId) {
  const month = currentMonth();
  db.prepare(
    `INSERT INTO ai_usage (teacher_id, month, count) VALUES (?, ?, 1)
     ON CONFLICT(teacher_id, month) DO UPDATE SET count = count + 1`
  ).run(teacherId, month);
}

module.exports = { currentMonth, getUsage, checkAiLimit, recordAiUsage };
