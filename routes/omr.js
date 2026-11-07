// OMR scanner for question papers. Teachers print an OMR sheet per set,
// students fill it, and the teacher uploads phone photos; each sheet is
// graded against that set's answer key (lib/papers.js setView).
//
//   GET  /papers/:id/omr-sheet?set=A   printable sheet
//   GET  /papers/:id/omr               scan page + results
//   POST /papers/:id/omr/start         reserves credits for N sheets
//   POST /papers/:id/omr/scan          one photo -> one graded result (JSON)
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { checkAiLimit, recordAiUsage } = require('../lib/usage');
const { creditsFor } = require('../lib/credits');
const P = require('../lib/papers');
const T = require('../lib/omr/template');
const { scanSheet } = require('../lib/omr/scan');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(/^image\/(jpeg|png)$/.test(file.mimetype) ? null : new Error('Upload JPG or PNG photos.'), true)
});

function mcqCount(paper) {
  return P.setView(paper, 0).key.length;
}

function setIndexOf(paper, letter) {
  const i = P.SET_LETTERS.indexOf(String(letter || 'A').toUpperCase());
  return i >= 0 && i < paper.sets ? i : 0;
}

// Grades set-relative answers against that set's key.
function grade(paper, setIndex, answers) {
  const view = P.setView(paper, setIndex);
  const mcq = view.sections.find((s) => s.type === 'mcq');
  const marks = mcq ? mcq.marks : 1;
  let correct = 0, wrong = 0, blank = 0, multiple = 0;
  view.key.forEach((k, i) => {
    const a = answers[i];
    if (a === null || a === undefined) blank++;
    else if (a === 'M') multiple++;
    else if (a === k.correct) correct++;
    else wrong++;
  });
  const neg = paper.omr_negative || 0;
  // Multiple marks count as wrong for negative marking, like most OMR exams.
  const score = Math.round((correct * marks - (wrong + multiple) * neg) * 100) / 100;
  return { correct, wrong, blank, multiple, score, maxScore: view.key.length * marks };
}

function batchStudents(teacher, batchId) {
  if (!batchId) return [];
  return db
    .prepare('SELECT s.* FROM students s JOIN batches b ON b.id = s.batch_id WHERE b.id = ? AND b.teacher_id = ?')
    .all(batchId, teacher.id);
}

function matchStudent(students, roll) {
  if (!roll || roll.includes('?')) return null;
  const norm = (r) => String(r).replace(/^0+/, '').trim().toLowerCase();
  return students.find((s) => norm(s.roll_no) === norm(roll)) || null;
}

