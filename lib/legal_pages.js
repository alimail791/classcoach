// /privacy and /terms (views/legal.ejs). Plain-language, kept true to what
// ClassCoach actually does — update UPDATED whenever the wording changes.
const UPDATED = '21 November 2026';
const CONTACT = 'info@classcoach.in';

const PRIVACY = {
  slug: 'privacy',
  title: 'Privacy Policy | ClassCoach',
  h1: 'Privacy Policy',
  description: 'How ClassCoach (classcoach.in) collects, uses and protects the data of teachers, institutes, students and parents.',
  intro: `ClassCoach (classcoach.in) is run by Raise Academy, India. This page explains what data we collect, why, and the choices you have. Questions: ${CONTACT}.`,
  sections: [
    ['What we collect', [
      'Teacher and institute accounts: name, email, mobile number, institute name and the settings you choose.',
      'Students and parents added by a teacher or institute: name, class or batch, roll number, and a mobile number or email if the teacher adds one.',
      'Classroom content: tests, questions, study material, answers students submit, marks, OMR sheet photos you scan and the reports made from them.',
      'Payments: handled by Razorpay. We receive the payment status and amount; we never see or store card, UPI or bank details.',
      'Usage data: pages visited and basic device information (through Google Analytics), and a login cookie that keeps you signed in.'
    ]],
    ['How we use it', [
      'To run ClassCoach for you: create and grade tests, scan OMR sheets, build progress reports and share them with the students and parents you choose.',
      'To send account messages such as sign-in codes, receipts, reminders and product updates by email or WhatsApp. You can ask us to stop non-essential messages at any time.',
      'To improve ClassCoach and fix problems.',
      'We do not sell your data or your students\' data, and we do not use it for advertising.'
    ]],
    ['AI features', [
      'When you use AI features (for example, creating questions from your syllabus or a PDF), the text or file you provide is sent to our AI provider (Anthropic or OpenAI) only to produce that result. Under their business terms it is not used to train their models.',
      'AI-made questions and suggestions can contain mistakes; the teacher reviews them before students see them.'
    ]],
    ['Who we share data with', [
      'Service providers who help us run ClassCoach, only as needed: Railway (hosting and database), Razorpay (payments), Resend (email), WhatsApp messaging providers, Google Analytics, and our AI providers.',
      'Reports are shared only with the people a teacher or institute chooses (for example, a parent link or parent login).',
      'Authorities, if Indian law requires it.'
    ]],
    ['Students and children', [
      'Students are added by their teacher, school or coaching institute, which is responsible for having the consent of the student\'s parent or guardian.',
      'Student data is used only to provide ClassCoach to that teacher or institute. We do not market to students.'
    ]],
    ['Keeping and deleting data', [
      'We keep data while the account is active. A teacher can remove students and content at any time.',
      `To delete an account and its data, email ${CONTACT} from the account's email address. We delete it within 30 days, except records we must keep by law (such as payment records).`
    ]],
    ['Security', [
      'Data is sent over HTTPS, passwords are stored hashed, and access to the database is restricted. No system is perfectly secure, so please use a strong password and keep your login private.'
    ]],
    ['Changes', [
      'If we change this policy we will update this page and the date below. For important changes we will also tell account holders by email.'
    ]],
    ['Contact', [
      `Email ${CONTACT} or message us on WhatsApp from the link at the bottom of the page.`
    ]]
  ]
};

const TERMS = {
  slug: 'terms',
  title: 'Terms of Service | ClassCoach',
  h1: 'Terms of Service',
  description: 'The terms for using ClassCoach (classcoach.in), the test, grading and progress-report app for teachers, tutors and coaching institutes.',
  intro: `These terms apply when you use ClassCoach (classcoach.in), run by Raise Academy, India. By creating an account or using ClassCoach you agree to them. Questions: ${CONTACT}.`,
  sections: [
    ['Your account', [
      'Give correct details when you sign up and keep your login private. You are responsible for what happens in your account.',
      'Institute admins are responsible for the teacher logins they create.'
    ]],
    ['Your students\' data', [
      'If you add students or parents, you confirm you are allowed to, including having a parent or guardian\'s consent where needed. Our Privacy Policy explains how we handle that data.'
    ]],
    ['Your content', [
      'Tests, questions and material you create or upload stay yours. You give us permission to store and process them only to run ClassCoach for you.',
      'Do not upload content you do not have the right to use, or anything unlawful, harmful or abusive.'
    ]],
    ['Plans and payments', [
      'Free tools and the free trial need no payment. Paid plans are prepaid for the period and limits shown on the pricing page at the time you buy.',
      'Payments are processed by Razorpay. Prices may change for future purchases; a plan you have already paid for is not affected.',
      `For billing problems or refund requests, email ${CONTACT} with your payment details and we will review it.`
    ]],
    ['AI features', [
      'AI-made questions, answers and suggestions can be wrong. Review them before using them with students; you are responsible for the final test or paper.'
    ]],
    ['Fair use', [
      'Do not try to break, overload, copy or resell ClassCoach, or access other users\' accounts or data.',
      'We may suspend accounts that break these terms.'
    ]],
    ['Availability and liability', [
      'We work to keep ClassCoach running and your data safe, but the service is provided "as is" and may sometimes be unavailable. Keep your own copy of anything important.',
      'To the extent the law allows, our liability for any claim is limited to the amount you paid us in the 3 months before it.'
    ]],
    ['Ending your account', [
      `You can stop using ClassCoach at any time; to delete your account, email ${CONTACT}.`
    ]],
    ['Law', [
      'These terms are governed by the laws of India.'
    ]],
    ['Changes', [
      'We may update these terms; the date below shows the latest version. Continuing to use ClassCoach after a change means you accept it.'
    ]]
  ]
};

module.exports = { PAGES: { privacy: PRIVACY, terms: TERMS }, UPDATED, CONTACT };
