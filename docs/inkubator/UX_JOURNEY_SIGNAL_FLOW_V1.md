# REKT INKUBATOR — UX JOURNEY / SIGNAL-FLOW SPEC V1

**Status:** PLANNING ARTIFACT / NO IMPLEMENTATION AUTHORITY  
**Date:** 2026-10-01  
**Branch:** `plan/inkubator-ux-journey-v1`  
**Base:** `integration/inkubator-stage-h-to-main-v1`  
**Merge authority:** NONE  
**Production-money authority:** NONE  
**Stage-I external-human Alpha authority:** NONE

This document is subordinate to:
- `docs/inkubator/REKT_INKUBATOR_NORTH_STAR_V2.md`
- `docs/inkubator/FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md`
- `docs/inkubator/FUNDED_CHALLENGE_PRODUCT_LOCK_V1.md`
- `docs/inkubator/SOLO_OPERATOR_CONSTRAINTS_V1.md`
- `docs/inkubator/REKT_TECHNICAL_FACEPLATE_V1.md`
- the frozen Build Contract / Challenge / trust authorities indexed by `docs/inkubator/INDEX.md`

This is a UX translation layer. It does not redefine economic truth, Challenge authority, Build Contract semantics, qualification, receipt truth, settlement, privacy, verifier behavior, operator privilege, or Stage-H trust boundaries.

---

## 0. Why this exists

The current forward `ChallengeProduct` is technically honest but cognitively inverted.

It exposes the internal product ontology before the user has a reason to care:

`DISCOVER → COMPILER → CHALLENGE → MY BUILD → REVIEW → HISTORY → OPERATOR`

It also exposes implementation-stage language and engineering authority directly:
- `CHALLENGE OS / STAGE E`
- `TRUTH BEFORE THEATER`
- `MONEY / NOT AUTHORIZED`
- `SOURCE / ORGANIZER DRAFT`
- `COMPILE DETERMINISTIC STATE`
- `ORGANIZER_ACCEPTED`
- `PRIZE / MINOR UNITS`
- `SETTLEMENT ASSET`
- `FREEZE NONCANONICAL PREVIEW`
- `PERSIST CANONICAL CONTRACT`
- manual `?challenge=<id>` context

Those phrases are useful to implementers and reviewers. They are not a first-run product journey.

The target user should be able to arrive from TikTok, X, Discord or a shared link and understand the product without prior knowledge of GitHub, blockchain, Build Contracts, compiler architecture, verifier semantics or Inkubator history.

The design target is:

> **VISUAL PERSONALITY: HIGH. OPERATIONAL AMBIGUITY: ZERO.**

---

# 1. Product comprehension contract

Within approximately five seconds, a first-time visitor should be able to answer:

1. What is this?
2. Why would I care?
3. What can I do here?
4. What happens if I press the main button?

The simplest valid public explanation is:

> **Post a build challenge. Lock the rules. Builders race to ship something real.**

Supporting line:

> **Define what should exist, freeze what “done” means, compare real submissions, and keep the receipt.**

When money is actually authorized and economically backed by a canonical rail, the public language may add prize-lock messaging supported by real state. Until then, do not imply real funded settlement.

The current public product line remains compatible:

> **Launch challenges. Lock the prize. Ship real things.**

but **“Lock the prize” may only be presented as present-tense product capability when the authoritative settlement path is actually enabled.**

---

# 2. The one-loop mental model

The user-facing system is one causal loop, not seven equal surfaces.

```text
FIND / CREATE A CHALLENGE
        ↓
UNDERSTAND THE RULES
        ↓
JOIN OR FREEZE THE CONTRACT
        ↓
BUILD
        ↓
SUBMIT
        ↓
CHECK / QUALIFY
        ↓
PICK
        ↓
RECEIPT
        ↓
NEXT CHALLENGE
```

Internal domain boundaries may stay richer.

Public UI should compress them into the minimum concepts needed at the current moment.

### Launch vocabulary

Primary:
- Challenge
- Builder
- Build
- Done When
- Prize
- Join
- Submit
- Review
- Winner
- Receipt

