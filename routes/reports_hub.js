const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const { buildReportData } = require('../lib/reportData');

const router = express.Router();

router.get('/reports', requireTeacher, (req, res) => {
  const rows = db
    .prepare(
      `SELECT report_tokens.*, students.name AS student_name, batches.name AS batch_name, tests.title AS test_title
       FROM report_tokens
       JOIN tests ON tests.id = report_tokens.test_id
       JOIN students ON students.id = report_tokens.student_id
       JOIN batches ON batches.id = tests.batch_id
       WHERE tests.teacher_id = ?
       ORDER BY report_tokens.created_at DESC`
    )
    .all(req.teacher.id);

  let preview = null;
  const selectedToken = req.query.token || (rows[0] && rows[0].token) || null;
  if (selectedToken) {
    const tokenRow = db.prepare('SELECT * FROM report_tokens WHERE token = ?').get(selectedToken);
    if (tokenRow) {
      const owns = db.prepare('SELECT id FROM tests WHERE id = ? AND teacher_id = ?').get(tokenRow.test_id, req.teacher.id);
      if (owns) preview = buildReportData(tokenRow);
    }
  }

  res.render('reports_hub', { teacher: req.teacher, rows, selectedToken, preview });
});

module.exports = router;
