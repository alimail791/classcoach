const express = require('express');
const QRCode = require('qrcode');
const db = require('../lib/db');
const live = require('../lib/live');
const { requireTeacher } = require('../lib/auth');
const { isPlanActive, trackEnabled, isTrialPlan } = require('../lib/plans');
const { chapterIndex } = require('../lib/bank');
const { buildWhatsAppLink } = require('../lib/whatsapp');

const router = express.Router();
const json = express.json({ limit: '4kb' });

const FREE_PLAYER_LIMIT = 30;
const PAID_PLAYER_LIMIT = 300;
const SECONDS_CHOICES = [10, 20, 30, 45, 60];

// Free and trial accounts host up to 30 players; any active paid plan, 300.
function playerLimit(teacher) {
  const paid = teacher.plan && !isTrialPlan(teacher.plan) && isPlanActive(teacher);
  return paid ? PAID_PLAYER_LIMIT : FREE_PLAYER_LIMIT;
}

function bankAllowed(teacher) {
  return trackEnabled() && teacher.exam_track === 'neet_jee';
}

function origin(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function liveTests(teacherId) {
  return db
    .prepare(
      `SELECT tests.id, tests.title, tests.batch_id, batches.name AS batch_name,
              (SELECT COUNT(*) FROM questions WHERE questions.test_id = tests.id AND questions.type = 'mcq') AS mcq_count
       FROM tests JOIN batches ON batches.id = tests.batch_id
       WHERE tests.teacher_id = ?
       ORDER BY tests.created_at DESC`
    )
    .all(teacherId)
    .filter((t) => t.mcq_count > 0);
}

function hubData(req, extra) {
  const past = db
    .prepare(
      `SELECT live_sessions.*, batches.name AS batch_name FROM live_sessions
       LEFT JOIN batches ON batches.id = live_sessions.batch_id
       WHERE live_sessions.teacher_id = ? ORDER BY live_sessions.created_at DESC LIMIT 30`
    )
    .all(req.teacher.id);
  return Object.assign(
    {
      teacher: req.teacher,
      tests: liveTests(req.teacher.id),
      batches: db.prepare('SELECT * FROM batches WHERE teacher_id = ? ORDER BY name').all(req.teacher.id),
      bank: bankAllowed(req.teacher) ? chapterIndex() : null,
      past,
      limit: playerLimit(req.teacher),
      secondsChoices: SECONDS_CHOICES,
      error: null,
      preselectTest: parseInt(req.query.test, 10) || null,
      hostName: req.get('host')
    },
    extra || {}
  );
}

// ===================== Teacher =====================

router.get('/live', requireTeacher, (req, res) => {
  res.render('live_hub', hubData(req));
});

router.post('/live/start', requireTeacher, (req, res) => {
  const seconds = SECONDS_CHOICES.includes(parseInt(req.body.seconds, 10)) ? parseInt(req.body.seconds, 10) : 20;
  let questions = [];
  let title = '';
  let batchId = null;

  if (req.body.source === 'bank') {
    if (!bankAllowed(req.teacher)) return res.redirect('/live');
    let chapters = req.body.chapters || [];
    if (!Array.isArray(chapters)) chapters = [chapters];
    chapters = chapters.map(String).filter(Boolean).slice(0, 40);
    const count = Math.min(30, Math.max(3, parseInt(req.body.count, 10) || 10));
    if (!chapters.length) return res.render('live_hub', hubData(req, { error: 'Pick at least one chapter.' }));
    const where = [`chapter IN (${chapters.map(() => '?').join(',')})`];
    if (req.body.pyq === '1') where.push('is_pyq = 1');
    questions = db
      .prepare(`SELECT * FROM bank_questions WHERE ${where.join(' AND ')} ORDER BY RANDOM() LIMIT ?`)
      .all(...chapters, count)
      .map((q) => ({ text: q.text, options: JSON.parse(q.options_json), correct: q.correct_index, chapter: q.chapter }));
    title = chapters.length === 1 ? `${chapters[0]} quiz` : `Mixed quiz (${chapters.length} chapters)`;
    const batch = db.prepare('SELECT id FROM batches WHERE id = ? AND teacher_id = ?').get(req.body.batch_id, req.teacher.id);
    batchId = batch ? batch.id : null;
  } else {
    const test = db.prepare('SELECT * FROM tests WHERE id = ? AND teacher_id = ?').get(req.body.test_id, req.teacher.id);
    if (!test) return res.render('live_hub', hubData(req, { error: 'Choose a test to play.' }));
    questions = db
      .prepare("SELECT * FROM questions WHERE test_id = ? AND type = 'mcq' ORDER BY position, id LIMIT 50")
      .all(test.id)
      .map((q) => ({ text: q.text, options: JSON.parse(q.options_json), correct: q.correct_index, chapter: q.chapter || test.chapter }));
    title = test.title;
    batchId = test.batch_id;
  }

  questions = questions.filter((q) => Array.isArray(q.options) && q.options.length >= 2 && q.correct >= 0 && q.correct < q.options.length);
  if (!questions.length) {
    return res.render('live_hub', hubData(req, { error: 'That choice has no multiple-choice questions to play.' }));
  }
  if (req.body.title && req.body.title.trim()) title = req.body.title.trim();

  const game = live.createGame({
    teacherId: req.teacher.id,
    batchId,
    title,
    questions,
    seconds,
    maxPlayers: playerLimit(req.teacher)
  });
  res.redirect(`/live/host/${game.pin}`);
});

function hostGame(req, res) {
  const game = live.getGame(req.params.pin);
  if (!game || game.teacherId !== req.teacher.id) {
    res.status(404).render('live_hub', hubData(req, { error: 'That live quiz has ended or was not found. Start a new one below.' }));
    return null;
  }
  return game;
}

router.get('/live/host/:pin', requireTeacher, async (req, res) => {
  const game = hostGame(req, res);
  if (!game) return;
  const joinUrl = `${origin(req)}/play/${game.pin}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#211C15', light: '#FFFFFF' } });
  const waText = `Join our live quiz "${game.title}" now 👇\n${joinUrl}\nGame PIN: ${game.pin}`;
  res.render('live_host', {
    game,
    joinUrl,
    shortUrl: `${req.get('host')}/play`,
    qrSvg,
    waLink: buildWhatsAppLink('', waText)
  });
});

router.get('/live/host/:pin/events', requireTeacher, (req, res) => {
  const game = hostGame(req, res);
  if (!game) return;
  live.openStream(req, res, game.hostClients, live.hostView(game));
});

router.post('/live/host/:pin/action', requireTeacher, json, (req, res) => {
  const game = live.getGame(req.params.pin);
  if (!game || game.teacherId !== req.teacher.id) return res.status(404).json({ error: 'Game not found.' });
  if (req.body.action === 'kick') {
    live.removePlayer(game, String(req.body.playerId || ''));
    return res.json({ ok: true });
  }
  const error = live.hostAction(game, req.body.action);
  if (error) return res.status(400).json({ error });
  res.json({ ok: true, view: live.hostView(game) });
});

router.get('/live/results/:id', requireTeacher, (req, res) => {
  const session = db.prepare('SELECT * FROM live_sessions WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  if (!session) return res.status(404).send('Result not found');
  const questions = JSON.parse(session.questions_json);
  const players = db
    .prepare(
      `SELECT live_players.*, students.parent_phone, students.phone AS student_phone, students.parent_name
       FROM live_players LEFT JOIN students ON students.id = live_players.student_id
       WHERE session_id = ? ORDER BY rank`
    )
    .all(session.id)
    .map((p) => ({ ...p, detail: JSON.parse(p.detail_json) }));

  const date = new Date(session.created_at + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const perQuestion = questions.map((q, qi) => {
    const right = players.filter((p) => p.detail[qi] && p.detail[qi].ok).length;
    return { ...q, pct: players.length ? Math.round((right / players.length) * 100) : 0 };
  });

  players.forEach((p) => {
    const weak = [...new Set(questions.filter((q, qi) => !(p.detail[qi] && p.detail[qi].ok)).map((q) => q.chapter).filter(Boolean))];
    const lines = [
      `ClassCoach live quiz: ${session.title} (${date})`,
      `${p.name} answered ${p.correct} of ${questions.length} correctly and ranked ${p.rank} of ${players.length} in class.`
    ];
    if (weak.length) lines.push(`Needs practice: ${weak.slice(0, 3).join(', ')}`);
    else lines.push('Full marks today. Well done!');
    lines.push(`- ${req.teacher.name}`);
    p.parentMessage = lines.join('\n');
    p.waLink = p.parent_phone ? buildWhatsAppLink(p.parent_phone, p.parentMessage) : null;
  });

  res.render('live_results', { teacher: req.teacher, session, questions: perQuestion, players, date });
});

// ===================== Students (public) =====================

function linkedStudentId(req, game) {
  if (!req.session.studentId) return null;
  const row = db
    .prepare('SELECT students.id FROM students JOIN batches ON batches.id = students.batch_id WHERE students.id = ? AND batches.teacher_id = ?')
    .get(req.session.studentId, game.teacherId);
  return row ? row.id : null;
}

router.get('/play', (req, res) => {
  res.render('play', { pin: '', title: '', studentName: '', error: req.query.e ? 'No live quiz with that PIN. Check the number on the screen.' : null });
});

router.post('/play', (req, res) => {
  const pin = String(req.body.pin || '').replace(/\D/g, '');
  if (!live.getGame(pin)) return res.redirect('/play?e=1');
  res.redirect(`/play/${pin}`);
});

router.get('/play/:pin', (req, res) => {
  const game = live.getGame(req.params.pin);
  if (!game) return res.redirect('/play?e=1');
  const sid = linkedStudentId(req, game);
  const student = sid ? db.prepare('SELECT name FROM students WHERE id = ?').get(sid) : null;
  res.render('play', { pin: game.pin, title: game.title, studentName: student ? student.name : '', error: null });
});

router.post('/play/:pin/join', json, (req, res) => {
  const game = live.getGame(req.params.pin);
  if (!game) return res.status(404).json({ error: 'This quiz has ended.' });
  const studentId = linkedStudentId(req, game);
  let name = req.body.name;
  if (studentId && !String(name || '').trim()) name = db.prepare('SELECT name FROM students WHERE id = ?').get(studentId).name;
  const { player, error } = live.joinGame(game, { name, studentId });
  if (error) return res.status(400).json({ error });
  res.json({ token: player.token, name: player.name });
});

function playerFor(req, res) {
  const game = live.getGame(req.params.pin);
  if (!game) {
    res.status(404).json({ phase: 'gone' });
    return {};
  }
  const player = live.playerByToken(game, req.query.t || (req.body && req.body.t));
  if (!player) {
    res.status(401).json({ phase: 'rejoin' });
    return {};
  }
  return { game, player };
}

router.get('/play/:pin/events', (req, res) => {
  const { game, player } = playerFor(req, res);
  if (!game) return;
  live.openStream(req, res, player.clients, live.playerView(game, player));
});

// Fallback for networks where the event stream doesn't get through.
router.get('/play/:pin/state', (req, res) => {
  const { game, player } = playerFor(req, res);
  if (!game) return;
  res.set('Cache-Control', 'no-store');
  res.json(live.playerView(game, player));
});

router.post('/play/:pin/answer', json, (req, res) => {
  const { game, player } = playerFor(req, res);
  if (!game) return;
  const result = live.submitAnswer(game, player, Number(req.body.q), req.body.c);
  // "closed" is not an error for the phone: the question moved on, so it
  // should stop retrying a queued answer.
  res.json(result);
});

module.exports = router;
