const express = require('express');
const db = require('../lib/db');
const { buildReportData } = require('../lib/reportData');

const router = express.Router();

router.get('/r/:token', (req, res) => {
  const tokenRow = db.prepare('SELECT * FROM report_tokens WHERE token = ?').get(req.params.token);
  if (!tokenRow) return res.status(404).send('This report link is not valid.');

  const data = buildReportData(tokenRow);
  if (!data) return res.status(404).send('No result recorded yet for this test.');

  res.render('report_public', data);
});

module.exports = router;
