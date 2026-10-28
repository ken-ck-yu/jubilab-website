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

const walk = (d) => readdirSync(REPO + d, { withFileTypes: true }).flatMap((e) => e.isDirectory() && e.name !== "_src" ? walk(d + "/" + e.name) : e.name === "index.html" ? [d + "/" + e.name] : []);
const ALLPAGES = ["index.html", "404.html", "thanks/index.html", "privacy/index.html", "terms/index.html", ...walk("blog"), ...walk("guides")].map((f) => f.replace(/^\//, ""));
const ldOf = (f) => [...rd(f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test("JSON-LD: every page's blocks parse; the home Organization has logo, description, parentOrganization; no sameAs, no product or rating types", () => {
  for (const f of ALLPAGES) ldOf(f);
  const g = ldOf("index.html")[0]["@graph"];
  const org = g.find((n) => n["@type"] === "Organization");
  assert.equal(org["@id"], "https://jubilab.io/#organization");
  assert.equal(org.url, "https://jubilab.io/");
  assert.equal(org.logo.url, "https://jubilab.io/assets/logo-512.png");
  assert.equal(org.description, "Jubilab is the sample operations layer that connects the people, labs, couriers and AI agents handling a sample, from order to data.");
  assert.ok(rd("index.html").includes(`content="Early access by invitation. ${org.description}"`), "same sentence as the meta description");
  assert.deepEqual(org.parentOrganization, { "@type": "Organization", name: "Billy BioTech Ltd." });
  assert.ok(!("sameAs" in org), "no sameAs until real profiles exist (see docs/launch-checklist.md)");
  assert.ok(g.some((n) => n["@type"] === "WebSite" && n.publisher["@id"] === org["@id"]));
  assert.ok(!/SoftwareApplication|AggregateRating|"Review"|"offers"/.test(JSON.stringify(ldOf("index.html"))));
  const logo = readFileSync(REPO + "assets/logo-512.png");
  assert.ok(logo.length < 20000, "logo under 20 KB: " + logo.length);
  assert.equal(logo.readUInt32BE(16), 512); assert.equal(logo.readUInt32BE(20), 512);
});

test("JSON-LD: Organization nodes on blog and guide pages carry the home page's @id so the entities connect", () => {
  for (const f of ALLPAGES.filter((x) => /^(blog|guides)\//.test(x))) {
    const orgs = [];
    const visit = (n) => { if (n && typeof n === "object") { if (n["@type"] === "Organization" && n.name === "Jubilab") orgs.push(n); Object.values(n).forEach(visit); } };
    ldOf(f).forEach(visit);
    assert.ok(orgs.length >= 1, f);
    for (const o of orgs) assert.equal(o["@id"], "https://jubilab.io/#organization", f);
  }
});

test("blog and guides: 'Where Jubilab is now' is not a heading (no duplicate h2 across posts), every page has an About Jubilab link to the home page, no stale preview comment", () => {
  const pages = ALLPAGES.filter((x) => /^(blog|guides)\//.test(x));
  assert.ok(pages.length >= 26);
  for (const f of pages) {
    const h = rd(f);
    // the boxed block is no longer a heading; at most one h2 of that text remains per page (a few post bodies carry their own section of that name: copy decision, not touched here)
    assert.ok((h.match(/<h[1-6][^>]*>\s*Where Jubilab is now/g) || []).length <= 1, f);
    if (/class="helps"/.test(h)) assert.match(h, /<p class="helps-t" id="helps-h">Where Jubilab is now<\/p>/, f);
    assert.match(h, /About Jubilab: <a href="(?:\.\.\/)+">Jubilab, the sample operations layer for ordering from outside labs<\/a>\./, f);
  }
  for (const f of ["404.html", "thanks/index.html"]) assert.ok(!/PREVIEW: noindex/.test(rd(f)), f);
  assert.match(rd("404.html"), /<meta name="robots" content="noindex">/, "the 404 stays noindex");
  // generated posts use each post's own updated date for the sitemap
  const gen = rd("scripts/build-blog.py");
  assert.match(gen, /ents \+= \[\(f"\/blog\/\{p\['slug'\]\}\/", p\["meta"\]\["updated"\]\)/);
});
