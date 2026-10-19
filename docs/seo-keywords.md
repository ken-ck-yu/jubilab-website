# Search keywords (2026-10-18)

Each term is used only in a sentence a person would write, only where it is true, and never as a list in the body. "Not used" terms are left out on purpose. Nothing here is measured search volume; these are the words bioinformatics people use, chosen by judgement. Re-check in Search Console (Performance > Queries) once data exists.

| Term | Why it matters | Where used |
|---|---|---|
| data provenance | Core concept people search for | title, meta/OG/Twitter description, hero lede, JSON-LD, FAQ 1 and 2, FAQ heading, llms.txt |
| data lineage / lineage | Same, graph-oriented searchers | title, hero lede, integrations H2, FAQ 1, llms.txt |
| bioinformatics pipelines | Who it is for, in their words | title, hero lede, FAQ, llms.txt |
| Nextflow, Snakemake | Highest-intent tool names; both shipped | description, integrations H2 and cards, FAQ 3, llms.txt |
| reproducibility | Funder and journal driver | issues H2 ("reproducibility and data issues"), FAQ 1 ("reproduced"), llms.txt avoids "reproducible results" (forbidden claim) |
| audit trail | Compliance-minded buyers | FAQ 1, llms.txt |
| reference genome build, GRCh37, GRCh38 | A very specific, frequent pain | issues list, "how" questions, FAQ 4, llms.txt |
| sample swap | Frequent failure people search | Catch card, issues list, FAQ 4 (planned, marked as not available), llms.txt |
| VCF, BAM (file headers) | What the capture reads | FAQ 4 |
| variant calling, cohort | Typical workload / demo terms | FAQ 2 (variant calling), demo project, terminal session ("Variant calling", Cohort A) |
| genomics, computational genomics, genomics data management, bioinformatics data management | Category words | "how" H2 (genomics provenance), FAQ 2 |
| metadata | Answers "does it store my data" | FAQ 6 |
| workflow management / workflow engine | Category of the tools we sit beside | FAQ 5, integrations intro ("pipelines") |
| LIMS, ELN | Tools people compare or combine with | "complements your LIMS or ELN" in the integrations intro, FAQ 5, llms.txt |
| Benchling, DNAnexus, Terra | Comparison searches | FAQ 5 only, as examples we are NOT integrated with, with the non-affiliation sentence |
| Seqera | Planned integration | integrations "Where we are heading", FAQ not repeated, llms.txt (planned) |
| Seqera/Parabricks/BioNeMo/DeepMind/MCP/notebooks/GitHub | Planned | integrations "Where we are heading", llms.txt (marked not available) |

## Guides (2026-10-19)

The guides at `/guides/` carry the long-tail phrasing people use (taken from forum thread titles in `research/website-discovery-round-1.md`; no volume data exists, check Search Console). Target query per guide, used in title, H1, intro and sources:

| Guide | Target query | URL |
|---|---|---|
| Reference genome build of a VCF or BAM | check reference genome build of a VCF; which genome build is my VCF | `/guides/reference-genome-build-vcf-bam/` |
| What parameters produced this result | which parameters produced this result; nextflow save params | `/guides/what-parameters-produced-this-result/` |
| Nextflow provenance and lineage compared | nextflow provenance; nextflow lineage | `/guides/nextflow-provenance-and-lineage-compared/` |

Guide-only rules: the words audit, regulated, compliance, GxP and validated (and "reproducible results", "guarantee", "first", "only", "fastest", any swap-rate statistic) stay out until legal review; `review/check-seo.py` and `tests/guides.test.mjs` fail the build if they appear in a guide. Guides name Nextflow, Seqera Platform and Snakemake because the reader's question is about them, always from first-party documentation, with a review date; they never position Jubilab as an alternative to any of them. They also name bcftools, samtools, PLINK, UCSC and Ensembl as tools and data sources used in the examples, and no integration is implied.

## Left out on purpose

- nf-core, Cromwell/WDL, Galaxy, GATK, DeepVariant, VEP: no import or tested support, and naming them would suggest it. The bash wrapper can record any command, but we do not say it "supports" these.
- Illumina Connected Analytics, Seven Bridges, Arvados: low relevance now; naming many vendors reads as a keyword list. Candidates for a later comparison page if the owner approves.
- FAIR data, research data management, MLOps for biology, experiment tracking: we do not claim FAIR compliance; the others describe a broader product than what exists and would pull the wrong searchers. Revisit when the product covers them.
- "first", "only", "fastest", "#1", "reproducible results": owner rules and positioning section 5.
