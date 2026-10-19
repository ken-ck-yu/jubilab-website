# Blog authoring guide

The blog is static. You write `blog/_src/<slug>/post.md` and draw `blog/_src/<slug>/image.svg`; `scripts/build-blog.py` turns them into pages. Writers touch only their own `blog/_src/<slug>/` folder. Never edit `blog/<slug>/`, `blog/index.html`, `sitemap.xml` or `llms.txt` by hand: they are generated (the build rewrites the marked blog blocks in the last two).

## Binding rules (verbatim from the owner brief; every post must follow them)

- Voice: ambitious and curious, forward-looking about Jubilab's vision, but factual about everything else. Where something is uncertain, contested, or you could not verify it, say so as a question or an open discussion ('we wonder whether...', 'it is worth asking...', 'some teams report...; we have not tested this'), never as a conclusive claim. Never state a number, date, rate, or 'studies show' without a fetched source that says exactly that.
- Honesty: no invented statistics, customers, quotes, awards, interviews, or anecdotes presented as real; if a scenario is hypothetical, say 'imagine'. No 'first/only/fastest/best', no 'reproducible results' guarantee, no claim that Jubilab replaces or beats any product, no implied partnership or integration; non-affiliation where other products are named. Shipped on the product: trace, compare, evidence statuses, immutable runs, Nextflow import and live capture, Snakemake import, native bash wrapper. Opt-in reference/annotation header capture ships with the next release. NOT available: sample linking, sample-swap or build-mismatch checks, Seqera or any other integration, AI-agent access, notebooks, GitHub integration (these are 'where we are heading').
- Banned words in post content (legal review pending): 'audit trail', 'regulated', 'compliance', 'GxP', 'validated', 'FDA', '21 CFR', 'HIPAA', 'GDPR' (a post may discuss the idea of accountability without them).
- Images: one per post, text-free friendly flat SVG drawn by us; no stock photos, no AI-generated imagery, no logos. Each post needs a distinct image concept relevant to its topic.
- References: real, fetched, first-party or reputable (docs, specs, papers, standards bodies); give title, publisher, URL, access date; no forum content you could not read.

How the build enforces what a machine can check: the banned legal words, claim words (`the first`, `the only`, `fastest`, `the best`, `reproducible results`, `guarantee`, `studies show`, `better than`, `beats`, `outperform`), the palette and element list of the image, source count and citations, lengths. It cannot check truth, hedging or tone; the reviewer and the independent fact-check do that.

## Source format

`post.md` is a front-matter block, then a restricted Markdown subset. Anything outside the subset fails the build with the line number.

```
---
title: What is data provenance in bioinformatics?
description: <150 to 160 characters: what the post answers; one sentence or two, no quotes>
slug: what-is-data-provenance-in-bioinformatics
date: 2026-10-19
updated: 2026-10-19
tags: provenance, lineage, bioinformatics
summary: <40 to 140 characters, one line, shown on the card and in llms.txt>
image_alt: <30 to 200 characters describing the picture for someone who cannot see it>
reading_time: 7
---
```

Front matter rules: every key is required except `reading_time` (whole minutes; if absent it is computed as words / 220, rounded up). One `key: value` per line, no quotes needed, no `<` or `>`. `slug` is lowercase-with-hyphens, at most 80 characters, and equals the folder name. `date` and `updated` are real `YYYY-MM-DD` dates and `updated` is not before `date`. `tags`: 1 to 4 lowercase-with-hyphens words (reuse existing tags so related posts link up). The page `<title>` is `title + " | Jubilab"` and must be 65 characters or fewer, so **`title` is at most 55 characters**. `description` is 150 to 160 characters exactly as counted by the build. Unknown keys are rejected.

Body, after the front matter:

