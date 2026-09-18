# REKT INKUBATOR — THIRD-PARTY SUBSTRATE LOCK V1

**Status:** LOCKED PLANNING DECISION / NO IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-13  
**Branch:** `plan/inkubator-challenge-os-v1`  
**Implementation authority:** NONE  
**Production-money authority:** NONE  
**Merge authority:** NONE

This document locks how REKT Inkubator uses external/open-source substrate to ship faster without outsourcing product authority.

It is subordinate to `REKT_INKUBATOR_NORTH_STAR_V2.md` for product strategy and to `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` for funded-Challenge mechanism/trust constraints. Within those boundaries, this document is the planning authority for **third-party adoption, adaptation, rejection and removal behavior**.

The governing rule is:

> **Own the economic/product truth. Adopt narrow tools that delete peripheral engineering. External tools may project, normalize, lint, plan or execute; they do not silently become Challenge authority.**

---

## 1. Authority boundary

REKT Inkubator MUST own the following canonical surfaces:

- Challenge / Build Contract state machine and legal transitions;
- structured Compiler state, deterministic rules and versioned blueprint semantics;
- Outcome Contract / Production Envelope / Delivery Contract / Preferences separation;
- terms hashing, normative-reference freezing and version interpretation;
- seat, deadline, submission and reveal semantics;
- qualification versus organizer selection boundary;
- appeal/default/resolution semantics;
- settlement intent/reconciliation rules and receipt semantics;
- authority/provenance for accepted evidence;
- what `rekt check` means for a specific frozen Challenge.

No external library, model, agent runtime, visualization engine, parser, linter or hosted service may become authoritative for those surfaces merely because it is convenient.

External substrate MAY:

- normalize organizer material into a working representation;
- render architecture/design/state projections;
- lint frozen design or implementation artifacts;
- export a Build Contract into builder-native formats;
- provide deterministic acceptance modules whose version/configuration was frozen into the Challenge;
- help our own development/review/security workflow;
- fail without changing the meaning of an already-frozen Challenge.

---

## 2. Locked survivor shortlist

### Product-facing substrate

| Capability | Decision | Candidate | Authority role | Lock |
| --- | --- | --- | --- | --- |
| mixed document ingestion | **ADOPT** | `firecrawl/anydoc` | derived normalization only | Original uploaded bytes + digest remain normative; Markdown/document model is derived working representation. Prefer local/WASM path; hosted OCR is explicit opt-in only. |
| architecture / lifecycle visualization | **ADOPT** | Archify | projection only | Compiler/Build Contract state is source of truth. Archify receives generated IR/projection and may be replaced without semantic migration. |
| visual design contract | **ADAPT + PIN** | `google-labs-code/design.md` | structured design-plan profile | Upstream format is alpha; pin a known version/spec or define an Inkubator-compatible profile. It cannot silently reinterpret active Challenges. |
| builder implementation planning/export | **ADAPT AT BUILDER CAPSULE** | `github/spec-kit` | non-authoritative export | Inkubator freezes what must be built; Spec Kit may help a builder plan how to build it. Builder may use any compatible agent/tool instead. |
| React implementation health | **ADOPT AS OPTIONAL MODULE** | `millionco/react-doctor` | deterministic evidence module | Use internally immediately if useful. In a Challenge it affects qualification only when its version/config/rules were frozen in the Build Contract. |
| browser acceptance | **KEEP / EXPAND** | Playwright + axe | deterministic evidence module | Stable foundation for executable `DONE WHEN`, Test Arena and accessibility evidence. Harness version/config is normative when used for qualification. |

### Development-facing substrate

| Capability | Decision | Candidate | Use |
| --- | --- | --- | --- |
| self-contained implementation planning | **USE / STEAL PATTERNS** | `shadcn/improve` | Strong-model planning → bounded self-contained plan → cheaper isolated executor → deterministic verification. Does not replace repository governance. |
| bounded independent code review | **EVALUATE NOW** | `alibaba/open-code-review` | Candidate implementation of the ONE independent hostile review, benchmarked against our current review quality before adoption. |
| persistent repo understanding | **EVALUATE NOW** | `NanoNets/Graft` | Reduce repeated repo exploration for coding agents; generated summaries/graphs are never source authority. |
| hybrid local repo retrieval | **LATER** | `zvec-ai/zvec-grep` | Candidate substrate for Challenge Doctor / large-repo investigation after the core product exists. |
| security hostile review | **STAGE H** | `cloudflare/security-audit-skill` | Coverage-led security audit with independent verification of candidates; complements deterministic scanners. |
| security scan SDK | **STAGE H / OPTIONAL** | `openai/codex-security` | Additional bounded scan/classification path if useful; never sole security authority. |
| compiler-skill optimization | **LATER, AFTER GAUNTLET** | `microsoft/SkillOpt` | Optimize cheap-model Compiler/chat skill only after we have a representative held-out Compiler Gauntlet and deterministic scoring. |
| local inference | **OPTIONAL** | `magnitudedev/magnitude` | Reduce inference cost / improve privacy where local hardware is adequate. Cloud models remain allowed behind the same bounded Compiler interface. |

