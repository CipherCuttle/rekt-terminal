# REKT INK(CUBATOR) — SURFACE PURPOSE V1

## 0. Status / authority

Status: CANONICAL / AUTHOR-SUPPLIED SURFACE OWNERSHIP FREEZE.
Date: 2026-09-08.
Scope: product purpose, information ownership and implementation constraints.
Approved PROJECT baseline: 063eface55a75dda773647ece5df97eda847ed99.
The later WORLD radar and physics commits are evidence, not approved parents.

Read with [Signal Grammar V1](REKT_SIGNAL_GRAMMAR_V1.md).
Together these documents constrain surface purpose and presentation.
They do not replace domain truth, composed API contracts or generated clients.
[Decision Register](DECISION_REGISTER_V0.md) records the controlled G1–G3 changes.
[Instrument OS](REKT_INSTRUMENT_OS_V1.md) retains compatible material/design authority.
Where older surface, renderer or motion guidance conflicts, this pair governs.
Earlier roadmap sequences are not authorization to resume production UI work.

This pass authorizes documentation only; it does not certify existing UI compliance.
At the approved baseline, legacy `LiveWorld` still contains hash-positioned radar
geometry/continuous sweep behavior and legacy visible surfaces still contain
acid-green uses outside proof. Those are known implementation gaps, not compatible
examples of this freeze; WORLD visual compliance remains blocked until they are
removed or hard-blocked in a separately authorized implementation pass.
WORLD composition A/B/C is the next authorized experiment, not work performed here.
PLAYER and SHIP builds remain unauthorized by this freeze.
PROJECT remains frozen at the approved baseline pending separate implementation scope.

## 1. Product thesis

REKT Inkubator is a software instrument for turning builds into working artifacts.
It makes current work, public activity and durable evidence understandable.
Its identity comes from a shared machine language with distinct surface jobs.
It must feel recognizably REKT without making users decode fictional telemetry.

The semantic layer is exact, accessible and contract-derived.
The material layer may be strange, textured, expressive and culturally specific.
Material may make the machine memorable without asserting that something happened.
Neither familiarity nor spectacle excuses a competing truth model.

CLAIMED != OBSERVED != PROVEN.
The frontend may expose context; it may not manufacture authority.
Thread supplies durable causal or temporal continuity across the product.
Thread does not prescribe one literal rail or identical compositions everywhere.

## 2. Surface ownership

Each important concept has exactly one PRIMARY surface owner.
Ownership here means responsibility for presentation and interaction hierarchy.
The backend retains domain authority regardless of which surface presents it.

| Surface | Primary job | Unique question |
| --- | --- | --- |
| WORLD | Peripheral public awareness | What is happening around me in the Inkubator that I would otherwise miss? |
| COMMAND | Dominant Next Move and active control loop | What should I do now? |
| PROJECT | One project's current locus, provenance and trajectory | What is actually happening to this thing I am building? |
| PLAYER | Durable builder evidence/history | What has this builder actually done and earned? |
| SHIP | Artifact verification, acceptance and receipt/proof semantics | What artifact exists, what was observed, and what was actually accepted? |
| SHELL | Global orientation and common semantic/material language | Where am I in the machine? |

Surface existence does not imply equal top-level navigation prominence.
PLAYER and SHIP may be contextual instruments or routes rather than ModeRail peers.
Navigation prominence remains open; it does not change information ownership.

## 3. SHELL

USER: anyone moving through the Inkubator.
PROBLEM: changing context can obscure where the user is and what controls mean.
WHY IT EXISTS: provide stable orientation and a common REKT instrument language.
UNIQUE QUESTION: Where am I in the machine?

PRIMARY OWNER RESPONSIBILITIES:

- Mode and object orientation, navigation affordances and focus continuity.
- Common semantic labels, accessible interaction conventions and material identity.
- Clear boundaries between public, personal and project-specific contexts.

