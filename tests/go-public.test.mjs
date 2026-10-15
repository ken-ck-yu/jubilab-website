// Tests for scripts/go-public.py (LAUNCH STEP 1). Always runs on a copy of the repo under the OS temp dir, never in place.
import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO = new URL("..", import.meta.url).pathname;
const copy = () => {
  const d = mkdtempSync(join(tmpdir(), "gopublic-"));
  cpSync(REPO, d, { recursive: true, filter: (s) => !/\/(\.git|node_modules|\.wrangler)(\/|$)/.test(s) });
  return d;
};
const run = (root, ...args) => spawnSync("python3", [join(root, "scripts/go-public.py"), "--root", root, ...args], { encoding: "utf8" });
const rd = (root, f) => readFileSync(join(root, f), "utf8");
const noindex = (t) => /name="robots"[^>]*noindex/.test(t);

test("dry run is the default and changes nothing", () => {
  const d = copy();
  try {
    const before = ["index.html", "robots.txt", "sitemap.xml"].map((f) => rd(d, f));
    const r = run(d);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Dry run/);
    assert.match(r.stdout, /-<meta name="robots" content="noindex">/);
    assert.deepEqual(["index.html", "robots.txt", "sitemap.xml"].map((f) => rd(d, f)), before);
    assert.equal(run(d, "--dry-run").status, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("--apply: home indexable, thanks and 404 stay noindex, legal pages untouched, robots swapped, idempotent", () => {
  const d = copy();
  try {
    const legalBefore = [rd(d, "privacy/index.html"), rd(d, "terms/index.html")];
    const r = run(d, "--apply");
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!noindex(rd(d, "index.html")));
    assert.ok(noindex(rd(d, "thanks/index.html")) && noindex(rd(d, "404.html")));
    assert.deepEqual([rd(d, "privacy/index.html"), rd(d, "terms/index.html")], legalBefore);
    assert.equal(rd(d, "robots.txt"), rd(d, "robots.launch.txt"));
    assert.match(rd(d, "robots.txt"), /User-agent: \*\nAllow: \/\n/);
    const sm = rd(d, "sitemap.xml");
    assert.match(sm, /<loc>https:\/\/jubilab\.io\/<\/loc>/);
    assert.ok(!sm.includes("/privacy/") && !sm.includes("/thanks/"));
    const again = run(d, "--apply");
    assert.match(again.stdout, /Nothing to change/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("--with-legal opens BOTH privacy and terms (neither has a Draft notice); dry run lists them; thanks and 404 stay noindex", () => {
  const d = copy();
  try {
    assert.ok(!/class="draft-note"/.test(rd(d, "privacy/index.html")) && !/class="draft-note"/.test(rd(d, "terms/index.html")));
    assert.ok(!/<!-- \[/.test(rd(d, "terms/index.html")), "no owner/placeholder comments in terms");
    const dry = run(d, "--with-legal");
    assert.equal(dry.status, 0, dry.stderr);
    assert.ok(!/WARNING/.test(dry.stderr));
    assert.match(dry.stdout, /\+\s*<loc>https:\/\/jubilab\.io\/privacy\/<\/loc>/);
    assert.match(dry.stdout, /\+\s*<loc>https:\/\/jubilab\.io\/terms\/<\/loc>/);
    assert.match(dry.stdout, /b\/privacy\/index\.html/);
    assert.match(dry.stdout, /b\/terms\/index\.html/);
    const r = run(d, "--with-legal", "--apply");
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!noindex(rd(d, "index.html")) && !noindex(rd(d, "privacy/index.html")) && !noindex(rd(d, "terms/index.html")));
    assert.ok(noindex(rd(d, "thanks/index.html")) && noindex(rd(d, "404.html")));
    const sm = rd(d, "sitemap.xml");
    assert.ok(sm.includes("https://jubilab.io/privacy/") && sm.includes("https://jubilab.io/terms/") && !sm.includes("/thanks/"));
    assert.equal((sm.match(/<loc>/g) || []).length, 3);
    assert.match(run(d, "--with-legal", "--apply").stdout, /Nothing to change/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a legal page that carries a Draft notice is skipped with a warning; --allow-draft opens it (rehearsal)", () => {
  const d = copy();
  try {
    const t = rd(d, "terms/index.html");
    writeFileSync(join(d, "terms/index.html"), t.replace('<h1>Terms</h1>', '<h1>Terms</h1>\n  <p class="draft-note" role="note">Draft.</p>'));
    const termsBefore = rd(d, "terms/index.html");
    const r = run(d, "--with-legal", "--apply");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /terms\/index\.html still has its Draft notice: NOT opened/);
    assert.ok(!noindex(rd(d, "privacy/index.html")));
    assert.equal(rd(d, "terms/index.html"), termsBefore, "terms is untouched");
    assert.ok(noindex(rd(d, "terms/index.html")));
    const sm = rd(d, "sitemap.xml");
    assert.ok(sm.includes("https://jubilab.io/privacy/") && !sm.includes("/terms/"));
    assert.equal(run(d, "--with-legal", "--allow-draft", "--apply").status, 0);
    assert.ok(!noindex(rd(d, "terms/index.html")));
    assert.ok(rd(d, "sitemap.xml").includes("https://jubilab.io/terms/"));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("robots.launch.txt blocks exactly the four training bots and allows search/answer bots and ordinary crawlers", () => {
  const py = `
import sys
from urllib.robotparser import RobotFileParser
r = RobotFileParser(); r.parse(open(sys.argv[1]).read().splitlines())
blocked = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"]
allowed = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User", "Googlebot", "Bingbot", "DuckDuckBot", "SomeOtherBot"]
for p in ("/", "/privacy/", "/terms/"):
    for b in blocked: assert not r.can_fetch(b, p), (b, p)
    for b in allowed: assert r.can_fetch(b, p), (b, p)
print("ok")
`;
  const r = spawnSync("python3", ["-c", py, join(REPO, "robots.launch.txt")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const txt = rd(REPO, "robots.launch.txt");
  const active = txt.split("\n").filter((l) => /^User-agent:/i.test(l)).map((l) => l.split(":")[1].trim()).sort();
  assert.deepEqual(active, ["*", "CCBot", "ClaudeBot", "GPTBot", "Google-Extended"]);
  assert.match(txt, /^Sitemap: https:\/\/jubilab\.io\/sitemap\.xml$/m);
  const d = copy();
  try { assert.equal(run(d, "--apply").status, 0); assert.equal(rd(d, "robots.txt"), txt); } finally { rmSync(d, { recursive: true, force: true }); }
});

test("refuses to run when thanks has lost its noindex or the launch robots file would block everything", () => {
  const d = copy();
  try {
    writeFileSync(join(d, "robots.launch.txt"), "User-agent: *\nDisallow: /\n");
    assert.equal(run(d, "--apply").status, 2);
    assert.ok(noindex(rd(d, "index.html")));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("the worktree itself is still in preview state (the switch has not been applied here)", () => {
  assert.ok(noindex(rd(REPO, "index.html")));
  assert.match(rd(REPO, "robots.txt"), /^Disallow:\s*\/\s*$/m);
});
