# PHASE PACKET

## Identity
- Phase: PHASE 9 — FOUNDING-COHORT REHEARSAL
- Canonical base SHA: `272668120ab351ddbcc1447e4ae732c92d2c495e`
- Objective: rehearse the complete founding-cohort product with 2–3 bounded Player actors, falsify the canonical failure drills, prove desktop/mobile journey coherence, and prove supported operation without database surgery before founding launch.
- Active branch: `feature/inkubator-founding-cohort-rehearsal-v0`
- Phase-8 closure authority: `docs/inkubator/PHASE_8_CLOSURE_V0.md`

## Authorized paths

Primary rehearsal/evidence paths:
- `docs/agent-packets/INKUBATOR_FOUNDING_REHEARSAL_V0.md`
- `docs/inkubator/PHASE_9_*`
- `apps/inkubator-lab/e2e/**`
- `apps/inkubator-lab/playwright.config.ts`
- `apps/inkubator-api/test/**/phase9-*`
- `apps/inkubator-verifier/test/**/phase9-*`
- rehearsal-only fixtures/scripts under existing Inkubator test directories
- bounded `.github/workflows/*phase9*` verification workflow if needed

Conditionally authorized repair paths only when a Phase-9 drill reproduces a Critical/High objective defect:
- `apps/inkubator-api/**`
- `apps/inkubator-lab/src/**`
- `apps/inkubator-verifier/**`
- `packages/inkubator-protocol/**`
- `packages/sdk/**`
- `packages/cli/**`
- `packages/mcp/**`
- existing Inkubator deployment/OPS workflow/config files

Conditional repairs must be the smallest change that closes the reproduced defect. A rehearsal failure does not authorize unrelated refactors or feature work.

## Forbidden paths / scope

- unrelated trading/game surfaces (`apps/api`, `apps/web`, simulator/career/trading packages) unless a shared root build defect directly blocks Inkubator rehearsal;
- Phase-10 launch/marketing mechanics;
- new product nouns, social systems, reputation mechanics, leaderboards or engagement features;
- a new database, queue, backend or second truth system;
- weakening Phase-6 Ship/verifier authority;
- weakening Phase-7 reputation/Cheevo authority;
- weakening Phase-8 browser/server credential separation or package provenance;
- broad visual redesign detached from a reproduced journey failure;
- database surgery as an accepted operational workaround.

## Frozen product / truth brief

The product loop is:

`BECOME → DECLARE → BUILD → PROVE → HELP → SHIP → REMEMBER → REPEAT`

Phase 9 does not add another stage. It proves that the existing stages work as one understandable system.

A rehearsal actor must not need knowledge of implementation phases to answer:
- What am I building?
- What counts as Ship?
- What changed?
- What is blocking me?
- What should I do next?
- Where can I get/provide help?
- What evidence is claimed, observed or proven?
- What happened after Ship?

Truth classes and authority remain frozen. Automation/agents may drive the UI/API for rehearsal, but may not stand in for verifier/operator authority.

## Required actor state

Use at least three deterministic actor roles in automated rehearsal fixtures:

1. **OWNER** — creates/owns Mission + Project and attempts Ship.
2. **HELPER** — discovers need, offers Assist, may join Party.
3. **TESTER** — records bounded external test evidence.

Automated actors are test fixtures, not evidence that the human founding-cohort usability requirement has been satisfied.

Human/friendly rehearsal evidence must ultimately cover 2–3 real Players before Phase-9 closure.

## Required full journey

At minimum, rehearsal must exercise:

1. create/login Player;
2. join Round;
3. declare Mission/Project/ship condition;
4. return to persistent Command;
5. observe a GitHub-derived work signal;
6. identify current state/blocker/Next Move;
7. open Help Beacon;
8. second Player discovers and offers Assist;
9. owner accepts Assist / Party attribution becomes visible;
10. external tester records evidence;
11. owner prepares/submits Ship;
12. verifier + trusted acceptance path produces exactly one accepted Ship Receipt;
13. Cheevo/reputation/boards derive from immutable authority;
14. Player can inspect remembered Ship/history state;
15. repeat/next-Mission path remains possible without corrupting prior history.

## Required failure drills

Canonical drills from the roadmap:

- P9-H01 duplicate GitHub webhook;
- P9-H02 repo renamed/transferred/private/revoked;
- P9-H03 worker crashes after DB commit;
- P9-H04 webhook arrives out of order;
- P9-H05 private README contains prompt injection/secret-like content;
- P9-H06 browser bundle tries server-only SDK import;
- P9-H07 verifier targets localhost/private IP/redirect chain;
- P9-H08 Player retries Assist/Ship mutation;
- P9-H09 old protocol fixture read under current SDK;
- P9-H10 achievement rule version changes;
- P9-H11 deployment rollback;
- P9-H12 Player closes Mission without Ship.

Additional journey falsification:

- P9-H13 mobile 390x844 journey retains readable Mission/Next Move/blocker/Ship affordances;
- P9-H14 desktop 1440x900 journey exposes the same canonical state and action hierarchy;
- P9-H15 keyboard-only critical journey has no unreachable action/focus trap;
- P9-H16 reduced-motion mode preserves meaning and critical affordances;
- P9-H17 two/three Player concurrent activity does not create duplicate authoritative history;
- P9-H18 supported OPS recovery can handle a bounded stuck/retry case without direct DB mutation.

## UX acceptance criteria

The five core product screens must operate as one coherent family, not five demos.

A fresh rehearsal Player must be able to identify without architecture explanation:
- Mission;
- current focus;
- Next Move;
- blocker;
- evidence/truth state;
- Help/Assist state;
- Ship condition/status;
- durable post-Ship result.

Visual polish is authorized only where it materially improves these comprehension/operation criteria. Decorative effect work alone cannot close a Phase-9 finding.

## Automation / test evidence

Required automated evidence before human rehearsal:

- API typecheck/build and generated-client freshness;
- all migrations from clean Postgres;
- full API Postgres integration suite;
- verifier tests;
- protocol/SDK/CLI/MCP hostile tests;
- Playwright full-journey rehearsal on desktop and mobile;
- existing golden-screen regression suite;
- axe/keyboard/reduced-motion checks available in the existing test stack;
- explicit assertions for P9-H01..P9-H18 or a written reason when a drill requires controlled manual/OPS execution.

## OPS requirement

Phase 9 must distinguish:
- product-authorized operator actions;
- CI/deployment operations;
- forbidden direct database surgery.

At least one recovery drill must demonstrate supported recovery/retry/rollback semantics without editing canonical rows manually.

## Deployment requirement

A usable rehearsal environment must exist. Current Vercel deployment-rate exhaustion is an environment constraint, not permission to skip deployment/rollback rehearsal.

The rehearsal may use another already-authorized environment or wait for provider capacity, but Phase 9 cannot close on local-only evidence if the deployment/rollback drill remains unproven.

## Required evidence artifacts

- `docs/inkubator/PHASE_9_REHEARSAL_MATRIX_V0.md`
- `docs/inkubator/PHASE_9_HUMAN_REHEARSAL_V0.md`
- automated test logs/workflow run IDs;
- desktop 1440x900 journey screenshots;
- laptop 1280x800 spot-check;
- mobile 390x844 journey screenshots;
- defect ledger with severity, reproduction and disposition;
- OPS/rollback evidence.

## Review policy

Use the bounded project policy exactly:

`REHEARSE/IMPLEMENT → TEST → ONE independent hostile review → fix Critical/High → ONE targeted rereview only if Critical/High fixes were needed → CLOSE → MOVE FORWARD`

- one broad Phase-9 hostile review maximum;
- one targeted rereview maximum, only if Critical/High repairs are needed;
- Medium/Low findings do not restart the phase unless they invalidate the phase objective/evidence, frozen invariant, or fail-closed/security behavior;
- no third review cycle without explicit user override.

## Stop / exit condition

Phase 9 closes only when:

1. no Critical/High architecture or product-truth defect remains;
2. all automatable P9-H01..P9-H18 drills pass or have equivalent controlled evidence;
3. complete desktop/mobile core journeys pass;
4. supported OPS recovery/rollback is proven without database surgery;
5. 2–3 real friendly/internal Players have completed the bounded rehearsal and their Critical/High confusion/failure findings are closed;
6. the product can be operated without explaining the internal implementation phase model.

If human rehearsal is the only remaining requirement, stop at `READY_FOR_HUMAN_REHEARSAL`; do not fake human evidence with synthetic actors.

Do not merge this or earlier stacked PRs without explicit user authority.

## Completion report
- CHANGESET
- AUTOMATED REHEARSAL
- HUMAN REHEARSAL
- FAILURE DRILLS
- UX / ACCESSIBILITY
- OPS / DEPLOYMENT
- REVIEW
- DEVIATIONS
- VERDICT