ALLOWED CONTEXT: compact identity/object labels needed to orient navigation.
MUST NOT DO: become a global activity dashboard or a second action-priority engine.
MUST NOT DO: turn decorative lamps or microticks into unsourced live status.
CURRENT INPUT AVAILABILITY: app mode/URL state and route-supplied context exist.
TerminalShell is an existing presentation component, not a global domain DTO.
No universal server snapshot is required or authorized by shell ownership.
CONFIDENCE: high in the orientation role; navigation membership remains provisional.
OPEN QUESTIONS: which contextual destinations warrant permanent ModeRail presence?

## 4. WORLD

USER: builders, collaborators and public visitors noticing useful activity.
PROBLEM: relevant public events and requests for help otherwise remain invisible.
WHY IT EXISTS: make the surrounding Inkubator perceptible without demanding focus.
UNIQUE QUESTION: What is happening around me in the Inkubator that I would otherwise miss?

PRIMARY OWNER RESPONSIBILITIES:

- Public activity awareness and discovery of projects/help needs.
- Temporal continuity of the public events actually returned by its contract.
- Legible context and routes into the primary project, builder or artifact owner.

ALLOWED CONTEXT: public project names, declared builder capabilities and help beacons.
MUST NOT DO: become COMMAND, a recommendation engine, a trust ranking or surveillance.
MUST NOT DO: imply graph proximity, strength, influence or quality through layout.
MUST NOT DO: infer a Ship, test outcome or assisting identity from a narrow event.
CURRENT INPUT AVAILABILITY: LiveWorld queries discoverProjects, discoverPlayers,
and listWorldSignals through the generated client.
WorldSignalView contains only its schema version, ID, kind, project ID/name,
truth_state and occurred_at; it supplies no canonical spatial/graph relationship data.

Current runtime mappings are fixed:

- HELP_BEACON_OPENED = CLAIMED.
- ASSIST_ACCEPTED = OBSERVED.
- EXTERNAL_TEST_RECORDED = OBSERVED.

GitHub push, Ship submitted, verifier PASS, Ship PROVEN and Cheevo earned are
FUTURE / NOT CURRENTLY REPRESENTABLE as WorldSignalView event forms.
Their existence in another domain or internal history does not add WORLD events.
The current feed is a bounded recent projection, not a complete historical archive.
CONFIDENCE: high in public-awareness ownership; low in final composition.
OPEN QUESTIONS: pure tape, dispatch plus tape, or receiver arrival plus tape?
All three must use the same truthful temporal backbone; none is the frozen winner.
Semantic-free radar is superseded; blackwater remains experiment evidence only.

## 5. COMMAND

USER: the builder actively deciding and doing the next piece of work.
PROBLEM: mission status, evidence and blockers can fragment into competing actions.
WHY IT EXISTS: keep the active build control loop coherent and actionable.
UNIQUE QUESTION: What should I do now?

PRIMARY OWNER RESPONSIBILITIES:

- One dominant Next Move in the context of the current Mission.
- Mission/gate continuity, blockers and the active operational control loop.
- Distinguishing canonical mission state from source observations and advisory advice.

ALLOWED CONTEXT: project identity, source state, help/Party and Ship readiness.
MUST NOT DO: become a full backlog manager or public engagement feed.
MUST NOT DO: let a Daemon suggestion replace or compete with canonical Next Move.
CURRENT INPUT AVAILABILITY: getMyCommand returns CommandView with project,
mission, optional round, gates, GitHub evidence and Daemon advisory fields.
LiveCommand also queries getProjectHelpLoop when the project context is available.
MissionGateView.position supplies actual gate order; it is not arbitrary ranking.
The participant gate update vocabulary excludes OBSERVED and PROVEN.
CONFIDENCE: high in purpose, primary ownership and the current projection seam.
OPEN QUESTIONS: operational density and disclosure depth require user evidence.
This freeze neither reimplements nor reapproves existing COMMAND visual details.

