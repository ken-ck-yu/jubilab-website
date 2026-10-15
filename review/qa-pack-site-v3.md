# QA pack: website branch site-v3 (QA-2)

## 1. Item, commit, method, date
- Item: `site-v3` of ken-ck-yu/jubilab-website. Fixes QA-1's D-A (silent / opaque post-submit failures, Origin null), D-B (`/?error=` dead because Worker never saw `/`).
- Commit tested: **7b4e6ec** ("Route home page through the Worker, ..."). `origin/site-v3` and local `site-v3` were both 7b4e6ec (verified after `git fetch`). Fresh worktree `/home/ken/biligene/jubilab-website-qa2`, branch `qa2-site-v3` from `origin/site-v3`. 2026-10-15. Node v24.22.0.
- Product source untouched. Added under `review/` only: `smoke-site.py`, `hostile-worker.mjs`, `dev-worker-server.mjs`, this pack. Scratch outputs: `/tmp/claude-1000/-home-ken-biligene-Jubilab/a8f56e91-e75e-4ea7-b458-92d16cd6103a/scratchpad/qa2/` (`hostile.txt`, `check.txt`, `smoke-prod-oldbuild.txt`).
- **Deployed routing is NOT verified.** wrangler is not installed (not installed by me). Everything below ran against the code, a Node harness that calls the real `src/worker.js`, and a local server that mimics `run_worker_first` from the real `wrangler.jsonc`. Real Cloudflare pattern matching (does `"/"` match only `/`? does it match `//`?) is unverified.

## 2. Criteria table
| Criterion | Check | Command | Result | Pass |
|---|---|---|---|---|
| D-B: `/?error=<code>` shows message server-side | `wrangler.jsonc` test + Worker test through `worker.fetch` with mock ASSETS | `node --test tests/worker.test.mjs` | message visible, no `hidden`, `no-store`, etag dropped; `/?error=bogus` unchanged; config test asserts exactly `/api/*`, `/`, `/index.html` and that `/thanks/ /privacy/ /terms/ /style.css` are NOT listed | PASS (code level) |
| D-B at deploy | smoke script against preview URL | see section 6 | not run | OPEN |
| D-A Origin null 403 fixed | unit test "Origin null: allowed and stored only with Sec-Fetch-Site same-origin"; my harness 12 variants | `node review/hostile-worker.mjs` | null+same-origin 303 stored; null+cross-site/same-site/none/absent 403; `NULL` 403; `jubilab.io.evil.com` 403; `http://jubilab.io` 403; empty Origin allowed; same Origin allowed even with cross-site fetch metadata (fine, Origin equal) | PASS |
| D-A silent paths logged | unit test "silent-failure log lines" + harness | same | honeypot warn (field name, length only), duplicate warn, origin rejected warn (origin value, cut at 200 chars), binding-missing error. Scan of all captured logs for the test emails: 0 hits | PASS |
| Honeypot renamed, old `website` ignored | unit tests (new name filled, cached old page) + harness | same | `q7_note=<anything non-empty, even one space>` -> 303 /thanks/, stored 0, warn; `website=...` filled -> stored normally; `q7_note=` empty stored | PASS |
| Friendly plain-text errors | unit test + smoke | same | 403/413/415/400/503 all return the one sentence, `text/plain; charset=utf-8` | PASS |
| Honeypot markup autofill-hostile | smoke script reads HTML | `smoke-site.py` | `q7_note` with tabindex -1, autocomplete off, data-lpignore, data-1p-ignore, data-bwignore; no input named `website` | PASS |

## 3. Suites run (clean worktree)
| Suite | Command | Result |
|---|---|---|
| Unit | `PATH=$HOME/.local/node/bin:$PATH node --test tests/early-access.test.mjs tests/worker.test.mjs` | 37 pass, 0 fail, 0.08 s (33 + 4 existing worker tests; the directory form `node --test tests/` still not used, see README note from QA-1) |
| Site acceptance | `python3 -m http.server 18141 --bind 127.0.0.1`, then `LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs /tmp/engsite/venv/bin/python review/check-site.py http://127.0.0.1:18141/` | 45 PASS, 0 FAIL, 1 N/A (N10 video), exit 0 |
| Mutation check of the new tests (15 deliberate source/config regressions in a scratch copy) | see below | baseline 0 fail; every mutant below made at least one test fail except one equivalent mutant |
| Smoke vs local Worker stand-in | `node review/dev-worker-server.mjs 18142` + `python3 review/smoke-site.py http://127.0.0.1:18142` | 18 PASS, 0 FAIL, 1 SKIP (http->https, local), 1 WARN (no security headers), 2 INFO; exit 0; server log shows NO `PUT` (nothing stored) |
| Smoke `--static` vs python static server | `smoke-site.py http://127.0.0.1:18141 --static` | worker checks SKIP with reason; see note on cache header fixed in script |
| Smoke with `--browser` (Chromium, JS off) | `... http://127.0.0.1:18142 --browser` | `/?error=email` visible=True, `/?error=bogus` visible=False; 20 PASS, 0 FAIL |
| Smoke against PRODUCTION (old build, read-only, one bad-email POST, one Origin-null POST) | `python3 review/smoke-site.py https://jubilab.io` | 13 PASS, **5 FAIL as expected for the old build**: no `q7_note`, old `website` input present, `/?error=email` hidden and cached (`cf-cache-status: HIT`), Origin null 403 body is bare "Forbidden". Proves the script detects the QA-1 defects. exit 1 |

