const PDFDocument = require('pdfkit');

function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

async function generateMaterialPdf(material) {
  const doc = new PDFDocument({ margin: 50 });
  const bufferPromise = streamToBuffer(doc);

  doc.fontSize(20).text(material.title, { align: 'left' });
  if (material.chapter) doc.fontSize(11).fillColor('#7A6E5C').text(material.chapter);
  doc.moveDown();
  doc.fillColor('#211C15');

  if (material.type === 'slides') {
    material.content.forEach((slide, i) => {
      if (i > 0) doc.addPage();
      doc.fontSize(18).text(slide.title, { underline: i === 0 });
      doc.moveDown(0.5);
      (slide.bullets || []).forEach((b) => {
        doc.fontSize(13).text(`•  ${b}`, { indent: 20 });
        doc.moveDown(0.2);
      });
    });
  } else {
    material.content.forEach((section) => {
      doc.fontSize(15).text(section.heading);
      doc.moveDown(0.2);
      doc.fontSize(12).fillColor('#4A4032').text(section.body, { align: 'justify' });
      doc.fillColor('#211C15');
      doc.moveDown();
    });
  }

  doc.end();
  return bufferPromise;
}

// includeAnswers: mark correct MCQ options and show max marks for descriptive.
// When false (student-facing question paper), no answers are revealed.
async function generateTestPdf(test, questions, { includeAnswers } = {}) {
  const doc = new PDFDocument({ margin: 50 });
  const bufferPromise = streamToBuffer(doc);

  doc.fontSize(20).text(test.title);
  if (test.chapter) doc.fontSize(11).fillColor('#7A6E5C').text(test.chapter);
  doc.fillColor('#211C15');
  doc.fontSize(10).fillColor('#7A6E5C').text(`${test.duration_minutes} minutes · ${questions.length} questions`);
  doc.fillColor('#211C15');
  doc.moveDown();

  questions.forEach((q, i) => {
    doc.fontSize(13).text(`${i + 1}. ${q.text}`);
    doc.moveDown(0.3);
    if (q.type === 'mcq') {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      q.options.forEach((opt, oi) => {
        const isCorrect = includeAnswers && oi === q.correct_index;
        doc.fontSize(11).fillColor(isCorrect ? '#34502E' : '#211C15').text(`   ${letters[oi]}. ${opt}${isCorrect ? '  ✓' : ''}`);
      });
      doc.fillColor('#211C15');
    } else {
      const marksNote = includeAnswers ? `  (${q.max_marks} marks)` : `  (${q.max_marks} marks)`;
      doc.fontSize(10).fillColor('#7A6E5C').text(marksNote);
      doc.fillColor('#211C15');
      doc.moveDown(2); // blank space for a written answer
    }
    doc.moveDown();
  });

  doc.end();
  return bufferPromise;
}

module.exports = { generateMaterialPdf, generateTestPdf };