### Watch / later-fit substrate

| Capability | Decision | Candidate | Reason |
| --- | --- | --- | --- |
| disposable remote execution/Test Arena runtime | **WATCH** | `cloudflare/computer` | Attractive workspace/runtime model, but upstream explicitly marks it preview-only / unstable / unsuitable for production today. |
| real Android-device testing | **LATER** | `google/artemis` | Valuable for mobile Challenges/Test Arena once native mobile is in scope; unnecessary for Alpha. |
| browser helper generation | **LATER / EVALUATE** | `browser-use/browser-harness` | Useful development/test automation pattern; not required to define browser acceptance authority. |

### Explicit non-core decisions

Do **not** make REKT Inkubator depend on a full generic agent/coworker/memory platform merely because it is popular.

Examples include generic agent runtimes/orchestrators, OpenWorker-style desktop coworker platforms, Eve-style durable-agent frameworks, OpenViking/Semantica-like memory/context platforms and similar systems.

Grok Build, Claude Code, Codex, Cursor, DeepSeek/Grok harnesses and future coding agents are **builder clients/execution environments**, not Inkubator core infrastructure. Inkubator should export a portable Build Contract/Builder Capsule instead of inventing or owning another IDE/agent runtime.

---

## 3. Locked product composition

Target composition:

```text
ORGANIZER
    │
    ├─ chat / text
    ├─ README / Markdown
    ├─ PDF / Word / PowerPoint / spreadsheet
    └─ frozen reference files/images
          │
          ▼
  DOCUMENT NORMALIZATION
      anydoc where applicable
          │
          ▼
   derived working evidence
          │
          ▼
┌──────────────────────────────┐
│      INKUBATOR COMPILER      │
│                              │
│ ProjectFingerprint           │
│ Known / Assumed / Unknown    │
│ suitability + questions      │
│ ProductionEnvelope           │
│ blueprint/profile selection  │
│ acceptance contract          │
│ design/state plan            │
└──────────────┬───────────────┘
               │
       ┌───────┼────────────┐
       ▼       ▼            ▼
 BUILD       DESIGN       ARCHITECTURE
CONTRACT    CONTRACT       PROJECTION
(canonical) (profile)       (Archify)
       │       │            │
       └───────┴────────────┘
               │
               ▼
         BREAK MY SPEC
               │
               ▼
        ORGANIZER ACCEPTS
               │
               ▼
          HASH + FREEZE
               │
               ▼
         BUILDER CAPSULE
               │
       ┌───────┴────────┐
       ▼                ▼
 Spec Kit export      native files / CLI
(optional)           CHALLENGE.md
                     contract.json
                     DESIGN.md/profile
                     fixtures/
                     references/
                     acceptance/
       │                │
       └───────┬────────┘
               ▼
   builder uses any compatible tools
               │
               ▼
        IMMUTABLE SUBMISSION
               │
               ▼
            TEST ARENA
       ┌───────┼─────────────┐
       ▼       ▼             ▼
 Playwright   axe    optional frozen modules
                       e.g. React Doctor
               │
               ▼
          QUALIFICATION
               │
               ▼
 ORGANIZER CHOOSES AMONG QUALIFIERS
```

The original uploaded/normative material and frozen Build Contract remain authoritative. Every transformation after ingestion is explicitly derived unless the organizer accepts it into the frozen Build Contract.

---

## 4. Third-party adoption record — mandatory fields

Before a new external dependency/service becomes part of the product or authoritative acceptance path, record at minimum:

```text
CAPABILITY
DISPOSITION = OWN | ADOPT | ADAPT | WATCH | REJECT
CANDIDATE + PINNED VERSION/COMMIT
LICENSE
AUTHORITY ROLE
DATA LEAVES MACHINE? / DATA CLASSES
RUNTIME DEPENDENCY OR BUILD-TIME/DEV-ONLY?
EXPECTED MONTHLY COST
HUMAN MAINTENANCE COST
FALLBACK IF UNAVAILABLE
REMOVAL / REPLACEMENT PATH
STAGE INTRODUCED
WHETHER VERSION/CONFIG ENTERS terms_digest
```

A tool is not adopted merely because a model suggested it.

