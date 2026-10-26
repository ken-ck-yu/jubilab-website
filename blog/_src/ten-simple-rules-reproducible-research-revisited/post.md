---
title: Ten simple rules for reproducible research, revisited
description: A 2013 paper gave ten rules for reproducible computational research. We ask which ones workflow tools help with now, and which still depend on people.
slug: ten-simple-rules-reproducible-research-revisited
date: 2026-10-19
updated: 2026-10-19
tags: reproducibility, provenance, bioinformatics
summary: Ten rules from a 2013 paper, read against today's workflow tools: which ones tools help with, and which are still open.
image_alt: A staircase of ten steps where only three of the lower steps are filled green and the rest are bare white, with an orange dotted line marking the climb.
---

In 2013, Sandve, Nekrutenko, Taylor and Hovig published "Ten Simple Rules for Reproducible Computational Research" in PLOS Computational Biology.[^1] It is a paper we keep coming back to. So we wanted to go back through the ten rules one at a time and ask: which of them does a tool now help with, which still depend on people, and where are we not sure?

We are quoting the rule headings as printed and paraphrasing as little as we can. We have not tested any tool against the rules, and nothing here is a verdict on a tool or a lab.

## Does the paper expect tools to help?

It does. The authors note that when analyses run inside an integrated framework, the system may already provide full or partial support for most of the rules.[^1] The frameworks they name are GenePattern, Galaxy, LONI Pipeline and Taverna.[^1] We wonder whether workflow engines such as Nextflow and Snakemake now fill a similar role, and the rest of this post asks that rule by rule.

## The ten rules, and what we found

The rule titles below are quoted from the paper.[^1] The notes after each are what we could confirm in documentation we read; where we found nothing, we say so.

1. **"For Every Result, Keep Track of How It Was Produced."** The paper says: "Whenever a result may be of potential interest, keep track of how it was produced." Engines now write some of this down. Snakemake's documentation says it stores provenance information in the `.snakemake/metadata` directory by default.[^3] Nextflow's documentation describes an experimental data lineage feature, added in version 25.04, that covers workflow runs, task executions and output files, and says it does not record tasks that failed or were aborted.[^4] Both are partial and one is experimental, so it is worth asking how much of rule 1 you can rely on without checking.
2. **"Avoid Manual Data Manipulation Steps."** The paper says: "Whenever possible, rely on the execution of programs instead of manual procedures to modify data."[^1] A workflow engine records what it runs. We do not see how it could record what happened to a file in a spreadsheet, which makes this rule feel mostly about people.
3. **"Archive the Exact Versions of All External Programs Used."** Snakemake's documentation describes pinning exact package versions in an environment file, a `<platform>.pin.txt` that freezes an environment, and storing each environment under a hash of its definition.[^5] Nextflow's documentation advises defining a specific version for each tool.[^6] Whether a particular pipeline does so is up to its authors.
4. **"Version Control All Custom Scripts."** Nextflow's documentation notes that Git and Docker track changes over time with version control.[^6] Whether the *run* knows which commit it used is a separate question we have not tested.
5. **"Record All Intermediate Results, When Possible in Standardized Formats."** Nextflow's lineage page mentions intermediate data, but the feature is experimental and we did not read closely what it keeps, so we leave this open.
6. **"For Analyses That Include Randomness, Note Underlying Random Seeds."** We found nothing in the documentation we read about engines recording seeds, so we leave this open.
7. **"Always Store Raw Data behind Plots."** This concerns how figures are made; we found no tool documentation that addresses it.
8. **"Generate Hierarchical Analysis Output, Allowing Layers of Increasing Detail to Be Inspected."** The paper suggests this as a way of presenting results. We did not look for tools that do it.
9. **"Connect Textual Statements to Underlying Results."** The paper mentions Galaxy Pages as one way to integrate analyses with documents.[^1] We have not used it.
10. **"Provide Public Access to Scripts, Runs, and Results."** A sharing decision, not something a record can make for you.

## A newer framing

A 2023 paper in Briefings in Bioinformatics by Ziemann, Poulain and Bora names five pillars of computational reproducibility: literate programming, code version control and sharing, compute environment control, persistent data sharing, and documentation.[^2] We find it interesting that environment control and documentation appear as pillars of their own, because those may be where a run's history is thinnest; we have not checked. It is a different cut from the ten rules rather than a replacement, and we have only read the abstract-level description of the pillars closely.

## A pattern in the list

Reading the ten rules this way, a pattern shows up, though we hold it loosely. The rules about recording what ran (1, 3, 4) are the ones where we found tool documentation. The rules about how people handle data and present results (2, 7, 8, 9, 10) are the ones where we found none. Rules 5 and 6 we simply could not place. We wonder whether that is a real divide or just a gap in what we read.

## Where a record might help, and where it does not

Rule 1 asks, in a sentence, for a record of how each result was made. That was the idea behind Jubilab's earlier work. Jubilab's earlier run-record prototype is not being offered. Jubilab is now building the order-to-result layer for lab work. Early access is open and we are setting up with early adopters, but the order layer is still being built and nothing is released yet.

Such a record touches rule 1 and a little of rule 2. It does nothing for rules 5 to 10 that we would want to promise, and it does not make a result reproducible by itself. Jubilab is not affiliated with or endorsed by the authors of the paper, PLOS, Nextflow, Seqera or Snakemake, and we are not saying any tool satisfies the rules.

For the engine side of rule 1, our guide on [Nextflow provenance and lineage compared](/guides/nextflow-provenance-and-lineage-compared/) goes through what each system records, and [what parameters produced this result](/guides/what-parameters-produced-this-result/) looks at what a good record contains.

## Questions we are still asking

- Do engines record random seeds, and if so, where? We did not find it in the documentation we read.
- What do Nextflow and Snakemake keep as intermediate results, and for how long? We left rule 5 open for that reason.
- Is the divide we noticed, tools for rules 1, 3 and 4 and people for the rest, real? A broader reading of the documentation might change it.
- Would a record that marks manual steps as manual change how people behave around rule 2? We do not know.
- Which of the ten rules would a modern list drop, merge or add? The 2023 paper's five pillars suggest the answer is not obvious.
- We have not checked whether any journal asks authors to follow these rules.

## Sources

- [Ten Simple Rules for Reproducible Computational Research](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1003285) | Sandve, Nekrutenko, Taylor and Hovig, PLOS Computational Biology, 2013 | Accessed: 2026-10-19
- [The five pillars of computational reproducibility: bioinformatics and beyond](https://pmc.ncbi.nlm.nih.gov/articles/PMC10591307/) | Ziemann, Poulain and Bora, Briefings in Bioinformatics, 2023 | Accessed: 2026-10-19
- [Snakemake documentation: Provenance](https://snakemake.readthedocs.io/en/stable/executing/provenance.html) | Snakemake project, Read the Docs | Accessed: 2026-10-19
- [Nextflow documentation: Data lineage](https://docs.seqera.io/nextflow/data-lineage) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [Snakemake documentation: Deployment](https://snakemake.readthedocs.io/en/stable/snakefiles/deployment.html) | Snakemake project, Read the Docs | Accessed: 2026-10-19
- [Nextflow documentation: Sharing pipelines](https://docs.seqera.io/nextflow/sharing) | Seqera, Nextflow documentation | Accessed: 2026-10-19
