// Pins the search-facing copy: title and description limits, hero lede = JSON-LD description, FAQPage = visible FAQ text.
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

test("FAQPage JSON-LD matches the visible questions and answers exactly, and is in the raw HTML", () => {
  const faq = ld.find((n) => n["@type"] === "FAQPage");
  const vis = [...html.matchAll(/<summary><h3>(.*?)<\/h3><\/summary><p>(.*?)<\/p>/gs)].map((m) => [txt(m[1]), txt(m[2])]);
  assert.ok(vis.length >= 5 && vis.length <= 7);
  assert.equal(vis.length, 7);
  assert.deepEqual(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), vis);
});

test("Organization, WebSite and FAQPage nodes exist; no SoftwareApplication (unreleased), sameAs, offers or ratings", () => {
  assert.deepEqual(ld.map((n) => n["@type"]).sort(), ["FAQPage", "Organization", "WebSite"]);
  assert.ok(!JSON.stringify(ld).match(/sameAs|aggregateRating|"offers"/));
});
