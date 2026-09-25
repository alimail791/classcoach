require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SqliteSessionStore = require('./lib/sessionStore');
const path = require('path');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const testRoutes = require('./routes/tests');
const materialRoutes = require('./routes/materials');
const trackingRoutes = require('./routes/tracking');
const studentRoutes = require('./routes/student');
const parentRoutes = require('./routes/parent');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const joinRoutes = require('./routes/join');
const reportPublicRoutes = require('./routes/report_public');
const reportsHubRoutes = require('./routes/reports_hub');

const app = express();

// Railway (and most hosts) terminate HTTPS at their own edge, then forward
// requests to this container over plain HTTP internally. Without this,
// req.protocol always reports "http" no matter how the visitor actually
// connected — which silently put http:// links into verification emails,
// password resets, report shares, referral links, and the canonical/OG
// tags on the homepage. This tells Express to trust the X-Forwarded-Proto
// header the proxy sets, so req.protocol reports the real, original scheme.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new SqliteSessionStore(),
    secret: process.env.SESSION_SECRET || 'classcoach-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
  })
);

app.get('/', (req, res) => {
  if (req.session.teacherId) return res.redirect('/dashboard');
  if (req.session.studentId) return res.redirect('/student/dashboard');
  if (req.session.parentStudentId) return res.redirect('/parent/dashboard');
  const canonicalUrl = `${req.protocol}://${req.get('host')}/`;
  res.render('home', {
    indexable: true,
    canonicalUrl,
    description:
      'ClassCoach helps individual teachers and small coaching classes create AI-generated tests, auto-grade objective answers, track chapter-wise weaknesses, and share results with parents.'
  });
});

app.get('/robots.txt', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /$',
      'Disallow: /dashboard',
      'Disallow: /batches',
      'Disallow: /tests',
      'Disallow: /materials',
      'Disallow: /students',
      'Disallow: /classes',
      'Disallow: /reports',
      'Disallow: /question-bank',
      'Disallow: /settings',
      'Disallow: /admin',
      'Disallow: /student',
      'Disallow: /parent',
      'Disallow: /login',
      'Disallow: /signup',
      'Disallow: /forgot-password',
      'Disallow: /reset-password',
      'Disallow: /verify-email',
      `Sitemap: ${base}/sitemap.xml`
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${base}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`
  );
});

app.get('/unsubscribe', (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim();
  const token = req.query.token || '';
  const { verifyUnsubscribeToken } = require('./lib/unsubscribe');

  if (!verifyUnsubscribeToken(email, token)) {
    return res.status(400).send('<p>This unsubscribe link is invalid or has expired.</p>');
  }

  const db = require('./lib/db');
  db.prepare("UPDATE email_leads SET status = 'unsubscribed' WHERE email = ?").run(email);
  res.send(`<!doctype html><html><head><title>Unsubscribed — ClassCoach</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center;"><h1>You're unsubscribed</h1><p>${email} won't receive any further emails from ClassCoach.</p></body></html>`);
});

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', testRoutes);
app.use('/', materialRoutes);
app.use('/', trackingRoutes);
app.use('/', studentRoutes);
app.use('/', parentRoutes);
app.use('/', adminRoutes);
app.use('/', paymentRoutes);
app.use('/', joinRoutes);
app.use('/', reportPublicRoutes);
app.use('/', reportsHubRoutes);

app.use((req, res) => {
  res.status(404).send('Page not found. <a href="/">Go home</a>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ClassCoach running at http://localhost:${PORT}`);
});
