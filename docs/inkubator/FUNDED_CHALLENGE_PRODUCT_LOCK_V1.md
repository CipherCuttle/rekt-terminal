# REKT INKUBATOR — Funded Challenge Product Lock V1

**Status:** USER-AUTHORIZED PRODUCT-DIRECTION LOCK / PLANNING AUTHORITY ONLY

**Date:** 2026-09-13

**Branch:** `plan/inkubator-challenge-os-v1`

**Merge authority:** NONE

**Implementation authority:** NONE

This document supersedes the agent-first / arena-first exploration on this planning branch. Agents, Sentry, ERC-8004, Help Beacons, teams, Assists and advanced social mechanics are future optional capabilities, not the launch product.

---

## 1. Product in one sentence

> **REKT Inkubator is a funded build-challenge platform: post what you want built, define what done means, lock the prize, let a small number of builders compete, choose the best qualifying result, pay the winner, and keep a durable receipt of what shipped.**

Short product shorthand:

> **POST → FUND → BUILD → SUBMIT → PICK → PAY → RECEIPT**

Public-facing line candidate:

> **Launch challenges. Lock the prize. Ship real things.**

---

## 2. The two users

### Organizer / customer

The organizer has an idea, problem or small software need but does not necessarily know which builder to hire or exactly which implementation will be best.

Their job is to define:

1. **WHAT DO YOU WANT BUILT?**
2. **DONE WHEN** — frozen acceptance criteria.
3. **PRIZE** — how much the winning qualifying build earns.
4. **BUILDER SLOTS** — bounded number of entrants.
5. **DEADLINE** — when submissions close.

The organizer should not need to understand Inkubator's internal domain model, GitHub semantics, escrow architecture or blockchain concepts.

### Builder

The builder should be able to answer in seconds:

- What am I building?
- What exactly counts as done?
- How much can I earn?
- How many people am I competing against?
- How much time is left?
- Is the prize actually locked?

Builders use Inkubator for free in the initial business model.

---

## 3. Product promise

### Organizer promise

> **Put money behind a clearly bounded build problem and get multiple real attempts instead of choosing a contractor before seeing the work.**

### Builder promise

> **See a bounded problem, know the prize exists, know what counts as done, build in the tools you already use, submit before the deadline, and get paid if your qualifying build is selected.**

### Platform promise

> **The rules do not silently change, the prize is visibly locked, losing builders keep their work, and payment/history cannot be rewritten after the fact.**

---

## 4. Core Challenge object

A V1 Challenge should contain only what is necessary to make the economic/game contract understandable.

```text
TITLE
BRIEF
DONE WHEN[]
PRIZE
BUILDER SLOTS
JOIN / SUBMISSION DEADLINE
REVIEW DEADLINE
IP TERMS
STATE
```

Optional descriptive material may exist, but none of it should compete with these fields.

### DONE WHEN

`DONE WHEN` is the customer-facing acceptance contract.

Example:

```text
DONE WHEN
□ Connects an Ink wallet
□ Shows token balances
□ Shows the last 20 transactions
□ Works on mobile
□ Has a public live URL
```

It defines qualification, not taste.

If multiple submissions satisfy `DONE WHEN`, the organizer may select the preferred qualifying submission as winner.

---

## 5. Core lifecycle

Internal state may remain richer, but the user-facing lifecycle should read naturally:

```text
DRAFT
  ↓
FUND
  ↓
PRIZE LOCKED
  ↓
OPEN
  ↓
BUILDERS JOIN
  ↓
BUILD WINDOW
  ↓
SUBMISSIONS LOCK
  ↓
REVIEW
  ↓
WINNER SELECTED
  ↓
PAID
  ↓
RECEIPT
```

Product rule candidates to preserve unless research disproves them:

- the prize must be funded before a funded Challenge opens;
- no unilateral organizer withdrawal after the commitment point;
- the commitment point should be no later than first builder join;
- organizer cannot silently change `DONE WHEN` after builders commit;
- organizer cannot pick a winner before the advertised build window closes unless all active builders explicitly waive the remaining time;
- review must have a bounded deadline;
- payout and receipt are durable terminal facts;
- dispute/cancellation paths remain explicit and visible.

Exact time constants and dispute policy remain implementation-planning questions.

---

## 6. Prize vault / payment model

The UX may show a simple **Challenge Vault** or **Prize Locked** instrument.

The system should **not** create a normal custodial hot wallet whose private key is controlled by the Inkubator application for each Challenge.

Preferred architecture direction:

```text
ORGANIZER WALLET
      ↓
FUND CHALLENGE
      ↓
NON-CUSTODIAL / CONTRACT-ENFORCED PRIZE VAULT
      ↓
LOCKED WHILE CHALLENGE RUNS
      ↓
WINNER SELECTED
      ↓
WINNER CLAIMS / RECEIVES PRIZE
      ↓
PAYMENT RECEIPT
```

