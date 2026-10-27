// The site is launched (scripts/go-public.py --with-legal was applied 2026-10-17). These tests pin the launched state.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;
const rd = (f) => readFileSync(REPO + f, "utf8");
const noindex = (t) => /name="robots"[^>]*noindex/.test(t);

test("home, privacy, terms and the guides are indexable", () => {
  for (const f of ["index.html", "privacy/index.html", "terms/index.html", "guides/index.html", "guides/reference-genome-build-vcf-bam/index.html", "guides/what-parameters-produced-this-result/index.html", "guides/nextflow-provenance-and-lineage-compared/index.html", "blog/index.html"] ) assert.ok(!noindex(rd(f)), f);
});

test("thanks and the 404 page stay noindex", () => {
  for (const f of ["thanks/index.html", "404.html"]) assert.ok(noindex(rd(f)), f);
});

test("robots.txt allows search and answer crawlers, blocks the four training bots, names the sitemap", () => {
  const t = rd("robots.txt");
  assert.match(t, /^User-agent:\s*\*\s*\nAllow:\s*\/\s*$/m);
  for (const b of ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"]) assert.match(t, new RegExp(`^User-agent:\\s*${b}\\s*$`, "m"));
  assert.match(t, /^Sitemap:\s*https:\/\/jubilab\.io\/sitemap\.xml\s*$/m);
});

test("sitemap lists home, privacy, terms, the four guides and the blog (index and posts)", () => {
  const all = [...rd("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const locs = all.filter((u) => !u.startsWith("https://jubilab.io/blog/")).sort();
  assert.deepEqual(locs, ["https://jubilab.io/", "https://jubilab.io/guides/", "https://jubilab.io/guides/nextflow-provenance-and-lineage-compared/", "https://jubilab.io/guides/reference-genome-build-vcf-bam/", "https://jubilab.io/guides/what-parameters-produced-this-result/", "https://jubilab.io/privacy/", "https://jubilab.io/terms/"]);
  assert.ok(all.includes("https://jubilab.io/blog/"));
});

test("home, legal, thanks and 404 link to the Blog in the header menu or links and the footer", () => {
  for (const f of ["index.html", "privacy/index.html", "terms/index.html", "thanks/index.html", "404.html"]) {
    const t = rd(f);
    if (f !== "index.html") assert.match(t, /<li><a href="[^"]*blog\/">Blog<\/a><\/li>/, f);
    assert.match(t, /<footer>[\s\S]*href="[^"]*blog\/">Blog<\/a>[\s\S]*<\/footer>/, f);
  }
});
