// Career aptitude test — question bank.
//
// Three parts:
//   1. Aptitude (40 MCQs, 10 each): verbal, numerical, logical, spatial.
//      Correct answers live only here on the server; the test page never
//      receives them.
//   2. Interests (36 statements, 6 per RIASEC type), rated 1-5.
//   3. Work style (20 statements, 4 per trait), rated 1-5. `rev: true`
//      items are reverse-scored.
//
// The same items are used for the Class 10 (stream choice) and Class 12
// (course / career choice) versions; what changes is the recommendation
// catalogue in lib/career/catalog.js.

const APTITUDE = {
  verbal: {
    label: 'Verbal reasoning',
    items: [
      { q: 'Choose the word closest in meaning to ABUNDANT.', o: ['Scarce', 'Plentiful', 'Rare', 'Tiny'], a: 1 },
      { q: 'Choose the word opposite in meaning to ANCIENT.', o: ['Old', 'Modern', 'Historic', 'Aged'], a: 1 },
      { q: 'Book : Author :: Painting : ?', o: ['Canvas', 'Artist', 'Frame', 'Colour'], a: 1 },
      { q: 'Which word is the odd one out?', o: ['Apple', 'Mango', 'Carrot', 'Banana'], a: 2 },
      { q: 'Which word is spelt correctly?', o: ['Recieve', 'Receive', 'Receeve', 'Riceive'], a: 1 },
      { q: 'Fill in the blank: "She was too tired ___ walk any further."', o: ['for', 'to', 'at', 'with'], a: 1 },
      { q: 'Doctor : Hospital :: Teacher : ?', o: ['Book', 'School', 'Student', 'Exam'], a: 1 },
      { q: 'METICULOUS means:', o: ['Careless', 'Very careful about details', 'Very quick', 'Easily angry'], a: 1 },
      { q: 'Which word does NOT belong with the others?', o: ['Happy', 'Joyful', 'Cheerful', 'Gloomy'], a: 3 },
      {
        q: 'Every student who passed the test got a certificate. Ravi did not get a certificate. What follows?',
        o: ['Ravi passed the test', 'Ravi did not pass the test', 'Ravi was absent', 'Nothing can be said'],
        a: 1
      }
    ]
  },
  numerical: {
    label: 'Numerical ability',
    items: [
      { q: 'What is 15% of 200?', o: ['20', '25', '30', '35'], a: 2 },
      { q: 'A pen costs ₹12 and a notebook ₹30. What do 5 pens and 3 notebooks cost?', o: ['₹140', '₹150', '₹160', '₹170'], a: 1 },
      { q: 'A train travels at 60 km/h. How far does it go in 2½ hours?', o: ['120 km', '140 km', '150 km', '160 km'], a: 2 },
      { q: 'What is the average of 4, 8, 12 and 16?', o: ['8', '10', '12', '9'], a: 1 },
      { q: 'If 3x + 5 = 20, what is x?', o: ['3', '4', '5', '6'], a: 2 },
      { q: 'A class of 40 has boys and girls in the ratio 3 : 2. How many girls are there?', o: ['16', '24', '20', '15'], a: 0 },
      { q: 'A price of ₹500 is raised by 20% and then cut by 20%. What is the new price?', o: ['₹500', '₹480', '₹520', '₹490'], a: 1 },
      { q: 'What is the simple interest on ₹1,000 at 10% a year for 2 years?', o: ['₹100', '₹200', '₹210', '₹220'], a: 1 },
      { q: 'What comes next: 2, 6, 12, 20, 30, ?', o: ['40', '42', '44', '36'], a: 1 },
      { q: 'Pipe A fills a tank in 6 hours and pipe B in 3 hours. Together, how long do they take?', o: ['2 hours', '3 hours', '4 hours', '4½ hours'], a: 0 }
    ]
  },
  logical: {
    label: 'Logical reasoning',
    items: [
      { q: 'What comes next: 3, 9, 27, 81, ?', o: ['162', '243', '324', '108'], a: 1 },
      { q: 'What comes next: A, C, E, G, ?', o: ['H', 'I', 'J', 'K'], a: 1 },
      {
        q: 'All roses are flowers. Some flowers fade quickly. Which statement MUST be true?',
        o: ['All roses fade quickly', 'Some roses fade quickly', 'All roses are flowers', 'No rose fades quickly'],
        a: 2
      },
      { q: 'If CAT is written as DBU, how is DOG written?', o: ['EPH', 'DPH', 'EOH', 'FPI'], a: 0 },
      { q: 'You face north, turn right, then turn right again. Which way do you face?', o: ['North', 'East', 'South', 'West'], a: 2 },
      { q: 'Ravi is taller than Amit. Amit is taller than Sohan. Who is the shortest?', o: ['Ravi', 'Amit', 'Sohan', 'Cannot be determined'], a: 2 },
      { q: 'What comes next: Z, X, V, T, ?', o: ['S', 'R', 'Q', 'U'], a: 1 },
      { q: "A's father is B's son. What is B to A?", o: ['Father', 'Uncle', 'Grandparent', 'Brother'], a: 2 },
      { q: 'Find the missing number: 1, 4, 9, 16, ?, 36', o: ['20', '25', '24', '30'], a: 1 },
      { q: 'At 3:00, what is the angle between the hour and minute hands?', o: ['60°', '90°', '120°', '180°'], a: 1 }
    ]
  },
  spatial: {
    label: 'Spatial & mechanical',
    items: [
      {
        q: 'A cube painted red on all sides is cut into 27 equal small cubes. How many small cubes have NO red face?',
        o: ['0', '1', '8', '6'],
        a: 1
      },
      {
        q: 'A square sheet is folded in half, then in half again. One hole is punched through all layers. How many holes are there when it is unfolded?',
        o: ['1', '2', '4', '8'],
        a: 2
      },
      { q: 'Which capital letter looks the same in a mirror placed beside it?', o: ['A', 'F', 'R', 'G'], a: 0 },
      { q: 'How many edges does a cube have?', o: ['6', '8', '12', '10'], a: 2 },
      {
        q: 'Gear A turns clockwise and meshes with gear B. Gear B meshes with gear C. Which way does gear C turn?',
        o: ['Clockwise', 'Anticlockwise', 'It does not move', 'Cannot tell'],
        a: 0
      },
      { q: 'The capital letter N is turned 90° clockwise. Which letter does it look like?', o: ['Z', 'M', 'U', 'W'], a: 0 },
      { q: 'On a normal die, opposite faces add up to 7. Which number is opposite 2?', o: ['3', '4', '5', '6'], a: 2 },
      { q: 'A standing cylinder is seen from directly above. What shape do you see?', o: ['Rectangle', 'Circle', 'Triangle', 'Square'], a: 1 },
      {
        q: 'To lift a heavy stone with a lever using the least effort, where should the pivot be?',
        o: ['Close to the stone', 'In the middle', 'Close to you', 'It does not matter'],
        a: 0
      },
      { q: 'A square has both its diagonals drawn. How many triangles can you count?', o: ['4', '6', '8', '10'], a: 2 }
    ]
  }
};

