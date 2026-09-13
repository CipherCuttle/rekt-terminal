# REKT INKUBATOR — NORTH STAR V2

**Status:** USER-AUTHORIZED STRATEGIC NORTH STAR / PLANNING AUTHORITY ONLY  
**Date:** 2026-09-13  
**Branch:** `plan/inkubator-challenge-os-v1`  
**Implementation authority:** NONE  
**Production-money authority:** NONE  
**Merge authority:** NONE

This document locks the long-horizon destination for REKT Inkubator while preserving a deliberately narrower launch product. It does not authorize immediate implementation of every capability described here.

Where product-strategy direction conflicts with older North Star or MVP vision documents, this document wins. `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` continues to control near-term mechanism, trust, privacy, settlement and launch-safety constraints. `REKT_TECHNICAL_FACEPLATE_V1.md` remains the highest visual execution authority.

## 1. REKT-first launch

REKT Inkubator begins as a REKT-native product for the REKT / Ink builder community, not as generic white-label SaaS.

Launch thesis:

> **REKT Inkubator turns a software idea into a bounded funded build competition: define what should exist, freeze what complete means, let a small number of builders race, compare real implementations, choose a qualifying winner and preserve a durable result.**

Launch shorthand:

`POST → COMPILE → FUND → BUILD → CHECK → SUBMIT → REVEAL → TEST → PICK → PAY → RECEIPT`

Public line candidate:

> **Launch challenges. Lock the prize. Ship real things.**

The product must not imply stronger REKT, Ink or ecosystem endorsement or guarantees than actually exist.

## 2. Long-horizon category

The destination is not merely a bounty board.

> **REKT Inkubator should become a software commissioning operating system built around executable Build Contracts and competitive implementation.**

A person should eventually be able to describe a fuzzy software idea and receive a versioned, inspectable Challenge containing:

- a clear outcome contract;
- explicit assumptions and unknowns;
- a declared production envelope;
- a suggested reference architecture and stack;
- a design/state plan;
- machine-testable acceptance where appropriate;
- human preference criteria where automation would be dishonest;
- security and operational requirements appropriate to the risk tier;
- bounded builder slots and deadlines;
- a recommended effort/prize band with uncertainty shown;
- immutable normative references and fixtures;
- a portable Build Contract;
- a fair submission, reveal, evaluation and receipt path.

## 3. Challenge Compiler

The long-horizon differentiator is the **Challenge Compiler**.

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

AI may interpret messy language, ask useful questions, propose wording, explain decisions and surface ambiguity. AI does not become product truth. Canonical Challenge meaning comes from structured state, deterministic rules, versioned profiles/blueprints, mechanical checks and explicit human acceptance.

Core Challenge operation must continue when model inference is unavailable or budget-capped.

## 4. Build Contract layers

The mature Build Contract has five separate layers:

1. **Outcome Contract** — authoritative observable result.
2. **Production Envelope** — authoritative operating assumptions and quality scenarios.
3. **Delivery Contract** — authoritative handoff requirements.
4. **Preferences** — non-qualifying taste used only for organizer selection among qualifiers.
5. **Reference Architecture** — advisory unless an interface/technology is genuinely required for compatibility or safety.

The product should avoid universal `production ready` claims. Prefer precise statements such as `validated against Production Envelope X`.

Every recommended technology must pay rent. Unnecessary databases, queues, realtime systems or infrastructure are rejected rather than added because they sound professional.

## 5. Versioned blueprint registry

Inkubator should grow a curated registry of architecture families such as:

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

Blueprints declare applicability, exclusions, reference architecture, supported envelope, risk/security profile, known limits, sensitivity points, acceptance modules and version/health state. Active Challenges never silently inherit later blueprint semantics.

## 6. Signature experience

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
PAYOUT + RECEIPT
       ↓
