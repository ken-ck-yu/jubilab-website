// Pins the blog: the generator (restricted Markdown, rejects unknown constructs, deterministic output), every generated page
// (metadata, JSON-LD, image, sources, banned words, links), the nav and footer on every page, the sitemap and llms.txt blocks.
// Layout, overflow and JS-off rendering are checked by review/check-site.py. Needs python3 on PATH.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, cpSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = new URL("..", import.meta.url).pathname;
const rd = (f) => readFileSync(REPO + f, "utf8");
const txt = (s) => s.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const meta = (h, k, v) => h.match(new RegExp(`<meta ${k}="${v}" content="([^"]*)"`))?.[1];
const SLUGS = readdirSync(REPO + "blog/_src", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const PAGES = [{ path: "/blog/", file: "blog/index.html", kind: "CollectionPage" }, ...SLUGS.map((s) => ({ path: `/blog/${s}/`, file: `blog/${s}/index.html`, kind: "BlogPosting", slug: s }))];
const LEGAL_BANNED = /audit trail|\bregulated\b|\bcompliance\b|\bgxp\b|\bvalidated\b|\bfda\b|21\s*cfr|\bhipaa\b|\bgdpr\b/i;
const CLAIMS = /\bfastest\b|\bthe only\b|\bthe first\b|reproducible results|guarantee|studies show|better than/i;
const py = (args, env = {}) => spawnSync("python3", ["-I", ...args], { encoding: "utf8", env: { ...process.env, ...env } });

test("there is at least one post, and the generated files are up to date (build produces no diff)", () => {
  assert.ok(SLUGS.length >= 1);
  const r = py([REPO + "scripts/build-blog.py", "--check"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

for (const { path, file, kind, slug } of PAGES) {
  const h = rd(file);
  const main = h.match(/<main[\s\S]*<\/main>/)[0];
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];

  test(`${path}: title <= 65, description 150-160, canonical, indexable, OG and Twitter match`, () => {
    const title = h.match(/<title>(.*?)<\/title>/)[1];
    const desc = meta(h, "name", "description");
    assert.ok(title.length >= 10 && title.length <= 65, `${title.length}: ${title}`);
    assert.ok(desc.length >= 150 && desc.length <= 160, String(desc.length));
    assert.equal(h.match(/<link rel="canonical" href="([^"]*)"/)[1], "https://jubilab.io" + path);
    assert.ok(!/name="robots"[^>]*noindex/.test(h));
    assert.equal(meta(h, "property", "og:url"), "https://jubilab.io" + path);
    assert.equal(meta(h, "property", "og:title"), title);
    assert.equal(meta(h, "name", "twitter:title"), title);
    assert.equal(meta(h, "property", "og:description"), desc);
    assert.equal(meta(h, "name", "twitter:description"), desc);
    assert.equal(meta(h, "name", "twitter:card"), "summary_large_image");
    assert.equal(meta(h, "property", "og:image"), meta(h, "name", "twitter:image"));
    assert.match(meta(h, "property", "og:image:alt"), /\S{3}/);
  });

  test(`${path}: og:image is a real 1200x630 PNG (SVG is not accepted by social crawlers)`, () => {
    const u = meta(h, "property", "og:image");
    assert.match(u, /^https:\/\/jubilab\.io\/.+\.png$/);
    const f = REPO + u.replace("https://jubilab.io/", "");
    assert.ok(existsSync(f), u);
    const b = readFileSync(f);
    assert.equal(b.subarray(1, 4).toString(), "PNG");
    assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [1200, 630]);
    if (slug) assert.equal(u, `https://jubilab.io/blog/${slug}/og.png`);
  });

  test(`${path}: one h1, no skipped levels, JSON-LD parses with the right types, organization author only`, () => {
    const hs = [...h.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => [+m[1], txt(m[2])]);
    assert.equal(hs.filter(([l]) => l === 1).length, 1);
    let prev = 0;
    for (const [l, t] of hs) { assert.ok(t.length > 0); assert.ok(!prev || l <= prev + 1, `h${prev} -> h${l}`); prev = l; }
    assert.deepEqual(ld.map((n) => n["@type"]).sort(), ["BreadcrumbList", kind].sort());
    const a = ld.find((n) => n["@type"] === kind);
    const org = { "@type": "Organization", "@id": "https://jubilab.io/#organization", name: "Jubilab", url: "https://jubilab.io/" };
    assert.deepEqual(a.publisher, org);
    if (kind === "BlogPosting") {
      assert.deepEqual(a.author, org, "author is the organization, never an invented person");
      assert.equal(a.headline, txt(h.match(/<h1>([\s\S]*?)<\/h1>/)[1]));
      assert.match(a.datePublished, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(a.dateModified >= a.datePublished);
      assert.equal(a.description, meta(h, "name", "description"));
      assert.equal(a.image, meta(h, "property", "og:image"));
    }
    assert.ok(!/aggregateRating|"review"|"offers"|sameAs|"logo"|"Person"/.test(JSON.stringify(ld)));
    assert.equal(ld.find((n) => n["@type"] === "BreadcrumbList").itemListElement.at(-1).item, "https://jubilab.io" + path);
  });

  test(`${path}: no banned legal words and no claim words in the page content; no script, style or event handler in main`, () => {
    const m = txt(main.replace(/<script[\s\S]*?<\/script>/g, ""));
    assert.ok(!LEGAL_BANNED.test(m), `banned: ${m.match(LEGAL_BANNED)?.[0]}`);
    assert.ok(!CLAIMS.test(m), `claim: ${m.match(CLAIMS)?.[0]}`);
    assert.ok(!/<script|<style|\son[a-z]+=|javascript:/i.test(main));
  });

  test(`${path}: internal links resolve, outbound links are https with rel=noopener and no tracking, nav and footer link to Blog`, () => {
    const dir = file.replace(/index\.html$/, "");
    for (const m of h.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
      const u = m[1];
      if (/^(mailto:|tel:)/.test(u)) continue;
      if (/^https?:/.test(u)) { assert.ok(/^https:/.test(u), u); continue; }
      const target = new URL(u, "https://x.test/" + dir).pathname.slice(1);
      assert.ok(existsSync(REPO + target) || existsSync(REPO + target + "index.html") || target === "", `${u} -> ${target}`);
    }
    for (const m of main.matchAll(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>/g)) {
      assert.match(m[0], /rel="noopener"/); assert.ok(m[1].startsWith("https://")); assert.ok(!/[?&](utm_|fbclid|gclid)/.test(m[1]), m[1]);
    }
    assert.match(h, /<nav class="site-nav"[\s\S]*?href="[^"]*blog\/"[^>]*aria-current="page">Blog<\/a>[\s\S]*?<details/);
    assert.match(h, /<footer>[\s\S]*href="[^"]*blog\/">Blog<\/a>/);
    assert.match(h, /href="(\.\.\/)+blog\/blog\.css"|href="\.\.\/blog\/blog\.css"/);
  });
}

for (const s of SLUGS) {
  const h = rd(`blog/${s}/index.html`);
  const main = h.match(/<main[\s\S]*<\/main>/)[0];
  test(`post ${s}: image with alt, reading time, sources with access dates, questions section, early-access box, one CTA`, () => {
    const img = main.match(/<figure class="b-figure"><img src="image\.svg"[^>]*alt="([^"]+)"/);
    assert.ok(img && img[1].length >= 30);
    assert.ok(existsSync(REPO + `blog/${s}/image.svg`));
    assert.doesNotMatch(readFileSync(REPO + `blog/${s}/image.svg`, "utf8"), /<text|<script|<image|href=/i);
    assert.match(main, /\d+ min read/);
    assert.match(main, /<h2 id="questions-h">Questions we are still asking/);
    assert.match(main, /<h2 id="helps-h">Where Jubilab is now/);
    assert.ok(!/Available now|How Jubilab helps|not being offered|being built|released yet|prototype is/.test(main.match(/<section class="helps"[\s\S]*?<\/section>/)[0]), "neutral box: no product-state hedge");
    assert.equal((main.match(/class="btn"/g) || []).length, 1);
    const src = main.match(/<ol class="g-sources">([\s\S]*?)<\/ol>/)[1];
    const n = (src.match(/<li id="src-/g) || []).length;
    assert.ok(n >= 3);
    assert.equal((src.match(/Accessed \d{1,2} [A-Z][a-z]+ \d{4}/g) || []).length, n);
    assert.equal((src.match(/rel="noopener"/g) || []).length, n);
    const t = txt(main);
    assert.match(t, /Jubilab is one place to order lab work and follow it to results\. Register for early access: we invite small groups first\./);
    assert.match(t, /not affiliated with or endorsed by/);
    assert.ok(!/(?<!not )(detects?|flags?) sample swaps/i.test(t), "a post may say Jubilab does not detect sample swaps, never that it does");
  });
}

test("the footer and header nav of every page link to Blog; the other pages carry the new nav (How it works, For labs, For teams, AI & developers, Blog)", () => {
  for (const f of ["index.html", "privacy/index.html", "terms/index.html", "thanks/index.html", "404.html", "guides/index.html", ...readdirSync(REPO + "guides").filter((d) => existsSync(REPO + `guides/${d}/index.html`)).map((d) => `guides/${d}/index.html`)]) {
    const h = rd(f);
    assert.match(h, /<footer>[\s\S]*href="[^"]*blog\/">Blog<\/a>/, f);
    if (f === "index.html") continue; // the home page header is the owner's four links plus the early-access button; Blog is in its footer
    assert.match(h, /<nav class="site-nav"[\s\S]*?href="[^"]*blog\/">Blog<\/a>[\s\S]*?<\/nav>/, f);
    assert.equal((h.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)[0].match(/>Blog<\/a>/g) || []).length, 2, f + ": once in the wide-screen list, once in the menu");
    assert.deepEqual([...h.match(/<ul class="links">[\s\S]*?<\/ul>/)[0].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => m[2]), ["How it works", "For labs", "For teams", "AI & developers", "Blog"].map((x) => x.replace("&", "&amp;")), f + ": nav");
    for (const m of h.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)[0].matchAll(/href="((?:\.\.\/)*)#([a-z]+)"/g)) assert.ok(["how", "labs", "teams", "developers", "access"].includes(m[2]), f + " nav anchor " + m[2]);
  }
});

test("sitemap and llms.txt list the blog index and each post (generated blocks in sync, one entry each)", () => {
  const sm = rd("sitemap.xml"), ll = rd("llms.txt");
  for (const { path } of PAGES) {
    assert.equal((sm.match(new RegExp(`<loc>https://jubilab\\.io${path.replace(/\//g, "\\/")}</loc>\\s*<lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`, "g")) || []).length, 1, path);
    assert.ok(ll.includes(`](https://jubilab.io${path})`), path);
  }
  assert.match(ll, /<!-- blog:start -->\n## Blog/);
  assert.equal((sm.match(/<loc>/g) || []).length, new Set([...sm.matchAll(/<loc>([^<]+)/g)].map((m) => m[1])).size, "no duplicate sitemap entries");
});

test("go-public.py leaves the blog in the sitemap (idempotent on the launched state)", () => {
  const r = py([REPO + "scripts/go-public.py"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Nothing to change/);
});

// ---- generator: rejects unknown constructs, so authors cannot inject HTML or scripts ------------------------------------
const S = "what-is-data-provenance-in-bioinformatics"; // fixture: the mutations below edit this post (other posts are untouched)
function lint(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "blogtest-"));
  try {
    for (const f of ["blog", "guides", "sitemap.xml", "llms.txt", "assets"]) cpSync(REPO + f, join(dir, f), { recursive: true });
    const p = join(dir, `blog/_src/${S}/post.md`);
    const next = mutate(readFileSync(p, "utf8"), join(dir, `blog/_src/${S}`));
    if (typeof next === "string") writeFileSync(p, next);
    return py([REPO + "scripts/build-blog.py", "--lint"], { JUBILAB_SITE_ROOT: dir });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const bad = (name, mutate, re) => test(`generator rejects: ${name}`, () => { const r = lint(mutate); assert.equal(r.status, 1, r.stdout); assert.match(r.stderr, re); });

test("generator accepts the sample post unchanged", () => { const r = lint((t) => t); assert.equal(r.status, 0, r.stderr); });
bad("raw HTML in a paragraph", (t) => t.replace("A working definition", "A working definition\n\nHello <b>x</b> world."), /raw HTML/);
bad("a script tag", (t) => t.replace("A working definition", "A working definition\n\n<script>alert(1)</script>"), /not supported|raw HTML/);
bad("an image", (t) => t.replace("A working definition", "A working definition\n\n![x](https://example.com/a.png)"), /not supported/);
bad("a table", (t) => t.replace("A working definition", "A working definition\n\n| a | b |"), /not supported/);
bad("a javascript: link", (t) => t.replace("the PROV family of documents", "[the PROV family](javascript:alert)"), /links must be/);
bad("a link with tracking parameters", (t) => t.replace("the PROV family of documents", "[the PROV family](https://example.com/?utm_source=x)"), /tracking/);
bad("an internal link that does not exist", (t) => t.replace("the PROV family of documents", "[the PROV family](/nope/)"), /does not resolve/);
bad("a heading level 1", (t) => t.replace("## A working definition", "# A working definition"), /only '## '/);
bad("a #### heading", (t) => t.replace("## A working definition", "#### A working definition"), /only '## '/);
bad("an unknown front-matter key", (t) => t.replace("tags:", "author: Someone\ntags:"), /unknown key/);
bad("a title over the limit", (t) => t.replace(/^title: .*/m, "title: " + "A very long title that goes past the allowed length for it"), /title \+/);
bad("a short description", (t) => t.replace(/^description: .*/m, "description: Too short."), /description is/);
bad("missing Sources", (t) => t.slice(0, t.indexOf("## Sources")), /last two/);
bad("fewer than three sources", (t) => t.replace(/\n- \[Snakemake documentation[^\n]*/, "").replace(/\n- \[Nextflow documentation[^\n]*/, "").replace(/\[\^[34]\]/g, ""), /at least 3 sources/);
bad("an uncited source", (t) => t.replace(/\[\^4\]/g, ""), /never cited/);
bad("a banned legal word", (t) => t.replace("A working definition", "A working definition\n\nThis helps compliance work."), /banned wording/);
bad("a claim word", (t) => t.replace("A working definition", "A working definition\n\nWe are the fastest tool."), /banned wording/);
bad("an unbalanced asterisk", (t) => t.replace("A working definition", "A working definition\n\nPrice * quantity"), /'\*'/);
bad("a post that is too short", (t) => t.replace(/## What a useful record looks like[\s\S]*?(?=## Questions)/, ""), /words/);
bad("an SVG with text", (t, dir) => writeFileSync(dir + "/image.svg", readFileSync(dir + "/image.svg", "utf8").replace("</svg>", "<text>hi</text></svg>")), /not allowed/);
bad("an SVG with a script", (t, dir) => writeFileSync(dir + "/image.svg", readFileSync(dir + "/image.svg", "utf8").replace("</svg>", "<script>1</script></svg>")), /not allowed/);
bad("an SVG with a colour outside the palette", (t, dir) => writeFileSync(dir + "/image.svg", readFileSync(dir + "/image.svg", "utf8").replace('fill="#e8520a"', 'fill="#123456"')), /palette/);
bad("a slug that differs from the folder", (t) => t.replace(/^slug: .*/m, "slug: something-else"), /slug/);

test("generated output escapes everything: titles with ampersands and quotes cannot break attributes", () => {
  const dir = mkdtempSync(join(tmpdir(), "blogtest-"));
  try {
    for (const f of ["blog", "guides", "sitemap.xml", "llms.txt", "assets"]) cpSync(REPO + f, join(dir, f), { recursive: true });
    const p = join(dir, `blog/_src/${S}/post.md`);
    writeFileSync(p, readFileSync(p, "utf8").replace(/^image_alt: .*/m, 'image_alt: A "quoted" picture & more words so that the alternative text is long enough to pass'));
    const r = py([REPO + "scripts/build-blog.py"], { JUBILAB_SITE_ROOT: dir });
    assert.equal(r.status, 0, r.stderr);
    const out = readFileSync(join(dir, `blog/${S}/index.html`), "utf8");
    assert.match(out, /alt="A &quot;quoted&quot; picture &amp; more words/);
    const out2 = (py([REPO + "scripts/build-blog.py", "--check"], { JUBILAB_SITE_ROOT: dir }));
    assert.equal(out2.status, 0, "second build is identical (deterministic)");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
