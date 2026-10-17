// The site is launched (scripts/go-public.py --with-legal was applied 2026-10-17). These tests pin the launched state.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;
const rd = (f) => readFileSync(REPO + f, "utf8");
const noindex = (t) => /name="robots"[^>]*noindex/.test(t);

test("home, privacy and terms are indexable", () => {
  for (const f of ["index.html", "privacy/index.html", "terms/index.html"]) assert.ok(!noindex(rd(f)), f);
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

test("sitemap lists exactly the three indexable pages", () => {
  const locs = [...rd("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  assert.deepEqual(locs, ["https://jubilab.io/", "https://jubilab.io/privacy/", "https://jubilab.io/terms/"]);
});
