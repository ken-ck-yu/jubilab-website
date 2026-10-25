> SUPERSEDED 2026-10-25: this spec describes the retired provenance-product hero (screenshot frame). The frame, tokens and layout rules still apply; the content does not. See the pivot brief.

# Jubilab website v2.1: hero product visual (UXD spec)

Status: draft, 2026-10-15, UXD. Not reviewed by the owner. Amends `design-spec-v2.md` (kept in the sibling repo `jubilab-website`, branch `site-v1`) for the hero visual only. Website only. Builds on the 37 passing checks in `review/check-site.py`.

## 1. What is wrong now (measured on the running v2 preview, Playwright, 2026-10-15)

| Viewport | Image box | Share of viewport | Notes |
|---|---|---|---|
| 390 | 316x253 at x16, y625 | 81% | text column is 358 wide; image does not use it |
| 768 | 636x318 | 83% | |
| 1280 | 589x295 | 46% | text column 483, image column 589 |
| 1440 | 600x300 | 42% | text 472 px, so the 3-line H1 sets the row; image is a strip |

Source files: `hero.webp` 674x336 and `hero-2x.webp` 1348x672 (ratio 2.0, shows only the graph card strip), `hero-narrow.webp` 316x253, `hero-narrow-2x.webp` 632x506. The pins 1, 2, 3 are absolutely positioned percentages on top of the image. The caption sits under the image in 14 px grey.

Page height at 1440 is 4445 px, close to the lower bound of check 12 (4400). Making the hero taller will not break it.

## 2. Research: how other sites show the product (rendered, not recalled)

Method: I loaded each homepage in headless Chromium (1440x900 and 390x844, 3.5 s settle, scrolled the first 2400 px), measured the largest `img`, `video`, `canvas`, `svg`, `iframe` and read `autoplay`, `loop`, `muted`, `poster`, border, radius and shadow from computed styles, and looked at a 1440 fold screenshot of 12 of them. Fetch date for all rows: 2026-10-15. Third-party screenshots are in my scratchpad only, not in any repository. WebSearch returned only generic hero-design blogs, nothing citable about a specific site, so every number below comes from the live pages. Page URLs: linear.app, vercel.com, supabase.com, modal.com, replicate.com, hex.tech, dagster.io, temporal.io, cursor.com, anthropic.com, resend.com, raycast.com (homepages, root path), mastra.ai, hatchet.run, kernel.sh, conductor.build, tamarind.bio, labric.co, reducto.ai, mlop.ai, circleback.ai, posthog.com.

What I could not see: video content (only the element and its attributes), hover or scroll behaviour (no pointer, no scroll-linked effects verified), anything behind cookie banners (Cursor, Dagster, Hex, Tamarind had one over the fold), Weights & Biases (wandb.ai returned no measurable media in my run), Temporal and Anthropic mobile (no media found). "Width" is the element box, which can be wider than the visible UI when the image fades or is cut by the fold.

| Site | Hero visual and size (1440) | Placement | Framing | Motion |
|---|---|---|---|---|
| Linear | product UI image, element 1440x804, UI visible about 90% | below headline, top at y491, cut by the fold | no chrome, dark UI, soft fade at the bottom edge | static `img` (desktop) |
| Cursor | 1300x720 (90%, 70 px each side), 16:9 | below headline and buttons, top y351 | OS-window mock (traffic lights) on a painted wallpaper, radius 4 | static; **mobile gets a portrait 353x720 crop** (art directed) |
| Conductor (YC) | 1366x883 (95%) | below, top y519 | app window with traffic lights inside the picture, radius 12, sky background | static; 348x225 (89%) at 390 |
| Tamarind (YC) | video 1384x559 (96%, 28 px margins) | below, top y563 | radius, no border | `loop muted`, no `autoplay` attribute (started by script, not verified), no poster; 342x231 at 390 |
| Circleback (YC) | live demo iframe 1216x720 (84%) | below, top y599 | 1px border, radius 12, inset highlight, tinted backdrop | interactive embedded demo, scaled from 1280x758 |
| MLOP (YC) | 1168x658 (81%), 16:9 | below the fold, top y957 | 1px border, radius 12, shadow | static |
| Dagster | illustrated UI 944x603 (66%) plus a 522 wide side card | below, top y672, rises from the fold | 8 px dark border, rounded top only, cut at bottom | static SVG |
| Supabase | table-editor video 1070x602 (74%), 16:9 | lower, y1969 (hero is text plus cards) | 1px border, radius 10.7 | `autoplay loop muted` with `poster`; **at 390 a poster image with class `reduce-motion:block` is shown beside the video**, i.e. a static swap |
| Labric (YC) | video 644x676 (45%) | right column beside text, top y96 | radius 24 on a painted backdrop | `autoplay loop muted poster`; at 390 becomes 358x376 under the text |
| PostHog | 777x631 (54%), flush right | beside text | none (OS-desktop metaphor) | interactive |
| Raycast | hero is an abstract canvas; real screenshots 1300x733 (90%) from y1537 | below | 1px translucent border, radius 12, light inner glow shadow | static; 100% wide at 390 |
| Hex | hero is an illustration canvas; product SVG 1368x585 (95%) | below, y819 | none | static |
| Reducto (YC) | clip 592x333 (41%) with native controls, `autoplay` off, 16:9, 1px border, radius 16; second section loop 749x560 `autoplay loop muted` | beside copy | border, radius | user-started, plus muted loop |
| Vercel, Modal, Replicate, Anthropic, Resend | hero is atmosphere: WebGL or canvas (Vercel 837 px), full-viewport canvas (Modal), muted looping mp4 at 110% width without poster (Replicate), painted art (Anthropic 776x221), backdrop images (Resend) | behind or around the text | none | looped or generative |

