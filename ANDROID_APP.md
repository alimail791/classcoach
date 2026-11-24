# ClassCoach Android app (Google Play)

The app is a **Trusted Web Activity (TWA)**, the same approach as the YNeet app.
It is a small Android wrapper that opens https://www.classcoach.in full screen.
Everything the app shows comes from this website, so every push to `master`
updates the app too. You only upload a new app version to Play when the
wrapper itself changes (icon, name, package).

## What the website already does for the app

| Piece | Where |
| --- | --- |
| `/.well-known/assetlinks.json` (removes the browser bar) | `routes/app.js`, built from Railway variables |
| `/app`: the app's start page (dashboards when logged in, welcome screen otherwise) | `routes/app.js`, `views/app_welcome.ejs` |
| App mode: no prices, Upgrade links or Buy buttons inside the app | `views/partials/head.ejs`, `public/app.js`, `public/style.css` (`.web-only`) |
| Phone bottom tab bar (Home, Tests, Papers & OMR, Live quiz, More) | `views/partials/sidebar.ejs` |
| OMR: "Take photo of a sheet" opens the rear camera, one sheet per tap | `views/omr_scan.ejs` |
| Push notifications: test submitted / answers to grade, plan expiring, come-back reminder | `lib/push.js`, `public/sw.js` |
| Offline page instead of Chrome's error page | `public/sw.js`, `/offline` |
| "Get the app" bar for Android visitors on the website | `public/app.js` (needs `PLAY_STORE_URL`) |

Plans are bought on the website only. Inside the app there are no prices and no
payment links, so Google Play's billing fee doesn't apply. The plan works the
same in the app as on the website.

## Railway variables (service "classcoach")

```
ANDROID_PACKAGE=in.classcoach.app
ANDROID_SHA256_FINGERPRINTS=<app signing key>,<upload key>   # step 4
PLAY_STORE_URL=https://play.google.com/store/apps/details?id=in.classcoach.app   # after launch
VAPID_PUBLIC_KEY=...      # push notifications
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:info@classcoach.in
```

Generate a VAPID pair with `npx web-push generate-vapid-keys`. Generate it
once and keep it: if you change the keys, everyone has to turn notifications
on again.

## Build and publish

1. **Build the app package.** Go to https://www.pwabuilder.com, enter
   `https://www.classcoach.in/app`, then choose **Package for stores → Android
   → Google Play**. Use these options:
   - Package ID: `in.classcoach.app`
   - App name: `ClassCoach`, launcher name: `ClassCoach`
   - Start URL: `/app?source=twa`
   - Theme colour `#B4501C`, background `#FBF6EE`
   - Notification delegation: **on** (push notifications show as app notifications)
   - Signing key: **Create new**. Save the downloaded zip safely: it holds the
     `.aab` and the signing key you need for every future update.
2. **Create the app in Play Console.** Use the same developer account as YNeet,
   then **Create app**: ClassCoach, App, Free.
3. **Upload the `.aab`** to **Testing → Closed testing**. New personal developer
   accounts need 12+ testers opted in for 14 days before production. The YNeet
   testers can join this one too.
4. **Asset links.** In Play Console, go to **Test and release → App integrity →
   App signing**. Copy both SHA-256 fingerprints (app signing key and upload key)
   into `ANDROID_SHA256_FINGERPRINTS` on Railway. Check
   https://www.classcoach.in/.well-known/assetlinks.json: it should list them.
   Until this is done, the app shows a browser address bar at the top.
5. **Store listing.** Use the text below and the images in `store-assets/`.
6. After the 14 days, apply for production. When the app is live, set
   `PLAY_STORE_URL`.

### Play Console declarations
- **App access:** give the reviewers a demo teacher login (email and password)
  for a teacher account with sample classes.
- **Ads:** No ads.
- **Data safety:** the app collects name, email, phone (account), and
  students' names, marks and answers (app functionality). Data is encrypted in
  transit, and users can ask for deletion at info@classcoach.in.
- **Target audience:** the app is made for teachers. Students and parents only
  log in with a code from their teacher. Choose 18+ (teachers), and answer
  honestly if Play asks whether children use it.
- **Content rating:** Education, no objectionable content.

## Store listing text

**App name** (30): `ClassCoach: AI Tests & OMR`

**Short description** (80):
`Make tests in 1 minute, scan OMR sheets with your camera, grade with AI.`

**Full description:**

```
ClassCoach is the AI teaching assistant for Indian teachers, tutors and coaching centres.

📷 OMR SCANNER IN YOUR POCKET
Print OMR sheets for your question paper, then photograph each filled sheet with your phone. Marks, right/wrong/blank counts and roll numbers are read in seconds. Supports multiple sets (A/B/C/D) and negative marking. Download results as CSV.

📝 TESTS & QUESTION PAPERS IN 1 MINUTE
Pick a chapter, upload a PDF or snap a textbook page — ClassCoach writes MCQs, short and long answer questions. Print-ready question papers with answer keys and shuffled sets.

✅ AUTO-GRADING
MCQs are marked the moment students submit. For descriptive answers, AI suggests marks and feedback; you approve.

🔔 NOTIFICATIONS
Know when students submit a test and when answers are waiting to be graded.

📊 WEAK CHAPTERS & PARENT REPORTS
See each student's weak chapters and send parents their child's results on WhatsApp in one tap.

⚡ LIVE QUIZ
Run a Kahoot-style quiz in class — students join on their phones with a PIN.

🧭 CAREER APTITUDE TEST
Stream and career reports for students after Class 10 and 12.

Also: attendance, homework, notes and slides, a ready NEET/JEE question bank, and institute accounts for coaching centres.

Free for 1 month. Made in India for Indian classrooms.
```

**Category:** Education. **Tags:** Education, Productivity.
**Contact email:** info@classcoach.in. **Privacy policy:** https://www.classcoach.in/privacy