// RIASEC (Holland) interest types. Students rate "How much would you enjoy…" 1-5.
const INTERESTS = {
  R: {
    label: 'Realistic (hands-on)',
    items: [
      'Repairing a bicycle, motor or machine',
      'Building models or things with tools',
      'Working outdoors — on a farm, site or field',
      'Operating machines or electronic equipment',
      'Assembling furniture or gadgets',
      'Working as a pilot, mechanic or field engineer'
    ]
  },
  I: {
    label: 'Investigative (thinking)',
    items: [
      'Doing science experiments',
      'Solving tough maths or logic puzzles',
      'Reading about how the human body works',
      'Finding out why things happen the way they do',
      'Researching a disease or a new technology',
      'Writing computer programs to solve problems'
    ]
  },
  A: {
    label: 'Artistic (creating)',
    items: [
      'Drawing, painting or designing',
      'Writing stories, poems or articles',
      'Acting, singing, dancing or playing music',
      'Designing clothes, rooms or websites',
      'Making videos or taking photographs',
      'Coming up with ideas for posters or ads'
    ]
  },
  S: {
    label: 'Social (helping)',
    items: [
      'Teaching or explaining things to younger students',
      'Helping people solve their problems',
      'Taking care of people who are sick',
      'Volunteering for a social cause',
      'Listening to and supporting friends who are upset',
      'Working in a team to help the community'
    ]
  },
  E: {
    label: 'Enterprising (leading)',
    items: [
      'Leading a team or a school club',
      'Starting my own business',
      'Persuading people to agree with my idea',
      'Selling a product or an idea',
      'Speaking in front of a large audience',
      'Managing money and planning events'
    ]
  },
  C: {
    label: 'Conventional (organising)',
    items: [
      'Keeping records and accounts neat',
      'Working with numbers and spreadsheets',
      'Following clear rules and procedures',
      'Organising files, data or timetables',
      'Checking work carefully for mistakes',
      'Doing banking, accounts or office work'
    ]
  }
};

