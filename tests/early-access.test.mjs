// Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, parse } from "../src/early-access.js";

const mk = (body, headers = {}) =>
  new Request("https://jubilab.io/api/early-access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(body).toString(),
  });
const kv = () => { const m = new Map(); return { m, put: async (k, v) => m.set(k, v) }; };

test("valid submission is stored and redirects to thanks", async () => {
  const WAITLIST = kv();
  const r = await onRequestPost({ request: mk([["email", " A@Lab.ORG "], ["role", "lab-head"], ["tools", "nextflow"], ["tools", "evil"], ["trace", "x".repeat(500)]]), env: { WAITLIST } });
  assert.equal(r.status, 303);
  assert.equal(new URL(r.headers.get("location")).pathname, "/thanks/");
  const rec = JSON.parse(WAITLIST.m.get("email:a@lab.org"));
  assert.deepEqual(rec.tools, ["nextflow"]);
  assert.equal(rec.trace.length, 300);
  assert.equal(rec.role, "lab-head");
  assert.deepEqual(Object.keys(rec).sort(), ["email","field","human_data","received_at","role","tools","trace"]);
});
test("bad email is not stored", async () => {
  const WAITLIST = kv();
  const r = await onRequestPost({ request: mk({ email: "nope" }), env: { WAITLIST } });
  assert.equal(r.status, 303);
  assert.match(r.headers.get("location"), /error=email/);
  assert.equal(WAITLIST.m.size, 0);
});
test("honeypot is not stored", async () => {
  const WAITLIST = kv();
  await onRequestPost({ request: mk({ email: "a@b.org", website: "http://spam" }), env: { WAITLIST } });
  assert.equal(WAITLIST.m.size, 0);
});
test("cross-origin, wrong type, missing binding", async () => {
  assert.equal((await onRequestPost({ request: mk({ email: "a@b.org" }, { origin: "https://evil.example" }), env: { WAITLIST: kv() } })).status, 403);
  const j = new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal((await onRequestPost({ request: j, env: {} })).status, 415);
  assert.equal((await onRequestPost({ request: mk({ email: "a@b.org" }), env: {} })).status, 503);
});
test("parse rejects overlong email", () => {
  assert.ok(parse(new URLSearchParams({ email: "a".repeat(250) + "@b.org" })).error);
});
