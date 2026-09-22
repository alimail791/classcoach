const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const mailer = require('../lib/mailer');
const { parseStudentFile } = require('../lib/importStudents');
const { effectiveMaxStudents, isPlanActive, getPlan, daysUntil } = require('../lib/plans');
const { getFor, unreadCountFor, markAllRead, notifyAllStudentsInBatch, notifyAllParentsInBatch } = require('../lib/notifications');
const { checkAndSendExpiryNotice } = require('../lib/expiryNotice');
const { sendDueDigests } = require('../lib/weeklyDigest');

const router = express.Router();

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    if (!ok) return cb(new Error('Please upload a .csv or .xlsx file.'));
    cb(null, true);
  }
});

router.get('/dashboard', requireTeacher, (req, res) => {
  db.autoPublishDueTests();
  checkAndSendExpiryNotice(req.teacher);
  sendDueDigests(req.teacher.id);
  const notifications = getFor('teacher', req.teacher.id, 8);
  const unreadCount = unreadCountFor('teacher', req.teacher.id);
  const batches = db
    .prepare('SELECT * FROM batches WHERE teacher_id = ? ORDER BY created_at DESC')
    .all(req.teacher.id)
    .map((b) => {
      const studentCount = db.prepare('SELECT COUNT(*) AS c FROM students WHERE batch_id = ?').get(b.id).c;
      const testCount = db.prepare('SELECT COUNT(*) AS c FROM tests WHERE batch_id = ?').get(b.id).c;
      return { ...b, studentCount, testCount };
    });

  const publishedTests = db
    .prepare(
      `SELECT tests.*, batches.name AS batch_name FROM tests
       JOIN batches ON batches.id = tests.batch_id
       WHERE tests.teacher_id = ? AND tests.status = 'published'
       ORDER BY tests.created_at DESC LIMIT 5`
    )
    .all(req.teacher.id);

  // Recent tests across every batch, any status — for the "Recent tests" widget.
  const recentTests = db
    .prepare(
      `SELECT tests.*, batches.name AS batch_name FROM tests
       JOIN batches ON batches.id = tests.batch_id
       WHERE tests.teacher_id = ?
       ORDER BY tests.created_at DESC LIMIT 5`
    )
    .all(req.teacher.id)
    .map((t) => {
      const questionCount = db.prepare('SELECT COUNT(*) AS c FROM questions WHERE test_id = ?').get(t.id).c;
      const attemptCount = db.prepare('SELECT COUNT(*) AS c FROM attempts WHERE test_id = ?').get(t.id).c;
      const pendingCount = db
        .prepare("SELECT COUNT(*) AS c FROM attempts WHERE test_id = ? AND status = 'pending'")
        .get(t.id).c;
      let label, badgeClass;
      if (t.status === 'draft') {
        label = questionCount === 0 ? 'Draft — no questions yet' : 'Draft';
        badgeClass = 'badge-neutral';
      } else if (pendingCount > 0) {
        label = `${pendingCount} to grade`;
        badgeClass = 'badge-warm';
      } else if (attemptCount > 0) {
        label = 'Graded';
        badgeClass = 'badge-good';
      } else {
        label = 'Published — no attempts yet';
        badgeClass = 'badge-neutral';
      }
      return { ...t, questionCount, attemptCount, label, badgeClass };
    });

  // Chapter-wise performance across every graded answer this teacher has, on their most active batch.
  const activeBatch = batches[0] || null;
  let chapterBreakdown = [];
  if (activeBatch) {
    const answers = db
      .prepare(
        `SELECT answers.*, questions.chapter, questions.correct_index, questions.type, questions.max_marks
         FROM answers
         JOIN questions ON questions.id = answers.question_id
         JOIN attempts ON attempts.id = answers.attempt_id
         JOIN tests ON tests.id = attempts.test_id
         WHERE tests.batch_id = ?`
      )
      .all(activeBatch.id);
    const chapterStats = {};
    answers.forEach((a) => {
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
    chapterBreakdown = Object.entries(chapterStats)
      .map(([chapter, s]) => ({ chapter, pct: s.total ? Math.round((s.correct / s.total) * 100) : null }))
      .sort((a, b) => (a.pct === null ? 1 : a.pct) - (b.pct === null ? 1 : b.pct));
  }

  const toGrade = db
    .prepare(
      `SELECT COUNT(*) AS c FROM attempts
       JOIN tests ON tests.id = attempts.test_id
       WHERE tests.teacher_id = ? AND attempts.status = 'pending'`
    )
    .get(req.teacher.id).c;
  const reportsSent = db
    .prepare(
      `SELECT COUNT(*) AS c FROM attempts
       JOIN tests ON tests.id = attempts.test_id
       WHERE tests.teacher_id = ?`
    )
    .get(req.teacher.id).c;

  const planName = (getPlan(req.teacher.plan) || {}).name || req.teacher.plan;
  const expiryDays = daysUntil(req.teacher.plan_expires_at);
  const planActive = isPlanActive(req.teacher);

  res.render('dashboard', {
    teacher: req.teacher,
    batches,
    publishedTests,
    recentTests,
    chapterBreakdown,
    activeBatch,
    toGrade,
    reportsSent,
    planName,
    expiryDays,
    planActive,
    notifications,
    unreadCount
  });
});

router.post('/batches/:id/notify', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');
  const message = (req.body.message || '').trim();
  if (!message) return res.redirect(`/batches/${batch.id}`);

  if (req.body.audience === 'parents' || req.body.audience === 'both') {
    notifyAllParentsInBatch(batch.id, message, req.teacher.name);
  }
  if (req.body.audience === 'students' || req.body.audience === 'both' || !req.body.audience) {
    notifyAllStudentsInBatch(batch.id, message, req.teacher.name);
  }
  res.redirect(`/batches/${batch.id}?notified=1`);
});

router.post('/notifications/mark-read', requireTeacher, (req, res) => {
  markAllRead('teacher', req.teacher.id);
  res.redirect('/dashboard');
});

router.post('/batches', requireTeacher, (req, res) => {
  const { name, subject } = req.body;
  if (!name) return res.redirect('/dashboard');
  const joinCode = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  db.prepare('INSERT INTO batches (teacher_id, name, subject, join_code) VALUES (?, ?, ?, ?)').run(
    req.teacher.id,
    name.trim(),
    (subject || '').trim(),
    joinCode
  );
  res.redirect('/dashboard');
});

router.get('/batches/:id', requireTeacher, (req, res) => {
  db.autoPublishDueTests();
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');

  const students = db.prepare('SELECT * FROM students WHERE batch_id = ? ORDER BY roll_no').all(batch.id);
  const tests = db.prepare('SELECT * FROM tests WHERE batch_id = ? ORDER BY created_at DESC').all(batch.id);
  const materials = db.prepare('SELECT * FROM materials WHERE batch_id = ? ORDER BY created_at DESC').all(batch.id);

  res.render('batch', { teacher: req.teacher, batch, students, tests, materials, error: null, importResult: null, notified: req.query.notified || null });
});

router.post('/batches/:id/students', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');

  const { name, roll_no, phone, parent_name, parent_phone, parent_contact } = req.body;
  if (!name || !roll_no || !phone || !parent_phone || !parent_contact) {
    return renderBatchWithError(req, res, 'Name, roll number, student phone, parent phone, and parent email are all required.');
  }

  const totalStudents = db
    .prepare(
      `SELECT COUNT(*) AS c FROM students
       JOIN batches ON batches.id = students.batch_id
       WHERE batches.teacher_id = ?`
    )
    .get(req.teacher.id).c;
  const limits = { maxStudents: effectiveMaxStudents(req.teacher, totalStudents) };
  if (totalStudents >= limits.maxStudents) {
    const msg = isPlanActive(req.teacher)
      ? `You've reached your plan's limit of ${limits.maxStudents} students. Ask your admin to raise it.`
      : `Your plan has expired, so no new students can be added. Ask your admin to renew.`;
    return renderBatchWithError(req, res, msg);
  }

  const pin = crypto.randomInt(1000, 9999).toString();
  const parentPin = crypto.randomInt(1000, 9999).toString();
  try {
    db.prepare(
      'INSERT INTO students (batch_id, name, roll_no, pin, parent_pin, phone, parent_name, parent_phone, parent_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      batch.id,
      name.trim(),
      roll_no.trim(),
      pin,
      parentPin,
      (phone || '').trim(),
      (parent_name || '').trim(),
      (parent_phone || '').trim(),
      (parent_contact || '').trim()
    );
  } catch (e) {
    const students = db.prepare('SELECT * FROM students WHERE batch_id = ? ORDER BY roll_no').all(batch.id);
    const tests = db.prepare('SELECT * FROM tests WHERE batch_id = ? ORDER BY created_at DESC').all(batch.id);
    const materials = db.prepare('SELECT * FROM materials WHERE batch_id = ? ORDER BY created_at DESC').all(batch.id);
    return res.render('batch', {
      teacher: req.teacher,
      batch,
      students,
      tests,
      materials,
      importResult: null,
      notified: null,
      error: 'That roll number is already used in this batch.'
    });
  }
  res.redirect(`/batches/${batch.id}`);
});

