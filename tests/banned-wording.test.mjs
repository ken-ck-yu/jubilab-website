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
    assert.match(t, /order-to-result layer for lab work\. We are accepting early adopters: request access and we invite small groups first\. The order layer is still being built and nothing is released yet\./);
    assert.match(t, /A product of Billy BioTech Ltd\. \(<span lang="zh-Hant" class="cjk">比利生物科技有限公司<\/span>\), Taipei/);
    assert.ok(!/in design/.test(t.replace(/<script[\s\S]*?<\/script>/g, "")));
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

test("hero does not lead with researcher or academia, and carries the headline verbatim and a plain sub-line (no schema words)", () => {
  const html = rd("index.html");
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/)[0];
  assert.ok(!/researcher|academi/i.test(hero));
  assert.ok(hero.includes("<h1 id=\"h1\">Power lab operations, from sample order to result.</h1>"));
  assert.ok(hero.includes("One order format, one status feed, one result &mdash; across every lab you use, for every scientist and AI assistant who orders."));
  assert.ok(!/schema/i.test(hero));
  assert.equal((hero.match(/class="btn[ "]/g) || []).length, 1, "one primary call to action in the hero");
});

test("no prices and no open questions on the home page", () => {
  const html = rd("index.html");
  assert.ok(!/[$\u20ac\u00a3]\s?\d|per seat|per lab|pricing|take rate/i.test(html.replace(/<script[\s\S]*?<\/script>/g, "")));
});

test("home page promises nothing is released, is not defensive about it, and has no install command or endpoint", () => {
  const html = rd("index.html");
  assert.match(html, /nothing is released yet/i);
  assert.match(html, /We are accepting early adopters by invitation/);
  assert.ok(!/Early access is open/.test(html));
  assert.ok(!/npm install|pip install|docker run|curl |api\.jubilab|mcp\.jubilab/i.test(html), "no install command or endpoint");
  const vis = html.replace(/<script[\s\S]*?<\/script>/g, "");
  assert.equal((vis.match(/Illustrative[^<]*not real order/g) || []).length >= 3, true, "hero strip caption, diagram caption and text alternative say illustrative");
});

test("every page with the site footer names the operator in the footer", () => {
  const pages = ["index.html", "404.html", "thanks/index.html", "privacy/index.html", "terms/index.html", ...CONTENT];
  for (const f of pages) assert.match(rd(f).match(/<footer>[\s\S]*?<\/footer>/)[0], /A product of Billy BioTech Ltd\. \(<span lang="zh-Hant" class="cjk">比利生物科技有限公司<\/span>\), Taipei/, f);
});

test("brand is Biligene, never Bili Gene; the forty-email-threads line and 'run through it first' stay", () => {
  for (const f of [...ALL, ...CONTENT]) assert.ok(!/Bili Gene/.test(rd(f)), f);
  const h = rd("index.html");
  assert.match(h, /At Biligene, our own sequencing orders lived in forty email threads/);
  assert.match(h, /planned to run through it first/);
});

test("labs section has the three groups in plain words, no tiers, and the existing-tools sentence", () => {
  const h = rd("index.html");
  const labs = h.match(/<section id="labs"[\s\S]*?<\/section>/)[0];
  assert.ok(!/Tier [0-3]/i.test(h) && !/Tier [0-3]/i.test(rd("llms.txt")));
  assert.equal((labs.match(/<li class="card">/g) || []).length, 3);
  for (const t of ["Your existing tools", "A Jubilab status page", "Your instruments"]) assert.ok(labs.includes(t), t);
  assert.ok(labs.includes("We work with your existing tools without disruption"));
  assert.match(labs, /stop at any step/);
  assert.match(labs, /We do not control the instrument/);
  assert.match(labs, /Nothing changes on your side on day one/);
});

