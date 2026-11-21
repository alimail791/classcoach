// Generates multiple-choice questions from a syllabus/chapter text using
// whichever API key is configured in .env. Supports Anthropic and OpenAI —
// set AI_PROVIDER to "anthropic" or "openai" to pick which one is used.
// Defaults to Claude Haiku (cheap, fast). For the lowest cost per credit set
// AI_PROVIDER=openai (gpt-4o-mini). Each function accepts an optional
// `meter` object that gets the model and token counts, for cost logging.

const PROMPT_INSTRUCTIONS = (topicText, count, chapterLabel) => `You are helping a teacher generate a multiple-choice test.

Chapter / topic: ${chapterLabel || '(not specified — infer from the text below)'}

Source material:
"""
${topicText}
"""

Generate exactly ${count} multiple-choice questions based on the source material above.

Respond with ONLY a JSON array (no prose, no markdown fences) where each item has this exact shape:
{"text": "question text", "options": ["option A", "option B", "option C", "option D"], "correctIndex": 0, "chapter": "short chapter/topic label"}

Rules:
- Exactly 4 options per question, plausible distractors, one clearly correct answer.
- correctIndex is the 0-based index of the correct option.
- Keep question text under 240 characters.
- Base every question strictly on the source material provided.`;

async function callAnthropic(prompt, meter, maxTokens = 2000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in .env');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text content returned by Anthropic API');
  if (meter) {
    meter.provider = 'anthropic';
    meter.model = data.model;
    meter.input_tokens = data.usage && data.usage.input_tokens;
    meter.output_tokens = data.usage && data.usage.output_tokens;
  }
  return textBlock.text;
}

async function callOpenAI(prompt, meter, maxTokens = 2000) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set in .env');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: maxTokens
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('No content returned by OpenAI API');
  if (meter) {
    meter.provider = 'openai';
    meter.model = data.model;
    meter.input_tokens = data.usage && data.usage.prompt_tokens;
    meter.output_tokens = data.usage && data.usage.completion_tokens;
  }
  return content;
}

