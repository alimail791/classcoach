// Raise network: links ClassCoach to TestMandi (testmandi.in, sell tests & find resources) and
// VasulBook (vasulbook.com, fee dues + reminders), so a tutor uses all three with one sign-up.
//
//   TESTMANDI_API_URL        TestMandi backend, e.g. https://testmandiserver-production.up.railway.app
//   TESTMANDI_NETWORK_KEY    = TestMandi's NETWORK_API_KEY  (needed only for "Sell on TestMandi")
//   VASULBOOK_URL            default https://www.vasulbook.com (the bare domain is a GoDaddy redirect)
//   VASULBOOK_NETWORK_KEY    = VasulBook's NETWORK_API_KEY  (needed for the Fees page)
// Without a key that half is switched off and the page shows a plain link instead.
const TM_SITE = 'https://testmandi.in';
const tmApi = () => String(process.env.TESTMANDI_API_URL || 'https://testmandiserver-production.up.railway.app').replace(/\/$/, '');
const vbBase = () => String(process.env.VASULBOOK_URL || 'https://www.vasulbook.com').replace(/\/$/, '');

const testmandiOn = () => String(process.env.TESTMANDI_NETWORK_KEY || '').length >= 24;
const vasulbookOn = () => String(process.env.VASULBOOK_NETWORK_KEY || '').length >= 24;

async function call(base, key, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-network-key': key, 'x-network-source': 'classcoach' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `responded ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
const tm = (m, p, b) => call(tmApi(), process.env.TESTMANDI_NETWORK_KEY, m, p, b);
const vb = (m, p, b) => call(vbBase(), process.env.VASULBOOK_NETWORK_KEY, m, p, b);

const utm = (url, content) => `${url}${url.includes('?') ? '&' : '?'}utm_source=classcoach&utm_medium=app&utm_campaign=${encodeURIComponent(content)}`;

/* ---------------- TestMandi ---------------- */
const tmSeller = (t) =>
  tm('POST', '/api/partner/seller', { email: t.email, name: t.name, phone: t.phone, businessName: t.dir_display_name || t.name, emailVerified: !!t.email_verified });
const tmPublish = (body) => tm('POST', '/api/partner/tests', body);
const tmSummary = (email) => tm('GET', `/api/partner/seller-summary?email=${encodeURIComponent(email)}`);

// Public marketplace catalogue (no key needed), cached for 10 minutes.
let catalog = { at: 0, tests: [], resources: [], categories: [] };
async function tmCatalog() {
  if (Date.now() - catalog.at < 10 * 60 * 1000 && catalog.at) return catalog;
  const get = (p) => fetch(`${tmApi()}${p}`, { signal: AbortSignal.timeout(10000) }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const [t, r, c] = await Promise.all([get('/api/tests'), get('/api/resources'), get('/api/categories')]);
  if (t.tests || r.resources) catalog = { at: Date.now(), tests: t.tests || [], resources: r.resources || [], categories: c.categories || [] };
  return catalog;
}
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const tmTestUrl = (t) => utm(`${TM_SITE}/tests/${t.id}/${slug(t.title)}`, 'browse');
const tmResourceUrl = (r) => utm(`${TM_SITE}/resources/${r.id}/${slug(r.title)}`, 'browse');

/* ---------------- VasulBook ---------------- */
const vbAccount = (t) =>
  vb('POST', '/api/partner/account', { email: t.email, name: t.name, phone: t.phone, business: t.dir_display_name || `${t.name} Classes`, businessType: 'tuition', emailVerified: !!t.email_verified });
const vbSyncStudents = (email, customers) => vb('POST', '/api/partner/customers', { email, customers });
const vbCharge = (email, body) => vb('POST', '/api/partner/charges', { email, ...body });
const vbBalances = (email) => vb('GET', `/api/partner/balances?email=${encodeURIComponent(email)}`);
const vbLoginLink = (email) => vb('POST', '/api/partner/login-link', { email });

module.exports = {
  TM_SITE, VB_SITE: vbBase, testmandiOn, vasulbookOn, utm,
  tmSeller, tmPublish, tmSummary, tmCatalog, tmTestUrl, tmResourceUrl,
  vbAccount, vbSyncStudents, vbCharge, vbBalances, vbLoginLink,
};
