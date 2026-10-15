# QA pack: live early-access form (owner report 2026-10-15)

## 1. Item, commit, method, date
- Item: owner submitted the form on https://jubilab.io from their own browser; nothing in live KV, no email. Manager's curl POST worked end to end.
- Commit tested: `4b770d8` (branch `qa-website` = website `main`). The live HTML is byte-identical to `index.html` at that commit (`curl -s https://jubilab.io/ | diff - index.html` is empty), so the live site is that build.
- Method: read the source, then drove REAL Chromium 156 (Playwright, headless) against the live site as a person would (click, type, check boxes), recording the network exchange. Unit tests and check-site run from this clean worktree. Date 2026-10-15, about 19:10 to 19:30 local.
- Scripts: `review/live-form-qa.py` (scenarios inspect, typed, other, dup, honeypot, noreferrer), `review/live-error-page.py` (read-only). Raw outputs: `/tmp/claude-1000/-home-ken-biligene-Jubilab/a8f56e91-e75e-4ea7-b458-92d16cd6103a/scratchpad/qa/*.json`.

## 2. Hypotheses vs evidence (the criteria for this investigation)
| Hypothesis | Check | Result | Verdict |
|---|---|---|---|
| H3 browser path differs from curl (Chromium) | `live-form-qa.py typed` and `other` on live | Typed run: POST `/api/early-access`, `content-type: application/x-www-form-urlencoded`, `origin: https://jubilab.io`, `referer: https://jubilab.io/`, body `email=claude-qa-1%40example.org&website=&role=postdoc-scientist&role-other=&field=genetics-genomics&field-other=&runs-on=windows&runs-on=linux&runs-on=hpc-cluster&runs-on-other=&human-data=no&tracking=...` -> **303, Location https://jubilab.io/thanks/** -> 200, page "Thank you / Thanks, we have your request...". Other run (role, field and runs-on all Other, each text box typed): same 303 and thank-you, body carries `role-other`, `field-other`, `runs-on-other`. Other text boxes are hidden on load and appear when Other is ticked (JS works). Multi-select runs-on sent as three repeated `runs-on` pairs. | Killed for desktop Chromium with default settings. Note: I cannot see KV, so "303 + thank-you" proves the Worker accepted it only up to the point the code distinguishes (see H1). |
| H3b Origin header becomes `null` (privacy setting, extension, or Referrer-Policy no-referrer) | `live-form-qa.py noreferrer`: injected `<meta name=referrer content=no-referrer>` then submitted | Chromium sent `origin: null`; Worker returned **403 plain text "Forbidden"** (`text/plain`), browser left on `https://jubilab.io/api/early-access` showing the single word Forbidden. Nothing stored, no email. Cause: `src/early-access.js` rejects any Origin header that is present and `!== url.origin`, and `null` is present. Fetch spec: a no-referrer policy turns a same-origin form POST's Origin into `null`. Reproduced twice (qa-4 first run, qa-6). | **New, reproduced mechanism.** Whether the owner's browser does this is UNKNOWN. It would show a blank-ish "Forbidden" page, not the thank-you page. Ask the owner what page they saw. |
| H1 honeypot filled by autofill / password manager | `inspect`, then `honeypot` (programmatic fill) | Field: `<input type="text" name="website" tabindex="-1" autocomplete="off">` inside `.hp` (`position:absolute; left:-10000px`, display block, visibility visible, NOT display:none), label text "Leave this field empty", ancestor `aria-hidden="true"`. Because it is only offscreen and named `website` with type text, extension autofill and some browser autofill heuristics can reach it; `autocomplete="off"` is routinely ignored by password managers. Filled with `https://example.org` and submitted for claude-qa-3: **303 to /thanks/ then identical thank-you page**, byte-for-byte indistinguishable from success to the visitor (and the Worker logs nothing). | Mechanism confirmed (a filled honeypot gives a fake success). Whether the owner's browser filled it is UNKNOWN and NOT reproducible in Playwright (no autofill, no extensions, no saved profile). Still the best fit to "saw the thank-you, nothing stored". |
| H2 duplicate address | `dup`: claude-qa-1 submitted a second time | Second submission: 303 then the same thank-you page, indistinguishable from the first. By code (`early-access.js` get-before-put), the first record is kept, no second email. | Mechanism confirmed. Fits the report only if the owner's address was already stored (for example an earlier owner or Manager test with that address). Check KV. |
| H4 attempt before production build finished | Compared live HTML with repo | Live equals `4b770d8` now. Cannot see build times or Worker logs. | Unknown, low prior: before the build the page would not have had a working form endpoint (404/405), not a silent success. |
| H5 owner looked in the wrong namespace | Read `wrangler.jsonc` | Production binding `WAITLIST` has **no id** (auto-provisioned on first deploy); the `previews` block pins a separate id `3c3f5f8288ff4897af5863ea59e15bc2`. So there are at least two namespaces: easy to open the preview one (where the earlier successful tests were) and see the live signup missing, or the other way round. Manager's curl worked on live, so live KV does receive writes. | Likely contributor, unproven. Owner must open the namespace shown under Workers > jubilab-website > Bindings > WAITLIST. |

