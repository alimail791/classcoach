const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { generateQuestions, suggestDescriptiveGrade } = require('../lib/ai');
const { extractTextFromPdf } = require('../lib/pdf');
const { extractTextFromImage } = require('../lib/ocr');
const mailer = require('../lib/mailer');
const { generateTestPdf } = require('../lib/pdfExport');
const { checkAiLimit, recordAiUsage } = require('../lib/usage');
const { buildWhatsAppLink } = require('../lib/whatsapp');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/png';
    if (!ok) return cb(new Error('Only PDF, JPG, or PNG files are accepted'));
    cb(null, true);
  }
});

function loadTestOr404(req, res) {
  const test = db
    .prepare('SELECT * FROM tests WHERE id = ? AND teacher_id = ?')
    .get(req.params.id, req.teacher.id);
  if (!test) {
    res.status(404).send('Test not found');
    return null;
  }
  return test;
}

function loadQuestionsFor(testId) {
  return db
    .prepare('SELECT * FROM questions WHERE test_id = ? ORDER BY position, id')
    .all(testId)
    .map((q) => ({ ...q, options: JSON.parse(q.options_json) }));
}

router.get('/batches/:batchId/tests/new', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');
  res.render('test_new', { teacher: req.teacher, batch, error: null });
});

router.post('/batches/:batchId/tests', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');

  const { title, chapter, duration_minutes } = req.body;
  if (!title) return res.render('test_new', { teacher: req.teacher, batch, error: 'Give the test a title.' });

  const info = db
    .prepare('INSERT INTO tests (teacher_id, batch_id, title, chapter, duration_minutes) VALUES (?, ?, ?, ?, ?)')
    .run(req.teacher.id, batch.id, title.trim(), (chapter || '').trim(), parseInt(duration_minutes, 10) || 30);

  res.redirect(`/tests/${info.lastInsertRowid}/edit`);
});

router.get('/tests/:id/edit', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(test.batch_id);
  const questions = loadQuestionsFor(test.id);
  res.render('test_edit', { teacher: req.teacher, test, batch, questions, error: null, aiError: null });
});

