# FRONTEND AGENT WORKFLOW V1

Status: FROZEN for REKT//INK frontend phases.

## Goal

Stop searching for one universal frontend model. Use a small specialist stack against one frozen brief, one repo state, one screenshot set, and one acceptance contract.

Canonical loop:

`SPEC -> BUILD -> RENDER -> INSPECT -> CRITIQUE -> REVISE -> ENGINEERING REVIEW -> COMMIT`

The roles are stable. The provider/model assigned to a role may change when quotas, pricing, or model availability change.

## Roles

### DESIGN_BUILDER
Preferred: Claude Code + Claude Opus 5 (high effort / Max where available).
Fallback order: Kimi latest/Kimi K3 -> Qwen3.8-Max -> GLM Latest (currently GLM 5.3 on OpenRouter).

Owns:
- layout and information hierarchy
- visual system and typography
- motion grammar
- UX states and responsive behavior
- component structure
- implementation needed to realize the approved design

Does not own:
- changing data/event semantics
- weakening provenance
- changing safety/truth invariants
- replacing approved core libraries without explicit phase authority

### VISUAL_RED_TEAM
Preferred: Kimi K3 via OpenRouter (`~moonshotai/kimi-latest` is acceptable for latest-family routing).
Fallback: Claude Opus 5 in critic-only mode, then GLM/Qwen multimodal critic.

Input:
- frozen brief
- screenshots at required breakpoints
- optionally short screen recordings
- no builder rationale until after first critique

Attacks:
- generic AI-looking composition
- bad spacing/rhythm
- visual hierarchy failures
- fake-retro/cyberpunk cliches
- weak Ink identity
- illegible dense data
- animation that carries no state
- poor mobile adaptation
- inconsistency between screens

Output is findings only: Critical / High / Medium / Low with screenshot coordinates or component names when possible. It does not edit code in this role.

### IMPLEMENTATION_WORKER
Preferred: Qwen3.8-Max for repetitive/bounded implementation.
Fallback: GLM Latest (currently GLM 5.3) -> Kimi K3.

Owns only an approved changeset:
- repetitive components
- responsive variants
- wiring
- test fixture expansion
- accessibility plumbing
- mechanical refactors

It must not redesign beyond the approved visual repair list.

### ENGINEERING_AUTHORITY
Preferred: Codex / GPT-5.6 Sol.

Owns final technical gate:
- React render frequency and state topology
- chart lifecycle / incremental updates
- API and WebSocket flows
- TypeScript contracts
- deterministic fixture/replay semantics
- accessibility
- security of untrusted crypto metadata
- bundle/dependency discipline
- performance budgets / long tasks / frame time
- CI and tests

Engineering authority may reject a visually strong build if correctness/performance contracts fail.

## Bounded phase policy

For each phase:

1. IMPLEMENT
2. TEST + RENDER
3. ONE independent visual hostile review where relevant
4. Fix Critical/High findings only
5. ONE targeted re-review only if Critical/High fixes were required
6. ENGINEERING REVIEW
7. Fix Critical/High engineering findings
8. ONE engineering re-review only if Critical/High fixes were required
9. COMMIT
10. MOVE FORWARD

Medium/Low findings go to backlog unless they invalidate the phase objective, evidence, a frozen invariant, accessibility/safety, or performance gate.

No infinite polish loop.

## Canonical handoff packet

Every agent receives the same packet:

- `docs/NORTH_STAR.md` or current product objective
- `docs/ARCHITECTURE_V1.md`
- `docs/FRONTEND_AGENT_WORKFLOW_V1.md`
- current phase packet under `docs/agent-packets/`
- exact git commit SHA
- allowed file paths
- forbidden changes
- target screenshots / visual reference
- acceptance tests
- performance budget
- known issues

Each agent must report:

- files changed
- tests run and exact results
- screenshots generated
- deviations from the frozen contract
- unresolved blockers
- final verdict

## Blind model bakeoff

When choosing the best design builder for a new visual phase, do not trust generic rankings.

Run the smallest useful experiment:

1. Freeze one page brief and fixture state.
2. Give the exact same brief to Claude Opus 5, Kimi K3, and Qwen3.8-Max (or current replacements).
3. Allow exactly one browser/screenshot feedback iteration each.
4. Render the same desktop + mobile viewports.
5. Remove model names and blind-rank outputs using the scorecard below.
6. Choose the winner for that phase only.

Scorecard (100):
- information hierarchy 20
- visual identity / Ink fit 20
- typography + spacing 15
- data legibility 15
- motion semantics 10
- responsive behavior 10
- implementation plausibility/performance risk 10

The winner becomes DESIGN_BUILDER for that phase. This is not a permanent model ranking.

## Quota / provider failover

A quota failure must not change the phase contract.

If Claude Code runs out:
1. save current git diff and screenshots
2. write `HANDOFF_CURRENT.md` with exact completed/uncompleted work
3. hand the same phase packet to Qwen3.8-Max, GLM latest, or Kimi K3
4. require the replacement worker to read the existing diff before editing
5. continue from the same acceptance criteria

Never restart the design from scratch merely because a model changed.

## Secret handling

Never place API keys, OpenRouter keys, React Bits Pro keys, or provider credentials in prompts or committed files.

Agents receive environment variable names only. Licensed React Bits source may be vendored locally, but license credentials remain outside git.
