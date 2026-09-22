const express = require('express');
const multer = require('multer');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { generateMaterial } = require('../lib/ai');
const { extractTextFromPdf } = require('../lib/pdf');
const { extractTextFromImage } = require('../lib/ocr');
const { generateMaterialPdf } = require('../lib/pdfExport');
const { checkAiLimit, recordAiUsage } = require('../lib/usage');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/png';
    if (!ok) return cb(new Error('Only PDF, JPG, or PNG files are accepted'));
    cb(null, true);
  }
});

function loadMaterialOr404(req, res) {
  const material = db
    .prepare('SELECT * FROM materials WHERE id = ? AND teacher_id = ?')
    .get(req.params.id, req.teacher.id);
  if (!material) {
    res.status(404).send('Material not found');
    return null;
  }
  return { ...material, content: JSON.parse(material.content_json) };
}

router.get('/batches/:batchId/materials/new', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');
  res.render('material_new', { teacher: req.teacher, batch, error: null });
});

router.post('/batches/:batchId/materials', requireTeacher, (req, res, next) => {
  upload.fields([{ name: 'source_pdf', maxCount: 1 }, { name: 'source_image', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.batchId);
      return res.render('material_new', { teacher: req.teacher, batch, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');

  const { title, chapter, type, source_text, mode } = req.body;
  const materialType = type === 'notes' ? 'notes' : 'slides';

  const renderError = (msg) => res.render('material_new', { teacher: req.teacher, batch, error: msg });

  if (!title || !title.trim()) return renderError('Give it a title.');

  if (mode === 'blank') {
    const info = db
      .prepare('INSERT INTO materials (teacher_id, batch_id, type, title, chapter, content_json) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.teacher.id, batch.id, materialType, title.trim(), (chapter || '').trim(), '[]');
    return res.redirect(`/materials/${info.lastInsertRowid}/edit`);
  }

  const limitCheck = checkAiLimit(req.teacher);
  if (!limitCheck.allowed) {
    return renderError(`You've used all ${limitCheck.limit} AI generations for this month. It resets next month, or ask your admin to raise the limit.`);
  }

  let topicText = (source_text || '').trim();
  const pdfFile = req.files && req.files.source_pdf && req.files.source_pdf[0];
  const imageFile = req.files && req.files.source_image && req.files.source_image[0];

  if (pdfFile) {
    try {
      const pdfText = await extractTextFromPdf(pdfFile.buffer);
      if (!pdfText) return renderError('Could not extract any text from that PDF — try uploading a photo of the page instead.');
      topicText = topicText ? `${topicText}\n\n${pdfText}` : pdfText;
    } catch (err) {
      return renderError(`Could not read that PDF: ${err.message}`);
    }
  }
  if (imageFile) {
    try {
      const imageText = await extractTextFromImage(imageFile.buffer);
      if (!imageText) return renderError('Could not recognize any text in that image — try a clearer, well-lit photo.');
      topicText = topicText ? `${topicText}\n\n${imageText}` : imageText;
    } catch (err) {
      return renderError(`Could not read that image: ${err.message}`);
    }
  }
  if (!topicText) return renderError('Paste some source text, upload a PDF or photo, or choose "Start blank".');

  try {
    const content = await generateMaterial({ type: materialType, topicText, chapterLabel: (chapter || '').trim() });
    if (!content.length) return renderError('The AI response could not be parsed. Try again or shorten the text.');
    const info = db
      .prepare('INSERT INTO materials (teacher_id, batch_id, type, title, chapter, content_json) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.teacher.id, batch.id, materialType, title.trim(), (chapter || '').trim(), JSON.stringify(content));
    recordAiUsage(req.teacher.id);
    res.redirect(`/materials/${info.lastInsertRowid}/edit`);
  } catch (err) {
    console.error('Material generation failed:', err.message);
    renderError(`AI generation failed: ${err.message}`);
  }
});

router.post('/materials/:id/items', requireTeacher, (req, res) => {
  const material = loadMaterialOr404(req, res);
  if (!material) return;

  const content = material.content;
  if (material.type === 'slides') {
    const title = (req.body.title || '').trim();
    if (!title) return res.redirect(`/materials/${material.id}/edit`);
    const bullets = (req.body.bullets || '')
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean);
    content.push({ title, bullets });
  } else {
    const heading = (req.body.heading || '').trim();
    const body = (req.body.body || '').trim();
    if (!heading || !body) return res.redirect(`/materials/${material.id}/edit`);
    content.push({ heading, body });
  }
  db.prepare('UPDATE materials SET content_json = ? WHERE id = ?').run(JSON.stringify(content), material.id);
  res.redirect(`/materials/${material.id}/edit`);
});

router.post('/materials/:id/items/:index/delete', requireTeacher, (req, res) => {
  const material = loadMaterialOr404(req, res);
  if (!material) return;
  const idx = parseInt(req.params.index, 10);
  const content = material.content.filter((_, i) => i !== idx);
  db.prepare('UPDATE materials SET content_json = ? WHERE id = ?').run(JSON.stringify(content), material.id);
  res.redirect(`/materials/${material.id}/edit`);
});

router.get('/materials/:id/edit', requireTeacher, (req, res) => {
  const material = loadMaterialOr404(req, res);
  if (!material) return;
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(material.batch_id);
  res.render('material_edit', { teacher: req.teacher, material, batch });
});

router.post('/materials/:id/share', requireTeacher, (req, res) => {
  const material = loadMaterialOr404(req, res);
  if (!material) return;
  db.prepare('UPDATE materials SET shared = 1 WHERE id = ?').run(material.id);
  res.redirect(`/materials/${material.id}/edit`);
});

router.post('/materials/:id/unshare', requireTeacher, (req, res) => {
  const material = loadMaterialOr404(req, res);
  if (!material) return;
  db.prepare('UPDATE materials SET shared = 0 WHERE id = ?').run(material.id);
  res.redirect(`/materials/${material.id}/edit`);
});

router.post('/materials/:id/delete', requireTeacher, (req, res) => {
  const material = loadMaterialOr404(req, res);
  if (!material) return;
  db.prepare('DELETE FROM materials WHERE id = ?').run(material.id);
  res.redirect(`/batches/${material.batch_id}`);
});

router.get('/materials/:id/download', requireTeacher, async (req, res) => {
  const material = loadMaterialOr404(req, res);
  if (!material) return;
  try {
    const buffer = await generateMaterialPdf(material);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${material.title.replace(/[^a-z0-9]+/gi, '_')}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('PDF generation failed:', err.message);
    res.status(500).send('Could not generate PDF: ' + err.message);
  }
});

router.post('/batches/:batchId/students/:studentId/practice', requireTeacher, async (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');
  const student = db.prepare('SELECT * FROM students WHERE id = ? AND batch_id = ?').get(req.params.studentId, batch.id);
  if (!student) return res.status(404).send('Student not found');

  const chapter = (req.body.chapter || '').trim();
  if (!chapter) return res.redirect(`/batches/${batch.id}/students/${student.id}?practiceError=No%20chapter%20specified`);

  const limitCheck = checkAiLimit(req.teacher);
  if (!limitCheck.allowed) {
    return res.redirect(
      `/batches/${batch.id}/students/${student.id}?practiceError=${encodeURIComponent(`You've used all ${limitCheck.limit} AI generations for this month.`)}`
    );
  }

  try {
    const content = await generateMaterial({
      type: 'notes',
      topicText: `Chapter: ${chapter}. Create a short self-study practice set for a student who is struggling with this chapter: 4 to 5 practice questions typical of this chapter, each immediately followed by its correct answer and a one-line explanation, at a level suitable for revision.`,
      chapterLabel: chapter
    });

    const info = db
      .prepare('INSERT INTO materials (teacher_id, batch_id, type, title, chapter, content_json, shared) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .run(req.teacher.id, batch.id, 'notes', `Practice: ${chapter} (for ${student.name})`, chapter, JSON.stringify(content));

    db.prepare('INSERT INTO practice_recommendations (student_id, material_id, chapter) VALUES (?, ?, ?)').run(
      student.id,
      info.lastInsertRowid,
      chapter
    );
    recordAiUsage(req.teacher.id);

    res.redirect(`/batches/${batch.id}/students/${student.id}?practiceGenerated=1`);
  } catch (err) {
    res.redirect(`/batches/${batch.id}/students/${student.id}?practiceError=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