test("audience: early adopters, UK startups and university groups, UCL and Cambridge only as examples (FAQ only)", () => {
  const h = rd("index.html"), l = rd("llms.txt");
  for (const t of [h, l]) assert.match(t, /early adopters[^.]*mainly UK biotech startups and university research groups/);
  assert.match(h, /non-clinical genetics samples/);
  const body = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");
  for (const m of body.matchAll(/UCL|Cambridge/g)) {
    const ctx = body.slice(Math.max(0, m.index - 260), m.index + 260);
    assert.match(ctx, /as examples only, not as customers or partners|MSc computer science \(UCL\)/);
  }
});

test("comparison diagram: right after the hero, both lanes, both variants, aria text, text alternative, caption", () => {
  const h = rd("index.html");
  const secs = [...h.matchAll(/<section id="([a-z]+)"|<section class="hero"/g)].map((m) => m[1] || "hero");
  assert.deepEqual(secs.slice(0, 3), ["hero", "compare", "problem"]);
  const sec = h.match(/<section id="compare"[\s\S]*?<\/section>/)[0];
  assert.match(sec, /joined only by email and Excel/);
  assert.match(sec, /Illustrative, not real orders\./);
  for (const cls of ["dg-wide", "dg-tall"]) {
    const svg = sec.match(new RegExp(`<svg class="dg ${cls}"[\\s\\S]*?</svg>`))[0];
    assert.match(svg, /role="img" aria-labelledby="dg[wt]-t dg[wt]-d"/);
    assert.match(svg, /<desc id="dg[wt]-d">[^<]{200,}/);
    assert.match(svg, /DRY LAB SIDE/);
    assert.match(svg, /WET LAB SIDE/);
    for (const t of ["Scientist", "Excel sheet", "Submit biology sample", "Wet lab staff", "Status by email", "Lab results", "new format each time", "reviewed by hand", "IDs mapped by hand", "QC passed", "Jubilab", "one order, one status feed, one result", "Benchling", "lab software", "status page", "Lab instruments"]) assert.ok(svg.includes(t), `${cls}: ${t}`);
    const drawn = svg.slice(svg.indexOf("</desc>"));
    assert.ok(drawn.indexOf("Scientist") < drawn.indexOf("Excel sheet") && drawn.indexOf("Excel sheet") < drawn.indexOf("Submit biology sample"));
    assert.ok(!/(?:API|MCP|webhook|schema|manifest|telemetry|JSON)\b/.test(svg.replace(/<defs>[\s\S]*?<\/defs>/, "")), cls + " has no technical words");
    assert.ok(!/<script|<image|href=/.test(svg));
    assert.ok(!/(fill|stroke)="#|#[0-9a-fA-F]{6}\b/.test(svg), cls + ": colours come from the CSS tokens, not the SVG");
  }
  assert.match(sec, /<details class="twin dg-twin">[\s\S]*?<b>Today\.<\/b>[\s\S]*?<b>With Jubilab\.<\/b>/);
});

test("hero journey strip has five plain steps and no event or function names", () => {
  const h = rd("index.html");
  const hero = h.match(/<section class="hero"[\s\S]*?<\/section>/)[0];
  const strip = hero.match(/<ol class="journey"[\s\S]*?<\/ol>/)[0];
  const steps = [...strip.matchAll(/<li><b>([^<]+)<\/b><span>([^<]+)<\/span><\/li>/g)].map((m) => m[1]);
  assert.deepEqual(steps, ["Submit sample", "Received", "QC", "Run", "Delivered"]);
  assert.ok(!/\w+\.\w+|get_status|fetch_result|_/.test(strip.replace(/<[^>]+>/g, " ")), "no dotted event names or snake_case function names");
  assert.match(hero, /Illustrative example, not a real order\./);
  assert.ok(!/<svg/.test(hero));
});

test("home page: no code blocks and none of the banned technical terms in the visible text", () => {
  const h = rd("index.html");
  assert.ok(!/<pre\b|<code\b/i.test(h));
  const vis = h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<form[\s\S]*?<\/form>/, "").replace(/<(title|desc)[^>]*>[\s\S]*?<\/\1>/g, "");
  const text = vis.replace(/<[^>]+>/g, " ");
  const BAN = /\b(JSON|API|MCP|webhooks?|schema|manifest|telemetry|endpoints?|REST|SFTP|LIMS|ELN|checksums?|MSA|CLIA|ONT|BaseSpace|MinKNOW|SMRT|SDK|tokens?|protocol|vocabulary|spec|append-only|quote|create_order|get_status|list_results|fetch_result|Tier)\b/i;
  const m = text.match(BAN);
  assert.equal(m, null, `found "${m?.[0]}"`);
  assert.ok(!/href="#dev"|id="dev"|For developers/i.test(h));
});

