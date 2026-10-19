// Legal-review wording: these words stay out of marketing pages (home, llms.txt, guides, thanks, 404). privacy/ and terms/ are exempt.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const REPO = new URL("..", import.meta.url).pathname;
const BANNED = /audit trail|audit log|\baudit|regulated|regulatory|compliance|compliant|\bgxp\b|validated|\bfda\b|\bgdpr\b/i;
const files = ["index.html", "llms.txt", "404.html", "thanks/index.html", "guides/index.html",
  ...readdirSync(REPO + "guides", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `guides/${d.name}/index.html`)];

for (const f of files) {
  test(`${f}: no banned legal-review wording (visible text, meta or JSON-LD)`, () => {
    const m = readFileSync(REPO + f, "utf8").match(BANNED);
    assert.equal(m, null, `found "${m?.[0]}"`);
  });
}
