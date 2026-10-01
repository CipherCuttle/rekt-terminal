# REKT INKUBATOR — UX0 CONTROL / SIGNAL-FLOW INVENTORY V1

**Status:** READ-ONLY AUDIT / PLANNING ARTIFACT  
**Date:** 2026-10-01  
**Branch:** `plan/inkubator-ux-journey-v1`  
**Base:** `integration/inkubator-stage-h-to-main-v1`  
**Parent:** `docs/inkubator/UX_JOURNEY_SIGNAL_FLOW_V1.md`

This inventory maps the actual forward Challenge UI controls to their current effects and canonical authority.

It does **not** authorize:
- Stage-I external-human Alpha;
- production money;
- settlement execution;
- final integration merge;
- resurrection of legacy WORLD / COMMAND / PROJECT / PLAYER / SHIP IA.

---

# 1. First blocking finding

The current forward Challenge frontend exposes seven navigation surfaces, but only two are materially interactive:

- **COMPILER / CREATE** — real compiler + Build Contract preview/persistence path;
- **CHALLENGE** — real public Challenge projection.

The following are explicit placeholders:
- Discover;
- My Build;
- Review / Test Arena;
- Receipt / History.

Operator is an explicit unauthorized placeholder.

Therefore UX1 may simplify navigation and humanize the existing real flows, but must **not** visually imply that builder entry, Test Arena, Challenge receipt-history or public discovery projections are already wired.

---

# 2. Current production entrypoint

`apps/inkubator-lab/src/main.tsx`

Default route:
`<ChallengeProduct />`

Legacy/lab surfaces remain reachable only through explicit query modes:
- `?lab=instrument`
- `?lab=peripheral`
- `?lab=signals`
- `?lab=legacy`
- legacy `?mode=...`

These are not forward product authority.

UX1 should preserve these diagnostic/lab paths but visually and structurally isolate them from normal consumer navigation.

---

# 3. Forward control inventory

## 3.1 Global / navigation controls

| Visible control | Current effect | Canonical state touched | UX verdict | Target |
| --- | --- | --- | --- | --- |
| REKT//INKUBATOR brand link | Browser navigation to `?surface=discover` | none | CHANGE | Home / Challenges, preserving current Challenge context only where useful |
| Skip to Challenge workspace | Focus jump | none | KEEP | Keep accessibility behavior |
| DISCOVER nav button | pushes `surface=discover` | none | CHANGE | Challenges |
| COMPILER / CREATE nav button | pushes `surface=compiler` | none | CHANGE | Create |
| CHALLENGE nav button | pushes `surface=challenge` | none | CONTEXTUALIZE | Should normally be entered from selected Challenge rather than top-level blank surface |
| MY BUILD nav button | opens unavailable placeholder | none | REMOVE FROM PRIMARY NAV | Expose only when authenticated entry projection exists |
| REVIEW / TEST ARENA nav button | opens unavailable placeholder | none | REMOVE FROM PRIMARY NAV | Challenge-context only when Stage-G projection is wired |
| RECEIPT / HISTORY nav button | opens unavailable placeholder | none | REMOVE FROM PRIMARY NAV | History only when canonical Challenge receipt read path is wired |
| OPERATOR EXCEPTIONS nav button | opens unauthorized placeholder | none | REMOVE FROM CONSUMER NAV | Authorized direct operator surface only |

Signal-flow problem:
The navigation currently presents **capability-shaped placeholders as peer destinations**. This teaches the product ontology instead of the user journey.

UX1 fix:
Primary public nav becomes approximately:
`Challenges / Create / How it works`

Authenticated additions remain conditional on real authority.

---

# 4. Discover surface

Current state:
`UNAVAILABLE_OR_STALE`

Current copy:
- “Challenge discovery transport is not exposed yet.”
- “Historical World, Project and social discovery routes are intentionally not substituted.”

Actual effect:
None.

Canonical source:
Not yet exposed to the forward frontend.

UX verdict:
**KEEP FAIL-CLOSED / REWRITE HUMAN COPY**

Target empty/unavailable state:

> **NO OPEN CHALLENGES TO SHOW YET.**
>
> Open challenges will appear here when the canonical discovery feed is available.

Important:
Do not build a fake challenge grid from fixtures, legacy World, Project, Round or social state.

---

# 5. Compiler / Create controls

## 5.1 SOURCE INTENT textarea

Current visible label:
`SOURCE INTENT`

Current effect:
Local React state only.

