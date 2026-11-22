/* Admin blog list: import many ready-made article files at once and schedule
 * them one per day. Reads each file the same way as the single-file import in
 * blog-editor.js (POST SETTINGS comment + <article>), then sends them to
 * POST /admin/blog/bulk. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var files = $("bulk-files"), start = $("bulk-start"), go = $("bulk-go"), out = $("bulk-result");
  if (!files || !go) return;

  // Default start: tomorrow (India time).
  var t = new Date(Date.now() + 330 * 60000 + 86400000);
  start.value = t.toISOString().slice(0, 10);

  function slugify(s) {
    return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }
  function parse(text) {
    var doc = new DOMParser().parseFromString(text, "text/html");
    var settings = {};
    var m = text.match(/POST SETTINGS[\s\S]*?-->/);
    if (m) m[0].split("\n").forEach(function (line) {
      var kv = line.match(/^\s*([A-Za-z ]+):\s*(.+?)\s*$/);
      if (kv) settings[kv[1].trim().toLowerCase()] = kv[2];
    });
    var root = doc.querySelector("article") || doc.body;
    var h1 = root.querySelector("h1");
    var heading = h1 ? h1.textContent.trim() : "";
    if (h1) h1.parentNode.removeChild(h1);
    var title = settings["title"] || heading || doc.title;
    return { title: title, slug: settings["url slug"] || slugify(title), metaDescription: settings["meta description"] || "", bodyHtml: root.innerHTML.trim() };
  }
  function read(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || "")); };
      r.onerror = reject;
      r.readAsText(file);
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  go.addEventListener("click", function () {
    var list = Array.prototype.slice.call(files.files || []);
    if (!list.length) { out.textContent = "Pick the article files first."; return; }
    if (!start.value) { out.textContent = "Pick the date for the first post."; return; }
    // Files are scheduled in name order (01-…, 02-…), whatever order the phone gives them.
    list.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
    go.disabled = true; out.textContent = "Reading " + list.length + " files…";
    Promise.all(list.map(read)).then(function (texts) {
      var posts = texts.map(parse);
      return fetch("/admin/blog/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ posts: posts, startDate: start.value, time: $("bulk-time").value || "09:00", everyDays: $("bulk-every").value })
      });
    }).then(function (res) {
      return res.json().then(function (data) { if (!res.ok) throw new Error(data.message || "Something went wrong."); return data; });
    }).then(function (data) {
      var rows = data.results.map(function (r) {
        var when = r.ok ? new Date(r.when).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
        return "<li>" + (r.ok ? "✅ " + esc(when) + ": " : "⚠️ Skipped: ") + esc(r.title) + (r.ok ? "" : " (" + esc(r.message) + ")") + "</li>";
      }).join("");
      out.innerHTML = "<strong>" + data.scheduled + " article(s) scheduled.</strong> Reloading the list…<ul style='margin:8px 0 0; padding-left:18px;'>" + rows + "</ul>";
      setTimeout(function () { location.href = "/admin/blog?scheduled=" + data.scheduled; }, 4000);
    }).catch(function (err) {
      out.textContent = err.message || "Something went wrong.";
      go.disabled = false;
    });
  });
})();
