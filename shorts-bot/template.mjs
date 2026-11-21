// HTML for one promo video (1080x1920). window.renderAt(t) draws the exact
// frame for second t, so frames are captured deterministically. Text stays
// clear of the bottom ~400px and right ~140px, where the Reels/Shorts buttons
// and caption sit. Colours and fonts are ClassCoach's own (public/style.css).

export const SCENES = { hook: 3.5, pain: 3.5, steps: 9, result: 3.5, cta: 4 };
export const AT = (() => { let t = 0; const o = {}; for (const [k, v] of Object.entries(SCENES)) { o[k] = t; t += v; } return o; })();
export const DURATION = Object.values(SCENES).reduce((a, b) => a + b, 0); // 23.5 s
export const STEP_TIMES = [0.3, 3.1, 5.9].map((x) => AT.steps + x);

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const br = (s) => esc(String(s).replace(/\s*\n\s*/g, " "));

export function pageHtml(s) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Karla:wght@500;600;700;800&family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; }
  body { font-family: Karla, "Noto Sans", "DejaVu Sans", sans-serif; color: #211C15; background: #F6F2EA; }
  .serif { font-family: Newsreader, Georgia, "DejaVu Serif", serif; }
  .scene { position: absolute; inset: 0; padding: 120px 140px 420px 80px; display: flex; flex-direction: column; justify-content: center; }
  .top { position: absolute; top: 90px; left: 80px; right: 140px; display: flex; align-items: center; gap: 22px; z-index: 5; }
  .mark { flex: 0 0 auto; width: 78px; height: 78px; border-radius: 50%; background: #B4501C; color: #FBF6EE; display: grid; place-items: center; font-size: 44px; font-weight: 600; }
  .brand { font-size: 50px; font-weight: 600; letter-spacing: -.5px; }
  .pill { margin-left: auto; background: #F5E6D3; color: #8C3C13; font-weight: 700; font-size: 32px; padding: 12px 26px; border-radius: 999px; white-space: nowrap; }
  .progress { position: absolute; top: 0; left: 0; height: 12px; background: #B4501C; z-index: 6; }
  .dark .brand { color: #FBF6EE; }
  .onAccent .mark { background: #211C15; }
  .hook h1 { text-wrap: balance; font-size: 104px; line-height: 1.06; font-weight: 600; letter-spacing: -1.5px; }
  .hook h1 em { font-style: normal; color: #B4501C; }
  .hook .under { margin-top: 50px; width: 220px; height: 14px; background: #B4501C; border-radius: 8px; transform-origin: left; }
  #pain { background: #211C15; color: #FBF6EE; }
  #pain .q { font-size: 48px; font-weight: 700; color: #D8A24A; letter-spacing: 2px; text-transform: uppercase; }
  #pain .p { margin-top: 34px; font-size: 76px; line-height: 1.18; font-weight: 500; }
  #steps h2 { font-size: 46px; font-weight: 700; color: #8C3C13; text-transform: uppercase; letter-spacing: 2px; }
  #steps .label { font-size: 82px; font-weight: 600; line-height: 1.05; margin-top: 14px; letter-spacing: -1px; }
  .list { margin-top: 56px; display: flex; flex-direction: column; gap: 30px; }
  .step { display: flex; align-items: center; gap: 34px; background: #fff; border: 3px solid #E5DBC9; border-radius: 34px; padding: 38px 40px; box-shadow: 0 18px 40px rgba(33,28,21,.08); }
  .step .n { flex: 0 0 96px; height: 96px; border-radius: 50%; background: #B4501C; color: #FBF6EE; display: grid; place-items: center; font-size: 52px; font-weight: 800; }
  .step .t { font-size: 50px; font-weight: 600; line-height: 1.2; }
  #result { background: #B4501C; color: #FBF6EE; }
  #result .tick { width: 170px; height: 170px; border-radius: 50%; background: #FBF6EE; color: #B4501C; display: grid; place-items: center; font-size: 110px; font-weight: 800; }
  #result .r { text-wrap: balance; margin-top: 56px; font-size: 98px; line-height: 1.08; font-weight: 600; letter-spacing: -1px; }
  #cta { background: #211C15; color: #FBF6EE; align-items: center; text-align: center; padding-left: 110px; padding-right: 110px; }
  #cta .big { white-space: nowrap; font-size: 116px; font-weight: 600; letter-spacing: -2px; }
  #cta .big b { color: #E07A3F; font-weight: 600; }
  #cta .sub { margin-top: 30px; font-size: 46px; font-weight: 600; line-height: 1.3; }
  #cta .btn { white-space: nowrap; margin-top: 56px; background: #B4501C; color: #FBF6EE; font-size: 46px; font-weight: 800; padding: 30px 54px; border-radius: 999px; }
  #cta .small { margin-top: 48px; font-size: 40px; opacity: .8; font-weight: 500; }
</style></head><body>
<div class="progress" id="bar"></div>
<div class="top" id="top"><div class="mark serif">C</div><div class="brand serif">ClassCoach</div><div class="pill">${esc(s.label)}</div></div>

<section class="scene hook" id="hook">
  <h1 class="serif" id="hookText">${br(s.hook)}</h1>
  <div class="under" id="under"></div>
</section>

<section class="scene" id="pain">
  <div class="q">Sound familiar?</div>
  <div class="p serif" id="painText">${esc(s.pain)}</div>
</section>

<section class="scene" id="steps">
  <h2>With ClassCoach</h2>
  <div class="label serif">${esc(s.label)}</div>
  <div class="list">${s.steps.map((x, i) => `<div class="step" id="s${i}"><div class="n">${i + 1}</div><div class="t">${esc(x)}</div></div>`).join("")}</div>
</section>

<section class="scene" id="result">
  <div class="tick" id="tick">✓</div>
  <div class="r serif" id="resText">${esc(s.result)}</div>
</section>

<section class="scene" id="cta">
  <div class="mark serif" style="width:150px;height:150px;font-size:88px;margin-bottom:40px" id="ctaMark">C</div>
  <div class="big serif">ClassCoach<b>.in</b></div>
  <div class="sub">Tests · grading · OMR · papers<br>parent reports — one app</div>
  <div class="btn" id="ctaBtn">Start free · no card needed</div>
  <div class="small">Follow for a teacher tool every day</div>
</section>

<script>
  const AT = ${JSON.stringify(AT)}, D = ${JSON.stringify(SCENES)}, DUR = ${DURATION}, STEPS = ${JSON.stringify(STEP_TIMES)};
  const $ = (id) => document.getElementById(id);
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const enter = (el, t, start, dur = 0.45, dy = 60) => {
    const k = ease((t - start) / dur);
    el.style.opacity = String(k);
    el.style.transform = "translateY(" + ((1 - k) * dy) + "px)";
  };
  const show = (id, on) => { $(id).style.display = on ? "flex" : "none"; };
  // Shrink a text box until its scene fits the safe area.
  function fit(sceneId, textId, max, min) {
    const sc = $(sceneId), el = $(textId); let s = max;
    show(sceneId, true); el.style.fontSize = s + "px";
    while (sc.scrollHeight > sc.clientHeight + 1 && s > min) { s -= 3; el.style.fontSize = s + "px"; }
  }
  window.layout = () => {
    fit("hook", "hookText", 104, 64); fit("pain", "painText", 76, 48); fit("result", "resText", 98, 60);
    const sc = $("steps"); show("steps", true);
    let f = 50; const set = () => document.querySelectorAll(".step .t").forEach((e) => e.style.fontSize = f + "px");
    set(); while (sc.scrollHeight > sc.clientHeight + 1 && f > 34) { f -= 2; set(); }
  };
  window.renderAt = (t) => {
    const cur = t < AT.pain ? "hook" : t < AT.steps ? "pain" : t < AT.result ? "steps" : t < AT.cta ? "result" : "cta";
    for (const id of ["hook", "pain", "steps", "result", "cta"]) show(id, id === cur);
    $("bar").style.width = (100 * t / DUR) + "%";
    const dark = cur === "pain" || cur === "result" || cur === "cta";
    $("top").classList.toggle("dark", dark);
    $("top").classList.toggle("onAccent", cur === "result");
    $("top").style.display = cur === "cta" ? "none" : "flex";
    if (cur === "hook") {
      enter($("hookText"), t, 0.05, 0.5, 80);
      const k = ease((t - 0.6) / 0.5); $("under").style.transform = "scaleX(" + k + ")";
    }
    if (cur === "pain") enter($("painText"), t, AT.pain + 0.1, 0.5, 70);
    if (cur === "steps") STEPS.forEach((st, i) => enter($("s" + i), t, st, 0.4, 80));
    if (cur === "result") {
      const k = ease((t - AT.result) / 0.35); $("tick").style.transform = "scale(" + (0.4 + 0.6 * k) + ")"; $("tick").style.opacity = String(k);
      enter($("resText"), t, AT.result + 0.2, 0.5, 60);
    }
    if (cur === "cta") {
      enter($("ctaMark"), t, AT.cta, 0.4, 40);
      const p = 1 + 0.04 * Math.sin((t - AT.cta) * Math.PI * 2 / 1.2);
      $("ctaBtn").style.transform = "scale(" + p + ")";
    }
  };
</script></body></html>`;
}
