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
  }
};

module.exports = { PAGES, CHECKED };
