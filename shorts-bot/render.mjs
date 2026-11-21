// Renders one promo video: draws every frame of template.mjs (30 fps) in
// headless Chrome, then ffmpeg joins them and adds the original music (music.mjs).
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pageHtml, AT, DURATION, STEP_TIMES } from "./template.mjs";
import { writeMusic } from "./music.mjs";

const FPS = 30;

export async function renderPromo(browser, script, outFile) {
  const dir = await mkdtemp(path.join(tmpdir(), "promo-"));
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.setContent(pageHtml(script), { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.evaluate(() => window.layout());
    const frames = Math.round(DURATION * FPS);
    for (let i = 0; i < frames; i++) {
      await page.evaluate((x) => window.renderAt(x), i / FPS);
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 90 });
    }
    await page.close();

    const musicFile = path.join(dir, "music.wav");
    await writeMusic(musicFile, {
      duration: DURATION, beatFrom: AT.pain, variant: script.index || 0,
      pops: [AT.pain, AT.steps, ...STEP_TIMES, AT.cta], chimeAt: AT.result,
    });
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-framerate", String(FPS), "-i", path.join(dir, "f%05d.jpg"), "-i", musicFile,
      "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      "-c:a", "aac", "-b:a", "128k", "-t", String(DURATION), "-movflags", "+faststart", outFile,
    ]);
    return outFile;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
