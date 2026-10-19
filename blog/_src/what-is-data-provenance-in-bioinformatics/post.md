---
title: What is data provenance in bioinformatics?
description: Data provenance is the record of how a result was made. A plain-language look at what it contains, what common tools keep, and what we still wonder about.
slug: what-is-data-provenance-in-bioinformatics
date: 2026-10-19
updated: 2026-10-19
tags: provenance, lineage, bioinformatics
summary: Provenance is the record of how a result was made. What it holds, what tools keep today, and what we still wonder about.
image_alt: A file at the end of a chain, linked back through a gear, a small stack of pages and a magnifying glass to the source file it came from.
---

Open a results file from last spring and ask a simple question: how was this made? Which input went in, which settings were used, which version of the tools ran, and who or what touched it on the way? Data provenance is the name for the record that answers those questions. This post explains the idea in plain words, looks at what common bioinformatics tools keep today, and is honest about the parts we are still thinking through.

## A working definition

The W3C, in its overview of the PROV family of documents, describes provenance as information about the entities, activities and people involved in producing a piece of data or thing, which can be used to form assessments about its quality, reliability or trustworthiness.[^1] That is a broad definition, and we like it because it does not mention any particular tool. It simply says that a result has a history, and that the history is useful.

In everyday lab language we would put it more simply: provenance is the answer to "where did this come from, and what happened to it?" A related word is lineage, which we use for the same history drawn as a graph, with arrows from inputs to the steps that used them and on to the outputs.

## Why a bioinformatics result needs one

Imagine a collaborator emails you six months after a variant-calling run and asks why two cohorts look different. To answer, you would want to know several things at once.

- Which input files went into each run, and whether they were the same files.
- Which parameters each run used, including the ones set on the command line rather than in a file.
- Which versions of the pipeline and its tools ran.
- Which reference genome build and annotation the results were produced against.
- Whether anyone changed a file by hand along the way.

None of this is exotic. The authors of the paper "Ten Simple Rules for Reproducible Computational Research" put it as their first rule: for every result, keep track of how it was produced, recording the steps, programs, versions and parameters behind any potentially important result.[^2] They also advise avoiding manual data manipulation steps, and, where one cannot be avoided, noting which files were changed and why.[^2] In other words, asking for a record of how a result was made is not a new request; that paper dates from 2013.

## What the common tools keep

Workflow engines already write down a good deal. It is worth being precise about what, because it is easy to assume more or less than is true.

Snakemake, according to its documentation, stores provenance information in the `.snakemake/metadata` directory by default, and it also offers an experimental database backend that keeps the same kind of information in a SQLite file or another supported database.[^3] The page does not list every field, so we would not claim to know exactly what each record holds without opening one on a real project. We have not compared those records across Snakemake versions, and it would be worth doing before relying on them for anything important.

Nextflow added an experimental data lineage feature in version 25.04. Its documentation says that it records workflow runs, successful task executions and output files in a lineage store, that it is switched on with a configuration setting, and that its behaviour may change in future releases.[^4] The same page says failed or aborted tasks are not recorded, which is a good example of why it helps to read what a record leaves out as carefully as what it contains.

Plain shell scripts and notebooks are a different story. A command typed into a terminal leaves whatever the shell history kept, and a notebook keeps the cells but not necessarily the state they ran in. We wonder whether this is where most of the surprises hide; we have not measured it, so we treat that as a question rather than a finding.

## What a useful record looks like

Putting the sources above together, a record that would help a stranger answer "how was this made?" probably contains:

1. The exact command or launch, and the values of the parameters that applied, not just the name of the file that held them.
2. The identity of each input, ideally something that would show if the file changed, such as a checksum.
3. The versions of the pipeline, tools and containers.
4. The outputs, linked back to the step that made them.
5. Who or what ran it, and when.
6. A clear mark on anything that was not recorded, so that a gap looks like a gap.

That last item is easy to forget. A record that silently skips what it did not see can be more misleading than no record at all. This is why every fact in Jubilab carries an evidence status: verified, inferred, manual or unknown. It is a small habit with a large effect on how much you trust a page of history.

## Where Jubilab fits, and where it does not

Jubilab is being built as a record of how results are made, across the tools a lab already uses. What exists today is narrower than that ambition, and we would rather say so plainly. You can trace a result back to its run, inputs and parameters, and forward to what depends on an input. You can compare two runs and see which recorded values differ. Runs are kept as history the application cannot edit. It records Nextflow runs as they happen or imports finished ones, imports Snakemake runs, and wraps any other command with a native bash wrapper.

It does not yet link every sample to its files, and it does not yet check for sample swaps or reference genome build mismatches. Opt-in capture of reference and annotation details from file headers ships with our next release. Integrations with other platforms, access for AI agents and notebook support are where we are heading, not things you can use today. Jubilab also cannot recover the history of a run it never saw; it records going forward.

Jubilab is not a replacement for a workflow engine, a LIMS or an electronic lab notebook, and it is not affiliated with or endorsed by Nextflow, Snakemake, Seqera or the W3C. We think of it as a layer that sits beside them.

## Questions we are still asking

We do not think the field has settled these, and we would like to hear how other teams see them.

- How much provenance is enough? It is worth asking whether a record that is too detailed gets ignored, and whether a lighter record that people actually keep is worth more than a perfect one that nobody reads.
- We wonder how stable the built-in records of workflow engines will be over time, given that Nextflow describes its lineage feature as experimental. Should a lab depend on any single tool's format?
- We wonder whether manual steps, such as a hand-renamed file or a filter applied in a spreadsheet, are the hardest to capture. We have not tested how often they happen, and we would like to understand it better.
- If a record is incomplete, what is the most honest way to show that to a reader without making the whole record look unreliable?
- What would you want a record to tell a reviewer or a new colleague on day one? Our guess is the parameters and the reference build, but we may be wrong.

## Sources

- [An Overview of the PROV Family of Documents (PROV-Overview)](https://www.w3.org/TR/prov-overview/) | W3C Provenance Working Group, Working Group Note, 30 April 2013 | Accessed: 2026-10-19
- [Ten Simple Rules for Reproducible Computational Research](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1003285) | Sandve, Nekrutenko, Taylor and Hovig, PLOS Computational Biology, 2013 | Accessed: 2026-10-19
- [Snakemake documentation: Provenance](https://snakemake.readthedocs.io/en/stable/executing/provenance.html) | Snakemake project, Read the Docs | Accessed: 2026-10-19
- [Nextflow documentation: Data lineage](https://docs.seqera.io/nextflow/data-lineage) | Seqera, Nextflow documentation | Accessed: 2026-10-19
