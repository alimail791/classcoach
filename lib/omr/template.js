// OMR sheet geometry, in millimetres on an A4 page (210 × 297). The printed
// sheet (views/omr_sheet.ejs) and the scanner (lib/omr/scan.js) both read
// from here, so they can never drift apart. Change a number here and both
// follow — but sheets printed before the change will no longer scan.
const PAGE = { w: 210, h: 297 };

// Solid black squares in the corners; the scanner finds these to undo
// camera angle, zoom and rotation.
const MARKER = 8;
const MARKERS = [
  { x: 8, y: 8 }, // top-left
  { x: 194, y: 8 }, // top-right
  { x: 194, y: 281 }, // bottom-right
  { x: 8, y: 281 } // bottom-left
];
const markerCenters = MARKERS.map((m) => ({ x: m.x + MARKER / 2, y: m.y + MARKER / 2 }));

// QR code (paper id + set). Its position also tells the scanner which way up
// the photo is.
const QR = { x: 162, y: 40, size: 30 };
const qrCenter = { x: QR.x + QR.size / 2, y: QR.y + QR.size / 2 };

// Roll number: 6 digit columns, bubbles 0-9.
const ROLL = { digits: 6, x0: 22, dx: 7, boxY: 47, y0: 59, dy: 5.2, r: 1.9 };
function rollBubble(col, digit) {
  return { x: ROLL.x0 + col * ROLL.dx, y: ROLL.y0 + digit * ROLL.dy, r: ROLL.r };
}

// Answers: 5 columns × 25 rows = 125 questions, options A-D.
const Q = { cols: 5, rows: 25, x0: 14, colW: 38, labelW: 9, optDx: 6.5, y0: 118, dy: 6.3, r: 2.2, options: 4 };
const MAX_QUESTIONS = Q.cols * Q.rows;
function questionBubble(qIndex, opt) {
  const col = Math.floor(qIndex / Q.rows);
  const row = qIndex % Q.rows;
  return { x: Q.x0 + col * Q.colW + Q.labelW + opt * Q.optDx, y: Q.y0 + row * Q.dy, r: Q.r };
}

module.exports = { PAGE, MARKER, MARKERS, markerCenters, QR, qrCenter, ROLL, rollBubble, Q, MAX_QUESTIONS, questionBubble };
