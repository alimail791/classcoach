const db = require('./db');

// Chapter-wise performance aggregated across every attempt a student has
// made in their batch. Shared by the teacher's student-profile page, the
// parent dashboard, and the student's own dashboard, so all three show
// the exact same numbers.
function chapterBreakdownFor(studentId) {
  const answers = db
    .prepare(
      `SELECT answers.*, questions.chapter, questions.correct_index, questions.type, questions.max_marks
       FROM answers
       JOIN questions ON questions.id = answers.question_id
       JOIN attempts ON attempts.id = answers.attempt_id
       WHERE attempts.student_id = ?`
    )
    .all(studentId);

  const stats = {};
  answers.forEach((a) => {
    const chap = a.chapter || 'General';
    if (!stats[chap]) stats[chap] = { correct: 0, total: 0 };
    if (a.type === 'mcq') {
      stats[chap].total += 1;
      if (a.selected_index === a.correct_index) stats[chap].correct += 1;
    } else if (a.marks_awarded !== null && a.marks_awarded !== undefined) {
      stats[chap].total += 1;
      if (a.marks_awarded >= a.max_marks * 0.5) stats[chap].correct += 1;
    }
  });

  return Object.entries(stats)
    .map(([chapter, s]) => ({ chapter, pct: s.total ? Math.round((s.correct / s.total) * 100) : null }))
    .sort((a, b) => (a.pct === null ? 1 : a.pct) - (b.pct === null ? 1 : b.pct));
}

module.exports = { chapterBreakdownFor };