Counts, stated honestly (N is small and hand-picked; no conversion data):
- Of the 9 sites whose hero is a product UI (Linear, Cursor, Conductor, Tamarind, Circleback, MLOP, Dagster, Labric, PostHog): **7 stack it below the text, 2 put it beside it** (Labric, PostHog). The seven stacked ones are 66 to 96% of the viewport wide, median about 90%, with 28 to 188 px side margins. The two side-by-side ones are 45 and 54%. **None is as narrow as our 42%.**
- Top of the visual sits at y351 to y672, median about y560: the headline and buttons fill the first 60% of the fold and the visual starts there and is cut by the fold. That is the design intent, not a failure.
- Frame: radius 4 to 16 (most 10 to 12), 1px hairline border at 6 of 9, a soft shadow at only 2, a drawn window frame (traffic lights) at 3 (inside the image, not CSS). No coloured glow on a product UI in any of the 9; glow and gradients belong to the atmosphere heroes (Vercel, Replicate, Raycast).
- Motion: all video is `muted`, all loops; 2 of 4 have a poster; none had audio controls; Supabase swaps to a poster under reduced motion. Static screenshots are still the majority (6 of 9).
- Mobile: every site keeps its visual inside the screen at 80 to 100% width, no sideways scroll box. Cursor art-directs a different crop for phones.
- Captions: in the fold captures I viewed I saw no explanatory caption under any hero visual. Not proof for all 22 sites.

## 3. Layout options (frame = the visual plus its chrome; container content box is 1120 px wide from 1280 up, text starts at x80 at 1280 and x160 at 1440)

| | A. Side by side, bigger | B. Stacked, full container width (recommended) | C. Stacked, breaks out of the text column |
|---|---|---|---|
| 390 | 358x269 (4:3 crop) | 358x269 (4:3 crop) | 358x269 |
| 768 | 720x405 below text | 720x405 | 720x405 |
| 1024 | 944 stacked; side by side would squeeze the H1 | 944x531 | 944x531 |
| 1280 | 640x360 beside text (text 440) | 1120x630 | 1120x630 |
| 1440 | 720x405 (50%) | 1120x630 (78% of viewport) | 1240x698 (86%, 60 px outside the text column each side) |
| 1920 | 720x405 (38%) | 1120x630 (58%) | 1240x698 (65%) |
| Fold at 1440x900 | text and image both fully in view | text ends about y510, frame top about y560, 340 px (54%) of the media visible | same, 49% visible |
| Pros | keeps today's composition | matches 7 of 9 product-hero sites, H1 can be 2 lines, 16:9 fits a video, legible UI text | most dramatic |
| Cons | only 1.2x larger than today, ignores the owner's "larger"; shrinks at 1920 | page about 650 px taller | the owner's v1 complaint was an image 96 px past the container; C repeats the pattern, only milder |

**Recommendation: B.** Hero text becomes a single left-aligned block (max 760 px wide for H1 and lede, 52ch lede as now) with the eyebrow and the "Invite-only early access" chip inline on one row; the frame follows under the CTAs and trust line with a 48 px gap (32 px at 390). Frame edges equal the text column's outer edges at every width, so it never leaves the container (the v1 failure). C stays a later dial: if the owner wants more, raise the 1440+ width to at most 1240 and keep at least 64 px to the viewport edge; do not go beyond that.

