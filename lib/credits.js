// AI credits: every AI action costs a number of credits based on how much
// work (and API cost) it takes. A teacher's plan gives a monthly credit
// allowance (stored in ai_limit_monthly); top-up packs add extra credits on
// top that last 6 months. Usage is spent from the monthly allowance first,
// then from top-ups (oldest expiry first).

// Credits per AI action. Edit here and every check, deduction and UI label follows.
const FEATURE_CREDITS = {
  grade: 1, // AI mark suggestion for one descriptive answer
  practice: 2, // practice set for one struggling student
  mcq: 2, // MCQ set of up to 10 questions (+1 per extra 10)
  notes: 3,
  slides: 3
};

function creditsFor(feature, { count } = {}) {
  if (feature === 'mcq') {
    const n = Math.max(1, parseInt(count, 10) || 1);
    return FEATURE_CREDITS.mcq + Math.max(0, Math.ceil((n - 10) / 10));
  }
  return FEATURE_CREDITS[feature] || 1;
}

const FEATURE_LABELS = {
  grade: 'AI grading suggestion',
  practice: 'Practice set',
  mcq: 'MCQ set (up to 10)',
  notes: 'Notes',
  slides: 'Slides'
};

// Top-up packs, bought on /upgrade by individual teachers on a paid plan or
// by institute admins (the institute pool gets the credits).
const TOPUP_VALID_MONTHS = 6;
const TOPUPS = {
  topup_100: { id: 'topup_100', name: '100 AI credits', credits: 100, price: 99 },
  topup_300: { id: 'topup_300', name: '300 AI credits', credits: 300, price: 249 },
  topup_1000: { id: 'topup_1000', name: '1,000 AI credits', credits: 1000, price: 699 }
};
const getTopup = (id) => TOPUPS[id] || null;

// Abuse limits.
const RATE_PER_MINUTE = 5; // AI actions per teacher per minute
const DAILY_SHARE = 0.3; // at most 30% of (monthly allowance + top-ups) in one day
const DAILY_MIN = 10; // ...but never a daily cap below 10 credits

// Approximate API prices in USD per million tokens [input, output], used only
// to log what each call cost. Override the rupee rate with USD_INR.
const MODEL_PRICES_USD = [
  ['claude-haiku', 1, 5],
  ['claude-sonnet', 3, 15],
  ['claude-opus', 15, 75],
  ['gpt-4o-mini', 0.15, 0.6],
  ['gpt-4.1-mini', 0.4, 1.6],
  ['gpt-4o', 2.5, 10]
];

function costInr(model, inputTokens, outputTokens) {
  const usdInr = parseFloat(process.env.USD_INR) || 88;
  const m = String(model || '').toLowerCase();
  const row = MODEL_PRICES_USD.find(([prefix]) => m.startsWith(prefix));
  if (!row) return null;
  const usd = ((inputTokens || 0) * row[1] + (outputTokens || 0) * row[2]) / 1e6;
  return Math.round(usd * usdInr * 10000) / 10000;
}

module.exports = {
  FEATURE_CREDITS,
  FEATURE_LABELS,
  creditsFor,
  TOPUPS,
  TOPUP_VALID_MONTHS,
  getTopup,
  RATE_PER_MINUTE,
  DAILY_SHARE,
  DAILY_MIN,
  costInr
};
