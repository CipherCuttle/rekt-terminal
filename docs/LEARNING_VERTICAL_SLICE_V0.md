# LEARNING_VERTICAL_SLICE_V0 — Closure

Status: `IMPLEMENTED / PASS`

This closure records the bounded learning slice. It implements mission
competence and persistent learning progress only. It does not implement
`CONCEPT_MASTERED`, `TRANSFER_EXAM_V0`, indicators, an LLM, or any new Career
capability gate.

## Architecture

`packages/learning` is a small pure, versioned domain package. It owns the five
mission definitions, learner-input unions, immutable scenario facts,
deterministic evaluation, receipt identity, deterministic debrief data, and
`LearningStateV0` reduction/validation. It depends only on `@rekt-ink/episodes`
for canonical JSON/digests and `@rekt-ink/sim` for production fill, stop,
marking, and risk-plan behavior. It has no React, browser, provider, network,
Career, or analytics dependency.

The web `PracticeSessionStore` is the integration seam. It submits typed
learner input to the domain evaluator and persists the resulting learning
receipt. Synthetic rehearsal actions use an ephemeral simulator state and
never commit the practice ledger, Career state, or economic event log.

## Mission contract

Exactly five immutable, version-1 definitions are exposed, in sequence:

| ID | Contract | PASS requires |
| --- | --- | --- |
| `MD-01` | `WHAT IS TRUE?` — `MARKET_TRUTH` | Correct `CONFIRMED`/`DERIVED`/`SYNTHETIC`/`STALE` classifications and fail-closed freshness answer. |
| `EX-01` | `WHERE DID MY MONEY GO?` — execution | Fixed entry and close actions, mark distinguished from fill, and fees/execution recognized as affecting the result. |
| `LQ-01` | `SHOULD I SEND THIS ORDER?` — liquidity | Deep order sent, thin order declined or safely resized, and impact labeled as the production model. |
| `ST-01` | `TAKE THE LOSS` — stop discipline | Entry, protective stop, trigger/fill distinction, no widening, and planned exit. A losing result is allowed and expected. |
| `RS-01` | `SIZE COMES LAST` — account risk | Production `RISK_PLAN_V0` plan, size within the risk budget, and wider stop → smaller size. |

Changing grading semantics requires a mission-version change. Receipts include
the mission version, evaluator version, scenario digest, learner choices,
relevant facts, verdict, and deterministic reason codes. Their SHA-256 identity
is reproducible from the receipt material.

## Scenario truth

No existing real spot episode was suitable for these first mechanical drills.
All five scenarios are therefore explicitly:

`TRAINING SIMULATION · SYNTHETIC · DEMO`

They are never labeled `LIVE`, `REPLAY`, or `CONFIRMED`, and cannot advance
Career qualification or claim mastery. `EX-01`, `LQ-01`, `ST-01`, and `RS-01`
populate facts by calling the production simulator/risk functions. The episode
test consumes the existing immutable perpetual artifact only to verify that
future samples remain withheld until cursor advancement; it is not relabeled
as a spot mission scenario.

## PnL and authority boundaries

PnL can appear in the execution/stop debrief as an outcome, but no PnL field or
sign is a PASS criterion. The evaluator is the only PASS authority: no React
flag, wall clock, randomness, network, prompt, or manual completion API is
involved. Learning completion does not mutate simulator economics, Career
unlock state, thresholds, XP, or capability authorization.

## Persistence and debrief

`LearningStateV0` stores completed mission IDs/versions, immutable attempt
receipts, and the current mission. Failed attempts remain interpretable but do
not complete a mission. Unknown/future or malformed learning state resets only
learning progress; the economic replay and Career save are preserved.

Debriefs are deterministic data templates. They separate scenario facts,
learner process, and verdict. Trade debriefs show mark/fill/impact/fees and
realized result; liquidity debriefs explicitly say
`MODEL-SPECIFIC / SPOT_FILL_V0`; stop debriefs show plan/trigger/actual fill;
risk debriefs show account/risk budget/stop/size/projected loss.

## UI integration

Learning uses the existing `RADAR` / `TERMINAL` / `CAREER` navigation only.
Career exposes the next mission CTA; the terminal renders one compact objective
strip around the existing chart and ticket. The task and explanation are
collapsible, with the task closed initially so the chart/ticket remain visible
on mobile. The UI submits typed choices/actions and renders the domain receipt;
it does not calculate or authorize PASS.

## Verification

Focused and repository gates passed during closure:

- `npm test -w @rekt-ink/learning` — 12 passed.
- `npm test -w @rekt-ink/web` — 9 files / 109 tests passed.
- `npm run verify:source` — `VERIFY_SOURCE=PASS`.
- `npm run verify:learning` — `VERIFY_LEARNING=PASS`.
- `npm run typecheck -w @rekt-ink/web` — passed.
- `npm run build -w @rekt-ink/learning` — passed.
- `git diff --check` — passed.

Browser verification with Playwright completed all five missions through the
product UI. At 390×844 and 1440×900, the objective, synthetic boundary, chart,
and ticket remained usable; fresh-page console checks reported zero errors.
The only observed warning was the existing deprecated Apple mobile web-app
meta tag. A prior deliberate bad LQ submit exposed an undefined optional field;
the UI now omits that field when the learner declines, and the corrected flow
passes.

## Hostile review

One independent hostile pass attacked pedagogy, trading truth, architecture,
and game design. It found and repaired two High usability/integration defects:
LQ-01's decline path emitted an undefined optional receipt field, causing the
canonical serializer to reject a valid learner answer; and RS-01 initially
hardcoded the wider-stop relationship instead of requiring the learner to
answer it. The focused tests and the clean-save browser sequence were rerun
after both repairs. No Critical/High findings remain. The review confirmed no
PnL grading, no fake historical provenance, no direct UI PASS authority, no
Career/economic mutation, and no future episode sample leak.

## Known limitations

These are intentional V0 boundaries: the scenarios are synthetic; the slice
does not prove transfer or mastery; impact and risk outcomes are explicitly
model-specific; no real spot episode was added; and the existing Career ladder
through SHORT remains unchanged.

## Baseline note

The requested canonical base `8a5e5d35c70e35a3f5fff8e03fb351026b516596` was
not present in the local repository or visible refs when work began. The branch
was created without rewriting history from the available local `HEAD`
`25d4e350...` (the existing EPISODES_V0 closure). This discrepancy is preserved
as evidence rather than silently claiming the unavailable base.
