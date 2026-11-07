// Career aptitude test (after Class 10 and Class 12).
//
// Teacher / school side (logged in):
//   /career                        hub: seat balance, buy seats, assessments
//   /career/batches/:id            share link + QR, student results
//   /career/batches/:id/summary    printable principal summary
// Student side (no login — shared by code / link / QR):
//   /c/:code                       start form
//   /c/t/:token                    the test
//   /career-report/:token          the student's report (shareable with parents)
const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const razorpay = require('../lib/razorpay');
const { publicSections } = require('../lib/career/items');
const { buildResult } = require('../lib/career/scoring');
const { CLASS12_STREAMS, STREAMS, CLUSTERS } = require('../lib/career/catalog');
const { TIERS, MAX_QTY, getTier, seatBalance, useSeat } = require('../lib/career/seats');
const { LANGUAGES, generateAiReport } = require('../lib/career/report');

const router = express.Router();

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.classcoach.in';
const newCode = () => crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
const newToken = () => crypto.randomBytes(18).toString('base64url');

function counselLink(studentName) {
  const num = String(process.env.CAREER_COUNSEL_WHATSAPP || '').replace(/\D/g, '');
  if (!num) return null;
  const text = `Hi, I'd like to book a career counselling session for ${studentName} after the ClassCoach career test.`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}
const counselPartner = () => process.env.CAREER_COUNSEL_NAME || 'our counsellors';

// Batches this teacher may see: their own, or (institute admin) any teacher's in the institute.
function getBatchFor(teacher, id) {
  const b = db.prepare('SELECT * FROM career_batches WHERE id = ?').get(id);
  if (!b) return null;
  if (b.teacher_id === teacher.id) return b;
  if (teacher.institute_id && teacher.institute_role === 'owner') {
    const t = db.prepare('SELECT institute_id FROM teachers WHERE id = ?').get(b.teacher_id);
    if (t && t.institute_id === teacher.institute_id) return b;
  }
  return null;
}

function conductorName(batch) {
  const t = db.prepare('SELECT name, institute_id FROM teachers WHERE id = ?').get(batch.teacher_id);
  if (!t) return '';
  if (t.institute_id) {
    const i = db.prepare('SELECT name FROM institutes WHERE id = ?').get(t.institute_id);
    if (i) return i.name;
  }
  return t.name;
}

function optionName(level, key) {
  const list = level === '10' ? STREAMS : CLUSTERS;
  const o = list.find((x) => x.key === key);
  return o ? o.name : key || '';
}

// ---------------------------------------------------------------- teacher

router.get('/career', requireTeacher, (req, res) => {
  const t = req.teacher;
  const where = t.institute_id && t.institute_role === 'owner'
    ? 'teacher_id IN (SELECT id FROM teachers WHERE institute_id = ?)'
    : 'teacher_id = ?';
  const batches = db
    .prepare(
      `SELECT b.*,
        (SELECT COUNT(*) FROM career_attempts a WHERE a.batch_id = b.id AND a.status = 'done') AS done,
        (SELECT COUNT(*) FROM career_attempts a WHERE a.batch_id = b.id AND a.status = 'locked') AS locked,
        (SELECT COUNT(*) FROM career_attempts a WHERE a.batch_id = b.id AND a.status = 'in_progress') AS started
       FROM career_batches b WHERE ${where} ORDER BY b.created_at DESC`
    )
    .all(t.institute_id && t.institute_role === 'owner' ? t.institute_id : t.id);
  res.render('career_hub', {
    teacher: t,
    batches,
    seats: seatBalance(t),
    tiers: Object.values(TIERS),
    maxQty: MAX_QTY,
    languages: LANGUAGES,
    canBuy: !(t.institute_id && t.institute_role !== 'owner'),
    razorpayConfigured: razorpay.isConfigured(),
    bought: req.query.bought || null,
    error: req.query.error || null
  });
});