Mutants (each applied to a scratch copy, tests 37): drop `/` from run_worker_first -> config test fails; drop `/index.html` -> fails; accept Origin null always -> fails; reject null always -> fails; null with any Sec-Fetch-Site -> fails; honeypot back to `website` -> 2 fail; remove honeypot warn / duplicate warn / origin warn / binding-missing error -> the log test fails each; 403 body back to "Forbidden" -> fails; remove no-store -> 2 fail; message not visible -> 4 fail; MAX_BODY 8192->9999 -> chunked test fails. **Survivor:** replacing `Object.hasOwn(MESSAGES, code)` with `code in MESSAGES` in `serveAsset` passes all tests; harmless because `withError` has its own own-property guard (only effect: `?error=toString` would get `no-store`). Equivalent in practice, noted only.

## 4. Break-it checks (harness `review/hostile-worker.mjs`, output in scratchpad `hostile.txt`)
- Header injection: CRLF in role-other, field-other, runs-on-other, tracking and email. Free-text CRLF is flattened to a space in the stored record and in the email headers (header block 8 lines, no `Bcc:` header); tracking keeps `\n` in the body only (by design, email body). Email address with CRLF or NUL: rejected, `/?error=email#access`, nothing stored. `__proto__` / `constructor` as extra form fields: ignored.
- Duplicates: `Dup@Lab.ORG`, same, lower-case, space-padded: first stored, next three 303 /thanks/ with a warn, stored 0, one email only (7 emails for 7 distinct stored records).
- 8 KB: with Content-Length 8191 and 8192 bytes: 303 stored; 8193: 413. Chunked (no Content-Length, 1000-byte chunks) 8191 and 8192: 303; 8193: 413.
- Types: text/plain 415, json 415, malformed multipart 400, missing WAITLIST binding 503 with an error log and nothing stored.
- `?error=`: `email` visible+no-store; `EMAIL`, `__proto__`, `constructor`, `toString`, `hasOwnProperty`, empty, bare `?error`, `<script>` payload: all unchanged (box hidden, normal cache header, nothing reflected). Repeated: `error=email&error=bogus` shows email (first wins, like `searchParams.get`), `bogus&email` unchanged. `/index.html?error=role` and `role-other` visible. `//` and `//?error=email` unchanged (hidden box, not rewritten).
- HEAD `/` and HEAD `/?error=email`: 200, empty body, normal cache header (HEAD is not rewritten; harmless). OPTIONS `/` 200 page. `/api/early-access` GET, HEAD, OPTIONS, PUT: 405 `Allow: POST`.
- Config: `/thanks/ /privacy/ /terms/ /style.css` are not in `run_worker_first` (test asserts it) and in my stand-in they bypass the Worker.
- Nothing crashed. Nothing mis-stored. No personal data in logs (the origin warn logs the attacker-supplied Origin string, truncated to 200 chars; that is not personal data, but it is attacker-controlled log content).

## 5. Defects and findings (ranked)
No blocking defect in the code. D-A, D-B (code level) FIXED and re-checked; the regression tests are strong (mutants above).
1. **OPEN, not a defect but unproven: deployed routing.** Whether Cloudflare's `run_worker_first: ["/api/*", "/", "/index.html"]` really routes only `/` and `/index.html` (not `/thanks/`) and passes `?error=` queries to the Worker cannot be checked here. If wrong, `smoke-site.py` fails the two `/?error=email` checks.
2. (low) Stale comment `src/worker.js` line 1: "only /api/* reaches this code". Now untrue; fix when convenient.
3. (low) Honeypot trip, duplicate and bad-Origin remain indistinguishable to the visitor (by design, now logged). A real person whose autofill still fills `q7_note` gets a fake thank-you; the warn log is the only trace. Watch `wrangler tail` / observability for "honeypot tripped" after launch.
4. (low) Residual from QA-1 D-C: plain HTTP served 200, no redirect (smoke reports it). Security headers (CSP, nosniff, Referrer-Policy, ...) absent everywhere; smoke reports as WARN (use `--strict-headers` to fail). Referrer-Policy decision still open; with Sec-Fetch-Site handling, adding `Referrer-Policy: no-referrer` would now be safe for the form.
5. (info) `Origin: null` with `Sec-Fetch-Site: same-origin` is accepted. Older browsers that send neither header on a no-referrer same-origin POST still get the friendly 403 sentence. Acceptable trade.