## 6. PROJECT

USER: a builder or authorized collaborator understanding one continuing project.
PROBLEM: the project's current locus and how it got there become hard to inspect.
WHY IT EXISTS: provide a coherent account of this thing, its evidence and trajectory.
UNIQUE QUESTION: What is actually happening to this thing I am building?

PRIMARY OWNER RESPONSIBILITIES:

- One project's current locus, provenance and available causal continuity.
- Project context for help, external testing, source and artifact inspection.
- Linking current evidence to the appropriate owning instrument.

ALLOWED CONTEXT: quote Next Move and link to COMMAND; show a Ship summary/link.
MUST NOT DO: make a second competing Next Move dominant or invent historical edges.
MUST NOT DO: expose private source detail through public contextual projections.
CURRENT INPUT AVAILABILITY: LiveProject starts from getMyCommand and queries
getPrivateProject, getProjectHelpLoop, getProjectExternalTests and getProjectShipState.
This is an authenticated, current-project composition; it is not proof of a general
public project-history browser or an unbounded causal-history API.
PrivateProject includes focus, goal, ship condition and authorized source metadata.
ProjectExternalTestsView contains outcomes that the narrower WORLD signal omits.
ProjectShipStateView carries the public submission/accepted artifact seam.
CONFIDENCE: high in purpose; visually approved at the frozen PROJECT baseline.
OPEN QUESTIONS: future public trajectory depth and archive navigation remain scoped work.
Visual approval does not exempt future changes from Signal Grammar constraints.

## 7. PLAYER

USER: someone inspecting a builder's durable work and contribution evidence.
PROBLEM: accomplishments and contribution context are easily reduced to popularity.
WHY IT EXISTS: make what a builder did and earned inspectable over time.
UNIQUE QUESTION: What has this builder actually done and earned?

PRIMARY OWNER RESPONSIBILITIES:

- Durable builder evidence/history and evidence-linked earned recognition.
- Context for Ships, Assists and other contributions when supplied by its contract.
- Separating declared capability from backend-defined awards and reputation facts.

ALLOWED CONTEXT: public identity, relevant project links and receipt/award references.
MUST NOT DO: compress history into a scalar trust/XP score or declare a person trustworthy.
MUST NOT DO: infer validated demand or complete frontend readiness from backend types.
CURRENT INPUT AVAILABILITY: profile, public/private identity and discovery operations exist.
The generated client defines PlayerReputationView and CheevoView.
Backend reputation routes and versioned award rules exist in reputation-api.ts/reputation.ts.
The inspected generated client has no reputation or contextual-board operation methods.
Generated type declarations do not establish runtime operation availability or runtime
payload validation. A future Player surface must prove both the operation seam and a
visible unsupported-payload boundary before claiming readiness.
The app entry routes live COMMAND, PROJECT and WORLD; no production PLAYER route exists.
Backend capability != client operations != production PLAYER screen != validated demand.
CONFIDENCE: medium in dossier purpose; lower in full input and navigation readiness.
OPEN QUESTIONS: permanent ModeRail destination or contextual dossier/deep link?
No PLAYER build or client-operation additions are authorized by this pass.

## 8. SHIP

USER: a builder submitting work, or someone inspecting an artifact and its acceptance.
PROBLEM: submission, observation and acceptance can look like the same success state.
WHY IT EXISTS: make the artifact and the exact evidence behind acceptance inspectable.
UNIQUE QUESTION: What artifact exists, what was observed, and what was actually accepted?

PRIMARY OWNER RESPONSIBILITIES:

- Artifact verification, acceptance and Ship receipt/proof presentation.
- Submission / observation / acceptance / receipt lineage where actually projected.
- Artifact-first inspection, with truthful provenance and attribution in support.

