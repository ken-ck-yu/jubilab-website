// The early-access form in index.html must offer exactly the values the Worker accepts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../src/early-access.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const form = html.match(/<form class="form[^"]*"[\s\S]*?<\/form>/)[0];
// The owner's redesign uses dropdowns; each option value is exactly a value the Worker accepts.
const values = (name) => [...form.match(new RegExp(`<select id="[^"]+" name="${name}" required>[\\s\\S]*?</select>`))[0].matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);

test("form fields are exactly the new set", () => {
  const names = [...new Set([...form.matchAll(/<(?:input|textarea|select)[^>]*\sname="([^"]+)"/g)].map((m) => m[1]))].sort();
  assert.deepEqual(names, ["comment", "eln", "eln-other", "email", "org-type", "providers", "q7_note", "role", "role-other", "volume"]);
  assert.match(form, /action="\/api\/early-access" method="post"/);
  assert.match(form, /<p class="form-error" id="form-error" role="alert" tabindex="-1" hidden>/);
  assert.match(form, /name="q7_note" tabindex="-1" autocomplete="off"/, "honeypot kept");
});

test("every dropdown value in the form is accepted by the Worker and the lists match the brief", () => {
  assert.deepEqual(values("role"), ["platform-ops", "comp-bio", "scientist", "procurement", "provider-staff", "agent-dev", "other"]);
  assert.deepEqual(values("org-type"), ["biotech", "pharma", "academic", "provider", "core"]);
  assert.deepEqual(values("eln"), ["benchling", "labguru", "scispot", "other", "none"]);
  assert.deepEqual(values("volume"), ["lt-30", "30-150", "151-500", "gt-500", "unsure"]);
  const base = { email: "a@lab.org", role: "platform-ops", "org-type": "biotech", providers: "x", volume: "lt-30", eln: "none" };
  for (const [name, vs] of [["role", values("role").filter((v) => v !== "other")], ["org-type", values("org-type")], ["volume", values("volume")], ["eln", values("eln").filter((v) => v !== "other")]]) {
    for (const v of vs) assert.ok(parse(new URLSearchParams({ ...base, [name]: v })).record, `${name}=${v}`);
  }
});

test("every field but the comment is required, including each dropdown (placeholder option has an empty value)", () => {
  for (const n of ["role", "org-type", "volume", "eln"]) assert.match(form, new RegExp(`<select id="${n}" name="${n}" required>\\s*<option value="">`), n);
  assert.match(form, /<input id="email" name="email" type="email" autocomplete="email" required/);
  assert.ok(!/<textarea[^>]*required/.test(form));
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
  assert.match(t, /This website collects only what is listed on this page\. No product data is collected through this website\./);
  assert.ok(!/in design|is not released/.test(t));
  for (const f of ["privacy/index.html", "terms/index.html"]) assert.match(rd2(f), /Last updated: 25 October 2026/);
});

test("no figcaption and no illustrative wording near the hero card or the diagrams", () => {
  const h = rd2("index.html");
  assert.ok(!/<figcaption/.test(h.match(/<section class="hero"[\s\S]*?<\/section>/)[0]));
  assert.ok(!/<figcaption>/.test(h.match(/<section id="how"[\s\S]*?<\/section>/)[0]));
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