router.post('/career/batches', requireTeacher, (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 120);
  if (!title) return res.redirect('/career?error=' + encodeURIComponent('Give the assessment a name, e.g. "Class 10 A — 2026".'));
  const level = req.body.level === '12' ? '12' : '10';
  const tier = getTier(req.body.tier) ? req.body.tier : 'standard';
  const language = LANGUAGES.includes(req.body.language) ? req.body.language : 'English';
  const school = String(req.body.school || '').trim().slice(0, 160);
  let code = newCode();
  while (db.prepare('SELECT 1 FROM career_batches WHERE code = ?').get(code)) code = newCode();
  const id = db
    .prepare('INSERT INTO career_batches (teacher_id, title, school, level, tier, language, code) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.teacher.id, title, school, level, tier, language, code).lastInsertRowid;
  res.redirect(`/career/batches/${id}`);
});

router.get('/career/batches/:id', requireTeacher, async (req, res) => {
  const batch = getBatchFor(req.teacher, req.params.id);
  if (!batch) return res.status(404).send('Not found');
  const attempts = db.prepare('SELECT * FROM career_attempts WHERE batch_id = ? ORDER BY submitted_at DESC, started_at DESC').all(batch.id);
  const link = `${SITE_ORIGIN}/c/${batch.code}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 220 });
  res.render('career_batch', {
    teacher: req.teacher,
    batch,
    attempts: attempts.map((a) => ({ ...a, topName: optionName(batch.level, a.top_key), result: a.result_json ? JSON.parse(a.result_json) : null })),
    summary: batchSummary(batch, attempts),
    link,
    qr,
    tier: TIERS[batch.tier],
    seats: seatBalance(req.teacher),
    unlocked: req.query.unlocked || null,
    error: req.query.error || null
  });
});

function batchSummary(batch, attempts) {
  const done = attempts.filter((a) => a.status === 'done');
  const counts = {};
  done.forEach((a) => (counts[a.top_key] = (counts[a.top_key] || 0) + 1));
  const split = Object.entries(counts)
    .map(([key, n]) => ({ key, name: optionName(batch.level, key), n, pct: Math.round((n / done.length) * 100) }))
    .sort((a, b) => b.n - a.n);
  const counselling = done.filter((a) => a.needs_counselling);
  return { total: done.length, split, counselling: counselling.length };
}

router.post('/career/batches/:id/toggle', requireTeacher, (req, res) => {
  const batch = getBatchFor(req.teacher, req.params.id);
  if (!batch) return res.status(404).send('Not found');
  db.prepare('UPDATE career_batches SET open = ? WHERE id = ?').run(batch.open ? 0 : 1, batch.id);
  res.redirect(`/career/batches/${batch.id}`);
});

// Uses seats for tests that were submitted while no seat was free.
router.post('/career/batches/:id/unlock', requireTeacher, (req, res) => {
  const batch = getBatchFor(req.teacher, req.params.id);
  if (!batch) return res.status(404).send('Not found');
  const owner = db.prepare('SELECT * FROM teachers WHERE id = ?').get(batch.teacher_id);
  const locked = db.prepare("SELECT id FROM career_attempts WHERE batch_id = ? AND status = 'locked' ORDER BY submitted_at").all(batch.id);
  let n = 0;
  const unlocked = [];
  const run = db.transaction(() => {
    for (const a of locked) {
      if (!useSeat(owner, batch.tier)) break;
      db.prepare("UPDATE career_attempts SET status = 'done' WHERE id = ?").run(a.id);
      unlocked.push(a.id);
      n++;
    }
  });
  run();
  if (TIERS[batch.tier].ai) unlocked.forEach((id) => generateAiReport(id));
  if (!n) return res.redirect(`/career/batches/${batch.id}?error=` + encodeURIComponent(`No ${TIERS[batch.tier].name} seats left. Buy seats on the Career Test page first.`));
  res.redirect(`/career/batches/${batch.id}?unlocked=${n}`);
});

router.post('/career/attempts/:id/retry-ai', requireTeacher, (req, res) => {
  const a = db.prepare('SELECT * FROM career_attempts WHERE id = ?').get(req.params.id);
  const batch = a && getBatchFor(req.teacher, a.batch_id);
  if (!batch) return res.status(404).send('Not found');
  if (a.status === 'done' && TIERS[batch.tier].ai) generateAiReport(a.id);
  res.redirect(`/career/batches/${batch.id}`);
});

router.get('/career/batches/:id/summary', requireTeacher, (req, res) => {
  const batch = getBatchFor(req.teacher, req.params.id);
  if (!batch) return res.status(404).send('Not found');
  const attempts = db.prepare("SELECT * FROM career_attempts WHERE batch_id = ? AND status = 'done' ORDER BY section, roll_no, student_name").all(batch.id);
  const rows = attempts.map((a) => ({ ...a, result: JSON.parse(a.result_json) }));
  // Class-wide average of each aptitude area and interest type.
  const avg = (pick) => {
    if (!rows.length) return [];
    const first = pick(rows[0].result);
    return first.map((x, i) => ({ label: x.label, pct: Math.round(rows.reduce((s, r) => s + pick(r.result)[i].pct, 0) / rows.length) }));
  };
  res.render('career_summary', {
    batch,
    conductor: conductorName(batch),
    rows,
    summary: batchSummary(batch, attempts),
    aptitudeAvg: avg((r) => r.aptitude),
    interestAvg: avg((r) => r.interests.slice().sort((a, b) => a.key.localeCompare(b.key))),
    optionName: (k) => optionName(batch.level, k)
  });
});

router.get('/career/batches/:id/export.csv', requireTeacher, (req, res) => {
  const batch = getBatchFor(req.teacher, req.params.id);
  if (!batch) return res.status(404).send('Not found');
  const attempts = db.prepare('SELECT * FROM career_attempts WHERE batch_id = ? ORDER BY section, roll_no, student_name').all(batch.id);
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = ['Name', 'Section', 'Roll no', 'Class 12 stream', 'Own goal', 'Status', 'Top 1', 'Fit 1', 'Top 2', 'Top 3', 'Interest code', 'Needs counselling', 'Reasons', 'Parent phone', 'Report link'];
  const lines = attempts.map((a) => {
    const r = a.result_json ? JSON.parse(a.result_json) : null;
    return [
      a.student_name,
      a.section,
      a.roll_no,
      CLASS12_STREAMS[a.current_stream] || '',
      a.aspiration,
      a.status,
      r && r.top[0] ? r.top[0].name : '',
      r && r.top[0] ? r.top[0].fit : '',
      r && r.top[1] ? r.top[1].name : '',
      r && r.top[2] ? r.top[2].name : '',
      r ? r.interestCode : '',
      a.needs_counselling ? 'Yes' : '',
      r ? r.counselReasons.join('; ') : '',
      a.parent_phone,
      a.status === 'done' ? `${SITE_ORIGIN}/career-report/${a.token}` : ''
    ].map(esc).join(',');
  });
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="career-${batch.code}.csv"`);
  res.send('﻿' + [head.map(esc).join(',')].concat(lines).join('\n'));
});

