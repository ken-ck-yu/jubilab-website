---
title: Pin your containers by digest, not by tag
description: A tag such as python:3.12-slim is a label that can point to a different image tomorrow. A digest names one image. How to find, use and record it in a pipeline.
slug: pin-your-containers-by-digest-not-by-tag
date: 2026-10-19
updated: 2026-10-19
tags: containers, nextflow, bioinformatics
summary: A tag is a label that can move; a digest names one image. How to find, use and write down the digest a pipeline ran with.
image_alt: A shipping container with a round seal on its door sits on a dock, while a paper tag on a long ribbon floats away from it in the wind.
---

Most pipelines name their software with a tag, for example `python:3.12-slim`. A tag is a label chosen by whoever publishes the image, and nothing in the name itself says the label will keep pointing at the same bytes. A digest is different: it is an identifier for one specific image. This post shows how to find a digest, how to use it in a Nextflow or Snakemake pipeline, what you give up by pinning, and what we think a run record should write down.

## Tags and digests in one minute

Docker's documentation says that when you use tags you can pull an image again to get the most up-to-date version of it, whereas pulling by digest lets you specify exactly which version of an image to pull.[^1] The same page describes pinning an image to a digest as a way to make sure the image you are using is always the same.[^1]

For a rerun six months from now, that difference matters. Imagine you run a pipeline in October with `python:3.12-slim`, and someone reruns it in April. Whether the two runs used the same image depends on whether the publisher moved the tag in between. Some publishers do move tags, for example to ship a patched build, and that can be a good thing; the point is that the tag alone does not tell you. We do not know how often this changes results in bioinformatics, and we have not measured it. It is worth asking, though, whether you would be able to tell.

## Finding the digest

If you have already pulled the image, Docker can show it. We ran these on a python:3.12-slim image pulled locally (119 MB):

```bash Show the registry digest of a pulled image
docker image ls --digests python
docker inspect python:3.12-slim --format '{{index .RepoDigests 0}}'
```

```output
python@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1
```

One command lists a DIGEST column; the other prints the name and digest in a form you can paste into a pipeline. In our test, this registry digest was different from the local image ID that `docker inspect` reports as `.Id`, so be careful which one you copy. We looked at one image only and have not checked how this behaves for every registry or Docker version.

### The multi-platform trap

Some images are multi-platform. Docker's documentation says a multi-platform image contains a manifest list pointing to multiple manifests, and that Docker selects the correct variant based on the host's architecture.[^2] The `docker buildx imagetools inspect` command is documented as showing details of an image in the registry, and the example output on that page shows a top-level digest and per-platform manifests whose names end in their own `@sha256` digests.[^3]

This raises a question we have not answered ourselves: if you copy a digest from a laptop and your cluster uses a different architecture, which digest did you copy? We wonder whether the safest habit is to record the top-level digest and the platform together. We have not tested a multi-platform image across architectures.

## Using a digest in Nextflow

The Nextflow container documentation says each process can specify its own container image with the `container` directive.[^4] The page we read uses plain image names in its examples and does not mention digests, so what follows is our test rather than a documented recommendation.

```groovy Process using a digest instead of a tag
process HELLO {
    container 'python@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1'
    script:
    """
    python --version
    """
}
```

With `docker.enabled = true` in `nextflow.config`, tested by us with Nextflow 24.01.0-edge on a tiny script, the task ran and the generated `.command.run` contained a `docker run` line ending with the digest reference. The documentation also says you can use `nextflow inspect` to preview the container each process uses.[^4] We ran it on the same script and it listed the process name and the digest string.

One limitation to know about: a community thread describes a user who pinned a digest while running with Seqera Platform and Wave, and received a Wave error saying that container requests using a SHA256 as tag do not support the `containerConfig` attribute.[^6] The replies describe this as expected, because Wave modifies the images it augments, and mention a freeze-based workaround. We did not use Wave and cannot say whether that workaround is current.

## Using a digest in Snakemake

Snakemake's `container:` directive accepts an image URL, and the documentation example is `container: "docker://joseespinosa/docker-r-ggplot2:1.0"`, which uses a tag.[^5] The page says the allowed URLs are those supported by Apptainer, with `docker://` preferred.[^5] It does not mention digests. Apptainer itself documents image references, but we did not read that page for this post and did not have Apptainer installed, so we have not tested whether `docker://python@sha256:...` works in a rule. We would expect it to be worth trying; we are not claiming it works.

## What you give up

Docker's own page states the cost: a pinned image is not updated, so Docker does not pull updated versions of the image, which may include security updates, and to get an updated image you need to change the digest.[^1] That is a real trade-off, not a footnote.

A routine that some teams might find workable (we have not studied what teams actually do) is:

1. Pin by digest in the pipeline config, with the human-readable tag in a comment next to it.
2. On a schedule you choose, pull the tag again, read what changed, and update the digest on purpose.
3. Write the digest you used into the run record, so a later reader can see which image a result came from.

## What a record could include

When a result is questioned later, "the container was `python:3.12-slim`" is a weaker answer than "the container was this digest". A record could include the image reference exactly as the pipeline asked for it, the digest if one was available, and a note on whether the digest was observed from the run or supplied by someone afterwards. If you only know the tag, that is a fact too, and it deserves a label that says it is less precise.

Jubilab records runs with evidence statuses on each fact (verified, inferred, manual or unknown), keeps runs immutable, and can compare two runs. We are not claiming it captures container digests today; this post is about the habit, and we are still working out which container details belong in a record. Jubilab is not affiliated with or endorsed by Docker, Nextflow, Seqera or Snakemake. For the wider question of what produced a result, see [our guide on parameters](/guides/what-parameters-produced-this-result/) and [the Nextflow lineage comparison](/guides/nextflow-provenance-and-lineage-compared/).

## Questions we are still asking

- How often does a moved tag change a scientific result in practice? We have no numbers and do not want to guess.
- For multi-platform images, which digest should a record keep: the top-level one, the one for the platform that ran, or both?
- Does `docker://image@sha256:...` work in a Snakemake `container:` directive across Apptainer versions? We did not test it.
- How should a team schedule digest updates so that security fixes are not forgotten?
- When a run starts from a tag and the digest is only learned afterwards, how should the record show that the digest is inferred rather than observed?

## Sources

- [docker image pull](https://docs.docker.com/reference/cli/docker/image/pull/) | Docker Inc., Docker Docs | Accessed: 2026-10-19
- [Multi-platform builds](https://docs.docker.com/build/building/multi-platform/) | Docker Inc., Docker Docs | Accessed: 2026-10-19
- [docker buildx imagetools inspect](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/) | Docker Inc., Docker Docs | Accessed: 2026-10-19
- [Containers](https://docs.seqera.io/nextflow/container) | Seqera, Nextflow documentation | Accessed: 2026-10-19
- [Distribution and Reproducibility](https://snakemake.readthedocs.io/en/stable/snakefiles/deployment.html) | Snakemake project, Read the Docs | Accessed: 2026-10-19
- [Wave error when using sha256 as tag does not support the containerConfig](https://community.seqera.io/t/wave-error-when-using-sha256-as-tag-does-not-support-the-containerconfig/706) | Seqera Community forum | Accessed: 2026-10-19
