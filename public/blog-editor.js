/* Blog post editor for the admin dashboard (no dependencies).
 *
 * Expects these elements inside the page:
 *   #be-title, #be-slug, #be-meta, #be-meta-count, #be-cover (optional),
 *   #be-visual (contenteditable), #be-source (textarea, HTML view),
 *   #be-body (hidden textarea that is submitted / read), #be-import (file input),
 *   .be-tool buttons with data-cmd / data-arg, #be-mode-toggle.
 * Exposes window.BlogEditor = { getData(), setData(post), sync() }.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var title = $("be-title"), slug = $("be-slug"), meta = $("be-meta"), metaCount = $("be-meta-count");
  var cover = $("be-cover"), visual = $("be-visual"), source = $("be-source"), body = $("be-body");
  var importInput = $("be-import"), modeBtn = $("be-mode-toggle");
  if (!title || !visual || !body) return;

  var slugTouched = !!(slug && slug.value);
  var htmlMode = false;

  function slugify(t) {
    return String(t || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }
  function updateCount() {
    if (!meta || !metaCount) return;
    var n = meta.value.length;
    metaCount.textContent = n + " / 160 characters" + (n > 160 ? " (Google may cut it off)" : "");
    metaCount.style.color = n > 160 ? "#B3261E" : "";
  }
  function sync() {
    body.value = htmlMode ? source.value : visual.innerHTML;
  }
  function setBody(html) {
    visual.innerHTML = html || "";
    if (source) source.value = html || "";
    body.value = html || "";
  }

  title.addEventListener("input", function () {
    if (slug && !slugTouched) slug.value = slugify(title.value);
  });
  if (slug) slug.addEventListener("input", function () { slugTouched = slug.value.length > 0; });
  if (meta) { meta.addEventListener("input", updateCount); updateCount(); }
  visual.addEventListener("input", sync);
  if (source) source.addEventListener("input", sync);

  // Toolbar
  Array.prototype.forEach.call(document.querySelectorAll(".be-tool"), function (btn) {
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
    btn.addEventListener("click", function () {
      if (htmlMode) return;
      visual.focus();
      var cmd = btn.getAttribute("data-cmd"), arg = btn.getAttribute("data-arg");
      if (cmd === "createLink") {
        var url = window.prompt("Link address (starts with https://)", "https://");
        if (!url) return;
        document.execCommand("createLink", false, url);
      } else if (cmd === "insertCta") {
        var text = window.prompt("Button text", "Start free");
        if (!text) return;
        var href = window.prompt("Button link", "https://");
        if (!href) return;
        document.execCommand("insertHTML", false,
          '<div class="cta"><p><strong>Add a short line here.</strong></p><p><a href="' +
          href.replace(/"/g, "&quot;") + '">' + text.replace(/</g, "&lt;") + "</a></p></div><p></p>");
      } else if (cmd === "insertImage") {
        var src = window.prompt("Image address (https://…)", "https://");
        if (!src) return;
        var alt = window.prompt("Describe the image in a few words (for Google and screen readers)", "") || "";
        document.execCommand("insertHTML", false, '<img src="' + src.replace(/"/g, "&quot;") + '" alt="' + alt.replace(/"/g, "&quot;") + '">');
      } else {
        document.execCommand(cmd, false, arg || null);
      }
      sync();
    });
  });

  if (modeBtn) modeBtn.addEventListener("click", function () {
    if (!htmlMode) {
      source.value = visual.innerHTML;
      visual.style.display = "none"; source.style.display = "block";
      modeBtn.textContent = "Back to normal view";
    } else {
      visual.innerHTML = source.value;
      source.style.display = "none"; visual.style.display = "block";
      modeBtn.textContent = "Edit HTML";
    }
    htmlMode = !htmlMode;
    sync();
  });

  // Import a ready-made article file (.html) — fills title, slug, description and body.
  function importHtml(text) {
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
    title.value = settings["title"] || heading || doc.title || title.value;
    if (slug) { slug.value = settings["url slug"] || slugify(title.value); slugTouched = true; }
    if (meta && settings["meta description"]) { meta.value = settings["meta description"]; updateCount(); }
    setBody(root.innerHTML.trim());
  }
  if (importInput) importInput.addEventListener("change", function () {
    var file = importInput.files && importInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { importHtml(String(reader.result || "")); importInput.value = ""; };
    reader.readAsText(file);
  });

  // Keep the hidden field current when a normal <form> is submitted.
  var form = body.form;
  if (form) form.addEventListener("submit", function () {
    sync();
    if (slug && !slug.value) slug.value = slugify(title.value);
  });

  window.BlogEditor = {
    sync: sync,
    getData: function () {
      sync();
      return {
        title: title.value.trim(),
        slug: (slug && slug.value.trim()) || slugify(title.value),
        metaDescription: meta ? meta.value.trim() : "",
        coverImageUrl: cover ? cover.value.trim() : "",
        bodyHtml: body.value,
      };
    },
    setData: function (p) {
      title.value = p.title || "";
      if (slug) { slug.value = p.slug || ""; slugTouched = !!p.slug; }
      if (meta) { meta.value = p.metaDescription || ""; updateCount(); }
      if (cover) cover.value = p.coverImageUrl || "";
      setBody(p.bodyHtml || "");
    },
  };
})();
