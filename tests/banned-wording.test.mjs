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
    assert.match(t, /One order, one status feed, one result\. We are accepting early adopters: request access and we invite small groups first\. The product is still being built and nothing is released yet\./);
    assert.match(t, /A product of Billy BioTech Ltd\. \(<span lang="zh-Hant" class="cjk">比利生物科技有限公司<\/span>\), Taipei/);
    assert.ok(!/in design/.test(t.replace(/<script[\s\S]*?<\/script>/g, "")));
  });
}
test("blog index carries the neutral earlier-work line with a link home", () => {
  assert.match(rd("blog/index.html"), /These articles come from our earlier work on data provenance\. Jubilab is now building a way to <a href="\.\.\/">order lab work once and follow it to results<\/a>\./);
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

test("hero does not lead with researcher or academia, and carries the owner-approved headline verbatim and a plain sub-line (no schema words, API or MCP)", () => {
  const html = rd("index.html");
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/)[0];
  assert.ok(!/researcher|academi/i.test(hero));
  assert.ok(hero.includes("<h1 id=\"h1\">One order, one status feed, one result.</h1>"));
  // Owner-delegated headline (T-047 round 2); the owner can reverse it. Sub-line is one plain sentence pair that mentions AI assistants but does not lead with them.
  assert.ok(hero.includes("Order sequencing from outside labs once, see every step, and get results with your own sample names. For scientists and AI agents."));
  assert.ok(hero.includes("For teams that send samples to outside labs, and the labs that run them. UK genetics first."));
  assert.ok(!/dry lab|wet lab|logistics/i.test(hero), "no dry/wet lab or logistics wording on the first screen (it stays in the diagram)");
  assert.match(hero, /By Billy BioTech, the company behind Biligene\./);
  assert.match(hero, /Investors\? <a href="mailto:hello@jubilab\.io">Email us<\/a>/);
  assert.ok(!/<h2/.test(hero));
  assert.ok(!/schema|order layer|one shape|\bAPI\b|\bMCP\b/i.test(hero), "no schema words, API or MCP in the hero");
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
  assert.equal((vis.match(/[Ii]llustrative[^<]*[Nn]ot real order/g) || []).length >= 3, true, "hero strip caption, diagram caption and text alternative say illustrative");
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
    assert.match(ctx, /as examples only, not as customers or partners|MSc (?:in )?computer science \(UCL\)/);
  }
});