Secondary / progressive disclosure:
- Build Contract
- qualification
- verifier
- terms digest
- blueprint
- provenance
- settlement asset
- archive
- operator exception

Never require the secondary vocabulary to complete a normal first-run task.

---

# 3. Actor-first routing

A new visitor should not be asked to choose a software module.

They should answer one human question:

> **What are you here to do?**

Primary choices:

### I want something built
Organizer path.

### I want to build
Builder path.

Optional tertiary:
### See open challenges
Public browse path.

Do not show `Compiler`, `Review / Test Arena`, `Receipt / History` or `Operator Exceptions` as equal first-run choices.

---

# 4. Golden organizer journey

```text
LANDING
  ↓
I WANT SOMETHING BUILT
  ↓
DESCRIBE WHAT YOU WANT
  ↓
CLARIFY HIGH-IMPACT REQUIREMENTS
  ↓
SEE DRAFT "DONE WHEN"
  ↓
REVIEW RISKS / UNKNOWN DECISIONS
  ↓
LOCK BUILD CONTRACT
  ↓
SET CHALLENGE DETAILS
  ↓
FUND / LAUNCH WHEN AUTHORIZED
  ↓
WATCH ENTRIES
  ↓
REVIEW QUALIFIERS
  ↓
PICK WINNER
  ↓
RECEIPT
```

The compiler is not a destination in this journey. It is an instrument behind:
- “Describe what you want”
- “A few things need your decision”
- “Here is what ‘done’ currently means”

The organizer never needs to know which compiler rule produced a question unless they explicitly open technical details.

---

# 5. Golden builder journey

```text
LANDING / SHARED CHALLENGE
  ↓
SEE WHAT / PRIZE / SLOTS / TIME
  ↓
OPEN CHALLENGE
  ↓
READ DONE WHEN
  ↓
JOIN
  ↓
CONNECT BUILD SOURCE IF REQUIRED
  ↓
BUILD IN EXISTING TOOLS
  ↓
SEE CURRENT QUALIFICATION STATE
  ↓
SUBMIT
  ↓
IMMUTABLE SUBMISSION RECORDED
  ↓
REVEAL / TEST
  ↓
QUALIFIED OR NOT QUALIFIED
  ↓
WINNER DECISION
  ↓
RECEIPT / HISTORY
```

The builder should be able to answer in seconds:
- What am I building?
- What exactly counts as done?
- What can I earn?
- How many slots are left?
- How much time is left?
- What do I do next?

If any builder screen does not answer those questions, it is secondary.

---

# 6. Landing → app must be one continuous product

The current marketing-style legacy surfaces are not the forward app authority. The production entry should not feel like:

```text
marketing site
→ open app
→ new visual language
→ internal dashboard
→ find the correct module
```

Target:

```text
REKT INKUBATOR
→ clear promise
→ choose organizer / builder intent
→ same faceplate shell continues
→ first real action
```

No psychological context reset.

## 6.1 Landing hero

### Human layer

**BUILD SOMETHING REAL.**

or organizer-oriented split headline:

**NEED SOMETHING BUILT?  
TURN IT INTO A CHALLENGE.**

Supporting copy:

> Describe the outcome. Lock what counts as done. Let builders ship real attempts against the same rules.

Primary CTA:
**CREATE A CHALLENGE →**

Secondary CTA:
**BROWSE CHALLENGES**

Tertiary textual path:
**I'M HERE TO BUILD →**

Do not lead with:
- Stage names
- “Challenge OS”
- deterministic compiler terminology
- blockchain
- settlement architecture
- GitHub
- “truth before theater”
- Build Contract digest semantics

Those can become proof of rigor later in the flow.

## 6.2 Ten-second explainer

One visual causal strip:

```text
01 DESCRIBE
02 LOCK "DONE"
03 BUILDERS SHIP
04 CHECK REAL OUTPUTS
05 PICK
06 RECEIPT
```

When real funded settlement is authorized:
```text
01 POST
02 LOCK PRIZE + RULES
03 BUILD
04 CHECK
05 PICK
06 PAY + RECEIPT
```

---

# 7. Information architecture

## 7.1 Public / unauthenticated

Top-level:
- **Challenges**
- **Create**
- **How it works**

