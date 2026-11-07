// Scores a submitted career test and builds the rule-based result that every
// report tier shows. The AI write-up (Standard / Premium) is layered on top
// of this in lib/career/report.js — if the AI fails, this result still stands.
const { APTITUDE, INTERESTS, TRAITS, aptitudeList, interestList, traitList } = require('./items');
const { STREAMS, CLUSTERS, CLASS12_STREAMS, STREAM_KW } = require('./catalog');

const clampLikert = (v) => {
  const n = parseInt(v, 10);
  return n >= 1 && n <= 5 ? n : null;
};

// answers: { [itemId]: value } straight from the test form.
function scoreAnswers(answers) {
  const aptitude = {};
  Object.keys(APTITUDE).forEach((k) => (aptitude[k] = { correct: 0, total: 0 }));
  aptitudeList().forEach((it) => {
    aptitude[it.area].total += 1;
    if (String(answers[it.id]) === String(it.a)) aptitude[it.area].correct += 1;
  });

  const interestSums = {};
  Object.keys(INTERESTS).forEach((k) => (interestSums[k] = { sum: 0, n: 0 }));
  interestList().forEach((it) => {
    const v = clampLikert(answers[it.id]);
    if (v) {
      interestSums[it.type].sum += v;
      interestSums[it.type].n += 1;
    }
  });

  const traitSums = {};
  Object.keys(TRAITS).forEach((k) => (traitSums[k] = { sum: 0, n: 0 }));
  traitList().forEach((it) => {
    let v = clampLikert(answers[it.id]);
    if (v) {
      if (it.rev) v = 6 - v;
      traitSums[it.trait].sum += v;
      traitSums[it.trait].n += 1;
    }
  });

  // Everything on a 0-100 scale. Unanswered Likert items count as neutral (3).
  const scale = {};
  Object.entries(aptitude).forEach(([k, a]) => (scale[k] = Math.round((a.correct / a.total) * 100)));
  Object.entries(interestSums).forEach(([k, s]) => {
    const mean = s.n ? s.sum / s.n : 3;
    scale[k] = Math.round(((mean - 1) / 4) * 100);
  });
  Object.entries(traitSums).forEach(([k, s]) => {
    const mean = s.n ? s.sum / s.n : 3;
    scale[k] = Math.round(((mean - 1) / 4) * 100);
  });

  const answered = aptitudeList().filter((it) => answers[it.id] !== undefined && answers[it.id] !== '').length;
  return { aptitude, scale, aptitudeAnswered: answered };
}

function fitScore(option, scale) {
  let total = 0;
  let weight = 0;
  Object.entries(option.w).forEach(([k, w]) => {
    total += (scale[k] || 0) * w;
    weight += w;
  });
  return weight ? Math.round(total / weight) : 0;
}

function matchesKeywords(text, kws) {
  const t = ` ${String(text || '').toLowerCase()} `;
  return kws.some((kw) => {
    const k = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Short keywords must be whole words ("ca" must not match "career").
    const re = kw.length <= 3 ? new RegExp(`\\b${k}\\b`) : new RegExp(`\\b${k}`);
    return re.test(t);
  });
}

const fitBand = (s) => (s >= 70 ? 'Strong fit' : s >= 55 ? 'Good fit' : s >= 40 ? 'Possible fit' : 'Weaker fit');

// level: '10' | '12'. profile: { current_stream, aspiration }.
function buildResult(level, profile, answers) {
  const { aptitude, scale, aptitudeAnswered } = scoreAnswers(answers);

  let ranked;
  let blocked = [];
  if (level === '10') {
    ranked = STREAMS.map((s) => ({ key: s.key, name: s.name, fit: fitScore(s, scale), leadsTo: s.leadsTo, exams: s.exams }))
      .sort((a, b) => b.fit - a.fit);
  } else {
    const stream = profile.current_stream;
    const all = CLUSTERS.map((c) => ({
      key: c.key,
      name: c.name,
      fit: fitScore(c, scale),
      degrees: c.degrees,
      exams: c.exams,
      needs: c.needs,
      eligible: !stream || c.streams.includes(stream)
    })).sort((a, b) => b.fit - a.fit);
    ranked = all.filter((c) => c.eligible);
    // Strong fits the student's current stream can't enter directly — shown
    // honestly as "would need a different subject combination".
    blocked = all.filter((c) => !c.eligible && c.fit >= 60 && c.fit >= (ranked[2] ? ranked[2].fit : 0)).slice(0, 2);
  }
  ranked.forEach((r) => (r.band = fitBand(r.fit)));
  blocked.forEach((r) => (r.band = fitBand(r.fit)));
  const top = ranked.slice(0, 3);

  // Interest code: top three RIASEC letters (e.g. "ISA").
  const riasec = Object.keys(INTERESTS).sort((a, b) => scale[b] - scale[a]);
  const interestCode = riasec.slice(0, 3).join('');

  // Does the student's own stated goal agree with the test?
  let aspirationMatch = null;
  const asp = String(profile.aspiration || '').trim();
  let aspirationKey = null;
  if (asp) {
    if (level === '10') {
      aspirationKey = Object.keys(STREAM_KW).find((k) => matchesKeywords(asp, STREAM_KW[k])) || null;
    } else {
      const c = CLUSTERS.find((cl) => matchesKeywords(asp, cl.kw));
      aspirationKey = c ? c.key : null;
    }
    if (aspirationKey) aspirationMatch = top.slice(0, 2).some((t) => t.key === aspirationKey);
  }

  // Flags the school/teacher should follow up on with a counsellor.
  const counselReasons = [];
  if (!top.length || top[0].fit < 50) counselReasons.push('No field stands out clearly yet');
  else if (top[1] && top[0].fit - top[1].fit <= 3) counselReasons.push(`Close call between ${top[0].name} and ${top[1].name}`);
  if (aspirationMatch === false) counselReasons.push(`Wants "${asp.slice(0, 60)}" but the test points elsewhere`);
  if (level === '12' && aspirationKey && !ranked.some((r) => r.key === aspirationKey)) {
    counselReasons.push('Stated goal needs a different Class 12 subject combination');
  }
  if (scale.composure < 35) counselReasons.push('Reports high exam stress');
  if (aptitudeAnswered < 30) counselReasons.push('Left many aptitude questions unanswered');

  const levelLabel = level === '10' ? 'After Class 10 — stream choice' : 'After Class 12 — course & career choice';
  return {
    level,
    levelLabel,
    currentStreamLabel: level === '12' ? CLASS12_STREAMS[profile.current_stream] || '' : '',
    aptitude: Object.entries(aptitude).map(([k, a]) => ({ key: k, label: APTITUDE[k].label, correct: a.correct, total: a.total, pct: scale[k] })),
    interests: riasec.map((k) => ({ key: k, label: INTERESTS[k].label, pct: scale[k] })),
    traits: Object.keys(TRAITS).map((k) => ({ key: k, label: TRAITS[k].label, pct: scale[k] })),
    interestCode,
    ranked,
    top,
    blocked,
    aspiration: asp,
    aspirationMatch,
    needsCounselling: counselReasons.length > 0,
    counselReasons
  };
}

module.exports = { scoreAnswers, buildResult, fitScore };
