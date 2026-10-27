---
title: Provenance vs lineage in bioinformatics: examples
description: Provenance and lineage overlap, and sources disagree on the line between them. A three-step variant calling example shows which question each word answers.
slug: provenance-vs-lineage-in-bioinformatics
date: 2026-10-19
updated: 2026-10-19
tags: provenance, lineage, bioinformatics
summary: Two overlapping words, one toy variant calling pipeline, and the questions each one helps you answer about a VCF.
image_alt: Two maps of the same winding river side by side: on the left a marker at the spring where it starts, on the right a dotted line and small step marks along the flow down to an arrowhead.
---

We already wrote a plain introduction to [what data provenance is in bioinformatics](/blog/what-is-data-provenance-in-bioinformatics/). This post takes a narrower angle on a question we expect many newcomers to have: is lineage the same thing as provenance? Sources disagree, and the honest answer is "it depends who you ask". Rather than pick a winner, we use one small invented pipeline to show which questions each word is good at, and where the words blur.

## Two definitions that do not quite line up

The W3C describes provenance as information about the entities, activities and people involved in producing a piece of data or thing.[^1] Its data model builds on three ideas: an entity is a physical, digital, conceptual or other kind of thing; an activity is something that occurs over a period of time and acts upon or with entities; an agent is something that bears some form of responsibility for an activity.[^2] That is a broad frame. It has room for files, runs and people, and it does not use the word lineage in the passages we read.

Some vendors draw a sharper line. In one explainer, from DataHub, lineage is described as operational, mapping how data moved and changed, while provenance is about trust and governance, covering origin, ownership and custody.[^3] That article also says the two overlap in some metadata. We do not think that division is wrong, but it was written for data platforms in general, and we are not sure it fits a genomics lab. It is worth asking whether a lab would use the words that way.

Workflow research uses the words differently again. A 2015 preprint on the YesWorkflow tool describes the data provenance captured by workflow systems as retrospective provenance, which it says consists of data dependencies and lineage information recorded at runtime.[^4] There, lineage is a part of provenance. And a 2013 BMC Bioinformatics paper on provenance in bioinformatics workflows never uses the word lineage in the text we read.[^5]

So we will not pretend there is one correct definition. Here is the working vocabulary we use in this post.

- **Provenance** is the whole record: what ran, with what, by whom, when, and under what settings.
- **Lineage** is the shape of that record as a graph: which outputs came from which inputs through which steps.

## A toy pipeline

Imagine a small pipeline with three steps, which we invented for illustration:

1. **Align**: reads (`sample.fastq`) and a reference (`ref.fasta`) go in, and `sample.bam` comes out.
2. **Call**: `sample.bam` and `ref.fasta` go in, and `sample.vcf` comes out.
3. **Annotate**: `sample.vcf` and an annotation file (`ann.gtf`) go in, and `sample.annotated.vcf` comes out.

Nothing here is a real project. Now we ask four questions of `sample.annotated.vcf` and see which word feels natural.

**Which files was this made from?** This is lineage at its simplest: walk back along the arrows. You reach `sample.vcf`, then `sample.bam`, then `sample.fastq`, `ref.fasta` and `ann.gtf`.

**If `ref.fasta` turns out to be the wrong build, what else is affected?** Walk forward from the reference: the BAM, the VCF and the annotated VCF. This forward question is the one people often mean by impact analysis, which DataHub lists as a use of lineage,[^3] and it is a lineage question.

**Which settings did the calling step use, and which tool version?** The arrows do not tell you. This needs the details attached to each step: the command, the parameters, the versions. We would call that provenance in the everyday sense, and it is why graph-only answers can feel thin.

**Who ran it, on which machine, and when?** Also provenance, and the W3C's agent idea is aimed squarely at it.[^2]

Notice that a useful answer to the question about files often needs the third. Knowing that a file came from `ref.fasta` is more useful when you also know which build of it was used. This is why we treat lineage as the skeleton and provenance as the detail on it. Our guide on [Nextflow provenance and lineage compared](/guides/nextflow-provenance-and-lineage-compared/) looks at how one engine splits the two.

## Retrospective and prospective

The YesWorkflow paper also describes a second kind. Prospective provenance, it says, is a description of the computational process itself, so the workflow specification counts as a form of provenance describing the method by which results are obtained.[^4] In our toy pipeline, the written definition of the three steps is prospective: what was meant to happen. The record of one actual execution, with its real files and values, is retrospective: what did happen.

The difference matters when the two disagree. Imagine someone edited a parameter by hand after launching the pipeline. The definition would not show it, and a record of what the run did might. We wonder how often this happens in practice; we have not measured it.

## How the engines use the words

Nextflow's documentation calls its feature data lineage. It says the feature was added in version 25.04, is experimental, and records the workflow run, successful task executions and output files in a lineage store.[^6] It also says tasks that failed or were aborted are not recorded.[^6] So the word on the label is lineage, while the contents include run details; the labels in real tools do not map neatly onto any one definition. Snakemake, on the other hand, uses the word provenance in its documentation for the information it stores about how files were made.[^7]

## Where Jubilab is now

An earlier Jubilab prototype offered both views of the same history: tracing an output back to its run, inputs and parameters, and forward from an input to what depends on it, with an evidence status on each fact. Jubilab is one place to order lab work and follow it to results. Register for early access: we invite small groups first.

Jubilab is not affiliated with or endorsed by the W3C, DataHub, Nextflow or Snakemake.

## Questions we are still asking

- Should a lab pick one word? We lean towards using provenance for the record and lineage for the graph, but we hold that loosely, and other definitions in the sources above are just as defensible.
- DataHub ties provenance to trust and governance. Is that useful for a sequencing lab, or does it import a vocabulary that does not fit? We have not tested how lab members use either word.
- When the written pipeline and the executed run disagree, which should a reader believe? We would say the executed run, but it is worth asking what to do when the executed record is itself incomplete.
- How should a graph show a gap, for example a step that ran outside any tool? We suspect an explicit marker may serve readers more than a missing arrow, and would like to hear otherwise.
- Do forward questions, such as what depends on this reference, matter more than backward ones to the people you work with?

## Sources

- [An Overview of the PROV Family of Documents (PROV-Overview)](https://www.w3.org/TR/prov-overview/) | W3C Provenance Working Group | Accessed: 2026-10-19
- [PROV-DM: The PROV Data Model](https://www.w3.org/TR/prov-dm/) | W3C Provenance Working Group | Accessed: 2026-10-19
- [Data Lineage vs. Data Provenance: What's the Difference?](https://datahub.com/blog/data-lineage-vs-data-provenance/) | DataHub | Accessed: 2026-10-19
- [YesWorkflow: A User-Oriented, Language-Independent Tool for Recovering Workflow Information from Scripts](https://arxiv.org/abs/1502.02403) | McPhillips et al., arXiv:1502.02403 | Accessed: 2026-10-19
- [Provenance in bioinformatics workflows](https://pmc.ncbi.nlm.nih.gov/articles/PMC3816297/) | de Paula et al., BMC Bioinformatics 14 (Suppl 11): S6, 2013 | Accessed: 2026-10-19
- [Nextflow documentation: Data lineage](https://docs.seqera.io/nextflow/data-lineage) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [Snakemake documentation: Provenance](https://snakemake.readthedocs.io/en/stable/executing/provenance.html) | Snakemake project, Read the Docs | Accessed: 2026-10-19
