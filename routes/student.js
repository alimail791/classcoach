const express = require('express');
const db = require('../lib/db');
const { requireStudent } = require('../lib/auth');
const { generateMaterialPdf, generateTestPdf } = require('../lib/pdfExport');
const { chapterBreakdownFor } = require('../lib/studentStats');
const { getFor, unreadCountFor, markAllRead } = require('../lib/notifications');

const router = express.Router();

router.get('/student/login', (req, res) => {
  res.render('student_login', { error: null });
});

router.post('/student/login', (req, res) => {
  const { roll_no, pin } = req.body;
  const student = db.prepare('SELECT * FROM students WHERE roll_no = ? AND pin = ?').get((roll_no || '').trim(), (pin || '').trim());
  if (!student) {
    return res.render('student_login', { error: 'Roll number or PIN not recognized. Check with your teacher.' });
  }
  req.session.studentId = student.id;
  res.redirect('/student/dashboard');
});

router.post('/student/logout', (req, res) => {
  req.session.studentId = null;
  res.redirect('/student/login');
});

router.get('/student/dashboard', requireStudent, (req, res) => {
  db.autoPublishDueTests();
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.student.batch_id);
  const tests = db
    .prepare("SELECT * FROM tests WHERE batch_id = ? AND status = 'published' ORDER BY created_at DESC")
    .all(req.student.batch_id)
    .map((t) => {
      const attempt = db.prepare('SELECT * FROM attempts WHERE test_id = ? AND student_id = ?').get(t.id, req.student.id);
      return { ...t, attempt };
    });
  const materials = db
    .prepare('SELECT * FROM materials WHERE batch_id = ? AND shared = 1 ORDER BY created_at DESC')
    .all(req.student.batch_id);

  const homework = db
    .prepare('SELECT * FROM homework WHERE batch_id = ? ORDER BY due_date DESC, created_at DESC')
    .all(req.student.batch_id)
    .map((h) => {
      const done = db
        .prepare('SELECT completed FROM homework_completion WHERE homework_id = ? AND student_id = ?')
        .get(h.id, req.student.id);
      return { ...h, completed: !!(done && done.completed) };
    });

  const chapterBreakdown = chapterBreakdownFor(req.student.id);
  const practiceRecommendations = db
    .prepare(
      `SELECT practice_recommendations.*, materials.title AS material_title, materials.id AS material_id
       FROM practice_recommendations JOIN materials ON materials.id = practice_recommendations.material_id
       WHERE practice_recommendations.student_id = ? ORDER BY practice_recommendations.created_at DESC`
    )
    .all(req.student.id);

  const notifications = getFor('student', req.student.id, 8);
  const unreadCount = unreadCountFor('student', req.student.id);

  res.render('student_dashboard', {
    student: req.student,
    batch,
    tests,
    materials,
    homework,
    chapterBreakdown,
    notifications,
    unreadCount,
    practiceRecommendations
  });
});

router.get('/student/materials/:id', requireStudent, (req, res) => {
  const material = db
    .prepare('SELECT * FROM materials WHERE id = ? AND batch_id = ? AND shared = 1')
    .get(req.params.id, req.student.batch_id);
  if (!material) return res.status(404).send('Not found');
  res.render('student_material', { student: req.student, material: { ...material, content: JSON.parse(material.content_json) } });
});

router.get('/student/materials/:id/download', requireStudent, async (req, res) => {
  const material = db
    .prepare('SELECT * FROM materials WHERE id = ? AND batch_id = ? AND shared = 1')
    .get(req.params.id, req.student.batch_id);
  if (!material) return res.status(404).send('Not found');
  try {
    const buffer = await generateMaterialPdf({ ...material, content: JSON.parse(material.content_json) });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${material.title.replace(/[^a-z0-9]+/gi, '_')}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Could not generate PDF: ' + err.message);
  }
});

router.get('/student/tests/:id', requireStudent, (req, res) => {
  const test = db
    .prepare("SELECT * FROM tests WHERE id = ? AND batch_id = ? AND status = 'published'")
    .get(req.params.id, req.student.batch_id);
  if (!test) return res.status(404).send('Test not found');

  const already = db.prepare('SELECT * FROM attempts WHERE test_id = ? AND student_id = ?').get(test.id, req.student.id);
  if (already) return res.redirect(`/student/tests/${test.id}/result`);

  const questions = db
    .prepare('SELECT id, type, text, options_json, max_marks FROM questions WHERE test_id = ? ORDER BY position, id')
    .all(test.id)
    .map((q) => ({ ...q, options: JSON.parse(q.options_json) }));

  res.render('student_attempt', { student: req.student, test, questions });
});

