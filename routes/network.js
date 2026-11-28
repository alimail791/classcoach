// Raise network pages (see lib/network.js):
//   /fees                      collect batch fees with VasulBook (dues, WhatsApp reminders, UPI)
//   /testmandi                 sell your tests on TestMandi + find worksheets/notes/tests for your class
//   /tests/:id/sell            publish one ClassCoach test on TestMandi (80% of each sale is yours)
const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const net = require('../lib/network');

const router = express.Router();
const friendly = (e, what) => (e.status && e.status < 500 ? e.message : `Could not reach ${what} right now. Please try again in a minute.`);
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const batchesOf = (teacherId) =>
  db
    .prepare('SELECT b.*, (SELECT COUNT(*) FROM students s WHERE s.batch_id = b.id) AS students FROM batches b WHERE b.teacher_id = ? ORDER BY b.id')
    .all(teacherId);
const studentsOf = (batchId) => db.prepare('SELECT * FROM students WHERE batch_id = ? ORDER BY name').all(batchId);
const ownBatch = (teacher, id) => db.prepare('SELECT * FROM batches WHERE id = ? AND teacher_id = ?').get(Number(id), teacher.id);
const studentRef = (s) => `s${s.id}`;
const contactPhone = (s) => String(s.parent_phone || s.phone || '').replace(/\D/g, '').slice(-10);

/* ------------------------------------------------------------------ */
/* Fees via VasulBook                                                  */
/* ------------------------------------------------------------------ */
async function renderFees(req, res, extra = {}) {
  const t = req.teacher;
  const batches = batchesOf(t.id);
  let balances = null;
  let plan = null;
  if (t.vasulbook_linked && net.vasulbookOn()) {
    try {
      const d = await net.vbBalances(t.email);
      balances = { totals: d.totals, byRef: Object.fromEntries(d.students.map((s) => [s.ref, s])) };
      plan = d.plan;
    } catch (e) {
      extra.error = extra.error || friendly(e, 'VasulBook');
    }
  }
  const selected = req.query.batch ? ownBatch(t, req.query.batch) : batches[0];
  const students = selected ? studentsOf(selected.id) : [];
  const runs = selected ? db.prepare('SELECT * FROM fee_runs WHERE batch_id = ? ORDER BY id DESC LIMIT 12').all(selected.id) : [];
  res.render('fees', {
    teacher: t,
    on: net.vasulbookOn(),
    linked: !!t.vasulbook_linked,
    batches,
    selected,
    students,
    runs,
    balances,
    plan,
    inr,
    studentRef,
    contactPhone,
    vbSite: net.utm(net.VB_SITE(), 'fees'),
    error: null,
    notice: req.query.ok || null,
    ...extra,
  });
}

router.get('/fees', requireTeacher, (req, res, next) => renderFees(req, res).catch(next));

router.post('/fees/link', requireTeacher, async (req, res, next) => {
  try {
    if (!net.vasulbookOn()) return renderFees(req, res, { error: 'Fee collection is not switched on yet. Please try again later.' });
    if (!req.teacher.email_verified) return renderFees(req, res, { error: 'Verify your email in Settings first — your VasulBook account uses the same email.' });
    let d;
    try {
      d = await net.vbAccount(req.teacher);
    } catch (e) {
      return renderFees(req, res, { error: friendly(e, 'VasulBook') });
    }
    db.prepare('UPDATE teachers SET vasulbook_linked = 1 WHERE id = ?').run(req.teacher.id);
    req.teacher.vasulbook_linked = 1;
    // Bring every class's students across straight away.
    for (const b of batchesOf(req.teacher.id)) await syncBatch(req.teacher, b).catch(() => {});
    return renderFees(req, res, {
      notice: d.created
        ? 'Fee collection is on! Your free VasulBook account is ready and your students are added. Add a fee below, then send reminders from VasulBook.'
        : 'Linked your existing VasulBook account and added your students.',
    });
  } catch (e) {
    next(e);
  }
});

async function syncBatch(teacher, batch) {
  const list = studentsOf(batch.id).map((s) => ({ ref: studentRef(s), name: `${s.name}${batch.name ? ` (${batch.name})` : ''}`.slice(0, 120), phone: contactPhone(s) }));
  if (!list.length) return { added: 0, updated: 0 };
  return net.vbSyncStudents(teacher.email, list);
}

