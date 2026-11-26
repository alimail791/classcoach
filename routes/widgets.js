// Website widgets: the teacher's /widgets page, the public /embed/* pages that
// sit inside other sites' iframes, and the public /free-tools/widgets page.
const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const W = require('../lib/widgets');

const router = express.Router();
const MAX_QUIZ = 15;

// Embeds must load inside any site's iframe and never be cached stale.
function embedHeaders(res) {
  res.removeHeader('X-Frame-Options');
  res.set('Content-Security-Policy', 'frame-ancestors *');
  res.set('Cache-Control', 'no-store');
}

const mcqs = (testId) =>
  db.prepare("SELECT * FROM questions WHERE test_id = ? AND type = 'mcq' ORDER BY position, id LIMIT ?").all(testId, MAX_QUIZ).map((q) => {
    let options = [];
    try { options = JSON.parse(q.options_json); } catch (e) { /* ignore */ }
    return { id: q.id, text: q.text, options, correct: q.correct_index };
  });

// ---- Teacher page ------------------------------------------------------

router.get('/widgets', requireTeacher, (req, res) => {
  const t = req.teacher;
  const batches = db.prepare('SELECT * FROM batches WHERE teacher_id = ? ORDER BY name').all(t.id);
  const tests = db
    .prepare(
      `SELECT t.id, t.title, t.status, t.embed_token, b.name AS batch_name,
        (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id AND q.type = 'mcq') AS mcq_count
       FROM tests t JOIN batches b ON b.id = t.batch_id
       WHERE t.teacher_id = ? AND t.status IN ('published', 'closed') ORDER BY t.id DESC LIMIT 50`
    )
    .all(t.id);
  const views = W.viewsFor([...batches.map((b) => `join:${b.id}`), ...tests.map((x) => `quiz:${x.id}`)]);
  res.render('widgets', { teacher: t, batches, tests, views, SITE: W.SITE, iframe: W.iframe, maxQuiz: MAX_QUIZ, notice: req.query.done || null,
    D: require('../lib/directory'), listingSaved: req.query.listing === 'saved', listingError: req.query.listing_error || '', yneetSync: req.query.yneet || '' });
});

router.post('/widgets/quiz/:id/:action(on|off)', requireTeacher, (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  if (!test) return res.redirect('/widgets');
  db.prepare('UPDATE tests SET embed_token = ? WHERE id = ?').run(req.params.action === 'on' ? test.embed_token || W.newToken() : null, test.id);
  res.redirect(`/widgets?done=${req.params.action}#quiz-${test.id}`);
});

// ---- Public embeds -----------------------------------------------------

router.get('/embed/join/:code', (req, res) => {
  embedHeaders(res);
  const batch = db.prepare('SELECT * FROM batches WHERE join_code = ?').get(String(req.params.code).toUpperCase());
  if (!batch) return res.status(404).render('embed_join', { batch: null, teacher: null, students: 0, powered: W.poweredBy('join') });
  const teacher = db.prepare('SELECT id, name, active FROM teachers WHERE id = ?').get(batch.teacher_id);
  if (!teacher || !teacher.active) return res.status(404).render('embed_join', { batch: null, teacher: null, students: 0, powered: W.poweredBy('join') });
  const students = db.prepare('SELECT COUNT(*) AS n FROM students WHERE batch_id = ?').get(batch.id).n;
  W.count(`join:${batch.id}`);
  res.render('embed_join', { batch, teacher, students, powered: W.poweredBy('join'), SITE: W.SITE });
});

function quizContext(token) {
  const test = token ? db.prepare('SELECT * FROM tests WHERE embed_token = ?').get(String(token)) : null;
  if (!test || !['published', 'closed'].includes(test.status)) return null;
  const teacher = db.prepare('SELECT id, name, active FROM teachers WHERE id = ?').get(test.teacher_id);
  if (!teacher || !teacher.active) return null;
  const batch = db.prepare('SELECT name, join_code FROM batches WHERE id = ?').get(test.batch_id);
  const questions = mcqs(test.id);
  if (!questions.length) return null;
  return { test, teacher, batch, questions };
}

router.get('/embed/quiz/:token', (req, res) => {
  embedHeaders(res);
  const ctx = quizContext(req.params.token);
  if (!ctx) return res.status(404).render('embed_quiz', { ctx: null, result: null, powered: W.poweredBy('quiz') });
  W.count(`quiz:${ctx.test.id}`);
  res.render('embed_quiz', { ctx, result: null, powered: W.poweredBy('quiz'), SITE: W.SITE });
});

router.post('/embed/quiz/:token', (req, res) => {
  embedHeaders(res);
  const ctx = quizContext(req.params.token);
  if (!ctx) return res.status(404).render('embed_quiz', { ctx: null, result: null, powered: W.poweredBy('quiz') });
  const answers = ctx.questions.map((q) => {
    const v = req.body[`q${q.id}`];
    return v === undefined || v === '' ? null : parseInt(v, 10);
  });
  const score = ctx.questions.reduce((n, q, i) => n + (answers[i] === q.correct ? 1 : 0), 0);
  res.render('embed_quiz', { ctx, result: { answers, score, total: ctx.questions.length }, powered: W.poweredBy('quiz'), SITE: W.SITE });
});

router.get('/embed/qotd', (req, res) => {
  embedHeaders(res);
  const q = W.questionOfTheDay(String(req.query.subject || ''));
  W.count('qotd');
  res.render('embed_qotd', { q, powered: W.poweredBy('qotd'), SITE: W.SITE });
});

// ---- Public page with the embed code (SEO + backlinks) ------------------

router.get('/free-tools/widgets', (req, res) => {
  res.render('free_widgets', {
    indexable: true,
    canonicalUrl: `${W.SITE}/free-tools/widgets`,
    title: 'Free Question of the Day Widget for Your Website (Physics, Chemistry, Biology) | ClassCoach',
    description:
      'Add a free daily Physics, Chemistry or Biology MCQ to your coaching centre or school website with one line of code. NEET-level questions, changes every day, no login.',
    SITE: W.SITE,
    SUBJECTS: W.SUBJECTS,
    iframe: W.iframe,
  });
});

module.exports = router;