Contextual:
- Challenge details
- Receipt details where public
- Sign in / connect only when required

Do not expose Operator.

## 7.2 Authenticated organizer

Primary:
- **Challenges**
- **Create**
- **My challenges**

Contextual route within a Challenge:
- Overview
- Entries
- Review
- Receipt

## 7.3 Authenticated builder

Primary:
- **Challenges**
- **My builds**
- **History**

Contextual route:
- Challenge
- My build
- Submission
- Receipt

## 7.4 Operator

Operator tooling is not consumer navigation.

It requires direct authorized context and should be visually distinct as an administrative instrument.

---

# 8. Screen contract: Discover

Question owned:

> **What can I build right now?**

Every challenge preview should prioritize exactly:

1. What
2. Prize / economic state
3. Slots
4. Time left
5. One state label

Example:

```text
BUILD AN INK WALLET ACTIVITY VIEWER

PRIZE
500 USDC
LOCKED

SLOTS
6 / 10

TIME LEFT
3d 14h

[ VIEW CHALLENGE ]
```

When production money is not enabled, the economic module must say the actual supported state, e.g.:
- TEST CHALLENGE
- NO CASH PRIZE
- SETTLEMENT NOT ENABLED

Never use a visually “locked” prize if no authoritative lock exists.

### Empty state

Bad:
> Challenge discovery transport is not exposed yet.

Product-facing target:
> **NO OPEN CHALLENGES YET.**
>
> The next round will appear here when it opens.

Organizer CTA where authorized:
> **Create a challenge →**

Developer diagnostics belong behind a dev/rehearsal flag.

---

# 9. Screen contract: Create / Compiler

Question owned:

> **What should exist when this is done?**

This surface needs the largest UX change.

## 9.1 Step 1 — Describe

Title:
**WHAT DO YOU WANT BUILT?**

Supporting line:
> Say it normally. You can tighten the rules before anything gets locked.

Textarea placeholder:
> “Build a mobile page that connects an Ink wallet and shows balances and recent activity.”

Primary:
**CONTINUE →**

Secondary details:
> Nothing is locked yet.

## 9.2 Step 2 — Clarify

Do not present eleven equal YES / NO / UNKNOWN system questions at once.

Present only high-impact unresolved decisions returned by the deterministic compiler.

One question per focus region.

Example:

**DO USERS NEED ACCOUNTS?**

> This changes the recommended architecture and acceptance checks.

Buttons:
- Yes
- No
- Not sure

After answer:
- animate/mechanically update a compact “contract changed” readout;
- show what changed in human terms.

The raw rule/provenance remains inspectable under **Why are you asking this?**

## 9.3 Step 3 — Proposed Done When

Title:
**THIS IS WHAT “DONE” MEANS RIGHT NOW**

Checklist rendered from authoritative acceptance/outcome criteria.

Each item must state:
- observable outcome
- whether required
- source/provenance behind a detail affordance

Example:
- [ ] Public HTTPS URL loads
- [ ] User can connect an Ink wallet
- [ ] Wallet balances are visible
- [ ] Last 20 transactions are visible
- [ ] Main flow works on mobile

If compiler status is not READY:

**2 DECISIONS LEFT**

Then show only blockers.

Do not dump:
- reference architecture JSON
- all causal facts
- all findings
- all sensitivity points
- all provenance rows

Those move into a collapsible **Technical contract details** inspector.

## 9.4 Step 4 — Organizer acceptance

Current:
**ACCEPT CURRENT INPUTS**

Target:
**USE THESE RULES →**

Supporting copy:
> You can still review the final contract before it is locked.

Internally this may produce `ORGANIZER_ACCEPTED`; that exact authority label can remain in evidence.

## 9.5 Step 5 — Challenge setup

Human fields:
- Challenge title
- Builder slots
- Entry deadline
- Submission deadline
- Prize (only if rail is authorized)
- settlement asset (advanced / rail-specific, not a novice primary field)

Never ask a normal organizer for “PRIZE / MINOR UNITS”.

Display formatted economic units.

## 9.6 Step 6 — Freeze

Current:
- FREEZE NONCANONICAL PREVIEW
- PERSIST CANONICAL CONTRACT