router.post('/fees/sync', requireTeacher, async (req, res, next) => {
  try {
    const b = ownBatch(req.teacher, req.body.batch_id);
    if (!b || !req.teacher.vasulbook_linked) return res.redirect('/fees');
    try {
      const r = await syncBatch(req.teacher, b);
      return res.redirect(`/fees?batch=${b.id}&ok=${encodeURIComponent(`Students updated in VasulBook (${r.added} new, ${r.updated} updated).`)}`);
    } catch (e) {
      req.query.batch = b.id;
      return renderFees(req, res, { error: friendly(e, 'VasulBook') });
    }
  } catch (e) {
    next(e);
  }
});

router.post('/fees/charge', requireTeacher, async (req, res, next) => {
  try {
    const b = ownBatch(req.teacher, req.body.batch_id);
    if (!b || !req.teacher.vasulbook_linked) return res.redirect('/fees');
    req.query.batch = b.id;
    const amount = Math.round(Number(req.body.amount));
    const label = String(req.body.label || '').trim().slice(0, 60);
    const due = /^\d{4}-\d{2}-\d{2}$/.test(req.body.due || '') ? req.body.due : undefined;
    if (!(amount > 0 && amount <= 1000000)) return renderFees(req, res, { error: 'Enter the fee amount per student.' });
    if (!label) return renderFees(req, res, { error: 'Give this fee a name, e.g. "December fees".' });
    if (db.prepare('SELECT 1 FROM fee_runs WHERE batch_id = ? AND label = ?').get(b.id, label)) {
      return renderFees(req, res, { error: `"${label}" was already added for this class. Use a different name for a new fee.` });
    }
    const studs = studentsOf(b.id);
    if (!studs.length) return renderFees(req, res, { error: 'This class has no students yet.' });
    try {
      await syncBatch(req.teacher, b);
      const key = `b${b.id}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'fee'}`;
      const r = await net.vbCharge(req.teacher.email, { key, note: `${label} — ${b.name}`.slice(0, 300), due, charges: studs.map((s) => ({ ref: studentRef(s), amount })) });
      db.prepare('INSERT INTO fee_runs (teacher_id, batch_id, label, amount, students) VALUES (?, ?, ?, ?, ?)').run(req.teacher.id, b.id, label, amount, r.added);
      return res.redirect(`/fees?batch=${b.id}&ok=${encodeURIComponent(`Added ${inr(amount)} "${label}" for ${r.added} students. Open VasulBook to send WhatsApp reminders.`)}`);
    } catch (e) {
      return renderFees(req, res, { error: friendly(e, 'VasulBook') });
    }
  } catch (e) {
    next(e);
  }
});

// One-tap login into vasulbook.com/app with the same account.
router.post('/fees/open', requireTeacher, async (req, res, next) => {
  try {
    if (!req.teacher.vasulbook_linked || !net.vasulbookOn()) return res.redirect(net.VB_SITE());
    try {
      const { url } = await net.vbLoginLink(req.teacher.email);
      return res.redirect(url);
    } catch (e) {
      return renderFees(req, res, { error: friendly(e, 'VasulBook') });
    }
  } catch (e) {
    next(e);
  }
});

