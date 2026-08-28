# FRONTEND BAKEOFF V1

Purpose: choose the best DESIGN_BUILDER for one visual phase using our actual aesthetic, not generic benchmarks.

## Candidates

- Claude Code / Claude Opus 5
- Kimi K3 (or `kimi-latest`)
- Qwen3.8-Max

Optional fourth candidate when useful/cost-effective:
- GLM Latest / current GLM flagship coding model

## Frozen input

Every candidate receives the exact same:

1. canonical git SHA
2. phase packet
3. visual reference screenshots
4. fixture seed/state
5. viewport list
6. allowed paths
7. performance/accessibility gates
8. one browser-feedback iteration maximum

No candidate sees another candidate's result before completion.

## Required outputs

- desktop screenshot 1440x900
- laptop screenshot 1280x800
- mobile screenshot 390x844
- changed-file manifest
- test/build report
- short self-critique (max 10 bullets)

## Blind rank

Rename submissions A/B/C before judging.

100-point rubric:
- information hierarchy: 20
- Ink/REKT identity: 20
- typography + spacing: 15
- dense data legibility: 15
- semantic motion: 10
- responsive design: 10
- performance/implementation risk: 10

A candidate with a Critical truth/provenance/accessibility defect cannot win regardless of visual score.

## Stop

One implementation + one screenshot feedback iteration. No third-pass polishing. Pick the phase winner and move into engineering hardening.
