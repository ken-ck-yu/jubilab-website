---
title: Lifting a VCF over: what to record
description: Liftover can drop or change variants, and tools differ. What to write down about the chain file, tool and reference so you can explain what was lost later.
slug: lifting-a-vcf-over-what-to-record
date: 2026-10-19
updated: 2026-10-19
tags: vcf, reference-genome, provenance
summary: Liftover moves variants between assemblies and can lose some. What to record so you can explain the differences later.
image_alt: A bridge arching between two slightly different shorelines, with two small parcels falling off the side into the water below and a dotted route above the span.
---

Imagine you lift a VCF from one genome assembly to another, and the output has fewer records than the input. Is that expected? Is it the chain file, the tool, the settings, or a mistake somewhere earlier? Months later, a collaborator asks the same question, and all you have is the two files. This post is about the small amount of information worth writing down at the moment of the liftover, so that the question has an answer, and about what we do and do not know about how much loss to expect.

## What liftover does

Liftover converts coordinates from one assembly to another using a chain file. The UCSC description of the chain format says that a chain file stores a pairwise alignment between two genome sequences, one that allows gaps in both sequences at once, as a series of aligned blocks with the distances between them.[^1] A variant sitting inside an aligned block can be moved. A variant that falls between blocks has no direct destination, though some tools try to recover it.

For a VCF there is a second problem. The record carries alleles as well as a position, so the tool must also decide what REF and ALT mean on the other assembly. CrossMap's documentation states that its VCF mode needs the chain file, the input VCF and a FASTA of the target assembly, and that this reference "must correspond to the target assembly."[^2] Picard's LiftoverVcf documentation lists the chain file, an output for rejected records and the target reference sequence among its required arguments.[^3] In both cases, three things shape the result: the chain, the target reference and the tool.

## Tools handle the edges differently

CrossMap's documentation describes a separate `.unmap` file for variants that could not be mapped, and tags records with reasons such as `Fail(Multiple_hits)`, `Fail(REF==ALT)`, `Fail(Unmap)` and `Fail(KeyError)` when a contig is missing from the target FASTA.[^2] The same page lists behaviour changes between versions, for example how reference alleles of indels on the reverse strand are updated, which is a good reason to write down the exact version you ran.[^2]

Picard's documentation says rejected records are written to the reject file with filters, using source genome coordinates, and it describes options such as writing the original position into the INFO field, which is off by default.[^3] If you did not switch that on, the lifted file does not say where each variant came from. That is a decision worth recording even if you think you will never need it.

How much do tools differ in practice? One comparison is in the paper describing BCFtools/liftover. The authors lifted a 1000 Genomes low-coverage callset from GRCh37 to GRCh38 with the UCSC chain file and compared six tools on 45,595,458 bi-allelic SNVs. The numbers of SNVs each dropped ranged from 12,582 to 46,607, and for CrossMap the authors attribute the high count to its inability to swap reference and alternate alleles.[^4] By our arithmetic, those counts are between roughly 0.03% and 0.10% of the SNVs. Two cautions apply. The authors wrote one of the compared tools, so we read the benchmark as informative but not neutral. And it is one dataset, one pair of assemblies and one chain file, so we do not think it tells you what a "normal" loss rate is for yours. Tool versions have also moved on since, and we have not repeated the comparison.

## The record to write while you still remember

Here is the short list we would keep next to every lifted file:

1. **Source and target:** the assembly name and build of the input, and of the target FASTA you passed to the tool.
2. **Chain file:** its name, where it came from, and a checksum. A chain file may be updated at its source without its name changing; we have not checked how often that happens, but a checksum is a cheap way to notice.
3. **Tool and version**, and the full command line, including options such as how swapped alleles or original positions were handled.
4. **Counts:** records in, records out, records rejected, and where the reject or unmap file is stored.
5. **Anything you did afterwards:** filtering, sorting or normalisation applied to the lifted output.

None of this needs special software. With bcftools you can write the record from the shell. We tried this on tiny files with bcftools 1.13; the chain here is a one-block stand-in so that the checksum line has something to hash:

```bash Write a small record next to a lifted file
{
  echo "tool: $(bcftools --version | head -n 1)"
  echo "chain: $(sha256sum toy.over.chain | cut -c1-16)...  toy.over.chain"
  echo "records in: $(bcftools view -H before.vcf | wc -l)"
  echo "records out: $(bcftools view -H after.vcf | wc -l)"
} > liftover-record.txt
```

```output
tool: bcftools 1.13
chain: df05e308de6372c8...  toy.over.chain
records in: 3
records out: 3
```

In real use you would store the full checksum, not a shortened one, and you would add the liftover command itself. We have not run Picard or CrossMap for this post, so everything we say about them comes from their documentation, not from our own runs.

The bcftools manual also notes a `--no-version` option that leaves version and command line information out of the output header, so if you ever see a VCF without such lines, that alone does not tell you nothing was done to it.[^5]

## Checking afterwards

A count tells you how many records went missing, not which ones or why. If the reject file survives, it is a good place to start, because, according to their documentation, Picard and CrossMap write rejected records out with filters or reasons. If it does not, you can only compare the input and output yourself. Our [guide on checking the reference build of a VCF or BAM](/guides/reference-genome-build-vcf-bam/) walks through checks such as contig lengths and REF alleles against a FASTA, which work on a lifted file in the same way.

## Where Jubilab is now

This is the kind of record we wanted a run-record tool to keep: the command, its arguments and the input and output files you declare, with an evidence status on each. Jubilab's earlier run-record prototype is not being offered. Jubilab is now building the order-to-result layer for lab work. We are recruiting early adopters (request access and we invite small groups first), but the order layer is still being built and nothing is released yet.

Jubilab does not perform or check a liftover. It is not affiliated with or endorsed by Picard, CrossMap, UCSC, the bcftools project or the authors cited here.

## Questions we are still asking

- What loss rate is reasonable for a given dataset and chain? We do not know, and the published comparison above covers one case. It is worth asking whether teams keep their own reference numbers.
- We wonder how often a reject file is kept. Some teams may delete it as clutter; we have not surveyed anyone and would like to hear what is common.
- How should a loss be reported in a methods section, as a count, a percentage or the reject file itself?
- Does the choice of chain file matter more than the choice of tool? The paper above used one chain file, so it cannot say, and we have not tested it.
- We have not run Picard or CrossMap ourselves for this post. If you see behaviour that differs from their documentation as we describe it, we would like to know.

## Sources

- [Chain Format](https://genome.ucsc.edu/goldenPath/help/chain.html) | UCSC Genome Browser, UC Santa Cruz | Accessed: 2026-10-19
- [CrossMap documentation](https://crossmap.readthedocs.io/en/latest/) | CrossMap project, Read the Docs | Accessed: 2026-10-19
- [Picard command line overview: LiftoverVcf](https://broadinstitute.github.io/picard/command-line-overview.html) | Broad Institute, Picard documentation | Accessed: 2026-10-19
- [BCFtools/liftover: an accurate and comprehensive tool to convert genetic variants across genome assemblies](https://pmc.ncbi.nlm.nih.gov/articles/PMC10832354/) | Genovese et al., Bioinformatics, 2024 | Accessed: 2026-10-19
- [bcftools manual](https://samtools.github.io/bcftools/bcftools.html) | samtools project, bcftools documentation | Accessed: 2026-10-19
