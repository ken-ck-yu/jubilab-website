---
title: Local-first for lab data: what stays on your machine
description: What local-first software means for sequencing labs, which of its ideals fit a provenance record, where the cloud still helps, and how our earlier work used it.
slug: local-first-for-lab-data
date: 2026-10-19
updated: 2026-10-19
tags: local-first, provenance, vision
summary: Local-first ideas applied to lab records: what stays on your machine, where the cloud helps, and how our earlier work used them.
image_alt: A laptop with a small house-shaped roof on its screen, and a thin cloud far away at the edge of the picture, joined to it by a dotted line.
---

A sequencing run produces files that are large, sometimes sensitive, and sometimes sit on a cluster with no route to the wider internet. The record of how those files were made is small by comparison, but it is only useful if you can still read it in five years. This post asks what "local-first" software, an idea from the programming world, would mean for that record. It is partly a vision piece, so we separate what an earlier Jubilab prototype did from what we are only asking about.

## The seven ideals, in plain words

In 2019 Martin Kleppmann, Adam Wiggins, Peter van Hardenberg and Mark McGranaghan published an essay at Ink & Switch that names seven ideals for local-first software.[^1] As we read it, they are:

1. No spinners: work responds at once, because the data is on your own device.
2. Your work is not trapped on one device.
3. The network is optional: the essay says the user can read and write the data at any time, "even while offline".
4. Seamless collaboration with colleagues.
5. The Long Now: work should stay accessible "indefinitely, even after the company that produced the software is gone".
6. Security and privacy by default, with the essay noting that local devices store only your own data rather than a central database of everybody's.
7. You retain ultimate ownership and control of the data.

The essay is about collaborative documents and apps, not genomics, and we are borrowing its vocabulary rather than claiming it endorses anything here. It also asks a hard question of its own: how to get the benefits of cloud collaboration without giving up ownership. We have not seen a genomics-specific treatment, and we would be glad to be pointed to one.

## Which ideals seem to matter for a lab record

We find four of the seven most relevant to a record of how results were made. This is our judgement, not a finding.

**The network is optional.** Some clusters restrict outbound access; we have not measured how common that is. A record that needs a connection to a vendor's service before it can be written or read is awkward there. The earlier prototype's command line tool always wrote records to a local spool file first and sent them with a separate sync command, so recording worked with no network at all.

**Security and privacy by default.** The record of a run can include file names, paths and parameters that you would rather not send anywhere. That prototype's design was that it recorded metadata about your data, not the data itself, and linked to files where they already lived. Its command line tool sent metadata only. We deliberately do not describe this in terms of any law, since that is a question for specialists and we are not one.

**The Long Now.** Will you be able to open this record in ten years? The earlier prototype used plain, documented storage: each project was a single SQLite file in a data directory you controlled. The SQLite team says it cannot absolutely promise this, but that it plans as if it will support SQLite until 2050, and that database files created today should be readable by future versions.[^2] That is a plan by the SQLite team, and it says nothing about Jubilab itself surviving. It does mean the file is not locked inside our application.

**Ownership and control.** If the record sits in a file on a machine you run, you decide who has it, where it is backed up and when it is deleted.

Ideals about real-time collaboration and syncing across many devices are less obvious for this problem. We wonder whether a lab needs them for a provenance record or only for the documents around it.

## Local records are not new

Several workflow tools already write provenance to local disk. Snakemake, according to its documentation, stores provenance information by default in the `.snakemake/metadata` directory, and notes that this can cause problems on networked filesystems.[^3] Nextflow's experimental data lineage feature, added in version 25.04, keeps its store in a `.lineage` directory in the current working directory, which can be moved with a configuration setting.[^4] Local is not new, and we do not claim it is unique to us. The difference we are aiming for is one record across tools, rather than one per engine.

## Where the cloud still makes sense

It would be unfair to treat the cloud as the enemy. Shared services are easier to start, easier to give a collaborator access to, and do not need a person to keep a server running. A team with no one to run a service, or a consortium that needs one shared view across institutions, may reasonably choose a hosted option. We wonder where the line sits for different labs, and we do not think there is one answer.

## Where Jubilab is now

The points above about spool files, a local data directory and a single SQLite file describe the earlier prototype, not something you can use today. Jubilab is one place to order lab work and follow it to results. Register for early access: we invite small groups first. See our guide on [Nextflow provenance and lineage](/guides/nextflow-provenance-and-lineage-compared/) for how run records relate to each engine's own. Jubilab is not affiliated with or endorsed by Ink & Switch, SQLite, Nextflow or Snakemake.

## Questions we are still asking

- Is a local record enough for a team, or does a shared lab need a way to merge records from several machines? We do not yet know what a good answer looks like.
- What should "metadata only" include? File paths can reveal project names and sample identifiers. It is worth asking what a lab would want hidden even from its own record.
- How would a local record be backed up and restored without surprising people? We have opinions but have not studied how labs handle this.
- If a record is local, how should two labs share part of it, for instance with a collaborator or a reviewer, without exporting more than intended?
- The SQLite team's 2050 intent is reassuring, but we wonder whether file format longevity is the real risk, or whether it is simply people losing the folder.
- Are there labs for whom a hosted service is the better choice, and what would they need from it?

## Sources

- [Local-first software: You own your data, in spite of the cloud](https://www.inkandswitch.com/essay/local-first/) | Kleppmann, Wiggins, van Hardenberg and McGranaghan, Ink & Switch, April 2019 | Accessed: 2026-10-19
- [Long Term Support](https://www.sqlite.org/lts.html) | SQLite project | Accessed: 2026-10-19
- [Snakemake documentation: Provenance](https://snakemake.readthedocs.io/en/stable/executing/provenance.html) | Snakemake project, Read the Docs | Accessed: 2026-10-19
- [Nextflow documentation: Data lineage](https://docs.seqera.io/nextflow/data-lineage) | Seqera, Nextflow documentation | Accessed: 2026-10-19