ALLOWED CONTEXT: project/Mission identity and projected builder/Assist attribution.
MUST NOT DO: equate verifier PASS with acceptance or expose private state as public state.
MUST NOT DO: call current receipts cryptographically signed or claim cryptographic finality.
CURRENT INPUT AVAILABILITY: submitShip, getProjectShipState and getShipReceipt exist.
ShipSubmissionPrivateView: SUBMITTED / OBSERVED / ATTENTION / ACCEPTED / REJECTED / SUPERSEDED.
ShipSubmissionPublicView: SUBMITTED / OBSERVED / ATTENTION / PROVEN.
AcceptedShipArtifactView includes truth_state = PROVEN, receipt_id, schema/rule versions,
artifact, builders, assists, acceptance evidence and shipped_at.
Verifier PASS != PROVEN; Ship proof requires the accepted Ship/receipt projection.
Public PROVEN without the accepted artifact is incomplete proof context, not a cue to infer it.
Current receipts are server-authoritative, versioned, receipt-backed acceptance evidence.
That Ship rule does not make every domain's PROVEN universally receipt-backed.
Cheevos can carry PROVEN under their own backend-defined evidence/rules.
CONFIDENCE: high in domain distinctions; final dedicated surface remains unvalidated.
OPEN QUESTIONS: contextual artifact route or permanent ModeRail destination?
No SHIP build is authorized by this pass.

## 9. Information ownership matrix

| Important concept | Exactly one PRIMARY owner | Permitted secondary use |
| --- | --- | --- |
| NEXT MOVE | COMMAND | PROJECT may quote and link; no competing dominant action |
| PROJECT CURRENT LOCUS | PROJECT | COMMAND/WORLD may give context and a project link |
| PUBLIC ACTIVITY / HELP DISCOVERY | WORLD | Other surfaces may show relevant local context |
| DURABLE BUILDER RECORD | PLAYER | Identity/contribution excerpts may link to the dossier |
| VERIFICATION / PROOF RECEIPT | SHIP | Other surfaces may quote accepted artifact evidence |
| MODE ORIENTATION / GLOBAL SEMANTICS | SHELL | Local headings use the common conventions |

Ownership is a product responsibility, not a requirement to duplicate a backend entity.
Cross-surface quotes preserve the source projection's privacy and truth ceiling.
No secondary surface becomes a co-owner by adding its own priority or acceptance logic.

## 10. Necessary-context vs duplication rule

Context is necessary when it helps the current surface answer its unique question.
A quote or deep link is allowed when its source, scope and authority remain clear.
Repeating an entity name is not automatically duplication of responsibility.

Before adding a projection, identify the primary owner and the local user need.
Show the smallest sufficient excerpt and retain a route to its owning context.
Do not reproduce the owner's whole control loop merely because data is available.
Do not broaden a surface query solely to make an expressive metaphor possible.

PROJECT may quote the canonical Next Move while its own locus remains dominant.
WORLD may show a help request without becoming a personal action-priority engine.
SHIP may show builder attribution without calculating a builder trust score.
An accepted artifact elsewhere does not authorize a new WORLD event kind.

## 11. Semantic vs material layers

SEMANTIC LAYER: truth-bearing, exact, contract-derived and accessibility-critical.
Its labels, links, order and visual encodings must explain actual projected facts.
Meaning remains available with motion, textures and GPU effects disabled.

MATERIAL / ATMOSPHERE LAYER: identity-bearing and not dependent on backend events.
It may include chassis markings, grain, labels, microticks and case geometry.
CRT, cassette and industrial texture, and restrained REKT character remain allowed.
Decorative labels must be recognizable as chassis/brand language rather than telemetry.
Materiality is not a reason to make the interface sterile or generic.

Decoration may exist. Decoration may not masquerade as information.
A decorative line must not look like an unsourced project relationship.
Ambient machine life must not imply incoming activity or authoritative success.
ACID GREEN = PROVEN ONLY, including in otherwise decorative material.

## 12. Element entitlement

Every SEMANTIC element must serve at least one of these roles:

