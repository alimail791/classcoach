// Free, no-login tools (see lib/freeTools.js): a hub page, an AI question
// paper generator and a blank OMR sheet maker. All public and indexable,
// except the generated paper / sheet pages themselves.
const express = require('express');
const QRCode = require('qrcode');
const F = require('../lib/freeTools');
const P = require('../lib/papers');
const T = require('../lib/omr/template');
const SEO = require('../lib/seo_pages');

const router = express.Router();
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.classcoach.in';
const int = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? dflt : Math.max(min, Math.min(max, n));
};
const str = (v, n) => String(v || '').trim().slice(0, n);

const TOOLS = [
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

router.get('/question-paper-generator', (req, res) => {
  const pages = Object.values(SEO.PAGES);
  const classes = [...new Set(pages.filter((p) => p.kind === 'class').map((p) => p.cls))].map((cls) => ({ cls, pages: pages.filter((p) => p.cls === cls) }));
  res.render('seo_hub', {
    classes,
    languages: pages.filter((p) => p.kind === 'language'),
    indexable: true,
    canonicalUrl: `${SITE_ORIGIN}/question-paper-generator`,
    title: 'Question Paper Generator for Class 6 to 12 — Free, All Subjects | ClassCoach',
    description: 'Free AI question paper generator for Class 6 to 12: Maths, Science, Social Science, English, Physics, Chemistry and Biology, with answer keys, in English and 8 Indian languages.'
  });
});

router.get('/question-paper-generator/:slug', (req, res, next) => {
  const page = SEO.PAGES[req.params.slug];
  if (!page) return next();
  const who = page.kind === 'class' ? `Class ${page.cls} ${page.subject}` : `${page.language} medium`;
  const faqs = [
    { q: `Is this ${who} question paper generator free?`, a: `Yes. No login and no card. You can make ${F.PER_VISITOR_PER_DAY} papers a day with up to ${F.LIMITS.mcq} MCQs, ${F.LIMITS.short} short and ${F.LIMITS.long} long answer questions each.` },
    { q: 'Does it give an answer key?', a: 'Yes. Every paper has a separate answer key with the correct MCQ options and the key points a full-marks written answer should contain.' },
    page.kind === 'class'
      ? { q: `Which syllabus does it follow for Class ${page.cls} ${page.subject}?`, a: `You type the chapters, so it works for CBSE (NCERT), ICSE and state board syllabi alike. The questions are written in the style of board exam papers for Class ${page.cls}.` }
      : { q: `Will the questions really be in ${page.language}?`, a: `Yes. Choose ${page.language} and every question, option and answer is written in ${page.language} script. Formulas, numbers and standard terms are kept the way ${page.language}-medium textbooks write them.` },
    { q: 'Should I check the questions before using them?', a: 'Yes. AI-written questions are a strong first draft, but always read the paper and the answer key before giving it to students.' }
  ];
  res.render('seo_paper', {
    page,
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

// ---- OMR sheet generator ----------------------------------------------

router.get('/free-omr-sheet-generator', (req, res) => {
  res.render('free_omr', {
    indexable: true,
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
module.exports.seoSlugs = () => Object.keys(SEO.PAGES).map((s) => `question-paper-generator/${s}`);
