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
    if (!f.startsWith(root) || !existsSync(f) || statSync(f).isDirectory()) return new Response(readFileSync(join(root, "404.html")), { status: 404, headers: { "content-type": "text/html" } });
    return new Response(readFileSync(f), { headers: { "content-type": TYPES[extname(f)] || "application/octet-stream", "cache-control": "public, max-age=0, must-revalidate" } });
  },
};
const kv = new Map();
const env = { ASSETS, WAITLIST: { async get(k) { return kv.has(k) ? kv.get(k) : null; }, async put(k, v) { kv.set(k, v); console.log("PUT", k); } }, EMAIL: { async send() {} }, NOTIFY_TO: "x@example.org" };
createServer(async (rq, rs) => {
  const chunks = []; for await (const c of rq) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const url = "http://" + rq.headers.host + rq.url;
  const req = new Request(url, { method: rq.method, headers: rq.headers, body: ["GET", "HEAD"].includes(rq.method) ? undefined : body });
  const res = matches(new URL(url).pathname) ? await worker.fetch(req, env, { waitUntil() {} }) : await ASSETS.fetch(req);
  rs.writeHead(res.status, Object.fromEntries(res.headers)); rs.end(Buffer.from(await res.arrayBuffer()));
}).listen(Number(process.argv[2] || 18142), "127.0.0.1", () => console.log("listening", process.argv[2]));
