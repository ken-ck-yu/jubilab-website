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
