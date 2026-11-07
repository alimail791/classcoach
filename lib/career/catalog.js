// Recommendation catalogue for the career aptitude test.
//
// Every option has `w`: weights over the 0-100 scores the test produces.
//   Aptitude:  verbal, numerical, logical, spatial
//   Interests: R, I, A, S, E, C  (RIASEC)
//   Work style (small nudge only): discipline, curiosity, sociability, empathy, composure
// Weights in an option need not add to 1; scoring normalises them.
//
// Edit this file to change what the report recommends — exam names, degree
// options, or which Class 12 streams can enter a field.

// ---- After Class 10: stream choice --------------------------------------
const STREAMS = [
  {
    key: 'pcb',
    name: 'Science with Biology (PCB)',
    w: { I: 0.35, S: 0.15, R: 0.05, numerical: 0.15, logical: 0.15, verbal: 0.1, empathy: 0.05 },
    leadsTo: 'Medicine (MBBS, BDS, AYUSH), nursing, pharmacy, physiotherapy, biotechnology, agriculture, veterinary science, life-science research',
    exams: ['NEET-UG', 'ICAR AIEEA', 'IISER Aptitude Test', 'CUET-UG']
  },
  {
    key: 'pcm',
    name: 'Science with Maths (PCM)',
    w: { numerical: 0.3, logical: 0.25, spatial: 0.15, I: 0.2, R: 0.1 },
    leadsTo: 'Engineering, computer science, architecture, data science, pure sciences, defence (NDA technical branches), commercial pilot training',
    exams: ['JEE Main', 'JEE Advanced', 'State CETs (KCET, MHT-CET, EAPCET, etc.)', 'BITSAT', 'NDA', 'NATA']
  },
  {
    key: 'commerce',
    name: 'Commerce',
    w: { numerical: 0.25, logical: 0.1, verbal: 0.1, E: 0.25, C: 0.3, discipline: 0.05 },
    leadsTo: 'CA, CMA, CS, B.Com, BBA, banking, finance, economics, business management, entrepreneurship',
    exams: ['CA Foundation', 'CUET-UG', 'IPMAT', 'NPAT']
  },
  {
    key: 'humanities',
    name: 'Humanities / Arts',
    w: { verbal: 0.3, A: 0.2, S: 0.25, E: 0.1, I: 0.05, logical: 0.1 },
    leadsTo: 'Law, psychology, journalism and media, design, civil services, teaching, social work, economics, languages',
    exams: ['CLAT', 'CUET-UG', 'NIFT / NID entrance', 'IIMC entrance', 'UPSC (after graduation)']
  },
  {
    key: 'vocational',
    name: 'Diploma / Vocational (ITI, Polytechnic)',
    w: { spatial: 0.25, R: 0.45, numerical: 0.1, C: 0.1, logical: 0.1 },
    leadsTo: 'Polytechnic diplomas (then lateral entry to B.Tech), ITI trades, electronics, automobile, hospitality, paramedical skills — earning sooner',
    exams: ['State Polytechnic entrance', 'ITI admission (state)']
  }
];

// ---- After Class 12: course / career field ------------------------------
// Class 12 stream codes the student picks on the start form.
const CLASS12_STREAMS = {
  pcb: 'Science — PCB (Biology)',
  pcm: 'Science — PCM (Maths)',
  pcmb: 'Science — PCMB (Maths + Biology)',
  com_m: 'Commerce with Maths',
  com: 'Commerce without Maths',
  hum: 'Humanities / Arts',
  voc: 'Vocational / Diploma'
};
const ALL = Object.keys(CLASS12_STREAMS);

