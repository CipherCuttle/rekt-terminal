# REKT INKUBATOR — NORTH STAR V2 + EVOLUTION ROADMAP

**Status:** USER-AUTHORIZED STRATEGIC NORTH STAR / PLANNING AUTHORITY ONLY  
**Date:** 2026-09-13  
**Branch:** `plan/inkubator-challenge-os-v1`  
**Implementation authority:** NONE  
**Production-money authority:** NONE  
**Merge authority:** NONE

This document locks the long-horizon destination for REKT Inkubator **and** the staged path from the current repository state. It does not authorize immediate implementation of every capability described here.

Where product-strategy direction conflicts with older North Star / MVP / Challenge-OS planning, this document wins. `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` continues to control near-term funded-Challenge mechanism, trust, privacy, settlement and launch-safety constraints. `REKT_TECHNICAL_FACEPLATE_V1.md` remains the highest visual execution authority.

`IMPLEMENTATION_ROADMAP_MVP_V0.md` remains historical evidence for capabilities already built; it is no longer the forward strategic sequence where it conflicts with this roadmap.

---

## 1. Start unmistakably REKT

REKT Inkubator begins as a **REKT-native product for the REKT / Ink builder community**, not generic white-label SaaS.

Launch thesis:

> **REKT Inkubator turns a software idea into a bounded funded build competition: define what should exist, freeze what complete means, let a small number of builders race, compare real implementations, choose a qualifying winner and preserve a durable result.**

Launch shorthand:

`POST → COMPILE → FUND → BUILD → CHECK → SUBMIT → REVEAL → TEST → PICK → PAY → RECEIPT`

Public line candidate:

> **Launch challenges. Lock the prize. Ship real things.**

The product must not imply stronger REKT, Ink or ecosystem endorsement or guarantees than actually exist.

The initial Challenge inventory should be useful to the real REKT / Ink ecosystem: bounded websites, dashboards, wallet/data visualizations, small games, community tooling, open-source widgets and objective automation tasks.

Agents, Sentry, ERC-8004, x402 and richer social systems remain later cartridges. They are not the launch identity.

---

## 2. Long-horizon category

The destination is not merely a bounty board.

> **REKT Inkubator should become a software commissioning operating system built around executable Build Contracts and competitive implementation.**

A person should eventually be able to describe a fuzzy software idea and receive a versioned, inspectable Challenge containing:

- a clear Outcome Contract;
- explicit assumptions and unknowns;
- a declared Production Envelope;
- a suggested reference architecture and stack;
- a design/state plan;
- machine-testable acceptance where appropriate;
- human preference criteria where automation would be dishonest;
- security/operational requirements appropriate to the risk tier;
- bounded builder slots and deadlines;
- effort/prize guidance with uncertainty shown;
- immutable normative references and fixtures;
- a portable Build Contract;
- a fair submission, reveal, evaluation and durable-result path.

The mature category promise is:

> **Describe what you want → Inkubator makes the important engineering decisions legible → builders compete against the same frozen contract → real software comes out the other side.**

---

## 3. Challenge Compiler = strategic moat

The compiler is not one giant model.

```text
FUZZY HUMAN INTENT
        ↓
SMALL NLP / CHAT LAYER
        ↓
PROJECT FINGERPRINT
        ↓
SUITABILITY GATE
        ↓
HIGH-IMPACT QUESTIONS
        ↓
ASSUMPTION LEDGER
        ↓
PRODUCTION ENVELOPE
        ↓
QUALITY / RISK PROFILE
        ↓
VERSIONED BLUEPRINT CANDIDATES
        ↓
TRADEOFF + SENSITIVITY ANALYSIS
        ↓
OUTCOME + DELIVERY CONTRACT
        ↓
DESIGN / STATE PLAN
        ↓
EXECUTABLE EVIDENCE / TEST PLAN
        ↓
BREAK MY SPEC
        ↓
PRODUCTION CRITIC
        ↓
READY / NEEDS DECISION / UNSUPPORTED
        ↓
ORGANIZER ACCEPTS
        ↓
HASH + FREEZE
```

AI may interpret messy language, ask useful questions, propose wording, explain consequences and surface ambiguity. AI never becomes product truth.

Canonical meaning comes from structured state, deterministic rules, versioned blueprints/profiles, mechanical checks and explicit human acceptance.

Core Challenge operation must continue when model inference is unavailable or budget-capped.

---

## 4. Build Contract law

The mature Build Contract has five separate layers:

1. **Outcome Contract** — authoritative observable result.
2. **Production Envelope** — authoritative operating assumptions and quality scenarios.
3. **Delivery Contract** — authoritative handoff requirements.
4. **Preferences** — non-qualifying taste used only for selection among qualifiers.
5. **Reference Architecture** — advisory unless an interface/technology is genuinely required.

