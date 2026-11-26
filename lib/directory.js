// Tutor & coaching directory: classcoach.in/tutors → /tutors/<city> → /tutors/<city>/<slug>.
// ClassCoach teachers opt in from Website widgets → "Get listed". Each profile has
// "Join class" buttons (their batches) and, if they allow it, a WhatsApp button —
// so the listing brings them students, which is the reason to sign up.
// Tutors who tick "I teach NEET" are also listed on www.yneet.in/neet-coaching/<city>
// (lib/yneet.js → directoryListing), so one form fills both directories.
const db = require('./db');
const yneet = require('./yneet');

const SITE = process.env.SITE_ORIGIN || 'https://www.classcoach.in';
const MIN_CITY_TO_INDEX = 3; // thin city pages stay noindex until they're worth a search result
const KINDS = { tutor: 'Home / private tutor', coaching: 'Coaching centre', school: 'School' };
const MODES = { online: 'Online', offline: 'In person', both: 'Online & in person' };

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const clean = (s, max) => String(s || '').replace(/[<>`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanAbout = (s) => String(s || '').replace(/[<>`\\]/g, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 600);

const LISTED = "dir_listed = 1 AND active = 1 AND dir_city_slug <> '' AND dir_slug <> ''";
const COLS = 'id, dir_slug, dir_kind, dir_display_name, name, dir_city, dir_city_slug, dir_area, dir_subjects, dir_classes, dir_mode, dir_about, dir_neet, dir_whatsapp, phone, dir_views';

const cities = () =>
  db.prepare(`SELECT dir_city_slug AS slug, MAX(dir_city) AS city, COUNT(*) AS n FROM teachers WHERE ${LISTED} GROUP BY dir_city_slug ORDER BY n DESC, city`).all();

const inCity = (citySlug) =>
  db.prepare(`SELECT ${COLS} FROM teachers WHERE ${LISTED} AND dir_city_slug = ? ORDER BY dir_views DESC, id`).all(citySlug);

const profile = (citySlug, slug) => db.prepare(`SELECT ${COLS} FROM teachers WHERE ${LISTED} AND dir_city_slug = ? AND dir_slug = ?`).get(citySlug, slug);

const batchesOf = (teacherId) =>
  db.prepare('SELECT name, subject, join_code FROM batches WHERE teacher_id = ? AND join_code IS NOT NULL ORDER BY name LIMIT 12').all(teacherId);

const displayName = (t) => t.dir_display_name || t.name;
const profileUrl = (t) => `${SITE}/tutors/${t.dir_city_slug}/${t.dir_slug}`;

function uniqueSlug(teacher, name, citySlug) {
  const base = slugify(name) || 'tutor';
  let slug = base;
  for (let n = 2; db.prepare('SELECT 1 FROM teachers WHERE dir_city_slug = ? AND dir_slug = ? AND id <> ?').get(citySlug, slug, teacher.id); n++) slug = `${base}-${n}`;
  return slug;
}

// Save the form. Returns { error } or { ok, yneet: 'listed'|'unlisted'|'off'|'failed'|'' }.
async function save(teacher, body) {
  const listed = body.dir_listed === '1';
  const name = clean(body.dir_display_name, 60) || teacher.name;
  const city = clean(body.dir_city, 40).replace(/\b([a-z])/g, (c) => c.toUpperCase()); // salem → Salem, so one city reads the same everywhere
  const citySlug = slugify(city);
  const kind = KINDS[body.dir_kind] ? body.dir_kind : 'tutor';
  const mode = MODES[body.dir_mode] ? body.dir_mode : '';
  const subjects = clean(body.dir_subjects, 120);
  const classes = clean(body.dir_classes, 80);
  const about = cleanAbout(body.dir_about);
  const neet = body.dir_neet === '1' ? 1 : 0;
  const whatsapp = body.dir_whatsapp === '1' ? 1 : 0;
  const area = clean(body.dir_area, 60);

  if (listed) {
    if (!citySlug) return { error: 'Enter your city.' };
    if (!subjects) return { error: 'Enter the subjects you teach.' };
    if (whatsapp && String(teacher.phone || '').replace(/\D/g, '').length < 10) return { error: 'Add your WhatsApp number in Settings to show a WhatsApp button.' };
  }
  const slug = citySlug && (teacher.dir_city_slug !== citySlug || !teacher.dir_slug || slugify(displayName(teacher)) !== slugify(name)) ? uniqueSlug(teacher, name, citySlug) : teacher.dir_slug;

  db.prepare(
    `UPDATE teachers SET dir_listed = ?, dir_slug = ?, dir_kind = ?, dir_display_name = ?, dir_city = ?, dir_city_slug = ?, dir_area = ?,
       dir_subjects = ?, dir_classes = ?, dir_mode = ?, dir_about = ?, dir_neet = ?, dir_whatsapp = ?, dir_updated_at = datetime('now') WHERE id = ?`
  ).run(listed ? 1 : 0, slug || '', kind, name === teacher.name ? '' : name, city, citySlug, area, subjects, classes, mode, about, neet, whatsapp, teacher.id);

  // Mirror NEET tutors to YNeet's NEET coaching directory (best-effort).
  let yn = '';
  const wasOnYneet = !!(teacher.dir_listed && teacher.dir_neet);
  const onYneet = listed && neet;
  if (onYneet || wasOnYneet) {
    if (!yneet.enabled()) yn = 'off';
    else {
      const t = db.prepare('SELECT * FROM teachers WHERE id = ?').get(teacher.id);
      try {
        await yneet.directoryListing({
          classcoachId: t.id, listed: Boolean(onYneet), name: displayName(t), phone: t.phone, city: t.dir_city,
          kind: t.dir_kind === 'coaching' ? 'coaching' : 'teacher', profileUrl: profileUrl(t),
        });
        yn = onYneet ? 'listed' : 'unlisted';
      } catch (e) {
        console.warn('YNeet directory sync failed:', e.message);
        yn = 'failed';
      }
    }
  }
  return { ok: true, yneet: yn };
}

// Sitemap: cities with enough listings, and every listed profile in them.
function sitemapUrls() {
  const out = [];
  const big = cities().filter((c) => c.n >= MIN_CITY_TO_INDEX);
  if (big.length) out.push({ loc: `${SITE}/tutors`, freq: 'weekly', pri: '0.6' });
  big.forEach((c) => {
    out.push({ loc: `${SITE}/tutors/${c.slug}`, freq: 'weekly', pri: '0.6' });
    inCity(c.slug).forEach((t) => out.push({ loc: profileUrl(t), freq: 'monthly', pri: '0.5' }));
  });
  return out;
}

module.exports = { SITE, KINDS, MODES, MIN_CITY_TO_INDEX, cities, inCity, profile, batchesOf, displayName, profileUrl, save, sitemapUrls, slugify };
