// QA-2 break-it harness: drives src/worker.js with mock ASSETS + KV. Run: node review/hostile-worker.mjs
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
registerHooks({ resolve(s, c, n) { if (s === "cloudflare:email") return { url: "data:text/javascript,export class EmailMessage{constructor(f,t,r){this.raw=r}}", shortCircuit: true }; return n(s, c); } });
const { default: worker } = await import("../src/worker.js");
const HOME = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const out = console.log.bind(console);
let logs = []; const allLogs = [];
for (const k of ["warn", "error"]) console[k] = (...a) => logs.push(k + " " + JSON.stringify(a));
const kv = { m: new Map(), async get(k) { return this.m.has(k) ? this.m.get(k) : null; }, async put(k, v) { this.m.set(k, v); } };
const sent = [];
const env = { WAITLIST: kv, EMAIL: { async send(m) { sent.push(m.raw); } }, NOTIFY_TO: "o@x.org", ASSETS: { async fetch(r) { return new Response(HOME, { headers: { "content-type": "text/html", etag: '"x"', "cache-control": "public, max-age=0" } }); } } };
const ctx = { waitUntil(p) { ctx.p.push(p); }, p: [] };
const OK = "email=a%40lab.org&role=postdoc-scientist&field=genetics-genomics&runs-on=linux&human-data=no";
async function post(body, headers = {}, path = "/api/early-access") {
  logs = []; const before = kv.m.size;
  const r = await worker.fetch(new Request("https://jubilab.io" + path, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body, duplex: "half" }), env, ctx);
  await Promise.all(ctx.p); allLogs.push(...logs);
  return { st: r.status, loc: r.headers.get("location"), ct: r.headers.get("content-type"), stored: kv.m.size - before, body: r.status >= 400 ? await r.text() : "", logs: [...logs] };
}
const row = (n, r) => out(n.padEnd(46), r.st, r.loc || r.ct || "", "stored=" + r.stored, r.logs.join(" | ").slice(0, 160));
out("== Origin variants");
let i = 0;
for (const [o, sfs] of [["null", "same-origin"], ["null", "cross-site"], ["null", undefined], ["null", "same-site"], ["null", "none"], ["NULL", "same-origin"], ["https://jubilab.io.evil.com", "same-origin"], ["https://jubilab.io", undefined], ["https://jubilab.io", "cross-site"], ["", undefined], ["http://jubilab.io", undefined], ["https://evil.com", "same-origin"]]) {
  const h = { origin: o }; if (sfs) h["sec-fetch-site"] = sfs;
  row(`origin=${JSON.stringify(o)} sfs=${sfs}`, await post(OK.replace("a%40", `o${i++}%40`), h));
}
out("== honeypot / old website field");
row("q7_note filled", await post(OK + "&q7_note=http%3A%2F%2Fspam"));
row("q7_note empty", await post(OK.replace("a%40", "h1%40") + "&q7_note="));
row("website filled (old) valid", await post(OK.replace("a%40", "h2%40") + "&website=https%3A%2F%2Fexample.org"));
row("website filled, bad email", await post("email=bad&website=x&" + OK.slice(OK.indexOf("&") + 1)));
row("q7_note whitespace only", await post(OK.replace("a%40", "h3%40") + "&q7_note=%20"));
out("== duplicates");
row("dup 1st", await post("email=Dup%40Lab.ORG&" + OK.slice(OK.indexOf("&") + 1)));
row("dup 2nd same case", await post("email=Dup%40Lab.ORG&" + OK.slice(OK.indexOf("&") + 1)));
row("dup 3rd lowercase", await post("email=dup%40lab.org&" + OK.slice(OK.indexOf("&") + 1)));
row("dup 4th padded", await post("email=%20DUP%40lab.org%20&" + OK.slice(OK.indexOf("&") + 1)));
out("keys:", [...kv.m.keys()].join(","), "emails sent:", sent.length);
out("== header injection / hostile fields");
const inj = await post("email=inj%40lab.org&role=other&role-other=x%0D%0ABcc%3A%20evil%40x.org&field=other&field-other=y%0D%0ASubject%3A%20pwn&runs-on=other&runs-on-other=z%0D%0A%0D%0Abody&human-data=no&tracking=t%0D%0ABcc%3A%20e%40x.org");
row("CRLF in role/field/runs-on other + tracking", inj);
const rec = JSON.parse(kv.m.get("email:inj@lab.org") || "null"); out(" stored:", JSON.stringify(rec && { ro: rec.role_other, fo: rec.field_other, rn: rec.runs_on_other, tr: rec.tracking }));
const hdrs = sent[sent.length - 1].split("\r\n\r\n")[0]; out(" email header block lines:", hdrs.split("\r\n").length, "Bcc in headers:", /^Bcc:/mi.test(hdrs));
row("email with CRLF", await post("email=a%0D%0ABcc%3Ax%40y.org%40lab.org&" + OK.slice(OK.indexOf("&") + 1)));
row("email with %00 / ' ", await post("email=a%00%40lab.org&" + OK.slice(OK.indexOf("&") + 1)));
row("email __proto__ fields", await post(OK.replace("a%40", "p%40") + "&__proto__=x&constructor=y"));
out("logs contain PII?", allLogs.some((l) => /lab\.org|@/.test(l)));
out("== size boundary (content-length absent/present)");
const base = OK.replace("a%40", "sz%40") + "&tracking=";
for (const n of [8191, 8192, 8193]) {
  const tag = "sz" + n, b0 = OK.replace("a%40", tag + "%40") + "&tracking=";
  const b = b0 + "a".repeat(n - b0.length);
  row(`body ${b.length}B (CL header)`, await post(b));
}
function chunked(total, tag) {
  const b = (OK.replace("a%40", tag + "%40") + "&tracking=").padEnd(total, "a");
  const enc = new TextEncoder().encode(b);
  return new ReadableStream({ start(c) { for (let o = 0; o < enc.length; o += 1000) c.enqueue(enc.slice(o, o + 1000)); c.close(); } });
}
for (const n of [8191, 8192, 8193]) {
  logs = []; const r = await worker.fetch(new Request("https://jubilab.io/api/early-access", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: chunked(n, "ch" + n), duplex: "half" }), env, ctx);
  out(`chunked ${n}B`.padEnd(46), r.status, r.headers.get("location") || "");
}
out("== wrong content type / method");
row("text/plain", await post(OK, { "content-type": "text/plain" }));
row("json", await post("{}", { "content-type": "application/json" }));
row("multipart garbage", await post("junk", { "content-type": "multipart/form-data; boundary=x" }));
row("no WAITLIST binding", await (async () => { const e = env.WAITLIST; delete env.WAITLIST; const r = await post(OK.replace("a%40", "nb%40")); env.WAITLIST = e; return r; })());
out("PII scan of ALL logs so far, hits:", allLogs.filter((l) => /lab\.org|@lab|dup@/i.test(l)).length);
out("== GET variants");
async function get(path, method = "GET") {
  const r = await worker.fetch(new Request("https://jubilab.io" + path, { method }), env, ctx);
  const t = method === "HEAD" ? "" : await r.text();
  const box = (t.match(/<p class="form-error"[^>]*>[^<]*/) || [""])[0];
  return `${r.status} cc=${r.headers.get("cache-control")} allow=${r.headers.get("allow")} len=${t.length} box=${box.includes("hidden") ? "HIDDEN" : box ? "VISIBLE:" + box.slice(box.indexOf(">") + 1, box.indexOf(">") + 40) : "none"}`;
}
for (const p of ["/?error=email", "/?error=EMAIL", "/?error=__proto__", "/?error=constructor", "/?error=toString", "/?error=hasOwnProperty", "/?error=email&error=bogus", "/?error=bogus&error=email", "/?error=%3Cscript%3Ealert(1)%3C/script%3E", "/?error=", "/?error", "/index.html?error=role", "/index.html?error=role-other", "//", "//?error=email", "/?x=1"]) out(p.padEnd(46), await get(p));
for (const [p, m] of [["/", "HEAD"], ["/?error=email", "HEAD"], ["/", "OPTIONS"], ["/api/early-access", "HEAD"], ["/api/early-access", "OPTIONS"], ["/api/early-access", "GET"], ["/api/early-access", "PUT"], ["/api/early-access/", "POST"], ["/api/other", "GET"], ["/API/early-access", "POST"]]) out(`${m} ${p}`.padEnd(46), await get(p, m).catch((e) => "THROW " + e.message));