Do not use unsupported universal labels such as `production ready` or `secure` as magic certificates. Prefer precise statements such as:

- `VALIDATED AGAINST PRODUCTION ENVELOPE X`;
- `PASSED SECURITY PROFILE Y CHECKS`;
- explicit `KNOWN / ASSUMED / UNKNOWN` state.

Every technology must pay rent. Unnecessary infrastructure is rejected rather than added because it sounds professional.

---

## 5. Versioned blueprint registry

Start with a small curated registry, roughly 6–10 useful families, for example:

- `WEB_STATIC`;
- `WEB_CRUD`;
- `WEB_REALTIME`;
- `WEB3_READ_APP`;
- `WEB3_TRANSACTION_APP`;
- `API_SERVICE`;
- `BACKGROUND_WORKER`;
- `BOT_AUTOMATION`;
- `DATA_DASHBOARD`;
- `CLI_TOOL`.

Blueprints declare applicability, exclusions, reference architecture, supported envelope, risk/security profile, known limits, sensitivity points, acceptance modules and version/health state.

Active Challenges never silently inherit later blueprint semantics.

Where useful, blueprints gain maintained canary/reference builds so `recommended` means more than “a model liked this stack.”

---

## 6. Signature mature experience

```text
DESCRIBE WHAT YOU WANT
       ↓
COMPILE THE PROBLEM
       ↓
LIVE IMPACT NEGOTIATION
       ↓
BREAK MY SPEC
       ↓
LOCK BUILD CONTRACT
       ↓
LOCK PRIZE
       ↓
SMALL SEALED BUILDER POOL
       ↓
BUILDER CAPSULE / rekt check
       ↓
BLIND BUILD WINDOW
       ↓
IMMUTABLE SUBMISSIONS
       ↓
SIMULTANEOUS REVEAL
       ↓
TEST ARENA
       ↓
QUALIFICATION
       ↓
ORGANIZER CHOOSES AMONG QUALIFIERS
       ↓
DURABLE RESULT / RECEIPT
       ↓
FORK / FUND NEXT EVOLUTION
```

Signature capabilities to grow toward:

- Live Impact Negotiation;
- Break My Spec;
- Production Critic / Digital Wind Tunnel;
- Builder Capsule with `rekt check`, `rekt status`, `rekt submit`;
- Blind Build + Reveal;
- Test Arena;
- Build Flight Recorder;
- evidence-backed Builder Passport;
- Fork This Build;
- Prize Boosting / sponsored Challenge programs;
- Challenge Doctor;
- Challenge DNA from real historical outcomes;
- Blueprint Tournaments where architecture is genuinely uncertain.

---

## 7. Existing Inkubator is substrate, not waste

Do not rewrite the existing system from zero.

Preserve and repurpose where compatible:

- **Player** → builder identity and Passport/history;
- **Project** → connected source/artifact locus;
- **Mission / Next Move** → optional operational layer beneath a Challenge Entry;
- **Evidence** → Build Contract and evaluation lineage;
- **Help / Assist / external test** → later contextual collaboration capabilities;
- **Ship** → durable artifact/submission/delivery boundary;
- **Receipt/history** → Challenge outcome and proof-of-build history;
- **GitHub App** → source observation/integration;
- **Verifier** → safe remote-artifact observation;
- **SDK / CLI / MCP** → Builder Capsule/tooling bridge;
- **outbox/workers** → async capture/evaluation/reconciliation substrate.

Launch vocabulary stays simple: Challenge, Builder, Build, Done When, Prize, Submit, Review, Winner, Receipt.

Do not preserve old public information architecture merely because the backend nouns exist.

---

## 8. REKT visual/product identity

The Challenge Compiler should feel like an instrument being calibrated rather than generic AI chat.

Continue the Technical Faceplate family:

- pale technical faceplate;
- black technical print;
- extreme type-scale contrast;
- dense purposeful micrographics;
- localized dark instrument wells;
- cyan observed/live signal;
- sparse orange action/attention;
- no fake telemetry;
- no generic AI/SaaS card soup.

The mature product can support other ecosystems or sponsors later without shedding its REKT identity or becoming white-label sludge.

---

## 9. Trust doctrine

Permanent invariant:

> **No single compromise or mistake should be able to silently alter Challenge rules, expose all private work, fabricate evidence, choose a winner or redirect settlement.**

Communication invariant:

> **Never claim more certainty than the evidence supports.**

Before external-human Alpha, create a dedicated `INKUBATOR_TRUST_AND_REPUTATION_THREAT_MODEL_V1` covering compiler false authority, prompt injection, blueprint/supply-chain compromise, private-source leakage, operator conflict, account takeover, evidence tampering, history correction and incident-response failure.

