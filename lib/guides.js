// "Read the guide" links from busy public pages (landing pages, free tools)
// to the blog articles about the same thing. Only posts that are already
// published are shown, so scheduled articles appear on their own date.
const db = require('./db');

const GUIDES = {
  'best-ai-tools-for-teachers': ['best-ai-tools-for-school-teachers', 'ai-tools-for-teachers-in-india', 'best-ai-teaching-assistant', 'how-teachers-can-save-time-using-ai'],
  'question-paper-generator': ['how-to-generate-question-papers-using-ai', 'how-to-prepare-class-10-question-papers', 'ai-tools-for-cbse-teachers', 'ai-tools-for-state-board-teachers'],
  'free-question-paper-generator': ['how-to-generate-question-papers-using-ai', 'how-to-prepare-class-10-question-papers', 'ai-tools-for-state-board-teachers'],
  'paper-class': ['how-to-prepare-class-10-question-papers', 'how-to-generate-question-papers-using-ai', 'ai-tools-for-cbse-teachers'],
  'paper-language': ['ai-tools-for-state-board-teachers', 'how-to-generate-question-papers-using-ai'],
  'ai-answer-sheet-evaluation': ['automatic-answer-sheet-evaluation-using-ai', 'ai-descriptive-answer-evaluation'],
  'omr-sheet-scanner': ['automatic-answer-sheet-evaluation-using-ai', 'how-teachers-can-save-time-using-ai'],
  'free-omr-sheet-generator': ['automatic-answer-sheet-evaluation-using-ai'],
  'ai-lesson-plan-generator': ['ai-lesson-plan-generator-for-teachers', 'ai-presentation-generator-for-teachers', 'ai-notes-generator-for-teachers'],
  'online-test-maker': ['how-to-create-mcq-questions-using-ai', 'how-to-create-worksheets-using-ai'],
  'neet-test-generator': ['how-to-create-mcq-questions-using-ai'],
  'progress-reports-for-parents': ['best-ai-teaching-assistant'],
  'free-tools': ['best-ai-tools-for-school-teachers', 'how-teachers-can-save-time-using-ai', 'how-to-generate-question-papers-using-ai']
};

function guidesFor(key) {
  const slugs = GUIDES[key];
  if (!slugs || !slugs.length) return [];
  try {
    const rows = db
      .prepare(`SELECT slug, title FROM blog_posts WHERE status = 'published' AND slug IN (${slugs.map(() => '?').join(',')})`)
      .all(...slugs);
    return slugs.map((s) => rows.find((r) => r.slug === s)).filter(Boolean);
  } catch (err) {
    return [];
  }
}

module.exports = { GUIDES, guidesFor };