## 3. Suites run
| Suite | Command | Result |
|---|---|---|
| Unit tests | `PATH=$HOME/.local/node/bin:$PATH node --test tests/early-access.test.mjs` | 27 pass, 0 fail, 0.26 s. (Note: `node --test tests/` with the directory form fails in node 24, "test failed" with 0 tests; use the file path. The README says `node --test tests/`; minor doc issue.) |
| Site acceptance | `python3 -m http.server 18141 --bind 127.0.0.1` then `LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs /tmp/engsite/venv/bin/python review/check-site.py http://127.0.0.1:18141/` | 45 PASS, 0 FAIL, 1 N/A (N10 video), exit 0, under 2 minutes. It never submits the form, so it cannot catch anything in this report. |
| Live probes | `live-form-qa.py inspect|typed|other|dup|honeypot|noreferrer`, `live-error-page.py` | See section 2 and 5. No flakes seen (each ran once). |

## 4. Break-it checks tried
- Honeypot filled (above): fake success.
- Duplicate address (above): same page.
- Origin null (above): 403 Forbidden, plain text.
- Not done on live by instruction: fuzz, load, malformed bodies, wrong content types. The Manager's earlier fuzz ran against a local mock.
- `GET /api/early-access` -> 405 `Allow: POST` (as designed). `http://jubilab.io/` answers 200 over plain HTTP with no redirect to HTTPS. `www.jubilab.io` does not resolve (curl exit 6).

## 5. Defects and findings (ranked)
1. **D-A (medium, probable owner-visible cause family): silent or opaque failures after submit.** Three different failure modes look like success or like nothing: (a) honeypot filled -> fake thank-you, nothing stored; (b) duplicate address -> thank-you, nothing new, no email; (c) Origin not equal -> plain-text "Forbidden" page with no way back. Nothing is logged by the Worker in (a) or (b), so even Cloudflare observability cannot tell the owner what happened. New. Suggested engineer actions (QA does not fix): `console.log` a one-line reason for honeypot hit, duplicate and 403 (no address); make the honeypot less autofill-reachable (for example a name such as `contact-url-hp`, `autocomplete="off"` plus `data-lpignore="true"` `data-1p-ignore`, or a time-trap instead of a field); treat Origin `null` as acceptable when Sec-Fetch-Site is `same-origin` (or rely on Sec-Fetch-Site), and return a friendly page for 403.
2. **D-B (low-medium): `/?error=<code>` server-side message does not work live.** `wrangler.jsonc` has `run_worker_first: ["/api/*"]`, so the Worker (and `serveAsset`/`withError` in `src/messages.js`) never sees `/`. Live evidence: `curl https://jubilab.io/?error=email` returns the box still `hidden`, served from cache (`cf-cache-status: HIT`, `cache-control: public, max-age=0, must-revalidate`, no `no-store`). With JavaScript on, the message shows (Chromium: visible for `email` and `role-other`, not for unknown `bogus`). With JavaScript OFF no message is visible on any code (live-error-page.py: all `visible=False`). The unit test for D1 (`serveAsset rewrites...`) passes because it calls the function directly, so it proves nothing about deployment. New, not caused by the owner's report but same area (validation errors shown to visitors).
3. **D-C (low):** plain HTTP is served with 200 (no HTTPS redirect) on the site that collects emails; the Worker's Origin check still passes because `url.origin` follows the visitor's scheme. Docs: README says `node --test tests/` which fails on node 24.
4. **Observed, no action:** headers on pages carry no security headers (no CSP, X-Frame-Options, Referrer-Policy). Adding `Referrer-Policy` at the site would interact with D-A (Origin null) so pick one deliberately.

