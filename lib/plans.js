// The plan catalog. Prices are in INR. Teachers buy plans on /upgrade
// (Razorpay) or on WhatsApp; admins can also assign them in /admin.
const PLANS = {
  trial: { id: 'trial', name: 'Free Trial', price: 0, duration_months: 1, max_students: 10, ai_limit_monthly: 20, track: 'all' }
};

// ---- School & general track ---------------------------------------------
// Each student-slot size comes as a 2-month plan and a yearly plan. The
// 2-month plans keep their original ids (starter/growth/pro) so teachers
// already on them are unaffected; only the length of a new purchase changed
// (from 3 months to 2 months, same price).
const GEN_TIERS = [
  { key: 'starter', name: 'Starter', students: 20, ai: 40, shortPrice: 499, yearly: 2499 },
  { key: 'growth', name: 'Growth', students: 50, ai: 100, shortPrice: 999, yearly: 4999 },
  { key: 'pro', name: 'Pro', students: 100, ai: 250, shortPrice: 1999, yearly: 9999 }
];
const GEN_SHORT_MONTHS = 2;
GEN_TIERS.forEach((t) => {
  PLANS[t.key] = { id: t.key, name: t.name, price: t.shortPrice, duration_months: GEN_SHORT_MONTHS, max_students: t.students, ai_limit_monthly: t.ai, track: 'general' };
  PLANS[`${t.key}_y`] = { id: `${t.key}_y`, name: `${t.name} - Yearly`, price: t.yearly, duration_months: 12, max_students: t.students, ai_limit_monthly: t.ai, track: 'general' };
});

// Tier data shaped for the general pricing UI.
function genTiers() {
  return GEN_TIERS.map((t) => ({
    name: t.name,
    students: t.students,
    ai: t.ai,
    short: { id: t.key, price: t.shortPrice, months: GEN_SHORT_MONTHS },
    yearly: { id: `${t.key}_y`, price: t.yearly },
    yearlySaving: t.shortPrice * (12 / GEN_SHORT_MONTHS) - t.yearly
  }));
}

// "2 months", "1 year", "1 month" — for showing a plan's length.
function durationLabel(months) {
  if (months === 12) return '1 year';
  return months === 1 ? '1 month' : `${months} months`;
}

// ---- NEET / JEE track -------------------------------------------------
// A separate plan family for coaches preparing students for NEET/JEE. Each
// student-slot size comes as a monthly and a yearly plan (yearly = 10 months'
// price, i.e. two months free). Edit the prices here and everything that
// shows or charges them follows. The whole track stays hidden until the
// NEET_JEE_TRACK=1 environment variable is set (see trackEnabled()).
const NJ_TIERS = [
  { students: 20, ai: 40, monthly: 599, yearly: 5999 },
  { students: 50, ai: 100, monthly: 1199, yearly: 11999 },
  { students: 100, ai: 250, monthly: 1999, yearly: 19999 }
];
NJ_TIERS.forEach((t) => {
  PLANS[`nj${t.students}_m`] = { id: `nj${t.students}_m`, name: `NEET/JEE ${t.students} students - Monthly`, price: t.monthly, duration_months: 1, max_students: t.students, ai_limit_monthly: t.ai, track: 'neet_jee' };
  PLANS[`nj${t.students}_y`] = { id: `nj${t.students}_y`, name: `NEET/JEE ${t.students} students - Yearly`, price: t.yearly, duration_months: 12, max_students: t.students, ai_limit_monthly: t.ai, track: 'neet_jee' };
});

// ---- Institute pack ------------------------------------------------------
// One plan for a whole coaching institute: the institute admin creates
// teacher logins, and every teacher shares one student total and one
// monthly AI pool. Includes the NEET/JEE bank. A 14-day free trial
// (2 teachers, 20 students) starts at institute signup.
const INST_TIERS = [
  { key: 'inst10', teachers: 10, students: 200, ai: 300, monthly: 1999, yearly: 19999 },
  { key: 'inst20', teachers: 20, students: 500, ai: 800, monthly: 4999, yearly: 49999 },
  { key: 'inst30', teachers: 30, students: 1000, ai: 1500, monthly: 9999, yearly: 99999 }
];
const INST_TRIAL_DAYS = 14;
PLANS.inst_trial = { id: 'inst_trial', name: 'Institute Free Trial', price: 0, duration_days: INST_TRIAL_DAYS, duration_months: 0, max_teachers: 2, max_students: 20, ai_limit_monthly: 40, track: 'institute' };
INST_TIERS.forEach((t) => {
  PLANS[`${t.key}_m`] = { id: `${t.key}_m`, name: `Institute ${t.teachers} teachers - Monthly`, price: t.monthly, duration_months: 1, max_teachers: t.teachers, max_students: t.students, ai_limit_monthly: t.ai, track: 'institute' };
  PLANS[`${t.key}_y`] = { id: `${t.key}_y`, name: `Institute ${t.teachers} teachers - Yearly`, price: t.yearly, duration_months: 12, max_teachers: t.teachers, max_students: t.students, ai_limit_monthly: t.ai, track: 'institute' };
});

