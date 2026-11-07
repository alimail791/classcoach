// Question paper generator. See lib/papers.js.
const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { trackEnabled } = require('../lib/plans');
const { chapterIndex } = require('../lib/bank');
const { checkAiLimit, recordAiUsage } = require('../lib/usage');
const { creditsFor } = require('../lib/credits');
const P = require('../lib/papers');

const router = express.Router();

const bankAllowed = (teacher) => trackEnabled() && teacher.exam_track === 'neet_jee';
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String).filter(Boolean).slice(0, 60);
const int = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? dflt : Math.max(min, Math.min(max, n));
};

const DEFAULT_INSTRUCTIONS = 'All questions are compulsory.\nRead each question carefully before answering.\nFor multiple choice questions, choose the one best answer.';

function defaultHeader(teacher) {
  const last = db.prepare('SELECT header_json FROM papers WHERE teacher_id = ? ORDER BY id DESC LIMIT 1').get(teacher.id);
  if (last) {
    const h = JSON.parse(last.header_json);
    return { school: h.school, instructions: h.instructions, className: h.className, subject: h.subject, duration: h.duration };
  }
  const inst = teacher.institute_id ? db.prepare('SELECT name FROM institutes WHERE id = ?').get(teacher.institute_id) : null;
  return { school: inst ? inst.name : teacher.name, instructions: DEFAULT_INSTRUCTIONS, className: '', subject: '', duration: 60 };
}

function formData(req, extra) {
  return Object.assign(
    {
      teacher: req.teacher,
      papers: db.prepare('SELECT id, title, header_json, sets, created_at FROM papers WHERE teacher_id = ? ORDER BY id DESC LIMIT 50').all(req.teacher.id).map((p) => ({ ...p, header: JSON.parse(p.header_json) })),
      ownChapters: P.ownChapters(req.teacher.id),
      bankIndex: bankAllowed(req.teacher) ? chapterIndex() : null,
      header: defaultHeader(req.teacher),
      paperCredits: creditsFor('paper', { count: 10 }),
      error: null,
      notice: null
    },
    extra || {}
  );
}

router.get('/papers', requireTeacher, (req, res) => {
  res.render('papers', formData(req, { error: req.query.error || null }));
});

router.post('/papers', requireTeacher, async (req, res) => {
  const b = req.body;
  const header = {
    school: String(b.school || '').trim().slice(0, 160),
    exam: String(b.exam || '').trim().slice(0, 160),
    className: String(b.className || '').trim().slice(0, 60),
    subject: String(b.subject || '').trim().slice(0, 80),
    duration: int(b.duration, 5, 600, 60),
    instructions: String(b.instructions || '').trim().slice(0, 1500)
  };
  const fail = (error) => res.status(400).render('papers', formData(req, { error, header }));
  if (!header.exam) return fail('Give the paper a name, e.g. "Half-yearly exam".');

  const want = {
    mcq: { count: int(b.mcq_count, 0, 150, 0), marks: int(b.mcq_marks, 1, 20, 1) },
    short: { count: int(b.short_count, 0, 60, 0), marks: int(b.short_marks, 1, 20, 2) },
    long: { count: int(b.long_count, 0, 30, 0), marks: int(b.long_marks, 1, 30, 5) }
  };
  const totalWanted = want.mcq.count + want.short.count + want.long.count;
  if (!totalWanted) return fail('Add at least one question to a section.');
  if (totalWanted > P.MAX_QUESTIONS) return fail(`A paper can have up to ${P.MAX_QUESTIONS} questions.`);

  let mix = { easy: int(b.mix_easy, 0, 100, 30), medium: int(b.mix_medium, 0, 100, 50), hard: int(b.mix_hard, 0, 100, 20) };
  const mixSum = mix.easy + mix.medium + mix.hard || 1;
  mix = { easy: Math.round((mix.easy * 100) / mixSum), medium: 0, hard: Math.round((mix.hard * 100) / mixSum) };
  mix.medium = 100 - mix.easy - mix.hard;

  const mine = list(b.mine_chapters);
  const bank = bankAllowed(req.teacher) ? list(b.bank_chapters) : [];
  const useAi = b.use_ai === '1';
  const topics = String(b.topics || '').trim().slice(0, 1000) || [...bank, ...mine].join(', ');
  const sourceText = String(b.source_text || '').trim();
  const sets = int(b.sets, 1, 4, 1);

  // 1) Bank first: NEET bank, then the teacher's own questions.
  const seen = new Set();
  const picked = { mcq: [], short: [], long: [] };
  picked.mcq = P.pickBank(bank, want.mcq.count, mix, seen);
  picked.mcq = picked.mcq.concat(P.pickOwn(req.teacher.id, mine, 'mcq', want.mcq.count - picked.mcq.length, seen));
  picked.short = P.pickOwn(req.teacher.id, mine, 'short', want.short.count, seen);
  picked.long = P.pickOwn(req.teacher.id, mine, 'long', want.long.count, seen);

  // 2) AI writes only what's missing.
  const need = { mcq: want.mcq.count - picked.mcq.length, short: want.short.count - picked.short.length, long: want.long.count - picked.long.length };
  const needTotal = need.mcq + need.short + need.long;
  let notice = null;
  if (needTotal > 0) {
    if (!useAi) {
      notice = `Your chosen chapters had ${needTotal} question${needTotal === 1 ? '' : 's'} fewer than asked, so the paper is shorter. Tick "Let AI write the missing questions" to fill the gap.`;
    } else if (!topics) {
      return fail('Tick some chapters or type the chapters/topics so the AI knows what to write about.');
    } else if (needTotal > P.MAX_AI_QUESTIONS) {
      return fail(`AI can write up to ${P.MAX_AI_QUESTIONS} questions per paper (${needTotal} needed). Pick more chapters from your bank or reduce the counts.`);
    } else {
      const credits = creditsFor('paper', { count: needTotal });
      const check = checkAiLimit(req.teacher, credits);
      if (!check.allowed) return fail(check.message);
      try {
        const meter = {};
        const ai = await P.aiQuestions({ header, topics, sourceText, need, mix, meter });
        picked.mcq = picked.mcq.concat(ai.mcq);
        picked.short = picked.short.concat(ai.short);
        picked.long = picked.long.concat(ai.long);
        recordAiUsage(req.teacher, { feature: 'paper', credits, meter });
        const got = ai.mcq.length + ai.short.length + ai.long.length;
        if (got < needTotal) notice = `The AI returned ${got} of the ${needTotal} questions needed. Review the paper and add questions if required.`;
      } catch (err) {
        console.error('Paper AI failed:', err.message);
        return fail(`AI could not write the questions: ${err.message}`);
      }
    }
  }

  const titles = { mcq: b.mcq_title, short: b.short_title, long: b.long_title };
  const sections = [];
  ['mcq', 'short', 'long'].forEach((type) => {
    if (!picked[type].length) return;
    sections.push({
      key: String.fromCharCode(65 + sections.length),
      type,
      title: String(titles[type] || '').trim().slice(0, 120) || P.TYPES[type].defaultTitle,
      marks: want[type].marks,
      questions: picked[type]
    });
  });
  if (!sections.length) return fail('No questions found for those chapters. Pick other chapters or let the AI write them.');

  const title = [header.exam, header.className && `Class ${header.className}`, header.subject].filter(Boolean).join(' · ');
  const id = db
    .prepare('INSERT INTO papers (teacher_id, title, header_json, sections_json, sets, seed) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.teacher.id, title.slice(0, 200), JSON.stringify(header), JSON.stringify(sections), sets, Math.floor(Math.random() * 1e9) + 1).lastInsertRowid;
  res.redirect(`/papers/${id}` + (notice ? `?notice=${encodeURIComponent(notice)}` : ''));
});

router.get('/papers/:id', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const view = P.setView(paper, 0);
  const batches = db.prepare('SELECT id, name FROM batches WHERE teacher_id = ? ORDER BY name').all(req.teacher.id);
  res.render('paper_view', { teacher: req.teacher, paper, view, batches, letters: P.SET_LETTERS.slice(0, paper.sets), notice: req.query.notice || null, error: req.query.error || null });
});

