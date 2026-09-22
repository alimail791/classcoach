const db = require('./db');
const mailer = require('./mailer');
const { chapterBreakdownFor } = require('./studentStats');

const DIGEST_INTERVAL_DAYS = 7;

// Called on teacher dashboard load. Sends at most one digest per student
// per 7-day window — same "check on natural page load, track a
// last-sent timestamp" pattern as the plan-expiry notice, so no cron
// job or background worker is needed. Silently skips a student if
// their parent contact isn't a valid email, if they've opted out, or
// if SMTP isn't configured — this never blocks or errors the page.
function sendDueDigests(teacherId) {
  if (!mailer.isConfigured()) return;

  const dueStudents = db
    .prepare(
      `SELECT students.* FROM students
       JOIN batches ON batches.id = students.batch_id
       WHERE batches.teacher_id = ?
         AND students.digest_opt_in = 1
         AND students.parent_contact LIKE '%@%'
         AND (students.last_digest_sent_at IS NULL OR datetime(students.last_digest_sent_at) <= datetime('now', '-${DIGEST_INTERVAL_DAYS} days'))`
    )
    .all(teacherId);

  dueStudents.forEach((student) => {
    try {
      sendOneDigest(student);
    } catch (err) {
      console.error(`Weekly digest failed for student ${student.id}:`, err.message);
    }
  });
}

function sendOneDigest(student) {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(student.batch_id);

  const recentAttempts = db
    .prepare(
      `SELECT attempts.*, tests.title FROM attempts
       JOIN tests ON tests.id = attempts.test_id
       WHERE attempts.student_id = ? AND attempts.status = 'graded'
       ORDER BY attempts.submitted_at DESC LIMIT 3`
    )
    .all(student.id);

  const attendanceTotal = db.prepare('SELECT COUNT(*) AS c FROM attendance_records WHERE student_id = ?').get(student.id).c;
  const attendancePresent = db
    .prepare('SELECT COUNT(*) AS c FROM attendance_records WHERE student_id = ? AND present = 1')
    .get(student.id).c;
  const attendancePct = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null;

  const chapterBreakdown = chapterBreakdownFor(student.id);
  const weakest = chapterBreakdown.find((c) => c.pct !== null && c.pct < 50);

  // Nothing meaningful to report yet (brand new student) — skip rather
  // than send an empty, useless email, but still mark it checked so we
  // don't re-check every single dashboard load.
  if (recentAttempts.length === 0 && attendanceTotal === 0) {
    db.prepare("UPDATE students SET last_digest_sent_at = datetime('now') WHERE id = ?").run(student.id);
    return;
  }

  const lines = [`Weekly update for ${student.name} (${batch.name}):`, ''];
  if (recentAttempts.length) {
    lines.push('Recent test results:');
    recentAttempts.forEach((a) => lines.push(`  - ${a.title}: ${a.score}/${a.total}`));
    lines.push('');
  }
  if (attendancePct !== null) {
    lines.push(`Attendance: ${attendancePct}% (${attendancePresent} of ${attendanceTotal} sessions)`);
    lines.push('');
  }
  if (weakest) {
    lines.push(`Chapter that could use extra practice: ${weakest.chapter} (${weakest.pct}%)`);
  }
  lines.push('', '— ClassCoach');

  mailer
    .sendPlainEmail({ to: student.parent_contact, subject: `${student.name}'s weekly update`, text: lines.join('\n') })
    .then(() => {
      db.prepare("UPDATE students SET last_digest_sent_at = datetime('now') WHERE id = ?").run(student.id);
    })
    .catch((err) => console.error(`Digest email failed for ${student.parent_contact}:`, err.message));
}

module.exports = { sendDueDigests };
