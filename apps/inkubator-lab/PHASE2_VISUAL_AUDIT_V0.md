# Phase 2 Visual Kill-Criteria Audit V0

Status: INDEPENDENT REVIEW REPAIR / TARGETED RE-REVIEW PENDING

This receipt records the self-hostile visual audit and bounded independent-review repair for `REKT SIGNAL SYSTEM / PHASE 2`.

It is evidence only. It does not grant merge authority, replace the canonical Inkubator documents, or close Phase 2.

## Authority

- Phase-1 closed base: `a2d00f32a6c4ce88342cc2933f0d7144a50c0808`
- Phase-2 branch: `feature/inkubator-signal-system-v0`
- Visual ancestry: existing V3 remains the default Broadcast surface.
- Signal System lab: `?lab=signals&screen=world|command|project|player|ship`
- Truth vocabulary remains: `UNKNOWN / CLAIMED / ACTIVE / OBSERVED / PROVEN / ATTENTION / BLOCKED / STALE / FAILED`.

## Dominant visual failure model

The five golden screens fail Phase 2 if any of the following is true:

1. They look like unrelated mockups instead of one product family.
2. COMMAND loses the hierarchy `Mission → Next Move → Thread → Blocker → Party/Help → Activity → Evidence`.
3. Broadcast effects or React Bits/Three leak into the Cockpit execution path.
4. CLAIMED/OBSERVED/PROVEN become visually ambiguous or repository activity is promoted to proof.
5. Acid green becomes decorative instead of scarce proof semantics.
6. WORLD becomes a generic dashboard rather than the high-atmosphere Broadcast mode.
7. SHIP lets receipt chrome dominate the shipped artifact.
8. Text, state labels, controls, or signal columns overlap at the canonical desktop/mobile fixtures.
9. Keyboard order, reduced-motion behavior, automated accessibility, or responsive hierarchy breaks.
10. Phase 2 silently replaces the existing V3 public landing page.
11. Development fixtures are labeled or presented as LIVE/sourced state.

## Five-screen audit

### WORLD / BROADCAST

PASS after bounded repairs.

- Large Broadcast headline and atmospheric grid remain dominant.
- Meaningful builder Signals, help and latest Ship are instrumented underneath the Broadcast layer.
- A self-hostile pixel audit found a real collision in the signal rail: state label, project name and detail could overlap.
- The rail was repaired to use an explicit state column plus a bounded copy column.
- A Playwright regression now proves every signal state column remains spatially separate from its copy and that name/detail stack vertically.
- Regenerated golden screenshot inspected after the repair: no remaining collision.
- Independent review then identified a truth-label defect: the hard-coded development fixture said `THE WORLD IS LIVE` and `LIVE SIGNALS`.
- The fixture is now unmistakably labeled `ROUND 01 / DEVELOPMENT FIXTURE` and `FIXTURE SIGNALS / NOT LIVE DATA`.
- A unit regression rejects both `THE WORLD IS LIVE` and `LIVE SIGNALS` on the fixture World.

### COMMAND / COCKPIT

PASS.

- Mission is dominant.
- Next Move precedes Thread.
- Thread precedes Blocker.
- Party/Help, Activity and Evidence stay secondary.
- No decorative Broadcast scene is present.
- OBSERVED GitHub state remains visibly distinct from PROVEN.

### PROJECT / COCKPIT

PASS.

- Project identity and artifact context are primary without becoming a generic SaaS project card.
- Thread/Evidence/Activity reuse the same primitives and truth language as COMMAND.
- Private-source/public-safe-projection distinction remains legible.

### PLAYER / COCKPIT

PASS.

- Current Mission precedes historical reputation.
- Ship/Assist history forms the Player story; universal XP/follower mechanics are absent.
- Earned traits use rule-based proof semantics rather than decorative badges.

### SHIP / ARTIFACT

PASS.

- The shipped artifact dominates the viewport.
- Receipt, Party and acceptance-chain metadata remain secondary.
- Public artifact and external test are OBSERVED; only the satisfied Ship rule crosses to PROVEN.
- Acid green is used at the actual proof boundary rather than as ambient branding.

## Automated evidence

The Phase-2 browser/system gate includes:

- semantic-token/source invariant checks;
- unit and truth-semantics tests;
- production typecheck/build;
- route-selected chunk verification and raw bundle budget;
- explicit rejection of React Bits/Three in the Signal System critical chunk;
- Storybook build with accessibility addon;
- axe checks on all five screens;
- five deterministic Playwright golden screenshots;
- keyboard-navigation ordering;
- reduced-motion behavior;
- mobile COMMAND hierarchy;
- runtime Cockpit request isolation from React Bits/Three;
- WORLD signal non-overlap regression;
- fixture World truth-label regression forbidding LIVE claims.

## Pre-freeze findings disposition

- Contrast failures in ACTIVE/STALE Signals: REPAIRED before freeze.
- Primary purple button contrast: REPAIRED before freeze.
- Screenshot path-extension bug: REPAIRED before freeze.
- Brittle keyboard first-Tab assumption: REPAIRED before freeze.
- WORLD signal rail overlap: REPAIRED before freeze and covered by explicit browser geometry regression.

## Independent hostile review — first pass

Reviewed candidate: `84da805835468cd19209e7907c5d3bf09306449a`

Review: `PRR_kwDOUGimxs8AAAABMb5_ew`

Findings:

- Critical: 0
- High/P1: 1
- Other review threads: 0

P1: the fixture WORLD claimed `THE WORLD IS LIVE` / `LIVE SIGNALS` while all displayed content was hard-coded development fixture state. This violated the fail-closed truth rule against presenting simulated/fixture state as sourced LIVE state.

### Bounded repair

Repair commit: `782b7a23124d812e89a6f843b0259e726206b66b`

- `ROUND 01 / THE WORLD IS LIVE` → `ROUND 01 / DEVELOPMENT FIXTURE`.
- `LIVE SIGNALS / NOT SURVEILLANCE` → `FIXTURE SIGNALS / NOT LIVE DATA`.
- Added a semantic unit regression requiring the fixture labels and forbidding both old LIVE claims.
- Regenerated the WORLD golden screenshot under canonical Chromium.
- Ran the complete focused browser gate successfully in one-shot workflow run `34100493926`.
- The one-shot workflow removed itself after committing the bounded repair.

The automatically generated PR workflow runs attached to the GitHub-Actions bot repair commit concluded `action_required` with zero jobs. They are not treated as success evidence. Canonical exact-head verification must therefore run again from a normal user-authored commit containing this receipt before targeted re-review.

Because a P1 was repaired, exactly ONE targeted independent re-review is authorized. No additional review cycle is authorized after that re-review.

## Next gate

1. Require the complete canonical Phase-2 verification on the exact user-authored head containing this receipt.
2. Freeze that exact repaired candidate only after all canonical gates pass.
3. Run exactly ONE targeted independent re-review of the P1 repair and regression risk.
4. If no Critical/High defect remains, close Phase 2. If a new Critical/High defect is found, repair it without starting a third review cycle and close only after exact-head verification supports the final disposition.

MERGE_AUTHORITY: NO
PHASE_2_CLOSED: NO