| Role | Test |
| --- | --- |
| ORIENTATION | Does it identify context or location? |
| STATE | Does it communicate the actual projected condition? |
| PROVENANCE | Does it identify the source or authority of a claim? |
| ATTENTION | Does it expose a justified need, blocker or exception? |
| ACTION | Does it enable a relevant available operation? |
| FEEDBACK | Does it explain an input result or authorized change? |
| MEMORY | Does it preserve meaningful evidence or continuity? |
| IDENTITY | Does it identify the relevant person, project or artifact? |

Material elements may instead serve MATERIALITY, RHYTHM, HIERARCHY or BRAND IDENTITY.
They need no fictional data justification and must remain non-authoritative.
Entitlement is not an instruction to delete all decoration.
Reject an element whose apparent information content has no contract support.

## 13. Open questions / confidence

| Decision | Confidence / status |
| --- | --- |
| COMMAND owns dominant Next Move | HIGH / FROZEN |
| PROJECT owns project locus and provenance | HIGH / FROZEN; approved baseline retained |
| WORLD owns peripheral public awareness | HIGH / FROZEN purpose |
| WORLD composition/topology | OPEN; A/B/C comparison pending |
| PLAYER durable dossier purpose | MEDIUM; input/demand validation incomplete |
| PLAYER/SHIP permanent navigation prominence | OPEN; contextual routes remain viable |
| SHIP separates observation and acceptance | HIGH / contract-supported |
| Shared material language with exact semantics | HIGH / FROZEN constraint |

These are product confidence statements, not scores to display in the interface.
No open question is permission to invent backend capability or silently resume Phase 9.

## 14. Prototype register

| Candidate / evidence | Disposition |
| --- | --- |
| PROJECT 063eface55a75dda773647ece5df97eda847ed99 | Visually approved; frozen implementation parent |
| WORLD radar d781bf21c1ebcb438a5b083a8f496114118bdd80 | Technically green; visually rejected; no visual authority |
| Physics chamber f6a87546e3e6588db812744797a6e795d9672a58 | Isolated synthetic A/B/C; Matter showed no clear added value |
| A: PURE SIGNAL TAPE | Hypothesis only |
| B: NOW / DISPATCH + SIGNAL TAPE | Hypothesis only |
| C: RECEIVER / EXPRESSIVE ARRIVAL + SIGNAL TAPE | Hypothesis only |

The three future candidates share the same truthful temporal backbone and event content.
Signal Tape is not frozen as the winning composition.
Blackwater and real collisions do not justify a production Matter dependency.
Next composition evaluation must compare comprehension, awareness and identity.
Technical success alone does not establish visual or product authority.

## 15. Kill criteria

Reject a proposed surface or element when it:

- Competes with another surface's primary responsibility or dominant Next Move.
- Escalates CLAIMED/OBSERVED through color, animation, size or celebratory treatment.
- Lists unsupported WORLD events as current contract capability.
- Treats verifier success as accepted Ship proof.
- Equates builder evidence with an algorithmic judgment of personal trustworthiness.
- Uses decorative geometry to imply unsupported relationships, rank or progress.
- Demands an expensive metaphor without actual behavior/comprehension value.
- Suppresses all material identity in the name of semantic exactness.
- Makes event meaning available only in animation or excludes reduced-motion users.
- Freezes untested navigation prominence or a WORLD topology by implication.
- Treats this constitutional pass as production implementation authorization.

Contract evidence for this freeze is pinned to the approved parent above:
[generated client](../../apps/inkubator-lab/src/generated/inkubator-api-client.ts),
[WORLD runtime](../../apps/inkubator-api/src/social.ts),
[SHIP runtime](../../apps/inkubator-api/src/ship.ts),
[accepted artifact](../../apps/inkubator-api/src/ship-artifact.ts),
[PLAYER backend seam](../../apps/inkubator-api/src/reputation-api.ts),
and [production entry](../../apps/inkubator-lab/src/main.tsx).
