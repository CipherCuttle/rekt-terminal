# LEARNING_VERTICAL_SLICE_V0 — Closure

Status: `IMPLEMENTED / PASS · TARGETED REPAIR COMPLETE`

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
never commit the practice ledger, Career state, or economic event log. For
`EX-01` and `ST-01`, the evaluator derives action evidence from the simulator's
accepted/rejected event stream and stores that evidence in the receipt. UI
toggle state is learner intent only; it is not an authority for accepted
entry, stop, trigger, or exit facts.

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

Static scenario facts for the mechanical drills never claim that an action was
accepted. A missing simulator state therefore fails closed. Rejected actions
remain in the ephemeral event history, and receipt validation requires the
materialized mechanical facts to match the simulator evidence exactly.

## PnL and authority boundaries

PnL can appear in the execution/stop debrief as an outcome, but no PnL field or
sign is a PASS criterion. The evaluator is the only PASS authority: no React
flag, wall clock, randomness, network, prompt, or manual completion API is
involved. Learning completion does not mutate simulator economics, Career
unlock state, thresholds, XP, or capability authorization.

## Persistence and debrief

`LearningStateV0` stores completed mission IDs/versions, immutable attempt
receipts, the current mission, and an optional pending PASS receipt ID. A PASS
keeps the passed mission current until the exact receipt is acknowledged once;
only then does the reducer advance. The pending debrief is persisted and
restored with the learning save. Failed attempts remain interpretable but do
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

Focused and repository gates passed during closure/targeted repair:

- `npm test -w @rekt-ink/learning` — 17 passed.
- `npm test -w @rekt-ink/web` — 9 files / 112 tests passed.
- `npm run verify:source` — `VERIFY_SOURCE=PASS`.
- `npm run verify:learning` — `VERIFY_LEARNING=PASS`.
- `npm run typecheck -w @rekt-ink/web` — passed.
- `npm run build -w @rekt-ink/learning` — passed.
- `git diff --check` — passed.

Browser verification with Playwright completed all five missions through the
product UI, including invalid EX-01/ST-01 orderings and the final explicit
debrief acknowledgement. PASS remained visible with `CONTINUE →`, and the
final Career view showed `VERTICAL_SLICE_COMPLETED · TRANSFER EXAM NOT
INCLUDED`. At 390×844 and 1440×900, the objective, synthetic boundary, chart,
ticket, mission list, and completion marker remained usable. The local LIVE
bootstrap returned an external 503/429 before switching to DEMO; after the
explicit DEMO switch there were no application console errors. Screenshots
were inspected from `.playwright-mcp/rekt-learning-career-mobile.png` and
`.playwright-mcp/rekt-learning-career-desktop.png`.

## Targeted repair after hostile review

The independent review identified two authority defects. P1 was that EX-01 and
ST-01 could grade UI booleans against static facts while a separate ephemeral
simulator executed actions. P2 was that the reducer advanced immediately on
PASS, hiding the success debrief. The one allowed repair now derives mechanical
facts only from accepted production-simulator events, retains rejected events,
cross-checks receipt facts against evidence, and keeps a persisted PASS
debrief pending until exact one-time acknowledgement. Focused tests cover
invalid ordering, absent simulator state, receipt/evidence mismatch, rejected
history, pending-debrief restore, and final acknowledgement.

## Earlier hostile review

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

The targeted repair branch is based on the requested canonical base
`8a5e5d35c70e35a3f5fff8e03fb351026b516596`; the repair commit is appended to
the existing learning-slice head and is published on the existing PR.