FORK / FUND NEXT EVOLUTION
```

The memorable product experience is that a vague software need becomes a fair, inspectable build competition producing multiple real implementations.

## 7. Signature capabilities to grow toward

- **Live Impact Negotiation** — show causal consequences of changing scope.
- **Break My Spec** — attack ambiguous requirements and literal loopholes.
- **Production Critic / Digital Wind Tunnel** — exercise the proposed architecture against declared failure scenarios.
- **Builder Capsule** — portable Challenge bundle plus `rekt check`, `rekt status`, `rekt submit`.
- **Blind Build + Reveal** — small synchronized competition with sealed work until submission lock.
- **Test Arena** — compare builds under the same fixtures, viewports and scenarios.
- **Build Flight Recorder** — evidence-backed build timeline without invasive screen surveillance.
- **Builder Passport** — durable factual history of entered, qualified, shipped and won work; no opaque universal XP score.
- **Fork This Build** — turn a winning Ship into the frozen basis of a successor Challenge.
- **Prize Boosting / Sponsored Programs** — increase reward or run portfolios of focused Challenges without changing frozen requirements.
- **Challenge Doctor** — inspect an existing project and turn bounded findings into candidate Challenges.
- **Challenge DNA** — use real historical outcomes later to improve scope, effort and prize guidance without fake precision.
- **Blueprint Tournaments** — compare permitted architecture approaches when there is genuine uncertainty.

## 8. Existing Inkubator is substrate

Do not rewrite the existing system from zero.

Preserve and repurpose where compatible:

- Player → builder identity and Passport/history;
- Project → connected source/artifact locus;
- Mission / Next Move → optional builder-operational layer beneath a Challenge Entry;
- Evidence → Build Contract and evaluation lineage;
- Help / Assist / external test → later contextual collaboration capabilities;
- Ship → durable artifact/submission/delivery boundary;
- Receipt/history → Challenge outcome and proof-of-build history;
- GitHub App → source observation/integration;
- verifier → safe remote-artifact observation;
- SDK / CLI / MCP → Builder Capsule/tooling bridge;
- outbox/workers → async capture/evaluation/reconciliation substrate.

Launch vocabulary stays simple: Challenge, Builder, Build, Done When, Prize, Submit, Review, Winner, Receipt.

## 9. REKT identity is product architecture

Visual work remains governed by the Technical Faceplate authority.

The Challenge Compiler should feel like an instrument being calibrated rather than a generic AI chat window:

- pale technical faceplate;
- black technical print;
- extreme type-scale contrast;
- dense purposeful micrographics;
- localized dark instrument wells;
- cyan observed/live signal;
- sparse orange action/attention;
- no fake telemetry;
- no generic AI/SaaS card soup.

## 10. REKT-first market wedge

Initial Challenge inventory should be useful to the real REKT / Ink ecosystem. Appropriate early families include bounded websites, Ink dashboards, wallet/data visualizations, small games, community tooling, open-source widgets and objective automation tasks.

Agent/Sentry/ERC-8004/x402-style capabilities remain later cartridges. They may strengthen some Challenges after the generic funded-build mechanism works; they are not the launch identity.

Later the same REKT Inkubator may host sponsored programs for other ecosystems or teams without becoming generic white-label sludge.

## 11. Trust doctrine

Permanent invariant:

> **No single compromise or mistake should be able to silently alter Challenge rules, expose all private work, fabricate evidence, choose a winner or redirect settlement.**

Communication invariant:

> **Never claim more certainty than the evidence supports.**

Prefer explicit assumptions, unknowns, versioned corrections and evidence-backed facts over universal confidence labels.

## 12. Anti-goals

The North Star fails if Inkubator becomes primarily:

- a generic chatbot wrapper;
- a Devpost clone;
- a freelancer bidding site;
- a duplicate project manager;
- an agent-hosting company;
- a token launchpad;
- an engagement-first social feed;
- an opaque architecture oracle;
- a certification business making universal safety claims;
- a platform where organizer taste is disguised as objective qualification;
- a platform that casually retains or reuses losing private work.

## 13. Mature success picture

> **A REKT community organizer describes a tool. Inkubator asks only high-impact questions, compiles a transparent Build Contract and reference architecture, attacks its own spec, opens a small funded competition, gives every builder the same portable contract, verifies submissions under equal conditions, reveals the builds together, lets the organizer test-drive the qualifiers side-by-side, records the chosen result, and can immediately fork that result into the next funded evolution.**

That is the long-term product. It is reached incrementally rather than treated as one giant launch scope.
