// Public, indexable landing pages — each aimed at one thing tutors search for,
// so ClassCoach can rank for more than its own name. Every claim here is a
// real feature (see views/home.ejs, lib/plans.js and data/neet_bank.json);
// keep it that way when editing. Rendered by views/landing.ejs, listed in
// /sitemap.xml and linked from the homepage footer.

const LANDING_PAGES = {
  'neet-test-generator': {
    nav: 'NEET test generator',
    title: 'NEET Test Generator for Coaching Classes & Tutors — ClassCoach',
    description:
      'Build NEET chapter tests in minutes from a ready bank of 3,600+ NEET Physics, Chemistry and Biology questions, including 2,100+ previous-year questions. Auto-graded, with chapter-wise weak-area reports for every student.',
    eyebrow: 'For NEET coaches',
    h1: 'NEET test generator for coaching classes',
    intro:
      'Pick the chapters, choose a difficulty, and ClassCoach builds a NEET test for your batch from a ready question bank — no typing questions, no marking. Every answer is graded the moment a student submits, and you see exactly which chapter each student is weak in.',
    stats: [
      { value: '3,600+', label: 'NEET questions ready to use' },
      { value: '98', label: 'chapters across Physics, Chemistry & Biology' },
      { value: '2,100+', label: 'previous-year NEET questions' }
    ],
    sections: [
      {
        h2: 'A ready NEET question bank, tagged chapter by chapter',
        p: 'The bank covers NEET Physics, Chemistry and Biology, with every question tagged by chapter and difficulty (easy, medium, hard). Tick the chapters you have finished in class, filter to previous-year questions only if you want PYQ practice, and the test is ready for your batch to take on their own phones.'
      },
      {
        h2: 'Auto-grading and weak-chapter reports',
        p: 'Objective answers grade instantly — there is no marking pile after a test. Results roll up into a per-student, per-chapter picture, so you can see that a student is strong in Kinematics but losing marks in Gravitation, and plan your next class around it.'
      },
      {
        h2: 'Your own questions too',
        p: 'Paste a syllabus or upload a PDF and ClassCoach drafts chapter-tagged questions with AI for you to review — useful for your own notes, school-board revision, or JEE topics. Any test can also be downloaded as a printable PDF question paper with a separate answer key.'
      }
    ],
    steps: [
      { h: 'Choose chapters', p: 'Tick the NEET chapters to cover and set the difficulty, or limit it to previous-year questions.' },
      { h: 'Publish to your batch', p: 'Students take the test on their own phone, with their own login.' },
      { h: 'See the weak chapters', p: 'Scores grade instantly. You and parents see the chapter-wise picture.' }
    ],
    pricingNote:
      'NEET & JEE coaching plans start at ₹599 a month for up to 20 students, or ₹5,999 a year — about ₹25 per student a month. Every plan starts with a free 1-month trial.',
    faqs: [
      {
        q: 'Which subjects does the NEET question bank cover?',
        a: 'Physics, Chemistry and Biology for NEET — 98 chapters in total, each question tagged by chapter and difficulty, with over 2,100 previous-year NEET questions.'
      },
      {
        q: 'Can I add my own questions as well?',
        a: 'Yes. Generate questions with AI from a syllabus or PDF, review and edit them, and use them alongside the ready bank.'
      },
      {
        q: 'Can students take the test offline?',
        a: 'Download any test as a printable PDF question paper and run it on paper; you keep the answer key for yourself.'
      },
      {
        q: 'How much does it cost?',
        a: 'NEET & JEE plans are ₹599/month for up to 20 students, ₹1,199/month for up to 50 and ₹1,999/month for up to 100, with cheaper yearly options. The first month is a free trial — no card needed.'
      }
    ],
    signup: '/signup?track=neet_jee'
  },

  'online-test-maker': {
    nav: 'Online test maker',
    title: 'Online Test Maker with Auto-Grading for Tutors & Coaching Classes — ClassCoach',
    description:
      'Create online tests from your syllabus with AI, let students take them on their phones, and get objective answers graded instantly. Chapter-wise results, printable question papers and parent reports. Free for 1 month.',
    eyebrow: 'For tutors & small coaching classes',
    h1: 'Online test maker with automatic grading',
    intro:
      'Turn your syllabus into a ready-to-use test, send it to your class, and let ClassCoach grade the objective answers the moment each student submits. Built for individual teachers and small coaching classes — not a big-school system you need training to use.',
    stats: [
      { value: 'Minutes', label: 'from syllabus to a ready test' },
      { value: 'Instant', label: 'grading for MCQ & fill-in-the-blank' },
      { value: '₹0', label: 'for your first month' }
    ],
    sections: [
      {
        h2: 'AI question generation from your syllabus',
        p: 'Paste a chapter outline or upload a PDF, and ClassCoach drafts chapter-tagged questions in minutes. You review and edit anything that needs a fix before publishing — the test is always yours.'
      },
      {
        h2: 'Students test on their own phones',
        p: 'Each student gets their own login. Add your whole class at once by importing a .csv or .xlsx list, or add students one at a time. When there is no reliable internet, download the test as a printable PDF question paper instead.'
      },
      {
        h2: 'Grading that does itself',
        p: 'MCQ and fill-in-the-blank answers are marked automatically on submit. Descriptive answers go to a simple marking screen where you award marks, and the final score updates as soon as you are done.'
      }
    ],
    steps: [
      { h: 'Upload your syllabus', p: 'Paste a chapter outline or upload a PDF — ClassCoach drafts questions by chapter.' },
      { h: 'Review and publish', p: 'Edit anything that needs a fix, then publish the test for your class.' },
      { h: 'Get results and reports', p: 'Objective answers grade instantly; you see weak chapters and parents get an update.' }
    ],
    pricingNote:
      'Plans are per teacher, billed every 3 months: Starter ₹499 for up to 20 students, Growth ₹999 for up to 50, and Pro ₹1,999 for up to 100. Start with a free 1-month trial for up to 10 students.',
    faqs: [
      {
        q: 'Does it work for descriptive or long-answer questions?',
        a: 'Yes. Objective answers are graded automatically; descriptive answers are graded by you on a simple marking screen, and the score updates once you are done.'
      },
      {
        q: 'Can I print the test?',
        a: 'Any test downloads as a PDF question paper, with a separate answer key for you.'
      },
      {
        q: 'Can I add my whole class at once?',
        a: 'Yes — import a class list from a .csv or .xlsx spreadsheet. Each student and each parent gets their own separate login.'
      },
      {
        q: 'Where is my data stored?',
        a: 'In your own database on your own server — it is not sent anywhere else, and you can download a full backup at any time.'
      }
    ],
    signup: '/signup'
  },

  'student-progress-report': {
    nav: 'Parent progress reports',
    title: 'Chapter-wise Student Progress Reports for Parents — ClassCoach',
    description:
      'Share each student’s test results with parents the moment they are graded — by link, email or a parent login — with a chapter-wise breakdown of strengths and weak areas. For tutors and coaching classes.',
    eyebrow: 'For tutors who report to parents',
    h1: 'Chapter-wise progress reports parents actually understand',
    intro:
      'Parents want to know more than a mark out of 50. ClassCoach turns every graded test into a chapter-wise picture of what each student has mastered and where they are slipping — and shares it with parents the moment it is ready.',
    stats: [
      { value: '3 ways', label: 'to share: link, email or parent login' },
      { value: 'Per chapter', label: 'strengths and weak areas, not just a score' },
      { value: 'Instant', label: 'reports as soon as a test is graded' }
    ],
    sections: [
      {
        h2: 'More than a score',
        p: 'Every result rolls up into a per-student, per-chapter view. A parent can see that their child scores well in Kinematics but needs work on Gravitation — and you have the same picture to plan revision.'
      },
      {
        h2: 'Share it however suits the family',
        p: 'Send a shareable link over WhatsApp or any app you like, email it directly, or give parents their own separate login where every report you share appears automatically.'
      },
      {
        h2: 'No extra work for you',
        p: 'Reports come straight from the tests your students already take in ClassCoach. Objective answers grade themselves, so the report is ready the moment a student submits.'
      }
    ],
    steps: [
      { h: 'Run a test', p: 'Create a test from your syllabus or question bank and publish it to your class.' },
      { h: 'Results grade themselves', p: 'Objective answers are marked on submit and roll up by chapter.' },
      { h: 'Parents get the update', p: 'Share by link, email or their own parent login.' }
    ],
    pricingNote:
      'Parent reports are included in every plan. Plans start at ₹499 for 3 months for up to 20 students, after a free 1-month trial.',
    faqs: [
      {
        q: 'How do parents receive the report?',
        a: 'Three ways: a shareable link you send however you like, a direct email, or their own separate parent login where every shared report appears automatically.'
      },
      {
        q: 'Do parents need to install an app?',
        a: 'No. Reports open in any phone browser from the link, email or parent login.'
      },
      {
        q: 'What does the report show?',
        a: 'The student’s score plus a chapter-wise breakdown of strengths and weak areas, built from the tests they take in ClassCoach.'
      }
    ],
    signup: '/signup'
  }
};

module.exports = { LANDING_PAGES };
