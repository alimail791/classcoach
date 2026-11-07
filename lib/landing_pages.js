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
        a: 'In your own database on your own server — it is not sent anywhere else, and you can download a full backup at any time.'
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
    title: 'Question Paper Generator with Answer Key & 4 Sets (A/B/C/D) — ClassCoach',
    description:
      'Make print-ready question papers in minutes: your school header, MCQ, short and long answer sections with marks, a difficulty mix, answer key with marking points, and up to 4 shuffled sets to stop copying.',
    eyebrow: 'For schools, tutors & coaching centres',
    h1: 'Question paper generator for teachers',
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
  }
};

module.exports = { LANDING_PAGES };
