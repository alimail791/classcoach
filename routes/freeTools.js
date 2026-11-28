// Free, no-login tools (see lib/freeTools.js): a hub page, an AI question
// paper generator and a blank OMR sheet maker. All public and indexable,
// except the generated paper / sheet pages themselves.
const express = require('express');
const QRCode = require('qrcode');
const F = require('../lib/freeTools');
const P = require('../lib/papers');
const T = require('../lib/omr/template');
const SEO = require('../lib/seo_pages');
const { guidesFor } = require('../lib/guides');

const router = express.Router();
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.classcoach.in';
const int = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? dflt : Math.max(min, Math.min(max, n));
};
const str = (v, n) => String(v || '').trim().slice(0, n);

const TOOLS = [
  {
    href: '/free-tools/widgets',
    icon: '🧩',
    name: 'Free question-of-the-day widget',
    blurb: 'Put a new Physics, Chemistry or Biology question on your website or blog every day. Copy one line of code, nothing to update.'
  },
  {
    href: '/free-question-paper-generator',
    icon: '📝',
    name: 'Free AI question paper generator',
    blurb: 'Type the class, subject and chapters. Get a printable question paper with an answer key in about a minute. English, Hindi, Tamil and 6 more languages.'
  },
  {
    href: '/free-omr-sheet-generator',
    icon: '🔘',
    name: 'Free OMR sheet generator',
    blurb: 'Make a printable A4 OMR answer sheet with your school name, exam name and 10 to 125 questions. Print and photocopy as many as you need.'
  }
];

router.get('/free-tools', (req, res) => {
  res.render('free_tools', {
    tools: TOOLS,
    guides: guidesFor('free-tools'),
    indexable: true,
    canonicalUrl: `${SITE_ORIGIN}/free-tools`,
    title: 'Free Tools for Teachers & Tutors — Question Paper and OMR Sheet Generator | ClassCoach',
    description: 'Free tools for Indian teachers and tutors, no login needed: an AI question paper generator with answer key in 9 languages, and a printable OMR answer sheet generator.'
  });
});

// ---- AI question paper generator ---------------------------------------

function paperForm(req, res, extra) {
  res.status(extra && extra.error ? 400 : 200).render('free_paper', {
    indexable: true,
    guides: guidesFor('free-question-paper-generator'),
    canonicalUrl: `${SITE_ORIGIN}/free-question-paper-generator`,
    title: 'Free AI Question Paper Generator with Answer Key (No Login) | ClassCoach',
    description:
      'Make a printable question paper with answer key in about a minute. Free, no login. MCQ, short and long answer questions for any class and subject, in English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali or Gujarati.',
    languages: F.LANGUAGES,
    limits: F.LIMITS,
    perDay: F.PER_VISITOR_PER_DAY,
    formToken: F.issueToken(),
    form: {},
    error: null,
    ...(extra || {})
  });
}

router.get('/free-question-paper-generator', (req, res) => paperForm(req, res));

