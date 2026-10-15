# Launch checklist

The site is a static preview. It is non-indexable on purpose. Do these steps, in order, when the owner decides to launch. Everything is a file edit; there is no build step.

## 1. Make the site indexable (the single switch)

Until this step, every page carries `<meta name="robots" content="noindex">` and `robots.txt` disallows everything.

1. Remove the line `<meta name="robots" content="noindex">` from `index.html`, `404.html` (keep it on 404 if preferred), and, only once the owner has approved their text, from `privacy/index.html` and `terms/index.html`.
   - Find them: `grep -rn 'name="robots"' --include=*.html .`
2. Replace the contents of `robots.txt` with the launch rules written at the bottom of that file (commented): `User-agent: *`, `Allow: /`, and the `Sitemap:` line.
3. Check `sitemap.xml`: it lists only `https://jubilab.io/`. Add `https://jubilab.io/privacy/` and `https://jubilab.io/terms/` after step 1 is done for those pages.
4. Check every `<link rel="canonical">` and `og:url`: they already point at `https://jubilab.io/` (home), `/privacy/` and `/terms/`. Confirm they match the final live URLs, with or without trailing slash.
5. Check the Open Graph preview of `https://jubilab.io/` in a link-preview tool after deploy (image: `assets/og/jubilab-og.png`, 1200x630; its source is `assets/og/og-source.html`).

## 2. DNS and hosting (GitHub Pages)

- `CNAME` contains exactly `jubilab.io`.
- In the repository settings, Pages source is the root of the publishing branch. GitHub Pages on a free account needs a public repository (see README).
- DNS at the registrar: apex `jubilab.io` A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (and AAAA records per GitHub's current documentation); optional `www` CNAME to `<owner>.github.io`. Verify against the GitHub Pages documentation before changing DNS.
- Turn on "Enforce HTTPS" once the certificate is issued.
- `404.html` uses root-relative paths and only works on the custom domain root.

## 3. Enable the early-access form

The form in `index.html` (`#early-access-form`) is inactive: all fields and the button are inside `<fieldset disabled>`, it has no `action`, and a visible notice says nothing is sent. To activate it:

1. Choose a backend (owner decision) and decide where the answers are stored, who can see them and for how long.
2. On `<form id="early-access-form">` add `action="https://YOUR-ENDPOINT"` and `method="post"`.
3. Remove the `disabled` attribute from the outer `<fieldset class="flat">` and from the submit `<button>`.
4. Delete the `<p class="demo-flag">` paragraph.
5. Replace the "Draft privacy note" paragraph with the owner's final text, and make `privacy/` list exactly what is collected (below).
6. Test a real submission end to end and check the backend receives every field name below.

What the form collects (data minimisation: everything is optional except email):

| Field name | Question | Type | Required |
|---|---|---|---|
| `role` | Your role: lab head, researcher or analyst, core facility or platform engineer, other | one choice | no |
| `field` | Your field: genetics or genomics, other life science, other lab science | one choice | no |
| `tools` | Tools used today: Nextflow, Snakemake, Galaxy, scripts or notebooks, other | any of several | no |
| `human-data` | Work involves human or patient-derived data: yes, no, prefer not to say | one choice | no |
| `trace` | What would you most want to trace or compare | text, max 300 characters | no |
| `email` | Email address | email | yes |

The consent line ("By sending this form you agree that we may email you about early access") is plain text under the fields. If the backend or the privacy text needs an explicit checkbox, add one. Because the answers describe a person's work and may reveal institutional context, the privacy text must say who sees them and how to ask for deletion.

## 4. Button label

The call-to-action label "Request early access" appears in the header, the hero, the section 08 heading and the form button. To change it, run `grep -rn "Request early access" --include=*.html .` and edit each hit (the header text is repeated on index, privacy, terms and 404).

## 5. Contact address

`hello@jubilab.io` in the footer (all four pages) is a placeholder and the mailbox is not set up. Create it, or replace the address everywhere: `grep -rn "hello@jubilab.io" .`

## 6. Legal pages

`privacy/index.html` and `terms/index.html` are shells marked Draft with `noindex`. Replace the shell paragraphs with the owner's text, remove the "Draft" notice and the HTML comment, then handle `noindex` as in step 1.

## 7. Analytics

None is included, and the site makes no third-party requests (fonts are self-hosted). If analytics is wanted later, choose a cookieless, self-hosted option, add it deliberately, and update the privacy text.

## 8. Content to re-confirm before launch

- Every `[owner decision: ...]` HTML comment in the source (`grep -rn "owner decision" .`).
- The page is a pitch, not a feature list, on purpose: it names no feature inventory and no "not there yet" list, so it should not go stale. Keep it that way. Re-read the "Where this is going" section (04) and the proof visuals against the product on launch day: the section must stay labelled as direction, and anything shown as proof must still be true.
- The page makes no statement about licence, open source, customers, logos, testimonials, performance or accounts. Keep it that way until true.
- The screenshot (`assets/img/lineage.webp`) matches the current product UI. Re-capture it from the running product on demo data; never edit it. The drawn diagram and the terminal excerpt use the same demo data and must be kept consistent with it.
- JSON-LD in `index.html` has `Organization` and `SoftwareApplication` with only durable true facts. `operatingSystem` is deliberately absent until platforms are confirmed.

## 9. Final checks

- Open the page with JavaScript disabled: light theme, all content visible, theme button hidden.
- Open the page with the system set to dark mode: it must still be light until the visitor presses the toggle.
- No request leaves the origin (browser network panel).
- Run the page through a validator and a contrast checker in both themes.
