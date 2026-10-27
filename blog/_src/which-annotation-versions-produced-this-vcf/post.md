---
title: Which annotation versions produced this VCF?
description: An annotated VCF rarely says which VEP cache, ClinVar or gnomAD release produced it. What the Ensembl docs say, how to check your file, and what to write down.
slug: which-annotation-versions-produced-this-vcf
date: 2026-10-19
updated: 2026-10-19
tags: annotation, vcf, bioinformatics
summary: An annotated VCF may not name its VEP cache, ClinVar or gnomAD release. What the docs say, how to check, what to write down.
image_alt: Three see-through coloured layers stacked over a ladder-shaped strand, with the top layer sliding slightly out of line with the other two.
---

Someone asks which ClinVar release the variants in a VCF were annotated against, and the honest answer is sometimes "we would have to find out". Annotation sources move on their own schedules, so two annotated files made from the same variants can differ for reasons that have nothing to do with the sample. This post looks at what the Ensembl VEP documentation says about versions, how to inspect a file for clues, and what a short annotation record could contain. It is about the plumbing of versions, not about the clinical meaning of any variant.

## Three clocks, not one

An annotated VCF depends on at least three things that change independently: the annotation tool, the cache or database it read, and the external sources that were bundled into that cache or supplied separately.

The Ensembl documentation strongly recommends using the cache version that corresponds to your VEP installation, and gives the example that cache version 116 should be used with VEP version 116.[^1] It also says that cache formats can differ between versions and may be incompatible with newer VEP tools.[^1] So the tool version and the cache version are meant to travel together, and a record that keeps only one of them leaves a gap.

The sources inside the cache have their own versions. The same page has a "Data in the cache" table for release 116 that lists ClinVar as 2025-09 for GRCh38 and 2023-06 for GRCh37, and gnomAD exomes and genomes as v4.1 for both.[^1] We quote it with its release number because it is a snapshot: it describes the default human cache files for that one release, and we did not find a table covering other releases on the page. Notice that the two genome builds in the same release carry different ClinVar versions, which is one more reason a record should name the build as well. For the build question itself, see [our guide on reference genome builds](/guides/reference-genome-build-vcf-bam/).

### Why gnomAD may lag

The documentation says that gnomAD is not a variant accessioning body, and that gnomAD variants which have not been accessioned will not be available in the cache.[^1] It gives gnomAD v4.1 as an example, and its worked example reports no frequency data for a variant because it was not accessioned at the time of the Ensembl 113 release. For such variants the page suggests supplying a gnomAD VCF with the `--custom` option.[^1] gnomAD's own news page lists v4.1 on 19 April 2024 and v4.1.1 on 30 March 2026.[^5] We have not worked out how those two interact with a given Ensembl release, and we would not guess.

### ClinVar has weekly and monthly clocks

NCBI's ClinVar documentation says the website data are updated weekly, on Mondays, and that it provides monthly archived data releases; the weekly releases are not archived, only the monthly ones.[^4] So "the latest ClinVar" is a moving target, and a month label such as 2025-09 is a useful, specific thing to write down.

## What the file may or may not tell you

The VEP documentation shows that the tool's default output begins with a header that names the VEP version, the cache location and source versions (the sample on the page includes lines for ClinVar and dbSNP).[^2] The documented VCF output section we read describes the `CSQ` field, but it did not say which header lines record cache or source versions, and the string `##VEP` does not appear on that page. So we cannot tell you from the documentation what a VEP-annotated VCF header contains. Check your own file.

We did not run VEP for this post. What we did run is a check with `bcftools` on a tiny VCF we wrote by hand, whose `##VEP` line is made up for the test, to show how you can pull header lines out for inspection:

```bash Show candidate header lines in a VCF
bcftools view -h --no-version tiny.vcf | grep -E '^##(VEP|INFO=<ID=CSQ)'
```

```output
##VEP="made-up header for a test"
##INFO=<ID=CSQ,Number=.,Type=String,Description="Consequence annotations from Ensembl VEP. Format: Allele|Consequence">
```

That was tested by us with bcftools 1.13. The documentation also lists a `--show_cache_info` option described as showing source version information for the selected cache and quitting, and a `--no_headers` option that suppresses header lines.[^3] We did not run either, and the cache page we read did not mention `--show_cache_info`, so check that it exists in your VEP version before you rely on it. It is worth asking whether your pipeline ever writes files without headers; we have not checked.

## A four-line annotation record

If the file does not say, someone has to. A record could include:

1. The tool and its version, for example the VEP release.
2. The cache version and the assembly, including whether the cache came from Ensembl or RefSeq.
3. The source versions that matter to your question, such as ClinVar month and gnomAD version, and any custom files passed with `--custom`.
4. For each of these, how you know: read from a file header, read from the command you ran, remembered, or unknown.

That last line is the one people skip. "ClinVar 2025-09, read from the cache information" and "ClinVar, probably the latest, from memory" are different facts, and a record is more honest if it keeps them apart.

## Freeze or refresh?

We do not have a universal answer. Freezing the sources keeps results comparable over time but leaves you behind on new evidence; refreshing keeps you current but changes old answers. Some teams may freeze for the length of a project and refresh between projects, though we have not surveyed what teams actually do. What we think matters most is that the choice is written down with a date.

## Where Jubilab is now

An earlier Jubilab prototype traced a result back to its run, inputs and parameters, with an evidence status on each fact. A record could include the four lines above; we are not claiming that it stored each of them. Jubilab's earlier run-record prototype is not being offered. Jubilab is now building a way to order lab work once and follow it to results. We are accepting early adopters by invitation (request access and we invite small groups first). The product is still being built and nothing is released yet. Jubilab is not affiliated with or endorsed by Ensembl, EMBL-EBI, NCBI or the gnomAD project.

## Questions we are still asking

- Which header lines does a VEP-annotated VCF actually carry for cache and source versions, across VEP releases? We did not run VEP and the documentation pages we read do not say.
- Does `--show_cache_info` exist and behave as described in current releases? We read it only in the options page and did not run it.
- How should a record show that a source version was inferred from the release date rather than read from the cache?
- Is a month label enough for ClinVar, or should a record keep the file name and checksum as well?
- When annotations are refreshed, how should a lab present the differences to a reader, without implying that either set is the correct one?

## Sources

- [Ensembl VEP: cache](https://jun2026.archive.ensembl.org/info/docs/tools/vep/script/vep_cache.html) | EMBL-EBI, Ensembl release 116 (June 2026) archive | Accessed: 2026-10-19
- [Ensembl VEP: data formats](https://jun2026.archive.ensembl.org/info/docs/tools/vep/vep_formats.html) | EMBL-EBI, Ensembl release 116 (June 2026) archive | Accessed: 2026-10-19
- [Ensembl VEP: options](https://jun2026.archive.ensembl.org/info/docs/tools/vep/script/vep_options.html) | EMBL-EBI, Ensembl release 116 (June 2026) archive | Accessed: 2026-10-19
- [ClinVar: maintenance and use of data](https://www.ncbi.nlm.nih.gov/clinvar/docs/maintenance_use/) | National Center for Biotechnology Information | Accessed: 2026-10-19
- [gnomAD news](https://gnomad.broadinstitute.org/news/) | Broad Institute, gnomAD | Accessed: 2026-10-19
