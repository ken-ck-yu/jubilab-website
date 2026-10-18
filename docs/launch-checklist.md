# Launch checklist

## 0. Release workflow (simple; owner decision 2026-10-15)

- `main` is the live site. It is Cloudflare's production branch; every push to `main` is a production build. There is no staging.
- Every release is an annotated tag `vMAJOR.MINOR.PATCH` on `main` (`v2.1.0` is the first one under this workflow; earlier tags: `v1.0.0`, `v2.0.0`, `v2.0.1`). Stable versions are tags, nothing else.
- Work happens on short-lived LOCAL branches or git worktrees. Test locally, then the Manager merges to `main` (fast-forward or a merge commit) and tags. No long-lived feature branches are pushed.
- Local tests before any merge to `main`:
  1. `node --test` (Node 22.15 or newer)
  2. `python3 review/check-site.py http://127.0.0.1:PORT` (serve the files with `python3 -m http.server PORT`)
  3. `python3 review/check-seo.py http://127.0.0.1:PORT --mode preview` (until launch; `--mode launch` after the switch)
  4. `node review/dev-worker-server.mjs PORT`, then `python3 review/smoke-site.py http://127.0.0.1:PORT` (local stand-in for the Worker, covers the form)
- Release (Manager only): `git switch main && git merge --ff-only <branch>` (or `git merge --no-ff <branch>`), `git tag -a v2.1.0 -m "v2.1.0"`, then `git push origin main v2.1.0`. Cloudflare builds production from `main`.
- Post-deploy check, right after the production build finishes: `python3 review/smoke-site.py https://jubilab.io`. Then submit nothing real; the smoke script is the check.
- Rollback, either: Cloudflare dashboard > Worker > Deployments > pick the previous deployment > Roll back (fast, but `main` and the live site now differ until fixed in git); or `git revert <bad commit>` on `main` plus a new patch tag (for example `v2.1.1`), which is the durable fix.
- What is live: `git describe --tags` on `main` (prints the tag, or tag-plus-commits if `main` is ahead), `git tag -l 'v*'`, `git log --oneline origin/main -5`. The Cloudflare Deployments tab shows the deployed commit hash.
- Stale branches: `git branch --merged main` lists local branches already in `main`; delete with `git branch -d <name>` (`-D` only if you are sure the work is dropped). Remote: `git branch -r --merged origin/main`, then `git push origin --delete <name>`. Check `git worktree list` and run `git worktree remove <path>` for finished worktrees.
- Owner dashboard step, once: Worker `jubilab-website` > Settings > Build > Branch control, untick "Enable Preview Builds" (and on Settings > Domains & Routes turn off the Preview URL). With that off, no preview or `*.workers.dev` staging exists. The `previews` block in `wrangler.jsonc` and its separate preview KV namespace (the `id` under `previews.kv_namespaces`) become unused; they are left in place for now and can be removed later.

The site is live but non-indexable on purpose until the owner runs the launch switch. How releases work is in section 0; the launch steps below are done in order when the owner decides to launch. Everything is a file edit; there is no build step.

## 1. Make the site indexable (the single switch)

Until this step, every page carries `<meta name="robots" content="noindex">` and `robots.txt` disallows everything. The switch is one script, `scripts/go-public.py` (Python 3, standard library only; tested by `tests/go-public.test.mjs` on a copy of the repo).

