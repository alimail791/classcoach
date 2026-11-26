// Public tutor & coaching directory (see lib/directory.js) and the teacher's "Get listed" form.
const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const D = require('../lib/directory');

const router = express.Router();
const waLink = (phone, text) => `https://wa.me/91${String(phone).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`;

router.post('/widgets/listing', requireTeacher, async (req, res, next) => {
  try {
    const r = await D.save(req.teacher, req.body);
    if (r.error) return res.redirect(`/widgets?listing_error=${encodeURIComponent(r.error)}#listing`);
    res.redirect(`/widgets?listing=saved&yneet=${r.yneet}#listing`);
  } catch (e) {
    next(e);
  }
});

router.get('/tutors', (req, res) => {
  const cities = D.cities();
  const total = cities.reduce((n, c) => n + c.n, 0);
  res.render('tutors_index', {
    cities,
    indexable: cities.some((c) => c.n >= D.MIN_CITY_TO_INDEX),
    canonicalUrl: `${D.SITE}/tutors`,
    title: 'Find Tutors and Coaching Centres Near You, City by City | ClassCoach',
    description: `Home tutors, coaching centres and schools that use ClassCoach for online tests and progress reports${total ? ` — ${total} listed` : ''}. Find one in your city and join their class.`,
  });
});

router.get('/tutors/:city', (req, res) => {
  const citySlug = D.slugify(req.params.city);
  const list = D.inCity(citySlug);
  const city = list.length ? list[0].dir_city : req.params.city.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  res.status(list.length ? 200 : 404).render('tutors_city', {
    list, city, citySlug, D,
    indexable: list.length >= D.MIN_CITY_TO_INDEX,
    canonicalUrl: `${D.SITE}/tutors/${citySlug}`,
    title: list.length ? `Tutors & Coaching Centres in ${city} (${list.length}) — Join a Class | ClassCoach` : `Tutors in ${city} | ClassCoach`,
    description: `${list.length || 'Find'} tutors and coaching centres in ${city} for school subjects, NEET and JEE. Each gives students online tests marked instantly and progress reports for parents.`,
  });
});

router.get('/tutors/:city/:slug', (req, res) => {
  const t = D.profile(D.slugify(req.params.city), String(req.params.slug).toLowerCase());
  if (!t) return res.redirect(302, `/tutors/${D.slugify(req.params.city)}`);
  db.prepare('UPDATE teachers SET dir_views = dir_views + 1 WHERE id = ?').run(t.id);
  const name = D.displayName(t);
  const cityCount = D.inCity(t.dir_city_slug).length;
  res.render('tutor_profile', {
    t, name, D,
    batches: D.batchesOf(t.id),
    wa: t.dir_whatsapp && t.phone ? waLink(t.phone, `Hi ${name}, I found you on ClassCoach. I'd like to know about your classes.`) : '',
    indexable: cityCount >= D.MIN_CITY_TO_INDEX && t.dir_about.length >= 40,
    canonicalUrl: D.profileUrl(t),
    title: `${name} — ${t.dir_subjects} ${D.KINDS[t.dir_kind] === 'Coaching centre' ? 'coaching' : 'tutor'} in ${t.dir_area ? t.dir_area + ', ' : ''}${t.dir_city} | ClassCoach`,
    description: `${name} teaches ${t.dir_subjects}${t.dir_classes ? ` (${t.dir_classes})` : ''} in ${t.dir_city}. Join the class online — tests are marked instantly and parents get progress reports.`,
  });
});

module.exports = router;
