// Question paper generator: builds a printable paper from the teacher's own
// question bank and the NEET bank first, and asks the AI only for whatever is
// still missing. Papers are stored as a snapshot (editing a test later never
// changes a printed paper) and can be printed in up to 4 shuffled sets
// (A/B/C/D), each with its own answer key — the OMR scanner grades against
// these keys.
const db = require('./db');
const { complete, extractJsonObject } = require('./ai');

const SET_LETTERS = ['A', 'B', 'C', 'D'];
const TYPES = {
  mcq: { label: 'Multiple choice', defaultTitle: 'Multiple choice questions' },
  short: { label: 'Short answer', defaultTitle: 'Short answer questions' },
  long: { label: 'Long answer', defaultTitle: 'Long answer questions' }
};
const MAX_QUESTIONS = 150;
const MAX_AI_QUESTIONS = 60;

// ---- seeded shuffling, so a set always prints the same way -------------
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// One printable set. Set A keeps the order the teacher reviewed; B/C/D shuffle
// MCQ order and option order. Returns numbered sections plus the MCQ key
// (0-based option index per MCQ, in printed order) for the OMR scanner.
function setView(paper, setIndex = 0) {
  const sections = JSON.parse(paper.sections_json);
  const rand = rng(paper.seed + setIndex * 7919);
  let n = 0;
  const key = [];
  const out = sections.map((sec) => {
    let qs = sec.questions.map((q) => ({ ...q }));
    if (setIndex > 0 && sec.type === 'mcq') {
      qs = shuffle(qs, rand).map((q) => {
        // Options that refer to other options ("All of the above", "Both (a)
        // and (b)") only make sense in their original order — keep those.
        const fixed = q.options.some((o) => /\b(above|below|both|all of|none of|neither)\b|\([a-d]\)|\b[a-d] and [a-d]\b/i.test(o));
        const order = fixed ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i), rand);
        return { ...q, options: order.map((i) => q.options[i]), correct: order.indexOf(q.correct) };
      });
    }
    qs = qs.map((q) => {
      n += 1;
      if (sec.type === 'mcq') key.push({ n, correct: q.correct });
      return { ...q, n };
    });
    return { ...sec, questions: qs };
  });
  const totalMarks = out.reduce((s, sec) => s + sec.marks * sec.questions.length, 0);
  return { letter: SET_LETTERS[setIndex], sections: out, key, totalMarks, totalQuestions: n };
}

function getPaper(teacherId, id) {
  const p = db.prepare('SELECT * FROM papers WHERE id = ? AND teacher_id = ?').get(id, teacherId);
  if (p) p.header = JSON.parse(p.header_json);
  return p;
}

// Chapters in the teacher's own tests, with MCQ / short / long counts.
function ownChapters(teacherId) {
  return db
    .prepare(
      `SELECT COALESCE(NULLIF(q.chapter, ''), 'General') AS chapter,
         SUM(q.type = 'mcq') AS mcq, SUM(q.type != 'mcq' AND q.max_marks <= 3) AS short, SUM(q.type != 'mcq' AND q.max_marks > 3) AS long
       FROM questions q JOIN tests t ON t.id = q.test_id WHERE t.teacher_id = ?
       GROUP BY 1 ORDER BY 1`
    )
    .all(teacherId);
}

function pickOwn(teacherId, chapters, type, limit, seen) {
  if (!chapters.length || limit <= 0) return [];
  const typeSql = type === 'mcq' ? "q.type = 'mcq'" : type === 'short' ? "q.type != 'mcq' AND q.max_marks <= 3" : "q.type != 'mcq' AND q.max_marks > 3";
  const rows = db
    .prepare(
      `SELECT q.* FROM questions q JOIN tests t ON t.id = q.test_id
       WHERE t.teacher_id = ? AND ${typeSql} AND COALESCE(NULLIF(q.chapter, ''), 'General') IN (${chapters.map(() => '?').join(',')})
       ORDER BY RANDOM()`
    )
    .all(teacherId, ...chapters);
  const out = [];
  for (const r of rows) {
    const k = r.text.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(
      type === 'mcq'
        ? { text: r.text, options: JSON.parse(r.options_json), correct: r.correct_index, chapter: r.chapter, source: 'mine' }
        : { text: r.text, answer: '', chapter: r.chapter, source: 'mine' }
    );
    if (out.length >= limit) break;
  }
  return out;
}