router.post('/student/tests/:id/submit', requireStudent, (req, res) => {
  const test = db
    .prepare("SELECT * FROM tests WHERE id = ? AND batch_id = ? AND status = 'published'")
    .get(req.params.id, req.student.batch_id);
  if (!test) return res.status(404).send('Test not found');

  const already = db.prepare('SELECT * FROM attempts WHERE test_id = ? AND student_id = ?').get(test.id, req.student.id);
  if (already) return res.redirect(`/student/tests/${test.id}/result`);

  const questions = db.prepare('SELECT * FROM questions WHERE test_id = ?').all(test.id);
  const hasDescriptive = questions.some((q) => q.type === 'descriptive');

  const insertAttempt = db.prepare('INSERT INTO attempts (test_id, student_id, score, total, status) VALUES (?, ?, 0, 0, ?)');
  const insertAnswer = db.prepare(
    'INSERT INTO answers (attempt_id, question_id, selected_index, text_answer) VALUES (?, ?, ?, ?)'
  );
  const updateAttempt = db.prepare('UPDATE attempts SET score = ?, total = ? WHERE id = ?');

  const tx = db.transaction(() => {
    const attemptInfo = insertAttempt.run(test.id, req.student.id, hasDescriptive ? 'pending' : 'graded');
    let score = 0;
    let total = 0;
    questions.forEach((q) => {
      const raw = req.body['q' + q.id];
      if (q.type === 'mcq') {
        total += 1;
        const selected = raw === undefined || raw === '' ? null : parseInt(raw, 10);
        if (selected === q.correct_index) score += 1;
        insertAnswer.run(attemptInfo.lastInsertRowid, q.id, selected, null);
      } else {
        total += q.max_marks;
        insertAnswer.run(attemptInfo.lastInsertRowid, q.id, null, (raw || '').trim());
        // marks_awarded stays NULL until the teacher grades it
      }
    });
    updateAttempt.run(score, total, attemptInfo.lastInsertRowid);
  });
  tx();

  res.redirect(`/student/tests/${test.id}/result`);
});

router.get('/student/tests/:id/result', requireStudent, (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND batch_id = ?').get(req.params.id, req.student.batch_id);
  if (!test) return res.status(404).send('Test not found');

  const attempt = db.prepare('SELECT * FROM attempts WHERE test_id = ? AND student_id = ?').get(test.id, req.student.id);
  if (!attempt) return res.redirect(`/student/tests/${test.id}`);

  const rows = db
    .prepare(
      `SELECT questions.text, questions.type, questions.options_json, questions.correct_index, questions.max_marks,
              answers.selected_index, answers.text_answer, answers.marks_awarded
       FROM answers JOIN questions ON questions.id = answers.question_id
       WHERE answers.attempt_id = ? ORDER BY questions.position, questions.id`
    )
    .all(attempt.id)
    .map((r) => ({ ...r, options: JSON.parse(r.options_json) }));

  res.render('student_result', { student: req.student, test, attempt, rows });
});

router.get('/student/tests/:id/download', requireStudent, async (req, res) => {
  const test = db
    .prepare("SELECT * FROM tests WHERE id = ? AND batch_id = ? AND status = 'published'")
    .get(req.params.id, req.student.batch_id);
  if (!test) return res.status(404).send('Test not found');
  const questions = db
    .prepare('SELECT * FROM questions WHERE test_id = ? ORDER BY position, id')
    .all(test.id)
    .map((q) => ({ ...q, options: JSON.parse(q.options_json) }));
  try {
    const buffer = await generateTestPdf(test, questions, { includeAnswers: false });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${test.title.replace(/[^a-z0-9]+/gi, '_')}_question_paper.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Could not generate PDF: ' + err.message);
  }
});

router.post('/student/notifications/mark-read', requireStudent, (req, res) => {
  markAllRead('student', req.student.id);
  res.redirect('/student/dashboard');
});

module.exports = router;