router.post('/tests/:id/questions', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;

  const { text, chapter, type } = req.body;
  const qtype = type === 'descriptive' ? 'descriptive' : 'mcq';

  const renderError = (msg) => {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(test.batch_id);
    const questions = loadQuestionsFor(test.id);
    res.render('test_edit', { teacher: req.teacher, test, batch, questions, error: msg, aiError: null });
  };

  if (!text || !text.trim()) return renderError('Write the question text.');

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM questions WHERE test_id = ?').get(test.id).m;

  if (qtype === 'descriptive') {
    const maxMarks = Math.max(1, parseInt(req.body.max_marks, 10) || 1);
    db.prepare(
      'INSERT INTO questions (test_id, type, text, options_json, correct_index, max_marks, chapter, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(test.id, 'descriptive', text.trim(), '[]', -1, maxMarks, (chapter || test.chapter).trim(), maxPos + 1);
    return res.redirect(`/tests/${test.id}/edit`);
  }

  const options = [req.body.opt0, req.body.opt1, req.body.opt2, req.body.opt3].map((o) => (o || '').trim());
  const correctIndex = parseInt(req.body.correctIndex, 10);
  if (options.some((o) => !o) || Number.isNaN(correctIndex)) {
    return renderError('Fill in all four options and mark the correct one.');
  }
  db.prepare(
    'INSERT INTO questions (test_id, type, text, options_json, correct_index, max_marks, chapter, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(test.id, 'mcq', text.trim(), JSON.stringify(options), correctIndex, 1, (chapter || test.chapter).trim(), maxPos + 1);
  res.redirect(`/tests/${test.id}/edit`);
});

router.post('/tests/:id/generate', requireTeacher, (req, res, next) => {
  upload.fields([{ name: 'syllabus_pdf', maxCount: 1 }, { name: 'syllabus_image', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      const test = loadTestOr404(req, res);
      if (!test) return;
      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(test.batch_id);
      const questions = loadQuestionsFor(test.id);
      return res.render('test_edit', { teacher: req.teacher, test, batch, questions, error: null, aiError: err.message });
    }
    next();
  });
}, async (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;

  const { syllabus_text, count } = req.body;
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(test.batch_id);
  const renderCurrent = (aiError) => {
    const questions = loadQuestionsFor(test.id);
    res.render('test_edit', { teacher: req.teacher, test, batch, questions, error: null, aiError });
  };

  const limitCheck = checkAiLimit(req.teacher);
  if (!limitCheck.allowed) {
    return renderCurrent(`You've used all ${limitCheck.limit} AI generations for this month. It resets next month, or ask your admin to raise the limit.`);
  }

  let topicText = (syllabus_text || '').trim();
  const pdfFile = req.files && req.files.syllabus_pdf && req.files.syllabus_pdf[0];
  const imageFile = req.files && req.files.syllabus_image && req.files.syllabus_image[0];

  if (pdfFile) {
    try {
      const pdfText = await extractTextFromPdf(pdfFile.buffer);
      if (!pdfText) return renderCurrent('Could not extract any text from that PDF — it may be a scanned image without a text layer. Try uploading a photo of the page instead, which supports OCR.');
      topicText = topicText ? `${topicText}\n\n${pdfText}` : pdfText;
    } catch (err) {
      console.error('PDF parse failed:', err.message);
      return renderCurrent(`Could not read that PDF: ${err.message}`);
    }
  }

  if (imageFile) {
    try {
      const imageText = await extractTextFromImage(imageFile.buffer);
      if (!imageText) return renderCurrent('Could not recognize any text in that image — try a clearer, well-lit photo.');
      topicText = topicText ? `${topicText}\n\n${imageText}` : imageText;
    } catch (err) {
      console.error('OCR failed:', err.message);
      return renderCurrent(`Could not read that image: ${err.message}`);
    }
  }

  if (!topicText) {
    return renderCurrent('Paste some syllabus text, upload a PDF, or upload a photo of the page first.');
  }

  try {
    const generated = await generateQuestions({
      topicText,
      count: Math.max(1, Math.min(15, parseInt(count, 10) || 6)),
      chapterLabel: test.chapter
    });
    if (!generated.length) {
      return renderCurrent('The AI response could not be parsed into questions. Try again or shorten the text.');
    }
    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM questions WHERE test_id = ?').get(test.id).m;
    const insert = db.prepare(
      'INSERT INTO questions (test_id, type, text, options_json, correct_index, max_marks, chapter, position) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    );
    generated.forEach((q, i) => {
      insert.run(test.id, 'mcq', q.text, JSON.stringify(q.options), q.correctIndex, q.chapter || test.chapter, maxPos + 1 + i);
    });
    recordAiUsage(req.teacher.id);
    res.redirect(`/tests/${test.id}/edit`);
  } catch (err) {
    console.error('AI generation failed:', err.message);
    renderCurrent(`AI generation failed: ${err.message}`);
  }
});

router.post('/tests/:id/questions/:qid/delete', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  db.prepare('DELETE FROM questions WHERE id = ? AND test_id = ?').run(req.params.qid, test.id);
  res.redirect(`/tests/${test.id}/edit`);
});

router.post('/tests/:id/publish', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const count = db.prepare('SELECT COUNT(*) AS c FROM questions WHERE test_id = ?').get(test.id).c;
  if (count === 0) return res.redirect(`/tests/${test.id}/edit`);
  db.prepare("UPDATE tests SET status = 'published', scheduled_at = NULL WHERE id = ?").run(test.id);
  res.redirect(`/batches/${test.batch_id}`);
});

router.post('/tests/:id/schedule', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const count = db.prepare('SELECT COUNT(*) AS c FROM questions WHERE test_id = ?').get(test.id).c;
  if (count === 0) return res.redirect(`/tests/${test.id}/edit`);
  const when = req.body.scheduled_at;
  if (!when) return res.redirect(`/tests/${test.id}/edit`);
  // datetime-local gives "YYYY-MM-DDTHH:MM" — normalize to a comparable ISO-ish string.
  const iso = new Date(when).toISOString();
  db.prepare('UPDATE tests SET scheduled_at = ? WHERE id = ?').run(iso, test.id);
  res.redirect(`/tests/${test.id}/edit`);
});

router.post('/tests/:id/unschedule', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  db.prepare('UPDATE tests SET scheduled_at = NULL WHERE id = ?').run(test.id);
  res.redirect(`/tests/${test.id}/edit`);
});

