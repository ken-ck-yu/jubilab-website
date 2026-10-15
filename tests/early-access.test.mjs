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
  const r = await onRequestPost({ request: mk([["email", " A@Lab.ORG "], ["role", "lab-head"], ["runs-on", "hpc-cluster"], ["runs-on", "hpc-cluster"], ["runs-on", "evil"], ["tools", "nextflow"], ["trace", "old"], ["tracking", "x".repeat(500)]]), env: { WAITLIST } });
  assert.equal(r.status, 303);
  assert.equal(new URL(r.headers.get("location")).pathname, "/thanks/");
  const rec = JSON.parse(WAITLIST.m.get("email:a@lab.org"));
  assert.deepEqual(rec.runs_on, ["hpc-cluster"]);
  assert.equal(rec.tracking.length, 300);
  assert.equal(rec.role, "lab-head");
  assert.deepEqual(Object.keys(rec).sort(), ["email","field","human_data","received_at","role","runs_on","tracking"]);
});
test("old field names are not stored; empty optional fields are null or empty", async () => {
  const WAITLIST = kv();
  await onRequestPost({ request: mk([["email", "o@lab.org"], ["tools", "galaxy"], ["trace", "old answer"]]), env: { WAITLIST } });
  const rec = JSON.parse(WAITLIST.m.get("email:o@lab.org"));
  assert.equal("tools" in rec, false);
  assert.equal("trace" in rec, false);
  assert.deepEqual(rec.runs_on, []);
  assert.equal(rec.tracking, "");
  assert.equal(rec.role, null);
});
test("runs-on accepts several allowed values and the human-data choice is validated", async () => {
  const WAITLIST = kv();
  await onRequestPost({ request: mk([["email", "r@lab.org"], ["runs-on", "laptop-workstation"], ["runs-on", "cloud"], ["runs-on", "other"], ["human-data", "maybe"]]), env: { WAITLIST } });
  const rec = JSON.parse(WAITLIST.m.get("email:r@lab.org"));
  assert.deepEqual(rec.runs_on, ["laptop-workstation", "cloud", "other"]);
  assert.equal(rec.human_data, null);
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

import { buildRaw, makeNotifier } from "../src/notify.js";
const rec = { email: "a@lab.org", role: "lab-head", field: null, runs_on: ["hpc-cluster"], human_data: null, tracking: "line1\r\nBcc: evil@x.org", received_at: "2026-10-15T00:00:00.000Z" };

test("notification mime has fixed subject and no header injection", () => {
  const raw = buildRaw({ ...rec, email: "a@lab.org\r\nBcc: evil@x.org" }, "me@example.org\r\nBcc: x@y.z");
  const [head] = raw.split("\r\n\r\n");
  assert.ok(!/^Bcc:/mi.test(head));
  assert.match(head, /^Subject: New early-access request$/m);
  assert.match(head, /^To: me@example.org Bcc: x@y.z$/m);
});
test("notifier sends only when configured and signup survives a send failure", async () => {
  const sent = [];
  class Msg { constructor(f, t, r) { Object.assign(this, { f, t, r }); } }
  const notify = makeNotifier(Msg);
  assert.equal(await notify(rec, {}), false);
  assert.equal(await notify(rec, { EMAIL: { send: async (m) => sent.push(m) }, NOTIFY_TO: "me@example.org" }), true);
  assert.equal(sent[0].t, "me@example.org");
  const WAITLIST = kv(); const tasks = [];
  const r = await onRequestPost({ request: mk({ email: "b@lab.org" }), env: { WAITLIST }, ctx: { waitUntil: (p) => tasks.push(p) }, notify: async () => { throw new Error("mail down"); } });
  await Promise.all(tasks);
  assert.equal(r.status, 303); assert.equal(WAITLIST.m.size, 1);
});

test("notification body lists the new answers and not the old ones", () => {
  const raw = buildRaw(rec, "me@example.org");
  assert.match(raw, /Runs on: hpc-cluster/);
  assert.match(raw, /How they keep track of how a result was made today:/);
  assert.ok(!/Tools:/.test(raw));
});

test("malformed multipart body gives 400, not an unhandled error", async () => {
  const r = await onRequestPost({ request: new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=xyz" }, body: "garbage not multipart" }), env: { WAITLIST: kv() } });
  assert.equal(r.status, 400);
});
test("chunked body over 8 KB is rejected with 413 without a content-length", async () => {
  const WAITLIST = kv();
  const big = "email=a%40b.co&tracking=" + "x".repeat(9000);
  const stream = new ReadableStream({ start(c) { const e = new TextEncoder().encode(big); c.enqueue(e.slice(0, 4000)); c.enqueue(e.slice(4000)); c.close(); } });
  const request = new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: stream, duplex: "half" });
  assert.equal(request.headers.get("content-length"), null);
  const r = await onRequestPost({ request, env: { WAITLIST } });
  assert.equal(r.status, 413);
  assert.equal(WAITLIST.m.size, 0);
});
test("email with invalid UTF-8 is treated as an invalid email", async () => {
  const WAITLIST = kv();
  const r = await onRequestPost({ request: new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "email=%FF%FE@b.co" }), env: { WAITLIST } });
  assert.equal(r.status, 303);
  assert.match(r.headers.get("location"), /error=email/);
  assert.equal(WAITLIST.m.size, 0);
});
