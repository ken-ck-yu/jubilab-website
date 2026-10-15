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
    assert.ok(!/^\s*Disallow:\s*\/\s*$/m.test(rd(d, "robots.txt")));
    const sm = rd(d, "sitemap.xml");
    assert.match(sm, /<loc>https:\/\/jubilab\.io\/<\/loc>/);
    assert.ok(!sm.includes("/privacy/") && !sm.includes("/thanks/"));
    const again = run(d, "--apply");
    assert.match(again.stdout, /Nothing to change/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("--with-legal opens privacy (no Draft notice) and skips terms (still a draft) with a warning; --allow-draft opens terms too", () => {
  const d = copy();
  try {
    assert.ok(!/class="draft-note"/.test(rd(d, "privacy/index.html")) && /class="draft-note"/.test(rd(d, "terms/index.html")));
    const termsBefore = rd(d, "terms/index.html");
    const r = run(d, "--with-legal", "--apply");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /terms\/index\.html still has its Draft notice: NOT opened/);
    assert.ok(!noindex(rd(d, "index.html")) && !noindex(rd(d, "privacy/index.html")));
    assert.equal(rd(d, "terms/index.html"), termsBefore, "terms is untouched");
    assert.ok(noindex(rd(d, "terms/index.html")) && noindex(rd(d, "thanks/index.html")));
    const sm = rd(d, "sitemap.xml");
    assert.ok(sm.includes("https://jubilab.io/privacy/") && !sm.includes("/terms/") && !sm.includes("/thanks/"));
    assert.match(run(d, "--with-legal", "--apply").stdout, /Nothing to change/);
    assert.equal(run(d, "--with-legal", "--allow-draft", "--apply").status, 0);
    assert.ok(!noindex(rd(d, "terms/index.html")));
    assert.ok(rd(d, "sitemap.xml").includes("https://jubilab.io/terms/"));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("--with-legal opens terms as well once its Draft notice is removed", () => {
  const d = copy();
  try {
    writeFileSync(join(d, "terms/index.html"), rd(d, "terms/index.html").replace(/ *<p class="draft-note"[^\n]*\n/, ""));
    const r = run(d, "--with-legal", "--apply");
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!/WARNING/.test(r.stderr));
    assert.ok(!noindex(rd(d, "terms/index.html")) && !noindex(rd(d, "privacy/index.html")));
    assert.ok(rd(d, "sitemap.xml").includes("https://jubilab.io/terms/"));
  } finally { rmSync(d, { recursive: true, force: true }); }
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
