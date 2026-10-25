# Jubilab website

Content and code for the public Jubilab website, hosted on Cloudflare at `jubilab.io`. The product itself lives in a separate, private repository; this repository holds **only** the website.

Status: order-to-result pivot content (2026-10-25, tracker T-045), pending owner validation and release. See `docs/launch-checklist.md` for the steps to launch.

## Layout

```text
index.html            the single-page site: the order-to-result layer for lab work (light by default, optional dark theme)
style.css             all styles; colours are tokens on :root and :root[data-theme="dark"]
privacy/, terms/      published legal texts (noindex until the launch switch)
404.html, CNAME, robots.txt (Disallow all until launch), robots.launch.txt (launch rules: allows search/answer bots, blocks the training bots GPTBot, ClaudeBot, Google-Extended, CCBot; owner decision 2026-10-16), sitemap.xml, llms.txt
scripts/go-public.py  the launch switch (dry run by default); see docs/launch-checklist.md step 1
assets/               fonts/ (self-hosted woff2 + OFL licences),
                      og/ (social image and its source), theme.js, favicon.svg
docs/launch-checklist.md
review/               check-site.py (layout, accessibility, form markup), check-form.py (form break-it checks on the dev worker), check-seo.py (crawlability, preview or launch mode), smoke-site.py (post-deploy smoke test), dev-worker-server.mjs
```

Static HTML and CSS, no build step. A little vanilla JavaScript: `assets/theme.js` (theme toggle, form hints) and `assets/consent.js` (cookie notice and Google consent; own JS stays under 8000 bytes). Preview locally with `python3 -m http.server`.

## Principles

- Every claim on the site must be true and verified. No invented testimonials, customer logos, metrics or features that do not exist.
- The order layer is not built yet. Describe what is being built, never what is shipped. JSON examples are labelled drafts; no install command or endpoint is shown until one exists. No prices and none of the open questions (product name, pricing, money flow, first partners) appear on the page. Third-party material is never committed here.
- Content source of truth: the pivot brief (`jubilab-pivot-context.md`, owner, 2026-10-25). Banned phrases are pinned in `tests/banned-wording.test.mjs`.
- The only third-party request at runtime is Google Analytics 4 (gtag.js, measurement id G-8W2MDQ58PL), and only after the visitor accepts our own cookie notice (`assets/consent.js`, Google Consent Mode v2, Basic mode: every page's `<head>` has only the inline `denied` defaults, no request, no cookie; docs/launch-checklist.md section 7). Cloudflare Web Analytics is also planned via the dashboard's automatic setup: Cloudflare injects its beacon at the edge, so it is not in this repo's HTML. No other trackers. Fonts are self-hosted.
- Fast static pages with real HTML text, accessible, readable on a phone.

## Releases (simple workflow)

`main` is the live site (Cloudflare production branch). Every release is an annotated tag `vMAJOR.MINOR.PATCH` on `main`. Work happens on short-lived local branches or worktrees, is tested locally (`node --test`, `review/check-site.py`, `review/check-seo.py`, `review/smoke-site.py` against `node review/dev-worker-server.mjs PORT`), and is merged to `main` by the Manager only. No long-lived branches are pushed. Cloudflare preview builds are disabled, so there is no staging: after the production build run `python3 review/smoke-site.py https://jubilab.io`. Roll back with the Cloudflare dashboard (Deployments > roll back) or `git revert` plus a new patch tag. See `docs/launch-checklist.md` section 0 for commands, how to see what is live and how to delete stale branches.

## Hosting note

A Cloudflare Worker with static assets (`wrangler.jsonc`; the domain is on Cloudflare). The repository can be private or public; it contains only website content. The waitlist form is handled by `src/worker.js` and `src/early-access.js`, writing to a KV namespace (every question is required except the free-text comment; each "Other" option has its own required text box; see the field table in `docs/launch-checklist.md`); tests are in `tests/`.