router.post('/batches/:batchId/students/:studentId/delete', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');
  const student = db.prepare('SELECT * FROM students WHERE id = ? AND batch_id = ?').get(req.params.studentId, batch.id);
  if (!student) return res.status(404).send('Student not found');

  db.prepare('DELETE FROM students WHERE id = ?').run(student.id);
  res.redirect(`/batches/${batch.id}`);
});

router.post('/batches/:id/students/import', requireTeacher, (req, res, next) => {
  importUpload.single('student_file')(req, res, (err) => {
    if (err) return renderBatchWithError(req, res, err.message);
    next();
  });
}, async (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');
  if (!req.file) return renderBatchWithError(req, res, 'Choose a .csv or .xlsx file first.');

  let rows;
  try {
    rows = await parseStudentFile(req.file.buffer, req.file.originalname);
  } catch (err) {
    return renderBatchWithError(req, res, err.message);
  }

  const insert = db.prepare(
    'INSERT INTO students (batch_id, name, roll_no, pin, parent_pin, phone, parent_name, parent_phone, parent_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const currentTotal = db
    .prepare(
      `SELECT COUNT(*) AS c FROM students
       JOIN batches ON batches.id = students.batch_id
       WHERE batches.teacher_id = ?`
    )
    .get(req.teacher.id).c;
  const importLimits = { maxStudents: effectiveMaxStudents(req.teacher, currentTotal) };
  let remaining = Math.max(0, importLimits.maxStudents - currentTotal);

  let imported = 0;
  const skipped = [];
  rows.forEach((r) => {
    if (!r.name || !r.roll_no) {
      skipped.push(`Row missing name or roll number`);
      return;
    }
    if (remaining <= 0) {
      skipped.push(`${r.name} (roll ${r.roll_no}) — plan limit of ${importLimits.maxStudents} students reached`);
      return;
    }
    try {
      insert.run(
        batch.id,
        r.name,
        r.roll_no,
        crypto.randomInt(1000, 9999).toString(),
        crypto.randomInt(1000, 9999).toString(),
        r.phone || '',
        r.parent_name || '',
        r.parent_phone || '',
        r.parent_contact || ''
      );
      imported += 1;
      remaining -= 1;
    } catch (e) {
      skipped.push(`${r.name} (roll ${r.roll_no}) — roll number already used`);
    }
  });

  const students = db.prepare('SELECT * FROM students WHERE batch_id = ? ORDER BY roll_no').all(batch.id);
  const tests = db.prepare('SELECT * FROM tests WHERE batch_id = ? ORDER BY created_at DESC').all(batch.id);
  const materials = db.prepare('SELECT * FROM materials WHERE batch_id = ? ORDER BY created_at DESC').all(batch.id);
  res.render('batch', {
    teacher: req.teacher,
    batch,
    students,
    tests,
    materials,
    error: null,
    importResult: { imported, skipped },
    notified: null
  });
});

function renderBatchWithError(req, res, message) {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  const students = db.prepare('SELECT * FROM students WHERE batch_id = ? ORDER BY roll_no').all(batch.id);
  const tests = db.prepare('SELECT * FROM tests WHERE batch_id = ? ORDER BY created_at DESC').all(batch.id);
  const materials = db.prepare('SELECT * FROM materials WHERE batch_id = ? ORDER BY created_at DESC').all(batch.id);
  res.render('batch', { teacher: req.teacher, batch, students, tests, materials, error: message, importResult: null, notified: null });
}

router.get('/batches/:batchId/students/:studentId/edit', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');
  const student = db.prepare('SELECT * FROM students WHERE id = ? AND batch_id = ?').get(req.params.studentId, batch.id);
  if (!student) return res.status(404).send('Student not found');
  res.render('student_edit', { teacher: req.teacher, batch, student, error: null });
});

