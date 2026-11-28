// Head-to-head comparison pages (/vs/:slug), built with the
// vs-and-alternatives workflow (Illyism/seo-skills). Rules kept here:
// every competitor fact is sourced and dated (see seo/competitors/*.md),
// the verdict names when the competitor is the better pick, and nothing
// is claimed about a competitor that its own pages don't say.
// Re-check the sources before editing a competitor fact.

const CHECKED = '21 Nov 2026';

const PAGES = {
  'google-forms': {
    slug: 'google-forms',
    competitor: 'Google Forms',
    title: 'ClassCoach vs Google Forms for Teachers in India',
    description:
      'ClassCoach vs Google Forms for class tests: AI-made questions, weak-chapter tracking and WhatsApp parent reports vs a free quiz form. A sourced comparison.',
    h1: 'ClassCoach vs Google Forms: a free quiz form, or a test assistant that reports to parents',
    verdict: [
      'Pick Google Forms if you want a free quiz tool that plugs into Google Classroom and you are happy to type every question and answer key yourself.',
      'Pick ClassCoach if you want tests drafted by AI from your chapter, PDF or textbook photo, each student’s weak chapters across all tests, and results sent to parents on WhatsApp.'
    ],
    rows: [
      { topic: 'Price', them: 'Free with a Google account.', us: 'Free for 1 month, then from ₹499 for 2 months (up to 20 students).', src: null },
      {
        topic: 'Making the questions',
        them: 'You type each question, mark the correct choices and assign points to build the answer key.',
        us: 'AI drafts MCQ, short and long answer questions from a chapter, PDF or textbook photo; you review and edit.',
        src: 'https://support.google.com/docs/answer/7032287'
      },
      {
        topic: 'Automatic grading',
        them: 'Short answer, multiple choice, checkboxes, dropdown and grid questions with an answer key.',
        us: 'MCQs marked the moment a student submits; AI suggests marks for written answers, you confirm.',
        src: 'https://support.google.com/docs/answer/7032287'
      },
      {
        topic: 'Sending results',
        them: 'Grades release immediately or after manual review. Emailing scores needs "Collect email addresses", which is off by default.',
        us: 'One tap sends each parent the score and the chapters to practise on WhatsApp; parents also get their own login.',
        src: 'https://support.google.com/docs/answer/7032287'
      },
      {
        topic: 'Tracking a student over time',
        them: 'Results are shown per quiz (Responses: Summary, Question, Individual).',
        us: 'Chapter-wise weakness for every student and class across all tests.',
        src: 'https://support.google.com/a/users/answer/13344425'
      },
    ],
    alsoUs: [
      'Printable question papers in up to 4 shuffled sets (A–D) with answer keys',
      'OMR answer sheets graded from a phone photo',
      'Live Quiz game for up to 300 players on any paid plan (30 on the free trial)',
      'Questions in English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali and Gujarati'
    ],
    themWins: [
      { text: 'It is completely free, and most teachers already have a Google account.', src: null },
      { text: 'Forms quizzes plug into Google Classroom, including importing grades into Classroom.', src: 'https://support.google.com/edu/classroom/answer/9095575' },
      { text: 'Locked mode can stop students opening other pages during a quiz on school-managed Chromebooks.', src: 'https://support.google.com/edu/classroom/answer/9095575' },
      { text: 'It also does surveys, registrations and feedback forms, not just tests.', src: null }
    ],
    switchSteps: [
      'Sign up for ClassCoach (free for 1 month, no card).',
      'Create a class and add students one by one, or import your list from a .csv or .xlsx file (for example, a Google Sheet you download as .xlsx).',
      'Make the test: upload the same chapter PDF or a textbook photo and let the AI draft questions, or type your existing questions in. There is no direct import from Google Forms, so plan about 10–15 minutes for your first test.',
      'Share the test link on WhatsApp. Students open it on any phone, with no app.'
    ],
    faq: [
      { q: 'Is Google Forms enough for class tests?', a: 'For short online MCQ quizzes, yes, and it is free. Teachers usually move when they want questions drafted for them, printed papers, weak-chapter tracking across tests, or results sent to parents.' },
      { q: 'Does ClassCoach work with Google Classroom?', a: 'No. ClassCoach has its own student and parent logins and shares tests and reports by link and WhatsApp. If your school runs everything in Google Classroom, Google Forms fits that workflow better.' },
      { q: 'Can I move my Google Forms quizzes to ClassCoach?', a: 'Not automatically. Most teachers re-create the test from the same chapter PDF or textbook photo with AI, then edit, which takes a few minutes per test.' }
    ],
    cta: { label: 'Make your first AI test free', href: '/signup?src=vs-google-forms' }
  },

  kahoot: {
    slug: 'kahoot',
    competitor: 'Kahoot!',
    title: 'ClassCoach vs Kahoot for Teachers in India',
    description:
      'ClassCoach vs Kahoot for Indian classrooms: live quiz games plus graded tests, printed papers, weak chapters and WhatsApp parent reports, priced in rupees.',
    h1: 'ClassCoach vs Kahoot: a quiz game, or quiz games plus tests, papers and parent reports',
    verdict: [
      'Pick Kahoot! if you mainly want live quiz games, with a large library of ready-made kahoots and games for hundreds of players.',
      'Pick ClassCoach if you want live quizzes plus graded tests, printed question papers, each student’s weak chapters and WhatsApp reports for parents, paid in rupees.'
    ],
    rows: [
      {
        topic: 'Price',
        them: 'Paid Kahoot!+ plans are priced in US dollars, per teacher, billed monthly or yearly.',
        us: 'Priced in rupees: free for 1 month, then from ₹499 for 2 months or ₹2,499 a year. UPI accepted.',
        src: 'https://kahoot.com/schools/plans/'
      },
      {
        topic: 'Players per live game',
        them: 'Grows with the plan: 50 on Bronze, 100 on Silver, 200 on Gold, 800 on Kahoot! One.',
        us: 'Up to 300 on any paid plan (30 on the free trial).',
        src: 'https://kahoot.com/schools/plans/'
      },
      {
        topic: 'AI question creation',
        them: 'Included on paid plans (from a topic, URL, Wikipedia or a file); the free plan converts only the first 3 pages of a file.',
        us: 'AI drafts MCQ, short and long answer questions from a chapter, PDF or textbook photo, in 9 Indian languages.',
        src: 'https://kahoot.com/schools/plans/'
      },
    ],
    alsoUs: [
      'Timed online tests, auto-graded, with AI-suggested marks for written answers',
      'Chapter-wise weakness for each student across all tests and quizzes',
      'Score and chapters to practise sent to each parent on WhatsApp in one tap, plus parent logins',
      'Printable question papers in up to 4 shuffled sets with answer keys, and OMR sheets graded from a phone photo'
    ],
    themWins: [
      { text: 'A large library of free, ready-made kahoots, so you can run a game without writing one.', src: 'https://kahoot.com/teachers/plans' },
      { text: 'Bigger live events: up to 800 players per game on Kahoot! One.', src: 'https://kahoot.com/schools/plans/' },
      { text: 'Paid plans can import existing slides from Google Slides, PowerPoint and Keynote.', src: 'https://kahoot.com/register/pricing-schools' },
      { text: 'Students across the world already know the format, so there is nothing to explain.', src: null }
    ],
    switchSteps: [
      'Sign up for ClassCoach (free for 1 month, no card).',
      'Create a test from your chapter PDF or textbook photo with AI, or type your quiz questions in. There is no direct import from Kahoot!, so allow about 10 minutes for the first one.',
      'Open Live Quiz, pick the test, and put the game PIN or QR code on your classroom screen. Students join at classcoach.in/play on their phones.',
      'When the game ends, send each parent their child’s result on WhatsApp.'
    ],
    faq: [
      { q: 'Is ClassCoach Live Quiz like Kahoot?', a: 'It works the same way in class: questions on your screen, students answer on their phones against the clock, points for speed and a live leaderboard. The difference is what happens after: weak chapters per student and WhatsApp reports for parents.' },
      { q: 'Can I keep using Kahoot for games and ClassCoach for tests?', a: 'Yes. Many teachers use a game tool for fun revision and ClassCoach for graded tests, printed papers and parent reports.' },
      { q: 'Do students need an app?', a: 'No. ClassCoach runs in any phone browser; students join a live quiz at classcoach.in/play with a PIN or QR code.' }
    ],
    cta: { label: 'Try Live Quiz free', href: '/signup?src=vs-kahoot' }
  },

  // Checked 28 Nov 2026 (see seo/competitors/wayground.md)
  wayground: {
    slug: 'wayground',
    checked: '28 Nov 2026',
    competitor: 'Wayground (Quizizz)',
    title: 'ClassCoach vs Wayground (Quizizz) for Teachers in India',
    description:
      'ClassCoach vs Wayground (formerly Quizizz) for Indian tutors: live quizzes plus printed papers, OMR, weak chapters and WhatsApp parent reports, priced in rupees.',
    h1: 'ClassCoach vs Wayground (Quizizz): a global quiz platform, or a test assistant built for Indian tutors',
    verdict: [
      'Pick Wayground if you want a free quiz and lesson platform with a big ready-made library, Google Classroom sync and up to 100 players free.',
      'Pick ClassCoach if you want tests drafted from your own chapter or textbook photo, printed papers and OMR sheets, each student’s weak chapters, and results sent to parents on WhatsApp, paid in rupees.'
    ],
    rows: [
      {
        topic: 'Price',
        them: 'Basic is free. The Individual (Super) plan is listed at $18 a month, billed annually ($216 a year), in US dollars.',
        us: 'Priced in rupees: free for 1 month, then from ₹499 for 2 months or ₹2,499 a year. UPI accepted.',
        src: 'https://wayground.com/super-pricing'
      },
      {
        topic: 'Players per live session',
        them: 'Up to 100 on the free Starter (Basic) plan, up to 1,000 on Individual (Super) and School plans.',
        us: 'Up to 300 on any paid plan (30 on the free trial).',
        src: 'https://support.wayground.com/hc/en-us/articles/38633441370521-Understanding-Wayground-Plans'
      },
      {
        topic: 'AI question creation',
        them: 'Free plan includes AI generation from links, PDFs, worksheets and prompts.',
        us: 'AI drafts MCQ, short and long answer questions from a chapter, PDF or textbook photo, in 9 Indian languages.',
        src: 'https://help.wayground.com/support/solutions/articles/158000404043-free-for-schools-is-evolving-what-s-next'
      },
      {
        topic: 'Reporting to parents',
        them: 'Not covered on the plan pages checked; reports are for teachers and schools.',
        us: 'One tap sends each parent the score and the chapters to practise on WhatsApp; parents also get their own login.',
        src: null
      }
    ],
    alsoUs: [
      'Printable question papers in up to 4 shuffled sets (A–D) with answer keys',
      'OMR answer sheets graded from a phone photo',
      'Chapter-wise weakness for each student across all tests and quizzes',
      'AI-suggested marks for written answers, which you confirm'
    ],
    themWins: [
      { text: 'The Basic plan is free for every teacher, with AI included.', src: 'https://wayground.com/home/plans' },
      { text: 'A large ready-made library of quizzes and lessons.', src: 'https://wayground.com/super-pricing' },
      { text: 'School plans sync grades with Google Classroom, Canvas and Schoology.', src: 'https://wayground.com/super-pricing' },
      { text: 'Bigger live sessions: up to 1,000 participants on paid plans.', src: 'https://support.wayground.com/hc/en-us/articles/38633441370521-Understanding-Wayground-Plans' }
    ],
    switchSteps: [
      'Sign up for ClassCoach (free for 1 month, no card).',
      'Create a class and add students, or import your list from a .csv or .xlsx file.',
      'Make a test from your chapter PDF or textbook photo with AI, or type your questions in. There is no direct import from Wayground, so allow about 10 minutes for the first one.',
      'Run it as a Live Quiz in class or share the test link on WhatsApp, then send each parent the result.'
    ],
    faq: [
      { q: 'Is Wayground the same as Quizizz?', a: 'Yes. Quizizz renamed itself Wayground. Teachers still search for it as Quizizz.' },
      { q: 'Wayground is free, so why pay for ClassCoach?', a: 'For quick quiz games, Wayground’s free plan is enough. Tutors move when they want printed papers and OMR, weak chapters per student across tests, and WhatsApp reports that keep parents paying fees.' },
      { q: 'Do students need an app?', a: 'No. ClassCoach runs in any phone browser; students join a live quiz at classcoach.in/play with a PIN or QR code.' }
    ],
    cta: { label: 'Make your first AI test free', href: '/signup?src=vs-wayground' }
  },

  // Checked 28 Nov 2026 (see seo/competitors/classplus.md)
  classplus: {
    slug: 'classplus',
    checked: '28 Nov 2026',
    competitor: 'Classplus',
    title: 'ClassCoach vs Classplus for Tutors in India',
    description:
      'ClassCoach vs Classplus: your own branded coaching app for selling courses, or a low-cost AI test assistant with weak chapters and WhatsApp parent reports.',
    h1: 'ClassCoach vs Classplus: your own coaching app, or an AI assistant for your tests and parents',
    verdict: [
      'Pick Classplus if you want to sell courses online under your own brand, with your own app, website, live classes and recorded lectures.',
      'Pick ClassCoach if you teach offline or in batches and want AI-made tests, printed papers and OMR, each student’s weak chapters and WhatsApp reports to parents, for a few hundred rupees.'
    ],
    rows: [
      {
        topic: 'Price',
        them: 'Yearly plans for your own branded app and website. Classplus’s own pages list different amounts, and say the final price is confirmed on a demo.',
        us: 'Free for 1 month, then from ₹499 for 2 months or ₹2,499 a year. Sign up yourself, no demo call.',
        src: 'https://classplusapp.com/growth/classplus-vs-kajabi/'
      },
      {
        topic: 'What it is for',
        them: 'Your own branded app and website to sell courses, run live classes and upload recorded lectures.',
        us: 'Making, grading and reporting tests for the students you already teach.',
        src: 'https://classplusapp.com/new-web'
      },
      {
        topic: 'Tests',
        them: 'Online tests and test series with performance tracking.',
        us: 'AI drafts tests from your chapter or textbook photo; online tests, printed papers in 4 sets and OMR graded from a phone photo.',
        src: 'https://classplusapp.com/growth/classplus-vs-kajabi/'
      },
      {
        topic: 'Parents',
        them: 'Communication with students and parents through app notifications.',
        us: 'Score and chapters to practise sent to each parent on WhatsApp in one tap, plus parent logins.',
        src: null
      }
    ],
    alsoUs: [
      'Chapter-wise weakness for every student and class across all tests',
      'AI-suggested marks for written answers, which you confirm',
      'Live Quiz game for up to 300 players on any paid plan',
      'Questions in English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali and Gujarati'
    ],
    themWins: [
      { text: 'You get an app and website under your own institute name.', src: 'https://classplusapp.com/new-web' },
      { text: 'Live classes, recorded courses and a store to sell study material.', src: 'https://classplusapp.com/new-web' },
      { text: 'Online fee payments with UPI, cards, EMI and part payments.', src: 'https://classplusapp.com/growth/best-course-selling-app-for-teachers/' },
      { text: 'Better if your main goal is selling courses to students outside your city.', src: null }
    ],
    switchSteps: [
      'Sign up for ClassCoach (free for 1 month, no card, no demo call).',
      'Create a class and import your batch from a .csv or .xlsx file.',
      'Make your next test with AI from the chapter you are teaching, and print it or share the link on WhatsApp.',
      'After the test, send every parent their child’s score and weak chapters.'
    ],
    faq: [
      { q: 'Can I use Classplus and ClassCoach together?', a: 'Yes. Classplus is for selling and delivering courses; ClassCoach is for making tests and reporting to parents. Many tutors only need the second.' },
      { q: 'Does ClassCoach give me my own app?', a: 'No. Students and parents use ClassCoach in any phone browser, with no setup on your side.' },
      { q: 'Does ClassCoach do live classes?', a: 'No. If you teach live online, keep your current video tool and use ClassCoach for tests and reports.' }
    ],
    cta: { label: 'Try ClassCoach free for 1 month', href: '/signup?src=vs-classplus' }
  },

  // Checked 28 Nov 2026 (see seo/competitors/teachmint.md)
  teachmint: {
    slug: 'teachmint',
    checked: '28 Nov 2026',
    competitor: 'Teachmint',
    title: 'ClassCoach vs Teachmint for Tutors in India',
    description:
      'ClassCoach vs Teachmint: a school platform with a 20 lakh question bank, or an AI test assistant for tutors with weak chapters and WhatsApp parent reports.',
    h1: 'ClassCoach vs Teachmint: a whole-school platform, or a test assistant for tutors',
    verdict: [
      'Pick Teachmint if you run a school and want one platform for live classes, attendance, fees, report cards and a big ready-made question bank.',
      'Pick ClassCoach if you are a tutor or coaching teacher who wants tests made from your own chapter, printed papers and OMR, each student’s weak chapters and WhatsApp reports to parents.'
    ],
    rows: [
      {
        topic: 'Built for',
        them: 'Schools: learning management, fee management, student information and report cards.',
        us: 'Individual tutors and coaching teachers; institute packs for coaching centres.',
        src: 'https://www.teachmint.com/en-ph/features'
      },
      {
        topic: 'Making the questions',
        them: 'Pick from a question bank of more than 20 lakh questions, or upload your own.',
        us: 'AI drafts MCQ, short and long answer questions from your chapter, PDF or textbook photo, in 9 Indian languages.',
        src: 'https://www.teachmint.com/en-sa/online-assessment'
      },
      {
        topic: 'Grading',
        them: 'Auto-graded tests with results shared when the exam ends.',
        us: 'MCQs marked on submit, AI-suggested marks for written answers, and OMR sheets graded from a phone photo.',
        src: 'https://www.teachmint.com/features/tests'
      },
      {
        topic: 'Price',
        them: 'Not listed on the pages checked; school plans are quoted on request.',
        us: 'Free for 1 month, then from ₹499 for 2 months or ₹2,499 a year.',
        src: null
      }
    ],
    alsoUs: [
      'Score and chapters to practise sent to each parent on WhatsApp in one tap',
      'Chapter-wise weakness for every student across all tests',
      'Printable question papers in up to 4 shuffled sets with answer keys',
      'Live Quiz game for up to 300 players on any paid plan'
    ],
    themWins: [
      { text: 'A ready-made question bank of more than 20 lakh questions across boards and competitive exams.', src: 'https://www.teachmint.com/features/tests' },
      { text: 'Live classes with recordings, attendance and classroom chat.', src: 'https://www.teachmint.com/en-us/learning-management-system' },
      { text: 'Whole-school tools: fees, student records, exam planner and report cards.', src: 'https://www.teachmint.com/en-sa/online-assessment' }
    ],
    switchSteps: [
      'Sign up for ClassCoach (free for 1 month, no card).',
      'Create a class and import your students from a .csv or .xlsx file.',
      'Make a test with AI from the chapter you just taught, then print it or share the link on WhatsApp.',
      'Send each parent the result and the chapters to practise.'
    ],
    faq: [
      { q: 'Is Teachmint only for schools?', a: 'Teachmint’s current pages focus on schools, with fee management, report cards and classroom devices. ClassCoach is built for tutors and coaching teachers.' },
      { q: 'Does ClassCoach have a question bank?', a: 'Yes, your own: every question you or the AI make is saved and reusable, and you can share banks with other teachers. ClassCoach also drafts new questions from your chapter instead of a fixed bank.' },
      { q: 'Does ClassCoach do live classes?', a: 'No. Keep your video tool for live teaching and use ClassCoach for tests, papers and parent reports.' }
    ],
    cta: { label: 'Make your first AI test free', href: '/signup?src=vs-teachmint' }
  }
};

module.exports = { PAGES, CHECKED };