## 4. Frame, image and the files the engineer must recapture

Frame, built in CSS so a video can drop in:

```
<figure class="hero-shot">                      no figcaption
  <div class="frame">                           1px border var(--border), radius 12, soft shadow, mat background
    <div class="frame-bar" aria-hidden="true">  32 px bar: 3 dots 10 px; optional 12 px label (section 5)
    <div class="frame-media">                   aspect-ratio 16/9 (4/3 at max-width 640), overflow hidden, bg skeleton colour
      <picture> ...<img width="1120" height="630" fetchpriority="high"> </picture>
      <!-- later: <video poster="same file as img"> goes here, same box, object-fit cover -->
```

Rules: no filter or blend on the image; no border on the `img` itself (the frame owns the border and radius); shadow `0 1px 2px` plus `0 12px 32px -8px` at about 10% ink in light; in dark theme the product UI stays unaltered on its existing light mat (as now) with a 1px border at least 3:1 against the page background, and no coloured glow. The `img` has no `loading=lazy` (it is the LCP element).

**Recapture from the demo project (Cohort A, synthetic):**
1. Wide master: the Project lineage page with the graph and the detail panel for `variants_run002.vcf` open, so the frame shows the product, not a strip. Browser window 1280x720 CSS px, device scale factor 2 (capture 2560x1440), light theme, no browser UI, no cursor, no username, path, email or hostname visible. Export four widths of the same capture: 720, 1120, 1440 and 2240 px wide (ratio 16:9), WebP. Because the capture window is 1280 px and the frame is 1120, UI text is displayed at 0.875 of its real size (a 13 px label shows at about 11.4 px). Do not capture at a larger window: text would drop below 10 px.
2. Narrow crop for 640 px and below: a 358x269 CSS-px region (4:3) of the same UI at 1:1 scale showing the "Connected to" card for Run 002, as today's narrow image does. Capture at dsf 2 (716x538) and export 358 and 716 px wide.
3. Nothing may be edited, redrawn or tidied in the image. Recapture is a screenshot, not a mock-up. The engineer logs the app version and capture date in the commit message.
4. Budgets: 720w up to 50 KB, 1120w up to 90 KB, 1440w up to 130 KB, 2240w up to 220 KB, narrow 358 up to 30 KB, narrow 716 up to 60 KB.
5. Markup: `srcset` with width descriptors and `sizes="(min-width: 1280px) 1120px, (min-width: 641px) calc(100vw - 48px), calc(100vw - 32px)"`, narrow files in a `<source media="(max-width: 640px)">`. Replace the old four files; delete the pins and their inline `style` positions.

## 5. Caption and the 1-2-3 pins (owner decision applied)

- **Remove the `figcaption` completely.** No visible sentence about "a real screen", "cropped", or numbers.
- **Remove the pins 1, 2, 3.** The graph already explains itself: node-type chips (DATA ASSET, RUN, OUTPUT) and edge labels ("used as input", "generated") are inside the screenshot. The 1-2-3 story (input stays where it lives, the run, the output you opened) already exists as text in the "how it works" section; do not repeat it in the hero.
- **Honesty, in three places the owner did not object to:** (1) the `alt` text keeps "Real screen from the demo project Cohort A (synthetic data)"; (2) the hero trust line keeps "Demo data is synthetic." directly above the frame; (3) the footer keeps "synthetic demo data" (check 37). The project name "Cohort A" is visible in the product UI itself.
- **Optional, owner choice:** the 32 px chrome bar may carry the 12 px label "Demo project" in the same muted ink, as a window title. It reads as part of the window, not a caption. Default in the build: dots only, no label. Never write "customer", "your data" or a user name there.
- The mobile narrow crop uses the same rule (no caption, same alt idea with "Run 002 detail").

## 6. Interaction, now (cheap, accessible, no JS)

Ship **only a CSS hover lift**: on `@media (hover: hover) and (prefers-reduced-motion: no-preference)` the frame moves up 2 px and the large shadow deepens, transition 200 ms or shorter. Under `reduce` there is no transform and no transition (current check 33 stays true). The frame is not focusable, has no `tabindex`, no link, no handler, so the keyboard order (check 27) is unchanged, and it looks identical with JS off.

