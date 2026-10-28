// T-052 SEO phase 1: _headers rules, structured data, llms.txt structure, blog/guide hygiene, sitemap lastmod.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;
const rd = (f) => readFileSync(REPO + f, "utf8");

function parseHeaders(text) {
  const rules = []; let cur = null;
  for (const raw of text.split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) { cur = { path: raw.trim(), h: {} }; rules.push(cur); }
    else { const i = raw.indexOf(":"); cur.h[raw.slice(0, i).trim().toLowerCase()] = raw.slice(i + 1).trim(); }
  }
  return rules;
}
const match = (rules, p) => rules.filter((r) => new RegExp("^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(p));

test("_headers: security headers everywhere, moderate caching (not immutable) for unfingerprinted assets, no CSP and no HSTS", () => {
  assert.ok(existsSync(REPO + "_headers"));
  const rules = parseHeaders(rd("_headers"));
  assert.ok(rules.length <= 100, "platform limit: 100 rules");
  for (const p of ["/", "/index.html", "/blog/", "/assets/fonts/inter-latin-wght-normal.woff2", "/home.css", "/404.html"]) {
    const h = Object.assign({}, ...match(rules, p).map((r) => r.h));
    assert.equal(h["x-content-type-options"], "nosniff", p);
    assert.equal(h["referrer-policy"], "strict-origin-when-cross-origin", p);
    assert.equal(h["x-frame-options"], "DENY", p);
    assert.equal(h["permissions-policy"], "camera=(), microphone=(), geolocation=(), payment=()", p);
    assert.ok(!h["content-security-policy"] && !h["strict-transport-security"], p + ": CSP and HSTS are deferred");
  }
  const cc = (p) => Object.assign({}, ...match(rules, p).map((r) => r.h))["cache-control"];
  for (const p of ["/assets/fonts/inter-latin-wght-normal.woff2", "/assets/fonts/manrope-latin-wght-normal.woff2", "/assets/img/ai-lab-hub.webp", "/assets/og/jubilab-og.png"]) assert.equal(cc(p), "public, max-age=604800, stale-while-revalidate=86400", p);
  for (const p of ["/home.css", "/style.css", "/guides/guides.css", "/assets/theme.js", "/assets/consent.js", "/assets/favicon.svg", "/favicon.ico"]) assert.equal(cc(p), "public, max-age=86400, stale-while-revalidate=86400", p);
  for (const p of ["/", "/index.html", "/blog/", "/privacy/", "/llms.txt", "/sitemap.xml"]) assert.equal(cc(p), undefined, p + ": HTML and text files keep the default revalidating policy");
  assert.ok(!/immutable/.test(rd("_headers").replace(/^#.*$/gm, "")));
  assert.ok(!/^_headers$|^_redirects$/m.test(rd(".assetsignore")), "_headers must reach the platform");
});