### Required acceptance questions

1. Does it delete enough custom code or materially improve UX/evidence quality?
2. Can one operator understand and replace it?
3. Can the healthy product continue if it is unavailable?
4. Does it create a new hosted control plane or recurring bill?
5. Does sensitive/private material leave our boundary?
6. Does it attempt to become hidden product/economic authority?
7. Can we pin the semantics needed by active Challenges?
8. Is the license compatible with intended distribution/use?
9. Is there a deterministic or documented fallback?
10. Does it still fit `PRE_REVENUE_INFRA_CAP_V1.md` and `SOLO_OPERATOR_CONSTRAINTS_V1.md`?

If the answer is poor, own the small capability or defer it.

---

## 5. Normative-version rule

If a third-party tool contributes to qualification, its relevant version/configuration/rules/fixtures MUST be frozen or content-addressed under the Challenge terms.

Examples:

- Playwright version + acceptance test source;
- axe rules/config when used as qualification criteria;
- React Doctor version/config/rule set if its findings affect qualification;
- DESIGN profile/schema version if design-token conformance is mandatory;
- any external evaluator image/digest where applicable.

A rolling upgrade may improve future Challenges but may not reinterpret an active one.

Non-authoritative presentation tools such as Archify do not enter `terms_digest` unless their produced artifact itself is explicitly made normative.

---

## 6. Failure and removal semantics

External substrate must fail in a bounded way.

- **anydoc unavailable:** organizer may provide text/Markdown manually; frozen original files remain intact.
- **Archify unavailable:** textual/structured architecture remains usable; Challenge meaning does not change.
- **DESIGN.md tooling unavailable:** frozen design profile remains readable/portable; validator can be replaced from the pinned specification.
- **Spec Kit unavailable:** Builder Capsule remains directly consumable; builder plans manually or with another agent.
- **React Doctor unavailable:** if non-normative, skip it; if normative for an active Challenge, evaluate with the frozen version or enter evidence-unavailable/resolution policy rather than inventing a replacement criterion.
- **development review/search tools unavailable:** fall back to repository-native search/tests/manual bounded review; shipping authority is not delegated to them.

No third-party outage may silently rewrite `DONE WHEN`.

---

## 7. Stage placement

This lock does **not** authorize Stage C+ implementation while Stage B is active.

Intended integration order:

```text
B  OWN pure Challenge / Build Contract protocol first
C  OWN Postgres bridge / economic invariants
D  Compiler + blueprints + bounded chat
   - design profile can be defined/pinned here
   - anydoc ingestion can be added when organizer-file input is scoped
   - Archify projection can be added after canonical Compiler state exists
E  REKT Compiler / Challenge UI
   - use React Doctor internally as a frontend quality gate if beneficial
F  Builder Capsule / immutable submission
   - optional Spec Kit-compatible export
G  Reveal / Test Arena / receipts
   - frozen Playwright/axe modules
   - optional React Doctor acceptance module where Challenge terms require it
H  security / OPSEC / privacy hardening
   - Cloudflare security-audit methodology
   - optional Codex Security / deterministic scanners
I+ measured expansion
   - SkillOpt only after a real Compiler Gauntlet exists
   - zvec-grep / Challenge Doctor when large-repo retrieval is a real need
   - Artemis when mobile Challenges exist
   - Cloudflare Computer only after production suitability is independently re-evaluated
```

---

## 8. Development workflow implication

For building Inkubator itself, prefer narrow tools that strengthen the existing bounded completion loop:

```text
PLAN
  strong orchestrator / self-contained phase packet
CHANGESET
  isolated bounded executor
VERIFY
  repository tests + deterministic gates
VERDICT
  ONE independent hostile review
  fix Critical/High
  ONE targeted re-review only if required
  MOVE FORWARD
```

Candidates such as `shadcn/improve`, OpenCodeReview and Graft may reduce planning/review/repo-orientation cost, but they may not create new review loops or override phase contracts.

---

## 9. Locked verdict

The intended Alpha/North-Star architecture is **not** "build every subsystem ourselves" and is also **not** "assemble a pile of agent platforms."

It is:

> **Inkubator owns the structured Challenge/Build-Contract/economic truth and composes narrow, replaceable open-source substrate around it.**

The preferred product-facing combination is currently:

`anydoc normalization → Inkubator Compiler truth → pinned design profile → Archify projection → frozen Build Contract → optional Spec Kit builder export → Playwright/axe + scoped deterministic modules such as React Doctor → qualification`

This lock should be revisited only when a concrete stage requirement, measured failure, upstream abandonment/security issue, license change, or materially better replacement justifies a bounded decision change. Popularity alone is not a reason to reopen it.
