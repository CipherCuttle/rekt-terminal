# INKUBATOR // Build History Map v0

Standalone read-only proof for the Builder History / Project Life Map concept.

## What this demo proves

- loads a GitHub user's public repositories directly from the GitHub REST API;
- renders repository lifetimes on a chronological Life Map;
- renders an explicit Project Constellation without inventing arbitrary relationship edges;
- distinguishes `OBSERVED` relationship evidence from seed `CLAIMED` relationships;
- hydrates a selected project's recent authored commit history on demand;
- does **not** convert repository size, commit count, or line count into fake hours-worked estimates;
- is responsive enough to inspect from a phone through GitHack.

## Libraries

Pinned CDN proof dependencies:

- D3 `7.9.0` — chronological scales / Life Map primitives;
- Cytoscape.js `3.34.3` — interactive constellation graph;
- Apache ECharts `6.1.0` — selected-project history chart.

These are proof dependencies, not yet canonical Inkubator production dependencies.

## Truth / privacy boundary

This demo is deliberately public-data-only and never asks for a GitHub token. Private repositories and complete contribution history require the existing Inkubator GitHub App trust boundary.

Current relationship evidence:

- GitHub fork-parent relationship → `OBSERVED`;
- explicit seed project-family relationships → `CLAIMED`;
- temporal proximity, similar language, similar name, stars, repository size, and commit volume do **not** automatically create relationship truth.

## Production direction if the proof is accepted

1. move ingestion behind the existing authenticated Inkubator GitHub App;
2. persist normalized project-history observations in Postgres;
3. full-history worker derives transparent activity dimensions (active days, commits, reviews, releases, tests/docs/config changes, surviving-code measures where justified);
4. add a versioned `project_relationships` model with provenance / truth class;
5. production UI target remains React-based, with React Flow + ELK.js preferred for editable semantic project maps and ECharts for quantitative drilldowns;
6. never infer or display hours worked from Git activity alone.

## Non-goals

- no GitHub OAuth/PAT in a static browser demo;
- no private repository exposure;
- no universal XP / productivity score;
- no AI-created authoritative relationships;
- no canonical Inkubator state mutation.
