# Image credits and licence log

Accessed 2026-10-17 by the Image Researcher. Originals were downloaded to a scratch directory outside the repo; only the cropped WebP exports are in `assets/img/`. All exports are 16:9 (1600x900 and 800x450), WebP, no EXIF/XMP/GPS/ICC data (checked with Pillow). Not committed.

Licence texts actually read:

- Unsplash License, https://unsplash.com/license : "All images can be downloaded and used for free"; "Commercial and non-commercial purposes"; "No permission needed (though attribution is appreciated!)"; long form: "including for commercial purposes, without permission from or attributing the photographer or Unsplash". Restrictions: "Images cannot be sold without significant modification" and no compiling images to replicate a competing service. Each photo page below states "Free to use under the Unsplash License" and shows "Download free" (not Unsplash+).
- Wikimedia Commons file page metadata (read via the Commons API): licence "Public domain" (PD US NIH, CC-PD-Mark), AttributionRequired false, "Reuse Restrictions: None - This image is in the public domain and can be freely reused. Please credit the source and/or author listed above." Credit is requested, not required; it is given here anyway.

Notes that apply to all Unsplash items: Unsplash does not grant model or property releases. Items with people are flagged. No attribution is legally required; crediting on a site "Credits" page is optional and appreciated.

Direct download URL pattern for Unsplash: `https://images.unsplash.com/photo-<id>?fm=jpg&q=85&w=2400&fit=max` (the `<id>` is given per item).

---

## 1. card-trace (files: card-trace-1600.webp, card-trace-800.webp)

