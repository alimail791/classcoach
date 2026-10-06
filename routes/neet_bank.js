const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { trackEnabled } = require('../lib/plans');
const { chapterIndex } = require('../lib/bank');

const router = express.Router();

function requireNJ(req, res, next) {
  if (!trackEnabled() || req.teacher.exam_track !== 'neet_jee') return res.redirect('/dashboard');
  next();
}

function pageData(req, extra) {
  const batches = db.prepare('SELECT * FROM batches WHERE teacher_id = ? ORDER BY name').all(req.teacher.id);
  return Object.assign({ teacher: req.teacher, index: chapterIndex(), batches, error: null }, extra || {});
}

router.get('/neet-bank', requireTeacher, requireNJ, (req, res) => {
  res.render('neet_bank', pageData(req));
});

router.post('/neet-bank/create-test', requireTeacher, requireNJ, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.body.batch_id, req.teacher.id);
  let chapters = req.body.chapters || [];
  if (!Array.isArray(chapters)) chapters = [chapters];
  chapters = chapters.map((c) => String(c)).filter(Boolean).slice(0, 40);
  const count = Math.min(90, Math.max(5, parseInt(req.body.count, 10) || 20));
  const difficulty = ['easy', 'medium', 'hard'].includes(req.body.difficulty) ? req.body.difficulty : '';
  const pyqOnly = req.body.pyq === '1';

  if (!batch) return res.render('neet_bank', pageData(req, { error: 'Create a batch first, then choose it for the test.' }));
  if (!chapters.length) return res.render('neet_bank', pageData(req, { error: 'Tick at least one chapter.' }));

  const where = [`chapter IN (${chapters.map(() => '?').join(',')})`];
  const args = chapters.slice();
  if (difficulty) { where.push('difficulty = ?'); args.push(difficulty); }
  if (pyqOnly) where.push('is_pyq = 1');
  const pool = db.prepare(`SELECT * FROM bank_questions WHERE ${where.join(' AND ')} ORDER BY RANDOM() LIMIT ?`).all(...args, count);
  if (!pool.length) return res.render('neet_bank', pageData(req, { error: 'No questions match those filters - try widening them.' }));

  const title = (req.body.title || '').trim() || (chapters.length === 1 ? `${chapters[0]} - Chapter test` : `Mixed test - ${chapters.length} chapters`);
  const duration = Math.max(10, Math.round(pool.length * 1.2));
  const info = db
    .prepare('INSERT INTO tests (teacher_id, batch_id, title, chapter, duration_minutes) VALUES (?, ?, ?, ?, ?)')
    .run(req.teacher.id, batch.id, title.slice(0, 120), chapters.length === 1 ? chapters[0] : '', duration);
  const ins = db.prepare(
    'INSERT INTO questions (test_id, type, text, options_json, correct_index, max_marks, chapter, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  pool.forEach((q, i) => ins.run(info.lastInsertRowid, 'mcq', q.text, q.options_json, q.correct_index, 1, q.chapter, i));
  // Lands on the normal test editor: review, drop any question, then publish.
  res.redirect(`/tests/${info.lastInsertRowid}/edit`);
});

module.exports = router;
