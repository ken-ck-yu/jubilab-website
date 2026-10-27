---
title: Why a record should say what it doesn't know
description: A tidy provenance record with silently guessed fields can mislead more than a gap. Four evidence statuses, a worked example and a spreadsheet version to try.
slug: why-a-record-should-say-what-it-doesnt-know
date: 2026-10-19
updated: 2026-10-19
tags: provenance, evidence, bioinformatics
summary: A tidy record with silently guessed fields can mislead. Four evidence statuses, a worked example and a spreadsheet version.
image_alt: Four lidded jars resting on a shelf in four muted colours, with a fifth spot on the shelf shown only as an empty dotted outline.
---

Imagine a methods table for an old analysis. Every row is filled in: tool, version, reference genome, annotation release. It looks complete. Then a colleague asks how the genome build was known, and the answer is that someone assumed it from the lab's usual setup. The table did not lie on purpose; it just had no way to say "we assumed this". This post argues that a record should be able to say what it does not know, describes four statuses we use for that, and shows how to try the idea in a spreadsheet today.

## The failure we are worried about

A record can fail in two ways. It can leave a field empty, which is visible. Or it can fill the field with something plausible, which is not. We think the second is the more dangerous one, and we say that as a worry rather than a finding, because we have not measured how often it happens.

The usual advice points in the same direction without using this language. The authors of "Ten Simple Rules for Reproducible Computational Research" say that whenever a result may be of potential interest, you should keep track of how it was produced.[^1] Their second rule says that, whenever possible, you should rely on the execution of programs instead of manual procedures to modify data, and that manual procedures are inefficient, error-prone and difficult to reproduce.[^1] Both rules assume a record of how a result was made. Neither says what the record should do when a step was manual or half remembered, and that is the gap we want to talk about.

## Four statuses

An earlier Jubilab prototype attached an evidence status to each fact it recorded: verified, inferred, manual or unknown. Here is what we mean by each, with an invented example, a variant-calling run for a made-up sample.

- **Verified:** read from something that was observed. For instance, the command line of the run, as the tool that ran it saw it.
- **Inferred:** worked out from something else. For instance, a reference build guessed from the file name `sample1.hg38.bam`. A file name is a clue, not a measurement, and it can be wrong.
- **Manual:** typed in by a person. For instance, "filtered on depth at least 10 in a spreadsheet, then saved as a new file". It may be accurate, and it could carry the name of whoever said it and when; that is a design wish, not something we have verified.
- **Unknown:** nothing is known. For instance, the annotation release, because nobody wrote it down and the file does not say.

Imagine all four on one line of a record: tool version verified, reference build inferred, a hand filter manual, annotation release unknown. A reader who sees that line knows where to dig. A reader who sees four tidy values has no such clue.

Precision matters in the words as well. "Inferred" does not mean "probably right". It means "not directly observed", and how much weight to give it is for the reader to decide.

## Why "we cannot tell" is an answer

Kazic's "Ten Simple Rules for Experiments' Provenance" argues for making everything self-identifying, observing that any bar code can be mangled on scanning or land in the wrong place in the spreadsheet, and that a contemporaneous record guards against all errors except mislabelling the original.[^2] We read this as support for a modest idea: when you cannot confirm what something is, a record that says so is more useful than one that quietly picks an answer. That is our interpretation of the rule, not a claim that the author discusses evidence statuses.

There is also a social side. Sloan and Stenglein write in PLOS Biology that facilities often return data with little or no methods documentation.[^3] If that is common, then a recipient of such data will often face a field they cannot fill in honestly. A system that can only store a value will push them to invent one. A system with an "unknown" status lets them be accurate, and lets the next reader see exactly what is missing. We wonder how much this matters in practice; we have not tested it with anyone.

## Try it by hand in a spreadsheet

You do not need software. Take a table with one row per fact and add two columns:

1. **Status:** one of verified, inferred, manual, unknown.
2. **Basis:** a short note on how you know, for example "read from the VCF header", "from the file name", "told to me by the sequencing core", or "no record found".

A few habits make it work. Fill the status before you fill the value, so "unknown" is a deliberate choice. Never leave the value cell blank for an unknown; write "unknown" so a blank means "not yet looked at". When something moves from unknown to verified, change the row and keep a note of the earlier state rather than overwriting it.

This is a paper version of an idea, and it has the weaknesses of paper. Nobody checks it, and it is easy to skip when you are busy. We think the discipline is still worth practising before any tool is involved.

## Where Jubilab is now

An earlier Jubilab prototype traced a result back to its run, inputs and parameters, and forward to what depends on an input, with one of the four statuses on each fact, so a trace showed what was observed and what was not. A record cannot recover the history of a run it never saw. Jubilab is one place to order lab work and follow it to results. Register for early access: we invite small groups first. For more on what to record, see [what parameters produced this result](/guides/what-parameters-produced-this-result/), [reference genome builds](/guides/reference-genome-build-vcf-bam/) and [Nextflow provenance and lineage compared](/guides/nextflow-provenance-and-lineage-compared/).

## Questions we are still asking

- Are four statuses the right number? A fifth, such as "disputed", may be needed, or two of ours may blur together in practice.
- How should a reader weigh "inferred"? A build guessed from a file name and a build computed from the file's contents are both inferred in a loose sense, yet they are very different in strength.
- Does labelling a record's gaps make a reader trust the rest of it more or less? It is worth asking, and we have no evidence either way.
- Who should be allowed to move a fact from unknown to verified, and how should the earlier state stay visible?
- Is a spreadsheet column enough for a small team, or does the habit fade without tooling? We have not tried it with a team.

## Sources

- [Ten Simple Rules for Reproducible Computational Research](https://pmc.ncbi.nlm.nih.gov/articles/PMC3812051/) | Sandve, Nekrutenko, Taylor and Hovig, PLOS Computational Biology, 2013 | Accessed: 2026-10-19
- [Ten Simple Rules for Experiments' Provenance](https://pmc.ncbi.nlm.nih.gov/articles/PMC4619002/) | Toni Kazic, PLOS Computational Biology, 2015 | Accessed: 2026-10-19
- [Towards ensuring reproducibility of outsourced data generation](https://pmc.ncbi.nlm.nih.gov/articles/PMC11734931/) | Sloan and Stenglein, PLOS Biology, 2025 | Accessed: 2026-10-19