router.post('/batches/:batchId/students/:studentId/edit', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');
  const student = db.prepare('SELECT * FROM students WHERE id = ? AND batch_id = ?').get(req.params.studentId, batch.id);
  if (!student) return res.status(404).send('Student not found');

  const { name, roll_no, phone, parent_name, parent_phone, parent_contact, digest_opt_in } = req.body;
  if (!name || !roll_no || !phone || !parent_phone || !parent_contact) {
    return res.render('student_edit', {
      teacher: req.teacher,
      batch,
      student: { ...student, name, roll_no, phone, parent_name, parent_phone, parent_contact },
      error: 'Name, roll number, student phone, parent phone, and parent email are all required.'
    });
  }

  try {
    db.prepare(
      'UPDATE students SET name = ?, roll_no = ?, phone = ?, parent_name = ?, parent_phone = ?, parent_contact = ?, digest_opt_in = ? WHERE id = ?'
    ).run(
      name.trim(),
      roll_no.trim(),
      phone.trim(),
      (parent_name || '').trim(),
      parent_phone.trim(),
      parent_contact.trim(),
      digest_opt_in ? 1 : 0,
      student.id
    );
  } catch (e) {
    return res.render('student_edit', {
      teacher: req.teacher,
      batch,
      student: { ...student, name, roll_no, phone, parent_name, parent_phone, parent_contact },
      error: 'That roll number is already used by another student in this class.'
    });
  }
  res.redirect(`/batches/${batch.id}/students/${student.id}`);
});

