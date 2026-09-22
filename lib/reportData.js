const db = require('./db');

// Builds everything a report page needs (public or teacher-side preview)
// from a report_tokens row. Returns null if the underlying data is missing.
function buildReportData(tokenRow) {
  const test = db.prepare('SELECT * FROM tests WHERE id = ?').get(tokenRow.test_id);
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(tokenRow.student_id);
  if (!test || !student) return null;

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(test.batch_id);
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(test.teacher_id);
  const attempt = db.prepare('SELECT * FROM attempts WHERE test_id = ? AND student_id = ?').get(test.id, student.id);
  if (!attempt) return null;

  const answers = db
    .prepare(
      `SELECT answers.*, questions.chapter, questions.correct_index, questions.type, questions.max_marks
       FROM answers JOIN questions ON questions.id = answers.question_id
       WHERE answers.attempt_id = ?`
    )
    .all(attempt.id);

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
  const chapterBreakdown = Object.entries(chapterStats).map(([chapter, s]) => ({
    chapter,
    pct: s.total ? Math.round((s.correct / s.total) * 100) : null
  }));

  return { test, student, batch, teacher, attempt, chapterBreakdown, note: tokenRow.note };
}

module.exports = { buildReportData };
