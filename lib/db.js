const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// On Railway (or any host with an ephemeral filesystem), set DB_PATH to a
// file on a mounted Volume — e.g. /data/classcoach.sqlite — so the
// database survives redeploys. Without it, this falls back to the same
// local file next to the code as always, so local dev is unaffected.
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'classcoach.sqlite');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  plan TEXT NOT NULL DEFAULT 'free',
  max_students INTEGER NOT NULL DEFAULT 50,
  ai_limit_monthly INTEGER NOT NULL DEFAULT 20,
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_verify_token TEXT,
  password_reset_token TEXT,
  password_reset_expires TEXT,
  referral_code TEXT UNIQUE,
  referred_by_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  referral_rewards_granted INTEGER NOT NULL DEFAULT 0,
  has_purchased INTEGER NOT NULL DEFAULT 0,
  last_expiry_notified_for TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  join_code TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  pin TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  parent_name TEXT NOT NULL DEFAULT '',
  parent_phone TEXT NOT NULL DEFAULT '',
  parent_contact TEXT NOT NULL DEFAULT '',
  digest_opt_in INTEGER NOT NULL DEFAULT 1,
  last_digest_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(batch_id, roll_no)
);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  chapter TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published | closed
  scheduled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- type: 'mcq' (auto-graded) or 'descriptive' (teacher grades manually).
-- Descriptive questions store options_json = '[]' and correct_index = -1 (unused sentinel).
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'mcq',
  text TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  max_marks INTEGER NOT NULL DEFAULT 1,
  chapter TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);

-- status: 'graded' (fully scored — true the instant a test has only MCQs)
-- or 'pending' (has descriptive answers awaiting the teacher's marks).
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'graded',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(test_id, student_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_index INTEGER,
  text_answer TEXT,
  marks_awarded INTEGER
);

CREATE TABLE IF NOT EXISTS report_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(test_id, student_id)
);

-- month: "YYYY-MM". Counts successful AI question/material generations
-- so a teacher's monthly limit can be enforced.
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(teacher_id, month)
);

-- type: 'slides' or 'notes'. content_json holds a structured outline:
-- slides -> [{ "title": "...", "bullets": ["...", "..."] }, ...]
-- notes  -> [{ "heading": "...", "body": "..." }, ...]
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'slides',
  title TEXT NOT NULL,
  chapter TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '[]',
  shared INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per class session taken on a given date for a batch.
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL, -- "YYYY-MM-DD"
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(batch_id, session_date)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  present INTEGER NOT NULL DEFAULT 1,
  UNIQUE(session_id, student_id)
);

CREATE TABLE IF NOT EXISTS homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  chapter TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS homework_completion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(homework_id, student_id)
);

-- recipient_type: 'teacher' | 'student' | 'parent' (parent notifications
-- are keyed by student_id, same as the student's own row, since parent
-- login is already 1:1 with a student record).
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL,
  recipient_id INTEGER NOT NULL,
  sender_label TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT
);

-- Marketing leads for the broadcast script (scripts/broadcast.js) — kept
-- in the same database as everything else so unsubscribes are enforced
-- consistently and re-running the script never double-sends.
-- status: 'pending' | 'sent' | 'failed' | 'unsubscribed'.
CREATE TABLE IF NOT EXISTS email_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Backs the custom express-session store (lib/sessionStore.js), so
-- logins survive app restarts/redeploys instead of using express-session's
-- default in-memory store, which forgets everyone on every restart and
-- was never meant for anything beyond local development.
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  expires INTEGER NOT NULL
);

