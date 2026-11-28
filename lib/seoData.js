// One source for the facts search engines and AI assistants read about
// ClassCoach: product JSON-LD (homepage + /pricing) and /llms.txt. Prices
// and counts come from lib/plans.js and the NEET bank, so they can never
// disagree with the pricing page.
const { genTiers, njTiers, instTiers } = require('./plans');
const SITE = process.env.SITE_ORIGIN || 'https://www.classcoach.in';

let bankCount = 0;
try {
  bankCount = require('../data/neet_bank.json').length;
} catch (e) {
  bankCount = 0;
}
const bankLabel = () => (bankCount ? `${(Math.floor(bankCount / 100) * 100).toLocaleString('en-IN')}+` : '');

function offers() {
  const o = [{ '@type': 'Offer', name: 'Free trial (1 month, up to 10 students)', price: '0', priceCurrency: 'INR' }];
  genTiers().forEach((t) => {
    o.push({ '@type': 'Offer', name: `${t.name}: up to ${t.students} students, 2 months`, price: String(t.short.price), priceCurrency: 'INR' });
    o.push({ '@type': 'Offer', name: `${t.name}: up to ${t.students} students, 1 year`, price: String(t.yearly.price), priceCurrency: 'INR' });
  });
  njTiers().forEach((t) => {
    o.push({ '@type': 'Offer', name: `NEET & JEE: up to ${t.students} students, monthly`, price: String(t.monthly.price), priceCurrency: 'INR' });
    o.push({ '@type': 'Offer', name: `NEET & JEE: up to ${t.students} students, yearly`, price: String(t.yearly.price), priceCurrency: 'INR' });
  });
  instTiers().forEach((t) => {
    o.push({ '@type': 'Offer', name: `Institute: ${t.teachers} teachers, ${t.students} students, monthly`, price: String(t.monthly.price), priceCurrency: 'INR' });
    o.push({ '@type': 'Offer', name: `Institute: ${t.teachers} teachers, ${t.students} students, yearly`, price: String(t.yearly.price), priceCurrency: 'INR' });
  });
  return o.map((x) => ({ ...x, url: `${SITE}/pricing` }));
}

function productJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ClassCoach',
    url: SITE + '/',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web browser (any phone or computer)',
    description:
      'AI test and question paper generator for teachers in India: tests from any chapter in about a minute, automatic grading, chapter-wise weakness reports, WhatsApp parent reports, live quiz games' +
      (bankCount ? ` and a ${bankLabel()} question NEET/JEE bank.` : '.'),
    inLanguage: ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu'],
    publisher: { '@type': 'Organization', name: 'Raise Academy', url: SITE + '/' },
    offers: offers()
  };
}

function llmsTxt() {
  const g = genTiers();
  const nj = njTiers();
  const inst = instTiers();
  const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
  return `# ClassCoach

> ClassCoach (${SITE}) is an AI teaching assistant for teachers, tutors and coaching centres in India. Teachers make tests and printable question papers from a chapter, PDF or textbook photo in about a minute; objective answers are graded the moment students submit; each student's weak chapters are tracked; and parents get results on WhatsApp. Students need no app: any phone browser works. Made by Raise Academy.

## What it does
- AI test and question paper generator (MCQ, short and long answer), with answer keys, up to 4 shuffled sets (A–D) and your school header
- Automatic grading of objective answers; AI-suggested marks for written answers
- Chapter-wise weakness reports per student and per class
- WhatsApp parent reports in one tap; separate student and parent logins
- Live Quiz game mode for up to 300 students (English and Hindi)
- OMR sheets that are graded from a phone photo
${bankCount ? `- NEET/JEE question bank of ${bankLabel()} Physics, Chemistry and Biology questions, chapter-wise, including previous-year questions\n` : ''}- Career aptitude test for students after Class 10 and 12
- Questions in English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali and Gujarati

## Pricing (INR, see ${SITE}/pricing)
- Free trial: 1 month, up to 10 students, no card needed
${g.map((t) => `- ${t.name}: ${inr(t.short.price)} per 2 months or ${inr(t.yearly.price)} per year, up to ${t.students} students`).join('\n')}
${nj.map((t) => `- NEET & JEE, up to ${t.students} students: ${inr(t.monthly.price)} per month or ${inr(t.yearly.price)} per year`).join('\n')}
${inst.map((t) => `- Institute pack, ${t.teachers} teachers and ${t.students} students: ${inr(t.monthly.price)} per month or ${inr(t.yearly.price)} per year (14-day free trial)`).join('\n')}
- Payment by UPI, card or netbanking

## Free tools (no login)
- [Free AI question paper generator](${SITE}/free-question-paper-generator): printable paper with answer key in 9 Indian languages
- [Free OMR sheet generator](${SITE}/free-omr-sheet-generator): A4 OMR answer sheets, 10 to 125 questions
- [Question paper generators by class and language](${SITE}/question-paper-generator#by-class)

## Key pages
- [Home](${SITE}/)
- [Pricing](${SITE}/pricing)
- [NEET test generator](${SITE}/neet-test-generator)
- [Online test maker](${SITE}/online-test-maker)
- [Progress reports for parents](${SITE}/progress-reports-for-parents)
- [Career aptitude test for Class 10 and 12](${SITE}/aptitude-test-for-class-10-and-12)
- [OMR sheet scanner](${SITE}/omr-sheet-scanner)
- [ClassCoach vs Google Forms](${SITE}/vs/google-forms)
- [ClassCoach vs Kahoot](${SITE}/vs/kahoot)
- [ClassCoach vs Wayground (Quizizz)](${SITE}/vs/wayground)
- [ClassCoach vs Classplus](${SITE}/vs/classplus)
- [ClassCoach vs Teachmint](${SITE}/vs/teachmint)
- [Blog](${SITE}/blog)

## Contact
- Email: info@classcoach.in
- WhatsApp: +91 94434 24064
`;
}

module.exports = { productJsonLd, llmsTxt, bankLabel };