test("comparison diagram: right after the hero, both lanes, both variants, aria text, text alternative, caption", () => {
  const h = rd("index.html");
  const secs = [...h.matchAll(/<section id="([a-z]+)"|<section class="hero"/g)].map((m) => m[1] || "hero");
  assert.deepEqual(secs.slice(0, 3), ["hero", "compare", "usecases"]);
  const sec = h.match(/<section id="compare"[\s\S]*?<\/section>/)[0];
  assert.match(sec, /joined only by email and Excel/);
  assert.match(sec, /Illustrative, based on what we found at the providers we looked at\. Not real orders\./);
  for (const cls of ["dg-wide", "dg-tall"]) {
    const svg = sec.match(new RegExp(`<svg class="dg ${cls}"[\\s\\S]*?</svg>`))[0];
    assert.match(svg, /role="img" aria-labelledby="dg[wt]-t dg[wt]-d"/);
    assert.match(svg, /<desc id="dg[wt]-d">[^<]{200,}/);
    assert.match(svg, /DRY LAB SIDE/);
    assert.match(svg, /WET LAB SIDE/);
    for (const t of ["Scientist", "Excel sheet", "Submit biology sample", "Wet lab staff", "Status by email", "Lab results", "new format each time", "reviewed by hand", "IDs mapped by hand", "QC passed", "Jubilab", "one place to follow it", "Benchling", "lab software", "status page", "Lab instruments"]) assert.ok(svg.includes(t), `${cls}: ${t}`);
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
  const BAN = /\b(JSON|API|MCP|webhooks?|schema|manifest|telemetry|endpoints?|REST|SFTP|checksums?|MSA|CLIA|ONT|BaseSpace|MinKNOW|SMRT|SDK|tokens?|protocol|vocabulary|spec|append-only|quote|create_order|get_status|list_results|fetch_result|Tier)\b/i;
  const m = text.match(BAN);
  assert.equal(m, null, `found "${m?.[0]}"`);
  assert.ok((text.match(/\bLIMS\b/g) || []).length <= 1 && (text.match(/\bELN\b/g) || []).length <= 1, "LIMS and ELN named at most once each (plain-words rule, owner-requested mentions)");
  assert.ok(!/order layer|result schema|one shape/i.test(text), "plain-words rule");
  assert.ok(!/href="#dev"|id="dev"|For developers/i.test(h));
});

test("home nav: How it works, For labs, For teams, Why now, Early access; Blog only in the menu; no Developers or About", () => {
  const h = rd("index.html");
  assert.ok(!/Developers/.test(h) && !/href="#about"/.test(h));
  const sub = [...h.match(/<nav class="subnav"[\s\S]*?<\/nav>/)[0].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => m[2]);
  assert.deepEqual(sub, ["How it works", "For labs", "For teams", "Why now", "Early access"]);
  const menu = [...h.match(/<details class="menu">[\s\S]*?<\/details>/)[0].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => m[2]);
  assert.deepEqual(menu, ["How it works", "For labs", "For teams", "Why now", "Early access", "Blog"]);
});

test("no separate what-we-do-not-do block, no roadmap or timeline block; the limits are folded into How it works; early access names the audience", () => {
  const h = rd("index.html");
  assert.ok(!/id="scope"|Where we start|What we don.t do|What.s next|Roadmap|>Next<|>Later<|months? plan/i.test(h));
  const how = h.match(/<section id="how"[\s\S]*?<\/section>/)[0];
  assert.match(how, /not a marketplace and not an ELN/);
  assert.match(how, /does not set prices, control instruments or handle human clinical diagnostics/);
  const acc = h.match(/<section id="access"[\s\S]*?<\/section>/)[0];
  assert.match(acc, /early adopters, mainly UK biotech startups and university research groups, together with the wet labs that run their samples/);
  assert.match(acc, /We invite small groups first/);
  assert.match(acc, /Prefer to talk first\? Email <a href="mailto:hello@jubilab\.io">/);
  assert.equal((acc.match(/mailto:hello@jubilab\.io/g) || []).length, 1);
});

test("plain-words commitments: fits with tools, data commitment, planned fee, no pricing numbers", () => {
  const h = rd("index.html");
  assert.match(h, /Works with the tools you already use:<\/b> Excel, email, your lab software \(LIMS\) and Benchling \(first, planned\)/);
  assert.match(h, /You do not need lab software to start/);
  assert.match(h, /We plan to keep your order details, supplier prices and contacts yours\. The terms come with early access\./);
  assert.ok(!/will not sell|say-so|delete your data|stay yours/.test(h), "data wording stays a plan");
  assert.match(h, /We plan to charge a subscription for each team or lab, not a cut of what you spend\. The price is still to be tested with early adopters\./);
  assert.match(h, /What week one looks like, as we plan it:/);
  assert.match(h, /If you send samples out[\s\S]*If you run a lab or core/);
  assert.ok(!/say yes/.test(h), "presumptuous line removed");
  assert.match(h, /In 2025 Benchling began direct ordering for a few suppliers and left sequencing and assays out/);
    assert.match(h.match(/<footer>[\s\S]*?<\/footer>/)[0], /mailto:hello@jubilab\.io">Investors and partners/);
  assert.match(h, /Genetics sequencing first, then any lab service\./);
});

test("the three removed sections (founder strip, FAQ, problem tiles) and the FAQPage JSON-LD are gone, with no dangling anchors", () => {
  const h = rd("index.html"), l = rd("llms.txt");
  for (const id of ["behind", "faq", "problem"]) assert.ok(!new RegExp(`id="${id}"|href="#${id}"`).test(h), id);
  for (const s of ["Who is behind this", ">Questions<", "What we found when we looked", "about 70 public sources", "FAQPage", "<summary><h3>", "Ken Cheng-Kai Yu"]) assert.ok(!h.includes(s), s);
  assert.ok(!/#faq|#problem|#behind|FAQPage|Who is behind it|What we found/.test(l));
  assert.ok(!/class="faq|class="behind|class="stat"[^>]*>(?:0 of 12|4\.5 months|30 days|By hand|6 states)/.test(h));
  // the forty-email-threads line survives in Why now
  assert.match(h.match(/<section id="why"[\s\S]*?<\/section>/)[0], /forty email threads/);
});

test("effort section: aims not measured results, four tiles, no invented numbers, no savings claims", () => {
  const h = rd("index.html");
  const s = h.match(/<section id="effort"[\s\S]*?<\/section>/)[0];
  assert.match(s, /<h2 id="h-effort">The effort you get back\.<\/h2>/);
  assert.match(s, /What we are building to take off your plate\. These are our aims, not measured results; we will measure them with our first users\./);
  assert.equal((s.match(/<li class="card">/g) || []).length, 4);
  assert.deepEqual([...s.matchAll(/<p class="stat">([^<]*)<\/p>/g)].map((m) => m[1]), ["1", "5", "0", "1 to 2 hours"]);
  const t = s.replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "\u2019");
  assert.equal((t.match(/Our aim:/g) || []).length, 3);
  assert.match(t, /About what one large sequencing provider spends checking each order sheet by hand today\. We aim to take that off the lab\u2019s plate\./);
  assert.ok(!/%|percent|[$\u20ac\u00a3]|\bsaves?\b|\bsaved\b|\bsaving|faster|per order|fewer emails/i.test(t), "no percentages, money or savings claims");
  assert.ok(!/\b\d+ (?:hours?|days?|emails?)\b/i.test(t.replace("1 to 2 hours", "")), "no other hour, day or email counts");
  // sits right after How it works and before the labs section
  assert.ok(h.indexOf('<section id="how"') < h.indexOf('<section id="effort"') && h.indexOf('<section id="effort"') < h.indexOf('<section id="labs"'));
  assert.match(rd("llms.txt"), /The effort you get back \(our aims, not measured results\)/);
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
      assert.match(ctx, /(as examples only, not as customers or partners|MSc (?:in )?computer science \(UCL\))/, f);
    }
  }
});

test("home page h2 headings are exactly this list; no roadmap, timeline or extra sections (owner rule, YC discipline)", () => {
  const h = rd("index.html").replace(/<script[\s\S]*?<\/script>/g, "");
  const h2 = [...h.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&rsquo;/g, "\u2019").replace(/&amp;/g, "&"));
  assert.deepEqual(h2, [
    "Two sides that should be one.",
    "Order once. Follow every step.",
    "The effort you get back.",
    "Nothing changes on your side on day one.",
    "Every outside lab, one order format.",
    "Why now: every AI agent stops at the lab door.",
    "Request early access",
  ]);
  const text = h.replace(/<[^>]+>/g, " ").replace(/&rsquo;|&#8217;|\u2019/g, "'");
  const m = text.match(/roadmap|timeline|what'?s next|coming soon|where this is going|meet the team|what we (do not|don't|dont) do/i);
  assert.equal(m, null, `found "${m?.[0]}"`);
});
