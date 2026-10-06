// The plan catalog. Prices are in INR. Admin assigns these to teachers
// manually (there's no payment gateway wired in) — see /admin.
const PLANS = {
  trial: { id: 'trial', name: 'Free Trial', price: 0, duration_months: 1, max_students: 10, ai_limit_monthly: 20, track: 'all' },
  starter: { id: 'starter', name: 'Starter', price: 499, duration_months: 3, max_students: 20, ai_limit_monthly: 40, track: 'general' },
  growth: { id: 'growth', name: 'Growth', price: 999, duration_months: 3, max_students: 50, ai_limit_monthly: 100, track: 'general' },
  pro: { id: 'pro', name: 'Pro', price: 1999, duration_months: 3, max_students: 100, ai_limit_monthly: 250, track: 'general' }
};

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
  NJ_TIERS,
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
