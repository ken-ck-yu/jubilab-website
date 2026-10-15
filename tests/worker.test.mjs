// Run: node --test
// Drives the real Worker entry (src/worker.js) with a mock ASSETS binding. "cloudflare:email" only exists
// inside the Workers runtime, so a resolve hook stubs it for this test.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "cloudflare:email") return { url: "data:text/javascript,export class EmailMessage{}", shortCircuit: true };
    return next(spec, ctx);
  },
});
const { default: worker } = await import("../src/worker.js");

const HOME = '<html><body><p class="form-error" id="form-error" role="alert" hidden></p></body></html>';
const ASSETS = {
  calls: [],
  async fetch(req) {
    this.calls.push(new URL(req.url).pathname);
    const p = new URL(req.url).pathname;
    if (p === "/style.css") return new Response("body{}", { headers: { "content-type": "text/css", "cache-control": "public, max-age=0, must-revalidate", etag: '"abc"' } });
    return new Response(HOME, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate", etag: '"home"' } });
  },
};
const call = (path) => worker.fetch(new Request("https://jubilab.io" + path), { ASSETS }, { waitUntil() {} });

test("wrangler.jsonc sends /api/*, / and /index.html through the Worker, and nothing else", () => {
  const src = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  // Strip // and /* */ comments outside strings.
  const json = src.replace(/"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m.startsWith('"') ? m : ""));
  const cfg = JSON.parse(json);
  assert.deepEqual([...cfg.assets.run_worker_first].sort(), ["/", "/api/*", "/index.html"]);
  for (const p of ["/thanks/", "/privacy/", "/terms/", "/style.css"]) assert.ok(!cfg.assets.run_worker_first.includes(p));
});

test("Worker: /?error=email returns the home page with the message visible and no hidden", async () => {
  const r = await call("/?error=email");
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.match(html, /That email address does not look right\./);
  assert.ok(!/id="form-error"[^>]*hidden/.test(html));
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("etag"), null);
});

test("Worker: / without error and /style.css pass through untouched, headers included", async () => {
  const home = await call("/");
  assert.equal(await home.text(), HOME);
  assert.equal(home.headers.get("etag"), '"home"');
  assert.equal(home.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  const css = await call("/style.css");
  assert.equal(await css.text(), "body{}");
  assert.equal(css.headers.get("content-type"), "text/css");
  assert.equal(css.headers.get("etag"), '"abc"');
  assert.equal(css.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  const bogus = await call("/?error=bogus");
  assert.match(await bogus.text(), /id="form-error"[^>]*hidden/);
});

test("Worker: GET /api/early-access is 405 with Allow: POST", async () => {
  const r = await call("/api/early-access");
  assert.equal(r.status, 405);
  assert.equal(r.headers.get("allow"), "POST");
});
