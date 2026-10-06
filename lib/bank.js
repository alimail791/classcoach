const fs = require('fs');
const path = require('path');
const db = require('./db');

// Loads the ready-made NEET question bank into bank_questions. Safe to run on
// every start: rows are keyed by source_key and existing ones are left alone.
function seedBank() {
  const file = path.join(__dirname, '..', 'data', 'neet_bank.json');
  if (!fs.existsSync(file)) return 0;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const existing = new Set(db.prepare('SELECT source_key FROM bank_questions').all().map((r) => r.source_key));
  const wanted = new Set(rows.map((r) => r.k));
  const toAdd = rows.filter((r) => !existing.has(r.k));
  const toDrop = [...existing].filter((k) => !wanted.has(k));
  if (!toAdd.length && !toDrop.length) return 0;
  const ins = db.prepare(
    `INSERT OR IGNORE INTO bank_questions
     (source_key, subject, chapter, topic, class_level, difficulty, text, options_json, correct_index, explanation, is_pyq, pyq_years)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const del = db.prepare('DELETE FROM bank_questions WHERE source_key = ?');
  db.exec('BEGIN');
  try {
    // Tests already built keep their own copies of questions, so dropping a
    // bank row (one pulled for review) never changes a published test.
    toDrop.forEach((k) => del.run(k));
    toAdd.forEach((r) => ins.run(r.k, r.s, r.c, r.t, r.l, r.d, r.q, JSON.stringify(r.o), r.a, r.e, r.y, r.p));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return toAdd.length - toDrop.length;
}

// Subject -> chapters with question counts, for the picker.
function chapterIndex() {
  const rows = db
    .prepare(
      `SELECT subject, chapter, COUNT(*) AS n, SUM(is_pyq) AS pyq
       FROM bank_questions GROUP BY subject, chapter ORDER BY subject, chapter`
    )
    .all();
  const out = {};
  rows.forEach((r) => {
    (out[r.subject] = out[r.subject] || []).push({ chapter: r.chapter, n: r.n, pyq: r.pyq });
  });
  return out;
}

module.exports = { seedBank, chapterIndex };
