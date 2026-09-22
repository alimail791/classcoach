const { fork } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const OCR_TIMEOUT_MS = 60000;

// Runs OCR on an image buffer (JPG/PNG) and returns the recognized text.
// This is for photographed pages — a genuinely scanned/image-only PDF is
// not rasterized by this app (see README); convert such a PDF's page to a
// photo/screenshot first if you need OCR on it.
//
// The actual recognition happens in a separate child process (ocrWorker.js)
// so that if tesseract.js crashes or hangs — which it can, on WASM runtime
// issues or a slow/blocked language-data download — it never takes down
// the main server. tesseract.js downloads its language data on first use
// and caches it locally after that, which needs internet access the first
// time OCR runs.
async function extractTextFromImage(buffer) {
  const tmpPath = path.join(os.tmpdir(), `ocr-${crypto.randomBytes(8).toString('hex')}.img`);
  fs.writeFileSync(tmpPath, buffer);

  try {
    return await new Promise((resolve, reject) => {
      const child = fork(path.join(__dirname, 'ocrWorker.js'), [tmpPath], {
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
      });

      let output = '';
      let settled = false;

      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill();
        fn(arg);
      };

      const timer = setTimeout(() => {
        finish(reject, new Error('OCR timed out after 60 seconds — check your internet connection (language data downloads on first use) or try a smaller image.'));
      }, OCR_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => { output += chunk.toString(); });
      child.on('error', (err) => finish(reject, err));
      child.on('exit', () => {
        if (settled) return;
        try {
          const parsed = JSON.parse(output);
          if (parsed.ok) finish(resolve, parsed.text);
          else finish(reject, new Error(parsed.error || 'OCR failed'));
        } catch (e) {
          finish(reject, new Error('OCR process crashed unexpectedly — try a different image, or check your internet connection.'));
        }
      });
    });
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

module.exports = { extractTextFromImage };
