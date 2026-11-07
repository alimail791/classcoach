// Sample data for the public demo pages /sample-career-report and
// /sample-class-summary, so principals and parents can see what they get
// before signing up. Built through the real scoring code, so the sample
// always matches what the test actually produces. Nothing here is stored.
const { buildResult } = require('./scoring');
const { aptitudeList, interestList, traitList } = require('./items');

function answersFrom({ wrong = [], interests, traits }) {
  const a = {};
  const miss = new Set(wrong);
  aptitudeList().forEach((it) => (a[it.id] = miss.has(it.id) ? (it.a + 1) % 4 : it.a));
  interestList().forEach((it) => (a[it.id] = interests[it.type][+it.id.split('_')[2]]));
  traitList().forEach((it) => (a[it.id] = traits[it.trait][+it.id.split('_')[2]]));
  return a;
}

const SAMPLE_STUDENT = {
  attempt: {
    student_name: 'Ananya R',
    section: '10 B',
    roll_no: '14',
    aspiration: 'Doctor',
    language: 'English',
    status: 'done',
    ai_status: 'ready',
    submitted_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
  },
  answers: answersFrom({
    wrong: ['a_numerical_6', 'a_numerical_9', 'a_spatial_1', 'a_spatial_5', 'a_spatial_9', 'a_logical_7', 'a_verbal_9', 'a_numerical_8'],
    interests: { R: [2, 3, 2, 2, 3, 2], I: [5, 4, 5, 4, 5, 3], A: [3, 2, 3, 2, 3, 3], S: [5, 4, 4, 5, 4, 4], E: [2, 3, 2, 3, 2, 2], C: [3, 3, 4, 3, 4, 3] },
    traits: { discipline: [4, 4, 2, 4], curiosity: [5, 4, 2, 5], sociability: [3, 3, 3, 2], empathy: [5, 5, 2, 4], composure: [3, 4, 3, 3] }
  }),
  // What a Standard report's AI write-up looks like for this student.
  ai: {
    summary:
      'Ananya is a curious, caring student who enjoys understanding how things work — especially the human body — and genuinely likes helping people. Her verbal and logical reasoning are strong, and she is disciplined about her work. This combination points clearly towards Science with Biology, which also matches her own goal of becoming a doctor.',
    strengths: ['Excellent verbal and logical reasoning (9 out of 10 in each)', 'Strong interest in science and in helping people', 'Curious and disciplined — she finishes what she starts'],
    toDevelop: ['Numerical speed — regular practice with word problems will help in Physics and Chemistry', 'Staying calm under exam pressure; short timed practice tests build confidence'],
    recommendations: [
      {
        name: 'Science with Biology (PCB)',
        why: 'Her highest interests are investigative and social, the exact mix that suits medicine and health sciences. Her reasoning scores show she can handle the concepts of Class 11 and 12 Biology and Chemistry.',
        nextSteps: ['Choose PCB in Class 11 and start NEET-UG preparation alongside the board syllabus', 'Build a strong NCERT Biology base in Class 11 — most NEET questions come from it', 'Practise numericals weekly to keep Physics from pulling her NEET score down']
      },
      {
        name: 'Science with Maths (PCM)',
        why: 'Her logical reasoning is a real strength, so PCM is a good second option if her interest moves towards engineering, computer science or pure science.',
        nextSteps: ['If unsure between PCB and PCM, consider PCMB in Class 11 to keep both doors open', 'Try a few JEE-style problems in Class 10 holidays to see if she enjoys them']
      },
      {
        name: 'Humanities / Arts',
        why: 'Her strong verbal reasoning and wish to help people also fit psychology, law or teaching — fields reached through Humanities.',
        nextSteps: ['Keep this in mind as a backup; psychology can also be studied after PCB']
      }
    ],
    aboutGoal: 'Becoming a doctor fits Ananya well — her interests and reasoning both support it. The path is PCB in Class 11, then NEET-UG; starting steady preparation early matters more than long hours later.',
    parentNote:
      'Ananya’s results show a clear fit for Science with Biology and a sincere interest in medicine. She works best with steady routines and may feel exam stress, so encourage regular practice rather than last-minute pressure. Talk with her about her goal and keep PCMB in mind if she is still deciding between medicine and engineering.',
    studyTips: ['Study in focused 40-minute blocks with short breaks', 'Explain each Biology chapter aloud to someone — teaching it fixes it in memory', 'Take one timed practice test each week to get used to exam pressure']
  }
};

