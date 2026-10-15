// Live quiz engine (Kahoot / Wayground style).
//
// Games live in memory, keyed by a 6-digit PIN. Screens get updates over
// Server-Sent Events: plain HTTP, no extra dependency, and it reconnects on
// its own after a network drop, which matters on patchy mobile data. Students
// can also poll /play/:pin/state if SSE is blocked somewhere along the way.
//
// Because state is in memory, this assumes ClassCoach runs as one instance
// (true on Railway today). A redeploy mid-game ends that game; results are
// only written to SQLite when the game finishes (see persist()).

const crypto = require('crypto');
const db = require('./db');

const games = new Map(); // pin -> game
const GAME_TTL_MS = 4 * 60 * 60 * 1000; // drop abandoned games after 4h
const ENDED_TTL_MS = 30 * 60 * 1000; // keep a finished game 30 min for late screens
const REVEAL_GRACE_MS = 800; // small allowance for slow networks before auto-reveal

function newPin() {
  let pin;
  do {
    pin = String(crypto.randomInt(100000, 1000000));
  } while (games.has(pin));
  return pin;
}

function getGame(pin) {
  return games.get(String(pin || '').replace(/\D/g, '')) || null;
}

// questions: [{ text, options: [..], correct: index, chapter }]
function createGame({ teacherId, batchId, title, questions, seconds, maxPlayers }) {
  const pin = newPin();
  const game = {
    pin,
    teacherId,
    batchId: batchId || null,
    title: String(title || 'Live quiz').slice(0, 120),
    questions,
    seconds,
    maxPlayers,
    phase: 'lobby', // lobby | question | reveal | board | final
    qi: -1,
    qStartedAt: 0,
    answers: new Map(), // playerId -> { c, ms } for the current question
    players: new Map(), // playerId -> player
    byToken: new Map(), // token -> player
    hostClients: new Set(),
    timer: null,
    createdAt: Date.now(),
    endedAt: null,
    sessionId: null
  };
  games.set(pin, game);
  return game;
}

// ---- players ------------------------------------------------------------

