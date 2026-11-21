// Search pages for "class X subject question paper generator" and
// "<language> question paper generator" searches. Each page embeds the free
// generator (routes/freeTools.js) pre-filled for that class / subject /
// language, with a worked sample question, so it is useful on its own and
// not a thin doorway page. Rendered by views/seo_paper.ejs, listed in
// /sitemap.xml and linked from /question-paper-generator.
//
// Sample questions are standard textbook facts; check any edit carefully.

const S = (q, options, correct) => ({ q, options, correct });

const SUBJECTS = {
  maths: { name: 'Maths', long: 'Mathematics' },
  science: { name: 'Science', long: 'Science' },
  'social-science': { name: 'Social Science', long: 'Social Science (History, Geography, Civics, Economics)' },
  english: { name: 'English', long: 'English' },
  physics: { name: 'Physics', long: 'Physics' },
  chemistry: { name: 'Chemistry', long: 'Chemistry' },
  biology: { name: 'Biology', long: 'Biology' }
};

const SAMPLES = {
  '6-maths': S('What is the smallest whole number?', ['1', '0', '−1', '2'], 1),
  '6-science': S('Which of these is a good source of starch?', ['Potato', 'Milk', 'Egg', 'Fish'], 0),
  '6-social-science': S('Which is the largest continent?', ['Africa', 'Asia', 'Europe', 'Australia'], 1),
  '6-english': S('Choose the noun in the sentence: "The cat sat on the mat."', ['sat', 'on', 'cat', 'the'], 2),
  '7-maths': S('What is (−3) × (−4)?', ['−12', '12', '−7', '7'], 1),
  '7-science': S('Which gas do green plants take in for photosynthesis?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2),
  '7-social-science': S('In which layer of the atmosphere do we live?', ['Stratosphere', 'Troposphere', 'Mesosphere', 'Thermosphere'], 1),
  '7-english': S('Pick the past tense of "go".', ['goed', 'gone', 'went', 'going'], 2),
  '8-maths': S('What is the square root of 144?', ['11', '12', '14', '16'], 1),
  '8-science': S('Which of these is a fossil fuel?', ['Wood', 'Coal', 'Sunlight', 'Wind'], 1),
  '8-social-science': S('The Battle of Plassey was fought in', ['1757', '1857', '1764', '1947'], 0),
  '8-english': S('Choose the correct article: "He is ___ honest man."', ['a', 'an', 'the', 'no article'], 1),
  '9-maths': S('Which of these is an irrational number?', ['0.5', '√2', '3/4', '7'], 1),
  '9-science': S('The SI unit of force is the', ['joule', 'watt', 'newton', 'pascal'], 2),
  '9-social-science': S('The French Revolution began in', ['1789', '1776', '1815', '1848'], 0),
  '9-english': S('Identify the adverb: "She sings beautifully."', ['She', 'sings', 'beautifully', 'none'], 2),
  '10-maths': S('The discriminant of x² − 4x + 4 = 0 is', ['0', '4', '8', '−4'], 0),
  '10-science': S('Which mirror is used as a rear-view mirror in vehicles?', ['Concave mirror', 'Convex mirror', 'Plane mirror', 'None of these'], 1),
  '10-social-science': S('Who was the first President of India?', ['Jawaharlal Nehru', 'Dr Rajendra Prasad', 'Sardar Vallabhbhai Patel', 'Dr B. R. Ambedkar'], 1),
  '10-english': S('Choose the correct reported speech: He said, "I am tired."', ['He said that he is tired.', 'He said that he was tired.', 'He said that I was tired.', 'He says he was tired.'], 1),
  '11-maths': S('How many subsets does a set with 3 elements have?', ['3', '6', '8', '9'], 2),
  '11-physics': S('The dimensional formula of velocity is', ['[M⁰LT⁻¹]', '[MLT⁻²]', '[M⁰L²T⁻¹]', '[ML⁰T⁻¹]'], 0),
  '11-chemistry': S('How many moles of water are there in 18 g of water?', ['0.5', '1', '2', '18'], 1),
  '11-biology': S('Which cell organelle is called the "powerhouse of the cell"?', ['Ribosome', 'Golgi body', 'Mitochondrion', 'Lysosome'], 2),
  '11-english': S('Choose the word closest in meaning to "benevolent".', ['Kind', 'Angry', 'Lazy', 'Proud'], 0),
  '12-maths': S('The derivative of sin x with respect to x is', ['−cos x', 'cos x', 'tan x', '−sin x'], 1),
  '12-physics': S('The SI unit of electric charge is the', ['ampere', 'volt', 'coulomb', 'ohm'], 2),
  '12-chemistry': S('Which of these is a colligative property?', ['Osmotic pressure', 'Density', 'Viscosity', 'Colour'], 0),
  '12-biology': S('In humans, fertilisation normally takes place in the', ['Uterus', 'Ovary', 'Fallopian tube', 'Cervix'], 2),
  '12-english': S('Choose the word opposite in meaning to "scarce".', ['Rare', 'Plentiful', 'Small', 'Costly'], 1)
};

const PAGES = {};
Object.keys(SAMPLES).forEach((key) => {
  const [cls, ...rest] = key.split('-');
  const subjKey = rest.join('-');
  const subj = SUBJECTS[subjKey];
  const slug = `class-${cls}-${subjKey}`;
  const label = `Class ${cls} ${subj.name}`;
  PAGES[slug] = {
    slug,
    kind: 'class',
    cls,
    subjKey,
    subject: subj.name,
    label,
    title: `${label} Question Paper Generator — Free, with Answer Key | ClassCoach`,
    h1: `${label} question paper generator`,
    description: `Make a Class ${cls} ${subj.name} question paper in about a minute: MCQs, short and long answer questions with an answer key and marking scheme. Free, no login, in English or 8 Indian languages.`,
    intro: `Type the Class ${cls} ${subj.long} chapters you have taught and get a printable question paper with MCQs, short and long answer questions, and a separate answer key with marking points. Questions follow the style of CBSE and state board papers, so you can use it for unit tests, half-yearly and revision tests.`,
    sample: SAMPLES[key],
    prefill: { className: cls, subject: subj.name, language: 'English' }
  };
});

const LANG_NOTES = {
  Tamil: 'Tamil medium schools and tuition centres, including Samacheer Kalvi (Tamil Nadu State Board) classes',
  Hindi: 'Hindi medium schools and coaching classes, including CBSE and Hindi-belt state boards',
  Telugu: 'Telugu medium schools in Andhra Pradesh and Telangana',
  Kannada: 'Kannada medium schools and tuition classes in Karnataka',
  Malayalam: 'Malayalam medium schools and tuition centres in Kerala',
  Marathi: 'Marathi medium schools and classes in Maharashtra',
  Bengali: 'Bengali medium schools in West Bengal and Tripura',
  Gujarati: 'Gujarati medium schools and tuition classes in Gujarat'
};
Object.keys(LANG_NOTES).forEach((lang) => {
  const slug = lang.toLowerCase();
  PAGES[slug] = {
    slug,
    kind: 'language',
    language: lang,
    label: `${lang} question paper generator`,
    title: `${lang} Question Paper Generator — Free AI Tool for ${lang} Medium | ClassCoach`,
    h1: `${lang} question paper generator`,
    description: `Make ${lang} medium question papers with AI in about a minute: MCQs, short and long answers with an answer key, written in ${lang} script. Free, no login, any class and subject.`,
    intro: `Built for ${LANG_NOTES[lang]}. Choose the class, subject and chapters, and the AI writes every question, option and answer in ${lang}, keeping formulas, numbers and scientific terms the way ${lang}-medium textbooks write them. Print the paper or save it as a PDF, with a separate answer key.`,
    sample: null,
    prefill: { className: '', subject: '', language: lang }
  };
});

function related(page) {
  const all = Object.values(PAGES);
  if (page.kind === 'language') return all.filter((p) => p.kind === 'language' && p.slug !== page.slug);
  const sameClass = all.filter((p) => p.kind === 'class' && p.cls === page.cls && p.slug !== page.slug);
  const sameSubject = all.filter((p) => p.kind === 'class' && p.subjKey === page.subjKey && p.slug !== page.slug);
  return [...sameClass, ...sameSubject].slice(0, 10);
}

module.exports = { PAGES, related };
