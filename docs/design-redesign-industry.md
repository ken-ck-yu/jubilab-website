# Home page redesign: industry-page layout

Status: built on branch `feat/redesign-industry-layout`, 2026-10-17, website Engineer. Source: the approved mockup `Main.dc.html` plus the owner decisions below. Not merged.

## What changed (current summary, 2026-10-17)
- Images: friendly flat SVG illustrations (style A) for the four feature cards and a redrawn vision image; no stock photos are left on the page (the real product screenshots in the hero are the only raster images).
- The "Who we are starting with" section was replaced by "Are you facing these issues?" (eight plain situations, one Request early access button; strip and menu label "Is this you?").
- Removed the "Invite-only early access" chip from the hero eyebrow. Invite-only wording remains only as a factual statement outside the top of the page: the meta description, og:description and twitter:description, the early-access form text ("Jubilab is invite-only ..."), the footer ("available by invitation only") and `llms.txt` ("Access is by invitation only").
- Integrations are text-only with "Available now" and "Where we are heading" rows; no status chips anywhere; one navigation (sticky strip on desktop, header menu below 900 px).

## Detail of the first round
- Dark header with a sticky page-section strip (shown from 900 px; below that the header menu is the navigation), orange accent bar over the H1, card grids (4 feature cards, integrations, 2 audience cards), a dark "One record across your whole toolchain" band, a vision section with image, a dark demo band, dark footer with an orange stripe.
- Section order: hero, What it does (`#how`, aliases `#problem`, `#build`), Integrations (`#fits`), Accelerate the genetics discovery loop (`#next`), Who we are starting with (`#who`), See it on a demo project (`#product`, alias `#demo`), Request early access (`#access`, alias `#start`). All old anchors still resolve, so `llms.txt` links and external links keep working.
- Accent colour moved from teal to orange. Tokens: `--accent` #e8520a (non-text only: bars, focus ring, borders), `--accent-ink` #b73f05 (text on light, 5.1:1 on the page), #ff8a4d (text and fills on dark), buttons are #c2410c with white text (5.2:1; #e8520a with white is about 3.9:1 and is not used for text). Dark theme keeps working (theme.js untouched): accent becomes #ff8a4d, buttons #ff8a4d with dark text.
- Owner decision: no status words anywhere (no Today, Building, Exploring, Planned chips or labels, no legend footnote). Honesty is carried by structure and tense only: an "Available now" row and a "Where we are heading" row; Connect and Catch say "We are building ...".
- Integration cards are text only: name as title plus a "What we take from it" line. No logos, monograms or images, no per-card links. One "Request early access" button closes the section, then the line "Product names belong to their owners. Jubilab is not affiliated with or endorsed by them."
- Images (owner feedback 2026-10-17): the four feature cards use original SVG illustrations (`assets/img/card-*.svg`, 1600x900 viewBox, own background rect so they look the same in light and dark theme, system monospace/sans fallbacks because an SVG used through `<img>` cannot load page fonts, "synthetic data" note in each, no logos, no real data); their stock photos were removed and the per-card links (See a trace, See a comparison) were removed. vision-agent (an agent asking the record, captioned inside the image "Illustration of what we are building toward. Synthetic data.") and who-biotech (terminal, variant table and lineage strip, no people) are original SVG illustrations too; only who-core stays a licensed photo, from `assets/img/<slot>-800.webp` and `-1600.webp` (supplied by the image agent; credits in `docs/image-credits.md`). All `alt=""` (decorative, text beside them says everything), `loading="lazy"`, width/height 1600x900, striped CSS placeholder behind each so a missing file never breaks layout.

## Deliberately kept
- H1 "More Science Fewer Data & Admin Headaches"; hero text, JSON-LD (description still equals the visible hero text), OG/Twitter tags, canonical, title, description, sitemap, robots, no noindex on home/privacy/terms.
- The early-access form: markup, field names, endpoint `/api/early-access`, honeypot `q7_note`, consent text, `theme.js`, `consent.js`, `src/`. Cookie notice and Google consent unchanged (no CSP exists in the repo; no inline scripts or handlers added).
- Hero stays stacked (text, then the real screenshot at full container width), not side by side as in the mockup. Reason: docs/design-spec-v2.1.md measured that a side-by-side screenshot is too small to read, and checks 4, 6, N2, N3 pin the geometry. Hero still uses the real `hero-*.webp`.
- The demo section keeps the real lineage diagram, its text version, and the real terminal session instead of a second copy of the same screenshot. No "Script" limits table, no parity claim between the three engines, no stats, customer names or testimonials; the "4 / 2 / 0" callouts are not used. The four fact labels remain as text chips.
- True statements kept: runs on your own machine; the server makes no outbound network calls; demo data synthetic; invite-only early access.