// Work-style traits. Students rate "How true is this of you?" 1-5.
const TRAITS = {
  discipline: {
    label: 'Discipline',
    items: [
      { t: 'I finish my homework and tasks on time' },
      { t: 'I plan my day or week in advance' },
      { t: 'I often leave tasks half done', rev: true },
      { t: 'I keep my books and things organised' }
    ]
  },
  curiosity: {
    label: 'Curiosity',
    items: [
      { t: 'I like trying new things' },
      { t: 'I enjoy thinking about ideas and "what ifs"' },
      { t: 'I prefer the same routine over new experiences', rev: true },
      { t: 'I am curious about how things work' }
    ]
  },
  sociability: {
    label: 'Sociability',
    items: [
      { t: 'I enjoy meeting new people' },
      { t: 'I speak up easily in a group' },
      { t: 'I prefer to work alone and quietly', rev: true },
      { t: 'I feel energised around lots of people' }
    ]
  },
  empathy: {
    label: 'Empathy',
    items: [
      { t: "I care about other people's feelings" },
      { t: 'I like helping others even when it is not my job' },
      { t: 'I often get into arguments with people', rev: true },
      { t: 'People come to me when they need support' }
    ]
  },
  composure: {
    label: 'Composure under pressure',
    items: [
      { t: 'I stay calm before and during exams' },
      { t: 'I worry a lot about small things', rev: true },
      { t: 'I bounce back quickly after a failure' },
      { t: 'I get upset or angry easily', rev: true }
    ]
  }
};

// Flattened lists with stable ids (used as form field names).
function aptitudeList() {
  const out = [];
  Object.entries(APTITUDE).forEach(([area, sec]) =>
    sec.items.forEach((it, i) => out.push({ id: `a_${area}_${i}`, area, q: it.q, o: it.o, a: it.a }))
  );
  return out;
}
function interestList() {
  const out = [];
  Object.entries(INTERESTS).forEach(([type, sec]) => sec.items.forEach((t, i) => out.push({ id: `i_${type}_${i}`, type, t })));
  return out;
}
function traitList() {
  const out = [];
  Object.entries(TRAITS).forEach(([trait, sec]) => sec.items.forEach((it, i) => out.push({ id: `p_${trait}_${i}`, trait, t: it.t, rev: !!it.rev })));
  return out;
}

// Deterministic shuffle so interest/trait statements are mixed (not grouped
// by type, which would make answers predictable) but stay in the same order
// on every load.
function seededShuffle(list, seed) {
  const a = list.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// What the test page receives — no answers.
function publicSections() {
  return {
    aptitude: Object.entries(APTITUDE).map(([area, sec]) => ({
      area,
      label: sec.label,
      items: sec.items.map((it, i) => ({ id: `a_${area}_${i}`, q: it.q, o: it.o }))
    })),
    interests: seededShuffle(interestList(), 17).map(({ id, t }) => ({ id, t })),
    traits: seededShuffle(traitList(), 29).map(({ id, t }) => ({ id, t }))
  };
}

module.exports = { APTITUDE, INTERESTS, TRAITS, aptitudeList, interestList, traitList, publicSections };
