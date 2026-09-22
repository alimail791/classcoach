// Runs in its own process (spawned by lib/ocr.js). If tesseract.js crashes
// or aborts here, only this process dies — the main Express server is
// unaffected. Communicates over stdio: reads nothing, is passed the image
// path via argv, prints a JSON result line, then exits.
const Tesseract = require('tesseract.js');

async function main() {
  const imagePath = process.argv[2];
  try {
    const { data } = await Tesseract.recognize(imagePath, 'eng', {
      langPath: 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best'
    });
    process.stdout.write(JSON.stringify({ ok: true, text: (data.text || '').trim() }));
    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: err.message || String(err) }));
    process.exit(0);
  }
}

main();
