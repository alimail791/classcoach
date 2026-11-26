// "YNeet for your students" page: free NEET practice link, YNeet logins for a
// tutor's own batch, and the YNeet partner (commission) program. See lib/yneet.js.
const express = require('express');
const db = require('../lib/db');
const { requireTeacher } = require('../lib/auth');
const yneet = require('../lib/yneet');

const router = express.Router();

async function render(req, res, extra = {}) {
  const t = req.teacher;
  let partner = null;
  let stats = null;
  let terms = null;
  if (t.yneet_partner_code && yneet.enabled()) {
    try {
      const d = await yneet.summary(t.yneet_partner_code);
      partner = d.partner;
      stats = d.stats;
      terms = d.terms;
    } catch (e) {
      console.warn('YNeet summary failed:', e.message);
    }
  }
  res.render('yneet', {
    teacher: t,
    partnerOn: yneet.enabled(),
    code: t.yneet_partner_code || '',
    partner,
    stats,
    terms,
    studentLink: yneet.studentLink(t),
    packLink: yneet.packLink(t.yneet_partner_code),
    error: null,
    notice: null,
    ...extra,
  });
}

router.get('/yneet', requireTeacher, (req, res, next) => render(req, res).catch(next));

router.post('/yneet/join', requireTeacher, async (req, res, next) => {
  try {
    if (req.teacher.yneet_partner_code) return res.redirect('/yneet');
    if (!yneet.enabled()) return render(req, res, { error: 'Partner sign-up is not switched on yet. Please try again later.' });
    if (String(req.teacher.phone || '').replace(/\D/g, '').length < 10) {
      return render(req, res, { error: 'Add your WhatsApp number in Settings first — YNeet pays commission and sends updates there.' });
    }
    let d;
    try {
      d = await yneet.provision(req.teacher);
    } catch (e) {
      return render(req, res, { error: e.status && e.status < 500 ? e.message : 'Could not reach YNeet right now. Please try again in a minute.' });
    }
    db.prepare('UPDATE teachers SET yneet_partner_code = ? WHERE id = ?').run(d.partner.code, req.teacher.id);
    req.teacher.yneet_partner_code = d.partner.code;
    return render(req, res, {
      notice: d.created
        ? `You're a YNeet partner! Your code is ${d.partner.code}. We've emailed your partner dashboard login to ${d.partner.email}.`
        : `Linked your existing YNeet partner account (code ${d.partner.code}).`,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
