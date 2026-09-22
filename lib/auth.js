const db = require('./db');

// Tells the browser never to cache an authenticated page. Without this,
// clicking the browser's back button after logging out can show a
// stale cached copy of a dashboard instead of properly re-checking the
// session and redirecting to login — a real privacy/security gap on a
// shared or public computer.
function noCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function requireTeacher(req, res, next) {
  noCache(res);
  if (!req.session.teacherId) return res.redirect('/login');
  req.teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.session.teacherId);
  if (!req.teacher || !req.teacher.active) {
    req.session.teacherId = null;
    return res.redirect('/login');
  }
  next();
}

// The admin dashboard is a completely separate login from teacher
// accounts — its own password, checked against ADMIN_EMAIL /
// ADMIN_PASSWORD in .env. It is not tied to any teacher record.
function requireAdminSession(req, res, next) {
  noCache(res);
  if (!req.session.isAdminSession) return res.redirect('/admin/login');
  next();
}

function requireStudent(req, res, next) {
  noCache(res);
  if (!req.session.studentId) return res.redirect('/student/login');
  req.student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.session.studentId);
  if (!req.student) {
    req.session.studentId = null;
    return res.redirect('/student/login');
  }
  next();
}

function requireParent(req, res, next) {
  noCache(res);
  if (!req.session.parentStudentId) return res.redirect('/parent/login');
  req.parentStudent = db.prepare('SELECT * FROM students WHERE id = ?').get(req.session.parentStudentId);
  if (!req.parentStudent) {
    req.session.parentStudentId = null;
    return res.redirect('/parent/login');
  }
  next();
}

module.exports = { requireTeacher, requireStudent, requireParent, requireAdminSession };