On every edit:
- invalidates existing compiler result;
- invalidates organizer acceptance;
- invalidates preview;
- invalidates canonical result display;
- bumps request revision so stale compiler responses are ignored.

Canonical state touched:
None until compile request.

UX verdict:
**KEEP SEMANTICS / RENAME**

Target:
**WHAT DO YOU WANT BUILT?**

Critical invariant:
Editing the source after an accepted compiler run must continue to invalidate acceptance and any preview lineage.

---

## 5.2 YES / NO / UNKNOWN requirement buttons

Current controls:
11 requirement rows × 3 answer buttons.

Current effect:
Updates local explicit organizer requirement state and calls `invalidate()`.

Canonical request effect:
On next compile, answered requirements are sent as explicit structured input with provenance:
- `SOURCE`, or
- `ORGANIZER_ACCEPTED` during acceptance replay.

Canonical state touched:
None until compile.

UX verdict:
**CHANGE PRESENTATION, KEEP DATA MODEL**

Problem:
All eleven implementation-oriented questions are exposed simultaneously.

Target:
Show high-impact unresolved questions progressively.

Default visible choices:
- Yes
- No
- Not sure

Technical key / rule explanation:
progressive disclosure.

Kill criterion:
No UX change may infer an answer from prose and silently mark it organizer-authoritative.

---

## 5.3 COMPILE DETERMINISTIC STATE

Current preconditions:
- non-empty source intent;
- no compile already in progress.

Request:
`POST /v1/compiler/compile`

Body:
`inkubator.compiler-proposal/1.0`

Authentication:
Not required by current Stage-E route.

Server behavior:
- validates proposal;
- deterministically compiles against active frozen blueprints;
- returns `CompilerState`;
- invalid input → HTTP 400 `compiler_input_invalid`.

Optimistic UI:
No.

Success:
`compilerState` becomes current readout.

Failure:
`compilePhase = ERROR`; no fabricated compiler state.

Stale-response behavior:
Request revision prevents an earlier async response from overwriting a newer edited source.

Canonical state touched:
No durable persistence.

UX verdict:
**KEEP / RELABEL**

Target dominant action:
**CONTINUE →**
or, after first interaction:
**CHECK THE SPEC →**

Required human success output:
- what “Done” currently means;
- unresolved decisions;
- important risk/quality implications.

Raw compiler internals move behind technical details.

---

## 5.4 ACCEPT CURRENT INPUTS

Current preconditions:
- compiler state exists;
- compile not in progress.

Request:
Replays `POST /v1/compiler/compile`.

Key difference:
All explicit structured organizer inputs are sent with provenance:
`ORGANIZER_ACCEPTED`.

Authentication:
Not required by current compile endpoint.

Success:
Local `accepted = true` only if returned request revision is still current.

Server contract later enforces organizer-accepted provenance before Build Contract derivation.

Failure:
compile error, accepted false.

Durable state touched:
None.

UX verdict:
**KEEP SEMANTICS / RELABEL**

Target:
**USE THESE RULES →**

Supporting copy:
“You can review the locked version before anything is frozen.”

Critical invariant:
The UI must not portray this step as final Build Contract persistence.

---

# 6. Compiler evidence readout

Current visible regions:
- READINESS
- BLUEPRINT
- RISK
- QUALITY
- INPUT AUTHORITY
- KNOWN / ASSUMED / UNKNOWN
- PRODUCTION ENVELOPE
- DETERMINISTIC FACTS
- ACCEPTANCE MODULES
- UNRESOLVED DECISIONS
- QUESTIONS
- FINDINGS
- SENSITIVITY POINTS
- REFERENCE ARCHITECTURE JSON

Current effect:
Read-only.

Canonical state:
Derived `CompilerState`.

UX verdict:
**KEEP ALL EVIDENCE, CHANGE HIERARCHY**

First layer:
1. Done When
2. decisions still needed
3. material warnings
4. “what changed?”

Second layer:
**Technical contract details**

Nothing should be deleted from inspectability merely because it is hidden from novice-first view.

---

# 7. Build Contract setup fields

## 7.1 CONTRACT VERSION

Current effect:
Local authority input.
Editing invalidates preview/persist result.

Target:
Usually generated/defaulted by product policy for first contract.
Expose manual versioning only where the user is actually revising an existing contract.

Do not remove server authority field.

---

## 7.2 TITLE

Current effect:
Local authority input.
Editing invalidates preview/persist result.

Target:
**Challenge title**

Keep.

---

## 7.3 PRIZE / MINOR UNITS

Current effect:
String → `Number()` → must be safe integer > 0.