The existing `CipherCuttle/Grudge.bid` escrow work is implementation precedent, not automatic production authority. Any production money path requires a fresh security/legal readiness gate.

V1 should prefer one supported settlement asset rather than arbitrary tokens/multichain complexity.

---

## 7. Ownership / IP default

Default product rule:

```text
WHILE BUILDING
Builder owns the work.

NOT SELECTED
Builder keeps the work and all applicable rights.

SELECTED + PAYOUT COMPLETES
Customer receives the agreed transferable economic rights in the bespoke winning deliverable.

PRE-EXISTING / THIRD-PARTY / OPEN-SOURCE COMPONENTS
Remain with their existing owner/license; customer receives the rights/license necessary to use the delivered product as agreed.

INKUBATOR
Owns no entrant code or product IP.
```

Inkubator receives only the narrow rights required to host/display the Challenge, preserve receipts/history and show public previews where the Challenge permits it.

The rights-transfer trigger should be successful payout, not submission or winner selection.

Exact legal wording requires jurisdiction-specific review before real-money public launch.

---

## 8. Business model

### Builders

```text
PRICE = $0
PLATFORM CUT FROM WINNER = 0% initially
```

The displayed prize should be what the winner receives.

### Funded Challenge organizer

Initial pricing thesis:

```text
PRIZE                       user-selected
INKUBATOR PLATFORM FEE      target ~8%
PAYMENT / GAS COSTS         transparent pass-through or explicitly included
```

Example:

```text
Prize locked      500 USDC
Inkubator fee      40 USDC
────────────────────────
Organizer pays    540 USDC + any explicit rail cost
Winner receives   500 USDC
```

The exact fee percentage should be configurable product policy rather than hard-coded settlement law.

### Later revenue

Only after the core marketplace proves demand:

- managed/sponsored Challenges;
- branded ecosystem Challenges;
- private/invite-only Challenges;
- organizer analytics/team tooling;
- multiple winners/milestones;
- higher-touch moderation/dispute support.

Do not charge builders, sell ranking, monetize prize float or introduce speculative token economics to fund the platform.

---

## 9. What the product should look like

The existing REKT Technical Faceplate direction remains the visual family.

The product should look like a **physical challenge instrument / workbench**, not a generic SaaS marketplace.

Visual principles:

- pale/white industrial technical chassis;
- black technical print;
- extreme human-vs-machine type contrast;
- localized dark instrument wells;
- semantic cyan/live signal;
- sparse orange for action/attention;
- dense purposeful micrographics, not decoration;
- strong countdown / prize / slot / state readouts;
- no neon card soup;
- no fake telemetry;
- no five opaque internal product nouns competing in navigation.

A Challenge page should visually communicate the economic game in one glance:

```text
┌──────────────────────────────────────────────────────────┐
│ CHALLENGE 042                           03D 14H REMAINING │
│ BUILD A MOBILE INK PORTFOLIO                            │
│                                                          │
│ PRIZE        500 USDC       ● LOCKED                     │
│ SLOTS        6 / 10                                      │
│                                                          │
│ DONE WHEN                                                │
│ □ wallet connects                                        │
│ □ balances render                                        │
│ □ 20 recent transactions                                 │
│ □ mobile works                                           │
│ □ public URL                                             │
│                                                          │
│                     [ JOIN CHALLENGE ]                    │
└──────────────────────────────────────────────────────────┘
```

The blockchain should be inspectable but visually subordinate to the human concepts `PRIZE`, `LOCKED`, `PAID` and `RECEIPT`.

---

## 10. What the product should feel like

The emotional target is **small competitive build event**, not freelance admin.

It should feel:

- immediate;
- slightly competitive;
- trustworthy;
- bounded;
- alive because real builders are building at the same time;
- clear enough that a non-developer customer can create a Challenge;
- serious enough that a builder trusts the prize and criteria;
- lightweight enough that vibe-coding for a weekend is normal.

The core tension already comes from:

```text
REAL PRIZE
+ SMALL NUMBER OF SLOTS
+ VISIBLE DEADLINE
+ CLEAR DONE CONDITION
+ REAL COMPETITORS
```

Do not manufacture engagement with XP, follower counts, fake urgency or arbitrary gamification.

---

## 11. Primary screens

### 1. Discover

Shows open funded/free Challenges.

Each card should prioritize:

```text
WHAT
PRIZE
SLOTS
TIME LEFT
```

### 2. Challenge

The central public room.

Shows:

