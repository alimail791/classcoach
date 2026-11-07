// Reads a photo or scan of a ClassCoach OMR sheet.
//
//   1. Decode the image (JPEG / PNG) and make a greyscale working copy.
//   2. Read the QR code: which paper and set this sheet belongs to. Its
//      position also tells us which way up the photo is.
//   3. Find the 4 solid corner squares and compute a perspective transform
//      (homography) from sheet millimetres to photo pixels. This undoes tilt,
//      zoom and rotation, so the phone needn't be held perfectly straight.
//   4. Measure how dark each bubble is compared with the paper around it,
//      and decide marked / blank / multiple for every question.
//
// Pure JavaScript (jpeg-js, pngjs, jsqr) — nothing native to install.
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const T = require('./template');

const WORK_WIDTH = 1600;

function decode(buffer) {
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  if (isPng) {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }
  return jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 1024, maxResolutionInMP: 60 });
}

// Box-filtered greyscale copy at most WORK_WIDTH wide (keeps the long side
// manageable for 12-48 MP phone photos).
function toGray(img) {
  const scale = Math.min(1, WORK_WIDTH / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const gray = new Float32Array(w * h);
  const step = 1 / scale;
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y * step);
    const sy1 = Math.min(img.height, Math.max(sy0 + 1, Math.floor((y + 1) * step)));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x * step);
      const sx1 = Math.min(img.width, Math.max(sx0 + 1, Math.floor((x + 1) * step)));
      let sum = 0;
      let n = 0;
      // Sample at most a 4x4 grid of source pixels per output pixel.
      const ys = Math.max(1, Math.floor((sy1 - sy0) / 4));
      const xs = Math.max(1, Math.floor((sx1 - sx0) / 4));
      for (let sy = sy0; sy < sy1; sy += ys) {
        for (let sx = sx0; sx < sx1; sx += xs) {
          const i = (sy * img.width + sx) * 4;
          sum += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
          n++;
        }
      }
      gray[y * w + x] = sum / n;
    }
  }
  return { w, h, gray };
}

function integral(g) {
  const { w, h, gray } = g;
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  return I;
}

function boxMean(I, w, h, x0, y0, x1, y1) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w, x1); y1 = Math.min(h, y1);
  const W = w + 1;
  const area = (x1 - x0) * (y1 - y0) || 1;
  return (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / area;
}

// Dark-pixel mask with a local threshold, so shadows across the sheet don't
// turn whole regions black.
function binarize(g, I) {
  const { w, h, gray } = g;
  const r = Math.round(Math.max(w, h) / 14);
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = boxMean(I, w, h, x - r, y - r, x + r + 1, y + r + 1);
      if (gray[y * w + x] < m * 0.62) mask[y * w + x] = 1;
    }
  }
  return mask;
}

function components(mask, w, h, minSide) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const out = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    let n = 0, sx = 0, sy = 0, minx = w, maxx = 0, miny = h, maxy = 0;
    while (sp) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p - x) / w;
      n++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      const nb = [p - 1, p + 1, p - w, p + w];
      for (let k = 0; k < 4; k++) {
        const q = nb[k];
        if (q < 0 || q >= w * h) continue;
        if ((k === 0 && x === 0) || (k === 1 && x === w - 1)) continue;
        if (mask[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
      }
    }
    const bw = maxx - minx + 1;
    const bh = maxy - miny + 1;
    if (bw < minSide || bh < minSide) continue;
    const aspect = bw / bh;
    const fill = n / (bw * bh);
    if (aspect < 0.55 || aspect > 1.8 || fill < 0.6) continue;
    out.push({ x: sx / n, y: sy / n, n, bw, bh, fill });
  }
  return out.sort((a, b) => b.n - a.n);
}

// ---- geometry -----------------------------------------------------------
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// Homography mapping src[i] -> dst[i] (4 point pairs).
function homography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  if (!h) return null;
  return (x, y) => {
    const d = h[6] * x + h[7] * y + 1;
    return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d };
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Orders 4 points clockwise starting from the one nearest the top-left.
function clockwise(pts) {
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / 4, y: pts.reduce((s, p) => s + p.y, 0) / 4 };
  const sorted = pts.slice().sort((a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x));
  let start = 0;
  sorted.forEach((p, i) => { if (p.x + p.y < sorted[start].x + sorted[start].y) start = i; });
  return sorted.slice(start).concat(sorted.slice(0, start));
}

// Picks the 4 corner markers: among the biggest solid blobs, the set of 4
// with similar sizes forming the largest quadrilateral with the sheet's shape.
function findMarkers(cands) {
  const top = cands.slice(0, 10);
  const want = (T.markerCenters[1].x - T.markerCenters[0].x) / (T.markerCenters[3].y - T.markerCenters[0].y);
  let best = null;
  for (let a = 0; a < top.length; a++)
    for (let b = a + 1; b < top.length; b++)
      for (let c = b + 1; c < top.length; c++)
        for (let d = c + 1; d < top.length; d++) {
          const set = [top[a], top[b], top[c], top[d]];
          const sizes = set.map((s) => s.n);
          if (Math.max(...sizes) / Math.min(...sizes) > 3) continue;
          const q = clockwise(set);
          const wTop = dist(q[0], q[1]), wBot = dist(q[3], q[2]), hL = dist(q[0], q[3]), hR = dist(q[1], q[2]);
          const ratio = (wTop + wBot) / (hL + hR);
          const r = ratio > 1 ? 1 / ratio : ratio; // page may be rotated 90°
          if (Math.abs(r - want) > 0.2) continue;
          if (Math.min(wTop, wBot) / Math.max(wTop, wBot) < 0.6 || Math.min(hL, hR) / Math.max(hL, hR) < 0.6) continue;
          const area = (wTop + wBot) * (hL + hR);
          const score = area * (1 - Math.abs(r - want));
          if (!best || score > best.score) best = { score, q };
        }
  return best ? best.q : null;
}

