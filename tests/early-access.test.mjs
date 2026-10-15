// Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, parse, validEmail } from "../src/early-access.js";
import { MESSAGES, withError, serveAsset } from "../src/messages.js";
import { readFileSync } from "node:fs";

const mk = (body, headers = {}) =>
  new Request("https://jubilab.io/api/early-access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(body).toString(),
  });
const kv = () => { const m = new Map(); return { m, put: async (k, v) => m.set(k, v), get: async (k) => (m.has(k) ? m.get(k) : null) }; };

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
test("honeypot (new name) filled: 303 /thanks/, no store, no email, warning without personal data", async () => {
  const WAITLIST = kv();
  const warns = []; const orig = console.warn; console.warn = (...a) => warns.push(a);
  let sent = 0;
  let r;
  try { r = await onRequestPost({ request: mk([...FULL, ["q7_note", "spam"]]), env: { WAITLIST }, notify: async () => { sent++; } }); } finally { console.warn = orig; }
  assert.equal(r.status, 303);
  assert.equal(new URL(r.headers.get("location")).pathname, "/thanks/");
  assert.equal(WAITLIST.m.size, 0);
  assert.equal(sent, 0);
  assert.equal(warns.length, 1);
  assert.match(String(warns[0][0]), /honeypot tripped/);
  assert.ok(!JSON.stringify(warns).includes("lab.org") && !JSON.stringify(warns).includes("spam"));
});
test("real submission without honeypot is stored and notified", async () => {
  const WAITLIST = kv(); let sent = 0;
  await onRequestPost({ request: mk([...FULL, ["q7_note", ""]]), env: { WAITLIST }, notify: async () => { sent++; } });
  assert.equal(WAITLIST.m.size, 1);
  assert.equal(sent, 1);
});
test("cached old page: website= empty or autofilled is still stored (old name is not a honeypot)", async () => {
  for (const v of ["", "https://x.example"]) {
    const { r, WAITLIST } = await post([...FULL, ["website", v]]);
    assert.equal(new URL(r.headers.get("location")).pathname, "/thanks/");
    assert.equal(WAITLIST.m.size, 1);
    assert.ok(!WAITLIST.m.get("email:a@lab.org").includes("x.example"));
  }
});
const SORRY = "We could not send your request. Please go back and try again, or email hello@jubilab.io.";
const capture = async (fn) => {
  const logs = []; const w = console.warn, e = console.error;
  console.warn = (...a) => logs.push(["warn", ...a]); console.error = (...a) => logs.push(["error", ...a]);
  try { return { r: await fn(), logs }; } finally { console.warn = w; console.error = e; }
};
const SAME = { origin: "null", "sec-fetch-site": "same-origin" };
test("cross-origin, wrong type, missing binding: friendly plain-text sentence", async () => {
  const { r: a } = await capture(() => onRequestPost({ request: mk(FULL, { origin: "https://evil.example" }), env: { WAITLIST: kv() } }));
  const j = new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const { r: b } = await capture(() => onRequestPost({ request: j, env: {} }));
  const { r: c } = await capture(() => onRequestPost({ request: mk(FULL), env: {} }));
  for (const [r, st] of [[a, 403], [b, 415], [c, 503]]) {
    assert.equal(r.status, st);
    assert.match(r.headers.get("content-type"), /^text\/plain/);
    assert.equal(await r.text(), SORRY);
  }
});
test("413 and 400 use the same sentence", async () => {
  const big = await onRequestPost({ request: mk(FULL, { "content-length": "99999" }), env: { WAITLIST: kv() } });
  assert.equal(big.status, 413); assert.equal(await big.text(), SORRY);
  assert.match(big.headers.get("content-type"), /^text\/plain/);
  const bad = new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: "garbage" });
  const r = await onRequestPost({ request: bad, env: { WAITLIST: kv() } });
  assert.equal(r.status, 400); assert.equal(await r.text(), SORRY);
});
test("Origin: absent allowed, same origin allowed, foreign rejected", async () => {
  for (const h of [{}, { origin: "https://jubilab.io" }]) {
    const WAITLIST = kv();
    const r = await onRequestPost({ request: mk(FULL, h), env: { WAITLIST } });
    assert.equal(r.status, 303); assert.equal(WAITLIST.m.size, 1);
  }
  const WAITLIST = kv();
  const { r } = await capture(() => onRequestPost({ request: mk(FULL, { origin: "https://evil.example", "sec-fetch-site": "same-origin" }), env: { WAITLIST } }));
  assert.equal(r.status, 403); assert.equal(WAITLIST.m.size, 0);
});
test("Origin null: allowed and stored only with Sec-Fetch-Site same-origin", async () => {
  const WAITLIST = kv();
  const r = await onRequestPost({ request: mk(FULL, SAME), env: { WAITLIST } });
  assert.equal(r.status, 303);
  assert.equal(new URL(r.headers.get("location")).pathname, "/thanks/");
  assert.equal(WAITLIST.m.size, 1);
  for (const extra of [{}, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }, { "sec-fetch-site": "none" }]) {
    const W = kv();
    const { r: x } = await capture(() => onRequestPost({ request: mk(FULL, { origin: "null", ...extra }), env: { WAITLIST: W } }));
    assert.equal(x.status, 403, JSON.stringify(extra)); assert.equal(W.m.size, 0);
  }
});
test("silent-failure log lines: present, and none contain the email or other values", async () => {
  const WAITLIST = kv();
  await onRequestPost({ request: mk(FULL), env: { WAITLIST } });
  const dup = await capture(() => onRequestPost({ request: mk(FULL), env: { WAITLIST } }));
  assert.equal(dup.r.status, 303);
  assert.deepEqual(dup.logs.map((l) => [l[0], l[1]]), [["warn", "duplicate signup ignored"]]);
  const org = await capture(() => onRequestPost({ request: mk(FULL, { origin: "https://evil.example" }), env: { WAITLIST } }));
  assert.equal(org.logs.length, 1);
  assert.equal(org.logs[0][0], "warn"); assert.equal(org.logs[0][1], "origin rejected");
  assert.deepEqual(org.logs[0][2], { origin: "https://evil.example" });
  const nobind = await capture(() => onRequestPost({ request: mk(FULL), env: {} }));
  assert.equal(nobind.logs.length, 1); assert.equal(nobind.logs[0][0], "error");
  for (const l of [...dup.logs, ...org.logs, ...nobind.logs]) {
    const t = JSON.stringify(l);
    assert.ok(!t.includes("lab.org") && !t.includes("lab-head") && !t.includes("genetics"), t);
  }
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

// D4
test("email validation rejects each bad class and keeps good ones", () => {
  const bad = ["a b@lab.org", "a\tb@lab.org", "a\u0001@lab.org", "a%40b@lab.org", "<a>@lab.org", "a,b@lab.org", "a;b@lab.org", 'a"b@lab.org', "a'b@lab.org", "a\\b@lab.org",
    "a@b@lab.org", "a@@lab.org", "nope", "@lab.org", "a@lab", "a@.lab.org", "a@lab..org", "a@lab.org.", "a@-lab.org", "a@lab-.org", "a@lab.-org",
    "a".repeat(65) + "@lab.org", "a@" + "b".repeat(250) + ".org"];
  for (const e of bad) assert.equal(validEmail(e), false, JSON.stringify(e));
  for (const e of ["josé@lab.org", "a+b@lab.org", "a.b-c_d@sub.lab.co.uk", "a".repeat(64) + "@lab.org", "a@x-y.org"]) assert.equal(validEmail(e), true, e);
  assert.equal(validEmail("a".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(62)), false); // 255 chars
});
test("josé@lab.org and a+b@lab.org are accepted end to end", async () => {
  for (const e of ["josé@lab.org", "a+b@lab.org"]) {
    const { r, WAITLIST } = await post(swap("email", e));
    assert.equal(new URL(r.headers.get("location")).pathname, "/thanks/");
    assert.equal(WAITLIST.m.size, 1);
  }
});
// D5
test("tracking: invalid UTF-8 rejected, control chars stripped, newline kept, 300 cap", async () => {
  const WAITLIST = kv();
  const raw = (t) => new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(FULL).toString() + "&tracking=" + t });
  const r = await onRequestPost({ request: raw("ok%FF%FE"), env: { WAITLIST } });
  assert.equal(errOf(r), "tracking");
  assert.equal(WAITLIST.m.size, 0);
  const ok = await post([...FULL, ["tracking", "a\u0000b\u0007c\r\nline2\u001b[31m"]]);
  assert.equal(ok.rec("a@lab.org").tracking, "abc\nline2[31m");
  const long = await post([...FULL, ["tracking", "é".repeat(400)]]);
  assert.equal([...long.rec("a@lab.org").tracking].length, 300);
});
// D2
test("duplicate email keeps the first record, sends no second notification, redirects identically", async () => {
  const WAITLIST = kv(); const sent = [];
  const env = { WAITLIST };
  const send = (pairs) => onRequestPost({ request: mk(pairs), env, ctx: { waitUntil: (p) => p }, notify: async (rc) => { sent.push(rc.role); } });
  const r1 = await send(FULL);
  await new Promise((r) => setTimeout(r, 5));
  const r2 = await send(swap("role", "grad-student").map(([k, v]) => (k === "email" ? [k, " A@LAB.org "] : [k, v])));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(r1.headers.get("location"), r2.headers.get("location"));
  assert.equal(r2.status, r1.status);
  assert.equal(WAITLIST.m.size, 1);
  assert.equal(JSON.parse(WAITLIST.m.get("email:a@lab.org")).role, "lab-head");
  assert.deepEqual(sent, ["lab-head"]);
});
// D1
const PAGE = readFileSync(new URL("../index.html", import.meta.url), "utf8");
test("withError shows the right message for each known code without JS and leaves unknown codes alone", () => {
  assert.equal(Object.keys(MESSAGES).length, 9);
  for (const [code, msg] of Object.entries(MESSAGES)) {
    const out = withError(PAGE, code);
    const m = /<p class="form-error" id="form-error"([^>]*)>([^<]*)<\/p>/.exec(out);
    assert.ok(m && !/\bhidden\b/.test(m[1]), code);
    assert.equal(m[2].replace(/&amp;/g, "&").replace(/&quot;/g, '"'), msg);
  }
  for (const code of ["bogus", "constructor", "__proto__", "", "<script>"]) assert.equal(withError(PAGE, code), PAGE);
  assert.equal((withError(PAGE, "role").match(/id="form-error"/g) || []).length, 1);
});
test("withError escapes message text", () => {
  const html = '<p class="form-error" id="form-error" role="alert" tabindex="-1" hidden>x</p>';
  MESSAGES.__t = '<b>"&</b>';
  try { assert.match(withError(html, "__t"), />&lt;b&gt;&quot;&amp;&lt;\/b&gt;</); } finally { delete MESSAGES.__t; }
});
test("theme.js message copy matches src/messages.js", () => {
  const js = readFileSync(new URL("../assets/theme.js", import.meta.url), "utf8");
  for (const [code, msg] of Object.entries(MESSAGES)) assert.ok(js.includes(JSON.stringify(msg)), code);
});
test("serveAsset rewrites / with a known error only, passes everything else through", async () => {
  const env = { ASSETS: { fetch: async () => new Response(PAGE, { headers: { "content-type": "text/html", etag: "x" } }) } };
  const get = (path, method = "GET") => serveAsset(new Request("https://jubilab.io" + path, { method }), env);
  const hit = await get("/?error=role-other#access");
  assert.match(await hit.text(), /id="form-error"[^>]*>You chose Other for your role/);
  assert.equal(hit.headers.get("cache-control"), "no-store");
  assert.equal(await (await get("/?error=bogus")).text(), PAGE);
  assert.equal(await (await get("/")).text(), PAGE);
  assert.equal(await (await get("/privacy/?error=role")).text(), PAGE);
});