1. Dry run (the default; prints the diff, changes nothing): `python3 scripts/go-public.py`
2. Apply: `python3 scripts/go-public.py --apply`. It removes `noindex` (and the PREVIEW comment) from `index.html`, copies `robots.launch.txt` over `robots.txt`, and rewrites `sitemap.xml` to list exactly the indexable pages with `lastmod` from the last git commit of each page. `thanks/` and `404.html` always keep `noindex`. Running it again changes nothing.
3. Legal pages: `privacy/` and `terms/` are both published (owner-approved text, no Draft notice, titles without "(draft)", still `noindex` until the switch), so `--with-legal` opens both and lists both in the sitemap. It still checks each page for a Draft notice: a legal page that carries one is SKIPPED with a WARNING (keeps `noindex`, stays out of the sitemap) and `--allow-draft` overrides that for a rehearsal only. `review/check-seo.py` warns when an indexable page says "draft" in its title or description.
4. Check the result against a local server of the changed files: `python3 review/check-seo.py http://127.0.0.1:PORT --mode launch --with-legal` (home, privacy and terms indexable and in the sitemap; thanks and 404 noindex; robots allows search and answer bots and blocks the four training bots). Before the switch, `--mode preview` must pass (all noindex, robots disallows all).
5. Check every `<link rel="canonical">` and `og:url` against the final live URLs (trailing slash matters). Check the Open Graph preview of `https://jubilab.io/` in a link-preview tool after deploy (image `assets/og/jubilab-og.png`, 1200x630, source `assets/og/og-source.html`).
6. AI-crawler policy (decided by the owner, 2026-10-16): ALLOW search and answer bots (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User) and ordinary search crawlers; BLOCK the training bots GPTBot, ClaudeBot, Google-Extended and CCBot. It is active in `robots.launch.txt` (copied over `robots.txt` by the switch; the live `robots.txt` stays `Disallow: /` until then). Robots rules are requests, not enforcement. See also the Cloudflare note below. `llms.txt` is already in the repo; it is served from the first deploy and, until the switch, covered by the robots Disallow.

Do not push or deploy from the script; those stay separate owner steps.

### SEO setup after launch (owner steps; none of this can be done from the repo)

- **Google Search Console**: add `jubilab.io` as a Domain property and verify with the DNS TXT record Google shows (Cloudflare DNS, add as a TXT record at the apex). Or, for a URL-prefix property, give us the `<meta name="google-site-verification" content="...">` tag and it goes in the `<head>` of `index.html` only. Then Sitemaps > submit `https://jubilab.io/sitemap.xml`.
- **Bing Webmaster Tools**: add the site (it can import from Search Console), verify by DNS TXT or the `msvalidate.01` meta tag the owner supplies, submit the same sitemap. Bing data also feeds some assistants' search.
- **IndexNow (optional)**: lets Bing and some other engines hear about changed URLs. It needs a key file at the site root; not set up. Not needed for a five-page site.
- **After launch, check**: URL Inspection in Search Console on `https://jubilab.io/` (should say "URL is on Google" once indexed; "Request indexing" is available); `site:jubilab.io` in Google and Bing; that `thanks/` and `404` do not appear; that the page the search engine shows as canonical is the one you expect.
- **How long**: indexing a new site usually takes from a few days to a few weeks and is not guaranteed; nothing in this repo can speed it up or promise a ranking, an indexing date or any citation by an AI assistant.
- **Cloudflare can block AI crawlers**: Cloudflare offers "Block AI bots" and AI Crawl Control (Security > Bots, and AI Crawl Control in the dashboard), and can add its own managed robots.txt content. New Cloudflare zones may have AI-crawler blocking on by default. We have NOT verified this account's setting. Before launch, open those pages and make sure the search and answer bots (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User) are allowed, and that the training bots (GPTBot, ClaudeBot, Google-Extended, CCBot) are blocked, as the owner decided on 2026-10-16 (robots.launch.txt already says so; Cloudflare blocking is a second layer that actually enforces it). Also check Security > Bots does not challenge Googlebot and Bingbot (verified bots are normally allowed).
- **Search wording (2026-10-18)**: title, description, hero lede, headings, the `#faq` section, its FAQPage JSON-LD and `llms.txt` carry the search words listed in `docs/seo-keywords.md`. The FAQPage JSON-LD must equal the visible answers (`tests/seo-content.test.mjs`, `review/check-seo.py`); change both together. The FAQ answers state what is shipped (trace, compare, evidence statuses, immutable runs, Nextflow and Snakemake import, bash wrapper, reference/annotation header capture with comparability warnings, self-hosted) and what is planned (sample linking, mismatch checks, AI-agent access, Seqera and the other integrations); update them when the product changes. Google shows FAQ rich results only for a few authoritative sites, so the markup is for machine readers; do not expect expanded snippets. Re-submit the home URL with "Request indexing" after deploy. The `http://` to `https://` redirect (SSL/TLS > Edge Certificates > Always Use HTTPS) is still an owner dashboard step.
- **Keep it true**: `index.html` JSON-LD (`Organization`, `WebSite`, `SoftwareApplication`) and `llms.txt` repeat facts from the page. When the page copy changes, change them too, and re-run `review/check-seo.py`. `operatingSystem`, `offers`, ratings, reviews and a logo are deliberately absent until true and confirmed.

