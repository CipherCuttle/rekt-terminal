# REKT INK(CUBATOR) — Phase 9 Rehearsal Matrix v0

**Phase:** PHASE 9 — FOUNDING-COHORT REHEARSAL

**Status:** ACTIVE / AUTOMATED REHEARSAL

**Base:** `272668120ab351ddbcc1447e4ae732c92d2c495e`

This matrix distinguishes inherited proof from Phase-9 composition proof. An inherited passing test is useful evidence, but it does not replace the full-journey and human rehearsal requirements.

## Automated drill matrix

| Drill | Risk | Current evidence | Phase-9 disposition |
|---|---|---|---|
| P9-H01 | duplicate GitHub webhook creates duplicate authority | `github.test.mjs`; new `phase9-founding-rehearsal.test.mjs` sends same delivery twice and requires one Project observation | REHEARSAL TEST ADDED / RUN PENDING |
| P9-H02 | rename/transfer/private/revoked repository retains stale authority | existing GitHub repository authority, setup-state and webhook control tests | INHERITED COVERAGE / FULL REGRESSION PENDING |
| P9-H03 | worker crashes after DB commit and duplicates/loss occur | existing outbox lease/retry and Phase-4 retry recovery tests | INHERITED COVERAGE / FULL REGRESSION PENDING |
| P9-H04 | out-of-order webhook rewrites current truth | `phase4-github-evidence-daemon.test.mjs` delayed/out-of-order evidence ordering | INHERITED COVERAGE / FULL REGRESSION PENDING |
| P9-H05 | private README/commit prompt injection or secret-like content becomes instruction/public data | Phase-4 hostile push fixture plus new Phase-9 composition push | REHEARSAL TEST ADDED / RUN PENDING |
| P9-H06 | browser bundle imports server-only DevKit credential path | Phase-8 proves root SDK has no bearer path; explicit browser-bundle import drill still required | GAP — ADD BUNDLER FALSIFICATION |
| P9-H07 | verifier follows localhost/private-IP/unsafe redirect | `apps/inkubator-verifier/test/policy.test.mjs` rejects literals/private DNS/mixed DNS and re-resolves redirects | INHERITED COVERAGE / CURRENT RUN PENDING |
| P9-H08 | Assist/Ship retries duplicate logical action | Phase-5/6 idempotency tests plus new Phase-9 journey retries Assist accept and Ship submit | REHEARSAL TEST ADDED / RUN PENDING |
| P9-H09 | old protocol fixture becomes unreadable under launch DevKit | protocol compatibility/fixture tests in DevKit suite | INHERITED COVERAGE / CURRENT RUN PENDING |
| P9-H10 | achievement rule-version change silently reinterprets historical grant | Phase-7 stores a rule version and makes awards immutable; frozen product contract says historical grants are never silently reinterpreted | PARTIAL — DEDICATED VERSION-CHANGE FALSIFICATION REQUIRED |
| P9-H11 | deployment rollback cannot restore known-good Inkubator | no controlled Phase-9 rollback run yet; Vercel free deployment-rate exhaustion currently affects rehearsal environment | OPS / ENVIRONMENT EVIDENCE REQUIRED |
| P9-H12 | Mission closed without Ship creates Ship/reputation facts or destroys prior history | new Phase-9 journey creates second Mission, closes `CLOSED_NOT_SHIPPED`, requires zero new receipts and prior reputation unchanged | REHEARSAL TEST ADDED / RUN PENDING |
| P9-H13 | mobile journey loses Mission/Next Move/blocker/Ship meaning | new `founding-rehearsal.spec.ts` at 390×844; existing mobile Command test | REHEARSAL TEST ADDED / FIRST PLAYWRIGHT PASS OBSERVED |
| P9-H14 | desktop five-screen journey has divergent/unclear hierarchy | new `founding-rehearsal.spec.ts` at 1440×900 | REHEARSAL TEST ADDED / FIRST PLAYWRIGHT PASS OBSERVED |
| P9-H15 | keyboard-only critical path is unreachable | existing golden keyboard test plus new Phase-9 keyboard journey | REHEARSAL TEST ADDED / FIRST PLAYWRIGHT PASS OBSERVED |
| P9-H16 | reduced-motion mode removes meaning/critical affordances | existing orbit test plus new Phase-9 reduced-motion journey | REHEARSAL TEST ADDED / FIRST PLAYWRIGHT PASS OBSERVED |
| P9-H17 | 2–3 Player activity creates duplicate authoritative history | new OWNER/HELPER/TESTER composition test checks exactly-one push/Assist/test/Ship facts | REHEARSAL TEST ADDED / RUN PENDING |
| P9-H18 | stuck/retry recovery requires direct DB surgery | existing outbox/worker retry seams exist, but one supported operator recovery/rollback rehearsal is still required | OPS EVIDENCE REQUIRED |

## First Playwright falsification

The first Phase-9-triggered Signal-System run passed source invariants, unit/semantic tests, typecheck/build, bundle budgets and Storybook, then ran 20 Playwright tests.

Result:

- 19 / 20 Playwright tests passed;
- Phase-9 desktop/mobile/keyboard/reduced-motion journey assertions passed;
- the only failure was the pre-existing `ship.png` visual baseline;
- stored Ship baseline: 1280×1107;
- current stable Ship render: 1280×1514;
- pixel difference: approximately 31%.

This baseline is not being auto-accepted. Phase 9 must inspect the current Ship candidate before replacing the frozen golden image because the user-facing UX coherence of the newer screens is itself a launch criterion.

## Known unrelated/pre-existing CI blockers

Current broad workflows also stop before their substantive test phases on historical repository verification gates:

- `Inkubator Verification` stops at `Verify public-source trust boundary`;
- root `CI` stops at `Inkubator foundation invariants`.

Phase 9 uses a bounded rehearsal verification workflow to execute the canonical current API/DevKit/verifier/Signal tests directly. These legacy gate mismatches are tracked as repository debt unless they invalidate a Phase-9 objective or current product truth.

## Human rehearsal

Synthetic OWNER / HELPER / TESTER actors do **not** satisfy the human requirement.

Human status: `NOT STARTED`.

Phase 9 may advance to `READY_FOR_HUMAN_REHEARSAL` only after automated Critical/High defects are repaired and the rehearsal verification set is green.
