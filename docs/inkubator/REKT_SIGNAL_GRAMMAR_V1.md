# REKT INK(CUBATOR) — SIGNAL GRAMMAR V1

## 0. Status / authority

Status: CANONICAL / PRESENTATION CONSTRAINT LAYER.
Date: 2026-09-08.
Contract evidence baseline: 063eface55a75dda773647ece5df97eda847ed99.
Read with [Surface Purpose V1](REKT_SURFACE_PURPOSE_V1.md).
[Decision Register](DECISION_REGISTER_V0.md) records G1–G3 supersession/clarification.
Compatible [Instrument OS](REKT_INSTRUMENT_OS_V1.md) material guidance remains in force.
This grammar governs conflicting earlier color, geometry, motion and renderer guidance.
It preserves backend invariants and does not authorize source or dependency changes.

## 1. Purpose

Constrain how actual surface projections become readable REKT instruments.
Keep authority, operation, provenance and atmosphere distinguishable.
Preserve expressive identity while preventing decoration from posing as data.
Provide reviewable rules without creating another backend or frontend truth model.
No universal Canonical Fact DTO or frontend CanonicalFact object is introduced.
The frontend consumes the generated projection as-is.

## 2. Architecture boundary

The actual direction of authority is:

    DOMAIN TRUTH
        ↓
    COMPOSED API CONTRACT
        ↓
    GENERATED CLIENT
        ↓
    SURFACE-SPECIFIC QUERY / PROJECTION
        ↓
    SIGNAL GRAMMAR CONSTRAINTS
        ↓
    SCREEN INSTRUMENT
        ↓
    MATERIAL / ATMOSPHERE

Grammar constrains presentation after the surface query; it does not replace its shape.
Composed contract availability and generated operation availability must be checked separately.
Server-internal history is not automatically an event a public surface may present.
No visual subsystem writes canonical domain authority back into this chain.
At the approved baseline, the generated client casts response JSON to TypeScript
shapes without runtime discriminant/schema validation. Generated types therefore do
not prove that an operation exists or that a payload is supported; a future query or
adapter boundary must establish that evidence before a surface claims compliance.

## 3. Truth law

CLAIMED != OBSERVED != PROVEN.
These are distinct authority levels, not interchangeable positive UI states.
No frontend state, animation, color, shader, layout or metaphor may escalate authority.
Participant-controlled SDK/MCP cannot mint PROVEN.
Claim text, a successful request and a Daemon suggestion do not acquire proof authority.
PROVEN must come from the domain's authorized projected evidence/rules.
The Ship receipt mechanism does not define proof for every other domain.
Cheevos may be PROVEN under their own backend-defined evidence and versioned rules.
Do not invent missing authority or silently downgrade an unsupported truth state.

## 4. Projection law

Design against the exact projection the surface consumes.
Do not design against the union of everything the server knows.
Display only fields and relationships available under the current access boundary.
Formatting labels or arranging supplied facts does not authorize derived authority.
Optional/missing fields remain missing; no guessed actor, outcome or proof substitutes.
Read-only contextual projections retain their original source and scope.
Private source facts remain private when another surface receives a public view.
An internal event family does not extend a generated public event union.
Initial hydration and repeated identical polls do not establish a newly occurred event.
Unsupported contract versions or combinations use the visible failure rule below.

## 5. State dimensions

These are abstract review dimensions, not required fields in a new object:

| Dimension | Question | Constraint |
| --- | --- | --- |
| Authority | Claimed, observed or proven by whom? | Preserve the actual projected level |
| Operational state | What is active, blocked, failed or submitted? | Keep the domain's own vocabulary |
| Provenance | What source/evidence supports this? | Use available references; invent none |
| Freshness/availability | Is this current, stale or unavailable? | Preserve source state and timestamps |
| Attention | Does this need help or intervention? | Require a supported reason |
| Actionability | What operation is available here? | Respect owner, permissions and workflow |

Not every projection supplies all dimensions.
Do not synthesize them to fill a visual template.
An operational ACTIVE state is not OBSERVED or PROVEN.
A stale source may retain historical evidence without claiming current availability.
UNKNOWN and UNAVAILABLE are not synonyms for CLAIMED.
Enum members from different domain types must not become one global lifecycle.

## 6. Thread law

THREAD = durable causal/temporal continuity.
THREAD != one mandatory literal horizontal rail.