function sampleStudent() {
  const s = SAMPLE_STUDENT;
  const result = buildResult('10', { aspiration: s.attempt.aspiration }, s.answers);
  return { attempt: s.attempt, result, ai: s.ai };
}

// A synthetic Class 10 section of 36 students for the principal summary.
const FIRST = ['Aarav', 'Diya', 'Rahul', 'Sneha', 'Karthik', 'Priya', 'Arjun', 'Meera', 'Vikram', 'Fathima', 'Rohan', 'Ishaan', 'Kavya', 'Mohammed', 'Nandini', 'Siddharth', 'Lakshmi', 'Aditya', 'Pooja', 'Harish', 'Aisha', 'Varun', 'Divya', 'Joseph', 'Keerthana', 'Nikhil', 'Sana', 'Gokul', 'Anjali', 'Tarun', 'Riya', 'Surya', 'Ayesha', 'Pranav', 'Shruti', 'Dev'];
const LAST = ['K', 'S', 'R', 'M', 'P', 'V', 'N', 'A', 'J', 'T'];

function sampleClass() {
  let seed = 42;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (n) => Math.floor(rand() * n);
  const profiles = [
    { I: 5, S: 4, R: 2, A: 2, E: 2, C: 3, aptBias: ['verbal', 'logical'], goal: 'Doctor' },
    { I: 5, S: 2, R: 4, A: 2, E: 2, C: 3, aptBias: ['numerical', 'logical', 'spatial'], goal: 'Engineer' },
    { I: 2, S: 3, R: 2, A: 2, E: 5, C: 5, aptBias: ['numerical'], goal: 'CA' },
    { I: 2, S: 5, R: 1, A: 4, E: 4, C: 2, aptBias: ['verbal'], goal: 'Lawyer' },
    { I: 2, S: 2, R: 5, A: 3, E: 2, C: 3, aptBias: ['spatial'], goal: '' },
    { I: 3, S: 3, R: 3, A: 3, E: 3, C: 3, aptBias: [], goal: 'Not sure' }
  ];
  const rows = FIRST.map((name, i) => {
    const p = profiles[i % 7 === 6 ? 5 : pick(5)];
    const wrong = aptitudeList()
      .filter((it) => rand() < (p.aptBias.includes(it.area) ? 0.12 : 0.38))
      .map((it) => it.id);
    const jitter = (v) => Math.max(1, Math.min(5, v + (rand() < 0.3 ? (rand() < 0.5 ? -1 : 1) : 0)));
    const interests = {};
    Object.keys({ R: 1, I: 1, A: 1, S: 1, E: 1, C: 1 }).forEach((k) => (interests[k] = [0, 1, 2, 3, 4, 5].map(() => jitter(p[k]))));
    const traits = {};
    ['discipline', 'curiosity', 'sociability', 'empathy', 'composure'].forEach((k) => (traits[k] = [0, 1, 2, 3].map(() => jitter(3 + pick(2)))));
    // Swap a goal now and then so the counselling list isn't empty.
    const goal = i % 9 === 4 ? 'Doctor' : p.goal;
    const result = buildResult('10', { aspiration: goal }, answersFrom({ wrong, interests, traits }));
    return {
      student_name: `${name} ${LAST[i % LAST.length]}`,
      section: '10 A',
      roll_no: String(i + 1),
      aspiration: goal,
      status: 'done',
      needs_counselling: result.needsCounselling ? 1 : 0,
      top_key: result.top[0] ? result.top[0].key : null,
      result
    };
  });
  return rows;
}

module.exports = { sampleStudent, sampleClass };