## 2. Hosting and the form (Cloudflare Workers with static assets)

Cloudflare's "Create an app" flow deploys this repo as a Worker that serves the static files and handles `/api/early-access`. Config is in `wrangler.jsonc`; `.assetsignore` keeps source, docs and tests off the public site. The repository can stay private.

In the Cloudflare setup screen (connected to `ken-ck-yu/jubilab-website`):
- Project name: `jubilab-website` (must match `name` in `wrangler.jsonc`).
- Build command: leave empty.
- Deploy command: `npx wrangler deploy` (the default).
- Preview builds: disabled (section 0). Leave the preview command at its default; it is not used.
- Production branch: `main`.

Then:
1. The first deploy creates the `WAITLIST` KV namespace automatically (no id in the config) and attaches `jubilab.io` as a custom domain, because the domain is on the same Cloudflare account. If the custom domain step fails, add it in Worker > Settings > Domains & Routes.
2. Routing: `run_worker_first` in `wrangler.jsonc` is `["/api/*", "/", "/index.html"]`. The home page runs through the Worker (needed so `/?error=<code>` arrives with the message already visible and `no-store`; a test keeps those patterns in place). Everything else (`/thanks/`, `/privacy/`, `/terms/`, CSS, images, 404 page) is served statically and never runs Worker code. The home page is therefore a Worker request (counts against Worker request limits; negligible here). HTTPS is automatic for the certificate, but the redirect from `http://` to `https://` is a dashboard setting: SSL/TLS > Edge Certificates > Always Use HTTPS (owner step, not in the repo). `www.jubilab.io` has no DNS record; add one (and a redirect) in the dashboard if wanted.
   Worker logs: Worker > Observability > Logs (or `npx wrangler tail`). Lines the form writes, none with an email or any answer: `honeypot tripped` (warn), `duplicate signup ignored` (warn), `origin rejected` (warn, with the Origin header value only), `WAITLIST binding missing: signup not stored` (error, visitor got a 503), `notify failed:` (error). If a person says they signed up and nothing is in KV, search these.
   Origin `null` (no-referrer policy, some privacy extensions) is accepted only when the browser sends `Sec-Fetch-Site: same-origin`; any other foreign Origin gets a 403. Error responses (403, 413, 415, 400, 503) are plain text: "We could not send your request. Please go back and try again, or email hello@jubilab.io."
2b. HTTPS is automatic. `404.html` is served for unknown paths.
3. Submit a real test entry on the live site and check it in Storage & Databases > KV > the new namespace (key `email:<address>`, JSON value with email, role, role_other, field, field_other, runs_on, runs_on_other, human_data, tracking, received_at). To delete someone on request, delete their key. A repeat submission with the same address keeps the first record (it is not overwritten and sends no second notification); to change someone's answers, edit or delete their key by hand when they email `hello@jubilab.io`. The visitor sees the same thank-you page either way.
4. Tests: `node --test` (Node 22.15 or newer; the Worker test uses `module.registerHooks`). Local preview of the whole site and the form: `npx wrangler dev`.

The form stores only the fields below plus a UTC time (`received_at`). Missing or invalid required answers are rejected by the Worker too (redirect to `/?error=<field>#access`; the Worker serves the home page with the message already visible, so it shows with JavaScript off too; a bad comment gives `error=tracking`); nothing is stored then. It does not store IP address or user agent. If the KV binding is missing the API returns 503.

| Field name (form) | Stored as | Question | Type | Required |
|---|---|---|---|---|
| `email` | `email` | Email address | email, lower-cased | yes |
| `role` | `role` | Your role (lab-head, postdoc-scientist, grad-student, bioinformatician-analyst, core-rse, other) | one choice | yes |
| `role-other` | `role_other` | If other, please specify | text, max 100 characters | only when role is other (otherwise stored as null) |
| `field` | `field` | Your field (genetics-genomics, bioinformatics-comp-bio, molecular-cell-biology, other-life-science, other-lab-science, other) | one choice | yes |
| `field-other` | `field_other` | If other, please specify | text, max 100 characters | only when field is other (otherwise null) |
| `runs-on` | `runs_on` | Where does your analysis run? (windows, macos, linux, hpc-cluster, aws, azure, gcp, other) | any of several, at least one | yes |
| `runs-on-other` | `runs_on_other` | If other, please specify | text, max 100 characters | only when runs-on includes other (otherwise null) |
| `human-data` | `human_data` | Work involves human or patient-derived data (yes, no) | one choice | yes |
| `tracking` | `tracking` | How do you keep track of how a result was made today? | text, max 300 characters; must be valid UTF-8, control characters other than newline are removed | no (the only optional question) |
| `q7_note` | not stored | Hidden spam trap, must stay empty. Neutral name so browsers and password managers do not autofill it. If filled, the Worker answers the usual 303 to /thanks/, stores and sends nothing, and logs `honeypot tripped` (no personal data) | text | no |
| `website` (old name) | ignored | Pre-rename pages cached in a browser may still post it. It is deliberately NOT a honeypot, so an autofilled value never drops a real signup | text | no |

