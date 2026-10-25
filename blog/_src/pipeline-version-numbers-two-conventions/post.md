---
title: When should a pipeline get a new version number?
description: Two published versioning conventions for pipelines, from nf-core and BALSAMIC, side by side. Where they differ is an open question, and we do not pick a winner.
slug: pipeline-version-numbers-two-conventions
date: 2026-10-19
updated: 2026-10-19
tags: versioning, nextflow, provenance
summary: Two published pipeline versioning conventions side by side, where they differ, and why we treat it as an open question.
image_alt: A wooden signpost with three arms pointing in different directions and a small tag dangling below the lowest arm on an orange dotted string.
---

A pipeline version number is a promise of a kind: it tells the next person how much to worry before they upgrade. Two published conventions, one from nf-core and one from the BALSAMIC project, both build on semantic versioning, yet on some changes they point in different directions. This post sets them side by side, and treats the difference as an open question rather than a verdict on either project.

## Why a number matters for a record

If you want to know how a result was made, the pipeline version is among the facts you reach for early. But a version string is only as informative as the rules behind it. "Version 2.0.0" means something to a reader only if they know what that project counts as a major change. So it is worth reading the rules before treating the number as evidence.

## Convention one: nf-core

The nf-core guidelines on semantic versioning describe major, minor and patch bumps this way.[^1]

- **Major** is for changes that are not backwards compatible and may require users to adjust existing workflows or configurations. The page lists renaming or deprecating a parameter, major alterations to existing output formats (it gives BAM to CRAM, or changed TSV header names) or directory structures, and upgrades to dependencies that introduce breaking changes.
- **Minor** is for backwards-compatible new features that do not alter existing functionality, including new output files or metrics without modifying existing ones.
- **Patch** is for minor changes that do not affect user interaction or existing functionality, for example updating the container build of a tool without changing the tool's version.

The page also says to classify a release by the highest applicable category, and that if in doubt, you should opt for a higher increment to clearly communicate the extent of changes to users.[^1]

## Convention two: BALSAMIC

The BALSAMIC documentation says the project follows Semantic Versioning, extended since 24 October 2018 to cover bioinformatic and data analysis aspects.[^2] Its list reads as follows.[^2]

- **Major**: structural changes to the workflow, which includes reordering annotation software or sources, variant callers, aligners and quality trimmers, and the addition of those components.
- **Minor**: under-the-hood changes to rules that will not affect the output results of the workflow, the addition of new bioinformatics tools for QC reporting, and updating the version of a bioinformatics software or data resource, including annotation sources.
- **Patch**: bug fixes and under-the-hood changes that will not impact an end user's run, and changes to resource allocation of scheduler job submission.

## Where they seem to differ

We lay out three cases and mark what each document says, and what it does not.

1. **A new output file.** nf-core lists new output files without modifying existing ones as minor.[^1] BALSAMIC's page, as we read it, does not mention output files directly; it speaks of changes that do or do not affect the output results.[^2] We do not know how the BALSAMIC project would label this case.
2. **Updating a tool.** nf-core treats upgrades to dependencies that introduce breaking changes as major, and a container rebuild with the same tool version as patch.[^1] BALSAMIC lists updating the version of a bioinformatic software as minor.[^2] They are not obviously in conflict: one looks at whether the upgrade breaks something, the other at the act of updating. But a reader comparing version numbers across the two projects could reasonably be misled, and we wonder how often that happens.
3. **An annotation source.** BALSAMIC says updating a data resource, including annotation sources, is minor, while adding or reordering annotation sources is major.[^2] The nf-core page we read does not mention annotation. A refreshed annotation database can change which variants are flagged, and neither page says how its authors would treat that.

So the honest summary is that the two documents ask different questions. nf-core's page is organised around compatibility for the user of the pipeline. BALSAMIC's is organised around the structure of the workflow and whether its outputs change. We would not say either is wrong; they seem to be written for different purposes.

## One forum thread

In May and June 2026, someone working on nf-core/pacvar asked on the Seqera community forum whether the release after 1.0.1 should be 1.1.0 or 2.0.0, after several modules had been added. One reply pointed to the nf-core semantic versioning documentation and, based solely on the details shared, saw no breaking changes and suggested 1.1.0.[^3] We do not know what they chose. This is a single forum thread, and nothing above depends on it; we include it only because it shows that even within one convention, people ask.

## What to write down either way

Whatever rule a project follows, a few things seem useful to a later reader:

- The version actually run, not the version you meant to run.
- The versions of the tools and the annotation or reference data in use, since a pipeline's own number may not move when they do.
- Which convention the pipeline follows, with a link, so the number can be read correctly.

An earlier Jubilab prototype recorded the pipeline version and the parameters of the runs it captured. It did not interpret version numbers or tell you whether a change was breaking. Jubilab's earlier run-record prototype is not being offered. Jubilab is now building the order-to-result layer for lab work, which is in design and not released. Our guide on [Nextflow provenance and lineage compared](/guides/nextflow-provenance-and-lineage-compared/) covers what the engines themselves record. Jubilab is not affiliated with or endorsed by nf-core, BALSAMIC, Seqera or Nextflow, and this post does not rate either convention.

## Questions we are still asking

- Should a version number reflect compatibility for users, a change in outputs, or both? The two pages we read lean different ways.
- Should a refreshed annotation database ever count as a major change, given that it can alter what a pipeline reports? Neither page tells us how its authors would answer.
- How would the BALSAMIC project classify a new output file? We could not find it addressed on the page.
- Does a reader comparing version numbers across projects get misled in practice? We have no evidence either way.
- We read the nf-core guideline page and the BALSAMIC page but not their release histories, so we do not know how closely releases follow the written rules.

## Sources

- [Semantic versioning (nf-core pipeline guidelines)](https://nf-co.re/docs/guidelines/pipelines/requirements/semantic_versioning) | nf-core project | Accessed: 2026-10-19
- [BALSAMIC: Semantic versioning](https://balsamic.readthedocs.io/en/stable/semver.html) | BALSAMIC project, Read the Docs | Accessed: 2026-10-19
- [Versioning question for the nf-core pacvar release](https://community.seqera.io/t/versioning-question-for-the-nf-core-pacvar-release/2690) | Seqera community forum | Accessed: 2026-10-19
