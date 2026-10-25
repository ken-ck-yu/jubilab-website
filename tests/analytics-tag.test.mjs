// Google Analytics runs only after consent (Basic consent mode). The HTML carries only the consent default block;
// assets/consent.js loads Google after Accept. Nothing else external.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;
const PAGES = ["index.html", "privacy/index.html", "terms/index.html", "thanks/index.html", "404.html"];
const DEFAULT = `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'})</script>
`;
const page = (p) => readFileSync(REPO + p, "utf8");
const js = readFileSync(REPO + "assets/consent.js", "utf8");

for (const p of PAGES) {
  test(`${p}: consent default block comes first in head, once`, () => {
    const t = page(p);
    assert.ok(t.includes("<head>\n" + DEFAULT + "<meta charset"), "default block must follow <head> directly");
    assert.equal(t.split(DEFAULT).length - 1, 1);
    assert.equal((t.match(/gtag\(/g) || []).length, 2, "HTML has only the gtag definition and the consent default call");
  });

  test(`${p}: no Google URL or measurement id in the HTML, no other tracker or external script`, () => {
    const t = page(p);
    assert.ok(!/googletagmanager|google-analytics|G-8W2MDQ58PL/i.test(t), "Google URL or id in HTML");
    const noComments = t.replace(/<!--[\s\S]*?-->/g, "");
    const srcs = [...noComments.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const s of srcs) assert.ok(!/^(https?:)?\/\//.test(s), `external script ${s}`);
    assert.ok(srcs.some((s) => s.endsWith("assets/consent.js")), "consent.js is included");
    assert.match(noComments, /<script src="[^"]*assets\/consent\.js" defer><\/script>/);
    assert.ok(!/fbq\(|hotjar|clarity(?! LIMS)|segment|plausible|matomo|cloudflareinsights|doubleclick/i.test(noComments), "other tracker code");
    assert.ok(!/<(iframe|img|link)\b[^>]*(src|href)=["']https?:\/\/(?!jubilab\.io)[^"']*(google|facebook|doubleclick)/i.test(noComments));
  });
}

test("no Cloudflare beacon is committed (it is injected at the edge)", () => {
  for (const p of PAGES) assert.ok(!/cloudflareinsights|beacon\.min\.js|data-cf-beacon/i.test(page(p)), `${p} contains a Cloudflare beacon`);
});

test("consent.js: loads Google dynamically with the exact id and config call, only through load()", () => {
  assert.match(js, /ID="G-8W2MDQ58PL"/);
  assert.equal(js.split("G-8W2MDQ58PL").length - 1, 1);
  assert.match(js, /createElement\("script"\)/);
  assert.match(js, /s\.async=1/);
  assert.match(js, /s\.src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id="\+ID/);
  assert.match(js, /gtag\("js",new Date\(\)\);gtag\("config",ID\)/);
  assert.equal(js.split("googletagmanager.com").length - 1, 1);
});

test("consent.js: stored choice, 180 day expiry, accept grants analytics only, ad signals never granted", () => {
  assert.match(js, /K="jubilab-consent"/);
  assert.match(js, /15552e6/); // 180 days in ms
  assert.equal(180 * 24 * 3600 * 1000, 15552e6);
  assert.match(js, /"granted"/);
  assert.match(js, /"denied"/);
  assert.ok(!/ad_storage|ad_user_data|ad_personalization/.test(js), "ad signals stay at the denied default");
  assert.equal((js.match(/try\{/g) || []).length >= 2, true, "storage access is wrapped in try/catch");
});

test("consent.js: approved banner wording and button names", () => {
  for (const s of ["Cookies on jubilab.io", "We use analytics cookies to understand how our site is used and to improve it. They are only set if you accept. We also run cookieless analytics. See our <a href=/privacy/>Privacy Policy</a>.", "<button>Accept analytics cookies</button><button>Reject analytics cookies</button>"]) assert.ok(js.includes(s), s);
});

test("consent.js: withdraw path denies, deletes _ga cookies and tells the visitor to reload", () => {
  assert.match(js, /up\("denied"\)/);
  assert.match(js, /indexOf\("_ga"\)/);
  assert.match(js, /max-age=0/);
  assert.match(js, /Reload the page to stop Google's script/);
  assert.match(js, /Cookie settings/);
});

test("consent.js: LOAD_GOOGLE_BEFORE_CONSENT === false (Basic mode)", () => {
  assert.match(js, /var LOAD_GOOGLE_BEFORE_CONSENT=false,/);
  assert.match(js, /if\(LOAD_GOOGLE_BEFORE_CONSENT\)load\(\)/);
});

test("own JavaScript stays within the 8000 byte budget (check 34)", () => {
  const total = ["theme.js", "consent.js"].reduce((n, f) => n + readFileSync(REPO + "assets/" + f).length, 0);
  assert.ok(total <= 8000, `own JS ${total} B`);
});

test("the early-access form posts to our own origin, not Google", () => {
  assert.match(page("index.html"), /<form[^>]*action="\/api\/early-access"/);
});