## 3. Signup notification email

Each signup also emails the owner (`src/notify.js`, Workers `send_email` binding `EMAIL`, sent from `signups@jubilab.io`). The recipient is `NOTIFY_TO`, defined as a plain variable in `wrangler.jsonc` (`vars.NOTIFY_TO` = `ken.ckyu@billybiotech.com`, for production and previews; that address is public in the repo, move it to a Secret if that becomes a concern). Do not also create a dashboard variable or Secret with that name.

1. The `NOTIFY_TO` address must be a verified destination address (Email Routing > Destination addresses). A routing address such as `hello@jubilab.io` is NOT accepted by the Workers send binding (Workers log: `destination address is not a verified address`). If it is not verified, notifications fail quietly; signups are still saved in KV. Separately, `hello@jubilab.io` (the footer contact) should forward to a real inbox.
2. To use a personal address instead, either change `NOTIFY_TO` in `wrangler.jsonc` (both `vars` blocks) and redeploy, or delete the `vars.NOTIFY_TO` entries and set a dashboard Secret named `NOTIFY_TO` (Worker > Settings > Variables and Secrets > Add > Secret). Use one of these, never both. The address must be a verified Email Routing destination.
3. Submit a test entry. An email "New early-access request" should arrive (check spam the first time). If `NOTIFY_TO` or the binding is missing, nothing is sent and the signup still succeeds.
4. Notification failures never block a signup; the entry is always in KV. A repeat of an address already on the list sends no second email.
5. Spam protection: there is a hidden honeypot field (`q7_note`; check Worker logs for `honeypot tripped` if signups seem missing), but no rate limit. Recommended owner step: in the Cloudflare dashboard, add a rate-limiting rule (Security > WAF > Rate limiting rules) for requests to `/api/early-access`. This is not configured by the repo.

## 4. Button label

The call-to-action label "Request early access" appears in the header, the hero, the access heading and the form button. To change it, run `grep -rn "Request early access" --include=*.html .` and edit each hit (the header text is repeated on index, privacy, terms and 404).

## 5. Contact address

`hello@jubilab.io` in the footer (all four pages) is a placeholder and the mailbox is not set up. Create it, or replace the address everywhere: `grep -rn "hello@jubilab.io" .`

## 6. Legal pages

`privacy/index.html` and `terms/index.html` are published text (no Draft notice, no "(draft)" in titles; terms approved by the owner on 2026-10-16) but keep `noindex` until the launch switch (step 1, `--with-legal`).

Open points for the owner on the terms page (moved here from HTML comments; none of them is in the public HTML):
- Governing law is Delaware, United States, following the common US startup pattern. The owner is being asked to confirm it separately; change the "Law and contact" paragraph if the company is formed elsewhere. The legal text has not been changed.
- `hello@jubilab.io` is a placeholder until the mailbox exists (section 5).
- Update the "Last updated" date (currently 15 October 2026) whenever the text changes.

Open points for the owner on the privacy page (moved here from HTML comments; none of them is in the public HTML):
- Add a postal address and legal entity name to the page once they exist.
- Consent for analytics cookies is implemented (section 7, Basic consent mode, owner decision 2026-10-15); GA data retention, Google signals, ad personalisation and data-sharing settings are the owner's decisions; see section 7. The text says Google keeps data "for a limited period set in our account" and names no number.
- `hello@jubilab.io` is a placeholder until the mailbox exists (section 5).
- Update the "Last updated" date whenever the text changes.

## 7. Analytics (Google Analytics 4 and Cloudflare Web Analytics)

