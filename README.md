# Jubilab website

Content and code for the public Jubilab website, hosted on GitHub Pages. The product itself lives in a separate, private repository; this repository holds **only** the website.

Status: design exploration. Nothing here is published yet.

## Layout

```text
jubilab-website/
├── README.md
├── docs/
│   ├── design-research.md     study of recent YC company sites and the design directions derived from it
│   └── decisions.md           website decisions and open questions
├── designs/
│   ├── index.html             side-by-side overview of the design options
│   ├── option-a/ ... option-e/  one self-contained demo page per design direction (static HTML and CSS)
└── assets/screens/            real product screenshots used in the demos
```

## Principles

- Every claim on the site must be true and verified. No invented testimonials, customer logos, metrics or features that do not exist.
- Third-party material (reference screenshots of other companies' sites) is **never** committed here; only our own work is.
- Fast static pages with real HTML text (good for search engines and AI assistants), accessible, readable on a phone.
- No ad trackers. Fonts are self-hosted before launch.

## Hosting note

GitHub Pages on a free account publishes only from **public** repositories. This repository is meant to be public (it contains only website content), while the product repository stays private.