/* ------------------------------------------------------------------ */
/* TestMandi: sell tests + find resources                              */
/* ------------------------------------------------------------------ */
function matches(item, words) {
  if (!words.length) return true;
  const hay = [item.title, item.category, item.subject, item.grade, item.resourceType, ...(item.topics || []), ...(item.tags || [])].join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

router.get('/testmandi', requireTeacher, async (req, res, next) => {
  try {
    const t = req.teacher;
    const listings = db
      .prepare('SELECT l.*, x.title FROM testmandi_listings l JOIN tests x ON x.id = l.test_id WHERE l.teacher_id = ? ORDER BY l.updated_at DESC')
      .all(t.id);
    let sales = {};
    if (listings.length && net.testmandiOn()) {
      try {
        const d = await net.tmSummary(t.email);
        sales = Object.fromEntries(d.tests.map((x) => [x.ref, x]));
      } catch (e) {
        console.warn('TestMandi summary failed:', e.message);
      }
    }
    const subjects = [...new Set(batchesOf(t.id).map((b) => b.subject).filter(Boolean))];
    const q = String(req.query.q ?? subjects[0] ?? '').trim().slice(0, 60);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const cat = await net.tmCatalog();
    const resources = cat.resources.filter((r) => matches(r, words)).slice(0, 12);
    const tests = cat.tests.filter((x) => matches(x, words)).slice(0, 12);
    const mcqTests = db
      .prepare(
        `SELECT x.id, x.title, (SELECT COUNT(*) FROM questions q WHERE q.test_id = x.id AND q.type = 'mcq') AS mcq
         FROM tests x WHERE x.teacher_id = ? AND x.id NOT IN (SELECT test_id FROM testmandi_listings) ORDER BY x.id DESC LIMIT 30`
      )
      .all(t.id)
      .filter((x) => x.mcq >= 5);
    res.render('testmandi', {
      teacher: t,
      on: net.testmandiOn(),
      listings,
      sales,
      mcqTests,
      q,
      resources,
      tests,
      resourceUrl: net.tmResourceUrl,
      testUrl: net.tmTestUrl,
      sellerUrl: net.utm(`${net.TM_SITE}/`, 'seller-login'),
      browseUrl: net.utm(`${net.TM_SITE}/`, 'browse-all'),
      inr,
      notice: req.query.ok || null,
    });
  } catch (e) {
    next(e);
  }
});

function loadOwnTest(req) {
  return db.prepare('SELECT * FROM tests WHERE id = ? AND teacher_id = ?').get(Number(req.params.id), req.teacher.id);
}
const mcqOf = (testId) => db.prepare("SELECT * FROM questions WHERE test_id = ? AND type = 'mcq' ORDER BY position, id").all(testId);

async function renderSell(req, res, test, extra = {}) {
  const cat = await net.tmCatalog();
  const listing = db.prepare('SELECT * FROM testmandi_listings WHERE test_id = ?').get(test.id);
  res.render('testmandi_sell', {
    teacher: req.teacher,
    on: net.testmandiOn(),
    test,
    mcqCount: mcqOf(test.id).length,
    categories: cat.categories,
    listing,
    form: { price: listing?.price || 49, category: listing?.category || '', description: '' },
    error: null,
    ...extra,
  });
}

router.get('/tests/:id/sell', requireTeacher, async (req, res, next) => {
  try {
    const test = loadOwnTest(req);
    if (!test) return res.status(404).send('Test not found');
    await renderSell(req, res, test);
  } catch (e) {
    next(e);
  }
});

router.post('/tests/:id/sell', requireTeacher, async (req, res, next) => {
  try {
    const test = loadOwnTest(req);
    if (!test) return res.status(404).send('Test not found');
    const form = { price: Math.round(Number(req.body.price)), category: String(req.body.category || ''), description: String(req.body.description || '').slice(0, 2000) };
    const fail = (error) => renderSell(req, res, test, { form, error });
    if (!net.testmandiOn()) return fail('Selling on TestMandi is not switched on yet. Please try again later.');
    if (!req.teacher.email_verified) return fail('Verify your email in Settings first — your TestMandi seller account uses the same email.');
    if (req.body.own_work !== '1') return fail('Please confirm these questions are your own work (not copied from a book or another site).');
    const qs = mcqOf(test.id);
    if (qs.length < 5) return fail('Add at least 5 multiple-choice questions to this test first. Written questions are not sold on TestMandi.');
    try {
      if (!req.teacher.testmandi_seller) {
        await net.tmSeller(req.teacher);
        db.prepare('UPDATE teachers SET testmandi_seller = 1 WHERE id = ?').run(req.teacher.id);
      }
      const d = await net.tmPublish({
        sellerEmail: req.teacher.email,
        ref: String(test.id),
        title: test.title,
        category: form.category,
        price: form.price,
        duration: test.duration_minutes || 30,
        description: form.description || `${qs.length}-question practice test${test.chapter ? ` on ${test.chapter}` : ''} by ${req.teacher.name}, made with ClassCoach.`,
        questions: qs.map((q) => ({ text: q.text, options: JSON.parse(q.options_json || '[]'), correct: q.correct_index, topic: q.chapter || test.chapter || '' })),
      });
      db.prepare(
        `INSERT INTO testmandi_listings (test_id, teacher_id, tm_test_id, url, price, category, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(test_id) DO UPDATE SET tm_test_id = excluded.tm_test_id, url = excluded.url, price = excluded.price, category = excluded.category, updated_at = excluded.updated_at`
      ).run(test.id, req.teacher.id, d.test.id, d.url, form.price, form.category);
      const msg = d.created
        ? `"${test.title}" is live on TestMandi at ${inr(form.price)}. Check your email to set your TestMandi password and add bank details for payouts.`
        : `"${test.title}" updated on TestMandi.`;
      return res.redirect(`/testmandi?ok=${encodeURIComponent(msg)}`);
    } catch (e) {
      return fail(friendly(e, 'TestMandi'));
    }
  } catch (e) {
    next(e);
  }
});

module.exports = router;
