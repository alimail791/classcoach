// Populates the database with realistic demo data covering every feature,
// so you can explore the app without setting anything up by hand.
//
// WARNING: this deletes classcoach.sqlite and starts fresh. Don't run it
// against data you want to keep.
//
// Usage: npm run seed

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'classcoach.sqlite');
['', '-wal', '-shm'].forEach((suffix) => {
  const p = dbPath + suffix;
  if (fs.existsSync(p)) fs.unlinkSync(p);
});

const db = require('./lib/db'); // creates a fresh schema against the deleted file

function isoDaysAgo(days, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function isoDaysFromNow(days, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function dateOnlyDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

console.log('Seeding demo data...\n');

// --- Teacher ---
const teacherHash = bcrypt.hashSync('demo1234', 10);
const teacherId = db
  .prepare(
    `INSERT INTO teachers (name, email, phone, password_hash, plan, max_students, ai_limit_monthly, plan_expires_at, email_verified, referral_code)
     VALUES (?, ?, ?, ?, 'growth', 50, 100, ?, 1, ?)`
  )
  .run('Ritu Kapoor', 'ritu@demo.com', '+91 98765 43210', teacherHash, isoDaysFromNow(150), 'ritudemo2026').lastInsertRowid;
console.log('Teacher:      ritu@demo.com / demo1234');

// --- Batches ---
const batchAId = db
  .prepare("INSERT INTO batches (teacher_id, name, subject) VALUES (?, 'Class 11 · Batch A', 'Physics')")
  .run(teacherId).lastInsertRowid;
const batchBId = db
  .prepare("INSERT INTO batches (teacher_id, name, subject) VALUES (?, 'Class 12 · Batch B', 'Chemistry')")
  .run(teacherId).lastInsertRowid;
console.log('Classes:      Class 11 · Batch A (Physics), Class 12 · Batch B (Chemistry)');

// --- Students ---
const insertStudent = db.prepare(
  `INSERT INTO students (batch_id, name, roll_no, pin, phone, parent_name, parent_phone, parent_contact, parent_pin)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const batchAStudents = [
  ['Ananya Verma', '11', '9876543201', 'Mr. Verma', '9876543301', 'verma.parent@example.com'],
  ['Rohit Sharma', '12', '9876543202', 'Mrs. Sharma', '9876543302', 'sharma.parent@example.com'],
  ['Priya Nair', '13', '9876543203', 'Mr. Nair', '9876543303', 'nair.parent@example.com'],
  ['Karthik Iyer', '14', '9876543204', 'Mrs. Iyer', '9876543304', 'iyer.parent@example.com'],
  ['Fathima Rasheed', '15', '9876543205', 'Mr. Rasheed', '9876543305', 'rasheed.parent@example.com'],
  ['Aditya Singh', '16', '9876543206', 'Mrs. Singh', '9876543306', 'singh.parent@example.com']
];
const batchBStudents = [
  ['Sneha Reddy', '21', '9876543211', 'Mr. Reddy', '9876543311', 'reddy.parent@example.com'],
  ['Vikram Rao', '22', '9876543212', 'Mrs. Rao', '9876543312', 'rao.parent@example.com'],
  ['Meera Pillai', '23', '9876543213', 'Mr. Pillai', '9876543313', 'pillai.parent@example.com'],
  ['Arjun Menon', '24', '9876543214', 'Mrs. Menon', '9876543314', 'menon.parent@example.com']
];

const studentIds = { A: [], B: [] };
batchAStudents.forEach(([name, roll, phone, pname, pphone, pcontact], i) => {
  const pin = String(1101 + i);
  const parentPin = String(2101 + i);
  const id = insertStudent.run(batchAId, name, roll, pin, phone, pname, pphone, pcontact, parentPin).lastInsertRowid;
  studentIds.A.push({ id, name, roll, pin, parentPin });
});
batchBStudents.forEach(([name, roll, phone, pname, pphone, pcontact], i) => {
  const pin = String(1201 + i);
  const parentPin = String(2201 + i);
  const id = insertStudent.run(batchBId, name, roll, pin, phone, pname, pphone, pcontact, parentPin).lastInsertRowid;
  studentIds.B.push({ id, name, roll, pin, parentPin });
});
console.log(`Students:     ${batchAStudents.length} in Batch A, ${batchBStudents.length} in Batch B (see table below)`);

// --- Tests: Batch A ---
const insertTest = db.prepare(
  `INSERT INTO tests (teacher_id, batch_id, title, chapter, duration_minutes, status, scheduled_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertQuestion = db.prepare(
  `INSERT INTO questions (test_id, type, text, options_json, correct_index, max_marks, chapter, position)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertAttempt = db.prepare(
  `INSERT INTO attempts (test_id, student_id, score, total, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?)`
);
const insertAnswer = db.prepare(
  `INSERT INTO answers (attempt_id, question_id, selected_index, text_answer, marks_awarded) VALUES (?, ?, ?, ?, ?)`
);

// Test 1: Gravitation Quiz — published, fully graded, mixed scores + one descriptive
const gravId = insertTest.run(teacherId, batchAId, 'Gravitation — Chapter Test', 'Gravitation', 30, 'published', null, isoDaysAgo(6)).lastInsertRowid;
const gravQ = [
  insertQuestion.run(gravId, 'mcq', "What is the value of g at Earth's surface (approx.)?", JSON.stringify(['4.9 m/s²', '9.8 m/s²', '12.6 m/s²', '1 m/s²']), 1, 1, 'Gravitation', 0).lastInsertRowid,
  insertQuestion.run(gravId, 'mcq', 'Escape velocity depends on which quantities?', JSON.stringify(['Mass and radius of the planet', "Mass of the object and planet's mass", 'Radius and rotation speed', 'Temperature and radius']), 0, 1, 'Gravitation', 1).lastInsertRowid,
  insertQuestion.run(gravId, 'mcq', 'A satellite in a higher orbit has:', JSON.stringify(['Higher speed', 'Lower speed', 'Same speed', 'Zero speed']), 1, 1, 'Gravitation', 2).lastInsertRowid,
  insertQuestion.run(gravId, 'mcq', "Newton's law of gravitation force is proportional to:", JSON.stringify(['1/r', '1/r²', '1/r³', 'r²']), 1, 1, 'Gravitation', 3).lastInsertRowid,
  insertQuestion.run(gravId, 'descriptive', 'Explain why astronauts feel weightless in orbit.', '[]', -1, 5, 'Gravitation', 4).lastInsertRowid
];
const gravAnswers = [
  { student: 0, mcq: [1, 0, 1, 1], desc: 'They are in free fall around Earth, so there is no normal force pushing back on them.', marks: 5 },
  { student: 1, mcq: [1, 0, 0, 1], desc: 'Gravity is very weak in space so they float.', marks: 2 },
  { student: 2, mcq: [0, 0, 1, 1], desc: 'Because the spacecraft and astronaut fall towards Earth at the same rate, there is no relative force between them.', marks: 4 },
  { student: 3, mcq: [1, 0, 1, 0], desc: null, marks: null } // still pending
];
gravAnswers.forEach((a) => {
  const st = studentIds.A[a.student];
  const total = gravQ.length - 1 + 5; // 4 mcq (1 mark each) + 5 for descriptive
  let mcqScore = 0;
  const attemptId = insertAttempt.run(gravId, st.id, 0, total, a.marks === null ? 'pending' : 'graded', isoDaysAgo(5)).lastInsertRowid;
  a.mcq.forEach((sel, i) => {
    const correct = [1, 0, 1, 1][i];
    if (sel === correct) mcqScore += 1;
    insertAnswer.run(attemptId, gravQ[i], sel, null, null);
  });
  insertAnswer.run(attemptId, gravQ[4], null, a.desc, a.marks);
  const score = mcqScore + (a.marks || 0);
  db.prepare('UPDATE attempts SET score = ? WHERE id = ?').run(score, attemptId);
});
console.log('Test:         Gravitation — Chapter Test (published, 4 attempts, 1 pending descriptive grading)');

// Test 2: Newton's Laws — published, fully graded (MCQ only)
const newtonId = insertTest.run(teacherId, batchAId, "Newton's Laws — Practice Set", "Newton's Laws", 20, 'published', null, isoDaysAgo(12)).lastInsertRowid;
const newtonQ = [
  insertQuestion.run(newtonId, 'mcq', "An object at rest stays at rest unless acted on by a force. This is Newton's:", JSON.stringify(['First law', 'Second law', 'Third law', 'Law of gravitation']), 0, 1, "Newton's Laws", 0).lastInsertRowid,
  insertQuestion.run(newtonId, 'mcq', 'F = ma is which law?', JSON.stringify(['First', 'Second', 'Third', 'None']), 1, 1, "Newton's Laws", 1).lastInsertRowid,
  insertQuestion.run(newtonId, 'mcq', 'Every action has an equal and opposite reaction — which law?', JSON.stringify(['First', 'Second', 'Third', 'Fourth']), 2, 1, "Newton's Laws", 2).lastInsertRowid
];
[0, 1, 2, 3, 4, 5].forEach((i) => {
  const st = studentIds.A[i];
  if (!st) return;
  const answers = [[0, 1, 2], [0, 0, 2], [0, 1, 1], [1, 1, 2], [0, 1, 2], [0, 1, 0]][i];
  const attemptId = insertAttempt.run(newtonId, st.id, 0, 3, 'graded', isoDaysAgo(11)).lastInsertRowid;
  let score = 0;
  answers.forEach((sel, qi) => {
    const correct = [0, 1, 2][qi];
    if (sel === correct) score += 1;
    insertAnswer.run(attemptId, newtonQ[qi], sel, null, null);
  });
  db.prepare('UPDATE attempts SET score = ? WHERE id = ?').run(score, attemptId);
});
console.log("Test:         Newton's Laws — Practice Set (published, 6 attempts, fully graded)");

// Test 3: Thermodynamics — draft, no questions yet (shows the "empty draft" state)
insertTest.run(teacherId, batchAId, 'Thermodynamics — Unit Test', 'Thermodynamics', 40, 'draft', null, isoDaysAgo(1));
console.log('Test:         Thermodynamics — Unit Test (draft, no questions — shows empty state)');

// Test 4: Work & Energy — scheduled for the future
insertTest.run(teacherId, batchAId, 'Work & Energy — Quiz', 'Work & Energy', 25, 'draft', isoDaysFromNow(2), isoDaysAgo(1));
console.log('Test:         Work & Energy — Quiz (scheduled 2 days from now)');

// --- Tests: Batch B ---
const periodicId = insertTest.run(teacherId, batchBId, 'Periodic Table — Quiz', 'Periodic Table', 20, 'published', null, isoDaysAgo(4)).lastInsertRowid;
const periodicQ = [
  insertQuestion.run(periodicId, 'mcq', 'Elements in the same group have the same number of:', JSON.stringify(['Neutrons', 'Valence electrons', 'Protons', 'Isotopes']), 1, 1, 'Periodic Table', 0).lastInsertRowid,
  insertQuestion.run(periodicId, 'mcq', 'Atomic radius generally ______ across a period (left to right).', JSON.stringify(['Increases', 'Decreases', 'Stays the same', 'Doubles']), 1, 1, 'Periodic Table', 1).lastInsertRowid
];
studentIds.B.forEach((st, i) => {
  const answers = [[1, 1], [1, 0], [0, 1], [1, 1]][i];
  const attemptId = insertAttempt.run(periodicId, st.id, 0, 2, 'graded', isoDaysAgo(3)).lastInsertRowid;
  let score = 0;
  answers.forEach((sel, qi) => {
    if (sel === [1, 1][qi]) score += 1;
    insertAnswer.run(attemptId, periodicQ[qi], sel, null, null);
  });
  db.prepare('UPDATE attempts SET score = ? WHERE id = ?').run(score, attemptId);
});
console.log('Test:         Periodic Table — Quiz (Batch B, published, 4 attempts, fully graded)');

// --- Materials ---
const insertMaterial = db.prepare(
  `INSERT INTO materials (teacher_id, batch_id, type, title, chapter, content_json, shared) VALUES (?, ?, ?, ?, ?, ?, ?)`
);
insertMaterial.run(
  teacherId, batchAId, 'slides', 'Gravitation — Chapter 8', 'Gravitation',
  JSON.stringify([
    { title: 'Gravitation', bullets: [] },
    { title: "Newton's Law of Gravitation", bullets: ['F = Gm₁m₂/r²', 'Always attractive', 'Acts along the line joining the masses'] },
    { title: 'Acceleration due to gravity', bullets: ['g = GM/R²', 'Decreases with height and depth'] },
    { title: 'Escape velocity', bullets: ['v = √(2GM/R)', 'Independent of the escaping mass'] }
  ]), 1
);
insertMaterial.run(
  teacherId, batchAId, 'notes', "Newton's Laws — Class Notes", "Newton's Laws",
  JSON.stringify([
    { heading: 'First Law (Inertia)', body: 'An object remains at rest or in uniform motion unless acted on by a net external force.' },
    { heading: 'Second Law', body: 'The net force on an object equals its mass times its acceleration: F = ma.' },
    { heading: 'Third Law', body: 'For every action, there is an equal and opposite reaction.' }
  ]), 1
);
insertMaterial.run(teacherId, batchAId, 'notes', 'Thermodynamics — Draft Notes', 'Thermodynamics', JSON.stringify([{ heading: 'Zeroth Law', body: 'Draft — still being written.' }]), 0);
console.log('Materials:    2 shared (slides + notes), 1 unshared draft');

// --- Attendance: last 10 weekdays for Batch A ---
const insertSession = db.prepare('INSERT INTO attendance_sessions (batch_id, session_date) VALUES (?, ?)');
const insertRecord = db.prepare('INSERT INTO attendance_records (session_id, student_id, present) VALUES (?, ?, ?)');
let sessionCount = 0;
for (let d = 1; d <= 14; d++) {
  const date = new Date();
  date.setDate(date.getDate() - d);
  if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends
  const sessionId = insertSession.run(batchAId, dateOnlyDaysAgo(d)).lastInsertRowid;
  studentIds.A.forEach((st, i) => {
    // Karthik (index 3) has patchy attendance; everyone else is mostly present.
    const present = i === 3 ? d % 3 !== 0 : d % 5 !== 0;
    insertRecord.run(sessionId, st.id, present ? 1 : 0);
  });
  sessionCount += 1;
}
console.log(`Attendance:   ${sessionCount} sessions recorded for Batch A over the last 2 weeks`);

// --- Homework ---
const insertHomework = db.prepare('INSERT INTO homework (teacher_id, batch_id, title, chapter, due_date) VALUES (?, ?, ?, ?, ?)');
const insertHwCompletion = db.prepare('INSERT INTO homework_completion (homework_id, student_id, completed) VALUES (?, ?, ?)');
const hw1 = insertHomework.run(teacherId, batchAId, 'Worksheet 4 — Gravitation practice', 'Gravitation', dateOnlyDaysAgo(-3)).lastInsertRowid;
const hw2 = insertHomework.run(teacherId, batchAId, "NCERT Newton's Laws exercises 1-10", "Newton's Laws", dateOnlyDaysAgo(2)).lastInsertRowid;
studentIds.A.forEach((st, i) => {
  insertHwCompletion.run(hw1, st.id, i % 2 === 0 ? 1 : 0);
  insertHwCompletion.run(hw2, st.id, 1); // everyone finished the overdue one
});
console.log('Homework:     2 assignments for Batch A, mixed completion');

// --- Report tokens (a couple already generated, as if the teacher shared them) ---
const insertToken = db.prepare('INSERT INTO report_tokens (test_id, student_id, token, note) VALUES (?, ?, ?, ?)');
insertToken.run(gravId, studentIds.A[0].id, crypto.randomBytes(16).toString('hex'), "Ananya is doing well — keep up the practice on orbital motion.");
insertToken.run(newtonId, studentIds.A[1].id, crypto.randomBytes(16).toString('hex'), '');
console.log('Reports:      2 parent reports already generated (visible in Reports hub / parent login)');

// --- AI usage (so the admin dashboard shows some real numbers) ---
const month = new Date().toISOString().slice(0, 7);
db.prepare('INSERT INTO ai_usage (teacher_id, month, count) VALUES (?, ?, ?)').run(teacherId, month, 7);

console.log('\n=================================================================');
console.log('DONE. Run `npm run dev` and log in with:\n');
console.log('  Teacher:  ritu@demo.com / demo1234');
console.log('  Admin:    whatever ADMIN_EMAIL / ADMIN_PASSWORD you set in .env');
console.log('\n  Student / Parent logins (roll number / PIN):');
console.log('  ---------------------------------------------------------------');
console.log('  Batch A (Physics):');
studentIds.A.forEach((s) => console.log(`    ${s.name.padEnd(18)} roll ${s.roll}   student PIN ${s.pin}   parent PIN ${s.parentPin}`));
console.log('  Batch B (Chemistry):');
studentIds.B.forEach((s) => console.log(`    ${s.name.padEnd(18)} roll ${s.roll}   student PIN ${s.pin}   parent PIN ${s.parentPin}`));
console.log('=================================================================\n');