| Surface | Continuity |
| --- | --- |
| COMMAND | Mission/gate continuity |
| PROJECT | Project causal continuity supported by its inputs |
| WORLD | Temporal public-event continuity |
| PLAYER | Durable personal history |
| SHIP | Submission / observation / acceptance / receipt lineage |

A literal rail is one rendering of continuity, not the law.
Temporal succession does not by itself prove causal influence.
Current snapshots do not license invented historical intermediate steps.

## 7. Geometry law

SEMANTIC GEOMETRY must correspond to actual domain relationships.

| Encoding | Required support |
| --- | --- |
| Line | Actual linkage or sequence, with its meaning identifiable |
| Order | Actual temporal or causal order; explicit tie handling where needed |
| Comparative size | Actual quantitative value with an understandable scale |
| Distance | Domain-supplied distance/relationship if read as information |
| Position | Domain support whenever position implies semantic meaning |

IDs can identify or stabilize rendering; they cannot supply domain spatial meaning.
No hash-derived/project-ID-derived spatial semantics are permitted.
Spokes, rings, center/radius and sweeps imply information even without an axis label.
A small layout-only disclaimer cannot redeem an otherwise data-like false encoding.

## 8. Semantic vs compositional geometry

COMPOSITIONAL GEOMETRY may organize hierarchy, rhythm, identity and materiality.
Reading order, gutters, frames and case geometry need no backend coordinates.
Hierarchy can establish a focal point without asserting a quantitative ranking.
Semantic priority must still follow the owning surface's actual task.
Decorative lines must not appear to connect entities with nonexistent relationships.
Decorative ticks must not imply measurement, progress or activity.
Decoration may exist. Decoration may not masquerade as information.
If users would reasonably read a mark as data, apply semantic geometry constraints.

## 9. Color law

ACID GREEN = PROVEN ONLY.
This supersedes the older proof/current/actionable overload.

| Color family | Normative semantics |
| --- | --- |
| VIOLET | REKT identity/context; CLAIMED when explicitly used as truth state |
| CYAN | OBSERVED / received |
| AMBER | Attention / help |
| CORAL / RED | Blocked / failed / destructive where appropriate |
| MUTED GREY / LILAC | Stale / unavailable / peripheral, with distinguishing labels |
| ACID GREEN | PROVEN only |

Current/actionable states use hierarchy, locus, weight, glyph or affordance.
Focus and confirmation must not borrow proof-green merely to appear positive.
Color never acts alone: combine text, glyph, shape and available provenance.
Cyan receipt of an input does not certify the content of that input as proven.
Violet identity does not automatically label every violet element a claim.
Existing token/component usage requires a future implementation sweep, not changes here.

## 10. Glyph / label law

Use explicit truth and operational labels whose meaning survives color removal.
Domain glyphs may reinforce familiar text; they must not silently add an authority level.
Provide accessible names for actionable icons and meaningful non-text state.
Keep decorative chassis marks out of semantic announcements.
No glyph may imply success, connection, measurement or proof unsupported by the projection.
Use concise human labels with technical provenance available when the contract supplies it.
Do not bake essential state text into an image or inaccessible canvas.

## 11. Motion law

| Class | Trigger/authority | Boundaries |
| --- | --- | --- |
| AMBIENT | Semantically neutral machine life; no delta required | Quiet, peripheral; implies no arrival/activity |
| REACTIVE | User input | Preserve feedback; do not invent server confirmation |
| EVENT | Authorized canonical/projection delta | Explains actual changed projected state |
| CEREMONY | Rare PROVEN or explicitly authoritative domain event | Bounded, exceptional, source-supported |

NO CANONICAL DELTA → NO EVENT/CEREMONY MOTION.
This does not mean no delta → no motion ever; ambient and reactive classes remain allowed.
Decorative timers must not trigger event arrival, activity or ceremony.
Polling intervals are transport cadence, not a source of new events.
An incoming observation can cause EVENT feedback without earning proof ceremony.
Navigation response is REACTIVE continuity unless a separate authorized event occurred.
GSAP coordinates presentation; it is not an authority producer.
Essential information remains readable after every event effect has ended.
Reduced motion may replace translation/scale with opacity or explicit state feedback.

## 12. Metaphor entitlement law

A strange metaphor earns complexity by mapping actual behavior or materially improving comprehension.
Aesthetic metaphor remains allowed; semantic cost needs a product benefit.

| Reference/evidence | Entitlement result |
| --- | --- |
| OP-1 Tombola research reference | Physics changes musical behavior: complexity serves the instrument |
| Rejected WORLD radar | Arbitrary/hash position implies absent spatial relations: failed |
| Matter signal chamber experiment | Real collisions showed no clear added value: production dependency unjustified |