## 6. Root cause conclusion (graded)
- **Confirmed:** the live form, endpoint, redirect, thank-you page and (per the Manager's curl) the KV write and email work for a normal Chromium submission. The Worker returns an identical 303 and thank-you page for success, filled honeypot and duplicate address. So the thank-you page proves nothing about storage.
- **Likely (cannot be proven from here):** the owner's submission hit one of three silent paths: honeypot filled by autofill or password manager (H1), address already on the list (H2), or they read a different KV namespace than the live Worker's (H5). A fourth path, Origin `null` -> "Forbidden" (H3b), is reproduced mechanically but would show a Forbidden page, so it fits only if the owner did not notice or did not mention it.
- **Unknown:** which of H1, H2, H3b, H5 actually happened, the owner's browser and extensions, the address used, and timing (H4).
- Cannot rank H1 over H2/H5 without the owner's evidence below. If the owner did see the thank-you page and the address is new, H1 is the leading explanation by elimination.

## 7. Highest-risk checks the Manager should re-run first
1. Honeypot field reachability (read-only, no submission; the fake-success result is in the saved honeypot.json vs typed.json, re-running it would need claude-qa-5):
   `cd /home/ken/biligene/jubilab-website-qa && LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs /tmp/engsite/venv/bin/python review/live-form-qa.py inspect` (field attributes, no submission) and read `honeypot.json`/`typed.json` in the scratchpad `qa/` folder.
2. Error page claim (read-only, no submission): `LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs /tmp/engsite/venv/bin/python review/live-error-page.py` expects `js=False ... visible=False` for every code, and `curl -s 'https://jubilab.io/?error=email' | grep -n 'form-error'` shows `hidden`.
3. Origin null reproduction without touching the live site: `export PATH=$HOME/.local/node/bin:$PATH; node -e 'import("./src/early-access.js").then(async m=>{const r=await m.onRequestPost({request:new Request("https://jubilab.io/api/early-access",{method:"POST",headers:{origin:"null","content-type":"application/x-www-form-urlencoded"},body:"email=a%40lab.org"}),env:{},ctx:null,notify:null});console.log(r.status)})'` expects 403.

## 8. Not tested / could not see
- The owner's KV (neither namespace) and inbox. I cannot confirm that any of my test records were stored or that emails for them were sent; I only know the Worker answered 303 and the thank-you page loaded.
- Real autofill, password managers and extensions, Firefox, Safari, mobile browsers, Brave or privacy modes. Playwright does NOT reproduce autofill; the programmatic fill only shows what the server does with a filled field.
- Cloudflare Worker logs and build history (no access); email deliverability and spam folder.
- HTTP-origin submission (`http://jubilab.io`) was not submitted (budget); by code it should work.
- Narrow widths and dark theme of the form on live (check-site covers layout locally, not the live submission).

## 9. What I need from the owner (exact evidence)
1. Which exact address did you type, and what did the browser show right after you pressed the button: the "Thank you" page, a page with only the word "Forbidden", the form again with a red message, or something else? Which browser, version, and any password manager or privacy extension?
2. In Cloudflare, open Workers > jubilab-website > Bindings > WAITLIST and open THAT namespace (not `3c3f5f82...`, which is the preview one). Is there a key `email:<your address in lower case>`? If yes, its `received_at` value tells us whether it was created before or after your report, which settles H2.
3. In that same namespace, are there keys `email:claude-qa-1@example.org` and `email:claude-qa-2@example.org`? (Expected present if the Worker stored them.) And `email:claude-qa-3@example.org` should be ABSENT (honeypot); `claude-qa-4`, `-5`, `-6` should be absent (4 and 6 got 403; 5 unused).
4. Inbox for ken.ckyu@billybiotech.com (and spam): notification emails for claude-qa-1 and claude-qa-2 should exist (two emails, not three: the duplicate sends none, the honeypot sends none).
5. Retry from your browser in a private window with extensions off, with a new address. Optionally in DevTools Network tab: click the POST to `/api/early-access` and read the `website=` value in the payload and the `Origin` request header. `website=` non-empty means H1 is confirmed; `Origin: null` means H3b.

## 10. Live records and requests created (owner may delete keys)
Six live POSTs in total, no more.
| # | Address | Scenario | Expected result |
|---|---|---|---|
| 1 | claude-qa-1@example.org | typed, runs-on windows+linux+hpc-cluster | 303, record stored, email sent (unverified by me) |
| 2 | claude-qa-2@example.org | all three Other options with text | 303, record stored, email sent (unverified) |
| 3 | claude-qa-1@example.org | duplicate | 303, nothing new stored |
| 4 | claude-qa-3@example.org | honeypot `website=https://example.org` | 303, NOT stored |
| 5 | claude-qa-4@example.org | no-referrer, first run | 403 Forbidden, NOT stored |
| 6 | claude-qa-6@example.org | no-referrer, second run (to capture the page text) | 403, NOT stored |
Keys to delete if present: `email:claude-qa-1@example.org`, `email:claude-qa-2@example.org` (and, if the honeypot or 403 behaved differently from the code, `-3`, `-4`, `-6`). claude-qa-5 was never used. Test text in the records: "QA test, please ignore".

## 11. Verdict
**NOT READY** (as a closure of the owner's report; the root cause is not confirmed and needs the owner's evidence in section 9). The site works for a normal Chromium submission, and nothing in the product source was changed. D-A and D-B are defects for the engineer. Re-pass after the owner's evidence and any fix.

## 12. Recommended test plan for website changes (criterion -> check -> how run)
| Criterion | Check | How run |
|---|---|---|
| Layout, overflow, hero, theme, motion, no-JS parity (UXD spec) | `review/check-site.py` N1..N11 and numbered checks, 7 widths, light and dark | serve repo with `python3 -m http.server <port> --bind 127.0.0.1`; `LD_LIBRARY_PATH=...browser-libs python review/check-site.py http://127.0.0.1:<port>/`. About 2 min, expect 0 FAIL. Never submits the form. |
| Form validation, honeypot, duplicate, content-type, size, Origin, UTF-8, KV record shape | Unit tests `tests/early-access.test.mjs` (27) | `node --test tests/early-access.test.mjs` |
| Message copy in `theme.js` equals `messages.js` | covered in unit tests | same command |
| Deployed routing really reaches the Worker where code assumes it does | NEW: after deploy, `curl` `/?error=email` and read-only Playwright `review/live-error-page.py`; and a `wrangler dev` or `vitest-pool-workers` integration test with the real `wrangler.jsonc` (the current unit tests call functions directly and missed D-B) | to be added |
| Real browser submission end to end (typed, multi runs-on, all Other, no JS) | `review/live-form-qa.py` scenarios, against a LOCAL `wrangler dev` with mock KV by default, against preview/live only for smoke with `claude-qa-N@example.org` and a record list | run per scenario, max 6 live submits per pass |
| Silent-failure paths are observable | NEW: each of honeypot, duplicate, 403, 413/415 leaves one log line (no address) and the 403 page is friendly | engineer adds; QA checks `wrangler tail` or Cloudflare logs |
| Origin and Referrer-Policy interplay | NEW: submit with `Referrer-Policy: no-referrer` and expect success | `live-form-qa.py noreferrer` should end on /thanks/ after the fix |
| Post-deploy smoke | GET `/`, `/thanks/`, assets 200; `GET /api/early-access` 405; one labelled test submission; owner confirms KV key and email | commands in section 7 plus one `typed` run |
| Autofill and extensions | Cannot be automated here; manual on owner browser or a real-profile Chrome with a password manager | owner or Manager one-time check, with DevTools payload |
Known test-tooling notes: `node --test tests/` fails on node 24 (use the file path); check-site.py needs the headless shell path under `~/.cache/ms-playwright`.

## 13. Board updates (Manager is the single writer of docs/BOARD.md)
- Add: "QA-1: live-form investigation done, NOT READY, waiting on owner evidence (section 9)".
- Add issues D-A (silent or opaque post-submit failures; Origin null; honeypot autofill reach), D-B (server error message dead live because `run_worker_first` is `/api/*` only), D-C (HTTP not redirected, README test command).
- QA-1 used port 18140 and 18141 (released).
- Owner action: delete test keys listed in section 10.

## 14. What other agents need to know
- Website engineer: do not change source until the Manager decides; candidate fixes are in D-A and D-B. Any change to honeypot name, Origin check or `run_worker_first` needs a test that exercises the deployed routing, not just the function.
- Manager: the thank-you page cannot be used as proof of storage. Ask the owner the questions in section 9 before choosing a fix; fixing the wrong silent path wastes a deploy.
- Nobody should run `live-form-qa.py` against live again without a new address list; the six test addresses are used up except claude-qa-5.