function instTiers() {
  return INST_TIERS.map((t) => ({
    teachers: t.teachers,
    students: t.students,
    ai: t.ai,
    monthly: { id: `${t.key}_m`, price: t.monthly },
    yearly: { id: `${t.key}_y`, price: t.yearly },
    yearlySaving: t.monthly * 12 - t.yearly,
    yearlyPerMonth: Math.round(t.yearly / 12)
  }));
}

function isTrialPlan(id) {
  return id === 'trial' || id === 'free' || id === 'inst_trial';
}

function trackEnabled() {
  return process.env.NEET_JEE_TRACK === '1';
}

// Tier data shaped for the pricing UI (cards with a monthly/yearly toggle).
function njTiers() {
  return NJ_TIERS.map((t) => ({
    students: t.students,
    ai: t.ai,
    monthly: { id: `nj${t.students}_m`, price: t.monthly },
    yearly: { id: `nj${t.students}_y`, price: t.yearly },
    yearlySaving: t.monthly * 12 - t.yearly,
    perStudentMonthly: Math.round((t.monthly / t.students) * 10) / 10,
    perStudentYearly: Math.round((t.yearly / 12 / t.students) * 10) / 10,
    yearlyPerMonth: Math.round(t.yearly / 12)
  }));
}

// Paid plans a teacher may buy: only their own category's.
function paidPlansForTrack(track) {
  if (track === 'institute') return Object.values(PLANS).filter((p) => p.track === 'institute' && p.id !== 'inst_trial');
  const t = trackEnabled() && track === 'neet_jee' ? 'neet_jee' : 'general';
  return Object.values(PLANS).filter((p) => p.id !== 'trial' && p.track === t);
}

function getPlan(id) {
  return PLANS[id] || null;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function trialExpiryFromNow() {
  return addMonths(new Date(), PLANS.trial.duration_months).toISOString();
}

function daysUntil(isoDateString) {
  if (!isoDateString) return null;
  const diffMs = new Date(isoDateString).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// A null plan_expires_at means "no expiry" (an admin override, or a
// legacy account from before this feature existed) — always active.
function isPlanActive(teacher) {
  if (!teacher.plan_expires_at) return true;
  return daysUntil(teacher.plan_expires_at) >= 0;
}

// The AI limit that actually applies right now — 0 once the plan has expired.
function effectiveAiLimit(teacher) {
  return isPlanActive(teacher) ? teacher.ai_limit_monthly : 0;
}

// The student cap that actually applies right now — frozen at the current
// count once the plan has expired, so existing students are never removed
// but no new ones can be added.
function effectiveMaxStudents(teacher, currentStudentCount) {
  return isPlanActive(teacher) ? teacher.max_students : currentStudentCount;
}

// Applies a plan a teacher has actually paid for. If they still have time
// left on their current plan (e.g. renewing a bit early, or upgrading
// mid-cycle), the new duration stacks on top of what's remaining rather
// than being wasted — same "extend from whichever is later" logic the
// admin's manual plan changes use.
function applyPurchasedPlan(db, teacherId, planId) {
  const plan = getPlan(planId);
  if (!plan) throw new Error(`Unknown plan: ${planId}`);
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(teacherId);
  if (!teacher) throw new Error('Teacher not found');
  if (plan.track === 'institute') {
    // Required here (not at the top) because lib/institutes.js requires this file.
    return require('./institutes').applyInstitutePlan(teacher.institute_id, plan.id);
  }

  const base = teacher.plan_expires_at && new Date(teacher.plan_expires_at) > new Date() ? teacher.plan_expires_at : new Date();
  const newExpiry = addMonths(base, plan.duration_months).toISOString();

  db.prepare('UPDATE teachers SET plan = ?, max_students = ?, ai_limit_monthly = ?, plan_expires_at = ? WHERE id = ?').run(
    plan.id,
    plan.max_students,
    plan.ai_limit_monthly,
    newExpiry,
    teacherId
  );
}

module.exports = {
  PLANS,
  INST_TIERS,
  INST_TRIAL_DAYS,
  instTiers,
  isTrialPlan,
  NJ_TIERS,
  GEN_TIERS,
  GEN_SHORT_MONTHS,
  genTiers,
  durationLabel,
  trackEnabled,
  njTiers,
  paidPlansForTrack,
  getPlan,
  addMonths,
  trialExpiryFromNow,
  daysUntil,
  isPlanActive,
  effectiveAiLimit,
  effectiveMaxStudents,
  applyPurchasedPlan
};
