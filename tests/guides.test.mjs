// Pins the guides hub and the three guides: metadata limits, canonical and Open Graph, JSON-LD, structure, sitemap, links,
// code-block accessibility, banned claim words and the shipped-versus-planned box. Static checks only; layout is checked by review/check-site.py.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;
const rd = (f) => readFileSync(REPO + f, "utf8");
const GUIDES = ["reference-genome-build-vcf-bam", "what-parameters-produced-this-result", "nextflow-provenance-and-lineage-compared"];
const PAGES = [{ path: "/guides/", file: "guides/index.html", kind: "CollectionPage" }, ...GUIDES.map((g) => ({ path: `/guides/${g}/`, file: `guides/${g}/index.html`, kind: "TechArticle" }))];
const txt = (s) => s.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const meta = (h, k, v) => h.match(new RegExp(`<meta ${k}="${v}" content="([^"]*)"`))?.[1];
const BANNED = /audit|regulat|complian|\bgxp\b|validat|\bfastest\b|\bthe only\b|\bthe first\b|\bfirst and only\b|reproducible results|guarantee|better than|\bbeats?\b|swap rate|3%/i;

for (const { path, file, kind } of PAGES) {
  const h = rd(file);
  const main = h.match(/<main[\s\S]*<\/main>/)[0];
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];

  test(`${path}: title <= 65, description 150-160, canonical, indexable, OG and Twitter match`, () => {
    const title = h.match(/<title>(.*?)<\/title>/)[1];
    const desc = meta(h, "name", "description");
    assert.ok(title.length >= 10 && title.length <= 65, `${title.length}: ${title}`);
    assert.ok(desc.length >= 150 && desc.length <= 160, String(desc.length));
    assert.equal(h.match(/<link rel="canonical" href="([^"]*)"/)[1], "https://jubilab.io" + path);
    assert.ok(!/name="robots"[^>]*noindex/.test(h), "noindex must be absent");
    assert.equal(meta(h, "property", "og:url"), "https://jubilab.io" + path);
    for (const k of ["og:title", "twitter:title"]) assert.equal(meta(h, k.startsWith("og") ? "property" : "name", k), title);
    for (const k of ["og:description", "twitter:description"]) assert.equal(meta(h, k.startsWith("og") ? "property" : "name", k), desc);
  });

  test(`${path}: one h1, no skipped heading levels, JSON-LD parses with the right types`, () => {
    const hs = [...h.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => [+m[1], txt(m[2])]);
    assert.equal(hs.filter(([l]) => l === 1).length, 1);
    let prev = 0;
    for (const [l, t] of hs) { assert.ok(t.length > 0); assert.ok(!prev || l <= prev + 1, `h${prev} -> h${l}`); prev = l; }
    const types = ld.map((n) => n["@type"]);
    assert.deepEqual(types.sort(), ["BreadcrumbList", kind].sort());
    const a = ld.find((n) => n["@type"] === kind);
    const org = { "@type": "Organization", name: "Jubilab", url: "https://jubilab.io/" };
    assert.deepEqual(a.publisher, org);
    if (kind === "TechArticle") {
      assert.deepEqual(a.author, org, "author is the organization, never an invented person");
      assert.equal(a.headline, txt(h.match(/<h1>([\s\S]*?)<\/h1>/)[1]));
      assert.match(a.datePublished, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(a.dateModified >= a.datePublished);
      assert.equal(a.description, meta(h, "name", "description"));
    }
    assert.ok(!/aggregateRating|"review"|"offers"|sameAs|"logo"/.test(JSON.stringify(ld)));
    const bc = ld.find((n) => n["@type"] === "BreadcrumbList").itemListElement;
    assert.equal(bc.at(-1).item, "https://jubilab.io" + path);
  });

  test(`${path}: no banned claim words in the page content`, () => {
    const m = txt(main.replace(/<script[\s\S]*?<\/script>/g, ""));
    assert.ok(!BANNED.test(m), `banned word: ${m.match(BANNED)?.[0]}`);
  });

  test(`${path}: every code block and table is focusable, labelled and scrollable`, () => {
    for (const tag of main.match(/<pre\b[^>]*>/g) || []) assert.match(tag, /tabindex="0"[^>]*aria-label="[^"]+"|aria-label="[^"]+"[^>]*tabindex="0"/);
    for (const tag of main.match(/<div class="table-scroll"[^>]*>/g) || []) assert.match(tag, /tabindex="0"/);
    const css = rd("guides/guides.css");
    assert.match(css, /pre\.code \{[^}]*overflow-x: auto/);
    assert.match(css, /\.table-scroll \{[^}]*overflow-x: auto/);
  });

  test(`${path}: footer links to Guides, internal links resolve to files`, () => {
    assert.match(h, /<footer>[\s\S]*href="(\.\.\/)*guides\/">Guides<\/a>/);
    const dir = file.replace(/index\.html$/, "");
    for (const m of h.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|tel:)/.test(u)) continue;
      const target = new URL(u, "https://x.test/" + dir).pathname.slice(1);
      assert.ok(existsSync(REPO + target) || existsSync(REPO + target + "index.html") || target === "", `${u} -> ${target}`);
    }
  });
}

