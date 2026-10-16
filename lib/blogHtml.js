// Blog post HTML helpers: a whitelist sanitizer for post bodies, plus slug
// and excerpt helpers. Posts are written by the site admin, but the HTML is
// still cleaned before it is stored so that pasted content can never carry
// scripts, inline event handlers, iframes or javascript: links onto the site.

const ALLOWED_TAGS = new Set([
  "h2", "h3", "h4", "p", "br", "hr", "ul", "ol", "li", "strong", "b", "em", "i", "u",
  "a", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "img", "figure",
  "figcaption", "code", "pre", "div", "span", "sup", "sub",
]);
const VOID_TAGS = new Set(["br", "hr", "img"]);
// Tags whose whole contents are dropped, not just the tag itself.
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "head", "title"]);
const ALLOWED_ATTRS = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  "*": ["class"],
};
const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;

function escapeAttr(v) {
  return String(v).replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z]+);)/gi, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cleanAttrs(tag, raw) {
  const allowed = new Set([...(ALLOWED_ATTRS[tag] || []), ...ALLOWED_ATTRS["*"]]);
  const out = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    if (!allowed.has(name)) continue;
    let value = m[2] ?? m[3] ?? m[4] ?? "";
    value = value.replace(/&quot;/g, '"').trim();
    if ((name === "href" || name === "src") && !SAFE_URL.test(value)) continue;
    if (name === "target" && value !== "_blank") continue;
    if (name === "class") value = value.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 80);
    out.push(`${name}="${escapeAttr(value)}"`);
  }
  if (tag === "a" && out.some((a) => a.startsWith('target="_blank"')) && !out.some((a) => a.startsWith("rel="))) {
    out.push('rel="noopener"');
  }
  return out.length ? " " + out.join(" ") : "";
}

function sanitizeHtml(input) {
  let html = String(input || "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<!doctype[^>]*>/gi, "");
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  // Convert h1 to h2: the page title is the post's only h1.
  html = html.replace(/<(\/?)h1\b/gi, "<$1h2");
  const stack = [];
  html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (_m, close, name, attrs) => {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (close) {
      const i = stack.lastIndexOf(tag);
      if (i === -1) return "";
      const closing = stack.splice(i).reverse().map((t) => `</${t}>`).join("");
      return closing;
    }
    if (VOID_TAGS.has(tag)) {
      const a = cleanAttrs(tag, attrs);
      if (tag === "img" && !/\ssrc="/.test(a)) return "";
      return `<${tag}${a}>`;
    }
    stack.push(tag);
    return `<${tag}${cleanAttrs(tag, attrs)}>`;
  });
  html += stack.reverse().map((t) => `</${t}>`).join("");
  // Stray < that isn't a tag would otherwise start one in the browser.
  return html.trim();
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

function excerptFrom(html, max = 180) {
  const text = String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}

function readingMinutes(html) {
  const words = String(html || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

module.exports = { sanitizeHtml, slugify, excerptFrom, readingMinutes, escapeHtml };
