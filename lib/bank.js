const fs = require('fs');
const path = require('path');
const db = require('./db');

// Loads the ready-made NEET question bank into bank_questions. Safe to run on
// every start: rows are keyed by source_key and existing ones are left alone.
function seedBank() {
  const file = path.join(__dirname, '..', 'data', 'neet_bank.json');
  if (!fs.existsSync(file)) return 0;
  const have = db.prepare('SELECT COUNT(*) AS c FROM bank_questions').get().c;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (have >= rows.length) return 0;
  const ins = db.prepare(
    `INSERT OR IGNORE INTO bank_questions
     (source_key, subject, chapter, topic, class_level, difficulty, text, options_json, correct_index, explanation, is_pyq, pyq_years)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  db.exec('BEGIN');
  try {
    rows.forEach((r) => ins.run(r.k, r.s, r.c, r.t, r.l, r.d, r.q, JSON.stringify(r.o), r.a, r.e, r.y, r.p));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return rows.length - have;
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
