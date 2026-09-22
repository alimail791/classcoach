const db = require('./db');

function notify(recipientType, recipientId, message, senderLabel = '') {
  db.prepare('INSERT INTO notifications (recipient_type, recipient_id, sender_label, message) VALUES (?, ?, ?, ?)').run(
    recipientType,
    recipientId,
    senderLabel,
    message
  );
}

function notifyAllStudentsInBatch(batchId, message, senderLabel) {
  const students = db.prepare('SELECT id FROM students WHERE batch_id = ?').all(batchId);
  students.forEach((s) => notify('student', s.id, message, senderLabel));
}

function notifyAllParentsInBatch(batchId, message, senderLabel) {
  const students = db.prepare('SELECT id FROM students WHERE batch_id = ?').all(batchId);
  students.forEach((s) => notify('parent', s.id, message, senderLabel));
}

function getFor(recipientType, recipientId, limit = 20) {
  return db
    .prepare(
      'SELECT * FROM notifications WHERE recipient_type = ? AND recipient_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(recipientType, recipientId, limit);
}

function unreadCountFor(recipientType, recipientId) {
  return db
    .prepare('SELECT COUNT(*) AS c FROM notifications WHERE recipient_type = ? AND recipient_id = ? AND read_at IS NULL')
    .get(recipientType, recipientId).c;
}

function markAllRead(recipientType, recipientId) {
  db.prepare(
    "UPDATE notifications SET read_at = datetime('now') WHERE recipient_type = ? AND recipient_id = ? AND read_at IS NULL"
  ).run(recipientType, recipientId);
}

module.exports = { notify, notifyAllStudentsInBatch, notifyAllParentsInBatch, getFor, unreadCountFor, markAllRead };
