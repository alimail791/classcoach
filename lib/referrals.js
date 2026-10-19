const db = require('./db');
const { addMonths } = require('./plans');
const { notify } = require('./notifications');
const mailer = require('./mailer');

const REFERRALS_NEEDED_PER_REWARD = 2;
const REWARD_MONTHS = 2;
// Institutes (admin or any of their teachers) earn a discount instead:
// every referred account that buys a plan = 40% off the institute's next purchase.
const INSTITUTE_DISCOUNT_PCT = 40;

// Two referred teachers purchasing a plan earns the referrer 2 months —
// matches the general plans' 2-month billing period (see lib/plans.js).
// Called every time a referred teacher makes their first purchase — grants
// as many reward blocks as have newly become due (handles the rare case
// of catching up more than one at once), and never double-grants thanks
// to referral_rewards_granted tracking how many blocks already went out.
function grantReferralRewardsIfEarned(referrerId) {
  const referrer = db.prepare('SELECT * FROM teachers WHERE id = ?').get(referrerId);
  if (!referrer) return;

  const purchasedReferrals = db
    .prepare('SELECT COUNT(*) AS c FROM teachers WHERE referred_by_teacher_id = ? AND has_purchased = 1')
    .get(referrerId).c;

  // Institute members: one 40%-off coupon per referred buyer, for the institute.
  // referral_rewards_granted counts referred buyers already credited.
  if (referrer.institute_id) {
    const inst = db.prepare('SELECT * FROM institutes WHERE id = ?').get(referrer.institute_id);
    const fresh = purchasedReferrals - referrer.referral_rewards_granted;
    if (!inst || fresh <= 0) return;
    db.prepare('UPDATE institutes SET referral_coupons = referral_coupons + ? WHERE id = ?').run(fresh, inst.id);
    db.prepare('UPDATE teachers SET referral_rewards_granted = ? WHERE id = ?').run(purchasedReferrals, referrer.id);
    const total = inst.referral_coupons + fresh;
    const msg = `🎉 Referral reward! ${fresh === 1 ? 'Someone you referred has' : fresh + ' people you referred have'} bought ClassCoach. ${inst.name} now has ${total} × ${INSTITUTE_DISCOUNT_PCT}% off coupon${total === 1 ? '' : 's'}, applied automatically to the next plan purchase.`;
    const owner = inst.owner_teacher_id ? db.prepare('SELECT * FROM teachers WHERE id = ?').get(inst.owner_teacher_id) : null;
    [referrer, owner].filter((t, i, a) => t && a.findIndex((x) => x && x.id === t.id) === i).forEach((t) => {
      notify('teacher', t.id, msg, 'ClassCoach');
      if (mailer.isConfigured()) {
        mailer
          .sendPlainEmail({ to: t.email, subject: 'You earned a ClassCoach referral reward!', text: `Hi ${t.name},\n\n${msg}\n\n— ClassCoach` })
          .catch((err) => console.error('Referral reward email failed:', err.message));
      }
    });
    return;
  }

  const rewardsEarned = Math.floor(purchasedReferrals / REFERRALS_NEEDED_PER_REWARD);
  const newRewards = rewardsEarned - referrer.referral_rewards_granted;
  if (newRewards <= 0) return;

  const base = referrer.plan_expires_at && new Date(referrer.plan_expires_at) > new Date() ? referrer.plan_expires_at : new Date();
  const newExpiry = addMonths(base, REWARD_MONTHS * newRewards).toISOString();
  db.prepare('UPDATE teachers SET plan_expires_at = ?, referral_rewards_granted = ? WHERE id = ?').run(newExpiry, rewardsEarned, referrer.id);

  const monthsAdded = REWARD_MONTHS * newRewards;
  const message = `🎉 Referral reward! ${newRewards * REFERRALS_NEEDED_PER_REWARD} of your referrals have now purchased a plan — ${monthsAdded} month${monthsAdded === 1 ? '' : 's'} added to your subscription free.`;
  notify('teacher', referrer.id, message, 'ClassCoach');
  if (mailer.isConfigured()) {
    mailer
      .sendPlainEmail({ to: referrer.email, subject: 'You earned a ClassCoach referral reward!', text: `Hi ${referrer.name},\n\n${message}\n\n— ClassCoach` })
      .catch((err) => console.error('Referral reward email failed:', err.message));
  }
}

// Marks a teacher as having made their first purchase (idempotent — only
// acts once) and checks whether whoever referred them just earned a reward.
// Call this from anywhere a teacher's plan changes to a paid one: the
// admin-assigned path and the self-serve payment path both use this so
// the referral logic behaves identically either way.
function markPurchasedAndCheckReferral(teacherId) {
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(teacherId);
  if (!teacher || teacher.has_purchased) return;
  db.prepare('UPDATE teachers SET has_purchased = 1 WHERE id = ?').run(teacherId);
  if (teacher.referred_by_teacher_id) {
    grantReferralRewardsIfEarned(teacher.referred_by_teacher_id);
  }
}

module.exports = { grantReferralRewardsIfEarned, markPurchasedAndCheckReferral, INSTITUTE_DISCOUNT_PCT };