Sent as:
`prize_minor_units`.

Problem:
Implementation storage unit is exposed as consumer input.

UX verdict:
**CHANGE**

Target:
Formatted prize amount using settlement policy/asset precision.

Boundary:
Do not invent production-money semantics while production money remains unauthorized.

The UI must be capable of showing a test/no-cash state without pretending the prize is locked.

---

## 7.4 SETTLEMENT ASSET

Current effect:
Raw string authority field.

Target:
Hide behind authorized payment configuration / advanced technical detail.

Do not ask a novice to type a settlement asset string.

---

# 8. FREEZE NONCANONICAL PREVIEW

Current preconditions:

- Challenge id present;
- Challenge public projection loaded;
- Challenge is `DRAFT`;
- no frozen contract;
- current contract version null;
- current terms digest null;
- compiler status `READY`;
- organizer-accepted compiler inputs;
- contract version set;
- title set;
- settlement asset set;
- prize is safe integer > 0.

Request:
`POST /v1/challenges/:challengeId/build-contract-preview`

Authentication:
Current Stage-E route does **not** require authentication.

Server behavior:
- re-reads canonical Challenge snapshot;
- requires unfrozen DRAFT;
- validates compiler state;
- requires all relevant organizer inputs to carry `ORGANIZER_ACCEPTED`;
- builds contract candidate;
- freezes/digests candidate;
- returns:
  - `canonical: false`
  - `persisted: false`
  - frozen contract + terms digest.

Durable state touched:
None.

Optimistic UI:
No.

Failure cases include:
- challenge not found;
- invalid preview input;
- organizer acceptance missing;
- Challenge no longer unfrozen DRAFT.

UX verdict:
**KEEP SEMANTICS / RELABEL**

Target:
**REVIEW LOCKED VERSION**

Human explanation:
> This is the exact version that would be locked. Nothing has been persisted yet.

Critical invariant:
Never call this state “rules locked”.

---

# 9. PERSIST CANONICAL CONTRACT

Current preconditions:
- valid preview;
- exact preview authority retained;
- generated request id retained;
- no canonical result yet;
- persist not already in progress.

Request:
`POST /v1/challenges/:challengeId/build-contract`

Authentication:
**Required.**

Authorization:
Server-side organizer authority required.

Body:
- request id;
- compiler state;
- exact authority;
- expected terms digest from preview.

Server behavior:
1. authenticate session;
2. re-read canonical Challenge;
3. re-derive frozen Build Contract server-side;
4. compare re-derived terms digest with preview digest;
5. reject stale preview mismatch;
6. persist through `persistFrozenBuildContract`;
7. enforce organizer authority and immutable/idempotent contract rules;
8. return canonical persisted contract.

Important error boundaries:
- 401 authentication required;
- 403 organizer required;
- 404 Challenge not found;
- 409 stale preview / already frozen / immutable conflict / idempotency conflict / acceptance missing.

Optimistic UI:
No.

Success:
Local canonical result stored.
Then UI refreshes the public Challenge projection.

Important tested behavior:
If persistence succeeds but the **post-write Challenge refresh fails**, canonical success remains displayed. The UI must not reinterpret a projection refresh failure as a failed persistence.

UX verdict:
**KEEP SEMANTICS / RELABEL**

Target:
**LOCK CHALLENGE RULES**

Pre-action copy:
> Builders will compete against exactly this version.

Success:
> **RULES LOCKED**

Secondary evidence:
- contract version;
- contract fingerprint;
- frozen timestamp.

Critical invariant:
Visual success must occur only after the canonical persistence response.

---

# 10. Challenge public projection

Current request:
`GET /v1/challenges/:challengeId`

Authentication:
Not required.

Current returned fields:
- challenge id;
- status;
- mechanism version;
- settlement policy version;
- IP terms version;
- current contract version;
- terms digest;
- frozen-contract flag;
- slot limit;
- activation minimum;
- entry/build/submission/review timing;
- entry count;
- submission count;
- qualification count;
- receipt count.

Current UI hierarchy:
Mostly raw authority fields.

UX verdict:
**KEEP SOURCE / REWRITE HIERARCHY**

Human first layer:
- title/brief once canonical contract read projection supports it;
- economic state;
- slots;
- time;
- Done When;
- dominant actor action.

Current limitation:
The existing `PublicChallengeView` does **not** include the human contract body/title/Done When projection required for the target Challenge page.

Therefore a fully correct UX1 Challenge page cannot be completed purely with CSS/copy.

