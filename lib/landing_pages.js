// Public, indexable landing pages — each aimed at one thing tutors search for,
// so ClassCoach can rank for more than its own name. Every claim here is a
// real feature (see views/home.ejs, lib/plans.js and data/neet_bank.json);
// keep it that way when editing. Rendered by views/landing.ejs, listed in
// /sitemap.xml and linked from the homepage footer.
//
// Slugs must not start with any robots.txt Disallow prefix in server.js
// (/student, /parent, /tests, /reports, ...) — robots rules are prefix
// matches, so e.g. "/student-progress-report" was blocked from Google.

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
      'Plans are per teacher, every 2 months: Starter ₹499 for up to 20 students, Growth ₹999 for up to 50, and Pro ₹1,999 for up to 100. Yearly plans save more: ₹2,499, ₹4,999 and ₹9,999. Every plan includes monthly AI credits (100, 250 or 600; more on yearly). Start with a free 1-month trial for up to 10 students.',
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
        a: 'On ClassCoach\u2019s own secure servers. It is used only to run ClassCoach for you, and you can download a full backup at any time.'
      }
    ],
    signup: '/signup'
  },

  'progress-reports-for-parents': {
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
      'Parent reports are included in every plan. Plans start at ₹499 for 2 months, or ₹2,499 a year, for up to 20 students, after a free 1-month trial.',
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
  },
  // ---- School & exam tools (Nov 2026). Optional fields used below:
  // demo: true shows a "Book a free demo" WhatsApp button (SALES_WHATSAPP /
  // CAREER_COUNSEL_WHATSAPP); sample: { label, href } a second button;
  // primary / ctaH2 / ctaP override the default trial wording.
  'aptitude-test-for-class-10-and-12': {
    nav: 'Career aptitude test',
    title: 'Career Aptitude Test for Class 10 & 12 Students — Stream & Career Reports | ClassCoach',
    description:
      'Online career aptitude and psychometric test for schools. After Class 10 it recommends a stream (PCB, PCM, Commerce, Humanities); after Class 12 it recommends courses, careers and entrance exams. Personal reports in English or 8 Indian languages, plus a class summary for the principal.',
    eyebrow: 'For schools, coaching centres & counsellors',
    h1: 'Career aptitude test for Class 10 and Class 12 students',
    intro:
      'A 40-minute online test that looks at aptitude, interests and work style, then gives every student a clear report: which stream to take after Class 10, or which courses, careers and entrance exams fit after Class 12. Parents get a note they can understand, and the principal gets a one-page class summary.',
    stats: [
      { value: '96', label: 'questions: aptitude, interests and work style' },
      { value: '9', label: 'report languages — English, Hindi, Tamil, Telugu and more' },
      { value: '₹199', label: 'per student for schools testing 300+ students' }
    ],
    sections: [
      {
        h2: 'After Class 10: which stream fits?',
        p: 'The report ranks Science with Biology (PCB), Science with Maths (PCM), Commerce, Humanities and Diploma / vocational paths for each student, explains why, and lists the courses and entrance exams each stream leads to — NEET, JEE, CA Foundation, CLAT, NIFT and more.'
      },
      {
        h2: 'After Class 12: which course and career?',
        p: 'Students choose their current stream, and the report recommends from 14 career fields — medicine, engineering, computer science, law, design, commerce, management, civil services and others — only where their subjects allow. Strong fits that would need different subjects are shown honestly, not hidden.'
      },
      {
        h2: 'Built for a whole school, not one student at a time',
        p: 'Share one link, code or QR code and students take the test on phones or in the computer lab — no logins to create. You see results as they come in, flag students who need counselling (close calls, stress, goals that don’t match the results), and print a principal summary with the stream split for the class.'
      },
      {
        h2: 'Reports parents actually read',
        p: 'Standard and Premium reports add a personal write-up in English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali or Gujarati, with strengths, areas to build, next steps and a note for parents. Send each report to the parent on WhatsApp in one tap.'
      }
    ],
    steps: [
      { h: 'Create the assessment', p: 'Choose the Class 10 or Class 12 version, the report type and the default language.' },
      { h: 'Students take it', p: 'They open the link or scan the QR code — about 40 minutes, on any phone or lab computer.' },
      { h: 'Share the reports', p: 'Each student gets a printable report; you get the class summary and a counselling list.' }
    ],
    pricingNote:
      'Per student: Basic ₹299, Standard ₹599 (₹249 for 100+ students, ₹199 for 300+), Premium ₹999 including a 1:1 counselling session. Every new account gets 10 free Standard reports to pilot with one section.',
    pricingHref: '/signup?next=/career',
    faqs: [
      { q: 'Is this a psychometric test?', a: 'Yes — it combines an aptitude test (verbal, numerical, logical and spatial reasoning) with an interest inventory based on the RIASEC model and a short work-style questionnaire. It is guidance to start a conversation with students and parents, not a final verdict.' },
      { q: 'Do students need to install anything or create logins?', a: 'No. They open a link, enter a code at classcoach.in/c, or scan a QR code, type their name and start. Progress is saved on the device if the page is closed by mistake.' },
      { q: 'Can we try it before buying for the whole school?', a: 'Yes. Every new account gets 10 free Standard reports, enough to pilot with one section. Book a free demo on WhatsApp and we will set it up with you.' },
      { q: 'Which languages are the reports in?', a: 'Basic reports are in English. Standard and Premium reports can be written in English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali or Gujarati — students choose when they start.' },
      { q: 'How do schools pay?', a: 'Online by UPI, card or netbanking, or by bank transfer for larger orders — message us and we add the seats to your account.' }
    ],
    signup: '/signup?next=/career',
    demo: true,
    sample: { label: 'See a sample report', href: '/sample-career-report' },
    primary: 'Get 10 free reports',
    ctaH2: 'Pilot it with one section — free.',
    ctaP: 'Sign up, create an assessment and share the link. Your first 10 Standard reports are on us.'
  },

  'question-paper-generator': {
    nav: 'Question paper generator',
    title: 'AI Question Paper Generator with Answer Key & 4 Sets (A/B/C/D) — ClassCoach',
    description:
      'Make print-ready question papers in minutes: your school header, MCQ, short and long answer sections with marks, a difficulty mix, answer key with marking points, and up to 4 shuffled sets to stop copying.',
    eyebrow: 'For schools, tutors & coaching centres',
    h1: 'AI question paper generator for teachers',
    answer: {
      q: 'How does an AI question paper generator work?',
      a: 'You set the pattern — sections, number of questions, marks and difficulty — and pick the chapters. ClassCoach fills the paper from your own question bank first (free), and AI writes only the questions that are missing, following your class, subject and difficulty mix. You review every question, then print the paper with an answer key and up to 4 shuffled sets.'
    },
    shots: [
      { src: 'papers', title: 'Set the pattern', caption: 'School header, exam name, time, instructions, and the sections with questions and marks.', alt: 'ClassCoach question paper generator form with paper header and sections' },
      { src: 'test-edit', title: 'Review every question', caption: 'Chapter-tagged questions you can edit or remove before printing.', alt: 'ClassCoach question list tagged by chapter' }
    ],
    related: [
      { href: '/omr-sheet-scanner', label: 'OMR sheet scanner' },
      { href: '/best-ai-tools-for-teachers', label: 'Best AI tools for teachers' },
      { href: '/ai-lesson-plan-generator', label: 'AI lesson plan generator' },
      { href: '/ai-answer-sheet-evaluation', label: 'AI answer sheet evaluation' },
      { href: '/free-question-paper-generator', label: 'Free question paper generator (no login)' }
    ],
    intro:
      'Set the sections and marks, pick the chapters, and ClassCoach builds a print-ready paper with your school or institute header and a matching answer key. Print up to 4 shuffled sets — A, B, C and D — so students sitting together get different papers.',
    stats: [
      { value: '4', label: 'shuffled sets per paper, each with its own key' },
      { value: '3', label: 'section types: MCQ, short answer, long answer' },
      { value: '₹0', label: 'for papers built from your question bank' }
    ],
    sections: [
      { h2: 'Your questions first, AI only for the gaps', p: 'Papers are filled from the questions in your own ClassCoach tests (and the 3,600+ question NEET bank on NEET/JEE plans). If the chapters you pick don’t have enough, AI writes only the missing questions — MCQs, short and long answers — following your class, subject and difficulty mix.' },
      { h2: 'A real exam paper, ready to print', p: 'School name, exam name, class, subject, time and maximum marks at the top, general instructions, numbered sections with marks shown for every question. It prints cleanly on A4, including chemistry and physics symbols, and works for papers in Indian languages.' },
      { h2: 'Answer key and marking scheme', p: 'Every set gets its own answer key: the correct option for each MCQ and the key points a full-marks answer needs for short and long questions — ready for whoever is correcting.' },
      { h2: 'Scan the MCQs with your phone', p: 'Print an OMR sheet for each set and check the MCQ section by photographing the sheets — no manual counting. Or turn the paper into an online test for your batch in one click.' }
    ],
    steps: [
      { h: 'Set the pattern', p: 'Header, sections, marks per question, difficulty mix and the number of sets.' },
      { h: 'Pick chapters', p: 'Tick chapters from your question bank, or type topics for AI.' },
      { h: 'Review and print', p: 'Remove any question you don’t want, then print each set and its answer key.' }
    ],
    pricingNote:
      'Included in every ClassCoach plan — school & general plans start at ₹499 for 2 months. Papers built from your question bank are free; AI-written questions use 2 credits plus 1 per 10 questions.',
    faqs: [
      { q: 'Can I make different sets of the same paper?', a: 'Yes, up to 4 (A, B, C, D). Sets B to D shuffle the order of MCQs and their options, and each set has its own answer key and OMR sheet.' },
      { q: 'Where do the questions come from?', a: 'From the tests you have created in ClassCoach (and the NEET bank on NEET/JEE plans). AI fills in only what is missing, and every AI question is marked so you can check it.' },
      { q: 'Can I download it as a PDF?', a: 'Yes — open the paper and choose Print, then Save as PDF. The layout is set up for A4.' },
      { q: 'Does it work for state board and CBSE patterns?', a: 'You set the sections, number of questions and marks, so you can match CBSE, state board or your own pattern.' }
    ],
    signup: '/signup?next=/papers',
    demo: true
  },

  'omr-sheet-scanner': {
    nav: 'OMR sheet scanner',
    title: 'OMR Sheet Scanner App — Check OMR Sheets with Your Phone Camera | ClassCoach',
    description:
      'Print OMR answer sheets for your test, then check them by photographing them with your phone. Reads answers, roll numbers and the paper set, flags blank and double-marked answers, supports negative marking and exports results.',
    eyebrow: 'For coaching centres & schools',
    h1: 'OMR sheet scanner — check answer sheets with your phone',
    intro:
      'No OMR machine needed. Print ClassCoach OMR sheets for your test, let students fill them with a pen, then photograph the sheets on your phone and upload them together. Every sheet is read and marked against the right answer key in about a second.',
    stats: [
      { value: '125', label: 'questions per OMR sheet, options A–D' },
      { value: '~1 sec', label: 'to read and mark each sheet' },
      { value: '₹0.10', label: 'about, per sheet (1 credit for 10 sheets)' }
    ],
    sections: [
      { h2: 'Just take a photo', p: 'Four black corner squares let ClassCoach straighten a tilted or rotated photo, and a QR code on each sheet tells it which paper and which set (A–D) it is. Shadows, a slight angle or a sheet photographed upside down are handled.' },
      { h2: 'Roll numbers matched to students', p: 'Students fill a 6-digit roll number. Pick the batch and each sheet is matched to the right student, with unclear or repeated roll numbers flagged for you to fix.' },
      { h2: 'Mistakes are flagged, not guessed', p: 'Blank answers and questions with two circles filled are detected and shown, so you can check them. You can correct any sheet by hand before saving.' },
      { h2: 'NEET-style negative marking and reports', p: 'Set the marks taken off for a wrong answer and every sheet is re-marked. Download a CSV, or save the marks to your class so they appear in student reports and parent reports.' }
    ],
    steps: [
      { h: 'Print the sheets', p: 'One OMR sheet per set of your question paper, on plain A4 — photocopies work.' },
      { h: 'Photograph them', p: 'Snap each filled sheet flat with all four corners in view, and upload them together.' },
      { h: 'Get the marks', p: 'Scores, right / wrong / blank counts and a CSV, ready in a minute.' }
    ],
    pricingNote:
      'Included in every ClassCoach plan, including the institute pack for coaching centres. Scanning uses 1 AI credit per 10 sheets; top-ups start at 100 credits for ₹99.',
    faqs: [
      { q: 'Do I need a special scanner or OMR paper?', a: 'No. Print the sheets on any printer on plain A4 paper and use your phone camera. Print at 100% (actual size).' },
      { q: 'How many questions does one sheet hold?', a: 'Up to 125 multiple choice questions with options A to D, plus a 6-digit roll number.' },
      { q: 'Can it handle different sets of the same paper?', a: 'Yes. The QR code on each sheet says which set it is, and every set is marked against its own answer key.' },
      { q: 'What if a student fills two circles?', a: 'The question is flagged as double-marked and counted as wrong if you use negative marking. You can correct any sheet by hand.' }
    ],
    signup: '/signup?next=/papers',
    demo: true
  },
  'best-ai-tools-for-teachers': {
    nav: 'AI tools for teachers',
    title: 'Best AI Tools for Teachers in India (2026) — Tests, Grading, Lesson Plans | ClassCoach',
    description:
      'The AI tools that save Indian teachers the most time: a question generator, auto-grading, AI mark suggestions for long answers, OMR scanning, lesson plans, notes and parent reports. What each does, and how ClassCoach puts them in one app.',
    eyebrow: 'For school teachers, tutors & coaching centres',
    h1: 'The best AI tools for teachers — in one app',
    intro:
      'Most of a teacher’s extra hours go to four jobs: writing questions, checking answers, planning lessons and updating parents. ClassCoach uses AI for exactly those jobs, and keeps you in control: the AI drafts, you review, nothing goes to students or parents until you say so.',
    answer: {
      q: 'What are the best AI tools for teachers?',
      a: 'The most useful AI tools for teachers are the ones that take over repeated work. Look for these five, and check that you can review everything the AI writes before students see it:',
      points: [
        'An AI question generator that writes MCQs from your syllabus, a PDF or a photo of the textbook page.',
        'Auto-grading for objective tests, and AI mark suggestions for long answers that you can accept or change.',
        'An OMR scanner that checks paper answer sheets from a phone photo.',
        'An AI lesson plan generator for a timed, ready-to-teach class period.',
        'Automatic chapter-wise reports you can send to parents on WhatsApp.'
      ]
    },
    stats: [
      { value: '7', label: 'AI and automation tools in one login' },
      { value: '3,600+', label: 'ready NEET questions on NEET & JEE plans' },
      { value: '1 month', label: 'free trial, no card needed' }
    ],
    shots: [
      { src: 'test-edit', title: 'AI question generation', caption: 'The test editor: chapter-tagged questions — AI-drafted from your syllabus or PDF, or your own — that you edit before publishing.', alt: 'ClassCoach test editor with AI-generated Gravitation questions tagged by chapter' },
      { src: 'grade', title: 'AI mark suggestions', caption: 'For a typed long answer, AI suggests a mark and a reason. You adjust and save.', alt: 'ClassCoach grading screen with an AI suggested mark of 4 out of 5 and its reason' },
      { src: 'lesson-plan', h: 1100, title: 'AI lesson plans', caption: 'Objectives, a timed lesson flow, board work, questions, an exit check and homework.', alt: 'ClassCoach lesson plan for Gravitation with objectives and a 40-minute lesson flow' },
      { src: 'reports', title: 'Parent reports', caption: 'Chapter-wise reports with your note, sent by WhatsApp, email or a link.', alt: 'ClassCoach parent report preview showing score and chapter breakdown' }
    ],
    sections: [
      { h2: 'AI question generator', p: 'Paste a syllabus or chapter, upload a PDF, or photograph the textbook page (ClassCoach reads it with OCR). AI drafts chapter-tagged MCQs; you edit or remove any of them before the test goes out. On NEET and JEE plans there is also a ready bank of 3,600+ NEET questions.' },
      { h2: 'Auto-grading and AI mark suggestions', p: 'Objective answers are marked the moment a student submits. For typed long answers, AI suggests a mark out of the maximum with a one-line reason — you accept, change or ignore it. The AI never saves a mark by itself.' },
      { h2: 'Question papers and OMR scanning', p: 'Build a print-ready paper with your school header, sections, marks, an answer key and up to 4 shuffled sets. Print OMR sheets and check the MCQ section by photographing the sheets with your phone.' },
      { h2: 'Lesson plans, notes and slides', p: 'Generate a lesson plan for one period from just the topic, class and period length, or turn a chapter into class notes or a slide outline. Download any of them as a PDF.' },
      { h2: 'Weak chapters and parent reports', p: 'Every result rolls up into a per-student, per-chapter view, so you know which chapter is holding a student back. Send parents a clean report with your note in one tap.' }
    ],
    steps: [
      { h: 'Create a class', p: 'Add your batch and students, or import them from Excel.' },
      { h: 'Let AI draft', p: 'Questions, papers, lesson plans or notes — from your syllabus, PDF or photo.' },
      { h: 'Review and send', p: 'Edit anything, then publish to students or share reports with parents.' }
    ],
    pricingNote:
      'Free for 1 month. After that, plans for individual teachers start at ₹499 for 2 months; NEET & JEE coaching plans and institute packs are also available. AI actions use credits from your plan’s monthly allowance.',
    faqs: [
      { q: 'Is ClassCoach free for teachers?', a: 'Every account starts with a free 1-month trial with no card. After that, plans for individual teachers start at ₹499 for 2 months.' },
      { q: 'Does the AI decide marks or publish tests on its own?', a: 'No. AI only drafts questions, lesson plans and mark suggestions. You review and edit them; nothing reaches students or parents until you publish or send it.' },
      { q: 'Which subjects and boards does it work for?', a: 'Any subject you teach, including CBSE, state board and coaching for NEET and JEE, because the AI works from your own syllabus, PDF or textbook page. The ready question bank is for NEET Physics, Chemistry and Biology.' },
      { q: 'Can students use it on their phones?', a: 'Yes. Students take tests and read shared notes on their own phones with their own login; parents get reports by WhatsApp, email or a link.' },
      { q: 'Can it check handwritten answer sheets?', a: 'It checks paper MCQ answers through OMR sheets photographed on a phone. Handwritten long answers are not read yet — for those, students type their answers online and AI suggests the marks.' }
    ],
    related: [
      { href: '/ai-lesson-plan-generator', label: 'AI lesson plan generator' },
      { href: '/question-paper-generator', label: 'AI question paper generator' },
      { href: '/ai-answer-sheet-evaluation', label: 'AI answer sheet evaluation' },
      { href: '/omr-sheet-scanner', label: 'OMR sheet scanner' },
      { href: '/online-test-maker', label: 'Online test maker' },
      { href: '/free-tools', label: 'Free teacher tools' }
    ],
    signup: '/signup',
    demo: true
  },

  'ai-answer-sheet-evaluation': {
    nav: 'AI answer sheet evaluation',
    title: 'AI Answer Sheet Evaluation for Teachers — Auto-Grading, AI Marks & OMR | ClassCoach',
    description:
      'Check answer sheets faster with AI: objective answers graded instantly, AI-suggested marks with reasons for long answers, and OMR answer sheets checked from a phone photo. You review every mark before it is saved.',
    eyebrow: 'For teachers who are tired of correcting',
    h1: 'AI answer sheet evaluation — you stay the examiner',
    intro:
      'ClassCoach takes the counting and first-pass marking off your desk. MCQs are graded the moment students submit, OMR sheets are checked from a phone photo, and for long answers AI suggests a mark with a reason that you can accept or change.',
    answer: {
      q: 'How does AI answer sheet evaluation work in ClassCoach?',
      a: 'There are three parts, depending on how your students answer:',
      points: [
        'Online MCQs: graded automatically the second a student submits.',
        'Paper MCQs: students fill a printed OMR sheet; you photograph the sheets and every one is marked in about a second.',
        'Long answers typed online: AI reads the question and the answer and suggests a mark out of the maximum with a short reason. You decide the final mark.'
      ]
    },
    stats: [
      { value: 'Instant', label: 'grading for MCQ answers' },
      { value: '~1 sec', label: 'to read and mark each OMR sheet' },
      { value: '1 credit', label: 'per AI mark suggestion for a long answer' }
    ],
    shots: [
      { src: 'grade', title: 'AI suggests, you decide', caption: 'A typed long answer with the AI’s suggested mark (4/5) and the reason — review and adjust before saving.', alt: 'ClassCoach grading screen with AI suggested marks for a descriptive answer' },
      { src: 'results', h: 560, title: 'Results in one place', caption: 'Scores for the whole batch, the chapter-wise class average and who still needs grading.', alt: 'ClassCoach test results with student scores and chapter average' },
      { src: 'reports', title: 'Straight to parents', caption: 'Graded results turn into a chapter-wise parent report with your note.', alt: 'ClassCoach parent report preview' }
    ],
    sections: [
      { h2: 'Objective answers: zero correction time', p: 'Online MCQ tests are marked automatically against your answer key, with negative marking if you use it. Scores and the chapter-wise picture are ready the moment the last student submits.' },
      { h2: 'Paper tests: OMR from your phone', p: 'Print OMR sheets for your paper (up to 125 questions, sets A–D). Photograph the filled sheets and upload them together; ClassCoach reads the roll number and set, marks every sheet and flags blank or double-filled answers.' },
      { h2: 'Long answers: AI mark suggestions', p: 'For descriptive questions answered online, tap “Suggest grade with AI”. It suggests a mark — whole or half — and one or two sentences on what the answer got right or missed. Nothing is saved until you press Save.' },
      { h2: 'Fair and transparent', p: 'Every AI suggestion shows its reason, so you can see why. You can override any mark, and the student and parent only see the final marks you saved.' }
    ],
    steps: [
      { h: 'Give the test', p: 'Online on students’ phones, or on paper with OMR sheets.' },
      { h: 'Let ClassCoach mark', p: 'MCQs and OMR sheets are graded; long answers get AI-suggested marks.' },
      { h: 'Review and share', p: 'Confirm the marks, then send reports to parents.' }
    ],
    pricingNote:
      'Free for 1 month. Plans for individual teachers start at ₹499 for 2 months. AI mark suggestions use 1 credit per answer; OMR scanning uses 1 credit per 10 sheets.',
    faqs: [
      { q: 'Can ClassCoach read handwritten answer sheets?', a: 'Not yet. Handwritten MCQ answers are checked through OMR sheets photographed on a phone. For long answers, students type their answers online and AI suggests marks for you to review.' },
      { q: 'Does AI give the final marks?', a: 'No. The AI only suggests a mark and a reason. The teacher reviews, edits and saves the final mark.' },
      { q: 'Is negative marking supported?', a: 'Yes, for online MCQ tests and OMR sheets — set the marks taken off for a wrong answer and every sheet is re-marked.' },
      { q: 'How accurate are the AI mark suggestions?', a: 'They are a good first pass for most answers, but they are suggestions: the reason shown with each one makes it quick to check, and you should always review before saving.' }
    ],
    related: [
      { href: '/omr-sheet-scanner', label: 'OMR sheet scanner' },
      { href: '/online-test-maker', label: 'Online test maker' },
      { href: '/progress-reports-for-parents', label: 'Parent progress reports' },
      { href: '/best-ai-tools-for-teachers', label: 'Best AI tools for teachers' },
      { href: '/free-omr-sheet-generator', label: 'Free OMR sheet generator' }
    ],
    signup: '/signup',
    demo: true
  },

  'ai-lesson-plan-generator': {
    nav: 'AI lesson plan generator',
    title: 'AI Lesson Plan Generator for Teachers — Timed Lesson Plans in a Minute | ClassCoach',
    description:
      'Make a ready-to-teach lesson plan from just the topic, class and period length: learning objectives, a timed lesson flow, board work, questions to ask, an exit check, homework and support for weak and fast learners. Edit and download as PDF.',
    eyebrow: 'For school teachers & tutors',
    h1: 'AI lesson plan generator for teachers',
    intro:
      'Type the topic, the class and how long your period is. ClassCoach writes a lesson plan you can actually teach from — with a minute-by-minute flow — and you edit anything you want before downloading it.',
    answer: {
      q: 'What makes a good AI lesson plan generator?',
      a: 'A good one gives you a plan you can follow in class tomorrow, not a generic essay. ClassCoach’s lesson plans always have the same nine parts:',
      points: [
        'Learning objectives (“Students will be able to…”) and prior knowledge.',
        'Materials, and a timed lesson flow that adds up to your period length: hook, explanation with an example, guided practice and a quick check.',
        'Board work and key points, and questions to ask from easy to hard.',
        'A 3-question exit check with answers, homework, and one line each for students who struggle and fast learners.'
      ]
    },
    stats: [
      { value: '9', label: 'sections in every lesson plan' },
      { value: '20–180', label: 'minute periods supported' },
      { value: '3 credits', label: 'per lesson plan' }
    ],
    shots: [
      { src: 'lesson-new', title: 'Topic, class and period length', caption: 'That is all it needs. Add chapter text, a PDF or a textbook photo if you want it to follow your book.', alt: 'ClassCoach form to create an AI lesson plan with class, subject and period length' },
      { src: 'lesson-plan', h: 1100, title: 'A plan you can teach from', caption: 'Objectives, prior knowledge, materials and a minute-by-minute lesson flow — every section editable.', alt: 'ClassCoach AI lesson plan for Gravitation with objectives, materials and a timed 40-minute flow' }
    ],
    sections: [
      { h2: 'From just a topic — or from your textbook', p: 'Enter the topic, class, subject and period length and the plan is ready in about a minute. If you want it to follow your book exactly, paste the chapter text, upload a PDF or photograph the page.' },
      { h2: 'A minute-by-minute lesson flow', p: 'The flow adds up to your period length, with a hook to start, an explanation with a worked example, guided practice and a quick check — so you know what to do at every point of the class.' },
      { h2: 'Questions, exit check and homework included', p: 'Questions to ask from easy to hard, a 3-question exit check with answers, homework, and suggestions for students who struggle and for fast learners.' },
      { h2: 'Edit, download, reuse', p: 'Remove or add sections, download the plan as a PDF for your file or school records, and keep every plan with the class it belongs to. Lesson plans are only visible to you, never to students.' }
    ],
    steps: [
      { h: 'Enter the topic', p: 'Class, subject, topic and period length — optionally your chapter text.' },
      { h: 'Review the plan', p: 'Edit any section, add your own notes.' },
      { h: 'Teach and reuse', p: 'Download the PDF, then turn the topic into a test or notes in the same app.' }
    ],
    pricingNote:
      'Free for 1 month, then plans for individual teachers start at ₹499 for 2 months. Each lesson plan uses 3 AI credits from your plan’s monthly allowance.',
    faqs: [
      { q: 'Is the AI lesson plan generator free?', a: 'You can use it free during the 1-month trial. After that it is part of every ClassCoach plan, using 3 AI credits per lesson plan.' },
      { q: 'Does it follow CBSE or state board?', a: 'It writes for the class and topic you enter. To match your board’s textbook exactly, paste the chapter text or upload the PDF or a photo of the page, and the plan stays within it.' },
      { q: 'Can I edit the lesson plan?', a: 'Yes. Remove any section, add your own, and download the final plan as a PDF.' },
      { q: 'Can students see my lesson plans?', a: 'No. Lesson plans are only visible to you. Notes and slides are the materials you can share with your class.' },
      { q: 'Which languages does it support?', a: 'Lesson plans are written in English today. You can paste source material in other languages, but the plan itself will be in English.' }
    ],
    related: [
      { href: '/best-ai-tools-for-teachers', label: 'Best AI tools for teachers' },
      { href: '/question-paper-generator', label: 'AI question paper generator' },
      { href: '/online-test-maker', label: 'Online test maker' },
      { href: '/ai-answer-sheet-evaluation', label: 'AI answer sheet evaluation' },
      { href: '/free-tools', label: 'Free teacher tools' }
    ],
    signup: '/signup',
    demo: true
  }
};

module.exports = { LANDING_PAGES };