Target two-stage language:

**REVIEW LOCKED VERSION**

Then:
**LOCK CHALLENGE RULES**

Before lock:
> Builders will compete against exactly this version. Changing it later requires an explicit versioned path; it will not silently mutate.

After lock:
> **RULES LOCKED**
>
> Everyone now builds against the same contract.

Terms digest:
secondary evidence row:
> Contract fingerprint: `…`

---

# 10. Screen contract: Challenge

Question owned:

> **Should I join this, and what exactly am I agreeing to build?**

Above the fold:

- title
- one-sentence brief
- prize / economic state
- slots
- countdown
- Join / Resume build / Review action
- Done When

Visual order:

```text
CHALLENGE TITLE
brief

PRIZE      SLOTS      TIME LEFT
LOCK STATE / real authority

DONE WHEN
□ ...
□ ...
□ ...

[ JOIN CHALLENGE ]
```

Secondary below:
- build contract version
- assumptions / unknowns
- reference architecture
- public entries if policy permits
- provenance / receipt links

Do not lead with:
- challenge UUID
- terms digest
- current contract version string
- evidence counts
- raw timestamps

Those remain inspectable.

---

# 11. Screen contract: My Build

Question owned:

> **What do I need to do next to submit a qualifying build?**

Top block:

**YOUR BUILD**

Challenge title

Progress against Done When:
- 3 / 5 checks currently satisfied
- 2 require action / evidence

Time:
**18H 42M LEFT**

Dominant action:
- CONNECT SOURCE
- CONTINUE BUILDING
- RUN CHECK
- SUBMIT
depending on state

This is a state-driven action surface, not a project manager.

Build work remains in GitHub / IDE / coding agent.

## Source connection

GitHub is introduced only when needed.

Title:
**LET REKT SEE THE BUILD**

Copy:
> Connect the project you are using for this challenge. REKT only asks for the access required by this challenge.

Concrete permission bullets based on actual configured GitHub App permissions.

Primary:
**CONTINUE WITH GITHUB →**

After success:
> **SOURCE CONNECTED**
>
> REKT can now observe the build evidence required for this challenge.

Do not make “repository” the primary novice noun. Say **project**, with “GitHub repository” as secondary explanation.

---

# 12. Signal grammar in human language

Machine truth must remain exact.

Human interpretation sits directly beside it.

### CLAIMED

Machine:
`CLAIMED`

Human:
**You said this is done.**

Supporting:
> REKT has not independently observed it yet.

### OBSERVED

Machine:
`OBSERVED`

Human:
**REKT saw supporting evidence.**

Supporting:
> Observation is not the same as qualification.

### QUALIFIED / ACCEPTED

Use the exact Stage-G authority term defined by the canonical contract.

Human:
**This build satisfies the required checks.**

### PROVEN

Only where canonical authority actually authorizes PROVEN semantics.

Human:
**Verified against the frozen contract.**

Never turn verifier PASS alone into PROVEN.

Green remains reserved for canonical PROVEN semantics per visual authority.

---

# 13. Submission flow

Question owned:

> **Am I about to lock the exact thing I want reviewed?**

Before submission:

**READY TO SUBMIT?**

Show:
- artifact URL / source
- contract version
- Done When summary
- immutable-submission warning
- deadline

Primary:
**SUBMIT BUILD**

Confirmation:
> This records an immutable submission for this challenge version.

After:
> **SUBMISSION RECORDED**
>
> Your build is locked for this review round.

Show receipt/fingerprint as secondary evidence.

No generic success confetti required. A rare, mechanical faceplate state change is enough.

---

# 14. Review / Test Arena

Question owned for organizer:

> **Which submissions actually qualify, and which qualifier do I prefer?**

Ordering:

1. Qualification state
2. Required Done When results
3. Artifact preview/open
4. Evidence
5. Preference comparison only among qualifiers
6. Winner selection action

Never visually rank unqualified and qualified builds using one blended score.

Never imply model taste is authority.

The organizer may choose among qualifiers using explicit preference criteria where the canonical product allows it.

Dominant terminal action:
**SELECT WINNER**

Before confirmation:
> This records the organizer selection against the frozen challenge and qualifying submissions.

