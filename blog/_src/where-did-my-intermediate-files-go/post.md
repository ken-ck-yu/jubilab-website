---
title: Where did my intermediate files go?
description: Work directories get purged, cleaned or deleted to save space. What that does to resume, what is worth keeping, and what a record can still say afterwards.
slug: where-did-my-intermediate-files-go
date: 2026-10-19
updated: 2026-10-19
tags: nextflow, storage, provenance
summary: Work directories get cleaned or purged. What that does to resume, what to keep, and what a record can still say afterwards.
image_alt: A sandcastle with a doorway on a beach with a wave curling in toward it, and a small sealed jar with a check mark standing safely to one side.
---

Imagine you come back to a project after a few months and the `work` directory is empty, or half empty. Nobody deleted it on purpose: a cluster policy, a cleanup setting or a quota did. The final results are still there, the figures look fine, and then someone asks you to rerun one step. This post explains what a Nextflow work directory is for, what happens to resume when it disappears, and what we think is worth keeping before it does. We tested a few behaviours on a toy pipeline, and for the rest we rely on the documentation and say so.

## Three places, three jobs

It helps to separate three locations that often get blurred.

- **The work directory** is scratch space for the engine. The Nextflow documentation says it stores the files used during a pipeline run, with one folder per task named by a hash, where the task's inputs, script and outputs sit.[^1]
- **The published results** are what the pipeline copies out for you. The `publishDir` directive documents several modes, and the default is `symlink`, which creates an absolute symbolic link in the publish directory for each output file; `copy` copies the files, and `move` moves them.[^2] A symlink that points into a work directory is only as durable as that work directory.
- **The record** is any description of what ran, which can outlive both.

We ran a toy two-step pipeline with `publishDir` in `copy` mode, and the published file stayed in `results/` after we removed files from `work/`. With the default `symlink` mode the answer would differ, and we did not test it, so check which mode your pipeline uses.

## Purges, cleanup and quotas

Several different things can empty a work directory, and they are not the same.

**Site purge policies.** Some clusters delete old scratch files automatically. Purdue's research computing page, as one public example, says files become eligible after 60 days on most of its clusters and 30 days on one named system, judged by last access and modification time. It says renaming a file or changing permissions does not protect it, and that users should not expect a warning.[^3] That is one site. Policies differ between institutions, so we would read your own site's page rather than assume.

**Cleanup settings.** Nextflow has a `cleanup` option which, per its configuration reference, deletes all files associated with a run in the work directory when the run completes successfully, and which the page says will prevent the use of resume on subsequent executions of that run.[^4] At least one institutional profile turns it on. The nf-core configuration page for one institution says its profile enables Nextflow cleanup on successful completion to save space, and shows an option to keep the directory for debugging.[^5] If you launch a pipeline with someone else's profile, it is worth reading what it sets.

**The `nextflow clean` command.** It is documented as removing files from previous runs, with `-n` to print what would be removed without deleting and `-k` to remove only temporary files while keeping the log entries.[^6] We ran `nextflow clean -n` (Nextflow 24.01.0-edge) on the toy project and it printed two "Would remove" lines, one per task folder of the latest run, and deleted nothing.

## What happens to resume

The cache-and-resume documentation says resume needs both a matching cache entry and intact outputs, and that it is important to preserve both the task cache and the work directories to resume runs successfully.[^1] A Seqera community thread asks exactly the practical version of this: whether deleting trimmed FASTQs from the work directory of finished samples would make a resumed run redo the trimming. A reply from Phil Ewels in that thread answers that yes, Nextflow would rerun the task and the tasks downstream of it, and suggests splitting samples into batches or using scratch storage as alternatives.[^7]

We saw the same on our toy: after deleting one task's output file from `work/`, `-resume` executed both tasks again, each in a new work folder. That is a two-task example, not a measurement of anything larger, but it matches the documentation. The practical lesson is simple. A tidy-up that frees disk space may also remove your ability to skip work, and on a large cohort that could be hours or days of compute. We do not have numbers for that, so we will not guess them.

## What to keep

Rule 5 of "Ten Simple Rules for Reproducible Computational Research" is to record all intermediate results, when possible in standardized formats.[^8] That is a reasonable ideal and often an unaffordable one: a work directory can hold terabytes (the community thread above mentions 3 to 4 TB of trimmed FASTQs for one project). So the real question is which small things are worth keeping when the large things go.

1. **Final outputs**, in a location with its own retention rules, not scratch.
2. **The pipeline configuration and parameters** actually used, not the defaults you remember.
3. **Pipeline and tool versions**, and container or environment identifiers.
4. **Logs and reports** the engine produced, including the run history that `nextflow log` reads.
5. **Checksums of inputs and outputs**, which are tiny and let you notice later that a file is not the one a run used.
6. **A list of what was deleted and why**, even a single line in a notes file.

None of these lets you resume. They let you say what was done, which is a different and smaller promise. Our [guide on what parameters produced a result](/guides/what-parameters-produced-this-result/) covers items 2 and 3 in more detail.

## What a record can say when the files are gone

A record can still say which run made a result, with which parameters and inputs, even if the intermediate files have been purged. What it cannot say is what was inside those files. We think the honest version of a record marks the difference: this fact was seen directly when the run happened; this file used to exist and we can no longer open it.

## Where Jubilab is now

An earlier Jubilab prototype recorded the locations of the files a run used (and, when asked, their size, timestamp and checksum), never their contents. It was not a data store, so if a purge removed a file the record could be left pointing to something that no longer existed. Jubilab is one place to order lab work and follow it to results. Register for early access: we invite small groups first. Jubilab is not affiliated with or endorsed by Nextflow, Seqera, nf-core, Tufts University, Purdue University or the authors cited here.

## Questions we are still asking

- How many labs lose a work directory they still needed? We have no evidence, only the public threads and policy pages above.
- We wonder whether `copy` mode for publishing is the safer default for projects on purged storage. We tested one toy case and nothing larger, and `symlink` is the documented default, so we would like to hear what teams choose and why.
- Is a smaller record that survives a purge worth more than a complete one that does not? We lean that way but have not tested it.
- Policies like Purdue's are site specific. It is worth asking whether your own site's page says anything about project storage versus scratch, and how people find out.
- What is a fair way for a record to show that a referenced file has gone? We have not settled this.

## Sources

- [Cache and resume](https://docs.seqera.io/nextflow/cache-and-resume) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [publishDir directive](https://docs.seqera.io/nextflow/reference/process/directives/publish-dir) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [Scratch file purging policy](https://rcac.purdue.edu/policies/scratchpurge) | Rosen Center for Advanced Computing, Purdue University | Accessed: 2026-10-19
- [Configuration: unscoped options](https://docs.seqera.io/nextflow/reference/config/unscoped) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [nf-core/configs: Tufts](https://nf-co.re/configs/tufts.html) | nf-core community | Accessed: 2026-10-19
- [nextflow clean (CLI reference)](https://docs.seqera.io/nextflow/reference/cli/clean) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [Does -resume re-run tasks if input files are deleted from the work directory?](https://community.seqera.io/t/does-resume-re-run-tasks-if-input-files-are-deleted-from-the-work-directory/2584) | Seqera community forum | Accessed: 2026-10-19
- [Ten Simple Rules for Reproducible Computational Research](https://pmc.ncbi.nlm.nih.gov/articles/PMC3812051/) | Sandve, Nekrutenko, Taylor and Hovig, PLOS Computational Biology, 2013 | Accessed: 2026-10-19