// ---------------------------------------------------------------- student

function openBatch(code) {
  return db.prepare('SELECT * FROM career_batches WHERE code = ?').get(String(code || '').toUpperCase());
}

router.get('/c', (req, res) => {
  if (req.query.code) return res.redirect(`/c/${encodeURIComponent(String(req.query.code).trim().toUpperCase())}`);
  res.render('career_start', { batch: null, conductor: '', streams: CLASS12_STREAMS, languages: LANGUAGES, error: null, form: {} });
});

router.get('/c/:code', (req, res) => {
  const batch = openBatch(req.params.code);
  if (!batch) return res.status(404).render('career_start', { batch: null, conductor: '', streams: CLASS12_STREAMS, languages: LANGUAGES, error: 'That test code was not found. Check it with your teacher.', form: {} });
  res.render('career_start', { batch, conductor: conductorName(batch), streams: CLASS12_STREAMS, languages: LANGUAGES, error: batch.open ? null : 'This test is closed. Ask your teacher to open it.', form: {} });
});

router.post('/c/:code', (req, res) => {
  const batch = openBatch(req.params.code);
  if (!batch) return res.status(404).send('Not found');
  const f = {
    student_name: String(req.body.student_name || '').trim().slice(0, 80),
    section: String(req.body.section || '').trim().slice(0, 40),
    roll_no: String(req.body.roll_no || '').trim().slice(0, 20),
    current_stream: CLASS12_STREAMS[req.body.current_stream] ? req.body.current_stream : '',
    aspiration: String(req.body.aspiration || '').trim().slice(0, 120),
    parent_phone: String(req.body.parent_phone || '').replace(/[^\d+]/g, '').slice(0, 15),
    language: LANGUAGES.includes(req.body.language) ? req.body.language : batch.language
  };
  const fail = (error) => res.status(400).render('career_start', { batch, conductor: conductorName(batch), streams: CLASS12_STREAMS, languages: LANGUAGES, error, form: f });
  if (!batch.open) return fail('This test is closed. Ask your teacher to open it.');
  if (!f.student_name) return fail('Please enter your name.');
  if (batch.level === '12' && !f.current_stream) return fail('Please choose your Class 12 stream.');

  const token = newToken();
  db.prepare(
    'INSERT INTO career_attempts (batch_id, token, student_name, section, roll_no, current_stream, aspiration, parent_phone, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(batch.id, token, f.student_name, f.section, f.roll_no, f.current_stream, f.aspiration, f.parent_phone, f.language);
  res.redirect(`/c/t/${token}`);
});

function attemptByToken(token) {
  const a = db.prepare('SELECT * FROM career_attempts WHERE token = ?').get(String(token || ''));
  if (!a) return null;
  a.batch = db.prepare('SELECT * FROM career_batches WHERE id = ?').get(a.batch_id);
  return a;
}

router.get('/c/t/:token', (req, res) => {
  const a = attemptByToken(req.params.token);
  if (!a) return res.status(404).send('This test link is not valid.');
  if (a.status !== 'in_progress') return res.redirect(`/career-report/${a.token}`);
  res.render('career_test', { attempt: a, batch: a.batch, sections: publicSections() });
});

router.post('/c/t/:token', (req, res) => {
  const a = attemptByToken(req.params.token);
  if (!a) return res.status(404).send('This test link is not valid.');
  if (a.status !== 'in_progress') return res.redirect(`/career-report/${a.token}`);

  const answers = {};
  Object.entries(req.body || {}).forEach(([k, v]) => {
    if (/^[aip]_[a-zA-Z]+_\d+$/.test(k)) answers[k] = String(v).slice(0, 2);
  });
  const result = buildResult(a.batch.level, a, answers);
  const owner = db.prepare('SELECT * FROM teachers WHERE id = ?').get(a.batch.teacher_id);

  let status = 'locked';
  db.transaction(() => {
    if (owner && useSeat(owner, a.batch.tier)) status = 'done';
    db.prepare(
      "UPDATE career_attempts SET status = ?, answers_json = ?, result_json = ?, top_key = ?, needs_counselling = ?, submitted_at = datetime('now') WHERE id = ?"
    ).run(status, JSON.stringify(answers), JSON.stringify(result), result.top[0] ? result.top[0].key : null, result.needsCounselling ? 1 : 0, a.id);
  })();

  if (status === 'done' && TIERS[a.batch.tier].ai) generateAiReport(a.id);
  res.redirect(`/career-report/${a.token}`);
});

router.get('/career-report/:token', (req, res) => {
  const a = attemptByToken(req.params.token);
  if (!a) return res.status(404).send('This report link is not valid.');
  if (a.status === 'in_progress') return res.redirect(`/c/t/${a.token}`);
  const tier = TIERS[a.batch.tier];
  res.render('career_report', {
    attempt: a,
    batch: a.batch,
    tier,
    conductor: conductorName(a.batch),
    result: a.result_json ? JSON.parse(a.result_json) : null,
    ai: a.ai_json ? JSON.parse(a.ai_json) : null,
    counselLink: counselLink(a.student_name),
    counselPartner: counselPartner(),
    reportUrl: `${SITE_ORIGIN}/career-report/${a.token}`
  });
});

module.exports = router;