-- Links a generated practice-set material to the one student it was
-- made for, so it can show up on just their dashboard rather than the
-- whole class's shared materials list.
CREATE TABLE IF NOT EXISTS practice_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  chapter TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- amount is in paise (smallest INR unit), matching what Razorpay expects/returns.
-- status: 'created' (order made, not yet paid) | 'paid' | 'failed'.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// --- Lightweight migrations for databases created before a column existed ---
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('students', 'parent_name', "TEXT NOT NULL DEFAULT ''");
ensureColumn('students', 'parent_contact', "TEXT NOT NULL DEFAULT ''");
ensureColumn('students', 'parent_pin', "TEXT NOT NULL DEFAULT ''");
ensureColumn('questions', 'type', "TEXT NOT NULL DEFAULT 'mcq'");
ensureColumn('questions', 'max_marks', "INTEGER NOT NULL DEFAULT 1");
ensureColumn('attempts', 'status', "TEXT NOT NULL DEFAULT 'graded'");
ensureColumn('answers', 'text_answer', 'TEXT');
ensureColumn('answers', 'marks_awarded', 'INTEGER');
ensureColumn('teachers', 'active', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('teachers', 'plan', "TEXT NOT NULL DEFAULT 'free'");
ensureColumn('teachers', 'max_students', 'INTEGER NOT NULL DEFAULT 50');
ensureColumn('teachers', 'ai_limit_monthly', 'INTEGER NOT NULL DEFAULT 20');
ensureColumn('teachers', 'plan_expires_at', 'TEXT');
ensureColumn('teachers', 'phone', "TEXT NOT NULL DEFAULT ''");
ensureColumn('teachers', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('teachers', 'email_verify_token', 'TEXT');
ensureColumn('teachers', 'password_reset_token', 'TEXT');
ensureColumn('teachers', 'password_reset_expires', 'TEXT');
ensureColumn('students', 'phone', "TEXT NOT NULL DEFAULT ''");
ensureColumn('tests', 'scheduled_at', 'TEXT');
ensureColumn('teachers', 'referral_code', 'TEXT');
ensureColumn('teachers', 'referred_by_teacher_id', 'INTEGER');
ensureColumn('teachers', 'referral_rewards_granted', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('teachers', 'has_purchased', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('teachers', 'last_expiry_notified_for', 'TEXT');
ensureColumn('batches', 'join_code', 'TEXT');
ensureColumn('students', 'digest_opt_in', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('students', 'last_digest_sent_at', 'TEXT');
ensureColumn('students', 'parent_phone', "TEXT NOT NULL DEFAULT ''");

// Backfill a join code for any batch created before this feature existed.
const needsJoinCode = db.prepare('SELECT id FROM batches WHERE join_code IS NULL').all();
if (needsJoinCode.length) {
  const setJoinCode = db.prepare('UPDATE batches SET join_code = ? WHERE id = ?');
  needsJoinCode.forEach((b) => {
    setJoinCode.run(Math.random().toString(36).slice(2, 8).toUpperCase(), b.id);
  });
}

// Backfill a referral code for any teacher created before this feature existed.
const needsReferralCode = db.prepare('SELECT id, name FROM teachers WHERE referral_code IS NULL').all();
if (needsReferralCode.length) {
  const setCode = db.prepare('UPDATE teachers SET referral_code = ? WHERE id = ?');
  needsReferralCode.forEach((t) => {
    const base = (t.name || 'teacher').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'teacher';
    setCode.run(`${base}${t.id}${Math.floor(100 + Math.random() * 900)}`, t.id);
  });
}

// Flips any test whose scheduled time has arrived from draft to published.
// Called at the top of routes that list tests, so scheduling needs no
// separate background job/cron process.
function autoPublishDueTests() {
  db.prepare(
    "UPDATE tests SET status = 'published', scheduled_at = NULL WHERE status = 'draft' AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime('now')"
  ).run();
}
db.autoPublishDueTests = autoPublishDueTests;

// Backfill a parent login PIN for any student added before this feature existed.
const needsParentPin = db.prepare("SELECT id FROM students WHERE parent_pin = ''").all();
if (needsParentPin.length) {
  const setPin = db.prepare('UPDATE students SET parent_pin = ? WHERE id = ?');
  needsParentPin.forEach((s) => setPin.run(String(Math.floor(1000 + Math.random() * 9000)), s.id));
}

// node:sqlite's DatabaseSync has no built-in transaction() helper like
// better-sqlite3 did — this adds one back with the same calling convention
// (db.transaction(fn) returns a function that runs fn inside BEGIN/COMMIT,
// rolling back on any thrown error) so the rest of the app didn't need to change.
db.transaction = function wrapTransaction(fn) {
  return function runInTransaction(...args) {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

module.exports = db;