router.post('/papers/:id/remove', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const sections = JSON.parse(paper.sections_json);
  const s = sections[int(req.body.s, 0, 10, -1)];
  const i = int(req.body.i, 0, 500, -1);
  if (s && s.questions[i]) s.questions.splice(i, 1);
  const kept = sections.filter((sec) => sec.questions.length);
  kept.forEach((sec, k) => (sec.key = String.fromCharCode(65 + k)));
  db.prepare('UPDATE papers SET sections_json = ? WHERE id = ?').run(JSON.stringify(kept), paper.id);
  res.redirect(`/papers/${paper.id}`);
});

router.post('/papers/:id/settings', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  db.prepare('UPDATE papers SET sets = ? WHERE id = ?').run(int(req.body.sets, 1, 4, paper.sets), paper.id);
  res.redirect(`/papers/${paper.id}`);
});

// Printable paper or answer key for one set. ?set=B&key=1
router.get('/papers/:id/print', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const setIndex = Math.max(0, Math.min(paper.sets - 1, P.SET_LETTERS.indexOf(String(req.query.set || 'A').toUpperCase())));
  res.render('paper_print', { paper, header: paper.header, view: P.setView(paper, setIndex), showSet: paper.sets > 1, answerKey: req.query.key === '1' });
});

// Turns the paper (Set A) into an online ClassCoach test for one batch.
router.post('/papers/:id/to-test', requireTeacher, (req, res) => {
  const paper = P.getPaper(req.teacher.id, req.params.id);
  if (!paper) return res.status(404).send('Paper not found');
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.body.batch_id, req.teacher.id);
  if (!batch) return res.redirect(`/papers/${paper.id}?error=` + encodeURIComponent('Choose a batch.'));
  const view = P.setView(paper, 0);
  const testId = db
    .prepare('INSERT INTO tests (teacher_id, batch_id, title, chapter, duration_minutes) VALUES (?, ?, ?, ?, ?)')
    .run(req.teacher.id, batch.id, paper.title.slice(0, 120), paper.header.subject || '', paper.header.duration || 60).lastInsertRowid;
  const ins = db.prepare('INSERT INTO questions (test_id, type, text, options_json, correct_index, max_marks, chapter, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  let pos = 0;
  view.sections.forEach((sec) =>
    sec.questions.forEach((q) => {
      // Online tests score every MCQ as 1 mark (routes/student.js).
      if (sec.type === 'mcq') ins.run(testId, 'mcq', q.text, JSON.stringify(q.options), q.correct, 1, q.chapter || '', pos++);
      else ins.run(testId, 'descriptive', q.text, '[]', -1, sec.marks, q.chapter || '', pos++);
    })
  );
  res.redirect(`/tests/${testId}/edit`);
});

router.post('/papers/:id/delete', requireTeacher, (req, res) => {
  db.prepare('DELETE FROM papers WHERE id = ? AND teacher_id = ?').run(req.params.id, req.teacher.id);
  res.redirect('/papers');
});

module.exports = router;
