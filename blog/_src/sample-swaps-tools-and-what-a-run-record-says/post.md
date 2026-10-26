---
title: Sample swaps: the tools, and what a run record can say
description: How sample swaps are found in sequencing data according to three papers, and an honest look at what a run record can and cannot tell you once one is suspected.
slug: sample-swaps-tools-and-what-a-run-record-says
date: 2026-10-19
updated: 2026-10-19
tags: sample-swaps, quality-control, provenance
summary: How swaps are found, per three papers, and what a run record can and cannot tell you once one is suspected.
image_alt: Two test tubes, one green and one orange, with dotted paths that cross in the middle where a question mark sits, ending at two empty trays below.
---

A sample swap means that the data you analysed does not come from the sample you think it does. Published tools exist to look for them, and a run record is a different kind of thing: it says how a result was made, not whether the sample was the right one. This post reads three papers on swap detection, then asks what a record of a run can and cannot add.

Jubilab does not detect sample swaps today. It does not link samples to their files, it does not compare genotypes, and it does not check that a row in a samplesheet describes the sample it names. Everything below about detection is about other people's tools, described from the papers we read; Jubilab is not affiliated with or endorsed by their authors.

## How swaps happen

The HYSYS paper says that many steps in a sequencing workflow are manual and that mistakes can cause a DNA sample to be mislabelled; it also says swaps, loss and contamination can happen even in excellent laboratories.[^1] The authors of the CrosscheckFingerprints paper describe mislabeling as datasets being incorrectly associated with a donor, and list several ways it shows up in public data: cells from one donor labeled as another, several donors labeled as one, and one donor accessioned several times so that identical samples appear to come from different donors.[^2]

Those descriptions come from large public datasets and a cancer cohort. We do not know how well they describe your lab, and we found no source we could use for how often swaps occur, so we are not going to give a figure.

## What the tools look at

All three papers we read take the same broad approach: compare genetic information between samples and flag pairs that disagree with the expected relationship between samples.

- **HYSYS.** According to its paper, it estimates relatedness between samples in cancer cohorts using the concordance of homozygous germline SNPs, and it tests for swaps and contamination. Its output includes heat maps for visual checks and a Gaussian mixture model that labels each pair as unrelated, related or neither.[^1]
- **Somalier.** The paper describes a tool that evaluates relatedness from sequencing data, working on BAM or CRAM files or on VCF, BCF or GVCF files, without needing jointly called germline variants. It counts reference and alternate alleles at a fixed set of sites, and produces text output and an interactive plot in which expected groups, such as tumor-normal pairs, can be coloured so that mismatches stand out.[^3] The authors also say it can estimate a sample's sex from X and Y sites, and its plots compare predicted with reported sex.[^3]
- **CrosscheckFingerprints.** Its paper describes a tool for quantifying sample-relatedness and detecting incorrectly paired sequencing datasets from different donors, using reads that overlap common SNPs within linkage disequilibrium blocks and summarising them as a log-odds score.[^2]

These are not interchangeable. They take different inputs and make different assumptions, and we have not run any of them for this post, so we would not recommend one over another.

## Their stated limits

The papers are candid about limits, and they are worth reading before relying on any check. The Somalier authors describe their genotyping as a simple heuristic that works well in practice, based on depth and allele-balance thresholds.[^3] The CrosscheckFingerprints authors write that scores close to zero are inconclusive, and that for their ENCODE analysis each dataset was compared to three representative datasets from its nominal donor, which suggests that a check of that kind leans on having trusted reference data for the donor.[^2] A swap check can therefore say that two datasets disagree with what you expected. It may not tell you which label is wrong.

A sex check is cheap, but it cannot catch a swap between two samples of the same sex. In the Somalier paper, several samples listed as female in a manifest appeared to have lost an X chromosome, which the authors judged more likely than a swap or a manifest error in those cell-line samples.[^3] It is a reminder that a flag is a prompt to investigate, not a conclusion.

## What a run record can tell you

Suppose a check flags a sample. Imagine you now need to know what else is affected. A record of how each result was made could help answer questions such as:

- Which runs used the flagged sample's files as inputs?
- Which results were produced downstream of those runs?
- Which pipeline version, parameters and reference were used in each, so you can rerun the right ones?
- Did anyone enter a fact by hand rather than capturing it from a run?

That is tracing, and it is what an earlier Jubilab prototype did for the runs it saw: it let you follow a result back to its run, inputs and parameters and forward from an input to what depends on it, with an evidence status on each fact. Jubilab's earlier run-record prototype is not being offered. Jubilab is now building the order-to-result layer for lab work. Early access is open and we are setting up with early adopters, but the order layer is still being built and nothing is released yet.

## What a run record cannot tell you

A record of a run says what the run was given. It does not know whether the input files were labelled correctly before they arrived. If a FASTQ file was swapped at the bench, the record will faithfully describe a run on the wrong sample. We wonder how much of the swap problem lives upstream of any pipeline, where a record cannot see; we have not measured it.

Linking samples to their files and runs was where we were heading in our earlier work, and we think it would make the tracing questions above easier to answer. We are not promising it. Even then, it would record a link someone declared, not prove that the link is true. See also our post on [samplesheet traps](/blog/samplesheet-traps-that-change-your-run/) and the guide on [reference genome builds in VCF and BAM files](/guides/reference-genome-build-vcf-bam/).

## Questions we are still asking

- How often do swaps happen in a typical lab? We found no source we could rely on, so we say nothing about rates.
- Which of the tools above behave well on your type of data, such as low coverage or RNA-seq? We have not run them and the papers cover specific datasets.
- Should a pipeline run a swap check by default, or should checking stay a separate step the team chooses?
- If a check could one day be recorded next to a run, how should a record show a check that was skipped, as opposed to one that passed?
- We did not read the Picard documentation for CrosscheckFingerprints, which returned an error when we tried, so we do not describe how that implementation works.

## Sources

- [HYSYS: have you swapped your samples?](https://pmc.ncbi.nlm.nih.gov/articles/PMC5408803/) | Schröder, Corbin and Papenfuss, Bioinformatics, 2017 | Accessed: 2026-10-19
- [Detecting sample swaps in diverse NGS data types using linkage disequilibrium](https://pmc.ncbi.nlm.nih.gov/articles/PMC7391710/) | Javed et al., Nature Communications, 2020 | Accessed: 2026-10-19
- [Somalier: rapid relatedness estimation for cancer and germline studies using efficient genome sketches](https://pmc.ncbi.nlm.nih.gov/articles/PMC7362544/) | Pedersen et al., Genome Medicine, 2020 | Accessed: 2026-10-19