- brief;
- `DONE WHEN`;
- prize and lock state;
- slots / joined builders;
- countdown;
- visible entries/builds where privacy permits;
- Join / Submit / Review action appropriate to actor/state.

### 3. Create Challenge

A brutally simple form:

```text
WHAT DO YOU WANT BUILT?
DONE WHEN
PRIZE
BUILDER SLOTS
DEADLINE
[ FUND & LAUNCH ]
```

Advanced contract/payment details stay behind progressive disclosure.

### 4. My Entry

For a builder:

```text
CHALLENGE
MY BUILD
DONE-WHEN STATUS
TIME LEFT
SUBMISSION STATE
[ SUBMIT ]
```

Build work stays primarily in GitHub / IDE / coding agent, with Inkubator observing progress where connected rather than duplicating a project manager.

### 5. Review

Organizer compares submitted qualifying builds against the frozen `DONE WHEN` contract, opens artifacts and selects the winner.

### 6. Receipt / History

Shows immutable economic/project outcome:

```text
CHALLENGE
WINNER
PRIZE
PAID
ARTIFACT / SHIP
TIMESTAMP
PAYMENT / VAULT PROVENANCE
IP TRANSFER STATUS
```

Builder profiles later aggregate entered / shipped / won / earned history from these receipts.

---

## 12. Existing Inkubator concepts after the reset

The existing backend work is substrate, not launch vocabulary.

- **Project** remains useful as connected source/artifact state.
- **Ship** remains useful as durable submitted/accepted artifact boundary.
- **Player** remains builder identity/history.
- **Mission/Next Move** may support the builder internally, but must not make the Challenge experience harder to understand.
- **World** may become Challenge discovery/activity rather than a standalone abstract world concept.

The launch UI should be organized around the human causal loop, not around backend nouns.

---

## 13. Explicitly deferred

Do not put these into V1 unless direct user evidence reopens them:

```text
Help Beacons
Assists
Teams
Agent Arena
A2A/MCP challenge requirements
Sentry launch
ERC-8004
x402
arbitrary tokens
multichain settlement
platform-funded LLM inference
always-on participant hosting
complex automated evaluation
XP / levels / follower economy
multiple challenge game modes
open-ended chat/community features
smart-contract arbitration court
```

They may later strengthen the marketplace after the core funded Challenge loop works.

---

## 14. Zero-cash bootstrap remains valid

The pre-revenue platform should continue to target effectively zero recurring infrastructure cash spend.

The product architecture should scale economically only after revenue/sponsorship exists.

Money locked as a Challenge prize belongs to the Challenge settlement path and is not platform operating revenue.

Do not use participant prize balances to subsidize infrastructure.

---

## 15. Product success test

The product succeeds when a customer can say:

> **I posted a small software problem, locked $500, six people built against it, and a few days later I picked a working version I wanted.**

And a builder can say:

> **There were ten slots, the prize was actually locked, I knew exactly what counted as done, I built it over the weekend, and when I won I got the full amount.**

If users instead describe Inkubator as a dashboard, community, project manager, token thing or confusing hackathon site, the product has drifted.

---

## 16. V1 kill criteria

Stop or narrow the product if:

- customers cannot write objectively understandable `DONE WHEN` criteria;
- most Challenges become long consulting engagements;
- builders routinely perform large amounts of unpaid spec work for tiny prizes;
- organizers can change criteria or pull prizes after builder commitment;
- dispute volume overwhelms the small Challenge economics;
- losing work is treated as customer property;
- users need blockchain knowledge to understand payment state;
- the platform requires complex social/game mechanics to feel useful;
- pre-revenue operation requires meaningful recurring platform spend;
- the core loop is not understandable as `POST → FUND → BUILD → PICK → PAY`.

---

## 17. Final product lock

```text
PRIMARY PRODUCT       FUNDED BUILD CHALLENGES
PRIMARY CUSTOMER      PERSON / TEAM / SPONSOR THAT WANTS SOMETHING BUILT
PRIMARY SUPPLY        SMALL BOUNDED SET OF BUILDERS
PRIMARY CONTRACT      WHAT + DONE WHEN + PRIZE + SLOTS + DEADLINE
PRIMARY TRUST DEVICE  PRIZE LOCK
PRIMARY WORK UNIT     BUILD / ENTRY
PRIMARY OUTCOME       WINNING SHIP
PRIMARY ECONOMIC ACT  PAYOUT
PRIMARY RECORD        RECEIPT / BUILDER HISTORY
PRIMARY REVENUE       ORGANIZER PLATFORM FEE
BUILDER FEE           $0 initially
SOCIAL FEATURES       DEFERRED
AGENT FEATURES        DEFERRED
```

The finished Inkubator should make commissioning small software feel like launching a tiny competitive build event rather than hiring a freelancer blindly.