for (const g of GUIDES) {
  const h = rd(`guides/${g}/index.html`);
  test(`guide ${g}: intro, What gets lost, 'Where Jubilab is now' box, one CTA, review date, sources`, () => {
    assert.match(h, /class="g-lede"/);
    assert.match(h, /<h2 id="lost">What gets lost/);
    assert.match(h, /<h2 id="helps-h">Where Jubilab is now/);
    assert.match(h, /not being offered/); assert.ok(!/Available now|How Jubilab helps/.test(h));
    assert.equal((h.match(/class="btn"/g) || []).length, 1, "one early-access call to action");
    assert.match(h, /Last reviewed \d{1,2} [A-Z][a-z]+ \d{4}/);
    const src = h.match(/<ol class="g-sources">([\s\S]*?)<\/ol>/)[1];
    assert.ok((src.match(/<li>/g) || []).length >= 3);
    assert.equal((src.match(/href="https:\/\//g) || []).length, (src.match(/<li>/g) || []).length);
  });
  test(`guide ${g}: says the old run-record prototype is not offered and what Jubilab is building now`, () => {
    const t = txt(h);
    assert.match(t, /earlier run-record prototype is not being offered/);
    assert.match(t, /building a way to order lab work once and follow it to results\. We are accepting early adopters by invitation \(request access and we invite small groups first\)\. The product is still being built and nothing is released yet/);
    assert.ok(!/(detects|detect) sample swaps|flags? sample swaps today/i.test(t));
  });
}

test("the hub lists all three guides with a sentence each", () => {
  const h = rd("guides/index.html");
  for (const g of GUIDES) assert.match(h, new RegExp(`<li><h2><a href="${g}/">`));
});

test("the footer of every page links to Guides; the home page header nav is unchanged", () => {
  for (const f of ["index.html", "privacy/index.html", "terms/index.html", "thanks/index.html", "404.html"]) assert.match(rd(f), /<footer>[\s\S]*href="[^"]*guides\/">Guides<\/a>/, f);
  assert.ok(!/href="[^"]*guides\/"[^>]*>Guides<\/a><\/li>\s*<\/ul>\s*<details/.test(rd("index.html")));
});

test("sitemap lists the hub and each guide with a lastmod", () => {
  const sm = rd("sitemap.xml");
  for (const { path } of PAGES) assert.match(sm, new RegExp(`<loc>https://jubilab\\.io${path.replace(/\//g, "\\/")}</loc>\\s*<lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`));
});

test("llms.txt has a Guides section linking the hub and each guide; robots.txt is unchanged in policy", () => {
  const t = rd("llms.txt");
  assert.match(t, /^## Guides$/m);
  for (const { path } of PAGES) assert.ok(t.includes(`](https://jubilab.io${path})`), path);
  const r = rd("robots.txt");
  for (const b of ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"]) assert.match(r, new RegExp(`^User-agent:\\s*${b}\\s*$`, "m"));
});