router.get('/papers/:id/omr-sheet', requireTeacher, async (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const count = mcqCount(paper);
  if (!count) return res.status(400).send('This paper has no multiple choice questions, so it has no OMR sheet.');
  if (count > T.MAX_QUESTIONS) return res.status(400).send(`OMR sheets hold up to ${T.MAX_QUESTIONS} MCQs; this paper has ${count}.`);
  const letter = P.SET_LETTERS[setIndexOf(paper, req.query.set)];
  const svg = await QRCode.toString(`CCOMR:${paper.id}:${letter}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  const qrSize = parseInt((/viewBox="0 0 (\d+)/.exec(svg) || [])[1], 10) || 25;
  const qrSvg = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  res.render('omr_sheet', { paper, header: paper.header, letter, count, T, qrSvg, qrSize });
});

router.get('/papers/:id/omr', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const scans = db
    .prepare('SELECT o.*, s.name AS student_name, s.roll_no AS student_roll FROM omr_scans o LEFT JOIN students s ON s.id = o.student_id WHERE o.paper_id = ? ORDER BY o.created_at DESC, o.id DESC')
    .all(paper.id)
    .map((s) => ({ ...s, answers: JSON.parse(s.answers_json) }));
  const count = mcqCount(paper);
  const mcq = P.setView(paper, 0).sections.find((s) => s.type === 'mcq');
  res.render('omr_scan', {
    teacher: req.teacher,
    paper,
    scans,
    count,
    maxScore: count * (mcq ? mcq.marks : 1),
    letters: P.SET_LETTERS.slice(0, paper.sets),
    batches: db.prepare('SELECT id, name FROM batches WHERE teacher_id = ? ORDER BY name').all(req.teacher.id),
    perTen: creditsFor('omr', { count: 10 }),
    tooMany: count > T.MAX_QUESTIONS,
    saved: req.query.saved || null,
    error: req.query.error || null
  });
});

router.post('/papers/:id/omr/settings', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const neg = Math.max(0, Math.min(10, parseFloat(req.body.negative) || 0));
  db.prepare('UPDATE papers SET omr_negative = ? WHERE id = ?').run(neg, paper.id);
  const fresh = P.getPaper(req.teacher.id, paper.id);
  const rows = db.prepare('SELECT * FROM omr_scans WHERE paper_id = ?').all(paper.id);
  const upd = db.prepare('UPDATE omr_scans SET correct = ?, wrong = ?, blank = ?, multiple = ?, score = ? WHERE id = ?');
  rows.forEach((r) => {
    const g = grade(fresh, setIndexOf(fresh, r.set_letter), JSON.parse(r.answers_json));
    upd.run(g.correct, g.wrong, g.blank, g.multiple, g.score, r.id);
  });
  res.redirect(`/papers/${paper.id}/omr`);
});

// Reserves credits for a batch of sheets: 1 credit per 10 sheets, charged up front.
router.post('/papers/:id/omr/start', requireTeacher, express.json(), (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });
  const n = Math.max(1, Math.min(300, parseInt(req.body.count, 10) || 1));
  const credits = creditsFor('omr', { count: n });
  const check = checkAiLimit(req.teacher, credits);
  if (!check.allowed) return res.status(400).json({ error: check.message });
  recordAiUsage(req.teacher, { feature: 'omr', credits, meter: {} });
  req.session.omrQuota = { paperId: paper.id, left: n };
  res.json({ ok: true, credits });
});

router.post('/papers/:id/omr/scan', requireTeacher, (req, res, next) => {
  upload.single('sheet')(req, res, (err) => (err ? res.status(400).json({ error: err.message }) : next()));
}, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });
  const quota = req.session.omrQuota;
  if (!quota || quota.paperId !== paper.id || quota.left <= 0) return res.status(400).json({ error: 'Start a new scan batch first.' });
  if (!req.file) return res.status(400).json({ error: 'No photo received.' });

  const count = mcqCount(paper);
  const result = scanSheet(req.file.buffer, count);
  quota.left -= 1;
  req.session.omrQuota = quota;
  if (!result.ok) return res.json({ ok: false, file: req.file.originalname, error: result.error });
  if (result.qr && result.qr.paperId !== paper.id) {
    return res.json({ ok: false, file: req.file.originalname, error: `This sheet belongs to a different paper (#${result.qr.paperId}).` });
  }

  const letter = result.qr ? result.qr.set : P.SET_LETTERS[setIndexOf(paper, req.body.set)];
  const setIdx = setIndexOf(paper, letter);
  const g = grade(paper, setIdx, result.answers);
  const student = matchStudent(batchStudents(req.teacher, req.body.batch_id), result.roll);
  const id = db
    .prepare('INSERT INTO omr_scans (paper_id, set_letter, roll, student_id, answers_json, correct, wrong, blank, multiple, score, filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(paper.id, P.SET_LETTERS[setIdx], result.roll, student ? student.id : null, JSON.stringify(result.answers), g.correct, g.wrong, g.blank, g.multiple, g.score, String(req.file.originalname || '').slice(0, 120))
    .lastInsertRowid;
  res.json({
    ok: true,
    id,
    file: req.file.originalname,
    set: P.SET_LETTERS[setIdx],
    setFromQr: !!result.qr,
    roll: result.roll,
    rollUnclear: result.rollUnclear,
    student: student ? student.name : null,
    ...g
  });
});

// Manual correction of one sheet: roll number and/or answers string
// ("ABCD-A..." one character per question; "-" blank, "*" more than one).
router.post('/papers/:id/omr/:scanId/edit', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const scan = db.prepare('SELECT * FROM omr_scans WHERE id = ? AND paper_id = ?').get(req.params.scanId, paper.id);
  if (!scan) return res.status(404).send('Not found');
  const count = mcqCount(paper);
  const str = String(req.body.answers || '').toUpperCase().replace(/\s+/g, '');
  const answers = [];
  for (let i = 0; i < count; i++) {
    const ch = str[i];
    answers.push(ch && 'ABCD'.includes(ch) ? 'ABCD'.indexOf(ch) : ch === '*' ? 'M' : null);
  }
  const roll = String(req.body.roll || '').trim().slice(0, 20);
  const setIdx = setIndexOf(paper, req.body.set || scan.set_letter);
  const g = grade(paper, setIdx, answers);
  const student = req.body.student_id
    ? db.prepare('SELECT s.id FROM students s JOIN batches b ON b.id = s.batch_id WHERE s.id = ? AND b.teacher_id = ?').get(req.body.student_id, req.teacher.id)
    : null;
  db.prepare('UPDATE omr_scans SET set_letter = ?, roll = ?, student_id = ?, answers_json = ?, correct = ?, wrong = ?, blank = ?, multiple = ?, score = ? WHERE id = ?').run(
    P.SET_LETTERS[setIdx], roll, student ? student.id : scan.student_id, JSON.stringify(answers), g.correct, g.wrong, g.blank, g.multiple, g.score, scan.id
  );
  res.redirect(`/papers/${paper.id}/omr#scan-${scan.id}`);
});

router.post('/papers/:id/omr/:scanId/delete', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  db.prepare('DELETE FROM omr_scans WHERE id = ? AND paper_id = ?').run(req.params.scanId, paper.id);
  res.redirect(`/papers/${paper.id}/omr`);
});

