# Launch checklist

The site is a static preview. It is non-indexable on purpose. Do these steps, in order, when the owner decides to launch. Everything is a file edit; there is no build step.

## 1. Make the site indexable (the single switch)

Until this step, every page carries `<meta name="robots" content="noindex">` and `robots.txt` disallows everything. The switch is one script, `scripts/go-public.py` (Python 3, standard library only; tested by `tests/go-public.test.mjs` on a copy of the repo).

1. Dry run (the default; prints the diff, changes nothing): `python3 scripts/go-public.py`
2. Apply: `python3 scripts/go-public.py --apply`. It removes `noindex` (and the PREVIEW comment) from `index.html`, copies `robots.launch.txt` over `robots.txt`, and rewrites `sitemap.xml` to list exactly the indexable pages with `lastmod` from the last git commit of each page. `thanks/` and `404.html` always keep `noindex`. Running it again changes nothing.
3. Legal pages: once the owner has approved the text of `privacy/` and `terms/` and removed their "Draft" notice, run it with `--with-legal`. It refuses while the Draft notice is still there (`--allow-draft` overrides, only for a rehearsal). Also remove "(draft)" from their `<title>` and rewrite their description if needed; `review/check-seo.py` warns about this.
4. Check the result against a local server of the changed files: `python3 review/check-seo.py http://127.0.0.1:PORT --mode launch`. Before the switch, `--mode preview` must pass (all noindex, robots disallows all).
5. Check every `<link rel="canonical">` and `og:url` against the final live URLs (trailing slash matters). Check the Open Graph preview of `https://jubilab.io/` in a link-preview tool after deploy (image `assets/og/jubilab-og.png`, 1200x630, source `assets/og/og-source.html`).
6. Optional AI-crawler rules: see the commented block in `robots.launch.txt` (recommendation: allow search and answer bots; blocking training bots is the owner's decision) and the Cloudflare note below. `llms.txt` is already in the repo; it is served from the first deploy and, until the switch, covered by the robots Disallow.

Do not push or deploy from the script; those stay separate owner steps.

### SEO setup after launch (owner steps; none of this can be done from the repo)

- **Google Search Console**: add `jubilab.io` as a Domain property and verify with the DNS TXT record Google shows (Cloudflare DNS, add as a TXT record at the apex). Or, for a URL-prefix property, give us the `<meta name="google-site-verification" content="...">` tag and it goes in the `<head>` of `index.html` only. Then Sitemaps > submit `https://jubilab.io/sitemap.xml`.
- **Bing Webmaster Tools**: add the site (it can import from Search Console), verify by DNS TXT or the `msvalidate.01` meta tag the owner supplies, submit the same sitemap. Bing data also feeds some assistants' search.
- **IndexNow (optional)**: lets Bing and some other engines hear about changed URLs. It needs a key file at the site root; not set up. Not needed for a five-page site.
- **After launch, check**: URL Inspection in Search Console on `https://jubilab.io/` (should say "URL is on Google" once indexed; "Request indexing" is available); `site:jubilab.io` in Google and Bing; that `thanks/` and `404` do not appear; that the page the search engine shows as canonical is the one you expect.
- **How long**: indexing a new site usually takes from a few days to a few weeks and is not guaranteed; nothing in this repo can speed it up or promise a ranking, an indexing date or any citation by an AI assistant.
- **Cloudflare can block AI crawlers**: Cloudflare offers "Block AI bots" and AI Crawl Control (Security > Bots, and AI Crawl Control in the dashboard), and can add its own managed robots.txt content. New Cloudflare zones may have AI-crawler blocking on by default. We have NOT verified this account's setting. Before launch, open those pages and make sure the search and answer bots (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User) are allowed, and decide on training bots (GPTBot, ClaudeBot, Google-Extended, CCBot). Also check Security > Bots does not challenge Googlebot and Bingbot (verified bots are normally allowed).
- **Keep it true**: `index.html` JSON-LD (`Organization`, `WebSite`, `SoftwareApplication`) and `llms.txt` repeat facts from the page. When the page copy changes, change them too, and re-run `review/check-seo.py`. `operatingSystem`, `offers`, ratings, reviews and a logo are deliberately absent until true and confirmed.

## 2. Hosting and the form (Cloudflare Workers with static assets)

Cloudflare's "Create an app" flow deploys this repo as a Worker that serves the static files and handles `/api/early-access`. Config is in `wrangler.jsonc`; `.assetsignore` keeps source, docs and tests off the public site. The repository can stay private.

In the Cloudflare setup screen (connected to `ken-ck-yu/jubilab-website`):
- Project name: `jubilab-website` (must match `name` in `wrangler.jsonc`).
- Build command: leave empty.
- Deploy command: `npx wrangler deploy` (the default).
- Preview command: `npx wrangler preview` is fine, or leave the default. Enable Preview builds is optional.
- Production branch: the branch with these files (`main` after the owner merges `site-v1`; until then, choose `site-v1` for a first trial deploy).

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

`privacy/index.html` and `terms/index.html` are shells marked Draft with `noindex`. Replace the shell paragraphs with the owner's text, remove the "Draft" notice and the HTML comment, then handle `noindex` as in step 1.

## 7. Analytics (Cloudflare Web Analytics)

No code is needed. Dashboard > Analytics & Logs > Web Analytics > add the site `jubilab.io` and enable automatic setup (or, for a Worker, copy the one-line snippet Cloudflare gives you into `index.html` and the other pages; if you do, tell me and I will add it). Without one of these, no analytics are collected. It is cookieless. It is the only third-party request the site makes, and `privacy/` already says so. If you turn analytics off, update the privacy text. Check in the browser network panel after deploy that the only extra request is Cloudflare's beacon (and, until you enable analytics, that there is none).

Restore text. `privacy/index.html` currently says the site does not use analytics, with an `OWNER:` comment above that paragraph. If you enable Cloudflare Web Analytics, replace the sentence "It does not currently use analytics or cookies." with the following sentence, and change the "no ... scripts ... from other companies" wording to match:

> It uses Cloudflare Web Analytics, a privacy-focused service that counts page views, referrers, countries and browser types without cookies and without tracking you across sites or building a profile of you; its small script loads from Cloudflare.

Original paragraph, for reference (the site is served from Cloudflare Workers):

> The site is static pages served from Cloudflare Workers. It sets no cookies, runs no advertising trackers, and loads no fonts, scripts or images from other companies. It uses Cloudflare Web Analytics, a privacy-focused service that counts page views, referrers, countries and browser types without cookies and without tracking you across sites or building a profile of you; its small script loads from Cloudflare. The only thing it stores in your browser is your light or dark theme choice (local storage key <code>jubilab-theme</code>), which never leaves your device. Like any web host, the hosting provider (Cloudflare) receives your IP address and basic request details when your browser fetches a page, and handles them under its own privacy statement.

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
- While analytics is not enabled, no request leaves the origin (browser network panel; check 35 in `review/check-site.py` does this). If analytics is enabled, the only extra request is Cloudflare's beacon.
- Run the page through a validator and a contrast checker in both themes.
