# REKT INKUBATOR — STAGE E CHALLENGE PRODUCT UI V1

**Status:** LOCKED STAGE-E IMPLEMENTATION CONTRACT  
**Date:** 2026-09-14  
**Parent:** `REKT_INKUBATOR_NORTH_STAR_V2.md`  
**Visual authority:** `REKT_TECHNICAL_FACEPLATE_V1.md`

## 0. Objective

Stage E turns the closed Stage-D Compiler substrate into the forward-facing REKT Challenge product without reviving the historical `WORLD / COMMAND / PROJECT / PLAYER / SHIP` information architecture.

Stage-E exit remains:

`FUZZY IDEA → NEGOTIATED MOCK BUILD CONTRACT`

working coherently on desktop and mobile, with meaningful requirement changes visibly changing the compiler instrument.

This contract does not authorize production money, wallet custody/signing/broadcast, real settlement, or Stage-F/G implementation.

## 1. Frontend-root decision — LOCKED

**Decision:** promote/refactor the existing Inkubator frontend runtime at `apps/inkubator-lab`.

Do **not** create `apps/inkubator-web` for Stage E.

Reason:

- `docs/PRODUCT_BOUNDARIES_V1.md` and `config/product-boundaries.json` already define `apps/inkubator-lab` / `@rekt-ink/inkubator-lab` as the canonical `rekt-inkubator` frontend and deployment root;
- it already owns Inkubator auth/session integration, generated API client usage, React Query, Storybook, Playwright, Lighthouse and reduced-motion/visual calibration substrate;
- a second app would duplicate product boundary, deployment, auth, testing and design-system work without adding Challenge truth.

`apps/web` remains REKT Terminal and is `NEVER MIX`.

The historical five-surface runtime remains available only through explicit compatibility access (`?mode=...` deep links and/or lab/legacy queries) for test/lab evidence. It is not forward navigation or production IA.

## 2. E-GATE-1 — Alpha IA / ownership / navigation — LOCKED

Forward Alpha surfaces, in navigation order:

1. `DISCOVER`
2. `COMPILER / CREATE`
3. `CHALLENGE`
4. `MY BUILD`
5. `REVIEW / TEST ARENA`
6. `RECEIPT / HISTORY`
7. `OPERATOR EXCEPTIONS`

Ownership:

| Surface | Primary owner | Alpha purpose |
| --- | --- | --- |
| Discover | public | find funded/open Challenge opportunities without reviving the social World feed |
| Compiler / Create | organizer | negotiate requirements, assumptions, envelope, architecture, checks and blockers before freezing |
| Challenge | participant/public projection | read one canonical Challenge and its frozen contract/version/status |
| My Build | authenticated builder | entry-specific build context and later Capsule/submission actions |
| Review / Test Arena | organizer + qualified reveal audience | Stage-E shell only; Stage G owns full reveal/evaluation mechanics |
| Receipt / History | authenticated participant + public receipt where authorized | durable Challenge decisions/results; historical Ship UI is not substituted |
| Operator Exceptions | authorized operator only | explicit fail-closed exceptions, stale jobs and manual-resolution surfaces |

Navigation rules:

- no top-level `WORLD`, `COMMAND`, `PROJECT`, `PLAYER` or `SHIP` entries in the forward product;
- Challenge context may deep-link between Challenge, My Build, Review and Receipt without changing authority;
- `Discover` must never silently substitute historical project/player/social discovery for Challenge discovery;
- `Receipt / History` may reuse durable receipt/evidence substrate, but not historical Ship presentation as Challenge truth;
- `Review / Test Arena` may exist as a shell in Stage E, but must not imply Stage-G mechanics are already implemented.

## 3. E-GATE-2 — Canonical surface states — LOCKED

Every Stage-E surface must have an explicit treatment for these canonical states:

- `NORMAL`
- `LOADING`
- `EMPTY`
- `ERROR`
- `UNAVAILABLE_OR_STALE`
- `UNAUTHORIZED`
- `MOBILE`
- `REDUCED_MOTION`

`MOBILE` and `REDUCED_MOTION` are presentation axes that combine with the data/auth states above; they are listed as gates because they require explicit verification, not because they replace data state.

Rules:

- never collapse unavailable/stale into empty;
- never collapse unauthorized into not-found;
- loading must not fabricate previous values unless they are clearly marked stale;
- errors preserve the last trustworthy value only when provenance/time is visible;
- if a Stage-E transport is not implemented, render `UNAVAILABLE_OR_STALE`; do not wire a parked legacy endpoint merely to fill the screen;
- mobile must preserve the same authority/provenance labels even when visual density drops;
- reduced-motion must preserve state change legibility without relying on animation.

## 4. E-GATE-3 — No fake instrumentation — LOCKED