If payout is not authorized, stop at selection / test receipt state and say so explicitly.

---

# 15. Receipt

Question owned:

> **What permanently happened?**

Receipt is a first-class product artifact.

Hero:
**CHALLENGE COMPLETE**

Then:
- challenge
- selected build
- builder
- frozen contract version
- qualification result
- prize / payout state if real
- timestamp
- receipt ID
- artifact
- economic/IP state where canonical and applicable

Primary:
**SHARE RECEIPT**

Secondary:
**VIEW EVIDENCE**

Machine rows:
- terms digest
- qualification manifest
- archive refs
- settlement provenance
behind “Technical receipt”.

Receipt language must distinguish:
- selected
- paid
- unpaid
- cancelled
- disputed
- test-only
exactly.

---

# 16. Navigation behavior

The current seven-button rail is useful for a lab, but wrong for first-run production.

## Desktop

Public:
- Challenges
- Create
- How it works
- account

Organizer:
- Challenges
- Create
- My challenges

Builder:
- Challenges
- My builds
- History

Challenge context may display a compact contextual step rail:
`Challenge → Build → Submit → Review → Receipt`

Do not make every step permanently active or clickable when not authorized.

## Mobile

Maximum four primary destinations.

Minimum touch target:
- 44×44 CSS px absolute floor
- primary actions preferably 48–56px high

No precision-operated micro controls for required actions.

---

# 17. Typography contract

The Technical Faceplate authority allows tiny machine print, but practical legibility wins for required information.

## Human / functional mobile

- hero/title: `clamp(2.5rem, 11vw, 4rem)`
- page title: 30–40px
- primary action statement: 20–24px
- body: 16–18px
- buttons: 16px minimum
- supporting copy: 14–16px
- required labels: 14px minimum

## Machine print

- 10–12px preferred
- 9px only for nonessential manufacturing/identity print
- never use 8px for information required to understand, decide or recover

## Desktop

- hero: 56–80px where composition permits
- page title: 40–64px
- body: 16–18px
- functional labels: 12–17px
- technical print: 9–11px when nonessential

Do not set whole operational surfaces in mono.

The extreme contrast remains:
**large human statement + small machine evidence + readable functional layer.**

---

# 18. One dominant action law

Every state gets one dominant action.

Examples:

Landing:
**CREATE A CHALLENGE**

Create/describe:
**CONTINUE**

Compiler blocker:
**ANSWER THIS DECISION**

Ready contract:
**REVIEW LOCKED VERSION**

Final contract:
**LOCK CHALLENGE RULES**

Challenge as builder:
**JOIN CHALLENGE**

My Build:
**RUN CHECK** or **SUBMIT BUILD**

Review:
**SELECT WINNER**

Receipt:
**SHARE RECEIPT**

Secondary controls can exist, but must not compete with the current causal step.

---

# 19. Empty / loading / stale / unauthorized / error copy

Preserve Stage-E state distinctions, translate them.

## EMPTY

Human:
**NOTHING HERE YET.**

Then explain the next event that creates data.

## LOADING

Human:
**CHECKING THE LATEST CHALLENGE STATE…**

Do not fabricate stale values.

## UNAVAILABLE / STALE

Human:
**THIS PART ISN'T AVAILABLE RIGHT NOW.**

If last trustworthy value exists:
show value + timestamp + “last verified”.

## UNAUTHORIZED

Human:
**YOU DON'T HAVE ACCESS TO THIS.**

Provide valid recovery if one exists.

## ERROR

Human:
**WE COULDN'T LOAD THIS STATE.**

Then:
- what remains trustworthy
- retry
- technical details expandable

Do not expose transport jargon as the headline.

---

# 20. Trust / permission seam

The permission seam must explain concrete consequences before redirecting to a provider.

Bad:
> Authorize GitHub App.

Target:

**CONNECT YOUR BUILD**

> REKT needs to observe the project used for this challenge so it can verify the required evidence.

Then concrete actual permissions:
- can read …
- cannot write …
- you choose …

These bullets must be generated from / validated against the actual GitHub App permission contract, not hard-coded wishful copy.

Provider terminology can remain in technical details.

---