const CLUSTERS = [
  {
    key: 'medicine',
    name: 'Medicine & Healthcare',
    w: { I: 0.3, S: 0.25, numerical: 0.1, logical: 0.15, verbal: 0.1, R: 0.1, empathy: 0.05, discipline: 0.05 },
    streams: ['pcb', 'pcmb'],
    needs: 'Physics, Chemistry and Biology in Class 12',
    degrees: 'MBBS, BDS, BAMS / BHMS, B.Sc Nursing, B.Pharm, BPT (physiotherapy), allied health sciences',
    exams: ['NEET-UG', 'State nursing / paramedical entrance', 'AIIMS Nursing'],
    kw: ['doctor', 'mbbs', 'neet', 'medical', 'medicine', 'dentist', 'bds', 'nurse', 'nursing', 'pharma', 'physio', 'surgeon']
  },
  {
    key: 'engineering',
    name: 'Engineering & Technology',
    w: { numerical: 0.3, logical: 0.2, spatial: 0.2, I: 0.15, R: 0.15, curiosity: 0.05 },
    streams: ['pcm', 'pcmb'],
    needs: 'Physics, Chemistry and Maths in Class 12',
    degrees: 'B.Tech / BE (mechanical, civil, electrical, electronics, chemical, aerospace and more)',
    exams: ['JEE Main', 'JEE Advanced', 'State CETs (KCET, MHT-CET, EAPCET, etc.)', 'BITSAT', 'VITEEE'],
    kw: ['engineer', 'engineering', 'iit', 'jee', 'btech', 'b.tech', 'mechanical', 'civil', 'electrical']
  },
  {
    key: 'computing',
    name: 'Computer Science, IT & Data',
    w: { logical: 0.35, numerical: 0.25, I: 0.25, C: 0.15, curiosity: 0.05 },
    streams: ['pcm', 'pcmb', 'com_m'],
    needs: 'Maths in Class 12 (PCM for B.Tech; Maths is enough for BCA / B.Sc)',
    degrees: 'B.Tech CSE / AI, BCA, B.Sc Computer Science / Data Science',
    exams: ['JEE Main', 'State CETs', 'CUET-UG', 'University BCA entrance'],
    kw: ['software', 'computer', 'coding', 'programmer', 'developer', 'it', 'data', 'ai', 'bca', 'cse']
  },
  {
    key: 'science',
    name: 'Pure Sciences & Research',
    w: { I: 0.4, logical: 0.2, numerical: 0.2, verbal: 0.1, spatial: 0.1, curiosity: 0.1 },
    streams: ['pcb', 'pcm', 'pcmb'],
    needs: 'Science stream in Class 12',
    degrees: 'B.Sc, BS-MS (IISERs), Integrated M.Sc (NISER, CEBS), biotechnology',
    exams: ['IISER Aptitude Test', 'NEST', 'CUET-UG'],
    kw: ['scientist', 'research', 'physics', 'chemistry', 'biology', 'bsc', 'b.sc', 'isro', 'iiser', 'biotech']
  },
  {
    key: 'finance',
    name: 'Commerce, Finance & Accounting',
    w: { numerical: 0.3, C: 0.35, logical: 0.15, E: 0.2, discipline: 0.05 },
    streams: ['com_m', 'com', 'pcm', 'pcmb'],
    needs: 'Any stream; Maths helps a lot (economics honours and some B.Com courses need it)',
    degrees: 'B.Com, CA, CMA, CS, BBA (Finance), B.Sc / BA Economics',
    exams: ['CA Foundation', 'CMA Foundation', 'CUET-UG'],
    kw: ['ca', 'chartered', 'accountant', 'bank', 'finance', 'bcom', 'b.com', 'cma', 'economics', 'stock']
  },
  {
    key: 'management',
    name: 'Business, Management & Entrepreneurship',
    w: { E: 0.45, verbal: 0.15, numerical: 0.15, S: 0.1, logical: 0.15, sociability: 0.1 },
    streams: ALL,
    needs: 'Any stream',
    degrees: 'BBA, BMS, Integrated Programme in Management (IPM)',
    exams: ['IPMAT', 'CUET-UG', 'NPAT', 'SET (Symbiosis)'],
    kw: ['business', 'bba', 'mba', 'manager', 'management', 'entrepreneur', 'startup', 'ceo', 'marketing']
  },
  {
    key: 'law',
    name: 'Law',
    w: { verbal: 0.35, logical: 0.25, E: 0.25, S: 0.15, sociability: 0.05 },
    streams: ALL,
    needs: 'Any stream',
    degrees: 'BA LLB, BBA LLB, B.Com LLB (5-year integrated)',
    exams: ['CLAT', 'AILET', 'LSAT India', 'MH-CET Law'],
    kw: ['lawyer', 'law', 'advocate', 'judge', 'clat', 'llb', 'legal']
  },
  {
    key: 'design',
    name: 'Design, Architecture & Fine Arts',
    w: { A: 0.45, spatial: 0.3, R: 0.1, I: 0.05, curiosity: 0.1 },
    streams: ALL,
    needs: 'Any stream for design and fine arts; PCM needed for B.Arch',
    degrees: 'B.Des (product, fashion, communication), B.Arch, BFA, animation',
    exams: ['UCEED', 'NID DAT', 'NIFT', 'NATA (B.Arch)', 'JEE Main Paper 2'],
    kw: ['design', 'designer', 'architect', 'fashion', 'artist', 'animation', 'nift', 'nid', 'painting']
  },
  {
    key: 'media',
    name: 'Media, Journalism & Communication',
    w: { verbal: 0.35, A: 0.25, E: 0.25, S: 0.15, sociability: 0.05 },
    streams: ALL,
    needs: 'Any stream',
    degrees: 'BA Journalism & Mass Communication, BJMC, BA English / Media Studies',
    exams: ['CUET-UG', 'IIMC entrance', 'University media entrance tests'],
    kw: ['journalist', 'media', 'reporter', 'anchor', 'writer', 'youtuber', 'content', 'film', 'actor']
  },
  {
    key: 'social',
    name: 'Psychology, Education & Social Work',
    w: { S: 0.45, verbal: 0.2, I: 0.2, A: 0.05, logical: 0.1, empathy: 0.1 },
    streams: ALL,
    needs: 'Any stream',
    degrees: 'BA / B.Sc Psychology, B.El.Ed, B.A. B.Ed, BSW (Social Work)',
    exams: ['CUET-UG', 'University entrance tests'],
    kw: ['psycholog', 'teacher', 'counsel', 'social work', 'ngo', 'professor', 'therapist']
  },
  {
    key: 'civil',
    name: 'Civil Services & Public Administration',
    w: { verbal: 0.25, logical: 0.2, E: 0.2, S: 0.2, C: 0.15, discipline: 0.05 },
    streams: ALL,
    needs: 'Any stream (any degree qualifies for UPSC)',
    degrees: 'BA Political Science / History / Economics / Public Administration, or any degree',
    exams: ['CUET-UG (for the degree)', 'UPSC CSE and State PSC (after graduation)'],
    kw: ['ias', 'ips', 'upsc', 'civil service', 'collector', 'officer', 'psc', 'government']
  },
  {
    key: 'defence',
    name: 'Defence & Uniformed Services',
    w: { R: 0.3, E: 0.2, logical: 0.2, spatial: 0.15, numerical: 0.15, composure: 0.1, discipline: 0.05 },
    streams: ALL,
    needs: 'Any stream for Army; PCM for NDA Air Force / Navy',
    degrees: 'NDA (B.Sc / B.Tech with commission), or any degree then CDS / AFCAT',
    exams: ['NDA', 'Indian Navy 10+2 B.Tech entry', 'Agniveer', 'CDS / AFCAT (after graduation)'],
    kw: ['army', 'navy', 'air force', 'nda', 'defence', 'soldier', 'pilot', 'police', 'military']
  },
  {
    key: 'hospitality',
    name: 'Hospitality, Travel & Aviation',
    w: { S: 0.35, E: 0.3, A: 0.1, verbal: 0.15, C: 0.1, sociability: 0.1 },
    streams: ALL,
    needs: 'Any stream',
    degrees: 'BHM (Hotel Management), B.Sc Hospitality, culinary arts, aviation and cabin crew programmes',
    exams: ['NCHM JEE', 'University entrance tests'],
    kw: ['hotel', 'chef', 'cook', 'hospitality', 'cabin crew', 'air hostess', 'travel', 'tourism']
  },
  {
    key: 'agriculture',
    name: 'Agriculture, Veterinary & Environment',
    w: { R: 0.3, I: 0.3, numerical: 0.1, logical: 0.1, spatial: 0.1, S: 0.1 },
    streams: ['pcb', 'pcm', 'pcmb', 'voc'],
    needs: 'Science stream (PCB for veterinary science)',
    degrees: 'B.Sc Agriculture, B.V.Sc (veterinary), B.Sc Forestry / Environmental Science, food technology',
    exams: ['ICAR AIEEA', 'NEET-UG (for B.V.Sc)', 'State agriculture CETs'],
    kw: ['agri', 'farm', 'vet', 'veterinary', 'forest', 'environment', 'animal']
  }
];

// Class 10 aspiration keywords → stream.
const STREAM_KW = {
  pcb: ['doctor', 'mbbs', 'neet', 'medical', 'nurse', 'biology', 'pcb', 'dentist', 'pharma', 'vet'],
  pcm: ['engineer', 'iit', 'jee', 'pcm', 'pilot', 'software', 'computer', 'coding', 'architect', 'scientist', 'isro', 'nda'],
  commerce: ['ca', 'chartered', 'commerce', 'business', 'bank', 'finance', 'accountant', 'bcom', 'b.com', 'mba'],
  humanities: ['lawyer', 'ias', 'ips', 'upsc', 'journalist', 'psycholog', 'teacher', 'arts', 'humanities', 'writer', 'designer', 'actor'],
  vocational: ['iti', 'polytechnic', 'diploma', 'mechanic', 'electrician']
};

module.exports = { STREAMS, CLUSTERS, CLASS12_STREAMS, STREAM_KW };