Considered and not recommended now: step-through tabs or three highlight overlays (needs JS or radio-button hacks, and the numbered meaning was just dropped), a scroll-driven tilt with `animation-timeline` (inconsistent support, and check 33 forbids animations at load), a live iframe like Circleback (needs a hosted demo and an outbound request; conflicts with check 35). The real interactive feel will come from the video.

## 7. Video-ready (later) without a redesign

- Same `.frame-media` box, 16:9, so poster, image and video share one aspect; no layout shift when the video arrives (check 36 stays at 0.02).
- Video spec: 1920x1080 master, 8 to 20 s seamless loop, under 1.5 MB WebM (VP9 or AV1) with an H.264 MP4 fallback, **audio track stripped from the file** (not just muted), `muted loop playsinline preload="metadata"`, `poster` = the same file as the hero image (1120 or 1440 width).
- No `autoplay` attribute in HTML. A script under 1 KB starts it only when `matchMedia('(prefers-reduced-motion: reduce)')` is false, `navigator.connection.saveData` is not true, and it is in view; it pauses when out of view. Without JS or under reduced motion the poster (the real screenshot) stays.
- WCAG 2.2.2: a 44x44 px pause/play button inside the frame (bottom right, `aria-pressed`, visible focus ring), since the loop runs over 5 s. This is the only interactive control added and only when the video exists.
- At 640 px and below: poster only (narrow crop), no video download. No captions needed (no speech); `aria-label` on the video repeats the alt text.
- JS budget: check 34 allows 6000 B of JS in total; the player script must fit the remainder or the budget is raised by the Manager.

## 8. Acceptance checks

**Existing checks that must change** (numbers from `check-site.py`):

| Check | Today | Change |
|---|---|---|
| 4 | image inside container, right gap at least 24 at 1024+ | apply to `.frame` at all widths: left and right within 1 px of the hero text column edges; gap to viewport at least 16 (390) and 24 (others) |
| 5 | width at most min(600, 0.46 vw), height at most 420, ratio 1.33 to 2.1 | **replace** with N2 and N3 below |
| 6 | 768: at most 720x320; 390: at most 350x260 | **replace**: 768 media 720x405 (+-2); 390 media 358x269 (+-2), top at most 760 |
| 7 | h1, lede, CTA bottom at most 900 at 1440; at least 40% of image visible | keep, and add: CTA bottom at most 700 at 1440; media at least 40% visible at 1440x900 |
| 8 | scale at least 0.85 from 1150 px; 2x file at dpr 2 | **replace** with N4 (no upscaling, correct file at dpr 1 and 2) |
| 9 | 1x file at most 60 KB, 2x at most 120 KB, alt 40 to 250, `fetchpriority=high`, other imgs lazy, at 1440 image bytes at most 100 KB | new per-file budgets from section 4; keep alt, fetchpriority, lazy rules; 1440 dpr 1 image bytes stay at most 100 KB; `width`/`height` attributes ratio 16:9 |
| 10 | image border 1px, `figcaption` contains "synthetic", filter none | border and radius on `.frame`, none on `img`; filter and blend none; **no `figcaption`**; "synthetic" required in alt and in the hero trust line instead |
| 12 | hero at most 760 at 1440; page 4400 to 6200 | hero at most 1320 at 1440, page 4400 to 7000; 390 page at most 8000 stays |
| 21 | h1 lines at 1280 at most 3 | keep; expect 2 |
| 32 | mat plus image at most 650x450 at 1440 | frame at most 1122x(630+32+2) at 1440; at most 1240 wide anywhere |
| 33 | animations at load 0; transitions at most 0.2 s | keep; add hover on `.frame` under `reduce` produces no transform change |
| 34 | total at most 250 KB uncompressed at 1440 | raise to 320 KB (the 1120w image is up to 90 KB); fonts, JS, HTML, CSS limits unchanged |
| 3, 27, 35, 36, 37, 19 | | unchanged; 37 still needs "synthetic demo data" in the footer; 19 also scans the alt text |