Research/reference judgments above are author-supplied decisions for this freeze.
The physics experiment is not production visual authority.
WORLD topology remains unresolved across the three composition hypotheses in Surface Purpose.
No Signal Tape composition is frozen as the winner.

## 13. Failure / unsupported-state law

Unsupported projection: preserve authority only if it can be safely represented as supplied.
Otherwise fail visibly closed as unsupported; do not guess a supported replacement.
An unknown future event kind must NOT automatically become CLAIMED.
A supported truth label alone may be insufficient to safely explain an unknown event.
Malformed or contradictory kind/truth combinations require visible unsupported treatment.
Do not erase the original authority by coercing it into a convenient fallback.
Loading, empty, error, stale, unavailable and unsupported are distinct conditions.
Do not hide a feed failure behind an empty-state message or synthetic live activity.
Historical information may remain visible with accurate freshness/error context.
Private details must not leak through error copy or fallback presentation.
The current generated transport does not enforce this fail-closed rule by itself.
Until a separately authorized runtime validation boundary exists, consuming surfaces
must not coerce unknown or malformed payloads into supported labels, events or proof;
this freeze records the acceptance gate and does not retrofit generated source.

## 14. Cross-surface ownership rules

COMMAND owns NEXT MOVE; PROJECT owns PROJECT CURRENT LOCUS.
WORLD owns PUBLIC ACTIVITY / HELP DISCOVERY; PLAYER owns DURABLE BUILDER RECORD.
SHIP owns VERIFICATION / PROOF RECEIPT; SHELL owns MODE ORIENTATION / GLOBAL SEMANTICS.
These are unique primary presentation owners; backend domain authority is unchanged.
Other surfaces may quote available context or deep-link without becoming co-owners.
PROJECT may quote Next Move and link to COMMAND, with project locus remaining dominant.
A cross-surface update occurs only when that surface's authorized projection changes.
A global visual ripple is not evidence that all surfaces possess the originating event.

## 15. Current WORLD event semantics

Verified against generated WorldSignalView and runtime listWorldSignals in social.ts.
Schema: world.signal.public.v1.
Fields: schema_version, signal_id, kind, project_id, project_name, truth_state, occurred_at.
Generated kind/truth unions are separate; runtime supplies these exact mappings:

| Current kind | Truth | Does NOT supply |
| --- | --- | --- |
| HELP_BEACON_OPENED | CLAIMED | Proven need, ranking or matching score |
| ASSIST_ACCEPTED | OBSERVED | Assisting player identity or proven contribution |
| EXTERNAL_TEST_RECORDED | OBSERVED | External test outcome, PASS/FAIL or acceptance |

HELP_BEACON_OPENED = CLAIMED.
ASSIST_ACCEPTED = OBSERVED.
EXTERNAL_TEST_RECORDED = OBSERVED.

GitHub push, Ship submitted, verifier PASS, Ship PROVEN and Cheevo earned are
FUTURE / NOT CURRENTLY REPRESENTABLE as current WORLD event kinds.
The public project/Player discovery views are context, not new WorldSignalView variants.
Runtime returns at most 50 recent events ordered by time and event ID, descending.
Neither complete durable archive access nor canonical spatial relationships are supplied.
The event is observed; omitted attributes and downstream results are not thereby observed.

## 16. SHIP proof semantics

| Generated projection | Current state vocabulary |
| --- | --- |
| ShipSubmissionPrivateView | SUBMITTED / OBSERVED / ATTENTION / ACCEPTED / REJECTED / SUPERSEDED |
| ShipSubmissionPublicView | SUBMITTED / OBSERVED / ATTENTION / PROVEN |
| AcceptedShipArtifactView | truth_state = PROVEN; receipt_id required |

Verifier PASS != PROVEN.
Ship PROVEN requires the accepted Ship/receipt projection and its acceptance evidence.
ShipVerifierObservationView.outcome is PASS / FAILED / UNAVAILABLE, not an acceptance decision.
The server maps private ACCEPTED to public PROVEN, and REJECTED/SUPERSEDED to ATTENTION.
The frontend consumes that public projection; it must not reconstruct hidden private states.
Public ATTENTION therefore does not authorize a public REJECTED label.
Public PROVEN with missing accepted_ship is incomplete proof context: show that limitation,
preserve the received state without embellishment, and do not invent a receipt or ceremony.
AcceptedShipArtifactView carries receipt/schema/rule identifiers and observation/review references.
Describe current receipts as server-authoritative, versioned, receipt-backed acceptance evidence.
No cryptographically signed receipt or cryptographic finality claim is established here.
Global PROVEN is not universally receipt-backed; each domain defines its authoritative evidence.
CheevoView uses PROVEN with its backend-defined rules/evidence, not a frontend award heuristic.

