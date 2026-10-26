---
title: Inherited a pipeline? A first-week checklist
description: A new colleague left, and you now own their analysis. A practical checklist for rebuilding how the results were made, and what to write down while you do.
slug: inherited-pipeline-first-week-checklist
date: 2026-10-19
updated: 2026-10-19
tags: handover, provenance, bioinformatics
summary: A practical checklist for rebuilding how results were made when you inherit someone else's analysis, and what to record as you go.
image_alt: A key being passed from one hand to another across a table, with an unfolded map and a dotted route between marked places lying between the hands.
---

Imagine a colleague has moved on, and you now own their analysis. There is a folder of scripts, a results directory with some files you recognise, and a few messages you can still search. Your supervisor asks a reasonable question: can you rerun this, and can you say how the numbers in the figure were made? This post is a checklist for week one. It aims to help you rebuild what happened, in an order that avoids making things worse, and to write down what you learn while it is fresh.

We do not know how common this situation is. We only note that the idea is old: a widely cited 2013 paper made "for every result, keep track of how it was produced" its first rule.[^1] The checklist below is what we would try if the person who followed that rule was not there.

## Day one: freeze before you touch

Before you run anything, make a read-only copy of what exists: scripts, configuration, logs, results, and a list of the shared-storage directories the scripts mention. Note the date and where the copy lives. A "quick test run" can overwrite outputs, change timestamps, or (with some workflow settings) delete cached files you did not know you needed.

Also write down what you are starting with, in plain words: what you were told, what you can see, and what you are guessing. We will come back to that last distinction, because it is the one that tends to get lost.

## Day two: take an inventory

Look for every place a record of what was run might live. A short list to start with:

- Shell history, job scheduler scripts and their output logs.
- Configuration files, parameter files, and environment or container definitions.
- Version control history, if the scripts were ever put in a repository.
- The headers of the files themselves.

Workflow engines leave their own traces, and it helps to know where. If the work was done with Nextflow, the `nextflow log` command prints the execution history and log information, and it accepts a `-f` option listing the fields to show.[^2] Run on its own, it lists previous runs. We ran it with Nextflow 24.01.0-edge on a two-step toy pipeline, and asked for the task name, status and work directory of one run:

```bash Ask Nextflow which tasks a past run executed and where their files are
nextflow log confident_engelbart -f name,status,workdir
```

```output
TRIM	COMPLETED	/tmp/.../work/7a/8d3730809906a6ca69c1b961f18d16
ALIGN	COMPLETED	/tmp/.../work/12/1eae96959500d83e943f31adae10dc
```

That works only from the project folder where the runs happened, and only if the hidden `.nextflow` history is still there, so check before anyone tidies the folder.

If the work was done with Snakemake, its documentation describes `--summary`, which prints a summary of the files the workflow created, and `--list-changes` with `code`, `input` or `params`, which lists output files for which those items have changed since creation.[^3] We have not run these ourselves. We would want to try them on a copy before trusting the answer.

Files carry some history too. The `samtools view` documentation describes a `--no-PG` option that stops a `@PG` line from being added to a header.[^4] That tells us such lines are written by default, but also that they are optional, so a missing line is not proof that nothing ran. For VCF files, the bcftools manual describes `--no-version`, which omits version and command line information from the output header.[^5] We tried a plain `bcftools view` (version 1.13) on a three-line file and the output header gained `##bcftools_viewVersion` and `##bcftools_viewCommand` lines, the latter holding the arguments and a date, and adding `--no-version` left them out. Header lines like these are clues, not a full record: they show the last tool that touched a file, not the whole route to it.

## Day three: read results back toward inputs

Pick one result that matters, such as the table behind a figure, and walk backwards. Which file was it written from? Which script wrote that? Which inputs did that script read? Keep going until you reach raw data or a dead end. A dead end is a finding: write down exactly where the trail stops and why.

This is also the time to look for manual steps. The same 2013 paper recommends avoiding manual data manipulation steps and, where one is unavoidable, noting which files were changed and why.[^1] A hand-edited sample sheet or a spreadsheet filter will not show up in any log, so ask around, and mark what you learn as hearsay until you can confirm it.

## Day four: look for hard-coded paths and missing files

