# Jubilab website

Content and code for the public Jubilab website, hosted on GitHub Pages at `jubilab.io`. The product itself lives in a separate, private repository; this repository holds **only** the website.

Status: first production version of the site (preview, non-indexable). See `docs/launch-checklist.md` for the steps to launch.

## Layout

```text
index.html            the single-page site (light by default, optional dark theme)
style.css             all styles; colours are tokens on :root and :root[data-theme="dark"]
privacy/, terms/      draft shells (noindex), content to be added by the owner
404.html, CNAME, robots.txt, sitemap.xml
assets/               img/ (product screenshots, WebP), fonts/ (self-hosted woff2 + OFL licences),
                      og/ (social image and its source), theme.js, favicon.svg
docs/launch-checklist.md
```

Static HTML and CSS, no build step. A little vanilla JavaScript (`assets/theme.js`) only for the theme toggle. Preview locally with `python3 -m http.server`.

## Principles

- Every claim on the site must be true and verified. No invented testimonials, customer logos, metrics or features that do not exist.
- Screenshots come from the running product on synthetic demo data and are never edited. Third-party material is never committed here.
- Zero third-party requests at runtime. No trackers. Fonts are self-hosted.
- Fast static pages with real HTML text, accessible, readable on a phone.

## Hosting note

GitHub Pages on a free account publishes only from **public** repositories. This repository is meant to be public (it contains only website content), while the product repository stays private.
