const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// --- ATTENDANCE ---

router.get('/batches/:batchId/attendance', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');

  const date = req.query.date || todayStr();
  const students = db.prepare('SELECT * FROM students WHERE batch_id = ? ORDER BY roll_no').all(batch.id);

  const session = db.prepare('SELECT * FROM attendance_sessions WHERE batch_id = ? AND session_date = ?').get(batch.id, date);
  const records = session
    ? db.prepare('SELECT * FROM attendance_records WHERE session_id = ?').all(session.id)
    : [];
  const recordMap = {};
  records.forEach((r) => { recordMap[r.student_id] = r.present; });

  const rows = students.map((s) => ({
    ...s,
    present: session ? !!recordMap[s.id] : true // default new sessions to "present" — teacher unchecks absentees
  }));

  const recentSessions = db
    .prepare('SELECT * FROM attendance_sessions WHERE batch_id = ? ORDER BY session_date DESC LIMIT 10')
    .all(batch.id)
    .map((s) => {
      const total = db.prepare('SELECT COUNT(*) AS c FROM attendance_records WHERE session_id = ?').get(s.id).c;
      const present = db.prepare('SELECT COUNT(*) AS c FROM attendance_records WHERE session_id = ? AND present = 1').get(s.id).c;
      return { ...s, total, present };
    });

  res.render('attendance', { teacher: req.teacher, batch, date, rows, hasSession: !!session, recentSessions });
});

router.post('/batches/:batchId/attendance', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');

  const date = req.body.date || todayStr();
  const students = db.prepare('SELECT * FROM students WHERE batch_id = ?').all(batch.id);

  let session = db.prepare('SELECT * FROM attendance_sessions WHERE batch_id = ? AND session_date = ?').get(batch.id, date);
  if (!session) {
    const info = db.prepare('INSERT INTO attendance_sessions (batch_id, session_date) VALUES (?, ?)').run(batch.id, date);
    session = { id: info.lastInsertRowid };
  }

  const upsert = db.prepare(
    `INSERT INTO attendance_records (session_id, student_id, present) VALUES (?, ?, ?)
     ON CONFLICT(session_id, student_id) DO UPDATE SET present = excluded.present`
  );
  students.forEach((s) => {
    const present = req.body['present_' + s.id] ? 1 : 0;
    upsert.run(session.id, s.id, present);
  });

  res.redirect(`/batches/${batch.id}/attendance?date=${date}`);
});

// --- HOMEWORK ---

router.get('/batches/:batchId/homework', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');

  const studentCount = db.prepare('SELECT COUNT(*) AS c FROM students WHERE batch_id = ?').get(batch.id).c;
  const homework = db
    .prepare('SELECT * FROM homework WHERE batch_id = ? ORDER BY due_date DESC, created_at DESC')
    .all(batch.id)
    .map((h) => {
      const completed = db.prepare('SELECT COUNT(*) AS c FROM homework_completion WHERE homework_id = ? AND completed = 1').get(h.id).c;
      return { ...h, completed, studentCount };
    });

  res.render('homework_list', { teacher: req.teacher, batch, homework, error: null });
});

router.post('/batches/:batchId/homework', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');

  const { title, chapter, due_date } = req.body;
  if (!title || !title.trim()) {
    const studentCount = db.prepare('SELECT COUNT(*) AS c FROM students WHERE batch_id = ?').get(batch.id).c;
    const homework = db.prepare('SELECT * FROM homework WHERE batch_id = ? ORDER BY due_date DESC').all(batch.id)
      .map((h) => ({ ...h, completed: 0, studentCount }));
    return res.render('homework_list', { teacher: req.teacher, batch, homework, error: 'Give the assignment a title.' });
  }

  db.prepare('INSERT INTO homework (teacher_id, batch_id, title, chapter, due_date) VALUES (?, ?, ?, ?, ?)').run(
    req.teacher.id,
    batch.id,
    title.trim(),
    (chapter || '').trim(),
    (due_date || '').trim()
  );
  res.redirect(`/batches/${batch.id}/homework`);
});

router.get('/homework/:id/mark', requireTeacher, (req, res) => {
  const homework = db
    .prepare('SELECT * FROM homework WHERE id = ? AND teacher_id = ?')
    .get(req.params.id, req.teacher.id);
  if (!homework) return res.status(404).send('Not found');
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(homework.batch_id);

  const students = db.prepare('SELECT * FROM students WHERE batch_id = ? ORDER BY roll_no').all(homework.batch_id);
  const completions = db.prepare('SELECT * FROM homework_completion WHERE homework_id = ?').all(homework.id);
  const doneMap = {};
  completions.forEach((c) => { doneMap[c.student_id] = !!c.completed; });

  const rows = students.map((s) => ({ ...s, completed: !!doneMap[s.id] }));

  res.render('homework_mark', { teacher: req.teacher, batch, homework, rows });
});

router.post('/homework/:id/mark', requireTeacher, (req, res) => {
  const homework = db
    .prepare('SELECT * FROM homework WHERE id = ? AND teacher_id = ?')
    .get(req.params.id, req.teacher.id);
  if (!homework) return res.status(404).send('Not found');

  const students = db.prepare('SELECT * FROM students WHERE batch_id = ?').all(homework.batch_id);
  const upsert = db.prepare(
    `INSERT INTO homework_completion (homework_id, student_id, completed) VALUES (?, ?, ?)
     ON CONFLICT(homework_id, student_id) DO UPDATE SET completed = excluded.completed`
  );
  students.forEach((s) => {
    const completed = req.body['done_' + s.id] ? 1 : 0;
    upsert.run(homework.id, s.id, completed);
  });

  res.redirect(`/batches/${homework.batch_id}/homework`);
});

router.post('/homework/:id/delete', requireTeacher, (req, res) => {
  const homework = db
    .prepare('SELECT * FROM homework WHERE id = ? AND teacher_id = ?')
    .get(req.params.id, req.teacher.id);
  if (!homework) return res.status(404).send('Not found');
  db.prepare('DELETE FROM homework WHERE id = ?').run(homework.id);
  res.redirect(`/batches/${homework.batch_id}/homework`);
});

module.exports = router;
