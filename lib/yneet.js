// Link between ClassCoach tutors and YNeet (yneet.in, NEET practice for students).
// A tutor can (1) share a free YNeet practice link with students, (2) buy YNeet
// student logins for their batch, and (3) become a YNeet sales partner and earn
// commission on institute packs. (3) calls the Raise Academy / YNeet backend:
//   YNEET_API_URL       e.g. https://api.yneet.in/api  (the www.yneet.in backend)
//   YNEET_INTERNAL_KEY  = that backend's INTERNAL_SERVICE_KEY
// Without both, the page still shows the share link and pack link; only the
// partner sign-up is switched off.
const SITE = 'https://www.yneet.in';

const apiBase = () => String(process.env.YNEET_API_URL || '').replace(/\/$/, '');
const enabled = () => !!(apiBase() && process.env.YNEET_INTERNAL_KEY);

async function call(method, path, body) {
  const res = await fetch(`${apiBase()}/sales-partners${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.YNEET_INTERNAL_KEY },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `YNeet responded ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Free practice link a tutor shares with students; sign-ups show up in YNeet
// admin under the "ClassCoach tutors" channel.
const studentLink = (teacher) => `${SITE}/?utm_source=classcoach&utm_medium=tutor&utm_campaign=t${teacher.id}`;

// Where a tutor (or a centre they refer) buys YNeet student logins.
const packLink = (code) => (code ? `${SITE}/institutes?sp=${encodeURIComponent(code)}` : `${SITE}/institutes?utm_source=classcoach&utm_medium=tutor`);

const provision = (teacher) =>
  call('POST', '/internal/provision', { name: teacher.name, email: teacher.email, phone: teacher.phone, classcoachTeacherId: teacher.id });

const summary = (code) => call('GET', `/internal/summary?code=${encodeURIComponent(code)}`);

module.exports = { enabled, studentLink, packLink, provision, summary, SITE };
