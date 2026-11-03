// AI credit checks and deductions. See lib/credits.js for credit costs,
// top-up packs and abuse limits.
//
// - Monthly allowance: teacher.ai_limit_monthly credits (shared pool for
//   institutes); ai_usage.count stores monthly credits spent.
// - Top-ups: credit_topups rows, spent after the monthly allowance runs out.
// - Plan expired: no AI at all (top-ups wait until the plan is renewed).
const db = require('./db');
const { effectiveAiLimit, isPlanActive } = require('./plans');
const { RATE_PER_MINUTE, DAILY_SHARE, DAILY_MIN, costInr } = require('./credits');

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// Monthly credits used by this teacher alone.
function getUsage(teacherId, month = currentMonth()) {
  const row = db.prepare('SELECT count FROM ai_usage WHERE teacher_id = ? AND month = ?').get(teacherId, month);
  return row ? row.count : 0;
}

// Top-up packs that belong to this account (the institute's for members).
function topupOwner(teacher) {
  return teacher.institute_id ? { col: 'institute_id', id: teacher.institute_id } : { col: 'teacher_id', id: teacher.id };
}

function activeTopups(teacher) {
  const o = topupOwner(teacher);
  return db
    .prepare(`SELECT * FROM credit_topups WHERE ${o.col} = ? AND remaining > 0 AND expires_at > ? ORDER BY expires_at, id`)
    .all(o.id, new Date().toISOString());
}

function topupCreditsLeft(teacher) {
  return activeTopups(teacher).reduce((s, t) => s + t.remaining, 0);
}

function creditsUsedToday(teacherId) {
  return db
    .prepare("SELECT COALESCE(SUM(credits), 0) AS c FROM ai_calls WHERE teacher_id = ? AND created_at >= date('now')")
    .get(teacherId).c;
}

// Per-minute rate limit, kept in memory.
const recent = new Map();
function rateOk(teacherId, consume) {
  const now = Date.now();
  const list = (recent.get(teacherId) || []).filter((t) => now - t < 60 * 1000);
  if (list.length >= RATE_PER_MINUTE) {
    recent.set(teacherId, list);
    return false;
  }
  if (consume) list.push(now);
  recent.set(teacherId, list);
  if (recent.size > 5000) recent.clear();
  return true;
}

// Full credit picture for the dashboard / upgrade page.
function creditSummary(teacher) {
  const used = require('./institutes').aiUsedFor(teacher, currentMonth());
  const limit = effectiveAiLimit(teacher);
  const monthlyLeft = Math.max(0, limit - used);
  const topupLeft = isPlanActive(teacher) ? topupCreditsLeft(teacher) : 0;
  return { used, limit, monthlyLeft, topupLeft, available: monthlyLeft + topupLeft };
}

// Call BEFORE an AI action. Returns {allowed, message, used, limit, available}.
// `credits` is what this action will cost (lib/credits.js creditsFor()).
function checkAiLimit(teacher, credits = 1) {
  const s = creditSummary(teacher);
  const base = { ...s, credits, allowed: false };
  if (!isPlanActive(teacher)) {
    return { ...base, message: 'Your plan has expired, so AI features are paused. Renew on the Upgrade page to continue.' };
  }
  if (s.available < credits) {
    const tail = teacher.institute_id && teacher.institute_role !== 'owner'
      ? 'Ask your institute admin to add credits or upgrade.'
      : 'Buy a top-up pack or upgrade your plan on the Upgrade page.';
    return { ...base, message: `This needs ${credits} AI credit${credits === 1 ? '' : 's'} but you have ${s.available} left. ${tail}` };
  }
  const dailyCap = Math.max(DAILY_MIN, Math.ceil((s.limit + s.topupLeft) * DAILY_SHARE));
  if (creditsUsedToday(teacher.id) + credits > dailyCap) {
    return { ...base, message: `You've reached today's AI limit (${dailyCap} credits a day). It resets tomorrow.` };
  }
  if (!rateOk(teacher.id, true)) {
    return { ...base, message: 'Too many AI requests in a minute. Please wait a moment and try again.' };
  }
  return { ...base, allowed: true, message: null };
}

// Call ONLY after an AI action succeeds. Spends the monthly allowance first,
// then top-ups (oldest expiry first), and logs the call with its API cost.
// meter: { provider, model, input_tokens, output_tokens } filled by lib/ai.js.
function recordAiUsage(teacher, { feature, credits, meter = {} }) {
  const month = currentMonth();
  const run = db.transaction(() => {
    const s = creditSummary(teacher);
    const fromMonthly = Math.min(credits, s.monthlyLeft);
    let fromTopup = credits - fromMonthly;

    if (fromMonthly > 0) {
      db.prepare(
        `INSERT INTO ai_usage (teacher_id, month, count) VALUES (?, ?, ?)
         ON CONFLICT(teacher_id, month) DO UPDATE SET count = count + excluded.count`
      ).run(teacher.id, month, fromMonthly);
    }
    for (const t of activeTopups(teacher)) {
      if (fromTopup <= 0) break;
      const take = Math.min(t.remaining, fromTopup);
      db.prepare('UPDATE credit_topups SET remaining = remaining - ? WHERE id = ?').run(take, t.id);
      fromTopup -= take;
    }

    db.prepare(
      `INSERT INTO ai_calls (teacher_id, institute_id, feature, credits, topup_credits, provider, model, input_tokens, output_tokens, cost_inr)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      teacher.id,
      teacher.institute_id || null,
      feature,
      credits,
      credits - fromMonthly,
      meter.provider || null,
      meter.model || null,
      meter.input_tokens ?? null,
      meter.output_tokens ?? null,
      costInr(meter.model, meter.input_tokens, meter.output_tokens)
    );
  });
  run();
}

module.exports = { currentMonth, getUsage, checkAiLimit, recordAiUsage, creditSummary, topupCreditsLeft };