**New checks** (add to `MEASURE` and the evaluator):
- N1 No caption: `.hero-shot figcaption` absent; no `.pin` elements; page text lacks "A real screen" and "An input that stays where it lives"; hero text contains "Demo data is synthetic".
- N2 Width: media width at 390 358 (+-2); 768 720; 1024 944; 1280, 1440, 1920 1120 (+-2); at 1440 at least 75% of viewport; never more than 1240.
- N3 Ratio: `.frame-media` w/h 1.777 (+-0.02) above 640 px, 1.333 (+-0.02) at 640 and below; `img` (and any later `video`) fills the box exactly.
- N4 Sharpness: at dpr 1 `naturalWidth` of the chosen file at least the displayed width; at dpr 2 at least 1.9x; never displayed larger than natural width (+1%).
- N5 Chrome: `.frame-bar` has `aria-hidden=true`, height 32 (+-2), no focusable child; if a label exists its text is at least 12 px and passes the contrast check.
- N6 No scroll region and no overflow at all widths (checks 1 to 3 already do this; add `.frame` and `.frame-media` explicitly, `overflow-x` not auto or scroll).
- N7 Dark theme: frame border contrast at least 3:1 against page background; screenshot at 1440 dark shows the mat and no tinted filter.
- N8 Hover: after hover at 1440, frame translateY at most 3 px and transition duration at most 0.2 s; under `reduce` both zero. Frame has no `tabindex`; Tab sequence unchanged (check 27).
- N9 JS off: frame renders and size equals JS on.
- N10 (when video lands) video: no `autoplay` attribute, `muted`, `loop`, `playsinline`, `poster` present and equal to the hero image URL, no audio track (`audioTracks` or file inspection), 16:9, plays only when reduce is false, pause button at least 44x44 with an accessible name, nothing loaded at 640 and below, file at most 1.5 MB.
- N11 Fold: at 1440x900 the first screenshot shows H1, lede, both CTAs and at least 40% of the media; at 390x844 shows H1, primary CTA and the top of the frame or trust line (visual review).

## 9. Risks

- UI text is smaller at 1120 than the old 600 px strip was relative to the UI: at 0.875 it is readable, but if the recapture uses a bigger window it will not be. The capture size rule is mandatory.
- A 16:9 full-page capture may show UI the owner does not want public (other projects, menu items, empty states). The engineer must show the capture to the Manager before building.
- Stacked layout moves the form of the first screen: the hero image no longer sits beside the H1; the text block needs a clean two-line H1 at 1280 and 1440 or the CTA drops. Measure after the change.
- Heavier page: about 90 KB more on the first load at 1x. Mitigated by width-based `srcset` and no lazy loading on the LCP image; check 34 budget changes are a decision for the Manager.
- Honesty rests on the alt text, the trust line and the footer, not on a caption. If the owner also removes the trust line, a minimal in-frame label ("Demo project") is the fallback; do not drop all three.
- Research is a small hand-picked sample, one load per site, from one machine; widths are element boxes. It shows what peers do, not what converts.

## Board updates

- T-037: iteration 2 spec delivered (`docs/design-spec-v2.1.md`), awaiting Manager reconciliation, then Engineer brief. Owner decision pending: stacked layout B (recommended) versus a side-by-side A or breakout C; optional "Demo project" label in the frame bar.
- New sub-tasks: Engineer recapture of the demo screens (wide master 1280x720 at dsf 2 and a 4:3 narrow crop), new `srcset` files, frame markup and CSS, removal of pins and figcaption; Validator updates `check-site.py` (changed checks 4, 5, 6, 7, 8, 9, 10, 12, 32, 33, 34; new N1 to N11).
- Deferred task: demo video (16:9, 8 to 20 s, silent file, WebM plus MP4, poster = hero image), after the owner approves the storyboard.

## What other agents need to know

- Manager: the first screen becomes text, then the frame (about 650 px taller hero). Decide the check 34 budget (320 KB) and check 12 cap (hero 1320, page 7000). The owner removed the visible caption; honesty now lives in alt, the trust line and the footer. Do not add a caption back.
- PCD: no hero caption copy is needed. The 1-2-3 story stays only in "how it works". If you want a short frame label, it is at most "Demo project".
- Engineer: do not touch site code until the Manager issues the brief. Capture rules in section 4 are mandatory (no editing, no personal data, 1280x720 at dsf 2). Pins and `figcaption` are deleted, not hidden. Keep the image out of lazy loading. Build the frame exactly as in section 4 so the video can replace the `img` only.
- Validator: run the changed and new checks at 390, 768, 1024, 1280, 1440, 1920, light and dark, and with JS off; check by eye that UI text in the 1440 screenshot is readable (no more than 0.875 scale). Your own review of sizes: nothing may exceed the container (the v1 failure).
- Scratch evidence: `/tmp/claude-1000/-home-ken-biligene-Jubilab/a8f56e91-e75e-4ea7-b458-92d16cd6103a/scratchpad/` (`crawl.json`, `x_<site>.png`, `cur_<width>.png`); third-party images stay out of every repository.
