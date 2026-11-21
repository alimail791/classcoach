# ClassCoach daily promo video

Every evening `.github/workflows/daily-promo-video.yml` renders tomorrow's 23-second promo video (1080×1920, original music made in code) from the next script in `scripts.mjs` (30 scripts, then it starts over). The same video is:

- uploaded to ClassCoach's YouTube channel as a Short, going public at 18:30 IST (`PUBLISH_TIME_IST`), and
- sent to classcoach.in (`PUT /api/instagram-reels/upload`), which posts it as an Instagram Reel at the same time (`lib/instagramReels.js`).

Edit or add scripts in `scripts.mjs` — keep every claim true to what ClassCoach does.

- Preview locally: `npm install && node daily.mjs --no-upload` (or `--all` for all 30). Needs ffmpeg and Chrome. Videos land in `out/`.
- Run by hand: GitHub → Actions → Daily ClassCoach promo video → Run workflow.
- Check Instagram: `curl -H "x-upload-key: $PROMO_UPLOAD_KEY" https://www.classcoach.in/api/instagram-reels/status` (add `?run=1` to post anything due now).

## Setup

1. Railway (classcoach service): `PROMO_UPLOAD_KEY` (any long random string), `IG_ACCESS_TOKEN` (ClassCoach Instagram Business/Creator account; `IG_USER_ID` too if it's an `EAA…` token). Keep `DB_PATH` on a Volume so queued videos survive redeploys.
2. GitHub repo secrets: `PROMO_UPLOAD_KEY` (same value), `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` (OAuth client for the ClassCoach channel owner's Google account, scope `youtube.upload`).
