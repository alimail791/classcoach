// Minimal YouTube Data API v3 upload (resumable), using an OAuth refresh token
// for the channel owner's Google account. Secrets come from the environment:
//   YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
// Quota: an upload costs 1,600 of the default 10,000 units a day (3 a day = 4,800).
import { readFile, stat } from "node:fs/promises";

export const youtubeConfigured = () => !!(process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET && process.env.YT_REFRESH_TOKEN);

async function accessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YT_CLIENT_ID, client_secret: process.env.YT_CLIENT_SECRET,
      refresh_token: process.env.YT_REFRESH_TOKEN, grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error(`Google sign-in failed: ${j.error || res.status} ${j.error_description || ""}`);
  return j.access_token;
}

// meta: { title, description, tags, publishAt? (ISO; video stays private until then) }
export async function uploadShort(file, meta) {
  const token = await accessToken();
  const status = meta.publishAt
    ? { privacyStatus: "private", publishAt: meta.publishAt, selfDeclaredMadeForKids: false }
    : { privacyStatus: "public", selfDeclaredMadeForKids: false };
  const size = (await stat(file)).size;
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "video/mp4", "x-upload-content-length": String(size),
    },
    body: JSON.stringify({
      snippet: { title: meta.title, description: meta.description, tags: meta.tags, categoryId: "27", defaultLanguage: "en", defaultAudioLanguage: "en" },
      status,
    }),
  });
  if (!init.ok) throw new Error(`YouTube upload start failed: ${init.status} ${await init.text()}`);
  const put = await fetch(init.headers.get("location"), { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(size) }, body: await readFile(file) });
  const j = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(`YouTube upload failed: ${put.status} ${JSON.stringify(j).slice(0, 300)}`);
  return { id: j.id, url: `https://youtube.com/shorts/${j.id}`, privacy: j.status?.privacyStatus, publishAt: j.status?.publishAt };
}