## 6. Highest-risk checks the Manager should re-run first
1. Unit and mutation sanity: `export PATH=$HOME/.local/node/bin:$PATH; cd /home/ken/biligene/jubilab-website-qa2 && node --test tests/early-access.test.mjs tests/worker.test.mjs` (expect 37 pass), then `node review/hostile-worker.mjs | less` (expect every Origin row as in section 4).
2. **Deployed routing, once the preview URL is known** (read-only, creates no records):
   `cd /home/ken/biligene/jubilab-website-qa2 && python3 review/smoke-site.py <preview-url>` expect 0 FAIL (WARN for headers, INFO for robots and http redirect are fine) and no SKIP except `http -> https` if the URL is not https. Add the browser view: `LD_LIBRARY_PATH=/home/ken/biligene/.browser-libs /tmp/engsite/venv/bin/python review/smoke-site.py <preview-url> --browser`.
   Same after merge to main, against `https://jubilab.io` (needs the new build live; today it is the old build and gives 5 FAIL).
   If the preview serves pages but the Worker behind a different URL: `smoke-site.py <pages-url> --worker-url <wrangler-dev-url>`.
3. Local Worker integration if wrangler becomes available: `npx wrangler dev --port 18144` then `python3 review/smoke-site.py http://127.0.0.1:18144`.
Remember: previews use the separate preview KV; the script never posts a valid signup, so nothing needs deleting.

## 7. Not tested / could not see
- Deployed routing, preview and production behaviour of the new build; Cloudflare logs ("honeypot tripped" lines); `wrangler dev` (not installed).
- Whether the owner's autofill still reaches `q7_note`; real browsers other than headless Chromium; a real no-referrer form POST against the new build (the Origin-null fix is proven at function level with the header, and `review/live-form-qa.py noreferrer` was not re-run since it would create a live record).
- KV and inbox contents; email delivery. HTTP redirect behaviour on preview.
- Smoke script `--browser` against a real preview not run.

## 8. Verdict
**READY FOR MANAGER**, with the deployed-routing check still OPEN (section 6, item 2). Code, tests and the mutation check give no reason to hold the branch. Do not close D-B until the smoke script is green against the preview URL.

## 9. Test plan for website changes (update to QA-1 section 12; criterion -> check -> how run)
| Criterion | Check | How run |
|---|---|---|
| Unit: validation, honeypot, Origin, size, logs, messages, config patterns | 37 tests | `node --test tests/early-access.test.mjs tests/worker.test.mjs` (list both files; directory form breaks on node 24) |
| Routing matches code's assumptions (closes QA-1's NEW row) | `review/smoke-site.py` against preview, then production; local stand-in `review/dev-worker-server.mjs` for a Worker-in-the-loop run | commands in section 6; `--static` only for plain static servers |
| Layout, theme, no-JS parity | `review/check-site.py` | as before, 45 PASS 1 N/A |
| Hostile inputs on the Worker | `review/hostile-worker.mjs` | `node review/hostile-worker.mjs`, read the Origin and 8 KB rows |
| Real browser signup end to end | `live-form-qa.py` with unique `claude-qa-N@example.org` on preview only; max 6 | after smoke is green; list records created |
| No-referrer submit now succeeds | `live-form-qa.py noreferrer` on preview, expect /thanks/ | after deploy, preview KV |
| Silent paths observable | Cloudflare observability: search "honeypot tripped", "duplicate signup ignored", "origin rejected" after the preview signup tests | Manager or owner, read-only |
| Cache safety of error page | smoke checks `no-store` on `/?error=email` and normal cache on `/` | smoke script |
| Regression guard | Any change to `wrangler.jsonc` assets patterns must keep the config test and smoke green | CI/Manager |

## 10. Board updates
- Add: "QA-2: site-v3 7b4e6ec READY FOR MANAGER, deployed routing OPEN (needs preview URL, run smoke-site.py)".
- D-A: fixed in code, re-checked, mutation-verified. D-B: fixed in code; deploy verification open. D-C: still open (no http->https redirect, no security headers).
- New low issue: stale comment in `src/worker.js` line 1.
- Port block 18140-18149: used 18141, 18142, 18143 (all released).

## 11. What other agents need to know
- Website engineer: nothing blocking; fix the stale comment; consider a `_headers`/Worker header set and an http redirect decision. Do not rename the honeypot again without updating `smoke-site.py` (it asserts `q7_note`).
- Manager: `smoke-site.py` is read-only and safe on production; `--static` hides Worker checks, so never use it as deploy evidence. Run the preview deploy before merging if you want D-B closed with evidence.
- No records were created anywhere. Only two probe POSTs were sent to jubilab.io (bad email, Origin null), both rejected before storage.