## 17. Reduced-motion / accessibility

Every truth, operation and consequence remains available without animation.
Reduced motion preserves REACTIVE feedback through state, label or brief opacity changes.
Stop continuous buoyancy/drift and unnecessary simulation in reduced-motion presentation.
Ambient effects may be suppressed without losing product meaning or REKT material identity.
EVENT/CEREMONY effects must have stable semantic equivalents.
Keyboard, focus, labels, contrast and reading order remain semantic-layer obligations.
Text must remain legible without CRT/shaders and through narrow mobile layouts.
Never require dragging, spatial memory or catching a moving capsule to access information.

## 18. Renderer/tool boundaries

Foundation: React, Vite, TanStack Query, Base UI / semantic DOM,
CSS / semantic custom properties, SVG, GSAP + @gsap/react, Storybook, Playwright and axe.
Use DOM/SVG by default for readable information, controls and instrument geometry.
GSAP is the choreography authority; no renderer gets a parallel truth or action model.
PixiJS is selective only when DOM/SVG demonstrably cannot handle the realtime 2D requirement.
Three/R3F is rare: atmosphere or genuinely spatial behavior with actual spatial semantics.
It may carry authoritative spatial information only when the domain supplies that meaning.
Semantic access must remain available independently of a GPU renderer.
No current production adoption/recommendation: Matter.js, Rapier, d3-force, Framer Motion,
React Spring, Anime.js, Lottie or another global state store. Do not add Zustand.
A tool enters only when a documented problem requires it; novelty is not that problem.
These constraints authorize neither package additions nor removals in this documentation pass.
The existing LiveWorld radar/hash geometry, continuous sweep and legacy acid-green
uses are known baseline violations of G1/G2 and §§7/11, not evidence that those patterns
are production-approved. Subsequent implementation must remove or hard-block them
before claiming WORLD or visual-grammar compliance.

## 19. Acceptance tests

These are requirements for subsequent scoped implementations, not new test files in this pass.

- Exact surface projection fields and their source operations are identified before design.
- Truth and private/public state vocabularies survive labels, error paths and reduced motion.
- Current WORLD kinds retain the three runtime mappings; unsupported kinds fail visibly.
- Verifier PASS never produces accepted Ship proof or proof ceremony on its own.
- Green appears only with PROVEN meaning, never merely current/actionable state.
- Semantic links, order, comparative size and distance have domain support.
- Material structure remains expressive without appearing to be measurement or activity.
- Repeated identical polls do not replay EVENT/CEREMONY; ambient remains separately permissible.
- A quoted Next Move does not compete with COMMAND's dominant control loop.
- Cross-surface updates require each surface's own authorized projected change.
- PLAYER capability claims distinguish backend types/routes, client operations and actual UI.
- Essential meaning survives motion removal, keyboard use and mobile layout.
- No prototype or library becomes production authority because its tests pass.

## 20. Anti-patterns

- A universal frontend truth DTO that fills missing dimensions for every surface.
- Hash-positioned projects presented as a meaningful radar, graph or constellation.
- Turning a Ship submission or internal GitHub history event into a WORLD event by inference.
- Unknown event fallback to CLAIMED, or public ATTENTION reverse-mapped to private REJECTED.
- Proof-green for a current focus, hover, routine confirmation or primary button.
- Timer-driven arrivals or constant celebrations passed off as canonical activity.
- Banning ambient machine life because event motion requires a delta.
- Deleting material identity because decoration lacks backend fields.
- Claiming a full PLAYER screen from reputation types or declaring personal trust from scores.
- Freezing Signal Tape or blackwater before the authorized composition comparison.

Source anchors at the approved baseline:
[generated projection/operations](../../apps/inkubator-lab/src/generated/inkubator-api-client.ts),
[WORLD runtime](../../apps/inkubator-api/src/social.ts),
[SHIP state mapping](../../apps/inkubator-api/src/ship.ts),
[acceptance](../../apps/inkubator-api/src/ship-acceptance.ts),
[accepted artifact](../../apps/inkubator-api/src/ship-artifact.ts),
and [Cheevo rules](../../apps/inkubator-api/src/reputation.ts).
