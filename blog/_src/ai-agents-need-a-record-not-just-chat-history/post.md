---
title: AI agents in the lab need a record, not a chat history
description: AI agents are starting to run bioinformatics tools. Why a chat log is not a record of how a result was made, and what we want a lab record to give them.
slug: ai-agents-need-a-record-not-just-chat-history
date: 2026-10-19
updated: 2026-10-19
tags: provenance, ai-agents, vision
summary: Agents can run analyses, but a chat transcript is not a record of how a result was made. Our vision, and what is not built yet.
image_alt: A small robot hand reaching toward a glass cabinet that holds an open ledger, with one page marked by a dotted question mark.
---

Imagine asking an AI assistant to rerun last month's variant calling on a new cohort, and getting back a tidy summary and a results folder. A week later a colleague asks which reference build it used. The honest answer is somewhere in a chat transcript, if the assistant said it at all. We think this is going to be an ordinary situation for labs, and that it makes a durable record of how results were made more important, not less. This post is a vision piece. Where we describe what we want to build, we say so, and AI-agent access to Jubilab is not available today.

## What agents are starting to do

Researchers are building systems that connect language models to analysis tools. One example is BRAD, described in *Bioinformatics* in 2025 as an agentic system that connects large language models to external tools, data sources and custom software; the paper presents it as a prototype built on LangChain, with one agent that runs external Python pipelines, such as a biomarker selection workflow on RNA-seq data.[^1] The authors write that commercial AI tools can "obscure data provenance", which is the problem they set out to address.[^1]

Another is a 2026 allocation description from a Swedish research computing project, NAISS, which says it aims to build an agent that runs single-cell analyses through a restricted set of predefined operations.[^2] That is a project description of what the team intends to build, not a published result, and we cite it as a statement of design intent only.

We are not claiming this is widespread. We do not know how many labs use agents on real data today, and we have not found a figure we could cite.

## What goes missing when an agent runs the commands

When a person runs a pipeline, they leave some traces: a shell history, a launch script, perhaps a notebook. When an agent runs it on their behalf, we wonder what the equivalent traces are. A few things seem easy to lose:

- The instruction that started it, and how the agent interpreted it.
- The exact command the agent chose, including parameters it filled in itself.
- The tool and model versions that were in use at the time.
- What the agent did when something failed, such as retrying with different settings.
- Which results it read, and which it only summarised.

The BRAD paper describes a JSON log of each interaction that includes the prompt, the output, the model settings, the reasoning and the sources used.[^1] That is one answer for the conversational side. Our question is about the other side: the record of the analysis itself, which should make sense whether a person or an agent launched it.

## Design lessons we find convincing

Three ideas keep coming up in what we have read.

**Typed tools instead of free-form commands.** The NAISS description says the agent is restricted to typed tools, and that it records every tool call and result, and links its reports to the engine's provenance.[^2] It says the agent is not allowed to run arbitrary shell commands.[^2] Whether such a restriction is workable for a messy real analysis is an open question to us.

**Read-only by default.** LabKey's documentation for its MCP server says the server itself exposes only read-only tools, and also says that what limits the connected agent is the API key it is given, not the server, so it recommends a role-restricted key.[^3] We read that as an honest statement of where the real boundary sits.

**Make the data legible to a model.** The MCPmed preprint argues that bioinformatics web servers, built around human interfaces, are hard for language models to read, and proposes adapting them with the Model Context Protocol.[^4] MCP is described by its own site as an open-source standard for connecting AI applications to external systems.[^5] The preprint reports implementations for three resources; we have not reproduced its results.

## A record that can say "I cannot tell"

The most important property for an agent-facing record may be what it does when it does not know. A language model asked about a result can produce a fluent answer whether or not the facts exist. A record should not do that.

Jubilab's query endpoint already works this way. It answers only from entities it can resolve in the record, and otherwise says it cannot determine the answer. Every recorded fact carries an evidence status, verified, inferred, manual or unknown, so a reader, human or not, can tell a value that was read from a log from one that was guessed. The server makes no outbound network calls and has no AI model in it. These behaviours are the kind of foundation we think an agent would need, and we think they matter more if the reader is a machine that might smooth over gaps.

## Where we are heading

We want a lab's agents and its people to read the same history. Our plan is a read-only way for an AI agent to ask Jubilab questions such as "what produced this file?" or "what differs between these two runs?" and to get answers with their evidence statuses, or an honest "cannot determine". We have in mind MCP as one route, and we have not built it. No agent access exists in the product today, and we have not tested any agent against it. We also have not decided what an agent should be allowed to write, if anything; our instinct is that it should start with nothing.

What you can use now is the human side: trace a result back to its run, inputs and parameters, compare two runs and see which recorded values differ, with runs kept as history that cannot be edited. Jubilab records Nextflow runs live or from import, imports Snakemake runs, and wraps other commands with a native bash wrapper. For how we think about those records, see our guide on [Nextflow provenance and lineage](/guides/nextflow-provenance-and-lineage-compared/). Jubilab is not affiliated with or endorsed by the authors, LabKey, NAISS or the Model Context Protocol project mentioned here, and it does not integrate with any of them.

## Questions we are still asking

- Is a record of the analysis enough, or do labs also need to keep the conversation that led to it? We wonder where one ends and the other begins.
- If an agent can only use typed, logged tools, does it still help with a messy analysis? We have not tested this.
- What should an agent be allowed to ask a lab record, and what should it never be allowed to change? We lean towards read-only, but it is worth asking whether that is too cautious.
- LabKey's documentation puts the boundary in the API key. Should a record carry its own permissions, or is that a job for the layer around it?
- How should a record show that an answer came from an agent's summary and not from a recorded fact?
- We do not know how widely agents are used in labs today. If you run them, we would like to hear what you wish you had kept.

## Sources

- [Automatic biomarker discovery and enrichment with BRAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC12064167/) | Pickard et al., Bioinformatics, 2025 (PubMed Central) | Accessed: 2026-10-19
- [Agentic single-cell and multiomic analysis with local large language models](https://supr.naiss.se/public/project/38272/) | NAISS project description, Linköping University (project plan, not a published result) | Accessed: 2026-10-19
- [LabKey documentation: MCP](https://www.labkey.org/Documentation/wiki-page.view?name=mcp) | LabKey | Accessed: 2026-10-19
- [MCPmed: A Call for MCP-Enabled Bioinformatics Web Services for LLM-Driven Discovery](https://arxiv.org/abs/2507.08055) | Flotho et al., arXiv:2507.08055 (preprint) | Accessed: 2026-10-19
- [What is the Model Context Protocol (MCP)?](https://modelcontextprotocol.io/docs/getting-started/intro) | Model Context Protocol project | Accessed: 2026-10-19
