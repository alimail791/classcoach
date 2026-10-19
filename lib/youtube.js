// Pulls the 11-character video id out of any common YouTube link:
// youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, /embed/ID,
// /live/ID, m.youtube.com and music.youtube.com. Returns null if the text
// isn't a YouTube video link.
const ID = /^[A-Za-z0-9_-]{11}$/;

function parseYouTubeId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (ID.test(raw)) return raw;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch (e) {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let id = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  return id && ID.test(id) ? id : null;
}

module.exports = { parseYouTubeId };
