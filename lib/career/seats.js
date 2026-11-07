// Career test seats: one seat = one student report. Seats are bought per
// report tier, belong to a teacher (or to the institute for institute
// accounts), and are used up when a student submits the test.
//
// Prices (INR per student). Edit here and checkout + UI follow.
const db = require('../db');

const TIERS = {
  basic: {
    key: 'basic',
    name: 'Basic',
    price: 299,
    ai: false,
    counselling: false,
    blurb: 'Scores and a short stream / career report'
  },
  standard: {
    key: 'standard',
    name: 'Standard',
    price: 599,
    ai: true,
    counselling: false,
    blurb: 'Detailed AI report in English or a regional language, plus a parent summary',
    // School bulk prices for Standard seats, bought in one go.
    bulk: [
      { min: 300, price: 199 },
      { min: 100, price: 249 }
    ]
  },
  premium: {
    key: 'premium',
    name: 'Premium',
    price: 999,
    ai: true,
    counselling: true,
    blurb: 'Standard report plus a 1:1 counselling session'
  }
};
const MAX_QTY = 2000;
// Free seats every individual teacher / institute admin gets once, to pilot
// the test with one section.
const PILOT_SEATS = { tier: 'standard', qty: 10 };

const getTier = (k) => TIERS[k] || null;

function seatPrice(tierKey, qty) {
  const t = getTier(tierKey);
  if (!t) return null;
  const band = (t.bulk || []).find((b) => qty >= b.min);
  return band ? band.price : t.price;
}

// Razorpay product id for a seat purchase: career_<tier>_<qty>.
function productId(tierKey, qty) {
  return `career_${tierKey}_${qty}`;
}
function parseProduct(id) {
  const m = /^career_(basic|standard|premium)_(\d+)$/.exec(String(id || ''));
  if (!m) return null;
  const qty = parseInt(m[2], 10);
  if (!(qty >= 1 && qty <= MAX_QTY)) return null;
  const unit = seatPrice(m[1], qty);
  return { tier: m[1], qty, unit, total: unit * qty, name: `${qty} ${TIERS[m[1]].name} career test seat${qty === 1 ? '' : 's'}` };
}

function owner(teacher) {
  return teacher.institute_id ? { col: 'institute_id', id: teacher.institute_id } : { col: 'teacher_id', id: teacher.id };
}

// { basic: n, standard: n, premium: n }
function seatBalance(teacher) {
  const o = owner(teacher);
  const out = { basic: 0, standard: 0, premium: 0 };
  db.prepare(`SELECT tier, SUM(remaining) AS n FROM career_seats WHERE ${o.col} = ? GROUP BY tier`)
    .all(o.id)
    .forEach((r) => (out[r.tier] = r.n || 0));
  return out;
}

function addSeats({ teacher, tier, qty, paymentId = null, note = '' }) {
  const o = owner(teacher);
  db.prepare('INSERT INTO career_seats (teacher_id, institute_id, tier, qty, remaining, payment_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    o.col === 'teacher_id' ? o.id : null,
    o.col === 'institute_id' ? o.id : null,
    tier,
    qty,
    qty,
    paymentId,
    note
  );
}

// Uses one seat of `tier`. Returns true if a seat was available.
function useSeat(teacher, tier) {
  const o = owner(teacher);
  const row = db
    .prepare(`SELECT id FROM career_seats WHERE ${o.col} = ? AND tier = ? AND remaining > 0 ORDER BY id LIMIT 1`)
    .get(o.id, tier);
  if (!row) return false;
  db.prepare('UPDATE career_seats SET remaining = remaining - 1 WHERE id = ? AND remaining > 0').run(row.id);
  return true;
}

module.exports = { TIERS, MAX_QTY, PILOT_SEATS, getTier, seatPrice, productId, parseProduct, seatBalance, addSeats, useSeat };