router.get('/tests/:id/results', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(test.batch_id);

  const attempts = db
    .prepare(
      `SELECT attempts.*, students.name AS student_name, students.roll_no, students.parent_contact, students.parent_phone, students.phone AS student_phone
       FROM attempts JOIN students ON students.id = attempts.student_id
       WHERE attempts.test_id = ? ORDER BY attempts.score DESC`
    )
    .all(test.id)
    .map((a) => {
      const token = db.prepare('SELECT token FROM report_tokens WHERE test_id = ? AND student_id = ?').get(test.id, a.student_id);
      const reportToken = token ? token.token : null;
      let waLink = null;
      if (reportToken) {
        const reportUrl = `${req.protocol}://${req.get('host')}/r/${reportToken}`;
        const message = `${a.student_name}'s result for "${test.title}": ${a.score}/${a.total}. Full report: ${reportUrl}`;
        waLink = buildWhatsAppLink(a.parent_phone || a.student_phone, message);
      }
      return { ...a, reportToken, waLink };
    });

  const questions = db.prepare('SELECT * FROM questions WHERE test_id = ? ORDER BY position, id').all(test.id);

  const chapterStats = {};
  questions.forEach((q) => {
    const chap = q.chapter || 'General';
    if (!chapterStats[chap]) chapterStats[chap] = { correct: 0, total: 0 };
  });
  const allAnswers = db
    .prepare(
      `SELECT answers.*, questions.chapter, questions.correct_index, questions.type, questions.max_marks
       FROM answers JOIN questions ON questions.id = answers.question_id
       WHERE questions.test_id = ?`
    )
    .all(test.id);
  allAnswers.forEach((a) => {
    const chap = a.chapter || 'General';
    if (!chapterStats[chap]) chapterStats[chap] = { correct: 0, total: 0 };
    if (a.type === 'mcq') {
      chapterStats[chap].total += 1;
      if (a.selected_index === a.correct_index) chapterStats[chap].correct += 1;
    } else if (a.marks_awarded !== null && a.marks_awarded !== undefined) {
      chapterStats[chap].total += 1;
      if (a.marks_awarded >= a.max_marks * 0.5) chapterStats[chap].correct += 1;
    }
  });
  const chapterBreakdown = Object.entries(chapterStats).map(([chapter, s]) => ({
    chapter,
    pct: s.total ? Math.round((s.correct / s.total) * 100) : null
  }));

  const pendingCount = attempts.filter((a) => a.status === 'pending').length;
  const emailConfigured = mailer.isConfigured();

  res.render('test_results', {
    teacher: req.teacher,
    test,
    batch,
    attempts,
    chapterBreakdown,
    pendingCount,
    emailConfigured,
    looksLikeEmail: mailer.looksLikeEmail,
    reportBaseUrl: `${req.protocol}://${req.get('host')}`,
    sent: req.query.sent || null,
    mailError: req.query.mailError || null,
    generated: req.query.generated ? parseInt(req.query.generated, 10) : null
  });
});

// --- Grading descriptive answers ---