function readQr(g) {
  const { w, h, gray } = g;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = gray[i];
    rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
  }
  const code = jsQR(rgba, w, h, { inversionAttempts: 'dontInvert' });
  if (!code) return null;
  const L = code.location;
  const center = {
    x: (L.topLeftCorner.x + L.topRightCorner.x + L.bottomLeftCorner.x + L.bottomRightCorner.x) / 4,
    y: (L.topLeftCorner.y + L.topRightCorner.y + L.bottomLeftCorner.y + L.bottomRightCorner.y) / 4
  };
  return { data: code.data, center };
}

// QR payload: "CCOMR:<paperId>:<setLetter>"
function parseQr(data) {
  const m = /^CCOMR:(\d+):([A-D])$/.exec(String(data || ''));
  return m ? { paperId: parseInt(m[1], 10), set: m[2] } : null;
}

// Darkness of one bubble: 0 = same as the paper around it, 1 = black.
function bubbleDarkness(g, H, b) {
  const { w, h, gray } = g;
  const c = H(b.x, b.y);
  const s = (dist(H(b.x + 1, b.y), c) + dist(H(b.x, b.y + 1), c)) / 2; // px per mm
  const rIn = b.r * 0.55 * s;
  const rOut0 = b.r * 1.35 * s;
  const rOut1 = b.r * 1.75 * s;
  let inSum = 0, inN = 0;
  const ring = [];
  const R = Math.ceil(rOut1);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = Math.round(c.x + dx), y = Math.round(c.y + dy);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const d = Math.hypot(dx, dy);
      const v = gray[y * w + x];
      if (d <= rIn) { inSum += v; inN++; } else if (d >= rOut0 && d <= rOut1) ring.push(v);
    }
  }
  if (!inN || !ring.length) return 0;
  ring.sort((a, b2) => a - b2);
  const paper = ring[Math.floor(ring.length * 0.75)] || 1; // upper quartile ignores stray ink
  return Math.max(0, Math.min(1, 1 - inSum / inN / paper));
}

const MARK = 0.28; // darkness above which a bubble counts as filled

// Chooses the answer from darkness values of one row of bubbles.
function decide(ds) {
  const order = ds.map((d, i) => ({ d, i })).sort((a, b) => b.d - a.d);
  const [first, second] = order;
  if (first.d < MARK) return { value: null, status: 'blank' };
  if (second && second.d >= MARK && second.d > first.d * 0.65) return { value: null, status: 'multiple' };
  return { value: first.i, status: 'ok' };
}

// buffer: image bytes. questionCount: MCQs on the paper (≤ T.MAX_QUESTIONS).
function scanSheet(buffer, questionCount) {
  let img;
  try {
    img = decode(buffer);
  } catch (e) {
    return { ok: false, error: 'Could not open that image. Upload a JPG or PNG photo.' };
  }
  const g = toGray(img);
  const I = integral(g);
  const qr = readQr(g);
  const mask = binarize(g, I);
  const cands = components(mask, g.w, g.h, Math.max(8, Math.round(Math.max(g.w, g.h) * 0.008)));
  const quad = findMarkers(cands);
  if (!quad) {
    return { ok: false, qr: qr && parseQr(qr.data), error: 'Could not find the 4 black corner squares. Retake the photo with the whole sheet in view, flat and well lit.' };
  }

  // Try each rotation; the QR code tells us which way is up. Without a QR,
  // assume the photo is upright.
  let H = null;
  let bestErr = Infinity;
  for (let rot = 0; rot < 4; rot++) {
    const dst = [0, 1, 2, 3].map((i) => quad[(i + rot) % 4]);
    const h = homography(T.markerCenters, dst);
    if (!h) continue;
    if (!qr) { if (rot === 0) H = h; continue; }
    const err = dist(h(T.qrCenter.x, T.qrCenter.y), qr.center);
    if (err < bestErr) { bestErr = err; H = h; }
  }
  if (!H) return { ok: false, error: 'Could not line up the sheet. Retake the photo straight on.' };

  const n = Math.max(0, Math.min(T.MAX_QUESTIONS, questionCount));
  const answers = [];
  const flags = { blank: 0, multiple: 0 };
  for (let q = 0; q < n; q++) {
    const ds = [];
    for (let o = 0; o < T.Q.options; o++) ds.push(bubbleDarkness(g, H, T.questionBubble(q, o)));
    const r = decide(ds);
    answers.push(r.status === 'ok' ? r.value : r.status === 'multiple' ? 'M' : null);
    if (r.status !== 'ok') flags[r.status] += 1;
  }

  let roll = '';
  let rollUnclear = false;
  for (let c = 0; c < T.ROLL.digits; c++) {
    const ds = [];
    for (let d = 0; d < 10; d++) ds.push(bubbleDarkness(g, H, T.rollBubble(c, d)));
    const r = decide(ds);
    if (r.status === 'ok') roll += String(r.value);
    else if (r.status === 'multiple') { roll += '?'; rollUnclear = true; }
  }

  return { ok: true, qr: qr ? parseQr(qr.data) : null, answers, roll, rollUnclear, flags };
}

module.exports = { scanSheet, parseQr, decide, MARK };