router.get('/papers/:id/omr/export.csv', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const rows = db
    .prepare('SELECT o.*, s.name AS student_name FROM omr_scans o LEFT JOIN students s ON s.id = o.student_id WHERE o.paper_id = ? ORDER BY o.roll')
    .all(paper.id);
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = ['Roll', 'Student', 'Set', 'Score', 'Correct', 'Wrong', 'Blank', 'Multiple', 'Answers'];
  const lines = rows.map((r) =>
    [r.roll, r.student_name || '', r.set_letter, r.score, r.correct, r.wrong, r.blank, r.multiple,
      JSON.parse(r.answers_json).map((a) => (a === null ? '-' : a === 'M' ? '*' : 'ABCD'[a])).join('')].map(esc).join(',')
  );
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="omr-paper-${paper.id}.csv"`);
  res.send('﻿' + [head.map(esc).join(',')].concat(lines).join('\n'));
});

// Saves matched sheets as attempts on a ClassCoach test (one per batch), so
// OMR marks show up in Reports, student dashboards and parent reports.
router.post('/papers/:id/omr/to-results', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.body.batch_id, req.teacher.id);
  if (!batch) return res.redirect(`/papers/${paper.id}/omr?error=` + encodeURIComponent('Choose a batch.'));
  const scans = db
    .prepare('SELECT o.* FROM omr_scans o JOIN students s ON s.id = o.student_id WHERE o.paper_id = ? AND s.batch_id = ? ORDER BY o.id')
    .all(paper.id, batch.id);
  if (!scans.length) {
    return res.redirect(`/papers/${paper.id}/omr?error=` + encodeURIComponent(`No scanned sheets are matched to students in ${batch.name}. Check the roll numbers.`));
  }

  // The test mirrors Set A's MCQs; other sets are mapped back by question text.
  const setA = P.setView(paper, 0);
  const aQs = setA.sections.filter((s) => s.type === 'mcq').flatMap((s) => s.questions);
  const map = JSON.parse(paper.omr_tests_json || '{}');
  let testId = map[batch.id];
  const run = db.transaction(() => {
    if (!testId || !db.prepare('SELECT 1 FROM tests WHERE id = ? AND teacher_id = ?').get(testId, req.teacher.id)) {
      testId = Number(
        db.prepare("INSERT INTO tests (teacher_id, batch_id, title, chapter, duration_minutes, status) VALUES (?, ?, ?, ?, ?, 'closed')")
          .run(req.teacher.id, batch.id, `${paper.title} (OMR)`.slice(0, 120), paper.header.subject || '', paper.header.duration || 60).lastInsertRowid
      );
      const ins = db.prepare("INSERT INTO questions (test_id, type, text, options_json, correct_index, max_marks, chapter, position) VALUES (?, 'mcq', ?, ?, ?, 1, ?, ?)");
      aQs.forEach((q, i) => ins.run(testId, q.text, JSON.stringify(q.options), q.correct, q.chapter || '', i));
      map[batch.id] = testId;
      db.prepare('UPDATE papers SET omr_tests_json = ? WHERE id = ?').run(JSON.stringify(map), paper.id);
    }
    const qRows = db.prepare('SELECT * FROM questions WHERE test_id = ? ORDER BY position, id').all(testId);
    const byText = new Map(qRows.map((q) => [q.text, q]));
    const views = {};
    scans.forEach((scan) => {
      const si = setIndexOf(paper, scan.set_letter);
      const view = (views[si] = views[si] || P.setView(paper, si));
      const setQs = view.sections.filter((s) => s.type === 'mcq').flatMap((s) => s.questions);
      const answers = JSON.parse(scan.answers_json);
      db.prepare('DELETE FROM attempts WHERE test_id = ? AND student_id = ?').run(testId, scan.student_id);
      const attemptId = db.prepare("INSERT INTO attempts (test_id, student_id, score, total, status) VALUES (?, ?, 0, ?, 'graded')").run(testId, scan.student_id, qRows.length).lastInsertRowid;
      let score = 0;
      const insA = db.prepare('INSERT INTO answers (attempt_id, question_id, selected_index, text_answer, marks_awarded) VALUES (?, ?, ?, NULL, NULL)');
      setQs.forEach((q, i) => {
        const row = byText.get(q.text);
        if (!row) return;
        const a = answers[i];
        // Translate the option picked on this set back to the test's option order.
        const sel = typeof a === 'number' ? JSON.parse(row.options_json).indexOf(q.options[a]) : null;
        if (sel !== null && sel === row.correct_index) score++;
        insA.run(attemptId, row.id, sel === -1 ? null : sel);
      });
      db.prepare('UPDATE attempts SET score = ? WHERE id = ?').run(score, attemptId);
    });
  });
  run();
  res.redirect(`/tests/${testId}/results`);
});

module.exports = router;
