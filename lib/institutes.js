// Institute pack: an institute (coaching centre) buys one plan; its admin
// creates teacher logins; teachers create student logins as usual. All
// teachers share the institute's student total and monthly AI pool.
//
// The institute's plan values are mirrored onto every member teacher's row
// (plan, expiry, limits, NEET/JEE track), so everything that already reads
// a teacher's plan keeps working. Only the shared totals need institute-wide
// counts: studentTotalFor() and aiUsedFor().
const db = require('./db');
const { getPlan, addMonths, INST_TRIAL_DAYS, PLANS } = require('./plans');

function getInstitute(id) {
  return id ? db.prepare('SELECT * FROM institutes WHERE id = ?').get(id) : null;
}

function instituteFor(teacher) {
  return teacher && teacher.institute_id ? getInstitute(teacher.institute_id) : null;
}

const isOwner = (teacher) => !!(teacher && teacher.institute_id && teacher.institute_role === 'owner');
const isMember = (teacher) => !!(teacher && teacher.institute_id && teacher.institute_role === 'teacher');

function syncMembers(instituteId) {
  const inst = getInstitute(instituteId);
  if (!inst) return;
  db.prepare(
    "UPDATE teachers SET plan = ?, plan_expires_at = ?, max_students = ?, ai_limit_monthly = ?, exam_track = 'neet_jee' WHERE institute_id = ?"
  ).run(inst.plan, inst.plan_expires_at, inst.max_students, inst.ai_limit_monthly, inst.id);
}

// Makes an existing (owner) teacher the admin of a new institute on the free trial.
function createInstitute(ownerTeacherId, name) {
  const trial = PLANS.inst_trial;
  const expires = new Date(Date.now() + INST_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const id = Number(
    db
      .prepare('INSERT INTO institutes (name, owner_teacher_id, plan, plan_expires_at, max_teachers, max_students, ai_limit_monthly) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(name, ownerTeacherId, trial.id, expires, trial.max_teachers, trial.max_students, trial.ai_limit_monthly).lastInsertRowid
  );
  db.prepare("UPDATE teachers SET institute_id = ?, institute_role = 'owner' WHERE id = ?").run(id, ownerTeacherId);
  syncMembers(id);
  return getInstitute(id);
}

// Applies a paid institute plan; time left on the current plan carries over.
function applyInstitutePlan(instituteId, planId) {
  const inst = getInstitute(instituteId);
  const plan = getPlan(planId);
  if (!inst) throw new Error('Institute not found');
  if (!plan || plan.track !== 'institute') throw new Error(`Not an institute plan: ${planId}`);
  const base = inst.plan_expires_at && new Date(inst.plan_expires_at) > new Date() && inst.plan !== 'inst_trial' ? inst.plan_expires_at : new Date();
  const expires = addMonths(base, plan.duration_months).toISOString();
  db.prepare('UPDATE institutes SET plan = ?, plan_expires_at = ?, max_teachers = ?, max_students = ?, ai_limit_monthly = ? WHERE id = ?').run(
    plan.id,
    expires,
    plan.max_teachers,
    plan.max_students,
    plan.ai_limit_monthly,
    inst.id
  );
  syncMembers(inst.id);
}

// Site-admin override from /admin: set plan and/or expiry directly.
function setInstitutePlan(instituteId, { planId, expiresAt }) {
  const inst = getInstitute(instituteId);
  if (!inst) return;
  const plan = getPlan(planId) && getPlan(planId).track === 'institute' ? getPlan(planId) : getPlan(inst.plan);
  db.prepare('UPDATE institutes SET plan = ?, plan_expires_at = ?, max_teachers = ?, max_students = ?, ai_limit_monthly = ? WHERE id = ?').run(
    plan.id,
    expiresAt === undefined ? inst.plan_expires_at : expiresAt,
    plan.max_teachers,
    plan.max_students,
    plan.ai_limit_monthly,
    inst.id
  );
  syncMembers(inst.id);
}

function members(instituteId) {
  return db
    .prepare(
      `SELECT t.*,
        (SELECT COUNT(*) FROM batches b WHERE b.teacher_id = t.id) AS class_count,
        (SELECT COUNT(*) FROM students s JOIN batches b ON b.id = s.batch_id WHERE b.teacher_id = t.id) AS student_count
       FROM teachers t WHERE t.institute_id = ? ORDER BY (t.institute_role = 'owner') DESC, t.active DESC, t.name`
    )
    .all(instituteId);
}

// Teacher seats in use: active teachers the admin created (the admin's own login is not counted).
function teacherSeatsUsed(instituteId) {
  return db.prepare("SELECT COUNT(*) AS c FROM teachers WHERE institute_id = ? AND institute_role = 'teacher' AND active = 1").get(instituteId).c;
}

// Students that count toward the teacher's limit: the whole institute's for members.
function studentTotalFor(teacher) {
  if (teacher.institute_id) {
    return db
      .prepare('SELECT COUNT(*) AS c FROM students s JOIN batches b ON b.id = s.batch_id JOIN teachers t ON t.id = b.teacher_id WHERE t.institute_id = ?')
      .get(teacher.institute_id).c;
  }
  return db.prepare('SELECT COUNT(*) AS c FROM students s JOIN batches b ON b.id = s.batch_id WHERE b.teacher_id = ?').get(teacher.id).c;
}

// AI generations used this month: the whole institute's pool for members.
function aiUsedFor(teacher, month) {
  if (teacher.institute_id) {
    return db
      .prepare('SELECT COALESCE(SUM(u.count), 0) AS c FROM ai_usage u JOIN teachers t ON t.id = u.teacher_id WHERE t.institute_id = ? AND u.month = ?')
      .get(teacher.institute_id, month).c;
  }
  const row = db.prepare('SELECT count FROM ai_usage WHERE teacher_id = ? AND month = ?').get(teacher.id, month);
  return row ? row.count : 0;
}

// May this teacher view that batch? Its own teacher, or the admin of the same institute.
function canViewBatch(teacher, batch) {
  if (!batch) return false;
  if (batch.teacher_id === teacher.id) return true;
  if (!isOwner(teacher)) return false;
  const owner = db.prepare('SELECT institute_id FROM teachers WHERE id = ?').get(batch.teacher_id);
  return !!owner && owner.institute_id === teacher.institute_id;
}

module.exports = {
  getInstitute,
  instituteFor,
  isOwner,
  isMember,
  syncMembers,
  createInstitute,
  applyInstitutePlan,
  setInstitutePlan,
  members,
  teacherSeatsUsed,
  studentTotalFor,
  aiUsedFor,
  canViewBatch
};