function cleanName(name) {
  return String(name || '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
}

function joinGame(game, { name, studentId }) {
  if (game.phase === 'final') return { error: 'This quiz has ended.' };
  if (studentId) {
    // A logged-in student who re-opens the page gets their old seat back.
    for (const p of game.players.values()) if (p.studentId === studentId) return { player: p };
  }
  if (game.players.size >= game.maxPlayers) {
    return { error: `This quiz is full (${game.maxPlayers} players).` };
  }
  let base = cleanName(name);
  if (!base) return { error: 'Enter your name to join.' };
  const taken = new Set([...game.players.values()].map((p) => p.name.toLowerCase()));
  let finalName = base;
  for (let n = 2; taken.has(finalName.toLowerCase()); n++) finalName = `${base.slice(0, 17)} ${n}`;

  const player = {
    id: crypto.randomBytes(6).toString('hex'),
    token: crypto.randomBytes(18).toString('hex'),
    name: finalName,
    studentId: studentId || null,
    score: 0,
    correct: 0,
    detail: [],
    clients: new Set(),
    joinedAt: Date.now()
  };
  game.players.set(player.id, player);
  game.byToken.set(player.token, player);
  pushHost(game);
  return { player };
}

function playerByToken(game, token) {
  return game.byToken.get(String(token || '')) || null;
}

function removePlayer(game, playerId) {
  const p = game.players.get(playerId);
  if (!p) return;
  game.players.delete(playerId);
  game.byToken.delete(p.token);
  game.answers.delete(playerId);
  p.removed = true;
  send(p.clients, playerView(game, p));
  p.clients.forEach((res) => res.end());
  pushHost(game);
}

function ranked(game) {
  return [...game.players.values()].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
}

// ---- game flow ----------------------------------------------------------

function startQuestion(game, i) {
  clearTimeout(game.timer);
  game.phase = 'question';
  game.qi = i;
  game.answers.clear();
  game.qStartedAt = Date.now();
  game.timer = setTimeout(() => reveal(game), game.seconds * 1000 + REVEAL_GRACE_MS);
  pushAll(game);
}

function submitAnswer(game, player, qi, choice) {
  if (game.phase !== 'question' || qi !== game.qi) return { ok: false, reason: 'closed' };
  if (game.answers.has(player.id)) return { ok: true, duplicate: true };
  const q = game.questions[game.qi];
  const c = Number(choice);
  if (!Number.isInteger(c) || c < 0 || c >= q.options.length) return { ok: false, reason: 'bad_choice' };

  const ms = Date.now() - game.qStartedAt;
  const right = c === q.correct;
  // 500 for a correct answer plus up to 500 for speed.
  const pts = right ? Math.round(500 + 500 * Math.max(0, 1 - ms / (game.seconds * 1000))) : 0;
  game.answers.set(player.id, { c, ms });
  player.score += pts;
  if (right) player.correct += 1;
  player.detail[game.qi] = { c, ok: right, pts };

  pushHost(game);
  send(player.clients, playerView(game, player));
  if (game.answers.size >= game.players.size) setImmediate(() => reveal(game));
  return { ok: true };
}

function reveal(game) {
  if (game.phase !== 'question') return;
  clearTimeout(game.timer);
  for (const p of game.players.values()) {
    if (!game.answers.has(p.id)) p.detail[game.qi] = { c: null, ok: false, pts: 0 };
  }
  game.phase = 'reveal';
  pushAll(game);
}

function finish(game) {
  if (game.phase === 'final') return;
  clearTimeout(game.timer);
  if (game.phase === 'question') reveal(game);
  game.phase = 'final';
  game.endedAt = Date.now();
  try {
    persist(game);
  } catch (e) {
    console.error('Live quiz save failed:', e.message);
  }
  pushAll(game);
}

// Host button presses. Returns an error string or null.
function hostAction(game, action) {
  if (action === 'start') {
    if (game.phase !== 'lobby') return null;
    if (!game.players.size) return 'Wait for at least one student to join.';
    startQuestion(game, 0);
  } else if (action === 'next') {
    if (game.phase === 'question') reveal(game);
    else if (game.phase === 'reveal') {
      game.phase = 'board';
      pushAll(game);
    } else if (game.phase === 'board') {
      if (game.qi < game.questions.length - 1) startQuestion(game, game.qi + 1);
      else finish(game);
    }
  } else if (action === 'end') {
    finish(game);
  } else {
    return 'Unknown action.';
  }
  return null;
}

function persist(game) {
  if (game.sessionId) return;
  const played = game.questions.slice(0, game.qi + 1);
  const order = ranked(game);
  const save = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO live_sessions (teacher_id, batch_id, pin, title, questions_json, player_count) VALUES (?, ?, ?, ?, ?, ?)')
      .run(game.teacherId, game.batchId, game.pin, game.title, JSON.stringify(played), order.length);
    const ins = db.prepare(
      'INSERT INTO live_players (session_id, student_id, name, score, correct, rank, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    order.forEach((p, i) => {
      const detail = played.map((_, qi) => p.detail[qi] || { c: null, ok: false, pts: 0 });
      ins.run(info.lastInsertRowid, p.studentId, p.name, p.score, p.correct, i + 1, JSON.stringify(detail));
    });
    return info.lastInsertRowid;
  });
  game.sessionId = Number(save());
}

// ---- what each screen sees ---------------------------------------------

function remainingMs(game) {
  if (game.phase !== 'question') return 0;
  return Math.max(0, game.seconds * 1000 - (Date.now() - game.qStartedAt));
}

function answerCounts(game) {
  const q = game.questions[game.qi];
  const counts = q ? q.options.map(() => 0) : [];
  for (const a of game.answers.values()) counts[a.c] += 1;
  return counts;
}

