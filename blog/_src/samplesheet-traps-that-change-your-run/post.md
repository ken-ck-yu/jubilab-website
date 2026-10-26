---
title: Samplesheet traps that quietly change your run
description: A samplesheet is an input like any other. Five ways a small CSV file goes wrong in Nextflow pipelines, and what we wonder about keeping each sheet with its run.
slug: samplesheet-traps-that-change-your-run
date: 2026-10-19
updated: 2026-10-19
tags: nextflow, samplesheets, provenance
summary: A samplesheet is an input like any other. Five ways a small CSV goes wrong, and what to keep with the run.
image_alt: A spreadsheet grid on a pale background with one cell holding a small ghost, and an orange dotted line leading from the grid to a small stack of pages.
---

Nextflow pipelines commonly start from a small CSV file: one row per sample, a few columns, and paths to the reads. It looks like configuration, so it may be edited by hand, in a spreadsheet, and then forgotten. This post collects a few ways that file can go wrong, some loudly and some quietly, and asks what it would mean to treat the samplesheet as an input that deserves a record.

## Why the sheet deserves attention

A pipeline can only process what the samplesheet tells it about. If a row is missing, mistyped or points at the wrong file, the pipeline may stop with an error, which is the good case. The bad case is a run that finishes happily with a different set of inputs than you meant. The results file may carry no sign of it.

We have not measured how often this happens, and we do not know. What we can do is read what pipeline maintainers and platform documentation say about the failures they have seen.

## Trap 1: the file that looks right but is not

A public issue on the nf-core/rnaseq repository shows the pattern. A user running version 3.3 got an error that compared two header lines that looked identical: the sheet header against the expected `sample,fastq_1,fastq_2,strandedness`.[^1] The reporter wrote that it was a bad CSV conversion from Excel, and fixed it by saving the file as UTF-8 without a byte order mark (an invisible marker some programs add at the start of a file), with Unix line endings instead of Windows ones.[^1] A maintainer replied that it had come up a few times but was difficult to test and reproduce, and a fix was merged and the issue closed in October 2021.[^1] We do not know whether current releases are affected.

That is one report about one pipeline version, and we cannot say how common it is. It is a useful illustration, though: characters that you cannot see in a spreadsheet can change what a program reads. If you open a CSV in a spreadsheet application and save it again, it is worth asking what the application changed.

If you want to check a file yourself, standard tools such as `file` and `head -c 3 samplesheet.csv | xxd` show line endings and a leading byte order mark. We did not run these against a pipeline for this post, so treat them as general shell tips rather than a tested recipe.

## Trap 2: paths that almost match

The nf-core troubleshooting page has a short section on samplesheet path errors. It says that if the pipeline fails to find input files, you should verify that all file paths in the sheet are correct, and it calls trailing spaces at the end of file paths a common mistake.[^2]

Again, this tends to fail loudly: a missing file stops the run. The quieter variant is a path that exists but is the wrong one, for example a re-sequenced copy of a sample with a similar name. A pipeline cannot know which file you meant. We wonder whether this is where a record of the exact paths used, and ideally something that identifies the file contents, matters most.

## Trap 3: columns that mean different things in different versions

Samplesheet columns are part of a pipeline's interface, and interfaces change. A DNAnexus training page about CSV builder applets for nf-core pipelines notes that each applet is built for specific pipeline versions, and warns that if the pipeline is updated with changes to required columns, validation rules or accepted values, an applet still validating against the older schema may give unexpected errors or incorrect output.[^3] Its troubleshooting table names a sequence column for proteinfold v1.1.1 and an id column for v2.0.0; that comes from DNAnexus's applet table, and we did not check proteinfold's own documentation.[^3]

Note that this is a statement about that vendor's tooling and two named versions. We have not compared samplesheet formats across versions of other pipelines. It does suggest a habit: when you upgrade a pipeline, check the sheet format against the new version's documentation rather than assuming last year's file still means the same thing.

