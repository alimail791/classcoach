// AI write-up for Standard and Premium career reports. Runs in the
// background after a student submits; the report page shows the rule-based
// result straight away and swaps in this write-up when it is ready.
const db = require('../db');
const { complete, extractJsonObject } = require('../ai');
const { costInr } = require('../credits');

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati'];

function prompt(attempt, result) {
  const lines = (arr) => arr.map((x) => `- ${x.label}: ${x.pct}/100`).join('\n');
  const options = result.top
    .map((t, i) => `${i + 1}. ${t.name} — fit ${t.fit}/100 (${t.band}). ${result.level === '10' ? `Leads to: ${t.leadsTo}` : `Degrees: ${t.degrees}`}. Exams: ${t.exams.join(', ')}`)
    .join('\n');
  const blocked = result.blocked.length
    ? `\nStrong fits that need a different Class 12 subject combination (mention honestly, not as a top pick):\n${result.blocked.map((b) => `- ${b.name} (fit ${b.fit}); needs ${b.needs}`).join('\n')}`
    : '';

  return `You are an experienced Indian school career counsellor writing a personal report for a student and their parents, based on a career aptitude test.

Student: ${attempt.student_name}
Stage: ${result.levelLabel}${result.currentStreamLabel ? `\nCurrent Class 12 stream: ${result.currentStreamLabel}` : ''}
Student's own goal: ${result.aspiration || '(not given)'}${result.aspirationMatch === false ? ' — the test results point elsewhere' : ''}

Aptitude (share of questions correct):
${lines(result.aptitude)}

Interests (RIASEC, higher = stronger interest), code ${result.interestCode}:
${lines(result.interests)}

Work style:
${lines(result.traits)}

Top recommended ${result.level === '10' ? 'streams' : 'fields'} (already decided by the scoring — explain them, do not change the order):
${options}${blocked}

Write the whole report in ${attempt.language}. Use simple words a Class ${result.level} student and their parents understand. Keep exam names, degree names and stream names in English (e.g. NEET-UG, B.Tech, PCB).

Rules:
- Be encouraging and honest. Never call any field "impossible" or the student "weak"; describe areas to build instead.
- Only mention exams, degrees and fields listed above. Do not invent colleges, cut-offs, salaries or statistics.
- This is guidance, not a final decision; do not diagnose anything medical or psychological.
- If the student's own goal differs from the test, respect it: explain what it would take, and suggest talking to a counsellor.

Respond with ONLY a JSON object (no prose, no markdown fences) of this exact shape:
{
  "summary": "3-4 sentence overview of who this student is and what suits them",
  "strengths": ["3 short strengths drawn from the scores"],
  "toDevelop": ["2-3 short areas to build, framed positively"],
  "recommendations": [
    {"name": "exact name of a recommended ${result.level === '10' ? 'stream' : 'field'} from the list", "why": "2 sentences linking it to this student's scores", "nextSteps": ["2-3 concrete next steps, e.g. which exam to prepare for and when"]}
  ],
  "aboutGoal": "1-2 sentences on the student's own goal, or empty string if none was given",
  "parentNote": "3-4 sentence note addressed to the parents: what the results mean and how they can support",
  "studyTips": ["3 short, practical tips suited to this student's work style"]
}
Give exactly ${result.top.length} recommendations, in the same order as the list above.`;
}

function clean(raw) {
  const o = extractJsonObject(raw);
  const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n).map((x) => String(x).slice(0, 400)) : []);
  return {
    summary: String(o.summary || '').slice(0, 1500),
    strengths: arr(o.strengths, 5),
    toDevelop: arr(o.toDevelop, 4),
    recommendations: (Array.isArray(o.recommendations) ? o.recommendations : []).slice(0, 3).map((r) => ({
      name: String((r && r.name) || '').slice(0, 120),
      why: String((r && r.why) || '').slice(0, 800),
      nextSteps: arr(r && r.nextSteps, 4)
    })),
    aboutGoal: String(o.aboutGoal || '').slice(0, 800),
    parentNote: String(o.parentNote || '').slice(0, 1500),
    studyTips: arr(o.studyTips, 4)
  };
}

const running = new Set();

// Writes the AI report for one attempt. Safe to call repeatedly; only one
// run per attempt at a time. Logs the API cost against the teacher (0 credits —
// the seat pays for it).
async function generateAiReport(attemptId) {
  if (running.has(attemptId)) return;
  running.add(attemptId);
  try {
    const attempt = db.prepare('SELECT * FROM career_attempts WHERE id = ?').get(attemptId);
    if (!attempt || attempt.status !== 'done' || !attempt.result_json) return;
    const batch = db.prepare('SELECT * FROM career_batches WHERE id = ?').get(attempt.batch_id);
    db.prepare("UPDATE career_attempts SET ai_status = 'pending' WHERE id = ?").run(attemptId);

    const result = JSON.parse(attempt.result_json);
    const meter = {};
    const raw = await complete(prompt(attempt, result), { meter, maxTokens: attempt.language === 'English' ? 2200 : 4000 });
    const ai = clean(raw);
    db.prepare("UPDATE career_attempts SET ai_status = 'ready', ai_json = ? WHERE id = ?").run(JSON.stringify(ai), attemptId);

    const teacher = batch && db.prepare('SELECT id, institute_id FROM teachers WHERE id = ?').get(batch.teacher_id);
    if (teacher) {
      db.prepare(
        `INSERT INTO ai_calls (teacher_id, institute_id, feature, credits, topup_credits, provider, model, input_tokens, output_tokens, cost_inr)
         VALUES (?, ?, 'career_report', 0, 0, ?, ?, ?, ?, ?)`
      ).run(
        teacher.id,
        teacher.institute_id || null,
        meter.provider || null,
        meter.model || null,
        meter.input_tokens ?? null,
        meter.output_tokens ?? null,
        costInr(meter.model, meter.input_tokens, meter.output_tokens)
      );
    }
  } catch (err) {
    console.error(`Career AI report ${attemptId} failed:`, err.message);
    db.prepare("UPDATE career_attempts SET ai_status = 'failed' WHERE id = ?").run(attemptId);
  } finally {
    running.delete(attemptId);
  }
}

module.exports = { LANGUAGES, generateAiReport, buildPrompt: prompt };
