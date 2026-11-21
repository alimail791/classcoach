// Daily ClassCoach promo video (run by .github/workflows/daily-promo-video.yml).
//   node daily.mjs                         today's video (IST): render, YouTube Short + Instagram Reel
//   node daily.mjs --date 2026-11-22 --no-upload
//   node daily.mjs --all --no-upload       render every script (to preview the whole set)
// Env: PUBLISH_TIME_IST (default "18:30"), CHROME_PATH,
//      YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN (ClassCoach's YouTube channel, see youtube.mjs),
//      PROMO_UPLOAD_KEY + CLASSCOACH_URL (default https://www.classcoach.in): queues the Reel on
//      classcoach.in, which posts it to Instagram at the same time, and remembers what's uploaded.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { renderPromo } from "./render.mjs";
import { uploadShort, youtubeConfigured } from "./youtube.mjs";
import { SCRIPTS, scriptFor } from "./scripts.mjs";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const OUT = path.resolve(process.env.OUT_DIR || "out");
const SITE = (process.env.CLASSCOACH_URL || "https://www.classcoach.in").replace(/\/$/, "");
const KEY = process.env.PROMO_UPLOAD_KEY || "";
const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

const utm = (medium) => `utm_source=${medium}&utm_medium=shorts&utm_campaign=daily_promo`;
const link = (s, medium) => `${SITE}${s.page}${s.page.includes("?") ? "&" : "?"}${utm(medium)}`;
const oneLine = (x) => x.replace(/\s*\n\s*/g, " ").trim();
const BASE_TAGS = ["ClassCoach", "Teachers", "TeachersOfIndia", "TeacherTools", "EdTech", "TuitionTeacher", "CoachingClass"];

function youtubeMeta(s) {
  const head = oneLine(s.hook).replace(/[<>]/g, "");
  const suffix = " | ClassCoach #shorts";
  const title = (head.length + suffix.length <= 100 ? head : head.slice(0, 100 - suffix.length - 1).replace(/\s+\S*$/, "") + "…") + suffix;
  const description = [
    `${s.label} for teachers & tutors — ${s.result}.`,
    link(s, "youtube"),
    "",
    `${s.pain}`,
    "",
    ...s.steps.map((x, i) => `${i + 1}. ${x}`),
    "",
    "ClassCoach: tests, auto-grading, OMR scanning, question papers and chapter-wise parent reports for teachers, tutors and coaching classes in India.",
    `Start free (no card needed): ${SITE}/signup?${utm("youtube")}`,
    "",
    "New teacher tool every day — subscribe 🔔",
    "",
    [...BASE_TAGS.slice(0, 4), ...s.tags].map((t) => `#${t}`).join(" "),
  ].join("\n").replace(/</g, "＜").replace(/>/g, "＞").slice(0, 5000);
  const tags = ["ClassCoach", s.label, "teacher tools", "app for teachers", "online test maker", "tuition teacher", "coaching class software", ...s.tags]
    .filter((t, i, a) => t.length <= 30 && a.indexOf(t) === i);
  while (tags.join(",").length > 480) tags.pop();
  return { title, description, tags };
}

function reelCaption(s) {
  return [
    `${oneLine(s.hook)} 👀`,
    "",
    s.pain,
    "",
    `✅ ${s.label} on ClassCoach:`,
    ...s.steps.map((x, i) => `${i + 1}️⃣ ${x}`),
    "",
    `👉 ${s.result}`,
    "",
    "Start free at classcoach.in — link in bio 🔗",
    "Follow for a new teacher tool every day 📚",
    "",
    [...BASE_TAGS, ...s.tags, "TeacherLife", "Teaching", "IndianTeachers"].filter((t, i, a) => a.indexOf(t) === i).map((t) => `#${t}`).join(" "),
  ].join("\n").slice(0, 2200);
}

// "18:30" IST on `date` → ISO UTC, or null if it is already (nearly) past: then publish now.
function publishAtIst(date, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Date.parse(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
  return t - Date.now() > 15 * 60 * 1000 ? new Date(t).toISOString() : null;
}

async function site(pathname, init = {}) {
  const res = await fetch(`${SITE}${pathname}`, { ...init, headers: { "x-upload-key": KEY, ...(init.headers || {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `classcoach.in responded ${res.status}`);
  return j;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });

  if (flag("--all")) {
    try {
      for (const [i, s] of SCRIPTS.entries()) {
        const f = path.join(OUT, `${String(i + 1).padStart(2, "0")}-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mp4`);
        await renderPromo(browser, { ...s, index: i }, f);
        console.log(`Rendered ${path.basename(f)}`);
      }
    } finally { await browser.close(); }
    return;
  }

  const date = opt("--date") || istToday();
  const s = scriptFor(date);
  const file = path.join(OUT, `${date}-classcoach.mp4`);
  try { await renderPromo(browser, s, file); } finally { await browser.close(); }
  const yt = youtubeMeta(s);
  const caption = reelCaption(s);
  await writeFile(file.replace(/\.mp4$/, ".json"), JSON.stringify({ date, script: s.index + 1, youtube: yt, instagramCaption: caption }, null, 2));
  console.log(`Rendered ${path.basename(file)} — script ${s.index + 1}/${SCRIPTS.length}: ${s.label}`);
  if (flag("--no-upload")) return console.log("Upload skipped (--no-upload).");

  const publishAt = publishAtIst(date, process.env.PUBLISH_TIME_IST || "18:30");
  let failed = 0;

  // Instagram Reel: classcoach.in stores the video and posts it at publishAt.
  if (KEY) {
    try {
      const meta = Buffer.from(JSON.stringify({ date, label: s.label, caption, publishAt })).toString("base64");
      const j = await site("/api/instagram-reels/upload", { method: "PUT", headers: { "content-type": "video/mp4", "x-reel-meta": meta }, body: await readFile(file) });
      console.log(`Instagram Reel queued for ${j.publishAt || "now"}${j.note ? ` (${j.note})` : ""}${j.instagramConnected === false ? " — Instagram not connected on classcoach.in yet (IG_ACCESS_TOKEN)" : ""}`);
    } catch (e) { failed++; console.error(`Instagram Reel not queued: ${e.message}`); }
  } else console.log("PROMO_UPLOAD_KEY not set — Instagram Reel not queued.");

  // YouTube Short (scheduled to go public at publishAt). Never twice for one day.
  if (!youtubeConfigured()) console.log("YouTube not connected yet (YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN) — the video is in the run's artifacts.");
  else if (!KEY && !flag("--force")) console.log("PROMO_UPLOAD_KEY not set — not uploading to YouTube, since without it re-runs can't tell if today's Short is already up (use --force).");
  else {
    let done = null;
    if (KEY && !flag("--force")) {
      try { done = (await site(`/api/instagram-reels/youtube?date=${date}`)).videoId || null; }
      catch (e) { console.error(`Couldn't check today's YouTube upload (${e.message}); not uploading to avoid a duplicate.`); process.exitCode = 1; return; }
    }
    if (done) console.log(`YouTube Short for ${date} already uploaded (${done}) — skipping (--force to upload again).`);
    else {
      try {
        const up = await uploadShort(file, { ...yt, publishAt });
        console.log(`Uploaded to YouTube: ${up.url} (${up.privacy}${up.publishAt ? `, goes public ${up.publishAt}` : ""})`);
        if (KEY) await site("/api/instagram-reels/youtube", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, videoId: up.id }) }).catch((e) => console.warn(`Couldn't record the upload on classcoach.in: ${e.message}`));
      } catch (e) { failed++; console.error(`YouTube upload failed: ${e.message}`); }
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