## Trap 4: extra columns that are silently ignored

The nf-schema plugin, which many Nextflow pipelines use to check inputs, describes a schema file for samplesheets. It says the keys in the schema must match the header text in the sheet, and that fields present in the sheet but not in the schema are ignored and produce a warning.[^4]

A warning is easy to miss in a long log. Imagine you add a column called `batch` to track sequencing runs, and the pipeline does not know it. The run succeeds, the column is ignored, and months later you recall that the sheet recorded something the results do not reflect. This is a hypothetical, but it shows why a successful exit code is weaker evidence than it feels like.

## Trap 5: the sheet that changed after the run

The most ordinary trap is that the sheet is edited after the run, to add a sample, fix a typo or rename a file. The results folder now contains outputs from a sheet that no longer exists. If the file lived on a laptop or in an email attachment, even the original may be gone.

## Checking the sheet before the run

There are tools that check a sheet before the pipeline spends hours on it. The nf-schema plugin parses a sheet against a schema and checks types, patterns and formats among other things.[^4] Separately, the Nextflow registry lists an nf-core module called `samplesheetparser/validate`; per its page it checks an Illumina `SampleSheet.csv` (the demultiplexing sheet, which is a different file from a pipeline's input sheet) for index, adapter and structural issues, and exits with an error if it finds any.[^5] We have not run either of them for this post.

Checking catches malformed input. It cannot tell you that a correctly formatted row describes the wrong sample.

## What a record of the sheet might add

If the sheet is an input, a record of the run would hold the sheet as it was at launch, or at least a fingerprint of it, next to the pipeline version and parameters. That would let you ask later: which sheet did this run use, and is it the one on disk now?

An earlier Jubilab prototype recorded Nextflow runs and let you trace a result back to the inputs and parameters of its run. We never settled how best to present a samplesheet's own contents. Jubilab does not check that a row describes the right sample. Jubilab's earlier run-record prototype is not being offered. Jubilab is now building the order-to-result layer for lab work. We are recruiting early adopters (request access and we invite small groups first), but the order layer is still being built and nothing is released yet. The guide on [what parameters produced a result](/guides/what-parameters-produced-this-result/) covers the wider idea of what a record should hold. Jubilab is not affiliated with or endorsed by nf-core, Nextflow, DNAnexus or Seqera.

## Questions we are still asking

- How often do silent samplesheet problems change a result in practice? We do not know and found no source that measures it.
- Should a pipeline refuse to run when a sheet has unknown columns, rather than warn? Different teams may reasonably disagree.
- Is it enough to keep a checksum of the sheet, or should a record keep a readable copy as well?
- When a sheet format changes between pipeline versions, how should a comparison of two runs show that the inputs were described differently?
- We did not test the byte order mark and line ending commands above against a real pipeline, and we could not confirm which other pipelines show the same Excel symptom.

## Sources

- [nf-core/rnaseq issue 705: samplesheet header error](https://github.com/nf-core/rnaseq/issues/705) | nf-core project, GitHub | Accessed: 2026-10-19
- [nf-core troubleshooting: running pipelines](https://nf-co.re/docs/running/troubleshooting) | nf-core project | Accessed: 2026-10-19
- [CSV builders for Nextflow pipelines: technical considerations](https://academy.dnanexus.com/public-datasets-on-the-dnanexus-platform/csv-builders-for-nextflow-pipelines/technical-considerations) | DNAnexus Academy | Accessed: 2026-10-19
- [nf-schema: sample sheet schema specification](https://nextflow-io.github.io/nf-schema/latest/nextflow_schema/sample_sheet_schema_specification/) | nf-schema plugin documentation | Accessed: 2026-10-19
- [nf-core/samplesheetparser/validate module](https://registry.nextflow.io/modules/nf-core/samplesheetparser/validate) | Nextflow registry | Accessed: 2026-10-19
