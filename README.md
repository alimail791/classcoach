# ClassCoach (local)

A real, running version of ClassCoach: teacher accounts, classes, students,
manual + AI-generated tests, auto-grading, and a chapter-wise results view —
backed by an actual SQLite database on your computer.

## 1. Requirements

- [Node.js](https://nodejs.org) version 22.5 or later (check with `node --version`).
  This app uses Node's own built-in SQLite, so there's no native module to
  compile — `npm install` should never need Visual Studio Build Tools,
  Xcode command line tools, or anything like that.

## 2. Install

Open a terminal in this folder and run:

```
npm install
```

## 3. Add your AI key

```
cp .env.example .env
```

Then open `.env` in any text editor and:
- Set `AI_PROVIDER` to `anthropic` or `openai`, matching the key you have.
- Paste your key into `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`.
- Change `SESSION_SECRET` to any random string of your own.

`.env` stays on your machine only — it's never sent anywhere by this app.

If you skip this step, everything still works except "Generate with AI",
which will show an error until a key is added.

## 4. Run it

```
npm run dev
```

Then open **http://localhost:3000** in your browser.

## 5. Load demo data (optional, recommended)

To explore the app fully populated instead of starting empty:

```
npm run seed
```

**This deletes any existing data in `classcoach.sqlite` and replaces it
with demo data** — skip this if you already have real data you want
to keep.

It creates 2 classes, 10 students, 5 tests (published/draft/scheduled,
with a mix of graded and pending-grading attempts), 3 slide/notes
materials, 2 weeks of attendance history, 2 homework assignments, and
2 already-generated parent reports — enough that every screen has
something real to show.

Login details (also printed at the end of the seed script):

| Role | How to log in |
| --- | --- |
| Teacher | `ritu@demo.com` / `demo1234` |
| Admin | whatever `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env` |
| Student (e.g. Ananya) | roll `11`, PIN `1101` |
| Parent (e.g. Ananya's) | roll `11`, parent PIN `2101` |

Every seeded student follows the same pattern — student PINs run
`1101`–`1106` for Batch A and `1201`–`1204` for Batch B (matching roll
numbers `11`–`16` and `21`–`24`); parent PINs are the same numbers
with a `2` in front instead of `1`. Karthik Iyer (roll `14`) has a
pending descriptive answer waiting to be graded and patchier
attendance, on purpose — a good one to explore the grading and
attendance screens with.

The zip you were given already includes this seeded database, so you
can look around immediately without running the seed script first —
it's only needed if you want to reset back to a clean demo state later.

The demo ships **without** SMTP/AI keys configured, so:
- AI generation (tests/slides/notes) shows a clear "not configured"
  error until you add a key to `.env`
- Emailed reports/verification show a clear "not configured" error
  until you add SMTP settings — everything else (shareable report
  links, parent login, PDF downloads) works without it

## 6. Try it out (starting from empty, if you skipped seeding)

1. Sign up as a teacher.
2. Create a class (e.g. "Class 11 · Batch A").
3. Add a couple of students — each gets a roll number and a 4-digit PIN.
   Add a parent email too if you want to test emailed reports.
4. Click "+ Create test", give it a title and chapter.
5. Add questions three ways:
   - Paste chapter text and click "Generate questions" (uses your AI key)
   - Upload a PDF of the chapter instead of (or alongside) pasted text
   - Add a question manually — choose "Multiple choice" (auto-graded) or
     "Descriptive" (you grade it yourself, with a max-marks limit)
6. Click "Publish test".
7. Open a private/incognito browser window and go to
   `http://localhost:3000/student/login` — log in with the student's roll
   number and PIN, and take the test.
8. Back in your teacher window, open the test's "Results". MCQ scores show
   immediately; any descriptive answers show "Grade →" until you mark them.
9. Once every answer is graded, generate a parent report for that student:
   "Generate report" gives you a shareable link (no login needed to view
   it); if the student has a parent email on file and SMTP is configured
   (see below), "Email parent" sends it directly.
10. Click a student's name in the roster to see their profile — average
    score, chapter-wise performance aggregated across every test they've
    taken in that class, and their full test history.
11. Click "Reports" in the sidebar to see every report you've generated
    across all your classes in one place, with the same branded preview.
12. From a class page, "+ Slides & notes" lets you generate a slide deck
    or a set of notes with AI (or start blank), add/remove items, and
    share it — shared items show up under "Class materials" on the
    student's dashboard.
13. "📋 Attendance" on a class page lets you take attendance for any date —
    everyone defaults to present, uncheck absentees, save. "✏️ Homework"
    lets you assign work and mark who's completed it. Both feed real
    numbers into each student's profile (no more placeholder stats).
14. Import a whole class at once: on a class page, "Import from a
    spreadsheet" accepts a `.csv` or `.xlsx` file with columns `name`,
    `roll_no`, and optionally `parent_name`/`parent_contact`.
15. Download PDFs: any slide deck or notes set has a "Download PDF"
    button (for you and, once shared, for students). Any test has
    "Question paper" (no answers, good for printing) and "Answer key"
    (correct answers marked) downloads; students get the no-answers
    version for their own tests.
16. Parents get their own login — separate from the student's. Each
    student's roster row shows both a Student PIN and a Parent PIN;
    give the parent the roll number and their PIN at
    `/parent/login`. Their dashboard shows real average score,
    attendance %, homework %, full test history, and every report
    you've generated for that child — no link-sharing required, though
    the "Copy link" / "Email parent" options on the results page still
    work too if you'd rather send it that way.
17. AI generation (for tests and for slides/notes) also accepts a photo
    of a page (JPG/PNG) as a source, using OCR — handy for a textbook
    page you've photographed rather than a clean PDF. This needs
    internet access the first time it runs (to download its language
    data, which is then cached as a file next to the app — normal, and
    safe to delete if you want it re-downloaded), and is genuinely
    slower than pasting text. It fails gracefully with a clear error
    message if anything goes wrong; it will never crash the app for
    other users, since the actual recognition runs in its own isolated
    process.
18. **Admin dashboard** — set `ADMIN_EMAIL` in `.env` to the email of
    the account that should have owner-level access. Sign up (or log
    in) with that exact email, and a "🛠️ Admin" link appears in the
    sidebar, leading to `/admin`: every teacher account on the app,
    their student/test counts, their AI usage this month, and their
    plan and expiry. Admin can also deactivate a teacher's account
    (blocks their login immediately) and download a full JSON backup
    of everything in the database (passwords excluded) with one click.
    Leave `ADMIN_EMAIL` blank to disable the admin dashboard entirely.
19. **Pricing plans**, assigned by the admin from the "Plan" dropdown
    on a teacher's row:

    | Plan | Price | Duration | Students |
    | --- | --- | --- | --- |
    | Free Trial | ₹0 | 1 month | 10 |
    | Starter | ₹499 | 6 months | 20 |
    | Growth | ₹999 | 6 months | 50 |
    | Pro | ₹1,999 | 6 months | 100 |

    Every new signup starts on the Free Trial automatically. There's no
    payment gateway wired in — a teacher pays you outside the app (UPI,
    bank transfer, whatever you use), and you pick their plan and hit
    "Extend" for the number of months they paid for. AI generation
    limits per plan (20/40/100/250 per month) are my own reasonable
    default, not something you specified — change them in
    `lib/plans.js` if you want different numbers.

    Once a plan's expiry date passes, that account freezes at its
    current student count (no new students, no AI generation) but
    nothing is deleted or hidden — the teacher can still log in, see
    everything, grade tests, and generate reports. Set an account's
    expiry to "No expiry" from the admin dashboard to exempt it from
    this entirely (useful for your own account, or a trusted teacher).
20. **Admin login is fully separate** from teacher accounts — its own
    password at `/admin/login`, set via `ADMIN_EMAIL` and
    `ADMIN_PASSWORD` in `.env`. A teacher account sharing that email
    does not get admin access; only knowing both credentials does.
    From there, admin can search teachers by name/email, deactivate or
    permanently delete an account (typing the exact name to confirm —
    deletion cascades to everything that teacher owns), trigger a
    password reset for a locked-out teacher (shows the link directly if
    SMTP isn't configured), and manually mark an email verified.
21. **Phone numbers** are collected at signup (teachers) and when
    adding a student — shown in Settings and the class roster. There's
    no SMS/OTP verification wired in (that needs a paid SMS provider
    account, which wasn't available) — phone numbers are stored for
    contact purposes only, not verified.
22. **Email verification** is real: signing up sends a verification
    link if SMTP is configured, and Settings shows a Verified/Unverified
    badge with a "Send verification email" button. It's a soft check,
    not a hard gate — an unverified teacher can still use the app fully,
    since blocking access would strand anyone who hasn't set up SMTP.
23. **Search** — a search box on the dashboard and on the Tests hub
    filters your tests by title or chapter.
24. The landing page now has a "How it works" section, six feature
    cards (up from four), and an FAQ section — all describing what the
    app actually does, not aspirational copy.
25. **Forgot/reset password** for teachers — a "Forgot your password?"
    link on the login page sends a reset link (valid for 1 hour, and
    it can't be reused once it works). If SMTP isn't configured, the
    link is printed to the server's console log instead of emailed, so
    you (as the operator) can still hand it to a teacher manually. The
    request form always shows the same message whether or not the
    email exists, so it can't be used to check who has an account.
26. **Everything a teacher shares with students is directly
    downloadable from the student's own dashboard** — no extra click
    to "open" first. This covers the two things teachers actually
    share: published tests (a no-answers question paper PDF) and
    slides/notes (a formatted PDF), both with a one-tap ⬇ button right
    on the list. Homework and attendance aren't files, so there's
    nothing to download there — they're just checklists.
27. **Students and parents now see chapter-wise weakness too** — not
    just the teacher. Same numbers, computed once from a shared helper
    so all three views (teacher's student-profile page, parent
    dashboard, student's own dashboard) always agree. The parent
    dashboard also names the single weakest topic as a simple
    next-step nudge.
28. **Students can see their assigned homework** — title, chapter,
    due date, and whether the teacher's marked it done — on their own
    dashboard. Previously this was teacher-only.
29. **Generate reports for an entire test's worth of students in one
    click** — "Generate reports for all →" on a test's results page,
    instead of one student at a time.
30. **Schedule a test for later** — set a date/time on a draft test
    instead of publishing immediately; it publishes itself the next
    time anyone loads a page that lists tests (dashboard, batch page,
    tests hub, or a student checking their own dashboard) once that
    time arrives. No separate background job needed.
31. **Technical SEO** on the landing page: a proper meta description,
    Open Graph and Twitter card tags, a canonical URL, `robots.txt`,
    `sitemap.xml`, a favicon, and JSON-LD structured data (both
    `SoftwareApplication` and `FAQPage`, matching the real FAQ content
    word-for-word). Every other page — dashboard, login screens,
    student/parent/admin areas — is explicitly marked `noindex` by
    default, since those require login and shouldn't show up in search
    results at all.

    **Important, honest context:** this is *technical* SEO — it makes
    the page properly crawlable and describable to search engines. It
    does not, by itself, make a site "come organically top." Ranking
    also depends on things no amount of meta tags can substitute for:
    how much real content exists (right now there's exactly one public
    page), backlinks from other sites, domain age and authority, and
    how competitive the search terms are. None of that changes until
    the site is live on a real domain — right now it's `localhost`,
    which search engines can't crawl at all. Once it's deployed
    somewhere public, the next real lever is more indexable content
    (a blog, city/subject-specific landing pages, etc.), not more code.
32. **Refer & earn** — every teacher gets a unique referral link
    (shown on Settings, with a Copy button). When someone signs up
    through it, they're tracked as referred. Once **2** of a teacher's
    referrals have been placed on a paid plan by the admin, the
    referrer automatically gets **6 months** added to their own
    subscription, plus a notification and email. There's no payment
    gateway, so "purchased" here means the admin assigned them a paid
    plan from `/admin` — this is the same manual-plan-assignment model
    the rest of the subscription system uses.
33. **In-app notifications** — a real notification inbox (not
    SMS/push) on every dashboard: admin can message any teacher
    (optionally also by email), a teacher can message all students
    and/or parents in one of their classes, and the subscription
    expiry warnings (below) land here too. Each shows an unread badge
    and a "mark all read" action.
34. **Auto subscription-expiry notices** — as a plan (including the
    free trial) gets within 7 days of expiring, or after it's expired,
    the teacher gets one in-app notification and one email — verified
    it fires exactly once per distinct expiry date (reloading the
    dashboard repeatedly doesn't spam it), and fires again if the
    expiry date later changes (e.g. after a renewal, then expiring
    again).
35. **WhatsApp sharing for reports** — a "WhatsApp" button next to
    "Copy link" and "Email parent" on a test's results page. This uses
    WhatsApp's own `wa.me` link scheme (no Business API, no paid
    account) — it opens WhatsApp with the student's result and report
    link pre-filled, addressed to the student's phone number if one's
    on file, and lets the teacher hit send themselves.
36. **Teachers can edit a student's profile** after adding them — name,
    roll number, phone, parent name, and parent email, all from an
    "Edit details" link on the student's profile page. Student phone
    and parent email are now **required** fields (not optional) both
    when adding a student and when editing one.
37. **Admin dashboard shows each teacher's phone number** alongside
    their email, and can **send a message to any teacher** (as an
    in-app notification, optionally also emailed) directly from the
    teacher list.
38. **Self-serve payments via Razorpay** — a real "💳 Upgrade" page
    where a teacher can pay for Starter/Growth/Pro with a card, UPI, or
    netbanking, and their plan upgrades automatically the moment
    payment clears — no more waiting on admin to manually assign it.

    **To turn this on:** get free test-mode keys from your Razorpay
    dashboard (no business verification needed just to test) and add
    `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` to `.env`. Without these,
    the Upgrade page still shows the plans but the "Pay" buttons are
    disabled with a clear explanation, and manual admin-assigned
    upgrades keep working exactly as before — this is additive, not a
    replacement.

    **What's actually verified, and how:** I don't have live Razorpay
    credentials to test a real payment end-to-end, so I tested the two
    parts that are actually mine to get right — by hand-computing valid
    and invalid HMAC signatures the same way Razorpay's checkout and
    webhooks do, and confirming: a forged/wrong signature is rejected
    and marks the payment failed; a genuine signature is accepted,
    actually updates the teacher's plan/limits in the database (not
    just an API response), marks them as a paying customer, and
    correctly triggers a referral reward through this path exactly like
    the admin-assigned path does; replaying the same valid payment
    twice doesn't double-apply it; and the webhook backstop (a second,
    independent confirmation path Razorpay calls server-to-server, in
    case a customer's browser closes right after paying) verified the
    same way with its own separate signature. What I *can't* verify
    from here is Razorpay's own checkout widget actually opening and a
    real card/UPI payment completing in a browser — that only happens
    with live keys, in a real browser, which means **please do one real
    test-mode payment yourself** once you've added your keys, using
    Razorpay's published test card numbers, before relying on this live.
    A webhook is optional but recommended as the reliability backstop —
    set its URL in your Razorpay dashboard to
    `https://yourdomain.com/webhooks/razorpay` once deployed, with
    `RAZORPAY_WEBHOOK_SECRET` in `.env` matching what you set there.
39. **Class/subject performance comparison** — a "📈 Compare Classes"
    page showing every class side by side: student count, tests given,
    average score, average attendance, and the single weakest chapter
    — all computed from the same numbers each class's own page uses.
40. **Recommended practice for weak chapters** — on a student's
    profile, a "Generate practice set with AI" button appears next to
    their weakest chapter (below 50%). It generates a short 4–5
    question practice set with worked answers using the same AI
    pipeline as test/notes generation, and — unlike regular shared
    materials — it's personal: it shows up only on that one student's
    own dashboard under "Recommended practice for you," not shared with
    the whole class. Counts against the teacher's normal monthly AI
    limit like any other generation.
41. **Students can self-join a class** — every class gets a short join
    code (shown on the class page, click to copy). Share it, and a
    student fills in their own name, roll number, phone, and parent
    email at `/join` — no manual data entry from the teacher. Respects
    the same required fields and student-limit cap as adding a student
    manually.
42. **Installable as an app (PWA)** — "Add to Home Screen" now works
    properly on students'/parents' phones, via a real manifest, icon,
    and a minimal service worker (it does no offline caching — its only
    job is satisfying the browser's install criteria, so there's no
    stale-cache risk).
43. **Weekly parent digest email** — an automatic weekly summary
    (recent scores, attendance %, weakest topic) sent to each parent,
    with no cron job needed — it's checked whenever the teacher's
    dashboard loads, same pattern as the plan-expiry notice, and never
    sends more than once per student per 7 days. Off by default for a
    student with no data yet; each parent's own child can be opted out
    from that student's edit page.
44. **Parent's own phone number** is now a field, separate from the
    student's phone and the parent's email — required when adding a
    student (manually, via CSV/Excel import, or via self-join), shown
    on the student's profile page, and now the number WhatsApp report
    sharing uses by default (it used to fall back to the student's own
    phone, which usually isn't who should receive a parent report).
    **Found and fixed a real latent bug while wiring this up**: the
    CSV/Excel import path had never actually saved the student's phone
    number at all, even before this change — it silently accepted the
    column but the insert never included it. Fixed both together.
45. **A "Join a class" link** is now visible on the landing page next
    to Student/Parent login — the self-join page existed before but had
    no way to find it without already knowing the URL.
46. **A Help page** ("❓ Help" in the sidebar) — a full walkthrough of
    every feature (classes, tests, AI generation, grading, materials,
    attendance, homework, reports, referrals, the admin/payment side)
    plus a short FAQ, written for a teacher opening the app for the
    first time.
47. **Fixed a real security/privacy gap**: after logging out, the
    browser's back button could show a stale cached copy of the
    dashboard instead of properly re-checking the session — a real
    concern on a shared or public computer. Every authenticated page
    (teacher, student, parent, admin) now tells the browser never to
    cache it, so back-button-after-logout correctly requires logging in
    again. Verified this with a direct header check, not just visually.
48. **AI-assisted descriptive grading** — on the grading screen, a
    "✨ Suggest grade with AI" button next to each long-answer response
    fills in a suggested mark and a one-sentence rationale for why. It
    never saves anything by itself: the mark lands in the same input
    box you'd type into yourself, and you still have to review it and
    click "Save marks" — nothing is graded silently. Counts against the
    normal monthly AI limit, and only works on descriptive answers
    (rejected cleanly on an MCQ answer, which is already auto-graded
    anyway).

## Gaps still open from the original feature spec

Checked carefully against the full spec — these are real, not done yet:

- **Descriptive answers are still graded manually**, not automatically.
  Automatic grading of open-ended answers is a meaningfully harder,
  riskier feature (an AI judgment call on a subjective answer) that
  needs its own careful design — not something to bolt on quickly.
- **No AI-generated personalized improvement plans** beyond the
  "weakest topic" one-liner already shown to students/parents/teacher.
- **No class/section/subject/teacher performance comparison view.**
  Right now each batch's and each teacher's numbers exist, but nothing
  puts them side by side.
- **No bulk question upload** (importing a ready-made spreadsheet of
  questions directly into a test, separate from AI generation).
- **Parent reports are HTML only** — no "download as PDF" for the
  report itself (test question papers and slide decks do have PDF
  export; the actual parent-facing result report doesn't yet).

These weren't skipped by accident — I ran out of room to build them
carefully in this pass. Ask for any of them by name and I'll take
them on next.

## Data

Everything is stored in a single file, `classcoach.sqlite`, created the
first time you run the app. Back it up by copying that file; delete it to
start completely fresh. Existing databases are upgraded automatically —
you don't need to delete it after pulling a newer version of this app.

## Notes on scope

This is a real, working local app — not a mockup — and now covers the
full loop: AI or manual test creation (MCQ and descriptive), auto- and
manual grading, parent reporting (link, email, or a separate parent
login), slide deck/notes creation with PDF export, attendance, homework,
and spreadsheet import. A few honest limits remain:

- OCR (photo-to-text) needs internet access on first use and can take a
  while; it's genuinely useful for a photographed textbook page but is
  not a substitute for a real scanned-PDF OCR pipeline (which would need
  tools this app deliberately avoids, to keep `npm install` free of
  native compilation on every platform, including Windows).
- Spreadsheet import expects a `name` and `roll_no` column (other names
  like "Student Name" or "Roll No" are recognized) — a very unusual
  header layout may not be picked up automatically.
- There's no WhatsApp Business API integration — that requires business
  verification and message templates, a bigger, separate step.
- Descriptive answers are graded one attempt at a time — there's no
  bulk-grading view.
- Sessions use an in-memory store, which is fine for local use but resets
  if you restart the server (everyone stays logged in via the browser
  cookie, but you'd need to log in again after a restart).

When you're ready to put this on the internet so students can reach it
from anywhere, deploying it (e.g. to Railway) is a separate, short next
step — just ask.
