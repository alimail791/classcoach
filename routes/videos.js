// YouTube video lessons: a teacher pastes a YouTube link on a class page,
// and every student in that class can watch it from their dashboard.
const express = require('express');
const db = require('../lib/db');
const { requireTeacher, requireStudent } = require('../lib/auth');
const { parseYouTubeId } = require('../lib/youtube');
const { notifyAllStudentsInBatch } = require('../lib/notifications');

const router = express.Router();

function back(batchId, key, value) {
  return `/batches/${batchId}?${key}=${encodeURIComponent(value)}#videos`;
}

router.post('/batches/:batchId/videos', requireTeacher, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(req.params.batchId, req.teacher.id);
  if (!batch) return res.status(404).send('Batch not found');

  const youtubeId = parseYouTubeId(req.body.url);
  if (!youtubeId) return res.redirect(back(batch.id, 'video_error', 'That doesn’t look like a YouTube video link. Copy it from the Share button on YouTube and try again.'));
  const title = String(req.body.title || '').trim().slice(0, 150);
  if (!title) return res.redirect(back(batch.id, 'video_error', 'Give the video lesson a title.'));
  const chapter = String(req.body.chapter || '').trim().slice(0, 100);
  const note = String(req.body.note || '').trim().slice(0, 500);

  db.prepare('INSERT INTO video_lessons (teacher_id, batch_id, title, chapter, youtube_id, note) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.teacher.id,
    batch.id,
    title,
    chapter,
    youtubeId,
    note
  );
  notifyAllStudentsInBatch(batch.id, `New video lesson: ${title}${chapter ? ` (${chapter})` : ''}. Watch it from your dashboard.`, req.teacher.name);
  res.redirect(back(batch.id, 'video', 'added'));
});

router.post('/videos/:id/delete', requireTeacher, (req, res) => {
  const video = db.prepare('SELECT * FROM video_lessons WHERE id = ? AND teacher_id = ?').get(req.params.id, req.teacher.id);
  if (!video) return res.status(404).send('Video lesson not found');
  db.prepare('DELETE FROM video_lessons WHERE id = ?').run(video.id);
  res.redirect(back(video.batch_id, 'video', 'removed'));
});

router.get('/student/videos/:id', requireStudent, (req, res) => {
  const video = db.prepare('SELECT * FROM video_lessons WHERE id = ? AND batch_id = ?').get(req.params.id, req.student.batch_id);
  if (!video) return res.status(404).send('Not found');
  const others = db
    .prepare('SELECT * FROM video_lessons WHERE batch_id = ? AND id != ? ORDER BY created_at DESC LIMIT 6')
    .all(req.student.batch_id, video.id);
  res.render('student_video', { student: req.student, video, others });
});

module.exports = router;