---

## 10. Sequencing amendment: real humans after integrated build

The earlier survivor plan put concierge human validation before substantial implementation.

The user has now explicitly chosen another sequence: **build the integrated REKT product before putting external humans through it.**

This changes that sequencing gate only; it does not pretend synthetic validation proves demand.

Before Alpha use:

- synthetic Challenge fixtures;
- compiler gauntlet cases;
- adversarial mechanism simulations;
- deterministic property tests;
- simulated organizer/builder personas;
- internal dogfood where useful;
- load/security/failure drills.

Market demand, willingness to pay, willingness to compete and real dispute frequency remain unknown until the later human rehearsal.

---

# 11. EVOLUTION ROADMAP

## A — AUTHORITY + MIGRATION LOCK

**Now.** Freeze this North Star, preserve Survivor Plan V1.1 as mechanism/trust authority, preserve Technical Faceplate as visual authority, and stop older MVP/Challenge-OS docs from silently driving the next build.

**Exit:** a receiving agent can explain current launch product, long-term destination, reusable substrate, deferred systems and next phase from repo docs alone.

---

## B — VERSIONED CHALLENGE + BUILD-CONTRACT PROTOCOL

Build the pure deterministic core first, in/around `packages/inkubator-protocol`:

- Challenge / Entry;
- Build Contract;
- Outcome / Production Envelope / Delivery / Preferences;
- assumptions/unknowns;
- normative-reference digests;
- immutable versions;
- legal state transitions;
- immutable submission manifest;
- qualification vs selection separation;
- append-only receipt/correction semantics;
- property tests for illegal state sequences.

No frontend, DB, chain or LLM dependency in the protocol.

**Exit:** complete mock lifecycle passes deterministic/property tests.

---

## C — POSTGRES DOMAIN BRIDGE

Add Challenge tables/models without replacing proven substrate.

Bridge:

```text
ChallengeEntry → Player
ChallengeEntry → Project
ChallengeEntry → optional Mission
Submission     → Ship/artifact boundary where compatible
Receipt        → existing history/proof lineage
```

Implement survivor-plan concurrency/idempotency/versioning rules, pure public reads and worker-driven due-state progression.

**Exit:** multiple concurrent simulated Challenges survive retry/concurrency/mixed-version tests.

---

## D — COMPILER ENGINE + BLUEPRINTS + LOW-COST CHAT

Build:

- Project Fingerprint;
- causal requirement graph;
- Known/Assumed/Unknown ledger;
- Production Envelope;
- risk/quality profiles;
- initial blueprint registry;
- cheap provider-replaceable conversational layer.

The chat layer interprets. Deterministic code decides consequences.

Add a compiler gauntlet of diverse project prompts plus mutations such as adding accounts, uploads, transactions, realtime or 100× traffic.

**Exit:** meaningful input changes cause correct architecture/contract deltas while irrelevant details do not.

---

## E — REKT COMPILER + CHALLENGE PRODUCT UI

Build the unmistakable REKT-facing product:

- Discover;
- Create/Compiler;
- Challenge;
- My Build;
- Review/Test Arena shell;
- Receipt/history.

The compiler instrument shows assumptions, envelope, architecture, sensitivity points, completeness, human vs automated checks and unresolved blockers.

Changing a meaningful requirement should visibly change the machine.

**Exit:** fuzzy idea → negotiated frozen mock Build Contract works coherently on desktop/mobile.

---

## F — BUILDER CAPSULE + IMMUTABLE SUBMISSION

Evolve existing DevKit toward:

```text
rekt challenge pull <id>
rekt status
rekt check
rekt explain <criterion>
rekt submit
```

Portable capsule:

```text
CHALLENGE.md
contract.json
fixtures/
acceptance/
references/
```

Implement immutable deadline-safe submission and asynchronous evidence/archive capture under Survivor V1.1 rules.

**Exit:** builder can work in normal tools, run local checks and submit without duplicating project-management state.

---

## G — BLIND BUILD + REVEAL + TEST ARENA + RECEIPT

Make the competition itself exceptional:

- bounded synchronized seats;
- no competitor work leakage before lock;
- immutable final manifests;
- simultaneous reveal;
- reusable objective acceptance modules;
- normalized test fixtures/viewports/scenarios;
- organizer side-by-side comparison;
- qualification separate from taste;
- delivery/receipt/Builder Passport foundation.

**Exit:** a full 3–6 builder synthetic Challenge runs end-to-end and leaves a coherent durable result.

---

## H — TRUST / OPSEC / PRIVACY / FAILURE HARDENING

Before external humans:

- dedicated trust/reputation threat model;
- prompt-injection boundaries;
- production route inventory;
- bounded private-source retention/deletion;
- admin/resolver separation;
- audit trail;
- rate/concurrency controls;
- backup/restore drills;
- incident runbooks;
- blueprint supply-chain/provenance checks;
- verifier isolation;
- production-equivalent DB/load tests;
- core-operation-at-zero-inference test.

Use the bounded hostile-review policy.

**Exit:** no Critical/High trust defect remains.

---

## I — REKT CLOSED ALPHA → COMMUNITY TESTNET

This is the first external-human testing under the user’s chosen sequence.

Start with a tiny curated REKT/Ink cohort and the **complete integrated loop**:

`IDEA → COMPILE → LOCK → JOIN → BUILD → CHECK → SUBMIT → REVEAL → TEST → PICK → RECEIPT`

Use mock/testnet value rails unless independent production-value gates are satisfied.

Measure confusion, contract quality, builder trust, effort vs scope, qualification ambiguity, operator burden, model cost, repeat desire and which old collaboration/social features are actually missed.

Then widen to a curated REKT community beta/testnet only after Alpha repair.

---

## J — PRODUCTION-VALUE READINESS → CAPPED FUNDED LAUNCH

Only after the product loop itself is worth protecting, complete the independent settlement/security/legal gates already required by Survivor V1.1.

Launch narrowly when authorized:

- one supported settlement asset;
- capped Challenge sizes;
- curated organizers/builders;
- strong operational visibility;
- no open anonymous marketplace assumption;
- no speculative platform-token dependency.

---

## K — GROW INTO THE FULL NORTH STAR

Promote one family at a time based on evidence:

### Recursive software evolution

- Fork This Build;
- successor hardening/scale Challenges;
- software genealogy;
- Fund This Issue adapters;
- Challenge Doctor.

### Community/sponsor flywheel

- Prize Boosting;
- sponsored REKT/Ink Challenge programs;
- separate community-favorite awards;
- campaign views;
- partner ecosystem programs.

### Advanced compiler intelligence

- Digital Wind Tunnel;
- richer sensitivity visualization;
- Challenge DNA from real outcomes;
- empirical scope/effort/prize bands;
- blueprint canary automation;
- Blueprint Tournaments.

### Build observability / portfolio

- Build Flight Recorder;
- richer Delivery Capsule;
- Builder Passport;
- shareable software evolution timelines.

### Optional cartridges

- Sentry launch;
- Agent Challenge templates;
- A2A/MCP conformance;
- ERC-8004;
- x402;
- sandboxed hostile-code evaluation;
- Help/Assist/teams/social mechanics.

These attach to Challenges; they do not replace the core product.

---

## 12. Rough delivery bands

Planning targets, not promises:

- **Integrated REKT Alpha candidate:** roughly 8–12 focused engineering weeks from implementation start if existing substrate remains reusable.
- **Community testnet/beta:** roughly 3–4 months including Alpha repair/hardening.
- **Capped production-value path:** roughly 4–6+ months technically, with external review/legal/security gates controlling calendar timing.
- **Full North Star evolution:** 6–12+ months of product evolution, not a launch dependency.

---

## 13. Priority law

At every stage ask:

> **Does this make `IDEA → FAIR BUILD CONTRACT → COMPETITION → REAL SOFTWARE → DURABLE RESULT` materially better?**

If not, it is probably not the next feature.

Priority order:

```text
TRUTH / FAIRNESS
    ↓
CHALLENGE COMPILER
    ↓
BUILD CONTRACT
    ↓
BUILDER EXECUTION
    ↓
REVEAL / TEST ARENA
    ↓
DELIVERY / RECEIPT
    ↓
TRUST / OPERATIONS
    ↓
REAL USERS
    ↓
PRODUCTION VALUE
    ↓
NETWORK / SOCIAL / AGENT / ECOSYSTEM EXPANSION
```

---

## 14. Completion discipline

Every implementation phase continues to use:

`PLAN → CHANGESET → VERIFY → VERDICT`

and:

`IMPLEMENT → TEST → ONE independent hostile review → fix Critical/High → ONE targeted re-review only if Critical/High fixes were needed → COMMIT/MERGE WHEN AUTHORIZED → MOVE FORWARD`

Medium/Low findings do not restart a phase unless they invalidate the objective/evidence, violate a frozen invariant, create a fail-open/security boundary or materially threaten product trust.

---

## 15. Mature success picture

> **A REKT community organizer describes a tool. Inkubator asks only high-impact questions, compiles a transparent Build Contract and reference architecture, attacks its own spec, opens a small competition, gives every builder the same portable contract, verifies submissions under equal conditions, reveals the builds together, lets the organizer test-drive the qualifiers side-by-side, records the chosen result, and can immediately fork that result into the next evolution.**

That is the North Star. The roadmap above is how we get there without trying to ship the entire future on day one.
