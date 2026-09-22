const express = require('express');
const db = require('../lib/db');
const { requireParent } = require('../lib/auth');
const { getUsage, currentMonth } = require('../lib/usage');
const { chapterBreakdownFor } = require('../lib/studentStats');
const { getFor, unreadCountFor, markAllRead } = require('../lib/notifications');

const router = express.Router();

router.get('/parent/login', (req, res) => {
  res.render('parent_login', { error: null });
});

router.post('/parent/login', (req, res) => {
  const { roll_no, parent_pin } = req.body;
  const student = db
    .prepare('SELECT * FROM students WHERE roll_no = ? AND parent_pin = ?')
    .get((roll_no || '').trim(), (parent_pin || '').trim());
  if (!student) {
    return res.render('parent_login', { error: "Roll number or PIN not recognized. Check with your child's teacher." });
  }
  req.session.parentStudentId = student.id;
  res.redirect('/parent/dashboard');
});

router.post('/parent/logout', (req, res) => {
  req.session.parentStudentId = null;
  res.redirect('/parent/login');
});

router.get('/parent/dashboard', requireParent, (req, res) => {
  const student = req.parentStudent;
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(student.batch_id);
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(batch.teacher_id);

  const history = db
    .prepare(
      `SELECT attempts.*, tests.title, tests.id AS test_id
       FROM attempts JOIN tests ON tests.id = attempts.test_id
       WHERE attempts.student_id = ? ORDER BY attempts.submitted_at DESC`
    )
    .all(student.id);

  const graded = history.filter((h) => h.status === 'graded' && h.total > 0);
  const avgPct = graded.length
    ? Math.round((graded.reduce((s, h) => s + h.score / h.total, 0) / graded.length) * 100)
    : null;

  const attendanceTotal = db.prepare('SELECT COUNT(*) AS c FROM attendance_records WHERE student_id = ?').get(student.id).c;
  const attendancePresent = db
    .prepare('SELECT COUNT(*) AS c FROM attendance_records WHERE student_id = ? AND present = 1')
    .get(student.id).c;
  const attendancePct = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null;

  const homeworkTotal = db.prepare('SELECT COUNT(*) AS c FROM homework WHERE batch_id = ?').get(batch.id).c;
  const homeworkDone = db
    .prepare('SELECT COUNT(*) AS c FROM homework_completion WHERE student_id = ? AND completed = 1')
    .get(student.id).c;

  // Reports the teacher has explicitly generated/shared for this student.
  const sharedReports = db
    .prepare(
      `SELECT report_tokens.*, tests.title AS test_title
       FROM report_tokens JOIN tests ON tests.id = report_tokens.test_id
       WHERE report_tokens.student_id = ? ORDER BY report_tokens.created_at DESC`
    )
    .all(student.id);

  const chapterBreakdown = chapterBreakdownFor(student.id);
  const notifications = getFor('parent', student.id, 8);
  const unreadCount = unreadCountFor('parent', student.id);

  res.render('parent_dashboard', {
    student,
    batch,
    teacher,
    history,
    avgPct,
    attendancePct,
    attendancePresent,
    attendanceTotal,
    homeworkDone,
    homeworkTotal,
    sharedReports,
    chapterBreakdown,
    notifications,
    unreadCount
  });
});

router.post('/parent/notifications/mark-read', requireParent, (req, res) => {
  markAllRead('parent', req.parentStudent.id);
  res.redirect('/parent/dashboard');
});

module.exports = router;
