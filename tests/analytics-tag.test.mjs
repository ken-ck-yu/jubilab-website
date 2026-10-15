// The Google tag (GA4) must be present verbatim, once, straight after <head>, on every page; nothing else external.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;
const PAGES = ["index.html", "privacy/index.html", "terms/index.html", "thanks/index.html", "404.html"];
const SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-8W2MDQ58PL"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-8W2MDQ58PL');
</script>
`;
const page = (p) => readFileSync(REPO + p, "utf8");

for (const p of PAGES) {
  test(`${p}: exact Google tag once, immediately after <head>`, () => {
    const t = page(p);
    assert.equal(t.split(SNIPPET).length - 1, 1);
    assert.equal(t.split("googletagmanager.com").length - 1, 1);
    assert.equal(t.split("G-8W2MDQ58PL").length - 1, 2);
    assert.ok(t.includes("<head>\n" + SNIPPET + "<meta charset"), "snippet must follow <head> directly");
  });

  test(`${p}: no other tracker or external script`, () => {
    const t = page(p).replace(SNIPPET, "");
    const srcs = [...t.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const s of srcs) assert.ok(!/^(https?:)?\/\//.test(s), `external script ${s}`);
    assert.ok(!/gtag|dataLayer|fbq\(|hotjar|clarity|segment|plausible|matomo|cloudflareinsights|doubleclick/i.test(t.replace(/<!--[\s\S]*?-->/g, "")), "other tracker code");
    assert.ok(!/<(iframe|img|link)\b[^>]*(src|href)=["']https?:\/\/(?!jubilab\.io)[^"']*(google|facebook|doubleclick)/i.test(t));
  });
}

test("no other third-party script tag exists in the repo HTML (Cloudflare beacon is injected at the edge, not committed)", () => {
  for (const p of PAGES) {
    const t = page(p).replace(SNIPPET, "");
    assert.ok(!/cloudflareinsights|beacon\.min\.js|data-cf-beacon/i.test(t), `${p} contains a Cloudflare beacon`);
    assert.ok(!/<script\b[^>]*\bsrc\s*=\s*["'](https?:)?\/\//i.test(t), `${p} has a third-party script`);
  }
});

test("the early-access form posts to our own origin, not Google", () => {
  assert.match(page("index.html"), /<form[^>]*action="\/api\/early-access"/);
});
