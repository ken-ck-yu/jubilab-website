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

## 2. Hosting (Cloudflare Pages)

The domain is on Cloudflare, so the site is hosted on Cloudflare Pages. The repository can stay private.

1. Cloudflare dashboard > Workers & Pages > Create > Pages > connect the `jubilab-website` repository, production branch `main` (or the branch chosen at launch). Build command: none. Output directory: `/`.
2. Add the custom domain `jubilab.io` to the Pages project (Cloudflare creates the DNS record). Delete the `CNAME` file if you like; it is only used by GitHub Pages.
3. HTTPS is automatic.
4. `404.html` is served automatically by Pages.

## 3. Early-access form (built, needs one setting)

The form posts to `/api/early-access`, handled by `functions/api/early-access.js` (Cloudflare Pages Functions). It validates the fields, ignores bots through a hidden field, and stores one record per email.

1. Dashboard > Workers & Pages > KV > Create a namespace, for example `jubilab-waitlist`.
2. Pages project > Settings > Bindings (Functions) > add a KV namespace binding with the **variable name `WAITLIST`**, for production (and preview if wanted).
3. Redeploy. Submit a real test entry on the live site, then check it in the KV namespace (key `email:<address>`, value JSON with email, role, field, tools, human_data, trace, received_at).
4. To read or export the list later: dashboard > KV > the namespace, or `wrangler kv key list` and `wrangler kv key get`. To delete someone on request, delete their key.
5. Tests: `node --test tests/` (needs Node 18 or newer).

The form stores only the fields below plus a UTC time. It does not store IP address or user agent. If the binding is missing the function returns 503.

| Field name | Question | Type | Required |
|---|---|---|---|
| `role` | Your role | one choice | no |
| `field` | Your field | one choice | no |
| `tools` | Tools used today | any of several | no |
| `human-data` | Work involves human or patient-derived data | one choice | no |
| `trace` | What would you most want to trace or compare | text, max 300 characters | no |
| `email` | Email address | email | yes |
| `website` | Hidden spam trap, must stay empty | text | no |

## 4. Button label

The call-to-action label "Request early access" appears in the header, the hero, the section 08 heading and the form button. To change it, run `grep -rn "Request early access" --include=*.html .` and edit each hit (the header text is repeated on index, privacy, terms and 404).

## 5. Contact address

`hello@jubilab.io` in the footer (all four pages) is a placeholder and the mailbox is not set up. Create it, or replace the address everywhere: `grep -rn "hello@jubilab.io" .`

## 6. Legal pages

`privacy/index.html` and `terms/index.html` are shells marked Draft with `noindex`. Replace the shell paragraphs with the owner's text, remove the "Draft" notice and the HTML comment, then handle `noindex` as in step 1.

## 7. Analytics (Cloudflare Web Analytics)

No code is needed. Dashboard > Workers & Pages > the Pages project > Metrics > Enable Web Analytics (some dashboards show it under Manage). Cloudflare adds its beacon script on the next deployment. It is cookieless. It is the only third-party request the site makes, and `privacy/` already says so. If you turn analytics off, update the privacy text. Check in the browser network panel after deploy that the only extra request is Cloudflare's beacon.

## 8. Content to re-confirm before launch

- Every `[owner decision: ...]` HTML comment in the source (`grep -rn "owner decision" .`).
- The page is a pitch, not a feature list, on purpose: it names no feature inventory and no "not there yet" list, so it should not go stale. Keep it that way. Re-read the "Where this is going" section (04) and the proof visuals against the product on launch day: the section must stay labelled as direction, and anything shown as proof must still be true.
- The page makes no statement about licence, open source, customers, logos, testimonials, performance or accounts. Keep it that way until true.
- The screenshot (`assets/img/lineage.webp`) matches the current product UI. Re-capture it from the running product on demo data; never edit it. The drawn diagram and the terminal excerpt use the same demo data and must be kept consistent with it.
- JSON-LD in `index.html` has `Organization` and `SoftwareApplication` with only durable true facts. `operatingSystem` is deliberately absent until platforms are confirmed.

## 9. Final checks

- Submit the live form once and confirm the record in KV and the redirect to `/thanks/`.
- Open the page with JavaScript disabled: light theme, all content visible, theme button hidden.
- Open the page with the system set to dark mode: it must still be light until the visitor presses the toggle.
- No request leaves the origin except Cloudflare's analytics beacon (browser network panel).
- Run the page through a validator and a contrast checker in both themes.