router.post('/free-question-paper-generator', async (req, res) => {
  const b = req.body || {};
  const form = {
    school: str(b.school, 120),
    exam: str(b.exam, 120) || 'Unit test',
    className: str(b.className, 40),
    subject: str(b.subject, 60),
    topics: str(b.topics, 600),
    language: F.LANGUAGES.includes(b.language) ? b.language : 'English',
    mcq: int(b.mcq, 0, F.LIMITS.mcq, 10),
    short: int(b.short, 0, F.LIMITS.short, 3),
    long: int(b.long, 0, F.LIMITS.long, 1),
    duration: int(b.duration, 10, 240, 60)
  };
  const fail = (error) => paperForm(req, res, { form, error });

  // Bots: honeypot field and a signed, not-too-fast form token. Answer like
  // a normal error so they learn nothing.
  if (b.website || !F.tokenOk(b.ft)) return fail('Please try again: the form expired. Fill it in and press the button once.');
  if (!form.subject) return fail('Add the subject, e.g. Science.');
  if (!form.topics) return fail('Add the chapters or topics, e.g. "Light — reflection and refraction".');
  if (!form.mcq && !form.short && !form.long) return fail('Add at least one question.');
  const blocked = F.checkAllowed('paper', req.ip);
  if (blocked) return fail(blocked);

  const header = {
    school: form.school,
    exam: form.exam,
    className: form.className,
    subject: form.subject,
    duration: form.duration,
    instructions: 'All questions are compulsory.\nRead each question carefully before answering.'
  };
  F.recordUse('paper', req.ip);
  let ai;
  try {
    ai = await P.aiQuestions({
      header,
      topics: form.topics,
      sourceText: '',
      need: { mcq: form.mcq, short: form.short, long: form.long },
      mix: { easy: 30, medium: 50, hard: 20 },
      meter: {},
      language: form.language
    });
  } catch (err) {
    console.error('[Free paper] AI failed:', err.message);
    return fail('Our AI could not write the paper just now. Please try again in a minute.');
  }
  const marks = { mcq: 1, short: 2, long: 5 };
  const titles = { mcq: 'Multiple choice questions', short: 'Short answer questions', long: 'Long answer questions' };
  const sections = [];
  ['mcq', 'short', 'long'].forEach((type) => {
    if (!ai[type] || !ai[type].length) return;
    sections.push({ key: String.fromCharCode(65 + sections.length), type, title: titles[type], marks: marks[type], questions: ai[type] });
  });
  if (!sections.length) return fail('Our AI could not write the paper just now. Please try again in a minute.');
  const token = F.savePaper(header, sections);
  console.log(`[Free paper] ${form.language} · ${form.subject} · ${form.mcq}/${form.short}/${form.long}`);
  res.redirect(`/free-question-paper-generator/p/${token}`);
});

router.get('/free-question-paper-generator/p/:token', (req, res) => {
  const paper = F.getPaper(req.params.token);
  if (!paper) return res.status(404).send('<p>This free paper has expired (free papers are kept for 30 days). <a href="/free-question-paper-generator">Make a new one</a>.</p>');
  const answerKey = req.query.key === '1';
  res.render('paper_print', {
    paper,
    header: paper.header,
    view: P.setView(paper, 0),
    showSet: false,
    answerKey,
    free: { token: req.params.token, answerKey }
  });
});

// ---- SEO pages: /question-paper-generator and /question-paper-generator/:slug

router.get('/question-paper-generator/:slug', (req, res, next) => {
  const page = SEO.PAGES[req.params.slug];
  if (!page) return next();
  const who = page.kind === 'class' ? `Class ${page.cls} ${page.subject}` : `${page.language} medium`;
  const faqs = [
    { q: `Is this ${who} question paper generator free?`, a: `Yes. No login and no card. You can make ${F.PER_VISITOR_PER_DAY} papers a day with up to ${F.LIMITS.mcq} MCQs, ${F.LIMITS.short} short and ${F.LIMITS.long} long answer questions each.` },
    page.kind === 'class'
      ? { q: `Does the Class ${page.cls} ${page.subject} paper come with an answer key?`, a: `Yes. Next to the ${page.subject} paper you get a separate answer key: the correct option for every MCQ and, for the short and long answers, the points a full-marks Class ${page.cls} answer should contain.` }
      : { q: `Does the ${page.language} paper come with an answer key?`, a: `Yes. The answer key is written in ${page.language} too: the correct option for every MCQ and the key points for each written answer.` },
    page.kind === 'class'
      ? { q: `Which syllabus does it follow for Class ${page.cls} ${page.subject}?`, a: `You type the chapters, so it works for CBSE (NCERT), ICSE and state board syllabi alike. The questions are written in the style of board exam papers for Class ${page.cls}.` }
      : { q: `Will the questions really be in ${page.language}?`, a: `Yes. Choose ${page.language} and every question, option and answer is written in ${page.language} script. Formulas, numbers and standard terms are kept the way ${page.language}-medium textbooks write them.` },
    page.kind === 'class'
      ? { q: `Can my Class ${page.cls} students take the ${page.subject} test online?`, a: `Yes, in ClassCoach. Students open the test on any phone, MCQs are marked the moment they submit, and you see which ${page.subject} chapters each student is weak in. It is free for 1 month.` }
      : { q: `Can students take the ${page.language} test online?`, a: `Yes, in ClassCoach. Students open the test on any phone without an app, answers are marked instantly, and parents can get the result on WhatsApp.` }
  ];
  res.render('seo_paper', {
    page,
    guides: guidesFor(page.kind === 'language' ? 'paper-language' : 'paper-class'),
    related: SEO.related(page),
    faqs,
    indexable: true,
    canonicalUrl: `${SITE_ORIGIN}/question-paper-generator/${page.slug}`,
    description: page.description,
    languages: F.LANGUAGES,
    limits: F.LIMITS,
    perDay: F.PER_VISITOR_PER_DAY,
    formToken: F.issueToken(),
    form: { ...page.prefill }
  });
});