router.post('/tests/:id/attempts/:attemptId/answers/:answerId/suggest-grade', requireTeacher, express.json(), async (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ? AND test_id = ?').get(req.params.attemptId, test.id);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

  const answer = db
    .prepare(
      `SELECT answers.*, questions.text AS question_text, questions.type, questions.max_marks
       FROM answers JOIN questions ON questions.id = answers.question_id
       WHERE answers.id = ? AND answers.attempt_id = ?`
    )
    .get(req.params.answerId, attempt.id);
  if (!answer) return res.status(404).json({ error: 'Answer not found' });
  if (answer.type !== 'descriptive') return res.status(400).json({ error: 'Only descriptive answers can be AI-suggested.' });

  const limitCheck = checkAiLimit(req.teacher);
  if (!limitCheck.allowed) {
    return res.status(400).json({ error: `You've used all ${limitCheck.limit} AI generations for this month.` });
  }

  try {
    const suggestion = await suggestDescriptiveGrade({
      questionText: answer.question_text,
      studentAnswer: answer.text_answer,
      maxMarks: answer.max_marks
    });
    recordAiUsage(req.teacher.id);
    res.json(suggestion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tests/:id/attempts/:attemptId/grade', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const attempt = db
    .prepare(
      `SELECT attempts.*, students.name AS student_name, students.roll_no
       FROM attempts JOIN students ON students.id = attempts.student_id
       WHERE attempts.id = ? AND attempts.test_id = ?`
    )
    .get(req.params.attemptId, test.id);
  if (!attempt) return res.status(404).send('Attempt not found');

  const answers = db
    .prepare(
      `SELECT answers.*, questions.text AS question_text, questions.type, questions.max_marks,
              questions.options_json, questions.correct_index
       FROM answers JOIN questions ON questions.id = answers.question_id
       WHERE answers.attempt_id = ? ORDER BY questions.position, questions.id`
    )
    .all(attempt.id)
    .map((a) => ({ ...a, options: JSON.parse(a.options_json) }));

  res.render('test_grade', { teacher: req.teacher, test, attempt, answers });
});

router.post('/tests/:id/attempts/:attemptId/grade', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ? AND test_id = ?').get(req.params.attemptId, test.id);
  if (!attempt) return res.status(404).send('Attempt not found');

  const answers = db
    .prepare(
      `SELECT answers.*, questions.type, questions.max_marks, questions.correct_index
       FROM answers JOIN questions ON questions.id = answers.question_id
       WHERE answers.attempt_id = ?`
    )
    .all(attempt.id);

  const updateAnswer = db.prepare('UPDATE answers SET marks_awarded = ? WHERE id = ?');
  const tx = db.transaction(() => {
    let score = 0;
    let total = 0;
    answers.forEach((a) => {
      if (a.type === 'mcq') {
        total += 1;
        if (a.selected_index === a.correct_index) score += 1;
      } else {
        total += a.max_marks;
        const raw = req.body['marks_' + a.id];
        let marks = raw === undefined || raw === '' ? null : parseInt(raw, 10);
        if (marks !== null) marks = Math.max(0, Math.min(a.max_marks, marks));
        updateAnswer.run(marks, a.id);
        score += marks || 0;
      }
    });
    const stillPending = answers.some((a) => {
      if (a.type !== 'descriptive') return false;
      const raw = req.body['marks_' + a.id];
      return raw === undefined || raw === '';
    });
    db.prepare('UPDATE attempts SET score = ?, total = ?, status = ? WHERE id = ?').run(
      score,
      total,
      stillPending ? 'pending' : 'graded',
      attempt.id
    );
  });
  tx();

  res.redirect(`/tests/${test.id}/results`);
});

// --- Parent reports ---

router.post('/tests/:id/reports/generate-all', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;

  const gradedAttempts = db
    .prepare("SELECT * FROM attempts WHERE test_id = ? AND status = 'graded'")
    .all(test.id);

  const upsertToken = db.prepare(
    `INSERT INTO report_tokens (test_id, student_id, token) VALUES (?, ?, ?)
     ON CONFLICT(test_id, student_id) DO NOTHING`
  );
  let created = 0;
  gradedAttempts.forEach((a) => {
    const existing = db.prepare('SELECT id FROM report_tokens WHERE test_id = ? AND student_id = ?').get(test.id, a.student_id);
    if (existing) return;
    const token = crypto.randomBytes(16).toString('hex');
    upsertToken.run(test.id, a.student_id, token);
    created += 1;
  });

  res.redirect(`/tests/${test.id}/results?generated=${created}`);
});

router.post('/tests/:id/reports/:studentId/generate', requireTeacher, (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const student = db.prepare('SELECT * FROM students WHERE id = ? AND batch_id = ?').get(req.params.studentId, test.batch_id);
  if (!student) return res.status(404).send('Student not found');

  const existing = db.prepare('SELECT * FROM report_tokens WHERE test_id = ? AND student_id = ?').get(test.id, student.id);
  const note = (req.body.note || '').trim();
  if (existing) {
    db.prepare('UPDATE report_tokens SET note = ? WHERE id = ?').run(note, existing.id);
  } else {
    const token = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO report_tokens (test_id, student_id, token, note) VALUES (?, ?, ?, ?)').run(
      test.id,
      student.id,
      token,
      note
    );
  }
  const returnTo = req.body.return_to && req.body.return_to.startsWith('/') ? req.body.return_to : `/tests/${test.id}/results`;
  res.redirect(returnTo);
});