What is in the code. Google Analytics 4 (measurement id `G-8W2MDQ58PL`, public by design) runs only after the visitor accepts our own cookie notice (Google Consent Mode v2, Basic mode; owner decision 2026-10-15). Every page (`index.html`, `privacy/`, `terms/`, `thanks/`, `404.html`) carries one tiny inline script straight after `<head>` that only sets up `dataLayer`, defines `gtag()` and calls `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'})`: no network request, no cookie. `assets/consent.js` (first-party, deferred) reads the stored choice (`localStorage` key `jubilab-consent`, value `granted` or `denied` plus a timestamp, expires after 180 days) and shows a small fixed bottom notice when there is none. Accept analytics cookies stores `granted`, sends `gtag('consent','update',{analytics_storage:'granted'})` (the three ad signals stay denied) and only then creates the `<script async src="https://www.googletagmanager.com/gtag/js?id=G-8W2MDQ58PL">` and runs `gtag('js',...)` and `gtag('config',...)`. Reject stores `denied` and loads nothing from Google. Banner wording (owner-approved): heading "Cookies on jubilab.io", buttons "Accept analytics cookies" and "Reject analytics cookies", link text "Privacy Policy". Until the visitor accepts, no request goes to Google and no `_ga` cookie exists; without JavaScript the notice does not appear and Google never runs. The footer link "Cookie settings" on every page reopens the notice; Reject analytics cookies there stores `denied`, sends the `denied` update, deletes the `_ga*` cookies for this host, and says "Analytics cookies are off. Reload the page to stop Google's script.". Cloudflare Web Analytics (cookieless, injected at the edge) is always on. The early-access form does not go to Google: it posts to our own Worker (`/api/early-access`). `privacy/index.html` describes all of this. To remove analytics entirely, delete the inline default block and `consent.js` from the five pages and rewrite the privacy paragraph; update `tests/analytics-tag.test.mjs`, and `review/check-site.py --strict-network` (zero external requests) covers the removed state.

Cloudflare Web Analytics (owner chose to use both). Automatic setup, no code or token in the repo: Cloudflare dashboard > Analytics & Logs > Web Analytics > add `jubilab.io` > Automatic setup. Cloudflare then injects its beacon (`static.cloudflareinsights.com/beacon.min.js`, reporting to `cloudflareinsights.com`) into HTML responses at the edge. It sets no cookies. It will not appear on the local server or on `*.workers.dev` previews of unproxied hostnames, and `review/check-site.py` check 35 passes with it absent and allows it if present. We have NOT verified that automatic injection works for a Worker-served custom domain on this account.
- Verify: view-source of the live page contains `static.cloudflareinsights.com/beacon.min.js`; the Web Analytics dashboard shows visits within a day.
- Known failure causes: a response marked `Cache-Control: no-transform`; a non-HTML response; a hostname that is not proxied (orange cloud) through Cloudflare.
- Fallback: manual setup. The dashboard gives a snippet with a token; the owner would have to give it to us and we would place it once per page on all five pages (and update `tests/analytics-tag.test.mjs`, which currently forbids any beacon in the HTML).

Verify Google after deploy. Open GA > Reports > Realtime, load the live site, click Accept analytics cookies, and confirm your visit appears. A visit that has not accepted does not appear (by design). We cannot verify collection from here, only the code.

QA traffic counts too. Visits to `*.workers.dev` (while a preview URL exists), localhost and our own testing all land in the same property unless filtered. Recommended: in GA Admin > Data collection and modification > Data streams > Configure tag settings > Define internal traffic (and a data filter), or a hostname filter, to exclude `*.workers.dev` and `localhost`.

GA admin settings to review (owner decisions):
- Data retention: Admin > Data collection and modification > Data retention. Set a period you are willing to state; the privacy text says "a limited period set in our account" and gives no number.
- Google signals: off, unless you want cross-device reporting (it enables ad-related features).
- Ad personalisation: off (Data collection > Ad personalisation, or per region).
- Enhanced measurement: turn off the events you do not need (scrolls, outbound clicks, site search, file downloads, form interactions).
- IP and geolocation: review the regional data-collection controls; GA4 does not log full IP addresses.
- Data collection: acknowledge the user-data-collection terms, and review the data-sharing settings (Google products and services, benchmarking, technical support, account specialists).

### Consent (UK/EU rules): implemented, Basic consent mode

