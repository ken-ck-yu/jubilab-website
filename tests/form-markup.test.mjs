// The early-access form in index.html must offer exactly the values the Worker accepts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../src/early-access.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const form = html.match(/<form class="form"[\s\S]*?<\/form>/)[0];
const values = (name) => [...form.matchAll(new RegExp(`<input type="radio" name="${name}" value="([^"]+)"`, "g"))].map((m) => m[1]);

test("form fields are exactly the new set", () => {
  const names = [...new Set([...form.matchAll(/<(?:input|textarea)[^>]*\sname="([^"]+)"/g)].map((m) => m[1]))].sort();
  assert.deepEqual(names, ["comment", "eln", "eln-other", "email", "org-type", "providers", "q7_note", "role", "role-other", "volume"]);
});

test("every radio value in the form is accepted by the Worker and the lists match the brief", () => {
  assert.deepEqual(values("org-type"), ["biotech", "pharma", "academic", "provider", "core"]);
  assert.deepEqual(values("eln"), ["benchling", "labguru", "scispot", "other", "none"]);
  assert.deepEqual(values("volume"), ["lt-30", "30-150", "151-500", "gt-500", "unsure"]);
  const base = { email: "a@lab.org", role: "platform-ops", "org-type": "biotech", providers: "x", volume: "lt-30", eln: "none" };
  for (const [name, vs] of [["role", values("role").filter((v) => v !== "other")], ["org-type", values("org-type")], ["volume", values("volume")], ["eln", values("eln").filter((v) => v !== "other")]]) {
    for (const v of vs) assert.ok(parse(new URLSearchParams({ ...base, [name]: v })).record, `${name}=${v}`);
  }
});

test("providers is required with a 200 character cap; the comment is optional with a 300 cap; Other boxes exist for role and ELN", () => {
  assert.match(form, /<input id="providers" name="providers" type="text" maxlength="200" required/);
  assert.match(form, /<textarea id="comment" name="comment" rows="3" maxlength="300"><\/textarea>/);
  assert.match(form, /data-other-for="role"/);
  assert.match(form, /data-other-for="eln"/);
  assert.equal((form.match(/class="field other"/g) || []).length, 2);
});

test("retired fields are gone from the form", () => {
  for (const n of ["field", "runs-on", "human-data", "tracking"]) assert.ok(!form.includes(`name="${n}"`), n);
});

// ---- regression tests added in fix round 1 (T-045)
import { readFileSync as rf } from "node:fs";
const rd2 = (f) => rf(new URL("../" + f, import.meta.url), "utf8");

test("privacy stored-fields table lists exactly the fields parse() stores (plus received_at)", () => {
  const full = new URLSearchParams({ email: "a@lab.org", role: "other", "role-other": "x", "org-type": "core", providers: "p", volume: "unsure", eln: "other", "eln-other": "y", comment: "c" });
  const stored = Object.keys(parse(full).record).sort();
  const table = rd2("privacy/index.html").match(/<tbody>[\s\S]*?<\/tbody>/)[0];
  const listed = [...table.matchAll(/<th scope="row"><code>([a-z_]+)<\/code>/g)].map((m) => m[1]).sort();
  assert.deepEqual(listed, stored);
});

test("privacy no longer describes the old local-first product", () => {
  const t = rd2("privacy/index.html");
  assert.ok(!/own machine|outbound network|data stays with you/i.test(t));
  assert.match(t, /order layer is in design/);
  for (const f of ["privacy/index.html", "terms/index.html"]) assert.match(rd2(f), /Last updated: 25 October 2026/);
});

test("evidence facts are present as intended in plain words, and the 4.5-month case is not attributed to Genohub", () => {
  const h = rd2("index.html").replace(/&ldquo;|&rdquo;/g, '"').replace(/&rsquo;/g, "’");
  assert.match(h, /Novogene reviews every order sheet by hand, in one to two hours, and approves by email/);
  assert.match(h, /Genohub is the most structured marketplace we looked at\. None of its order states is "received" or "QC passed"/);
  assert.match(h, /we found no way for software to place an order/);
  assert.match(h, /One documented order ran 4\.5 months against a 10 to 12 week promise, with no delay notice\. We do not name the provider/);
  assert.match(h, /Our research, about 70 public sources, October 2026/);
  assert.match(h, /Jubilab is not affiliated with them/);
  assert.ok(!/Genohub[^<.]*4\.5 months/.test(h));
  assert.ok(!/<table/.test(h));
});

test("the hero journey strip and the diagram are labelled illustrative", () => {
  const h = rd2("index.html");
  assert.match(h.match(/<figure class="hero-shot journey-fig">[\s\S]*?<\/figure>/)[0], /Illustrative example, not a real order\./);
  assert.match(h.match(/<figure class="dg-fig">[\s\S]*?<\/figure>/)[0], /<figcaption>Illustrative, not real orders\.<\/figcaption>/);
});

test("claims consistency: agents do not 'place an order' next to 'no API'; no actor/'who placed' claim", () => {
  const h = rd2("index.html");
  assert.ok(!/Agents can already[^.]*place an order/.test(h));
  assert.ok(!/who placed an order/.test(h));
});

test("free text drops bidi and zero-width format characters (U+202E and friends)", () => {
  const evil = "‮evil​⁦x⁩﻿ ok";
  const r = parse(new URLSearchParams({ email: "a@lab.org", role: "scientist", "org-type": "core", providers: "ab" + evil, volume: "unsure", eln: "none", comment: "c" + evil }));
  assert.equal(r.record.providers, "abevilx ok");
  assert.equal(r.record.comment, "cevilx ok");
  const o = parse(new URLSearchParams({ email: "a@lab.org", role: "other", "role-other": "‮​", "org-type": "core", providers: "p", volume: "unsure", eln: "none" }));
  assert.equal(o.error, "role-other");
});

test("OG source carries the early-access marker", () => {
  assert.match(rd2("assets/og/og-source.html"), /class="tag">Early access by invitation</);
});