## Checks changed (review/check-site.py), with reasons
- 14, 15, 16: header nav is now What it does / Integrations / Demo; h2 section order is how, fits, next, who, product, access. The layout changed on purpose.
- 17: was "Where this is going" heading with a "Planned, not in the product today" chip; the owner removed all status words, so it now asserts the vision heading exists and that no Today/Building/Exploring/Planned label exists in `main`.
- Validator round 1 follow-ups: `<main>` has `tabindex=-1` so the skip link moves focus; one navigation (the header holds brand, theme toggle and CTA; the sticky strip is the nav from 900 px; below 900 px the header menu lists the same six links; checks 14, 15, 33 now test those); check 17 asserts no chip element and no standalone Today, Exploring, Building, Planned, Coming soon or Beta in `main` (the sentence form "We are building" and the form question "made today" are allowed; the vision paragraph now reads "We are building that record"); the sentence "None of these is in the product yet" was removed.
- Budgets, tightened to measured values plus headroom (measured: own-origin total 299 KB, images 168 KB, html 34.5 KB, css 26.6 KB, page height 8082 px at 1440 and 12184 px at 390): total 400 KB (was 320 before the redesign), images 260 KB, html 36 KB, css 28 KB, height 9000 at 1440 and 13000 at 390. Other loosened limits: main words 1500 (was 1000).
- (superseded numbers, kept for history) 12, 20, 34, 9: page is longer and richer by design: height cap 9500 (1440) and 13500 (390), main words 1500 (was 1000), own-origin bytes 520 KB (was 320), html 40 KB (was 30), css 32 KB (was 30), image bytes 400 KB (was 100, now includes lazy images near the fold). The tests for Today/Building tags did not exist in `tests/`.

## Copy table (new claims and evidence)
| Copy | Evidence |
|---|---|
| Nextflow: tasks, inputs, outputs, parameters and versions of each run, recorded as it happens or imported from a finished run | Jubilab README (Nextflow hook and `jubilab import nextflow`); shipped; v0.6.0 notes: Nextflow import byte-identical to v0.5.2 |
| Snakemake: rules, commands kept as hashes, inputs and outputs left on disk, imported from its metadata | docs/releases/v0.6.0.md (INT-02, sha256 of shellcmd, rule names, file references) |
| Native bash: command, redacted arguments, times, exit code, declared files, with `jubilab run` | v0.6.0 notes (INT-03) |
| Row note: "They do not all record the same things, and what Jubilab infers is marked as inferred" | v0.6.0 notes: Snakemake run boundaries inferred, parameters not recorded; wrapper declared files manual or inferred |
| Seqera, Parabricks, BioNeMo, DeepMind, MCP agents, notebooks, GitHub ("will", "we are building toward"; row note "This is what we are building toward") | ambition; owner brief |
| "Jubilab sits beside your pipelines. It does not replace them, and it does not store your data." | existing site copy and README ("links to your data where it lives") |
| Trace, Compare card text | existing site copy; shipped (demo) |
| Connect, Catch: "We are building ..." | existing site copy ("Building"), now in future tense |
| (superseded, section replaced) Who: three bullets each; "teams that already run their own pipelines" | mockup copy approved by owner; positioning docs |
| Vision paragraph | unchanged existing copy |

## Budgets after the illustrations (2026-10-17)
With five of the six non-hero images now SVG (about 10 KB each, not counted as raster images by check 34) measured own-origin total is 190 KB and raster images 47 KB, so the limits are 300 KB total and 200 KB images (html 33.7 KB of 36, css 26.6 KB of 28).

## Owner decisions, second round (2026-10-17)
- Images: friendly flat illustrations (style A of the ImageOptions mockup) for the four feature cards, ported unchanged as `card-*.svg` (viewBox 320x180, no text, `alt=""`, own background rect). The vision image was redrawn in the same style: a loop of four pictograms (idea, experiment, result, record) joined by a dotted circular arrow, no text, no code, no claim drawn in (`alt=""`). The earlier technical SVGs, `who-biotech.svg` and the who-core photo were removed; no third-party photo ships any more (see `docs/image-credits.md`).
- "Who we are starting with" was replaced by "Are you facing these issues?" (`#who`, new alias `#issues`; strip and menu label "Is this you?"). Eight situations in plain words, a closing line and one "Request early access" button. The old audience wording (computational genomics teams at biotechs, genomics core facilities) no longer appears on the page; `llms.txt` and the JSON-LD never carried it. The form still says invite-only and that answers help us choose labs; the section promises nothing beyond that (no "we reply personally": the form and Worker do not promise a reply).
- Dead CSS `.cl` removed.

Copy table additions: the eight situations are "situation, no claim" (plain relatable statements, no stats, no ranking). Four come straight from the existing problem copy (which samples went into a callset, GRCh37 or GRCh38, analyst leaves, mislabelled sample). Closing line "we would like to hear from you" and the form sentence restate the existing form copy.
