---
title: Conda for genomics: export, history or lock file?
description: Three ways to write down a conda environment, what each one keeps when we tried them in a throwaway environment, and the questions we still have about genomics.
slug: conda-environments-genomics-export-history-lock
date: 2026-10-19
updated: 2026-10-19
tags: conda, environments, provenance
summary: Three ways to save a conda environment, what each keeps in a small test, and what we still wonder about for genomics.
image_alt: Three glass jars in a row on a shelf: one holding loose green sprigs, one holding a single pressed leaf, and a sealed capsule crossed by a straight orange dotted line.
---

Pipelines and analyses often rely on a conda environment, and sooner or later someone asks for it: which tools, which versions, from where? Conda gives you a few ways to write an environment down, and they keep different things. This post compares three of them, shows what each produced in a small test we ran, and lists what we could not settle, especially for genomics work that leans on Bioconda.

## What we tried

We created a throwaway environment under `/tmp` with one package, `tqdm`, from the conda-forge channel, using conda 25.11.1 and a package cache outside our home directory. Nothing was installed globally. Three commands then described the same environment in three different ways. This is a tiny environment, so it says little about a large genomics stack; we come back to that below.

## Option 1: export everything

The conda documentation calls `conda env export` the traditional way to write out an environment as YAML.[^1] Run against our test environment, it listed every package, including the ones we never asked for, with a version and a build string for each:

```output Excerpt from our test (tested by us with conda 25.11.1)
channels:
  - conda-forge
  - defaults
dependencies:
  - bzip2=1.0.8=hda65f42_10
  - libzlib=1.3.2=h25fd6f3_3
  - python=3.15.0=h6e52b48_101_cp315
  - tqdm=4.70.1=pyhfa0c392_0
```

That is a lot of detail, and it names the channel. The documentation warns that without the `--from-history` flag, installing from such a file can introduce packages that may not be compatible across platforms.[^1] Some of the build strings in our output, like those for compiled libraries, look platform-specific, but we did not test installing the file on another operating system, so that remains a question for us. The same documentation says the recommended way to export is the newer `conda export` command, which also produced YAML for our environment.[^1] The documentation also says native lockfile export needs conda 26.5 or later; we ran 25.11.1 and did not test it.

## Option 2: only what you asked for

With `--from-history`, the documentation says conda exports only explicitly installed packages and excludes platform-specific dependencies, and that the flag works with the structured formats.[^1] In our test it returned this:

```output Our test, tested by us with conda 25.11.1
channels:
  - defaults
dependencies:
  - tqdm
```

Two things stand out. There is no version at all, so tomorrow's install may give a different `tqdm` from today's. And the channel list shows only `defaults`: we had installed from conda-forge using a command-line option, and the history output did not carry that over. The conda documentation's own example for `--from-history` shows conda-forge kept in the output, so our result differs from it. We saw the channel lost in three ways of creating the environment, and we do not know why or whether it is general. It is a reason to put the channels you rely on in the file yourself.

For genomics this matters. Bioconda's own instructions tell users to add the bioconda and conda-forge channels and set strict channel priority, and say the order is important to avoid problems when solving dependencies.[^3] An environment file that loses a channel could solve differently elsewhere, though we have not reproduced that.

## Option 3: a lock file

A lock file records the resolved packages. The conda-lock project advertises solveless installation from its lock files, meaning installing does not have to run the solver again.[^2] The conda-lock project describes itself as a lightweight library for generating fully reproducible lock files for conda environments, produced by solving for the platforms you choose, and it can read an `environment.yml` as input.[^2] We read its documentation but did not install or run conda-lock for this post, so we cannot say how it behaves on a real Bioconda environment.

Conda itself also has an `explicit` export format with platform-specific URLs.[^1] In our test, `conda list --explicit` produced one URL per package, such as `https://conda.anaconda.org/conda-forge/linux-64/libzlib-1.3.2-h25fd6f3_3.conda`. The conda documentation says explicit files are usually limited to a single platform, whereas lock files can support multiple platforms.[^1]

## Workflow engines have a view too

Snakemake's documentation encourages defining isolated software environments per rule through the `conda` directive, and describes a `<platform>.pin.txt` file next to the environment file that freezes the environment to a certain state; Snakemake tries the pin file first and falls back to the regular file if that fails.[^4] It also stores each environment under a hash of the definition file, so changes to the definition are detected, and it says the pins must be kept current when the environment file changes.[^4] Whether a given Nextflow pipeline pins its environments this way depends on the pipeline, and we have not surveyed that.

## A small comparison

- Export everything: versions and builds for every package, plus channels. Possibly tied to one platform; we did not test other systems.
- From history: short and readable, but in our test no versions and a lost channel.
- Explicit or lock file: the most specific, and the documentation says lock files can span platforms.[^1] More tooling to learn and to keep fresh.

None of these says why a version was chosen or which analysis used the environment. That is a gap in the record, not in conda.

## Where a run record fits

An environment file describes software. A run record would also say which run used it. Imagine opening a result a year later with an environment file in the folder but no way to tell whether it is the one that ran. An earlier Jubilab prototype recorded runs and their parameters. We never settled how best to attach an environment definition to a run, and we would not want to claim more than that. The guide on [what parameters produced a result](/guides/what-parameters-produced-this-result/) discusses what a good record contains. Jubilab is not affiliated with or endorsed by Conda, Anaconda, Bioconda or Snakemake.

## Questions we are still asking

- Do the exports above behave the same on a large Bioconda environment as on our one-package test? We did not try.
- Would the missing conda-forge channel in the `--from-history` output appear for other ways of creating an environment? We saw it once.
- Does installing an exported file on another operating system work? We did not test it.
- How often does a re-solved environment change a genomics result? We found no source that measures this, so we do not claim it.
- Is a lock file worth the extra upkeep for a small team, or is a pinned `environment.yml` enough?
- Where should the environment definition live: in the pipeline repository, next to the results, or in a run record?

## Sources

- [Managing environments (conda user guide)](https://docs.conda.io/projects/conda/en/stable/user-guide/tasks/manage-environments.html) | Conda project, conda documentation | Accessed: 2026-10-19
- [conda-lock documentation](https://conda.github.io/conda-lock/) | conda-lock project | Accessed: 2026-10-19
- [Bioconda: getting started](https://bioconda.github.io/) | Bioconda project | Accessed: 2026-10-19
- [Snakemake documentation: Deployment](https://snakemake.readthedocs.io/en/stable/snakefiles/deployment.html) | Snakemake project, Read the Docs | Accessed: 2026-10-19