// ---- Comparison pages: /vs/:slug (lib/compare_pages.js)
const VS = require('../lib/compare_pages');
router.get('/vs/:slug', (req, res, next) => {
  const page = VS.PAGES[req.params.slug];
  if (!page) return next();
  res.render('vs_page', {
    page,
    others: Object.values(VS.PAGES).filter((p) => p.slug !== page.slug),
    checked: page.checked || VS.CHECKED,
    indexable: true,
    canonicalUrl: `${SITE_ORIGIN}/vs/${page.slug}`,
    description: page.description
  });
});

// ---- Privacy Policy and Terms (lib/legal_pages.js) ----
const LEGAL = require('../lib/legal_pages');
for (const page of Object.values(LEGAL.PAGES)) {
  router.get(`/${page.slug}`, (req, res) => {
    res.render('legal', { page, updated: LEGAL.UPDATED, indexable: true, canonicalUrl: `${SITE_ORIGIN}/${page.slug}`, description: page.description });
  });
}

// ---- OMR sheet generator ----------------------------------------------

router.get('/free-omr-sheet-generator', (req, res) => {
  res.render('free_omr', {
    indexable: true,
    guides: guidesFor('free-omr-sheet-generator'),
    canonicalUrl: `${SITE_ORIGIN}/free-omr-sheet-generator`,
    title: 'Free OMR Sheet Generator — Printable A4 OMR Answer Sheet PDF | ClassCoach',
    description:
      'Make a free printable OMR answer sheet for your school or coaching class: your institute name, exam name, roll number bubbles and 10 to 125 MCQs (A–D). No login. Print or save as PDF.',
    max: T.MAX_QUESTIONS
  });
});

router.get('/free-omr-sheet-generator/sheet', async (req, res) => {
  const count = int(req.query.count, 10, T.MAX_QUESTIONS, 50);
  const header = { school: str(req.query.school, 60), exam: str(req.query.exam, 60) || 'Examination', className: str(req.query.className, 20), subject: str(req.query.subject, 40) };
  const svg = await QRCode.toString(`${SITE_ORIGIN}/free-omr-sheet-generator?utm_source=omr_sheet`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  const qrSize = parseInt((/viewBox="0 0 (\d+)/.exec(svg) || [])[1], 10) || 25;
  const qrSvg = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  res.render('omr_sheet', { paper: { id: 0, title: header.exam }, header, letter: 'A', count, T, qrSvg, qrSize, free: true });
});

module.exports = router;
module.exports.TOOLS = TOOLS;
module.exports.seoSlugs = () => [...Object.keys(SEO.PAGES).map((s) => `question-paper-generator/${s}`), ...Object.keys(VS.PAGES).map((s) => `vs/${s}`)];