Any micrographic, meter, trace, counter, architecture node, health light, progress rail or technical readout that conveys product state must map to a real source.

Allowed source classes:

- deterministic `CompilerState` fields;
- versioned Challenge / Build Contract state;
- authenticated Challenge Entry state;
- mechanical acceptance/evidence results;
- durable receipt/history facts;
- explicit service/auth/connectivity state;
- user-entered draft input, clearly labeled draft/uncompiled;
- static decorative faceplate elements that are clearly non-semantic.

Forbidden:

- invented percentages;
- synthetic activity counts;
- fake test passes;
- fake competitors/seats;
- fake prize/funding state;
- fabricated architecture telemetry;
- visualizing model text as deterministic truth;
- presenting a parked Mission/World/Project field as Challenge state because it is convenient.

Decorative elements must be visually/semantically distinguishable from stateful instrumentation, preferably `aria-hidden` and/or marked by implementation convention such as `data-decorative`.

## 5. Compiler authority in the UI

The Stage-D authority split is preserved visibly:

`MODEL_PROPOSAL != SOURCE != ORGANIZER_ACCEPTED != DETERMINISTIC_RULE`

The Compiler UI must expose, where relevant:

- Known / Assumed / Unknown ledger;
- requirement provenance;
- Production Envelope;
- selected/candidate blueprint;
- reference architecture candidate;
- risk / quality profiles;
- sensitivity points;
- human vs automated acceptance modules/checks;
- blocking questions/findings;
- unresolved decisions;
- readiness/status.

Model/provider output is proposal input only. The UI must never label model output as accepted or deterministic unless the canonical Compiler state says so.

Stage E may consume the pure `@rekt-ink/protocol/compiler` module in-browser for deterministic derivation. Provider credentials remain server-side only.

## 6. Transport rule

At Stage-E start, the legacy Inkubator API assembly still exposes historical product routes while Stage-C Challenge persistence exists behind its own domain modules. The forward UI must not use historical World/Project/Mission routes as a substitute for missing Challenge-first HTTP transport.

Until a Challenge read/write route required by a surface exists, that surface renders an explicit unavailable state.

Adding a narrow Challenge-first transport required by Stage E is allowed only when it preserves Stage-B/C authority, idempotency/version semantics and the existing Inkubator API product boundary. Do not create a second API.

## 7. First Stage-E slice

The first changeset after this lock must:

- make the Challenge IA the default `apps/inkubator-lab` product shell;
- park the historical five-mode live instrument behind explicit legacy compatibility access (`?mode=...` and/or lab/legacy query paths), while keeping it out of forward navigation;
- implement the canonical state vocabulary in reusable frontend code;
- render truthful unavailable/unauthorized/empty states rather than legacy data substitutions;
- contain no fake instrumentation and no production-money behavior;
- preserve existing lab calibration routes (`instrument`, `signals`, `peripheral`, fixture legacy) for visual engineering evidence.

The first slice is a foundation, not Stage-E closure.

## 8. Verification

Minimum checks for Stage-E changesets:

- product-boundary verification;
- Inkubator generated-client freshness if transport changes;
- Inkubator frontend unit tests;
- TypeScript build;
- `build:inkubator`;
- Playwright critical-path checks for the new forward shell;
- mobile viewport check;
- reduced-motion check;
- one bounded independent hostile review when the Stage-E implementation reaches closure scope.

No review loop.

## 9. Stage-E closure criteria

Stage E closes only when all are true:

1. the seven-surface Alpha IA is coherent and old IA is no longer forward authority;
2. canonical states are exercised and accessible on desktop/mobile/reduced-motion;
3. Compiler/Create accepts a fuzzy idea and exposes negotiated Compiler state without authority confusion;
4. meaningful requirement changes visibly alter the deterministic machine where expected;
5. a mock Build Contract can be reviewed and explicitly organizer-accepted/frozen through authorized semantics;
6. Challenge/My Build/Review/History shells consume Challenge-first data or truthfully declare unavailability;
7. no fake instrumentation or parked legacy endpoint substitution remains;
8. canonical CI + Inkubator Verification are green on the exact closure head.

## 10. Verdict

```text
E-GATE-1 ALPHA IA                         LOCKED
E-GATE-2 CANONICAL STATES                LOCKED
E-GATE-3 NO-FAKE-INSTRUMENTATION         LOCKED
FRONTEND ROOT                            apps/inkubator-lab / PROMOTE+REFACTOR
OLD FIVE-SURFACE IA                      PARKED FROM FORWARD PRODUCT
STAGE-E IMPLEMENTATION                   AUTHORIZED / IN PROGRESS
STAGE-E CLOSURE                          NOT YET
PRODUCTION MONEY                         NOT AUTHORIZED
```