function extractJsonArray(raw) {
  // Models sometimes wrap output in ```json fences despite instructions — strip if present.
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('Could not find a JSON array in the model response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function extractJsonObject(raw) {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Could not find a JSON object in the model response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const GRADING_PROMPT = (questionText, studentAnswer, maxMarks) => `You are helping a teacher grade a student's descriptive (long-answer) exam response. You are assisting, not deciding — the teacher will review and can override anything you suggest.

Question (worth ${maxMarks} mark${maxMarks === 1 ? '' : 's'} total):
"""
${questionText}
"""

Student's answer:
"""
${studentAnswer || '(no answer given)'}
"""

Suggest a fair mark out of ${maxMarks} and explain briefly why, in one or two sentences, pointing out anything the answer got right or missed.

Respond with ONLY a JSON object (no prose, no markdown fences) of this exact shape:
{"suggestedMarks": <number from 0 to ${maxMarks}, can be a whole or half number>, "rationale": "one to two sentence explanation"}`;

// Suggests a mark and a short rationale for one descriptive answer. This
// never saves anything by itself — it's a suggestion the teacher sees on
// the grading screen and can accept, edit, or ignore before saving.
async function suggestDescriptiveGrade({ questionText, studentAnswer, maxMarks, meter }) {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  const prompt = GRADING_PROMPT(questionText, studentAnswer, maxMarks);

  const raw = provider === 'openai' ? await callOpenAI(prompt, meter) : await callAnthropic(prompt, meter);
  const parsed = extractJsonObject(raw);

  const marks = Number(parsed.suggestedMarks);
  if (Number.isNaN(marks)) throw new Error('The model did not return a valid mark.');
  const clamped = Math.max(0, Math.min(maxMarks, marks));

  return { suggestedMarks: clamped, rationale: String(parsed.rationale || '').trim() };
}

async function generateQuestions({ topicText, count = 6, chapterLabel = '', meter }) {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  const prompt = PROMPT_INSTRUCTIONS(topicText, count, chapterLabel);

  const raw = provider === 'openai' ? await callOpenAI(prompt, meter) : await callAnthropic(prompt, meter);
  const parsed = extractJsonArray(raw);

  return parsed
    .filter((q) => q && q.text && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correctIndex))
    .map((q) => ({
      text: String(q.text).slice(0, 500),
      options: q.options.slice(0, 6).map(String),
      correctIndex: Math.max(0, Math.min(q.options.length - 1, q.correctIndex)),
      chapter: q.chapter ? String(q.chapter).slice(0, 100) : chapterLabel
    }));
}

// Lesson plan for one class period, as notes-style sections (heading + body)
// so it reuses the notes editor, PDF export and storage.
const LESSON_PROMPT = ({ topicText, chapterLabel, grade, subject, minutes }) => `You are helping a school or coaching teacher in India plan one class period.

Class / grade: ${grade || '(not specified)'}
Subject: ${subject || '(not specified — infer from the topic)'}
Topic: ${chapterLabel || '(infer from the material below)'}
Period length: ${minutes} minutes
${topicText ? `\nSource material (base the lesson on this):\n"""\n${topicText}\n"""\n` : ''}
Write a practical lesson plan the teacher can follow in class. Respond with ONLY a JSON array (no prose, no markdown fences) of exactly these sections, in this order, each {"heading": "...", "body": "..."}:
1. "Learning objectives" — 3 or 4 lines, each starting "Students will be able to".
2. "Prior knowledge" — what students should already know, 2–3 lines.
3. "Materials" — board, textbook pages, any simple aids.
4. "Lesson flow (${minutes} minutes)" — timed steps that add up to ${minutes} minutes, one per line, like "0–5 min · Hook: ...". Include a hook, explanation with an example, guided practice and a quick check.
5. "Board work / key points" — what goes on the board, one point per line.
6. "Questions to ask" — 4 or 5 questions from easy to hard, one per line.
7. "Check for understanding" — a 3-question exit check with answers.
8. "Homework" — 2 or 3 tasks.
9. "Support and stretch" — one line for students who struggle, one for fast learners.

Rules:
- Use plain language and short lines; put each item on its own line (use \\n between lines inside "body").
- Keep facts accurate for the grade; if source material is given, stay within it.`;

const MATERIAL_PROMPT = (type, topicText, chapterLabel) => {
  if (type === 'slides') {
    return `You are helping a teacher build a slide deck for their class.

Chapter / topic: ${chapterLabel || '(not specified — infer from the text below)'}

Source material:
"""
${topicText}
"""

Generate a slide-by-slide outline covering this material: a title slide plus 5-8 content slides.

Respond with ONLY a JSON array (no prose, no markdown fences) where each item has this exact shape:
{"title": "slide title", "bullets": ["short bullet point", "short bullet point", "short bullet point"]}

Rules:
- First item is the title slide: "title" = the topic name, "bullets" = [] (empty array).
- Each content slide: 3-5 short bullets, each under 100 characters.
- Base every slide strictly on the source material provided.`;
  }
  return `You are helping a teacher write class notes.

Chapter / topic: ${chapterLabel || '(not specified — infer from the text below)'}

Source material:
"""
${topicText}
"""

Generate structured notes covering this material, broken into 4-7 sections.

Respond with ONLY a JSON array (no prose, no markdown fences) where each item has this exact shape:
{"heading": "section heading", "body": "2-4 sentence explanation in plain language"}

Rules:
- Base every section strictly on the source material provided.
- Keep each body concise and exam-focused.`;
};

async function generateMaterial({ type, topicText, chapterLabel = '', meter, lesson = {} }) {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  if (type === 'lesson') {
    const minutes = Math.min(180, Math.max(20, parseInt(lesson.minutes, 10) || 40));
    const lp = LESSON_PROMPT({ topicText, chapterLabel, grade: lesson.grade, subject: lesson.subject, minutes });
    const out = provider === 'openai' ? await callOpenAI(lp, meter, 3000) : await callAnthropic(lp, meter, 3000);
    return extractJsonArray(out)
      .filter((s) => s && s.heading && s.body)
      .map((s) => ({ heading: String(s.heading).slice(0, 200), body: String(s.body).slice(0, 2500) }));
  }
  const prompt = MATERIAL_PROMPT(type === 'notes' ? 'notes' : 'slides', topicText, chapterLabel);

  const raw = provider === 'openai' ? await callOpenAI(prompt, meter) : await callAnthropic(prompt, meter);
  const parsed = extractJsonArray(raw);

  if (type === 'notes') {
    return parsed
      .filter((s) => s && s.heading && s.body)
      .map((s) => ({ heading: String(s.heading).slice(0, 200), body: String(s.body).slice(0, 1000) }));
  }
  return parsed
    .filter((s) => s && s.title)
    .map((s) => ({
      title: String(s.title).slice(0, 200),
      bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 6).map((b) => String(b).slice(0, 200)) : []
    }));
}

// Generic call for features with their own prompt (career report, question
// papers). Returns the raw text; callers parse it.
async function complete(prompt, { meter, maxTokens = 2000 } = {}) {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  return provider === 'openai' ? callOpenAI(prompt, meter, maxTokens) : callAnthropic(prompt, meter, maxTokens);
}

module.exports = { generateQuestions, generateMaterial, suggestDescriptiveGrade, complete, extractJsonArray, extractJsonObject };
