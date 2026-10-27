// Pins the search-facing copy: title and description limits, no FAQPage.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const txt = (s) => s.replace(/<[^>]+>/g, "").replace(/&rsquo;/g, "’").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];

test("title <= 65 characters and description 150-160, same in Open Graph and Twitter tags", () => {
  const title = html.match(/<title>(.*?)<\/title>/)[1];
  const desc = html.match(/<meta name="description" content="(.*?)">/)[1];
  assert.ok(title.length <= 65, title.length);
  assert.ok(desc.length >= 150 && desc.length <= 160, desc.length);
  for (const k of ["og:title", "twitter:title"]) assert.equal(html.match(new RegExp(`"${k}" content="(.*?)"`))[1], title);
  for (const k of ["og:description", "twitter:description"]) assert.equal(html.match(new RegExp(`"${k}" content="(.*?)"`))[1], desc);
});

test("no FAQPage JSON-LD and no FAQ markup (the Questions section was removed)", () => {
  assert.ok(!ld.some((n) => n["@type"] === "FAQPage"));
  assert.ok(!/<summary><h3>|id="faq"/.test(html));
});

test("Organization and WebSite nodes exist; no SoftwareApplication (unreleased), sameAs, offers or ratings", () => {
  assert.deepEqual(ld.map((n) => n["@type"]).sort(), ["Organization", "WebSite"]);
  assert.ok(!JSON.stringify(ld).match(/sameAs|aggregateRating|"offers"/));
});