// NEET bank MCQs honouring the easy/medium/hard mix, topped up from any
// difficulty if a band runs short.
function pickBank(chapters, limit, mix, seen) {
  if (!chapters.length || limit <= 0) return [];
  const inCh = `chapter IN (${chapters.map(() => '?').join(',')})`;
  const quota = { easy: Math.round((limit * mix.easy) / 100), hard: Math.round((limit * mix.hard) / 100) };
  quota.medium = Math.max(0, limit - quota.easy - quota.hard);
  const out = [];
  const take = (rows, max) => {
    for (const r of rows) {
      if (out.length >= limit || max <= 0) break;
      const k = r.text.trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ text: r.text, options: JSON.parse(r.options_json), correct: r.correct_index, chapter: r.chapter, difficulty: r.difficulty, source: 'bank' });
      max -= 1;
    }
  };
  ['easy', 'medium', 'hard'].forEach((d) =>
    take(db.prepare(`SELECT * FROM bank_questions WHERE ${inCh} AND difficulty = ? ORDER BY RANDOM() LIMIT ?`).all(...chapters, d, quota[d] * 2 + 5), quota[d])
  );
  if (out.length < limit) take(db.prepare(`SELECT * FROM bank_questions WHERE ${inCh} ORDER BY RANDOM() LIMIT ?`).all(...chapters, limit * 2), limit - out.length);
  return out;
}

const AI_PROMPT = ({ header, topics, sourceText, need, mix }) => `You are an experienced Indian school teacher setting an exam question paper.

Class: ${header.className || '(not given)'}
Subject: ${header.subject || '(not given)'}
Chapters / topics to cover: ${topics}
${sourceText ? `\nSyllabus or notes to base questions on:\n"""\n${sourceText.slice(0, 12000)}\n"""\n` : ''}
Difficulty mix: about ${mix.easy}% easy, ${mix.medium}% medium, ${mix.hard}% hard.

Write exactly:
- ${need.mcq} multiple-choice questions (4 options, one correct)
- ${need.short} short-answer questions (2-3 marks each)
- ${need.long} long-answer questions (5 marks each)

Spread questions across the chapters. Match the level of the class and the style of CBSE / state board papers. For short and long answers, give the key points a full-marks answer must contain (this goes into the teacher's marking scheme, not the student paper).

Respond with ONLY a JSON object (no prose, no markdown fences) of this exact shape:
{"mcq": [{"text": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "chapter": "...", "difficulty": "easy|medium|hard"}],
 "short": [{"text": "...", "answer": "key points", "chapter": "..."}],
 "long": [{"text": "...", "answer": "key points", "chapter": "..."}]}
Use empty arrays for any type with 0 questions.`;

async function aiQuestions({ header, topics, sourceText, need, mix, meter }) {
  const maxTokens = Math.min(16000, 600 + need.mcq * 160 + need.short * 220 + need.long * 420);
  const raw = await complete(AI_PROMPT({ header, topics, sourceText, need, mix }), { meter, maxTokens });
  const o = extractJsonObject(raw);
  const mcq = (Array.isArray(o.mcq) ? o.mcq : [])
    .filter((q) => q && q.text && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correctIndex))
    .slice(0, need.mcq)
    .map((q) => ({
      text: String(q.text).slice(0, 600),
      options: q.options.slice(0, 4).map((x) => String(x).slice(0, 200)),
      correct: Math.max(0, Math.min(Math.min(q.options.length, 4) - 1, q.correctIndex)),
      chapter: String(q.chapter || '').slice(0, 100),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : '',
      source: 'ai'
    }));
  const desc = (arr, n) =>
    (Array.isArray(arr) ? arr : [])
      .filter((q) => q && q.text)
      .slice(0, n)
      .map((q) => ({ text: String(q.text).slice(0, 800), answer: String(q.answer || '').slice(0, 1200), chapter: String(q.chapter || '').slice(0, 100), source: 'ai' }));
  return { mcq, short: desc(o.short, need.short), long: desc(o.long, need.long) };
}

module.exports = { SET_LETTERS, TYPES, MAX_QUESTIONS, MAX_AI_QUESTIONS, setView, getPaper, ownChapters, pickOwn, pickBank, aiQuestions };