| Construct | Write it as |
|---|---|
| Lede | The first block must be a paragraph; it becomes the large intro in the page header and is not repeated in the body |
| Headings | `## Heading` and `### Sub-heading` only. No `#` (the title is the single H1), no `####`. Plain text only |
| Paragraph | Text lines; a blank line ends it |
| Lists | `- item` or `1. item` (numbered 1, 2, 3 ...). No nesting. A continuation line is indented 2 spaces |
| Quote | `> text` on every line |
| Bold, italic, inline code | `**bold**`, `*italic*`, `` `code` `` |
| Links | `[text](https://...)` for outside pages (the build adds `rel="noopener"`, rejects tracking parameters such as `utm_`), or `[text](/guides/)` for a page of this site (must exist) |
| Citation | `[^1]` after the claim it supports; `1` is the first item in Sources. Every source must be cited at least once and every `[^n]` must have a source |
| Code | A fence of three backticks, optional lowercase language and an optional caption after it (```` ```bash Run this in the project folder ````); use language `output` for command output. Tested commands only |

Not supported, and rejected: raw HTML (`<` and `>` outside code), images, tables, horizontal rules, nested lists, `*` or `+` bullets, reference-style links, footnote text, backslash escapes, `#` or `####` headings. If you need something that is not here, ask the Manager rather than working around it.

Required ending. The last two `##` sections, in this order:

1. `## Questions we are still asking`: the open questions, uncertain points and things you could not verify, as a list or short paragraphs. It is rendered as a highlighted box. A post with nothing unverified or uncertain is rare; if the box feels empty, you are probably claiming something you should hedge.
2. `## Sources`: one `- ` list, nothing else, at least 3 items, each exactly:

   `- [Title](https://url) | Publisher | Accessed: YYYY-MM-DD`

   Title and publisher are plain text. The access date is the day you fetched the page yourself.

Length: 900 to 1400 words of body (headings, lists and code included; the Sources list not counted). The build fails outside that range.

Generated for you, do not write them: the byline "By Jubilab" (author and publisher are the Organization Jubilab only; never invent a person), dates, reading time, tags, breadcrumbs, the "How Jubilab helps" box with the shipped and not-yet lists (the same wording as the guides) and one early-access button, the non-affiliation sentence, previous and next links, and related posts by shared tag.

## The image

One per post: `blog/_src/<slug>/image.svg`, text-free friendly flat illustration drawn by us. Style reference: `assets/img/card-*.svg` and the sample post.

- `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="1600" height="900">`, first element a full-size background `<rect>`.
- Simple shapes, rounded corners, 3 unit ink outlines (`#17201c`), dotted orange accents. Palette only: `#f4f5f2`, `#17201c`, `#e8520a`, `#fbe9dc`, `#e6efe9`, `#e8ebf3`, `#f3ead6`, `#2f6f62`, white. The build rejects other colours.
- Allowed elements: `svg g rect circle ellipse path line polyline polygon defs clipPath`. No text, no `<image>`, no `<style>`, no scripts, no `href`, no `style` or `on*` attributes, no filters. At most 30 KB.
- No words, no logos, no code, no screenshots, no stock photo, no AI-generated imagery. A distinct concept per post that fits the topic, not a reuse of another post's picture.
- `image_alt` describes what the picture shows in plain language (for example "A file at the end of a chain, linked back through a gear ..."), not the post title.
- Social crawlers (Facebook, LinkedIn, X and others) do not reliably accept SVG for `og:image`, so every post also ships `blog/_src/<slug>/og.png`, 1200x630, made from the SVG: `python3 scripts/render-og.py` (needs Playwright and Chromium; it scales the picture to full height and centres it on its own background colour, nothing is cropped). The page shows the SVG; the PNG is only for link previews and the JSON-LD image. Commit both.

## Add a post and rebuild

1. Create `blog/_src/<slug>/post.md` and `image.svg`. Fetch every source yourself and quote nothing you did not read.
2. `python3 scripts/build-blog.py --lint --allow-missing-og` until it passes (validates only, writes nothing).
3. `python3 scripts/render-og.py` to make `og.png`.
4. `python3 scripts/build-blog.py` writes `blog/<slug>/index.html`, `image.svg`, `og.png`, `blog/index.html` and the blog blocks of `sitemap.xml` and `llms.txt`. `--check` fails if anything on disk is out of date; the tests run it. A folder in `blog/` with no source is an error.
5. `node --test`, then serve the repo and run `review/check-site.py` and `review/check-seo.py --mode launch --with-legal` (see `docs/launch-checklist.md` section 0). Look at the page at 375 px and 1440 px, light and dark.
6. Do not push or merge; the Manager does.

When two writers work in parallel, only `sitemap.xml`, `llms.txt`, `blog/index.html` and other posts' related links change as a side effect; the Manager runs the build once after merging all posts, so writers should not commit generated files. (If you do commit them, the Manager's rebuild overwrites them.)

## Review checklist (writer, then the independent fact-check)

- [ ] Every number, date, version, quote and "X does Y" claim is in a source you fetched, and the source says exactly that. Otherwise it is a question.
- [ ] Hedged wording where uncertain, contested or untested; scenarios introduced with "imagine"; no invented anecdote, customer, interview, statistic.
- [ ] No claim that Jubilab replaces or beats a product, no integration or partnership implied; non-affiliation holds where products are named; no feature outside the shipped list is described as available.
- [ ] No banned legal word, none of the claim words, no "reproducible results" promise.
- [ ] Image is text-free, from the palette, relevant, distinct from the other posts; alt text describes it; `og.png` made and looks right.
- [ ] 3 or more sources, each with title, publisher, URL, access date; links open; every source cited; no forum content you could not read.
- [ ] Title is at most 55 characters, description 150 to 160, summary one line, tags reused where possible.
- [ ] `build-blog.py --check`, `node --test`, `check-seo.py` and `check-site.py` pass.
- [ ] Questions box is honest, not decoration; closing section after the body does not repeat a sales pitch.

## Tags and the index

The blog index lists posts newest first (ties by slug). There is no tag filter: a filter that works without JavaScript would need a static page per tag, so tags are shown as labels and used for "Related posts" only. Revisit when there are enough posts for tag pages to be useful.
