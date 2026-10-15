# Launch checklist

The site is a static preview. It is non-indexable on purpose. Do these steps, in order, when the owner decides to launch. Everything is a file edit; there is no build step.

## 1. Make the site indexable (the single switch)

Until this step, every page carries `<meta name="robots" content="noindex">` and `robots.txt` disallows everything.

1. Remove the line `<meta name="robots" content="noindex">` from `index.html`, `404.html` (keep it on 404 if preferred), and, only once the owner has approved their text, from `privacy/index.html` and `terms/index.html`.
   - Find them: `grep -rn 'name="robots"' --include=*.html .`
2. Replace the contents of `robots.txt` with the launch rules written at the bottom of that file (commented): `User-agent: *`, `Allow: /`, and the `Sitemap:` line.
3. Leave `/thanks/` out of the sitemap and keep `noindex` on it. Check `sitemap.xml`: it lists only `https://jubilab.io/`. Add `https://jubilab.io/privacy/` and `https://jubilab.io/terms/` after step 1 is done for those pages.
4. Check every `<link rel="canonical">` and `og:url`: they already point at `https://jubilab.io/` (home), `/privacy/` and `/terms/`. Confirm they match the final live URLs, with or without trailing slash.
5. Check the Open Graph preview of `https://jubilab.io/` in a link-preview tool after deploy (image: `assets/og/jubilab-og.png`, 1200x630; its source is `assets/og/og-source.html`).

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
2. HTTPS is automatic. `404.html` is served for unknown paths.
3. Submit a real test entry on the live site and check it in Storage & Databases > KV > the new namespace (key `email:<address>`, JSON value with email, role, role_other, field, field_other, runs_on, runs_on_other, human_data, tracking, received_at). To delete someone on request, delete their key.
4. Tests: `node --test` (Node 18 or newer). Local preview of the whole site and the form: `npx wrangler dev`.

The form stores only the fields below plus a UTC time (`received_at`). Missing or invalid required answers are rejected by the Worker too (redirect to `/?error=<field>#access` with a message naming the field); nothing is stored then. It does not store IP address or user agent. If the KV binding is missing the API returns 503.

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
| `tracking` | `tracking` | How do you keep track of how a result was made today? | text, max 300 characters | no (the only optional question) |
| `website` | not stored | Hidden spam trap, must stay empty | text | no |

## 3. Signup notification email

Each signup also emails the owner (`src/notify.js`, Workers `send_email` binding `EMAIL`, sent from `signups@jubilab.io`). The recipient is the secret `NOTIFY_TO`, so no personal address is in the public repo.

1. Email Routing must be on for `jubilab.io`, and the recipient must be a **verified destination address** (Email Routing > Destination addresses).
2. Worker > Settings > Variables and Secrets > Add > type **Secret**, name `NOTIFY_TO`, value your address. Redeploy if asked.
3. Submit a test entry. An email "New early-access request" should arrive (check spam the first time). If `NOTIFY_TO` or the binding is missing, nothing is sent and the signup still succeeds.
4. Notification failures never block a signup; the entry is always in KV.

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
- JSON-LD in `index.html` has `Organization` and `SoftwareApplication` with only durable true facts. `operatingSystem` is deliberately absent until platforms are confirmed.

## 9. Final checks

- Submit the live form once and confirm the record in KV and the redirect to `/thanks/`.
- Open the page with JavaScript disabled: light theme, all content visible, theme button hidden.
- Open the page with the system set to dark mode: it must still be light until the visitor presses the toggle.
- While analytics is not enabled, no request leaves the origin (browser network panel; check 35 in `review/check-site.py` does this). If analytics is enabled, the only extra request is Cloudflare's beacon.
- Run the page through a validator and a contrast checker in both themes.