Smallest later backend projection addition should expose a safe public frozen-contract summary rather than making the frontend infer it from unrelated state.

---

# 11. Placeholder surfaces

## Discover

Canonical projection absent.

Action:
Humanize placeholder; do not fake data.

## My Build

Canonical Challenge-entry frontend transport absent.

Action:
Remove from primary nav until wired.

Do not substitute historical Project state.

## Review / Test Arena

Stage-G mechanics exist in backend lineage, but this forward component does not expose the canonical UI projection.

Action:
Remove from primary nav until the bounded forward transport is wired.

Do not revive historical Ship UI.

## Receipt / History

Canonical Challenge receipt read transport is not exposed by this forward component.

Action:
Remove from primary nav until wired.

Historical Ship receipts are ancestry, not automatic Challenge receipt UI authority.

## Operator

No authorized operator context exposed here.

Action:
Remove from consumer nav entirely.

---

# 12. Highest-risk UX bugs

## H1 — Equal nav advertises unavailable capabilities

Impact:
Users can intentionally navigate into dead-end system-state pages.

Fix:
Primary nav only contains real user destinations.

---

## H2 — Manual `?challenge=<id>` is a required product precondition

Impact:
Create/freeze is impossible through a coherent normal user journey without external URL knowledge.

Fix:
Create flow must create/select/receive canonical DRAFT Challenge context through a real product action before contract preview.

Important:
Do not solve this by hiding the warning while retaining the broken precondition.

---

## H3 — Build Contract consumer flow exposes raw money storage format

Impact:
“PRIZE / MINOR UNITS” makes economic configuration implementation-dependent and error-prone.

Fix:
Human amount formatter/parser backed by canonical settlement precision.

Until production settlement is authorized, expose test/no-cash state honestly.

---

## H4 — Organizer acceptance looks more final than it is

Impact:
User can plausibly interpret “ACCEPT CURRENT INPUTS” as contract lock.

Fix:
Rename to “Use these rules” and retain a separate explicit final lock ceremony.

---

## H5 — Compiler evidence has no progressive disclosure

Impact:
Correct evidence becomes cognitive denial-of-service.

Fix:
First layer = Done When + unresolved decisions + material warnings.
Second layer = full machine evidence.

---

## H6 — Canonical persistence requires authentication but auth recovery is not integrated into this flow

Impact:
A user can reach final persistence, click, receive a generic canonical-persistence rejection, and lack a clear authentication recovery action.

Fix:
Before final lock, detect/session-gate organizer authentication and return to the exact preview lineage after auth.

Must not regenerate an apparently equivalent preview silently if the lineage changed.

---

# 13. UX1 bounded changeset

UX1 should **not** attempt the full product.

Safe scope:

1. simplify primary navigation;
2. remove placeholder surfaces from normal consumer nav;
3. humanize topbar/heading language;
4. preserve lab routes;
5. rename Create labels/actions;
6. progressive-disclosure compiler evidence;
7. preserve all compiler invalidation/stale-response semantics;
8. rename preview/persist actions without changing requests;
9. rewrite state/error copy around human recovery;
10. add explicit auth-required recovery around canonical persistence if existing session/auth primitives can be reused without new backend authority;
11. add tests proving unavailable surfaces are not advertised as live;
12. retain direct deep-link compatibility for test/rehearsal evidence.

Do **not** in UX1:
- fake Discover data;
- implement Challenge Entry from legacy Project state;
- build a fake Test Arena;
- map historical Ship receipt UI onto Challenge receipt truth;
- add money rails;
- modify compiler rules;
- modify contract digest semantics;
- modify server authorization.

---

# 14. UX1 acceptance checks

- Normal entry no longer exposes seven equal product surfaces.
- `MY BUILD`, `REVIEW`, `HISTORY`, `OPERATOR` are not advertised as live consumer destinations.
- Direct test/rehearsal deep links still work where required.
- Create first view asks “What do you want built?”
- No consumer-facing “minor units”.
- No consumer-facing “persist canonical contract”.
- Preview remains visibly noncanonical/nonpersisted in technical evidence.
- Final rule-lock success appears only after canonical server persistence.
- Editing any organizer authority input invalidates stale preview/persistence lineage exactly as before.
- Stale async compiler acceptance still cannot overwrite a newer source edit.
- Post-persist projection-refresh failure does not erase canonical success.
- `npm run verify:product-boundaries` passes.
- Challenge UI unit/closure tests pass after updated assertions.
- browser E2E retains mobile/reduced-motion/accessibility gates.