Status: implemented (option (a) of the earlier plan: our own banner plus Google Consent Mode v2, defaults denied). This is not legal advice and we make no compliance claim; the owner handles the legal review.

- What it does: see "What is in the code" above. In Basic mode Google's script is not even requested before consent, so Google receives nothing from visitors who have not accepted (and nothing from those who decline).
- What GA will say while nobody has accepted: GA Admin > Data collection may report that consent signals / consent mode are not detected, or that no data is flowing, because in Basic mode Google sees no hit and no consent signal until a visitor accepts. That is expected, not a fault. Realtime shows only visitors who accepted. Reported numbers will therefore be lower than real traffic (Cloudflare Web Analytics, which is always on and cookieless, is the count of all visits).
- OWNER CHECK after the first release: visit the live site, click Accept analytics cookies, then wait (it can take up to a day) and open GA Admin > Data collection and modification > Data collection (consent mode status). It should report that consent mode is detected after one accepted visit. Realtime should show the visit right away. We cannot verify this from the repo.
- Switch to Advanced mode (not enabled): in `assets/consent.js` set `LOAD_GOOGLE_BEFORE_CONSENT = true` (the line `var LOAD_GOOGLE_BEFORE_CONSENT=false,...`), update `tests/analytics-tag.test.mjs` (it asserts `false`) and `review/check-site.py` check 35 (which expects zero Google requests before consent), and rewrite the privacy paragraph. Trade-off: Advanced mode loads gtag.js immediately with consent denied, so Google receives consent signals from every visitor and sends cookieless pings, which satisfies Google's consent-mode diagnostic better and allows modelling; but it sends data to Google before the visitor has chosen, which some regulators dislike. The owner chose Basic for a UK/EU researcher audience.
- Test in a browser: open the site in a private window with DevTools > Network (filter `google`) and Application > Cookies. Before any click: no request to `googletagmanager.com` or `google-analytics.com`, no `_ga` cookie, the notice at the bottom. Reject analytics cookies: still nothing; reload: no notice, still nothing. Clear site data, Accept analytics cookies: `gtag/js?id=G-8W2MDQ58PL` is requested and then `_ga` cookies appear. Footer "Cookie settings" > Reject analytics cookies: `jubilab-consent` becomes `denied`, `_ga*` cookies disappear, the message says to reload. To see the notice again: Application > Local storage > delete `jubilab-consent`, or wait 180 days.
- Automated: `tests/analytics-tag.test.mjs` (static) and `review/check-site.py` checks 35 and C1 to C11 (real browser; Google requests are blocked in the check so it works offline).
- Cloudflare Web Analytics is outside this consent: it sets no cookies. If that ever changes, the notice text must change.

## 8. Content to re-confirm before launch

- Every `[owner decision: ...]` HTML comment in the source (`grep -rn "owner decision" .`).
- The page is a pitch, not a feature list, on purpose: it names no feature inventory and no "not there yet" list, so it should not go stale. Keep it that way. Re-read the "Where this is going" section (id `next`, nav label "What's next") and the proof visuals against the product on launch day: the section must stay labelled as direction, and anything shown as proof must still be true.
- The page makes no statement about licence, open source, customers, logos, testimonials, performance or accounts. Keep it that way until true.
- The screenshot (`assets/img/hero-*.webp`, recapture and export with `review/capture-screens.py`: 1280x720 window at scale 2, see `docs/design-spec-v2.1.md` section 4) matches the current product UI. Re-capture it from the running product on demo data; never edit it. The drawn diagram and the terminal excerpt use the same demo data and must be kept consistent with it.
- JSON-LD in `index.html` has `Organization` (with a contactPoint for hello@jubilab.io, which must be a working mailbox), `WebSite` and `SoftwareApplication` with only durable true facts. `operatingSystem` is deliberately absent until platforms are confirmed.

## 9. Final checks

- Submit the live form once and confirm the record in KV and the redirect to `/thanks/`.
- Open the page with JavaScript disabled: light theme, all content visible, theme button hidden.
- Open the page with the system set to dark mode: it must still be light until the visitor presses the toggle.
- Before the visitor accepts the cookie notice, no request goes to Google and no `_ga` cookie exists (only Cloudflare's own beacon may appear); after Accept, `www.googletagmanager.com` is requested. Check 35 in `review/check-site.py` asserts this (`--strict-network` expects none at all).
- Run the page through a validator and a contrast checker in both themes.