test("home nav has no Developers link and the section links are How it works, For labs, For teams, About, Early access", () => {
  const h = rd("index.html");
  assert.ok(!/Developers/.test(h));
  const sub = [...h.match(/<nav class="subnav"[\s\S]*?<\/nav>/)[0].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => m[2]);
  assert.deepEqual(sub, ["How it works", "For labs", "For teams", "About", "Early access"]);
  const menu = [...h.match(/<details class="menu">[\s\S]*?<\/details>/)[0].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => m[2]);
  assert.deepEqual(menu, ["How it works", "For labs", "For teams", "About", "Early access", "Blog"]);
});

test("About section: Billy BioTech, Taipei, Biligene, the forty-threads line, run through it first, the founder; no unverified numbers", () => {
  const h = rd("index.html");
  const about = h.match(/<section id="about"[\s\S]*?<\/section>/)[0];
  const t = about.replace(/&rsquo;/g, "’").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(t, /Billy BioTech Ltd\. \(\s*比利生物科技有限公司\s*\), a company in Taipei/);
  assert.match(t, /Biligene, is a live pet-genetics business/);
  assert.match(t, /Vet clinics, breeders and pet owners in Taiwan have tested with Biligene/);
  assert.match(t, /Ken Cheng-Kai Yu/);
  assert.match(t, /MSc computer science \(UCL\)/);
  assert.match(t, /AWS in London.s financial sector/);
  assert.match(t, /bioinformatics/);
  assert.ok(!/dozens|hundreds|thousands|\d+ (customers|clinics|labs)/i.test(h.replace(/<script[\s\S]*?<\/script>/g, "")));
});

test("what we don't do: three short lines; early access section names the audience", () => {
  const h = rd("index.html");
  const scope = h.match(/<section id="scope"[\s\S]*?<\/section>/)[0];
  assert.equal((scope.match(/<li class="card">/g) || []).length, 3);
  const acc = h.match(/<section id="access"[\s\S]*?<\/section>/)[0];
  assert.match(acc, /early adopters, mainly UK biotech startups and university research groups, together with the wet labs that run their samples/);
  assert.match(acc, /We invite small groups first/);
});

test("FAQ has at most five questions", () => {
  assert.ok((rd("index.html").match(/<summary><h3>/g) || []).length <= 5);
});

test("no customer or availability claims; UCL and Cambridge only as examples; no 'setting up with' wording", () => {
  for (const f of ["index.html", "404.html", "thanks/index.html", "llms.txt"]) {
    const t = rd(f);
    assert.ok(!/available now|our customers|our customer\b|trusted by|setting up with/i.test(t), f);
    assert.ok(!/Early access is open/.test(t), f);
  }
  for (const f of ["index.html", "llms.txt"]) {
    const h = rd(f);
    for (const m of h.matchAll(/UCL|Cambridge/g)) {
      const ctx = h.slice(Math.max(0, m.index - 220), m.index + 220);
      assert.match(ctx, /(as examples only, not as customers or partners|MSc computer science \(UCL\))/, f);
    }
  }
});
