---
title: Why did my task run again? Nextflow and Snakemake
description: Why a workflow engine reruns a task you expected it to skip: what Nextflow and Snakemake compare, how to see the reason, and why a rerun changes your history.
slug: why-did-my-task-run-again-nextflow-snakemake
date: 2026-10-19
updated: 2026-10-19
tags: nextflow, snakemake, bioinformatics
summary: What Nextflow and Snakemake compare before skipping a task, how to see why one reran, and what a rerun means for history.
image_alt: Two parallel conveyor belts carrying boxes; one box is looped back to the start of its belt by an arrow, with a magnifying glass over it.
---

You resume a pipeline, expect every finished step to be skipped, and one of them runs again. Sometimes the cause is plain, such as a script you edited. Sometimes it is not obvious at all. This post looks at what Nextflow and Snakemake each say they compare, shows how to get the engine to tell you the reason, and describes two small experiments we ran. It also asks what a rerun means for the history of a result, because a rerun is a new event even when the output looks identical.

## What each engine compares

Nextflow's documentation lists what goes into a task's hash: the session ID, task name, container image, modules, Conda or Spack environments, task inputs, the script, referenced global variables and `ext` properties, and whether it is a stub run. Input files are hashed by full path, last-modified timestamp and file size.[^1] An older Seqera post puts it more briefly: the hash takes into account the complete file path, the last modified timestamp, the container ID and the content of the script, among other factors, and if any of these change, the task is re-executed.[^2] That post is from November 2022, so we treat the current documentation as the better guide.

Snakemake's command-line documentation says `--rerun-triggers` defines what triggers the rerunning of a job. The allowed values are `code`, `input`, `mtime`, `params` and `software-env`, and by default all five are used.[^3] So a Snakemake job can rerun because its code, its input, its modification times, its parameters or its software environment changed.

The two engines look at similar things (inputs, code, software, and a timestamp or path), but we would not assume they behave alike in the details.

## Getting Nextflow to show its hashes

The documentation suggests comparing the task hashes of each run with the `-dump-hashes` option, extracting the lines containing `cache hash:` and diffing them, and says `-dump-hashes json` makes the extraction easier.[^1] We tried the plain form on a one-process script that counts lines in a file.

```bash Run, resume, touch the input, resume again
nextflow -log run1.log run main.nf -dump-hashes
nextflow -log run2.log run main.nf -resume -dump-hashes
touch sample.txt
nextflow -log run3.log run main.nf -resume -dump-hashes
grep 'cache hash' run1.log run2.log run3.log
```

```output
run1.log: - [COUNT] cache hash: 0087cab70e6db5ec8af2a19a31d7f0df; mode: STANDARD
run2.log: - [COUNT] cache hash: 0087cab70e6db5ec8af2a19a31d7f0df; mode: STANDARD
run3.log: - [COUNT] cache hash: d69bc42b810cf4162617fd43e616bdba; mode: STANDARD
```

This was tested by us with Nextflow 24.01.0-edge (we trimmed the log prefix and the line tail for readability). The second run reused the cached task and the hash was the same. After `touch sample.txt`, which changes only the modification time and not a single byte of content, the hash changed and the task ran again. That matches the documentation's statement about timestamps, and it is a useful reminder that "the data did not change" and "the engine thinks the input did not change" are different statements.

The Nextflow documentation also mentions some usual suspects: shared file systems such as NFS that may report inconsistent timestamps, for which a `'lenient'` caching mode ignores the timestamp and uses the path and size; processes that merge inputs non-deterministically; and work directories or the `.nextflow/cache` that were removed.[^1] We did not reproduce those three ourselves.

## Asking Snakemake for the reason

Snakemake has several ways to look. We used a three-line rule with a `params` value and Snakemake 9.27.0.

```bash Change a param, then ask what would run
snakemake -c1 count.txt
snakemake -c1 --list-params-changes
snakemake -c1 -n count.txt
```

After we edited the `params` value in the rule, `--list-params-changes` printed `count.txt`, and the dry run printed a reason that began "params have changed since last execution". The documentation describes `--list-params-changes` as listing all output files for which the defined params have changed in the Snakefile.[^3] The dry run also noted that some jobs were triggered by provenance information. Tested by us, on that one rule only.

We also touched the input file of a finished rule and asked for a dry run. In our test with Snakemake 9.27.0 it reported that nothing needed to be done. We do not know why, and we did not dig into it. It is possible that we misunderstood the `mtime` trigger, or that the behaviour depends on the version or on how the outputs were created. We would rather leave that as an open question than guess.

The same documentation lists `--list-changes` for code, input and params, `--summary` for printing a summary of all files created by the workflow, and `--forceall` for forcing execution of a rule and everything it depends on.[^3] We did not exercise those.

## The usual causes, in one list

From the sources above, the causes we would check first are:

1. A file was touched, copied or moved, so its timestamp or path changed even though its content did not.
2. A script, rule code or `params` value changed, including a small edit such as a comment.
3. The container image, module or environment changed.
4. A work directory or cache was deleted, so there was nothing to resume from.
5. Inputs reached the task in a different order or from a different path.

This is a checklist drawn from documentation, not a finding about how often each cause occurs. We have no data on that.

## A rerun is part of the history

When a task reruns, there is a new execution, new outputs and, possibly, a different answer. If the story of a result says "we ran it in March", but half of it was rerun in April, the story has changed in a way that the output files alone will not tell you. The Nextflow lineage documentation says that tasks that failed or were aborted are not recorded, and that when a task is retried the store describes the attempt that succeeded.[^4] That is a sensible design choice, and it also shows why a reader may want an additional record of what happened around it.

Jubilab records runs and keeps them immutable, and it can compare two runs to show which recorded parameters, versions or results differ. It does not explain why an engine decided to rerun a task, and we are not claiming it does. It is not affiliated with or endorsed by Nextflow, Seqera or Snakemake. For the bigger picture of what to write down, see [what parameters produced this result](/guides/what-parameters-produced-this-result/).

## Questions we are still asking

- Why did our Snakemake dry run report nothing to do after we touched an input? We have not tested other versions or rule shapes, and we would like to understand it.
- How closely do `nextflow -dump-hashes` and Snakemake's reasons agree about the same underlying change? We only compared them informally.
- If a rerun produces identical outputs, does it still belong in a record of how a result was made? We lean towards yes, but it is worth asking what readers want.
- Do the causes in our checklist cover most real-world surprises? We have not measured this.
- Will these options and messages stay as they are? Both tools change over time, so check the current documentation for your version.

## Sources

- [Caching and resuming](https://docs.seqera.io/nextflow/cache-and-resume) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [Analysis of Nextflow caching behavior](https://seqera.io/blog/caching-behavior-analysis) | Seqera, blog, 10 November 2022 | Accessed: 2026-10-19
- [Snakemake command-line interface](https://snakemake.readthedocs.io/en/stable/executing/cli.html) | Snakemake project, Read the Docs | Accessed: 2026-10-19
- [Data lineage](https://docs.seqera.io/nextflow/data-lineage) | Seqera, Nextflow documentation | Accessed: 2026-10-19