# 21. Faceplate application

Do not redesign the brand into generic SaaS.

Preserve:
- pale chassis
- black print
- extreme type scale
- purposeful micrographics
- localized dark instrument wells
- sparse orange control
- semantic display colors
- mechanical low-frame motion
- detailed-not-decorated rule

But assign each visual layer a cognitive role:

### Pale chassis
Human meaning and choices.

### Dark well
Live/derived machine state, comparison, evidence, testing.

### Micro print
Provenance, IDs, timestamps, contract fingerprints, calibration.

### Orange
Current action / selected control.

### Cyan
Observed supported signal.

### Acid green
Canonical PROVEN only.

A novice should be able to ignore most micro print and still complete the journey correctly.

---

# 22. What to remove from first-run production

Hide from normal first-run flow unless context requires it:
- STAGE E / Stage names
- internal gate names
- “Challenge OS”
- `SOURCE / ORGANIZER DRAFT`
- `ORGANIZER_ACCEPTED`
- deterministic rule IDs
- raw compiler version
- raw reference architecture JSON
- raw challenge UUID as primary identity
- raw terms digest as primary content
- “minor units”
- manual challenge query parameters
- operator tooling
- all seven surfaces as equal navigation
- unavailable future surfaces as dead-end primary nav items

These remain available in:
- developer/rehearsal mode
- evidence inspector
- operator interface
- test fixtures
- technical receipt

---

# 23. Current code → target translation table

| Current surface/copy | Target user-facing role |
| --- | --- |
| `DISCOVER` | Challenges |
| `COMPILER / CREATE` | Create |
| `CHALLENGE` | Challenge |
| `MY BUILD` | My Build |
| `REVIEW / TEST ARENA` | Review, only in challenge context |
| `RECEIPT / HISTORY` | History / Receipt |
| `OPERATOR EXCEPTIONS` | Remove from consumer nav |
| `WHAT SHOULD EXIST WHEN THIS IS DONE?` | Keep; strong human question |
| `COMPILE DETERMINISTIC STATE` | Continue / Check the spec |
| `ACCEPT CURRENT INPUTS` | Use these rules |
| `NEGOTIATED BUILD CONTRACT` | What counts as done |
| `FREEZE NONCANONICAL PREVIEW` | Review locked version |
| `PERSIST CANONICAL CONTRACT` | Lock challenge rules |
| `PRIZE / MINOR UNITS` | Prize |
| `SETTLEMENT ASSET` | payment rail detail; hide unless needed |
| `TERMS DIGEST` | Contract fingerprint |
| `UNAVAILABLE / DO NOT SUBSTITUTE LEGACY DATA` | This part isn't available right now |

---

# 24. Signal-flow invariants

For every interactive control, document:

```text
CONTROL
→ PRECONDITION
→ AUTHORITATIVE REQUEST
→ OPTIMISTIC UI? YES/NO
→ SUCCESS STATE
→ FAILURE STATE
→ NEXT DOMINANT ACTION
→ RECEIPT / AUDIT EFFECT
```

No control may:
- imply a state transition it does not cause;
- claim money is locked without canonical settlement truth;
- claim qualification from participant/client input;
- claim PROVEN from verifier PASS alone;
- hide a blocking unknown;
- silently use historical Project/Mission state as Challenge authority;
- allow visual success to outrun durable server state.

---

# 25. Button-level mapping required before implementation

Implementation must inventory every existing production-path button in:
- `apps/inkubator-lab/src/challenge-ui/ChallengeProduct.tsx`
- Stage-F/G UI routes/components promoted into the integration lineage
- auth/source connection components
- receipt/test-arena components
- any current landing entrypoint

For each button, produce a table:

| Visible control | Current effect | Canonical state touched | Target label | Keep/change/remove | Recovery |
| --- | --- | --- | --- | --- | --- |

Anything with no clear causal effect or recovery path is challenged for removal.

---

# 26. Minimum implementation slice

Do not rewrite the whole frontend.

First bounded slice:

1. production landing / entry shell
2. actor-intent fork
3. simplified public nav
4. Discover human empty/normal states
5. Create step 1: plain-language intent
6. progressive compiler questions
7. proposed Done When summary
8. human organizer-acceptance action
9. human contract review/freeze wording
10. Challenge page human hierarchy
11. evidence/details progressive disclosure
12. mobile typography/touch correction
13. production-vs-rehearsal diagnostic separation

Explicit non-goals for slice 1:
- new settlement rail
- production money
- Stage-I public Alpha
- new verifier semantics
- new compiler rules
- new challenge economic policy
- new dispute system
- social feed
- XP/gamification
- visual identity restart
- legacy WORLD/COMMAND/PROJECT/PLAYER/SHIP revival

---

# 27. Verification gates

Aesthetic review is not sufficient.

## 27.1 Five-second test

A novice sees landing for five seconds, then answers:
- What is REKT Inkubator?
- What can I do here?

Target: at least 4/5 accurate.

## 27.2 First-task test

No coaching.

Organizer task:
> Create a draft challenge for a mobile wallet activity viewer.

Builder task:
> Find a challenge, explain what counts as done, and identify the next action.

Target:
- 4/5 complete without intervention
- no participant needs to know the word “compiler”
- no participant needs to understand a terms digest

## 27.3 Trust test

Before any GitHub/provider authorization, ask:
- What will REKT be able to do?
- What will it not be able to do?

Target: 5/5 can state the material permission boundary correctly.

## 27.4 State test

Give users examples of:
- claimed
- observed
- qualified
- proven

Target:
- 0/5 call an observed-only build “verified”
- 0/5 call a verifier-only PASS “winner” or “paid”

## 27.5 Mobile test

Viewport:
- 390×844
- 320px narrow fallback where supported

Acceptance:
- no horizontal overflow
- no required text below 14px
- no required touch target below 44×44
- one dominant action visible without precision tapping
- Done When remains readable without opening technical details

## 27.6 Accessibility

Preserve:
- axe zero critical violations in gated screens
- keyboard complete
- visible focus
- reduced motion
- state not encoded by color alone
- semantic headings / labels
- zoom/text-spacing resilience

---

# 28. Product kill tests

This UX pass fails if a novice describes the product as:
- a dashboard
- a compiler
- a GitHub tool
- a blockchain thing
- a weird terminal
- a project manager

Target description:

> “You post something you want built, lock what done means, builders make real versions, then you compare the ones that qualify.”

Builder target:

> “I can see the prize/rules/time, build against the same checklist as everyone else, submit, and see what actually happened.”

---

# 29. Recommended implementation sequence

```text
UX0  Button/signal-flow inventory
UX1  Landing + actor fork
UX2  Nav simplification + diagnostics separation
UX3  Organizer Create progressive disclosure
UX4  Challenge page hierarchy
UX5  Builder My Build + source-permission seam
UX6  Submission / qualification human-state translation
UX7  Review + Receipt closure
UX8  Mobile + accessibility + novice rehearsal
```

Each slice:
`IMPLEMENT → TEST → ONE hostile review → fix Critical/High → ONE targeted rereview if needed → CLOSE`

No broad redesign loop.

---

# 30. Immediate next action

Before changing visual code:

1. inventory current forward-route components and controls on the integration branch;
2. map them into the signal-flow table defined in §25;
3. identify which production-path Stage-F/G components exist but are not currently surfaced by `ChallengeProduct`;
4. produce the smallest UX1 changeset that creates:
   - coherent landing entry;
   - actor-intent fork;
   - simplified navigation;
   - human Discover/Create first step;
5. leave backend contracts and truth semantics untouched.

The first implementation PR should be judged on **journey coherence**, not visual novelty.

---

# VERDICT

**BUILD NOW — bounded UX integration.**

The core system is significantly more mature than the current human journey suggests. The bottleneck is no longer proving that REKT can represent rigorous Challenge truth; it is exposing that truth in the correct sequence and vocabulary.

The winning design is not “simpler backend semantics.”

It is:

> **SIMPLE FIRST LAYER + RIGOROUS INSPECTABLE SECOND LAYER.**

And the operating UX law is:

> **THE USER SHOULD ALWAYS KNOW WHAT THIS SCREEN MEANS, WHAT HAPPENED, AND WHAT TO DO NEXT.**
