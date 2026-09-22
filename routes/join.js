const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db');
const { effectiveMaxStudents, isPlanActive } = require('../lib/plans');

const router = express.Router();

router.get('/join', (req, res) => {
  res.render('join_lookup', { error: null });
});

router.post('/join', (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  const batch = db.prepare('SELECT * FROM batches WHERE join_code = ?').get(code);
  if (!batch) return res.render('join_lookup', { error: "That class code wasn't found. Double-check it with your teacher." });
  res.redirect(`/join/${code}`);
});

router.get('/join/:code', (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE join_code = ?').get(req.params.code.toUpperCase());
  if (!batch) return res.render('join_lookup', { error: "That class code wasn't found. Double-check it with your teacher." });
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(batch.teacher_id);
  res.render('join_form', { batch, teacher, error: null });
});

router.post('/join/:code', (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE join_code = ?').get(req.params.code.toUpperCase());
  if (!batch) return res.render('join_lookup', { error: "That class code wasn't found. Double-check it with your teacher." });
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(batch.teacher_id);

  const { name, roll_no, phone, parent_name, parent_phone, parent_contact } = req.body;
  const renderError = (msg) => res.render('join_form', { batch, teacher, error: msg });

  if (!name || !roll_no || !phone || !parent_phone || !parent_contact) {
    return renderError('Name, roll number, your phone number, parent phone, and parent email are all required.');
  }

  const totalStudents = db
    .prepare(
      `SELECT COUNT(*) AS c FROM students
       JOIN batches ON batches.id = students.batch_id
       WHERE batches.teacher_id = ?`
    )
    .get(teacher.id).c;
  const maxStudents = effectiveMaxStudents(teacher, totalStudents);
  if (totalStudents >= maxStudents) {
    return renderError("This teacher's class is full right now — ask them to make room or raise their plan limit.");
  }
  if (!isPlanActive(teacher)) {
    return renderError("This teacher's plan isn't active right now — ask them to renew before new students can join.");
  }

  const pin = crypto.randomInt(1000, 9999).toString();
  const parentPin = crypto.randomInt(1000, 9999).toString();
  try {
    const info = db
      .prepare(
        'INSERT INTO students (batch_id, name, roll_no, pin, parent_pin, phone, parent_name, parent_phone, parent_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        batch.id,
        name.trim(),
        roll_no.trim(),
        pin,
        parentPin,
        phone.trim(),
        (parent_name || '').trim(),
        parent_phone.trim(),
        parent_contact.trim()
      );
    res.render('join_success', {
      batch,
      teacher,
      name: name.trim(),
      rollNo: roll_no.trim(),
      pin,
      parentPin,
      studentId: info.lastInsertRowid
    });
  } catch (e) {
    renderError('That roll number is already taken in this class — check with your teacher for the right one.');
  }
});

module.exports = router;