router.post('/tests/:id/reports/:studentId/email', requireTeacher, async (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const student = db.prepare('SELECT * FROM students WHERE id = ? AND batch_id = ?').get(req.params.studentId, test.batch_id);
  if (!student) return res.status(404).send('Student not found');

  const returnBase = req.body.return_to && req.body.return_to.startsWith('/') ? req.body.return_to : `/tests/${test.id}/results`;

  const tokenRow = db.prepare('SELECT * FROM report_tokens WHERE test_id = ? AND student_id = ?').get(test.id, student.id);
  const attempt = db.prepare('SELECT * FROM attempts WHERE test_id = ? AND student_id = ?').get(test.id, student.id);
  if (!tokenRow || !attempt) return res.redirect(returnBase);

  const reportUrl = `${req.protocol}://${req.get('host')}/r/${tokenRow.token}`;
  try {
    await mailer.sendReportEmail({
      to: student.parent_contact,
      studentName: student.name,
      testTitle: test.title,
      score: attempt.score,
      total: attempt.total,
      reportUrl,
      note: tokenRow.note
    });
    res.redirect(`${returnBase}${returnBase.includes('?') ? '&' : '?'}sent=${student.id}`);
  } catch (err) {
    res.redirect(`${returnBase}${returnBase.includes('?') ? '&' : '?'}mailError=${encodeURIComponent(err.message)}`);
  }
});

router.get('/tests', requireTeacher, (req, res) => {
  db.autoPublishDueTests();
  const q = (req.query.q || '').trim().toLowerCase();
  const tests = db
    .prepare(
      `SELECT tests.*, batches.name AS batch_name FROM tests
       JOIN batches ON batches.id = tests.batch_id
       WHERE tests.teacher_id = ? ORDER BY tests.created_at DESC`
    )
    .all(req.teacher.id)
    .filter((t) => !q || t.title.toLowerCase().includes(q) || (t.chapter || '').toLowerCase().includes(q))
    .map((t) => {
      const questionCount = db.prepare('SELECT COUNT(*) AS c FROM questions WHERE test_id = ?').get(t.id).c;
      const attemptCount = db.prepare('SELECT COUNT(*) AS c FROM attempts WHERE test_id = ?').get(t.id).c;
      const pendingCount = db
        .prepare("SELECT COUNT(*) AS c FROM attempts WHERE test_id = ? AND status = 'pending'")
        .get(t.id).c;
      return { ...t, questionCount, attemptCount, pendingCount };
    });
  res.render('tests_hub', { teacher: req.teacher, tests, q: req.query.q || '' });
});

router.get('/question-bank', requireTeacher, (req, res) => {
  const chapterFilter = (req.query.chapter || '').trim();
  const questions = db
    .prepare(
      `SELECT questions.*, tests.title AS test_title, tests.id AS test_id, batches.name AS batch_name
       FROM questions
       JOIN tests ON tests.id = questions.test_id
       JOIN batches ON batches.id = tests.batch_id
       WHERE tests.teacher_id = ?
       ORDER BY questions.chapter, questions.id DESC`
    )
    .all(req.teacher.id)
    .map((q) => ({ ...q, options: JSON.parse(q.options_json) }))
    .filter((q) => !chapterFilter || (q.chapter || 'General') === chapterFilter);

  const allChapters = db
    .prepare(
      `SELECT DISTINCT questions.chapter FROM questions
       JOIN tests ON tests.id = questions.test_id
       WHERE tests.teacher_id = ? ORDER BY questions.chapter`
    )
    .all(req.teacher.id)
    .map((r) => r.chapter || 'General');

  res.render('question_bank', { teacher: req.teacher, questions, allChapters, chapterFilter });
});

router.get('/tests/:id/download', requireTeacher, async (req, res) => {
  const test = loadTestOr404(req, res);
  if (!test) return;
  const questions = loadQuestionsFor(test.id);
  const includeAnswers = req.query.answers === '1';
  try {
    const buffer = await generateTestPdf(test, questions, { includeAnswers });
    res.set('Content-Type', 'application/pdf');
    const suffix = includeAnswers ? '_answer_key' : '_question_paper';
    res.set('Content-Disposition', `attachment; filename="${test.title.replace(/[^a-z0-9]+/gi, '_')}${suffix}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('PDF generation failed:', err.message);
    res.status(500).send('Could not generate PDF: ' + err.message);
  }
});

module.exports = router;
