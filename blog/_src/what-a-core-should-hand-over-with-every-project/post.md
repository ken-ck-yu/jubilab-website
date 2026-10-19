---
title: What a core should hand over with every project
description: A checklist for sequencing and analysis cores: what to send clients beyond the files, so results can still be understood after staff and projects move on.
slug: what-a-core-should-hand-over-with-every-project
date: 2026-10-19
updated: 2026-10-19
tags: handover, core-facility, provenance
summary: A checklist of what a sequencing or analysis core could send beyond the data files, and why it helps clients and staff.
image_alt: A tidy parcel tied with an orange ribbon, with a folded checklist sheet showing ticks and lines tucked into the lid.
---

Imagine a researcher receives a folder from a sequencing or analysis core: FASTQ files, a BAM here, a VCF there, perhaps a spreadsheet of counts. Two years later a reviewer asks how the library was prepared, which reference was used, or why a rerun gives slightly different numbers. The researcher writes to the core. The person who ran the project has since left. This post is a draft checklist of what a core could send alongside the data files, written to start a conversation rather than to set a standard.

We are not a core and have not run one. What follows draws on published perspectives and on public pages from a few cores, which we cite as examples and not as endorsements, and we have tried to say where we are guessing.

## Why the files are not enough

Sloan and Stenglein, writing in PLOS Biology in 2025, argue that data from outsourced or centralised facilities often lacks methodological information. They note that sequencing facilities often return data with little or no methods documentation, and that choices such as the DNA polymerase or the number of PCR cycles can change bias in sequence representation.[^1] The same paper recommends that service providers keep detailed protocols, record methodological metadata for each run, and deliver this information automatically with the data. They also say formal reporting standards for high-throughput sequencing exist but have not gained widespread adoption.[^1]

That paper is mostly about data generation. The analysis side has a similar shape: the numbers in a client's figure depend on a pipeline, its version, its parameters and its reference. A client who receives only outputs cannot answer those questions later, and neither, after enough time, can the core.

## A draft hand-over package

Here is the list we would try, in rough order of how cheap each item is to produce.

1. **A project summary in plain words.** What was asked, what was done, who ran it, and the dates.
2. **Inputs, identified.** The names and checksums of the files received or generated, so the client and the core can tell later whether they are talking about the same files.
3. **Wet-lab methods metadata**, where the core did the preparation: the kit, protocol version and anything the Sloan and Stenglein paper highlights, such as the number of PCR cycles.[^1]
4. **The analysis environment.** Pipeline name and version, tool versions, and container or environment identifiers.
5. **Parameters actually used.** Ideally the file that held them, plus any set on the command line. The nf-core troubleshooting page mentions a `-params-file` option in a different context; we read it as one way to keep a parameter set in a file you can send, though the page does not say that.[^2]
6. **Reference and annotation.** Which genome build and annotation, with a checksum or release name.
7. **Run reports.** If the pipeline can produce them, include them. The Nextflow documentation describes an execution report, a timeline, a trace file with a row per task, and a workflow graph, each enabled with a command-line option or a configuration setting, so none of them exist unless someone switched them on.[^3]
8. **QC summaries and exclusions.** Which samples were dropped, by whom, and on what grounds.
9. **A short "what we recorded and what we could not" note.** More on this below.
10. **Retention terms.** How long the core keeps the data and the record, and who is responsible for backup.

We do not claim every project needs all ten, and a small project may need two. The idea is that each item is a question the client may ask in two years' time.

## Examples from public pages

Some cores already say publicly what they provide. The Harvard Chan Bioinformatics Core's platforms page says it provides template reports with "clear, standardized outputs across projects," and describes its Nextflow and nf-core pipelines as supporting reproducibility, transparency and efficiency.[^4] We have not seen those reports, so we cannot say what is in them. The bioinformatics core policies page at the University of Nebraska Medical Center states that clients should download all results, that the core does not have responsibility to keep data six months after returning results, and that the principal investigator is responsible for backup.[^5] That is a clear retention statement, and it is a good example of item 10 above. Whether it matches what clients expect is something we do not know.

We mention these pages as public examples only. We have no relationship with either institution, and nothing here says how any core works beyond what its own page states.

## The most useful item might be the honest one

Item 9 deserves a sentence of its own. A hand-over note that lists what was recorded is helpful. A note that also says what was not recorded may be more helpful: "the trimming step was run interactively and the exact command was not kept", or "the reference build was taken from the file name and not checked". This is the same idea as an evidence status: say whether a fact was observed, inferred, entered by hand or unknown. We wonder whether clients would find that reassuring or alarming. It is worth asking, and we do not know the answer.

## Keeping the record when staff change

If the core's record lives in one person's shell history, it leaves with that person. A few habits that seem sensible to us, though we have not tested how well they hold up in a busy facility:

- Write the record at the end of each run, not at the end of the quarter.
- Store it with the project, in a place the next analyst will look, not in a personal folder.
- Use the same fields for every project, so a gap is visible as a gap.
- Keep the record separate from the data, since data may be purged or archived on a different schedule.

Our [guide on what parameters produced a result](/guides/what-parameters-produced-this-result/) describes what tends to be lost between a run and a result, and the [guide comparing what Nextflow, Seqera Platform and Snakemake record](/guides/nextflow-provenance-and-lineage-compared/) looks at what the workflow engines already keep.

## Where Jubilab fits

Jubilab is a local-first, self-hostable record of how results are made. Today it can record Nextflow runs live or import finished ones, import Snakemake runs, and wrap other commands with a native bash wrapper. Each run is immutable history, each fact carries an evidence status, and you can trace a result back to its run, inputs and parameters, and compare two runs. Self-hosted installs have per-user accounts. Opt-in capture of reference and annotation details from file headers ships with our next release.

It does not hand projects over to clients, it has no client portal, it does not link samples to their files, and we have not confirmed that it can export a record as a report, so we are not promising that. Those are things we wonder about and where we are heading, not things you can use today. Jubilab is not affiliated with or endorsed by Nextflow, Seqera, nf-core or any core cited here.

## Questions we are still asking

- Which items on the list would clients actually read? We have not asked any clients and would like to hear from cores and from the people they serve.
- How much of the list can be produced automatically at the end of a run, and how much needs a person to write it? We suspect the second part is larger than we would like.
- Should the record go to the client at all, or only be kept by the core and shared on request? There are reasons on both sides, including privacy and how much detail clients want.
- It is worth asking whether a "what we could not record" note changes how clients judge a core's work, for better or worse.
- The Sloan and Stenglein paper suggests standardising through a few large providers. We wonder whether that is realistic for small, local cores with changing staff.

## Sources

- [Towards ensuring reproducibility of outsourced data generation](https://pmc.ncbi.nlm.nih.gov/articles/PMC11734931/) | Sloan and Stenglein, PLOS Biology, 2025 | Accessed: 2026-10-19
- [Troubleshooting](https://nf-co.re/docs/running/troubleshooting) | nf-core community | Accessed: 2026-10-19
- [Tracing and visualisation](https://docs.seqera.io/nextflow/tracing) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [Bioinformatics platforms](https://hsph.harvard.edu/research/bioinformatics/platforms) | Harvard Chan Bioinformatics Core, Harvard T.H. Chan School of Public Health | Accessed: 2026-10-19
- [Bioinformatics and Systems Biology Core: policies](https://www.unmc.edu/research-resources/resources/cores/bioinformatics-systems-biology/policies.html) | University of Nebraska Medical Center | Accessed: 2026-10-19
