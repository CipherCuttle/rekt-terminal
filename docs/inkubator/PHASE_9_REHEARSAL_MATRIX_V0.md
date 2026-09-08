# REKT INK(CUBATOR) — Phase 9 Rehearsal Matrix v0

**Phase:** PHASE 9 — FOUNDING-COHORT REHEARSAL

**Status:** AUTOMATED REHEARSAL PASS / BLOCKED BY DEPLOYMENT-ROLLBACK EVIDENCE

**Base:** `272668120ab351ddbcc1447e4ae732c92d2c495e`

**Clean automated evidence head:** `41dd1e15ebe5045f541f705547d955c97f6afce3`

**Clean bounded verifier:** run `34222341516` — PASS

**Canonical Signal System verifier:** run `34222346180` — PASS

This matrix distinguishes inherited proof, Phase-9 composition proof, controlled OPS proof and the still-required human/deployment evidence. Synthetic actors do not satisfy the human rehearsal requirement.

## Automated drill matrix

| Drill | Risk | Current evidence | Disposition |
|---|---|---|---|
| P9-H01 | duplicate GitHub webhook creates duplicate authority | `phase9-founding-rehearsal.test.mjs` sends the same delivery twice and requires one observation; clean verifier PASS | PASS |
| P9-H02 | rename/transfer/private/revoked repository retains stale authority | inherited GitHub authority/setup-state/control tests exercised by full Postgres regression | PASS |
| P9-H03 | worker crash after DB commit duplicates or loses work | existing outbox lease/retry coverage plus H18 real crash/reclaim rehearsal | PASS |
| P9-H04 | out-of-order webhook rewrites current truth | Phase-4 delayed/out-of-order evidence ordering coverage in full regression | PASS |
| P9-H05 | private README/commit prompt injection becomes instruction/public data | Phase-4 hostile fixtures plus Phase-9 composition path | PASS |
| P9-H06 | browser bundle imports server-only SDK credential path | explicit bundler falsification; browser cannot resolve `@rekt-ink/sdk/server` | PASS |
| P9-H07 | verifier follows localhost/private IP/unsafe redirect | verifier policy suite rejects private/local targets and unsafe redirects | PASS |
| P9-H08 | Assist/Ship retries duplicate logical actions | Phase-9 journey retries Assist accept and Ship submit and requires exactly-once history | PASS |
| P9-H09 | old protocol fixture unreadable under launch DevKit | protocol/SDK compatibility tests in DevKit hostile suite | PASS |
| P9-H10 | rule-version change silently hides historical Cheevo | dedicated historical rule-version falsification + projection repair | PASS |
| P9-H11 | deployment rollback cannot restore known-good Inkubator | connected Vercel team has zero projects; deployment connector currently exposes an unusable schema, so no truthful rollback run exists yet | BLOCKED — REAL DEPLOYMENT TARGET REQUIRED |
| P9-H12 | Mission closed without Ship creates Ship/reputation facts | Phase-9 second-Mission `CLOSED_NOT_SHIPPED` rehearsal requires zero new receipts and unchanged prior reputation | PASS |
| P9-H13 | mobile loses Mission/Next Move/blocker/Ship meaning | 390×844 Playwright journey | PASS |
| P9-H14 | desktop five-screen journey has divergent hierarchy | 1440×900 Playwright journey + Ship hierarchy repair | PASS |
| P9-H15 | keyboard-only critical path unreachable | Phase-9 keyboard journey + existing golden keyboard coverage | PASS |
| P9-H16 | reduced-motion removes meaning/critical affordances | Phase-9 reduced-motion journey | PASS |
| P9-H17 | 2–3 actor activity duplicates authoritative history | OWNER/HELPER/TESTER composition test requires exactly-one push/Assist/test/Ship facts | PASS |
| P9-H18 | stuck/retry recovery requires direct DB surgery | supported `npm run ops:recover -w @rekt-ink/inkubator-api`; rehearsal kills process after real lease claim and recovers after expiry without editing canonical rows | PASS |

## Ship visual acceptance

The original Ship golden exposed a genuine hierarchy defect rather than harmless snapshot drift: the artifact column was vertically centered inside the much taller receipt row, leaving a large dead first-viewport field.

The Phase-9 repair anchors the artifact at the desktop viewport, keeps receipt/history readable, and returns to normal document flow on mobile. The resulting candidate was visually inspected before acceptance.

Accepted golden commit: `866747b16a4f10f3025c5e37fb95115b2444736f`.

The one-shot golden writer was subsequently removed. Clean verifier run `34222341516` then reproduced the committed `ship.png` **without** `--update-snapshots`, and the canonical Signal System run `34222346180` passed its full Playwright/axe/mobile/visual-snapshot gate.

## Automated rehearsal verdict

Clean verifier `34222341516` passed:

- API typecheck/build and generated-client freshness;
- migrations from clean Postgres;
- P9-H10 historical Cheevo continuity;
- DevKit build/hostile tests;
- P9-H06 browser/server SDK boundary;
- three-Player OWNER/HELPER/TESTER composition journey;
- P9-H18 supported OPS crash/reclaim recovery;
- full API Postgres integration regression;
- verifier hostile policy;
- Signal System build/semantics;
- desktop/mobile/keyboard/reduced-motion journeys;
- Ship hierarchy assertions;
- committed Ship golden reproduction.

`AUTOMATED_PHASE_9_VERDICT = PASS`

## Known inherited CI debt

Root `CI` / older Inkubator verification workflows still contain historical repository-wide trust/invariant mismatches unrelated to the bounded Phase-9 product evidence. They remain repository debt unless they invalidate the current phase objective or a frozen authority boundary.

The canonical Signal System workflow itself is green on the clean automated head.

## Deployment / OPS

P9-H18 is closed: supported worker recovery is proven without database surgery.

P9-H11 is not closed. The connected Vercel team `swirkybuilds` currently has zero projects. The available Vercel deployment connector also rejects invocation because its exposed tool schema does not provide the internally required `target`, `name`, and `files` arguments. Phase 9 therefore has no truthful real deployment/rollback receipt yet.

Required H11 evidence remains:

1. provision/link one real Inkubator rehearsal deployment target;
2. deploy a known-good candidate;
3. deploy a controlled successor revision;
4. restore the known-good deployment using the provider-supported rollback/promote path;
5. verify the public Inkubator journey and canonical state after rollback;
6. record deployment IDs/URLs and rollback result without direct DB mutation.

## Human rehearsal

Human status: `NOT STARTED`.

Synthetic OWNER / HELPER / TESTER actors do not satisfy the required 2–3 real friendly/internal Player rehearsal.

Phase 9 may close only after H11 and human rehearsal evidence exist, followed by the one bounded independent hostile review.

## Current phase state

`PHASE_STATE = AUTOMATED_REHEARSAL_PASS / BLOCKED_BY_H11_DEPLOYMENT_TARGET`

`HOSTILE_REVIEW = 0 / 1 USED`

`SAFE_TO_CLOSE = NO`

`SAFE_TO_MERGE = NO`