Search the scripts for absolute paths, home directories, and scratch locations. Each one is a question: does that path exist today, and was it the same thing then? Some sites clean scratch space automatically, so a missing folder may simply mean time passed. Our [guide on what parameters produced a result](/guides/what-parameters-produced-this-result/) covers what tends to get lost.

For Nextflow, the documentation says resume needs both a matching cache entry and intact outputs, and recommends preserving the task cache and the work directories to resume successfully.[^6] So if the work directory is gone, expect a rerun to do real work again rather than skip steps.

## Day five: rerun small, and compare

Rerun the smallest piece you can on a copy, with the inputs and settings you believe were used, and compare the output with the old one. Differences are information. A 2025 study of student-built variant-calling pipelines on one benchmark dataset reports that the operating system and installation method were the most influential factors in performance.[^7] This is a course project with eleven groups, so we read it as a hint to record the environment, not as a rule about which setup is best.

## What to write down as you go

Everything above produces facts of different quality, and a rebuilt record is only useful if it says which is which. A simple scheme is enough:

1. **Seen:** read directly from a log, header, or file you can still open.
2. **Inferred:** worked out from a filename, a date, or a script that probably ran.
3. **Told:** from a person's memory or a message.
4. **Unknown:** the gaps, written as gaps.

Our reading of the arXiv essay "Be Prospective, Not Retrospective" is that its author proposes making reproducibility a goal from the start of a project instead of fixing documentation at the end.[^8] A handover is the moment that lesson shows up. Whatever you rebuild this week, a good moment to start writing down how new results are made is now.

## Where Jubilab is now

The status labels in the list above (verified, inferred, manual or unknown) come from our earlier work on a record of how results are made. Jubilab's earlier run-record prototype is not being offered. Jubilab is now building the order-to-result layer for lab work. Early access is open and we are setting up with early adopters, but the order layer is still being built and nothing is released yet.

No tool can recover the history of runs it never saw or reconstruct what a departed colleague did; a record only makes the next handover less of a detective story. Jubilab is not affiliated with or endorsed by Nextflow, Snakemake, Seqera, the bcftools or samtools projects, or the authors cited here.

## Questions we are still asking

- How much of a handover can be rebuilt from logs and headers alone, and how much depends on asking the person? We have no data on this and would like to hear from teams who have been through it.
- Is a record rebuilt from inference worth keeping next to a record captured at the time? We lean towards yes, if the guesses are clearly labelled, but we have not tested whether people read the labels.
- We have not run the Snakemake options above ourselves. We wonder how well they hold up on a project that has been edited since the original run.
- It is worth asking whether the environment effects in the 2025 student study would appear in routine laboratory work. We do not know.
- What would you want at the top of a handover note? Our guess is parameters, reference build and where the raw data lives, but we may be missing something.

## Sources

- [Ten Simple Rules for Reproducible Computational Research](https://pmc.ncbi.nlm.nih.gov/articles/PMC3812051/) | Sandve, Nekrutenko, Taylor and Hovig, PLOS Computational Biology, 2013 | Accessed: 2026-10-19
- [nextflow log (CLI reference)](https://docs.seqera.io/nextflow/reference/cli/log) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [Snakemake command-line interface](https://snakemake.readthedocs.io/en/stable/executing/cli.html) | Snakemake project, Read the Docs | Accessed: 2026-10-19
- [samtools view](https://www.htslib.org/doc/samtools-view.html) | htslib.org, samtools documentation | Accessed: 2026-10-19
- [bcftools manual](https://samtools.github.io/bcftools/bcftools.html) | samtools project, bcftools documentation | Accessed: 2026-10-19
- [Cache and resume](https://docs.seqera.io/nextflow/cache-and-resume) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [From ideal to practical: Heterogeneity of student-generated variant lists highlights hidden reproducibility gaps](https://pmc.ncbi.nlm.nih.gov/articles/PMC12530611/) | Ertürk et al., PLOS Computational Biology, 2025 | Accessed: 2026-10-19
- [Be Prospective, Not Retrospective: A Philosophy for Advancing Reproducibility in Modern Biological Research](https://arxiv.org/abs/2210.02593) | Chure, arXiv, 2022 | Accessed: 2026-10-19
