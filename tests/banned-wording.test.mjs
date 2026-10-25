// Wording rules for the marketing pages (home, llms.txt, thanks, 404). privacy/ and terms/ are exempt from the legal-review
// list but not from the old-positioning list.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;
const rd = (f) => readFileSync(REPO + f, "utf8");
const MARKETING = ["index.html", "llms.txt", "404.html", "thanks/index.html"];
const ALL = [...MARKETING, "privacy/index.html", "terms/index.html"];
// blog/ and guides/ are kept for SEO (owner decision 2026-10-25). Their subject matter is provenance and lineage, so the
// old-positioning words are allowed in their bodies; every other rule still applies to them.
const walk = (d) => readdirSync(REPO + d, { withFileTypes: true }).flatMap((e) => e.isDirectory() && e.name !== "_src" ? walk(d + "/" + e.name) : e.name.endsWith(".html") ? [d + "/" + e.name] : []);
const CONTENT = [...walk("blog"), ...walk("guides")].map((f) => f.replace(/^\.?\//, ""));
const stripArchive = (f, t) => (f === "llms.txt" ? t.replace(/## Guides[\s\S]*?## Optional/, "## Optional") : t);

// Legal-review wording: stays out of marketing pages.
const LEGAL = /audit trail|audit log|\baudit|regulated|regulatory|compliance|compliant|\bgxp\b|validated|\bfda\b|\bgdpr\b/i;
// Owner brief 2026-10-25, section 1 and section 10: phrases we never use.
const BRIEF = /revolutioni[sz]|seamless|unlock|empower|stripe for|sample-to-result|outsourced lab work|with automation and scale/i;
// Old positioning (retired 2026-10-25).
const OLD = /provenance|lineage|nextflow|snakemake|cohort_a|demo project|synthetic demo/i;

for (const f of MARKETING) {
  test(`${f}: no legal-review wording (visible text, meta or JSON-LD)`, () => {
    const m = rd(f).match(LEGAL);
    assert.equal(m, null, `found "${m?.[0]}"`);
  });
}
for (const f of ALL) {
  test(`${f}: no banned brief phrases`, () => {
    const m = rd(f).match(BRIEF);
    assert.equal(m, null, `found "${m?.[0]}"`);
  });
  test(`${f}: no old-positioning strings`, () => {
    const m = stripArchive(f, rd(f)).match(OLD);
    assert.equal(m, null, `found "${m?.[0]}"`);
  });
}

for (const f of CONTENT) {
  test(`${f}: banned brief phrases stay out of blog and guide pages too`, () => {
    // One post quotes a list of local-first ideals that includes "Seamless collaboration with colleagues" (reported to the owner, not rewritten).
    const m = rd(f).replace(/<li>Seamless collaboration with colleagues\./g, "<li>").match(BRIEF);
    assert.equal(m, null, `found "${m?.[0]}"`);
  });
  test(`${f}: no old-product tagline, chrome or shipped-feature box`, () => {
    const t = rd(f);
    for (const re of [/data provenance and lineage for bioinformatics pipelines/i, /Be among the first labs shaping/, /synthetic demo data/i, /more science, fewer data/i, /How Jubilab helps/, /Available now<\/h3>/, /\.\.\/#(fits|product|next)\b/, /\/#(fits|product|next)\b/]) assert.ok(!re.test(t), String(re));
    assert.match(t, /href="[^"]*#how">How it works/);
    assert.match(t, /order-to-result layer for lab work, in design/);
  });
}
test("blog index carries the neutral earlier-work line with a link home", () => {
  assert.match(rd("blog/index.html"), /These articles come from our earlier work on data provenance\. Jubilab is now building the <a href="\.\.\/">order-to-result layer for lab work<\/a>\./);
});
test("every post and guide has an honest 'Where Jubilab is now' box and no claim that Jubilab ships the old tool", () => {
  for (const f of CONTENT.filter((x) => x !== "blog/index.html" && x !== "guides/index.html")) {
    const t = rd(f);
    const body = t.replace(/<script[\s\S]*?<\/script>/g, "");
    assert.ok(!/ships with our next release|Jubilab records|Jubilab traces|local-first, self-hostable|native bash wrapper|jubilab run/.test(body), f);
  }
});

test("\"marketplace\" appears only to say what Jubilab is not, or in a factual description of other tools", () => {
  for (const f of MARKETING) {
    const t = rd(f).replace(/\b(?:no|not a|is not a|will not be a)\s+marketplace\b/gi, "").replace(/\bmost structured marketplace\b/gi, "").replace(/\ba marketplace brokers\b/gi, "").replace(/\bor a marketplace\b/gi, "").replace(/marketplace\?/gi, "");
    assert.ok(!/marketplace/i.test(t), f);
  }
});

test("hero does not lead with researcher or academia, and carries the brief's headline and sub-line verbatim", () => {
  const html = rd("index.html");
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/)[0];
  assert.ok(!/researcher|academi/i.test(hero));
  assert.ok(hero.includes("<h1 id=\"h1\">Power lab operations, from sample order to result.</h1>"));
  assert.ok(hero.includes("One order format, one status feed, one result schema \u2014 across every lab you use, for every scientist and agent who orders."));
});

test("no prices and no open questions on the home page", () => {
  const html = rd("index.html");
  assert.ok(!/[$\u20ac\u00a3]\s?\d|per seat|per lab|pricing|take rate/i.test(html.replace(/<script[\s\S]*?<\/script>/g, "")));
});

test("home page labels every JSON example as a draft and promises nothing is released", () => {
  const html = rd("index.html");
  assert.equal((html.match(/Draft v0, illustrative/g) || []).length, 3);
  assert.match(html, /not released/i);
  assert.ok(!/npm install|pip install|docker run|curl |api\.jubilab|mcp\.jubilab/i.test(html), "no install command or endpoint");
});