router.get('/batches/:batchId/students/:studentId', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');
  const student = db.prepare('SELECT * FROM students WHERE id = ? AND batch_id = ?').get(req.params.studentId, batch.id);
  if (!student) return res.status(404).send('Student not found');

  const history = db
    .prepare(
      `SELECT attempts.*, tests.title, tests.chapter AS test_chapter
       FROM attempts JOIN tests ON tests.id = attempts.test_id
       WHERE attempts.student_id = ? ORDER BY attempts.submitted_at DESC`
    )
    .all(student.id);

  const graded = history.filter((h) => h.status === 'graded' && h.total > 0);
  const avgPct = graded.length
    ? Math.round((graded.reduce((s, h) => s + h.score / h.total, 0) / graded.length) * 100)
    : null;

  const thisMonthPrefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const gradedThisMonth = graded.filter((h) => h.submitted_at.slice(0, 7) === thisMonthPrefix);
  const thisMonthAvgPct = gradedThisMonth.length
    ? Math.round((gradedThisMonth.reduce((s, h) => s + h.score / h.total, 0) / gradedThisMonth.length) * 100)
    : null;
  const testsThisMonth = history.filter((h) => h.submitted_at.slice(0, 7) === thisMonthPrefix).length;

  const historyWithReports = history.map((h) => {
    const token = db.prepare('SELECT token FROM report_tokens WHERE test_id = ? AND student_id = ?').get(h.test_id, student.id);
    return { ...h, reportToken: token ? token.token : null };
  });

  const answers = db
    .prepare(
      `SELECT answers.*, questions.chapter, questions.correct_index, questions.type, questions.max_marks
       FROM answers
       JOIN questions ON questions.id = answers.question_id
       JOIN attempts ON attempts.id = answers.attempt_id
       WHERE attempts.student_id = ?`
    )
    .all(student.id);

  const chapterStats = {};
  answers.forEach((a) => {
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
  const chapterBreakdown = Object.entries(chapterStats)
    .map(([chapter, s]) => ({ chapter, pct: s.total ? Math.round((s.correct / s.total) * 100) : null }))
    .sort((a, b) => (a.pct === null ? 1 : a.pct) - (b.pct === null ? 1 : b.pct));

  const weakest = chapterBreakdown.find((c) => c.pct !== null);

  const attendanceTotal = db
    .prepare('SELECT COUNT(*) AS c FROM attendance_records WHERE student_id = ?')
    .get(student.id).c;
  const attendancePresent = db
    .prepare('SELECT COUNT(*) AS c FROM attendance_records WHERE student_id = ? AND present = 1')
    .get(student.id).c;
  const attendancePct = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null;

  const homeworkTotal = db.prepare('SELECT COUNT(*) AS c FROM homework WHERE batch_id = ?').get(batch.id).c;
  const homeworkDone = db
    .prepare('SELECT COUNT(*) AS c FROM homework_completion WHERE student_id = ? AND completed = 1')
    .get(student.id).c;

  const practiceRecommendations = db
    .prepare(
      `SELECT practice_recommendations.*, materials.title AS material_title
       FROM practice_recommendations JOIN materials ON materials.id = practice_recommendations.material_id
       WHERE practice_recommendations.student_id = ? ORDER BY practice_recommendations.created_at DESC`
    )
    .all(student.id);

  res.render('student_profile', {
    teacher: req.teacher,
    batch,
    student,
    history: historyWithReports,
    avgPct,
    thisMonthAvgPct,
    testsThisMonth,
    chapterBreakdown,
    weakest,
    attendancePct,
    attendancePresent,
    attendanceTotal,
    homeworkDone,
    homeworkTotal,
    emailConfigured: mailer.isConfigured(),
    looksLikeEmail: mailer.looksLikeEmail,
    sent: req.query.sent || null,
    mailError: req.query.mailError || null,
    practiceRecommendations,
    practiceGenerated: req.query.practiceGenerated || null,
    practiceError: req.query.practiceError || null
  });
});

router.get('/help', requireTeacher, (req, res) => {
  res.render('help', { teacher: req.teacher });
});

router.get('/compare', requireTeacher, (req, res) => {
  const batches = db
    .prepare('SELECT * FROM batches WHERE teacher_id = ? ORDER BY created_at ASC')
    .all(req.teacher.id)
    .map((b) => {
      const studentCount = db.prepare('SELECT COUNT(*) AS c FROM students WHERE batch_id = ?').get(b.id).c;
      const testCount = db.prepare('SELECT COUNT(*) AS c FROM tests WHERE batch_id = ?').get(b.id).c;

      const scoreRow = db
        .prepare(
          `SELECT AVG(1.0 * score / total) AS avgFrac FROM attempts
           JOIN tests ON tests.id = attempts.test_id
           WHERE tests.batch_id = ? AND attempts.status = 'graded' AND attempts.total > 0`
        )
        .get(b.id);
      const avgScorePct = scoreRow.avgFrac === null ? null : Math.round(scoreRow.avgFrac * 100);

      const attendanceRow = db
        .prepare(
          `SELECT AVG(1.0 * present) AS avgPresent FROM attendance_records
           JOIN attendance_sessions ON attendance_sessions.id = attendance_records.session_id
           WHERE attendance_sessions.batch_id = ?`
        )
        .get(b.id);
      const avgAttendancePct = attendanceRow.avgPresent === null ? null : Math.round(attendanceRow.avgPresent * 100);

      // Chapter-level weak spots, aggregated across every student in this batch.
      const chapterRows = db
        .prepare(
          `SELECT questions.chapter, questions.type, questions.correct_index, questions.max_marks,
                  answers.selected_index, answers.marks_awarded
           FROM answers
           JOIN questions ON questions.id = answers.question_id
           JOIN attempts ON attempts.id = answers.attempt_id
           JOIN tests ON tests.id = attempts.test_id
           WHERE tests.batch_id = ?`
        )
        .all(b.id);
      const chapterStats = {};
      chapterRows.forEach((r) => {
        const chap = r.chapter || 'General';
        if (!chapterStats[chap]) chapterStats[chap] = { correct: 0, total: 0 };
        if (r.type === 'mcq') {
          chapterStats[chap].total += 1;
          if (r.selected_index === r.correct_index) chapterStats[chap].correct += 1;
        } else if (r.marks_awarded !== null && r.marks_awarded !== undefined) {
          chapterStats[chap].total += 1;
          if (r.marks_awarded >= r.max_marks * 0.5) chapterStats[chap].correct += 1;
        }
      });
      const chapterList = Object.entries(chapterStats)
        .map(([chapter, s]) => ({ chapter, pct: s.total ? Math.round((s.correct / s.total) * 100) : null }))
        .sort((a, b2) => (a.pct === null ? 1 : a.pct) - (b2.pct === null ? 1 : b2.pct));
      const weakestChapter = chapterList.find((c) => c.pct !== null) || null;

      return { ...b, studentCount, testCount, avgScorePct, avgAttendancePct, weakestChapter };
    });

  res.render('compare', { teacher: req.teacher, batches });
});

router.get('/classes', requireTeacher, (req, res) => {
  const batches = db
    .prepare('SELECT * FROM batches WHERE teacher_id = ? ORDER BY created_at DESC')
    .all(req.teacher.id)
    .map((b) => {
      const studentCount = db.prepare('SELECT COUNT(*) AS c FROM students WHERE batch_id = ?').get(b.id).c;
      const testCount = db.prepare('SELECT COUNT(*) AS c FROM tests WHERE batch_id = ?').get(b.id).c;
      return { ...b, studentCount, testCount };
    });
  res.render('classes', { teacher: req.teacher, batches });
});

router.get('/students', requireTeacher, (req, res) => {
  const students = db
    .prepare(
      `SELECT students.*, batches.name AS batch_name, batches.id AS batch_id
       FROM students JOIN batches ON batches.id = students.batch_id
       WHERE batches.teacher_id = ? ORDER BY batches.name, students.roll_no`
    )
    .all(req.teacher.id);
  res.render('students_hub', { teacher: req.teacher, students });
});

module.exports = router;