function hostView(game) {
  const q = game.questions[game.qi];
  const order = ranked(game);
  const view = {
    phase: game.phase,
    pin: game.pin,
    title: game.title,
    qi: game.qi,
    total: game.questions.length,
    seconds: game.seconds,
    remainingMs: remainingMs(game),
    playerCount: game.players.size,
    maxPlayers: game.maxPlayers,
    answered: game.answers.size,
    sessionId: game.sessionId
  };
  if (game.phase === 'lobby') {
    view.players = [...game.players.values()].map((p) => ({ id: p.id, name: p.name, linked: !!p.studentId }));
  }
  if (q && game.phase !== 'lobby') view.question = { text: q.text, options: q.options, chapter: q.chapter };
  if (game.phase === 'reveal') {
    view.question.correct = q.correct;
    view.counts = answerCounts(game);
  }
  if (game.phase === 'board' || game.phase === 'final') {
    view.board = order.slice(0, game.phase === 'final' ? 10 : 5).map((p) => ({
      name: p.name,
      score: p.score,
      correct: p.correct,
      gained: (p.detail[game.qi] && p.detail[game.qi].pts) || 0
    }));
  }
  if (game.phase === 'final') {
    const n = game.qi + 1;
    const sum = order.reduce((s, p) => s + p.correct, 0);
    view.averagePct = order.length && n ? Math.round((sum / (order.length * n)) * 100) : 0;
  }
  return view;
}

function playerView(game, p) {
  if (p.removed) return { phase: 'removed' };
  const q = game.questions[game.qi];
  const order = ranked(game);
  const view = {
    phase: game.phase,
    title: game.title,
    name: p.name,
    qi: game.qi,
    total: game.questions.length,
    seconds: game.seconds,
    remainingMs: remainingMs(game),
    score: p.score,
    rank: order.indexOf(p) + 1,
    of: order.length
  };
  if (game.phase === 'question') {
    view.question = { text: q.text, options: q.options };
    const a = game.answers.get(p.id);
    view.answered = a ? a.c : null;
  }
  if ((game.phase === 'reveal' || game.phase === 'board') && q) {
    const d = p.detail[game.qi] || { c: null, ok: false, pts: 0 };
    view.result = { ok: d.ok, pts: d.pts, chose: d.c, correctText: q.options[q.correct] };
  }
  if (game.phase === 'final') view.correct = p.correct;
  return view;
}

// ---- SSE plumbing -------------------------------------------------------

function send(clients, data) {
  const line = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(line);
    } catch (e) {
      clients.delete(res);
    }
  }
}

function pushHost(game) {
  if (game.hostClients.size) send(game.hostClients, hostView(game));
}

function pushAll(game) {
  pushHost(game);
  for (const p of game.players.values()) if (p.clients.size) send(p.clients, playerView(game, p));
}

function openStream(req, res, clients, firstPayload) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no' // stop proxies from holding events back
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  res.write(`data: ${JSON.stringify(firstPayload)}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

// Keep-alive comments stop idle connections being cut by proxies, and the
// same tick clears out old games.
setInterval(() => {
  const now = Date.now();
  for (const [pin, g] of games) {
    const all = [g.hostClients, ...[...g.players.values()].map((p) => p.clients)];
    all.forEach((set) => set.forEach((res) => {
      try { res.write(': ping\n\n'); } catch (e) { set.delete(res); }
    }));
    const expired = now - g.createdAt > GAME_TTL_MS || (g.endedAt && now - g.endedAt > ENDED_TTL_MS);
    if (expired) {
      clearTimeout(g.timer);
      all.forEach((set) => set.forEach((res) => res.end()));
      games.delete(pin);
    }
  }
}, 20000).unref();

module.exports = {
  createGame,
  getGame,
  joinGame,
  playerByToken,
  removePlayer,
  submitAnswer,
  hostAction,
  hostView,
  playerView,
  openStream
};
