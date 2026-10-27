// Wording rules for the marketing pages (home, llms.txt, thanks, 404). privacy/ and terms/ are exempt from the legal-review
// list but not from the old-positioning list.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

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
// Owner rule (T-050, 2026-10-27): "we dont say that or anything similar, we propose our product, that's all."
// No product-state hedges anywhere on the site except in older blog/guide article bodies, which describe the earlier work.
const HEDGE = /product concept|in development|in design|being built|nothing is released|none of it is released|not yet released|not released|released yet|illustrative|product goals?|not a measured|prototype|is being built to|capabilities are not|will depend on the implementation|will be arranged|early development|not built yet/i;
const OLD = /provenance|lineage|nextflow|snakemake|cohort_a|demo project|synthetic demo/i;

for (const f of MARKETING) {
  test(`${f}: no legal-review wording (visible text, meta or JSON-LD)`, () => {
    const m = rd(f).match(LEGAL);
    assert.equal(m, null, `found "${m?.[0]}"`);
  });
}
for (const f of ALL) {
  test(`${f}: no banned brief phrases`, () => {
    // Owner override (T-050): the For-labs heading may say "Seamless integration"; nowhere else.
    const m = rd(f).replace("<h2 id=\"h-labs\">Seamless integration into your existing tools with AI enablement.</h2>", "").match(BRIEF);
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
    assert.ok(!/accepting early adopters|Streamline Biological/i.test(t.match(/<footer>[\s\S]*?<\/footer>/)[0]), "footer has no tagline or status sentence");
    assert.match(t.match(/<footer>[\s\S]*?<\/footer>/)[0], /<p class="foot-co">A product of Billy BioTech Ltd\.<\/p>/);
    assert.ok(!/in design/.test(t.replace(/<script[\s\S]*?<\/script>/g, "")));
    assert.ok(!HEDGE.test(t.match(/<footer>[\s\S]*?<\/footer>/)[0]) && !HEDGE.test(t.match(/<head>[\s\S]*?<\/head>/)[0]), "no product-state hedge in head or footer");
  });
}
test("blog index carries the neutral earlier-work line with a link home", () => {
  assert.match(rd("blog/index.html"), /These articles come from our earlier work on data provenance\. Jubilab is a way to <a href="\.\.\/">order lab work once and follow it to results<\/a>\./);
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

test("hero carries the owner's headline, lede and sub-line, one eyebrow, two calls to action and the Orders dashboard", () => {
  const html = rd("index.html");
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/)[0];
  assert.ok(hero.includes('<h1 id="h1">Streamline Biological Sample to Data <span class="h1-tail">– for AI enablement</span></h1>'));
  assert.ok(hero.includes("So scientists and AI agents can order, track and read results across dry labs, wet labs and logistics."));
  assert.ok(hero.includes("For biotech teams, research groups and the labs that run their samples."));
  assert.ok(!/Order sequencing from external labs|track each step, and get results linked/.test(html), "old hero paragraph removed");
  assert.ok(!/Power lab operations|One order format, one status feed|result schema/i.test(html));
  assert.ok(/Request early access/.test(hero) && /See how it works/.test(hero));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(!/<h2/.test(hero));
  // the old hero card (Sample ORD-1042 with the five-step timeline) and the hero art are gone; the Orders dashboard is the hero visual
  assert.ok(!/status-card|class="timeline"|small-label|Built for traceability|hero-art/.test(html + rd("home.css")), "old hero card and art removed");
  assert.ok(!existsSync(REPO + "assets/img/hero-art.webp"));
  assert.match(hero, /<div class="hero-visual">\s*<figure class="dash"/);
});

test("no prices, fees or open questions on the home page", () => {
  const html = rd("index.html");
  assert.ok(!/[$\u20ac\u00a3]\s?\d|per seat|per lab|pricing|take rate|subscription|\bfee\b/i.test(html.replace(/<script[\s\S]*?<\/script>/g, "")));
  assert.ok(!/[$\u20ac\u00a3]\s?\d|pricing|take rate|subscription/i.test(rd("llms.txt")));
});

test("home page: no install command or endpoint, no Stripe, no customer or partner claims, no hedged product-state wording", () => {
  const html = rd("index.html"), llms = rd("llms.txt");
  const vis = html.replace(/<script[\s\S]*?<\/script>/g, "");
  assert.ok(!/npm install|pip install|docker run|curl |api\.jubilab|mcp\.jubilab/i.test(html), "no install command or endpoint");
  assert.ok(!/stripe/i.test(vis) && !/stripe/i.test(llms) && !/stripe/i.test(rd("home.css")), "no Stripe, anywhere (the brief bans 'Stripe for X')");
  assert.ok(!/available now|\bour customers?\b|trusted by|setting up with|testimonial|\bpilots?\b|Early access is open/i.test(vis), "no customer, pilot or availability claims");
  assert.ok(!/\bcustomers\b/i.test(vis.replace(/Keep your customers/g, "")), "customers appear only in the owner's labs line");
  for (const [name, t] of [["index.html (visible and head)", vis], ["llms.txt (site part)", llms.replace(/## Guides[\s\S]*?## Optional/, "## Optional")]]) {
    assert.ok(!HEDGE.test(t), `${name}: found "${t.match(HEDGE)?.[0]}"`);
    assert.ok(!/\baims? to\b|\bdesigned to\b|\bplans? to\b|\bour aim\b|\bshould\b|\bwill be\b|\bis being\b|\bnot yet\b/i.test(t.replace(/<(title|desc)[^>]*>[\s\S]*?<\/\1>/g, "")), `${name}: hedge verbs found: ${t.match(/\baims? to\b|\bdesigned to\b|\bplans? to\b|\bour aim\b|\bshould\b|\bwill be\b|\bis being\b|\bnot yet\b/i)?.[0]}`);
  }
  for (const f of ["404.html", "thanks/index.html", "privacy/index.html", "terms/index.html", "guides/index.html", "blog/index.html"]) {
    const t = rd(f).replace(/<script[\s\S]*?<\/script>/g, "");
    assert.ok(!HEDGE.test(t), `${f}: found "${t.match(HEDGE)?.[0]}"`);
  }
  for (const f of CONTENT) {
    const t = rd(f);
    const box = (t.match(/<section class="helps"[\s\S]*?<\/section>/) || [""])[0];
    assert.ok(!HEDGE.test(box), `${f}: Where Jubilab is now box`);
  }
  assert.ok(!/illustrative|not a real order|not real orders|example, not/i.test(html));
  assert.ok(!/illustrative|not a real order|not real orders/i.test(llms));
});

test("every footer is short: Billy BioTech line, contact, links; no tagline, no status sentence, no illustrative, no headline", () => {
  for (const f of ["index.html", "404.html", "thanks/index.html", "privacy/index.html", "terms/index.html", "guides/index.html", "blog/index.html", ...CONTENT]) {
    const ft = rd(f).match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.match(ft, /<p class="foot-co">A product of Billy BioTech Ltd\.<\/p>/, f);
    assert.ok(!/Taipei|\u6bd4\u5229|cjk|zh-Hant/.test(ft), f + ": no Chinese name or city in the footer");
    assert.match(ft, /Contact: <a href="mailto:hello@jubilab\.io">hello@jubilab\.io<\/a>/, f);
    assert.ok(!/illustrative|accepting early adopters|streamline biological|nothing is released|still being built/i.test(ft), f + " footer");
  }
  const h = rd("index.html");
  const links = [...h.match(/<footer[\s\S]*?<\/footer>/)[0].matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => m[2]);
  assert.deepEqual(links, ["Investors and partners", "Guides", "Blog", "Privacy", "Terms", "Back to top"]);
  assert.match(rd("assets/consent.js"), /Cookie settings/, "consent.js adds the Cookie settings footer link");
});

test("brand is Biligene, never Bili Gene; the Biligene story stays", () => {
  for (const f of [...ALL, ...CONTENT]) assert.ok(!/Bili Gene/.test(rd(f)), f);
  const h = rd("index.html");
  assert.match(h, /We run Biligene, a pet genetics testing business/);
  assert.match(h, /Our own sequencing workflows at Biligene come first/);
});

test("labs section: owner heading, three options in plain words, existing tools stay", () => {
  const h = rd("index.html");
  const labs = h.match(/<section id="labs"[\s\S]*?<\/section>/)[0];
  assert.match(labs, /<h2 id="h-labs">Seamless integration into your existing tools with AI enablement\.<\/h2>/);
  assert.ok(!/Nothing changes on your side on day one/.test(h) && !/Nothing changes for them on day one/.test(h));
  assert.equal((labs.match(/<article class="integration-card">/g) || []).length, 3);
  for (const t of ["Your existing tools", "A simple status page", "Connect your lab software", "does not replace them"]) assert.ok(labs.includes(t), t);
  assert.ok(!/Tier [0-3]/i.test(h) && !/Tier [0-3]/i.test(rd("llms.txt")));
  assert.equal((h.match(/seamless/gi) || []).length, 1, "'seamless' only in the owner-approved labs heading");
});

test("section order and ids: hero, teams (merged Why use Jubilab), how, labs, value, developers, story, access", () => {
  const h = rd("index.html");
  const secs = [...h.matchAll(/<section (?:id="([a-z]+)" )?class="([^"]*)"|<section id="([a-z]+)"/g)].map((m) => m[1] || m[3] || m[2]);
  assert.deepEqual(secs, ["hero", "teams", "how", "labs", "value-section", "developers", "story-section", "access"]);
});

test("merged Why use Jubilab / For teams section: one h2, owner order, no separate For-teams or 'From lab samples to result' section", () => {
  const h = rd("index.html");
  const s = h.match(/<section id="teams"[\s\S]*?<\/section>/)[0];
  assert.ok(!/id="why"|The problem|From lab samples to result|<section id="teams"[\s\S]*<section id="teams"/.test(h));
  assert.equal((h.match(/id="teams"/g) || []).length, 1);
  assert.match(s, /<span class="eyebrow">Why use Jubilab<\/span>\s*<h2 id="h-teams">Every external lab, one workflow\.<\/h2>/);
  assert.match(s, /Today, ordering sequencing from an external lab often means a new spreadsheet, email updates, and results that need manual reconciliation\. Jubilab, the sample operations layer, connects the order, status and result in one workflow, and you keep the tools you already use\./);
  const order = ["class=\"comparison\"", "<strong>One order. One place to follow it. One clean result.</strong><br>One interface for people and software.", "class=\"three-grid\"", "One connected path"].map((x) => s.indexOf(x));
  assert.ok(order.every((x) => x > 0) && order.every((x, i) => i === 0 || x > order[i - 1]), "order: panels, summary line, cards, banner, path strip: " + order);
  const cmp = s.match(/<div class="comparison">[\s\S]*?<\/ul>\s*<\/div>\s*<\/div>/)[0];
  assert.match(cmp, /<h3>Today<\/h3>\s*<p class="panel-sub">Joined by email and Excel<\/p>/);
  assert.match(cmp, /<h3>With Jubilab<\/h3>\s*<p class="panel-sub">One connected workflow<\/p>/);
  const lis = (re) => [...cmp.match(re)[0].matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1]);
  assert.deepEqual(lis(/<div class="panel">[\s\S]*?<\/ul>/), ["Email and back-and-forth communication", "A different spreadsheet for every provider", "Custom-built pipelines and scripts", "Manual tracking and status updates by researchers", "ELN and HPC kept separate from lab orders"]);
  assert.deepEqual(lis(/<div class="panel highlight">[\s\S]*?<\/ul>/), ["One standard sample request", "Status updates from every lab in one place", "Results linked to your own sample names", "Ready for AI agents through API and MCP"]);
  assert.ok(!/For scientists and research teams|For laboratories|<h3>Laboratories/.test(s), "audience sub-groups removed");
  for (const t of ["One order structure", "Clearer status", "Results tied to your samples"]) assert.ok(s.includes(`<h3>${t}</h3>`), t);
  assert.ok(!/<a class="button"/.test(s), "the merged section has no buttons");
  assert.ok(!/Explore the workflow/.test(h + rd("llms.txt")), "secondary button removed");
  assert.ok(!/One order format|one status feed|result schema/i.test(h));
});

test("How it works: three steps, then the Today and With Jubilab diagrams as two panels; the 'every fact has a source' box is gone", () => {
  const h = rd("index.html");
  const s = h.match(/<section id="how"[\s\S]*?<\/section>/)[0];
  assert.deepEqual([...s.matchAll(/<span class="feature-num">(\d+)<\/span>/g)].map((m) => m[1]), ["01", "02", "03"]);
  assert.ok(!/Every fact has a source|designed to distinguish/i.test(h));
  assert.equal((s.match(/<div class="flow-panel/g) || []).length, 2);
  assert.ok(s.indexOf("Today</p>") > 0 && s.indexOf('<p class="panel-label">With Jubilab</p>') > s.indexOf("Today</p>"));
  assert.ok(!/<figcaption>|<details|Read this diagram as text/.test(s.replace(/<svg[\s\S]*?<\/svg>/g, "")), "no caption and no visible text alternative");
  const svgs = [...s.matchAll(/<svg class="dg (dg-wide|dg-tall)"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  assert.equal(svgs.length, 4, "wide and stacked variant of each panel");
  assert.equal(svgs.filter((x) => x.startsWith('<svg class="dg dg-wide"')).length, 2);
  const ids = [...s.matchAll(/<(?:title|desc|marker) id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "svg ids are unique");
  for (const svg of svgs) {
    assert.match(svg, /role="img" aria-labelledby="(dg[wt][12])-t \1-d"/);
    assert.match(svg, /<desc id="dg[wt][12]-d">[^<]{200,}/);
    assert.ok(!/<script|<image|href=/.test(svg));
    assert.ok(!/(fill|stroke)="#|#[0-9a-fA-F]{6}\b/.test(svg), "colours come from CSS");
    assert.ok(!/illustrative|Benchling|planned|day one/i.test(svg));
  }
  const today = svgs.filter((x) => /Today/.test(x.match(/<title[^>]*>([^<]*)/)[1]));
  const with_ = svgs.filter((x) => /With Jubilab/.test(x.match(/<title[^>]*>([^<]*)/)[1]));
  assert.equal(today.length, 2); assert.equal(with_.length, 2);
  for (const svg of today) for (const t of ["Scientist", "Excel sheet", "Submit biology sample", "Wet lab processing", "instruments run", "Status by email", "Lab results", "new format each time", "reviewed by hand", "IDs mapped by hand", "QC passed", "DRY LAB SIDE", "WET LAB SIDE"]) assert.ok(svg.includes(t), t);
  for (const svg of with_) for (const t of ["Scientists and researchers", "AI assistants", "Jubilab", "one place to follow it", "lab software", "status page", "Lab instruments", ">DRY LAB<", ">WET LAB<"]) assert.ok(svg.includes(t), t);
  assert.ok(!/WHO ORDERS|WHO RUNS THE SAMPLES/i.test(h));
  const css = rd("home.css");
  assert.match(css, /@media \(min-width:1000px\)[\s\S]*?\.dg-wide \{ display:block; \}[\s\S]*?\.dg-tall \{ display:none; \}/, "wide from 1000px, stacked below");
  assert.ok(!/not a marketplace|not an ELN|human clinical diagnostics|scope-note/i.test(h) && !/not a marketplace|not an ELN|human clinical diagnostics/i.test(rd("llms.txt")), "owner removed the limits line (T-050)");
});

test("CTA wording: no buttons in the merged section; header, hero and form buttons keep theirs", () => {
  const h = rd("index.html");
  assert.ok(!/Join the early-access programme/.test(h));
  assert.match(h, /Request early access <span aria-hidden="true">&rarr;<\/span>/);
});

test("operational value: owner intro and the three tiles; no footnote, no measured-result wording", () => {
  const h = rd("index.html");
  const s = h.match(/<section class="value-section"[\s\S]*?<\/section>/)[0];
  assert.match(s, /<h2 id="h-value">Less time managing orders\. More time doing science\.<\/h2>/);
  assert.match(s, /Jubilab reduces the repetitive work between sending a sample and using the result\./);
  assert.deepEqual([...s.matchAll(/<span class="metric-value">([^<]*)<\/span>/g)].map((m) => m[1]), ["3+", "0", "AI"]);
  assert.deepEqual([...s.matchAll(/<article class="metric">[\s\S]*?<h3>([^<]*)<\/h3>/g)].map((m) => m[1]), ["Hours saved per week", "Custom-built solutions to maintain", "Ready to streamline dry lab to wet lab"]);
  assert.match(s, /with AI, API and MCP capabilities\./);
  assert.ok(!/class="note"|Product goal|measured/i.test(s));
});

test("AI & developers and story sections exist with the redesign headings", () => {
  const h = rd("index.html");
  assert.match(h, /<section id="developers"[\s\S]*?<h2 id="h-dev">Every AI agent stops at the lab door\.<\/h2>/);
  assert.match(h, /Jubilab provides a standard interface for that handoff\./);
  assert.match(h, /<h2 id="h-story">Built from a problem we know firsthand\.<\/h2>/);
  assert.match(h, /<span class="eyebrow">Why we&rsquo;re building it<\/span>/);
  assert.match(h, /Talk to us about developer access/);
});

test("early access section: invitation policy, audience, mailto once", () => {
  const h = rd("index.html");
  const acc = h.match(/<section id="access"[\s\S]*?<\/section>/)[0];
  assert.match(acc, /<h2 id="h-access">Help us build a better way to work with external labs\.<\/h2>/);
  assert.match(acc, /invite small groups first/);
  assert.match(acc, /Prefer to talk first\?<\/strong><br><a class="text-link" href="mailto:hello@jubilab\.io">hello@jubilab\.io<\/a>/);
  assert.equal((acc.match(/mailto:hello@jubilab\.io/g) || []).length, 1);
  assert.ok(!/Early access will be arranged|selected teams/.test(h));
  assert.match(rd("llms.txt"), /Early access is by invitation/);
});

test("home page: no code blocks; API, MCP and webhooks appear only in the owner-approved places", () => {
  const h = rd("index.html");
  assert.ok(!/<pre\b|<code\b/i.test(h));
  const vis = h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<form[\s\S]*?<\/form>/, "");
  const text = vis.replace(/<[^>]+>/g, " ");
  for (const [re, max] of [[/\bMCP\b/g, 4], [/\bAPI\b/g, 4], [/webhooks?/gi, 1]]) assert.ok((text.match(re) || []).length <= max, String(re));
  assert.ok(!/JSON|endpoints?|SFTP|SDK|\btokens?\b|create_order|get_status|fetch_result|REST/.test(text));
});

test("home nav: How it works, For teams, For labs, AI & developers and the Request early access button; every link has a target", () => {
  const h = rd("index.html");
  const nav = h.match(/<nav class="nav"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...nav.match(/<div class="navlinks">[\s\S]*?<\/div>/)[0].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => m[1] + "|" + m[2]), ["#how|How it works", "#teams|For teams", "#labs|For labs", "#developers|AI &amp; developers"]);
  assert.match(nav, /<a class="button" href="#access">Request early access/);
  const ids = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of h.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(m[1]), "dangling anchor #" + m[1]);
  assert.ok(!/id="theme-toggle"|data-theme/.test(h), "the home page is light only");
});

test("the removed sections stay removed: FAQ, founder strip, effort tiles, problem tiles, For-teams-old", () => {
  const h = rd("index.html"), l = rd("llms.txt");
  for (const s of ["Who is behind this", ">Questions<", "FAQPage", "Ken Cheng-Kai Yu", "The effort you get back", "Why now: every AI agent", "Nothing changes on your side"]) assert.ok(!h.includes(s), s);
  assert.ok(!/#faq|#problem|#behind|FAQPage|The effort you get back|our aims, not measured/.test(l));
});

test("home page h2 headings are exactly this list; no roadmap, timeline or extra sections", () => {
  const h = rd("index.html").replace(/<script[\s\S]*?<\/script>/g, "");
  const h2 = [...h.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&rsquo;/g, "\u2019").replace(/&amp;/g, "&"));
  assert.deepEqual(h2, [
    "Every external lab, one workflow.",
    "Standardise the request. Follow the sample. Get the data.",
    "Seamless integration into your existing tools with AI enablement.",
    "Less time managing orders. More time doing science.",
    "Every AI agent stops at the lab door.",
    "Built from a problem we know firsthand.",
    "Help us build a better way to work with external labs.",
  ]);
  const text = h.replace(/<[^>]+>/g, " ").replace(/&rsquo;|&#8217;|\u2019/g, "'");
  const m = text.match(/roadmap|timeline|what'?s next|coming soon|where this is going|meet the team|what we (do not|don't|dont) do/i);
  assert.equal(m, null, `found "${m?.[0]}"`);
});

test("self-hosted fonts and no third-party request in the home page's head or css", () => {
  const h = rd("index.html"), css = rd("home.css");
  assert.ok(!/(?:src|href)="https?:\/\/(?!jubilab\.io)/.test(h.replace(/<link rel="canonical"[^>]*>/, "").replace(/<a class="biligene-logo" href="https:\/\/biligene\.com" rel="noopener">/, "")), "no external src or href (the Biligene logo link is the one owner-approved outbound link)");
  assert.ok(!/url\(\s*["']?https?:/.test(css) && !/@import/.test(css), "no external css url");
  assert.match(css, /font-family: "Inter"; src: url\("assets\/fonts\/inter-latin-wght-normal\.woff2"\)/);
  assert.ok(readFileSync(REPO + "assets/fonts/OFL-Inter.txt", "utf8").includes("SIL OPEN FONT LICENSE"));
  assert.ok(!/data:image/.test(h), "the hero art is a file, not a data URI");
});

// Product descriptor (owner idea, T-050). One phrase so it can be swapped in one commit.
const DESCRIPTOR = "the sample operations layer";
test("product descriptor: eyebrow, merged intro, meta, llms.txt; never a named-company comparison", () => {
  const h = rd("index.html"), l = rd("llms.txt");
  assert.match(h, /<span class="eyebrow">The sample operations layer<\/span>/);
  assert.ok(h.includes(`Jubilab, ${DESCRIPTOR}, connects the order, status and result in one workflow`));
  const meta = "Early access by invitation. Jubilab is the sample operations layer that connects the people, labs, couriers and AI agents handling a sample, from order to data.";
  for (const k of ['name="description"', 'property="og:description"', 'name="twitter:description"']) assert.ok(h.includes(`<meta ${k} content="${meta}">`), k);
  assert.ok(meta.length >= 150 && meta.length <= 160);
  assert.ok(l.includes("Jubilab is the sample operations layer: one layer that connects the people, labs, couriers and AI agents that handle a sample, from order to data."));
  assert.ok(!/order-to-result layer/i.test(h));
  assert.ok(!/like stripe|basically like|the stripe of/i.test(h + l));
});

test("typography: Manrope headings (owner pick), Inter body, both self-hosted; no heavy heading weights", () => {
  const css = rd("home.css");
  assert.match(css, /font-family: "Manrope"; src: url\("assets\/fonts\/manrope-latin-wght-normal\.woff2"\)/);
  assert.ok(readFileSync(REPO + "assets/fonts/OFL-Manrope.txt", "utf8").includes("SIL OPEN FONT LICENSE"));
  assert.match(css, /h1, h2 \{ font-family:var\(--head\); font-weight:500; \}/);
  assert.match(css, /h1 \{ letter-spacing:-\.025em; line-height:1\.1; \}/);
  assert.match(css, /h2 \{ letter-spacing:-\.015em; line-height:1\.18; \}/);
  assert.match(css, /h3, h4 \{ font-weight:600;/);
  assert.match(rd("index.html"), /rel="preload" href="assets\/fonts\/manrope-latin-wght-normal\.woff2"/);
});

test("illustrations: every <img> has width, height and alt; flat-colour svg files, small, no text, no external requests; below-the-fold ones are lazy", () => {
  const h = rd("index.html");
  const imgs = [...h.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(imgs.length >= 5, "the illustrations");
  for (const t of imgs) {
    assert.match(t, /\swidth="\d+"/, t); assert.match(t, /\sheight="\d+"/, t); assert.match(t, /\salt="/, t);
    assert.ok(!/src="(?:https?:)?\/\//.test(t) && !/src="data:/.test(t), "no external or data-URI image: " + t);
    assert.match(t, /loading="lazy"/, t);
  }
  for (const m of h.matchAll(/srcset="([^"]+)"/g)) assert.ok(!/^(https?:)?\/\//.test(m[1]));
  const files = readdirSync(REPO + "assets/img").filter((f) => f.startsWith("illus-") && f.endsWith(".svg"));
  assert.ok(files.length >= 5 && !files.some((f) => /plane|agent-door|pets/.test(f)), files.join());
  for (const f of files) {
    const t = readFileSync(REPO + "assets/img/" + f, "utf8");
    assert.ok(t.length < 15000, f + " size");
    assert.ok(!/<text|<image|<script|href=|font-family|https?:\/\//.test(t.replace('xmlns="http://www.w3.org/2000/svg"', "")), f + ": no text, scripts or external refs");
    assert.match(t, /viewBox="0 0 \d+ \d+"/, f);
    assert.ok(h.includes(f.replace(".svg", "") + ".svg") || h.includes(f), f + " is used on the home page");
  }
});

test("Orders dashboard in the hero: one decorative HTML product picture with the four orders; generic names; no caption; no external requests", () => {
  const h = rd("index.html");
  assert.equal((h.match(/class="dash"/g) || []).length, 1);
  const f = h.match(/<figure class="dash"[\s\S]*?<\/figure>/)[0];
  assert.match(f, /role="img" aria-label="Orders dashboard showing four orders from different labs and their current status"/);
  assert.match(f, /<div class="dash-stage" aria-hidden="true">/);
  assert.ok(!/<(a|button|input|select|textarea)\b|tabindex|<figcaption/.test(f), "nothing focusable and no caption");
  assert.deepEqual([...f.matchAll(/<b>(ORD-\d+)<\/b><div class="dash-sm">([^<]+)<\/div><\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><td><span class="dash-chip [^"]+">([^<]+)</g)].map((m) => m.slice(1).join("|")), [
    "ORD-1042|24 samples|Whole-genome sequencing|Sequencing lab|Sequencing",
    "ORD-1041|12 samples|Whole-genome sequencing|Genomics core|QC passed",
    "ORD-1039|48 samples|Targeted sequencing|Sequencing lab|Delivered",
    "ORD-1037|8 samples|Whole-genome sequencing|Nanopore lab|Sample received"]);
  assert.match(f, /<div class="dash-h">All orders<\/div>[\s\S]*<span class="dash-btn">New order<\/span>/);
  assert.match(f, /<th>Order<\/th><th>Service<\/th><th>Lab<\/th><th>Status<\/th>/);
  assert.ok(!/illustrative|example|concept|mock|demo|prototype/i.test(f.replace(/aria-label="[^"]*"/, "")), "no caption words");
  assert.ok(!/https?:|src=/.test(f));
  // the hero visual, right of the headline: once, in the hero, not in the merged section
  const hero = h.match(/<section class="hero"[\s\S]*?<\/section>/)[0];
  assert.ok(hero.includes('class="dash"') && hero.indexOf('<h1') < hero.indexOf('class="dash"'));
  assert.ok(!h.match(/<section id="teams"[\s\S]*?<\/section>/)[0].includes("dash"));
  assert.match(rd("home.css"), /\.dash \{ margin:0 auto; max-width:620px; \}/);
  assert.match(rd("home.css"), /\.dash-bar em \{ font:600/);
});

test("Biligene logo in the story section: owner's brand raster, optimised copy, linked to biligene.com, right column above the quote", () => {
  const h = rd("index.html");
  const sec = h.match(/<section class="story-section"[\s\S]*?<\/section>/)[0];
  assert.match(sec, /<a class="biligene-logo" href="https:\/\/biligene\.com" rel="noopener"><img src="assets\/img\/biligene-logo\.webp" alt="Biligene" width="520" height="207" loading="lazy"><\/a>/);
  assert.ok(sec.indexOf("biligene-logo") > sec.indexOf("</h2>") && sec.indexOf("biligene-logo") < sec.indexOf("story-quote"), "logo sits above the quote");
  const f = readFileSync(REPO + "assets/img/biligene-logo.webp");
  assert.ok(f.length < 30000, "logo under 30 KB: " + f.length);
  assert.equal(f.subarray(0, 4).toString(), "RIFF");
  assert.equal((h.match(/biligene\.com/g) || []).length, 1, "one outbound link only");
  assert.ok(!/Taipei|Billy BioTech Ltd\. \(/.test(h), "footer stays short");
});

test("favicon set (T-051): orange svg with a white mark, ico with 16/32/48, 180px apple-touch icon, links in every page head, files not excluded from the site", () => {
  const svg = rd("assets/favicon.svg");
  assert.ok(svg.includes("#e8520a") && svg.includes('stroke="#fff"') && svg.includes('fill="#fff"') && !/0f766e/.test(svg), "orange tile, white mark, no old teal");
  const ico = readFileSync(REPO + "favicon.ico");
  assert.equal(ico.readUInt16LE(2), 1, "ICO type");
  const n = ico.readUInt16LE(4);
  assert.deepEqual([...Array(n).keys()].map((i) => ico[6 + i * 16]).sort((a, b) => a - b), [16, 32, 48]);
  const png = readFileSync(REPO + "assets/apple-touch-icon.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 180); assert.equal(png.readUInt32BE(20), 180);
  assert.equal(png[25], 2, "RGB colour type: no alpha channel (no transparency)");
  const ignore = rd(".assetsignore");
  assert.ok(!/favicon|apple-touch/.test(ignore), "icons are served");
  const pages = ["index.html", "404.html", "thanks/index.html", "privacy/index.html", "terms/index.html", "guides/index.html", "blog/index.html", "blog/where-did-my-intermediate-files-go/index.html", "guides/reference-genome-build-vcf-bam/index.html", ...CONTENT];
  for (const f of new Set(pages)) {
    const head = rd(f).match(/<head>[\s\S]*?<\/head>/)[0];
    assert.match(head, /<link rel="icon" href="[^"]*assets\/favicon\.svg" type="image\/svg\+xml">/, f);
    assert.ok(head.includes('<link rel="icon" href="/favicon.ico" sizes="48x48">'), f + " ico");
    assert.ok(head.includes('<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">'), f + " apple");
  }
  assert.match(rd("index.html"), /<meta name="theme-color" content="#ffffff">/);
});

// Ecosystem diagram (owner, T-051). One constant for the core wording so it can be swapped in one place.
const ECO_CORE_TITLE = "Sample operations layer";
test("ecosystem diagram: once, inside the For labs section above the option cards; decorative figure; static svg wires; stacked on mobile; no hedge wording", () => {
  const h = rd("index.html");
  assert.equal((h.match(/class="eco"/g) || []).length, 1);
  const labs = h.match(/<section id="labs"[\s\S]*?<\/section>/)[0];
  assert.ok(labs.includes('<figure class="eco"'));
  assert.ok(labs.indexOf("<h2") < labs.indexOf('class="eco"') && labs.indexOf('class="eco"') < labs.indexOf('class="integration"'), "under the heading and intro, above the options");
  assert.ok(!/illus-bench|bench/i.test(labs) && !existsSync(REPO + "assets/img/illus-bench.svg"), "bench picture removed");
  const f = labs.match(/<figure class="eco"[\s\S]*?<\/figure>/)[0];
  assert.match(f, /role="img" aria-label="Jubilab connects the dry lab, the wet lab, courier and logistics, and cloud and data infrastructure through one API and MCP layer"/);
  assert.match(f, /<div class="eco-stage" aria-hidden="true">/);
  assert.ok(!/<(a|button|input|select|textarea|script)\b|tabindex|https?:|src=/.test(f), "nothing focusable, no script, no external request");
  assert.ok(f.includes(`<span class="eco-core-title">${ECO_CORE_TITLE}</span><span class="eco-core-if">API · MCP</span>`));
  for (const t of ["Courier &amp; Logistics", "Dry Lab", "Wet Lab", "Cloud &amp; Data Infrastructure", "ELN / Research Management", "Sample &amp; Project Records", "LIMS", "Lab Instruments", "Shipment Tracking Services", "Cloud Storage", "Data Access"]) assert.ok(f.includes(t), t);
  assert.equal((f.match(/<path class="[tc]"/g) || []).length, 8, "static wires");
  assert.deepEqual([...f.match(/<div class="eco-chips eco-wet-chips">[\s\S]*?<\/div>/)[0].matchAll(/<span class="eco-chip">([^<]+)<\/span>/g)].map((m) => m[1]), ["LIMS", "Lab Instruments", "Emails, APIs &amp; Portals", "Services &amp; Pipelines", "AI Agents"]);
  assert.deepEqual([...f.match(/<div class="eco-chips eco-dry-chips">[\s\S]*?<\/div>/)[0].matchAll(/<span class="eco-chip">([^<]+)<\/span>/g)].map((m) => m[1]), ["ELN / Research Management", "AI Agents", "Analysis Tools", "Compute Infrastructure", "Sample &amp; Project Records"]);
  assert.ok(!/conceptual|potential connection|illustrative|not a claim/i.test(f + rd("home.css").match(/Ecosystem diagram[\s\S]*$/)[0]), "no hedge wording");
  const css = rd("home.css");
  assert.match(css, /\.eco-chip \{[^}]*font-size:\.75rem/, "12px minimum");
  assert.match(css, /@media \(max-width:900px\) \{\s*\.eco \{[\s\S]*?\.eco-core \{ order:0;[\s\S]*?\.eco-courier-side \{ order:1; \}/, "mobile stack, core first");
  assert.ok(!/eco[^{]*\{[^}]*animation/.test(css), "static: no animation");
  assert.ok(!/<script[^>]*>[^<]*eco/.test(h));
  assert.match(rd("llms.txt"), /Through API and MCP, Jubilab connects ELN and research management, LIMS, lab instruments, couriers and logistics, and cloud and data infrastructure\./);
  assert.ok(!/preview-b/.test(rd("sitemap.xml")));
});
