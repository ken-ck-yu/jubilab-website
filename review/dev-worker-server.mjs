// QA-2: local stand-in for `wrangler dev` (wrangler is not installed). Runs the REAL src/worker.js with an in-memory KV
// and a fake EMAIL binding, serving files from the repo as the ASSETS binding. Routing mirrors wrangler.jsonc
// assets.run_worker_first (read from the file): matching paths go to the Worker, others straight to static.
// Usage: node review/dev-worker-server.mjs <port>   Prints "PUT <key>" to stdout for every record stored.
import { registerHooks } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
registerHooks({ resolve(s, c, n) { if (s === "cloudflare:email") return { url: "data:text/javascript,export class EmailMessage{}", shortCircuit: true }; return n(s, c); } });
const { default: worker } = await import("../src/worker.js");
const root = new URL("..", import.meta.url).pathname;
const cfg = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8").replace(/"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m.startsWith('"') ? m : "")));
const patterns = cfg.assets.run_worker_first;
const matches = (p) => patterns.some((x) => (x.endsWith("*") ? p.startsWith(x.slice(0, -1)) : p === x));
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".txt": "text/plain", ".xml": "application/xml", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png" };
const ASSETS = {
  async fetch(req) {
    let p = new URL(req.url).pathname;
    let f = join(root, decodeURIComponent(p));
    if (p.endsWith("/")) f = join(f, "index.html");
    if (!f.startsWith(root) || p === "/_headers" || p === "/_redirects" || !existsSync(f) || statSync(f).isDirectory()) return new Response(readFileSync(join(root, "404.html")), { status: 404, headers: { "content-type": "text/html" } });
    const hd = new Headers({ "content-type": TYPES[extname(f)] || "application/octet-stream", "cache-control": "public, max-age=0, must-revalidate" });
    applyHeaders(p, hd);
    return new Response(readFileSync(f), { headers: hd });
  },
};
// Emulates the platform's _headers file (splat patterns, headers merged across matching rules); _headers itself is never served.
const HEADER_RULES = (() => {
  const rules = []; let cur = null;
  const file = join(root, "_headers");
  if (!existsSync(file)) return rules;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) { cur = { re: new RegExp("^" + raw.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"), h: [] }; rules.push(cur); }
    else { const i = raw.indexOf(":"); cur.h.push([raw.slice(0, i).trim().toLowerCase(), raw.slice(i + 1).trim()]); }
  }
  return rules;
})();
export const applyHeaders = (pathname, headers) => {
  const add = new Map();
  for (const r of HEADER_RULES) if (r.re.test(pathname)) for (const [k, v] of r.h) add.set(k, add.has(k) ? add.get(k) + ", " + v : v);
  for (const [k, v] of add) headers.set(k, v);
};
const kv = new Map();
const env = { ASSETS, WAITLIST: { async get(k) { return kv.has(k) ? kv.get(k) : null; }, async put(k, v) { kv.set(k, v); console.log("PUT", k); } }, EMAIL: { async send() {} }, NOTIFY_TO: "x@example.org" };
createServer(async (rq, rs) => {
  const chunks = []; for await (const c of rq) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const url = "http://" + rq.headers.host + rq.url;
  const req = new Request(url, { method: rq.method, headers: rq.headers, body: ["GET", "HEAD"].includes(rq.method) ? undefined : body });
  const res = matches(new URL(url).pathname) ? await worker.fetch(req, env, { waitUntil() {} }) : await ASSETS.fetch(req);
  const out = new Headers(res.headers);
  if (matches(new URL(url).pathname)) applyHeaders(new URL(url).pathname, out);  // Worker-served paths: the platform applies _headers to its responses too
  rs.writeHead(res.status, Object.fromEntries(out)); rs.end(Buffer.from(await res.arrayBuffer()));
}).listen(Number(process.argv[2] || 18142), "127.0.0.1", () => console.log("listening", process.argv[2]));