- Source page: https://unsplash.com/photos/cmrcu5Gb9ko
- Direct download: https://images.unsplash.com/photo-1719948397945-eb7fb043832d
- Creator: Alex Pudov (@a_pudov); published 2024-07-02
- Licence: Unsplash License (https://unsplash.com/license), free, not Unsplash+
- Shows: a dark metal chain running diagonally across a blurred green foliage background (a connected chain / trail).
- Modifications: cropped 3:2 to 16:9 (centre), resized, converted to WebP q80, metadata removed.
- Alt text: "A metal chain stretching diagonally across a blurred green background, each link connected to the next."
- Risk: none (no people, no text or logos). It is a metaphor, not lab equipment.
- Fallback: `fb-trace2` (https://unsplash.com/photos/a9X7rBh-A5Y, direct https://images.unsplash.com/photo-1627312846352-b967c34030ed, photographer Edrin Spahiu, 2021-07-26, grayscale chain links). Export: `scratchpad/imgwork/out/fb-trace2-1600.webp`. Second fallback: nothing else verified.

## 2. card-compare (files: card-compare-1600.webp, card-compare-800.webp)

- Source page: https://commons.wikimedia.org/wiki/File:DNA_sequencing.jpg
- Direct download: https://upload.wikimedia.org/wikipedia/commons/c/c9/DNA_sequencing.jpg
- Creator: Linda Bartlett (photographer), National Cancer Institute / NIH, circa 1980 (NCI Visuals Online)
- Licence: Public domain (US federal government work, "PD US NIH"). Quote: "This image is in the public domain and can be freely reused."
- Shows: two scientists at a light box reading several DNA sequencing gel autoradiographs side by side, one pointing at a lane with a marker.
- Modifications: cropped 3:2 to 16:9 (centre); a small area on the light-box frame carrying the maker's name ("Picker") was blurred; resized, WebP q80, metadata removed.
- Alt text: "Two scientists comparing DNA sequencing gel films on a light box, one pointing to a band pattern."
- Risk: identifiable real people (1980 NCI staff photo; US government work, no release stated but public domain). The 1980s look (clothes, phone) may feel dated for a modern product. Gel films show only band patterns, no patient data.
- Fallback: `fb-compare2` (see vision-agent below: two monitors side by side), exported at `scratchpad/imgwork/out/fb-compare2-1600.webp`. Wikimedia CC0 alternative not exported: https://commons.wikimedia.org/wiki/File:Agarose_gel_electrophoresis_of_DNA.png (CC0, portrait diagram-like gel, poor 16:9 fit).

## 3. card-connect (files: card-connect-1600.webp, card-connect-800.webp)

- Source page: https://unsplash.com/photos/QHBtGNo580Y
- Direct download: https://images.unsplash.com/photo-1748263582756-082fe4adaa5b
- Creator: Nathan Rimoux (@nathan_rmx); published 2025-05-26
- Licence: Unsplash License, free
- Shows: rows of 1.5 mL microcentrifuge tubes in a green rack, each cap hand-labelled in blue pen, shallow depth of field.
- Modifications: cropped 3:2 to 16:9 (slightly below centre), resized, WebP q80, metadata removed.
- Alt text: "Rows of labelled sample tubes in a green laboratory rack."
- Risk: none. Handwritten labels are illegible (no readable sample IDs).
- Fallback: `fb-connect2` (Testalize.me, https://unsplash.com/photos/0jE8ynV4mis, direct https://images.unsplash.com/photo-1606206591513-adbfbdd7a177, 2020-11-24, racks of colour-capped blood-collection tubes). Export: `scratchpad/imgwork/out/fb-connect2-1600.webp`. Risk: tube barcodes visible but not readable.

## 4. card-catch (files: card-catch-1600.webp, card-catch-800.webp)

- Source page: https://unsplash.com/photos/JcsYP0IJvnI
- Direct download: https://images.unsplash.com/photo-1634872583967-6417a8638a59
- Creator: Eka P. Amdela (@amdela); published 2021-10-22 (Indonesia)
- Licence: Unsplash License, free
- Shows: a blue-gloved hand holding a red rack with about 40 tubes in an irregular pattern and many empty wells (an uneven rack, suggests a missing/misplaced sample).
- Modifications: cropped 3:2 to 16:9 (centre), resized, WebP q80, metadata removed.
- Alt text: "A gloved hand holds a tube rack with samples in some wells and others empty."
- Risk: none (no face, no logos). It does not show a single odd-one-out sample; it fits "catch" only loosely.
- Fallback: `fb-catch2` (Daniel Dan, https://unsplash.com/photos/yJn0zZdFIwU, direct https://images.unsplash.com/photo-1655210913810-33acfa96d1e6, 2022-06-14, rack of purple-cap blood tubes beside an analyser). Export: `scratchpad/imgwork/out/fb-catch2-1600.webp`. Risk: small barcodes on tubes, not readable.

## 5. vision-agent (files: vision-agent-1600.webp, vision-agent-800.webp)

- Source page: https://unsplash.com/photos/scientist-points-to-microscopic-view-on-computer-screen-RAcNSUPk3b4
- Direct download: https://images.unsplash.com/photo-1766297248160-87aca6fa59ef
- Creator: Chidera Faustina Okeke (@thefourthwxll); published 2025-12-21
- Licence: Unsplash License, free
- Shows: a researcher in a lab coat and gloves (face not visible, seen from behind) pointing at two side-by-side monitors showing grey electron-microscope images.
- Modifications: cropped 3:2 to 16:9 (top-aligned), the monitor maker's name on the bezel ("Philips") was blurred; resized, WebP q80, metadata removed.
- Alt text: "A researcher in a lab coat points at microscope images on two computer screens."
- Risk: the screens show materials/SEM imagery, not genomics, and carry small instrument overlay text (such as "10kV", "WD9mm"), not a brand. Person is anonymous (no face) but no release is stated. Taken in Cyprus. The monitor model number "220VW" at the top-left bezel is still faintly visible (tiny, not a brand name).
- Fallback: `fb-compare2` is the same photo; second fallback `who-biotech` photo (see item 6) could serve if rejected.

## 6. who-biotech (files: who-biotech-1600.webp, who-biotech-800.webp)

- Source page: https://unsplash.com/photos/two-scientists-working-on-computers-in-a-laboratory-XLQuTdktpa8
- Direct download: https://images.unsplash.com/photo-1766297247924-6638d54e7c89
- Creator: Chidera Faustina Okeke (@thefourthwxll); published 2025-12-21 (Cyprus)
- Licence: Unsplash License, free
- Shows: two scientists in white lab coats and blue gloves at a bench, one at a gel-imaging cabinet, the other at a desktop computer whose screen shows a gel image.
- Modifications: cropped 3:2 to 16:9 (upper-weighted), the monitor maker's name on the bezel ("LG") was blurred; resized, WebP q80, metadata removed.
- Alt text: "Two scientists in lab coats working at a laboratory bench and computer."
- Risk: two identifiable-ish people (faces turned away or in profile; no model release stated). It shows a wet-lab imaging station more than a "computational" team; it is the closest free, licensed match found. An instrument nameplate on the imager is too small to read; an orange reagent box at the top shows no readable text.
- Fallback: `fb-biotech2` (same photographer, https://unsplash.com/photos/04Heap-T7A4, direct https://images.unsplash.com/photo-1766297248122-5957c51b1f7c, two women examining a sample, portrait source; faces clearly visible). Export: `scratchpad/imgwork/out/fb-biotech2-1600.webp`. Weaker fit (no computers focus).

## 7. who-core (files: who-core-1600.webp, who-core-800.webp)

- Source page: https://unsplash.com/photos/to8o0bqOA6Q
- Direct download: https://images.unsplash.com/photo-1578496479530-799fd6d0803a
- Creator: National Cancer Institute (@nci, uploader; no individual named); published 2020-01-08. The page describes it as automated liquid-handling robots used for high-throughput DNA processing at the NCI Cancer Genomics Research Laboratory (a genomics core-type lab). US government work.
- Licence: Unsplash License, free
- Shows: close-up of a multichannel liquid-handler head with rows of pipette tips over a 384-well plate carrier.
- Modifications: cropped 3:2 to 16:9 (centre), resized, WebP q80, metadata removed.
- Alt text: "A liquid-handling robot with rows of pipette tips processing DNA samples in a genomics laboratory."
- Risk: none (no people, no readable brand). Macro close-up, so it reads as "lab automation" rather than a wide "core facility" or sequencer; confidence is moderate. No readable text in the final frame.
- Fallbacks not exported: https://unsplash.com/photos/x2kpecIdh5Y (Navy Medicine, 2026-07-21, person in PPE loading a sample into a PCR instrument; portrait, instrument maker's logo likely visible, person identifiable by uniform, so not preferred). No free wide-shot sequencer photo with a clean licence was found. Wikimedia candidate https://commons.wikimedia.org/wiki/File:CFSAN_Labs_6941_(8755582740).jpg (public domain, FDA, a technician loading a benchtop sequencer, portrait orientation, instrument maker's branding probably visible) not chosen because of portrait crop and probable branding.

---

## Rejected or not used

- Unsplash+ (Getty Images) lab photos, which need a subscription: not used.
- Brecht Corbeel 3D "neural network" renders on Unsplash: probably AI/CGI imagery; avoided per the rule on fake-science imagery.
- Wikimedia CC BY / CC BY-SA images (many good bench photos): need attribution and share-alike; avoided.
- Pexels and Pixabay: search pages return HTTP 403 to curl in this environment, so none were used or verified.
- Nothing was taken from Google Images, paid stock, or company marketing pages.
