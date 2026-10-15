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

const FULL = [["email", "a@lab.org"], ["role", "lab-head"], ["field", "genetics-genomics"], ["runs-on", "linux"], ["human-data", "yes"]];
const without = (name) => FULL.filter(([k]) => k !== name);
const swap = (name, value) => FULL.map(([k, v]) => (k === name ? [k, value] : [k, v]));
const post = async (pairs) => {
  const WAITLIST = kv();
  const r = await onRequestPost({ request: mk(pairs), env: { WAITLIST } });
  return { r, WAITLIST, rec: (key) => JSON.parse(WAITLIST.m.get("email:" + key)) };
};
const errOf = (r) => new URL(r.headers.get("location")).searchParams.get("error");

test("valid full submission is stored under the right keys", async () => {
  const { r, rec } = await post([["email", " A@Lab.ORG "], ["role", "postdoc-scientist"], ["field", "molecular-cell-biology"], ["runs-on", "hpc-cluster"], ["runs-on", "hpc-cluster"], ["human-data", "no"], ["tools", "nextflow"], ["trace", "old"], ["tracking", "x".repeat(500)]]);
  assert.equal(r.status, 303);
  assert.equal(new URL(r.headers.get("location")).pathname, "/thanks/");
  const v = rec("a@lab.org");
  assert.deepEqual(v.runs_on, ["hpc-cluster"]);
  assert.equal(v.tracking.length, 300);
  assert.equal(v.role, "postdoc-scientist");
  assert.equal(v.human_data, "no");
  assert.deepEqual(Object.keys(v).sort(), ["email","field","field_other","human_data","received_at","role","role_other","runs_on","runs_on_other","tracking"]);
  assert.equal(v.role_other, null);
});
test("each required field missing is rejected with its own error and nothing is stored", async () => {
  for (const [name, code] of [["email", "email"], ["role", "role"], ["field", "field"], ["runs-on", "runs-on"], ["human-data", "human-data"]]) {
    const { r, WAITLIST } = await post(without(name));
    assert.equal(r.status, 303, name);
    assert.equal(errOf(r), code, name);
    assert.equal(WAITLIST.m.size, 0, name);
  }
});
test("optional comment omitted is accepted", async () => {
  const { r, rec } = await post(FULL);
  assert.equal(new URL(r.headers.get("location")).pathname, "/thanks/");
  assert.equal(rec("a@lab.org").tracking, "");
});
test("Other without text is rejected, with whitespace-only text too; nothing stored", async () => {
  for (const [name, value, code] of [["role", "other", "role-other"], ["field", "other", "field-other"], ["runs-on", "other", "runs-on-other"]]) {
    for (const extra of [[], [[code, "   \n "]]]) {
      const { r, WAITLIST } = await post([...swap(name, value), ...extra]);
      assert.equal(errOf(r), code);
      assert.equal(WAITLIST.m.size, 0);
    }
  }
});
test("Other with text is stored, trimmed and capped at 100", async () => {
  const { r, rec } = await post([["email", "a@lab.org"], ["role", "other"], ["role-other", "  Lab   manager  "], ["field", "other"], ["field-other", "y".repeat(150)], ["runs-on", "linux"], ["runs-on", "other"], ["runs-on-other", "Slurm\r\nBcc: evil"], ["human-data", "yes"]]);
  assert.equal(new URL(r.headers.get("location")).pathname, "/thanks/");
  const v = rec("a@lab.org");
  assert.equal(v.role, "other");
  assert.equal(v.role_other, "Lab manager");
  assert.equal(v.field_other.length, 100);
  assert.deepEqual(v.runs_on, ["linux", "other"]);
  assert.equal(v.runs_on_other, "Slurm Bcc: evil");
});
test("other text is ignored (null) when Other is not chosen", async () => {
  const { rec } = await post([...FULL, ["role-other", "sneaky"], ["field-other", "x"], ["runs-on-other", "z"]]);
  const v = rec("a@lab.org");
  assert.equal(v.role_other, null); assert.equal(v.field_other, null); assert.equal(v.runs_on_other, null);
});
test("runs-on accepts several values including Other", async () => {
  const { rec } = await post([...without("runs-on"), ["runs-on", "windows"], ["runs-on", "aws"], ["runs-on", "gcp"], ["runs-on", "other"], ["runs-on-other", "Lambda Labs"]]);
  const v = rec("a@lab.org");
  assert.deepEqual(v.runs_on, ["windows", "aws", "gcp", "other"]);
  assert.equal(v.runs_on_other, "Lambda Labs");
});
test("prefer-not-to-say and unknown option values are rejected", async () => {
  for (const [name, value] of [["human-data", "prefer-not-to-say"], ["human-data", "maybe"], ["role", "wizard"], ["role", "researcher-analyst"], ["field", "alchemy"], ["runs-on", "evil"], ["runs-on", "cloud"]]) {
    const { r, WAITLIST } = await post(swap(name, value));
    assert.equal(errOf(r), name, name + "=" + value);
    assert.equal(WAITLIST.m.size, 0);
  }
  const { r, WAITLIST } = await post([...FULL, ["runs-on", "evil"]]);
  assert.equal(errOf(r), "runs-on");
  assert.equal(WAITLIST.m.size, 0);
});
test("Other text with invalid UTF-8 is rejected", async () => {
  const WAITLIST = kv();
  const body = new URLSearchParams([...swap("role", "other")]).toString() + "&role-other=%FF%FE";
  const r = await onRequestPost({ request: new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }), env: { WAITLIST } });
  assert.equal(errOf(r), "role-other");
  assert.equal(WAITLIST.m.size, 0);
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
  await onRequestPost({ request: mk([...FULL, ["website", "http://spam"]]), env: { WAITLIST } });
  assert.equal(WAITLIST.m.size, 0);
});
test("cross-origin, wrong type, missing binding", async () => {
  assert.equal((await onRequestPost({ request: mk(FULL, { origin: "https://evil.example" }), env: { WAITLIST: kv() } })).status, 403);
  const j = new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal((await onRequestPost({ request: j, env: {} })).status, 415);
  assert.equal((await onRequestPost({ request: mk(FULL), env: {} })).status, 503);
});
test("parse rejects overlong email", () => {
  assert.ok(parse(new URLSearchParams({ email: "a".repeat(250) + "@b.org" })).error);
});

import { buildRaw, makeNotifier } from "../src/notify.js";
const rec = { email: "a@lab.org", role: "other", role_other: "Lab\r\nBcc: evil@x.org", field: "other", field_other: "Physics", runs_on: ["hpc-cluster", "other"], runs_on_other: "Slurm", human_data: "no", tracking: "line1\r\nBcc: evil@x.org", received_at: "2026-10-15T00:00:00.000Z" };

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
  const r = await onRequestPost({ request: mk(swap("email", "b@lab.org")), env: { WAITLIST }, ctx: { waitUntil: (p) => tasks.push(p) }, notify: async () => { throw new Error("mail down"); } });
  await Promise.all(tasks);
  assert.equal(r.status, 303); assert.equal(WAITLIST.m.size, 1);
});

test("notification body lists the new answers and not the old ones", () => {
  const raw = buildRaw(rec, "me@example.org");
  assert.match(raw, /Runs on: hpc-cluster, other \(other: Slurm\)/);
  assert.match(raw, /Role: other \(Lab Bcc: evil@x.org\)/);
  assert.match(raw, /Field: other \(Physics\)/);
  assert.match(raw.split("\r\n\r\n")[0], /^Subject: New early-access request$/m);
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
