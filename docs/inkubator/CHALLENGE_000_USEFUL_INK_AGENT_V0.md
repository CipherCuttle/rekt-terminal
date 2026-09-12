# REKT INKUBATOR — Challenge 000: BUILD A USEFUL INK AGENT V0

**Status:** PLANNING CANDIDATE / FIRST ARCHITECTURE TEST / NO IMPLEMENTATION AUTHORITY

**Date:** 2026-09-13

**Parent authority candidates:**

- `CHALLENGE_OS_NORTH_STAR_V1.md`
- `CHALLENGE_CONTRACT_V1.md`
- `PRE_REVENUE_INFRA_CAP_V1.md`

This document specifies one concrete Challenge as if it were going live next. Its job is to falsify or strengthen the Challenge OS abstraction before implementation.

No production code, paid infrastructure, prize promise, external affiliation, merge, or launch is authorized by this document.

---

## 0. One-sentence Challenge

> **Build a deployed agent that does one genuinely useful thing on Ink, expose it through an interoperable agent endpoint, let another human use it, and prove that it actually works.**

Working public title:

> **BUILD A USEFUL INK AGENT**

Challenge ID candidate:

`CH-000`

---

## 1. Why this is the first Challenge

CH-000 deliberately tests the minimum differentiated Challenge OS loop without requiring platform-funded compute or hostile participant-code execution.

It exercises:

1. Challenge discovery and join;
2. ChallengeEntry creation;
3. existing Mission + Project state;
4. GitHub source observation;
5. builder-hosted deployment;
6. a standardized remote agent interface;
7. automated remote evaluation;
8. external human testing;
9. one dominant Next Move;
10. final evaluation;
11. Ship + durable receipt;
12. Player proof-of-build history.

It intentionally does **not** require:

- platform-hosted agents;
- platform-funded LLM inference;
- arbitrary participant-code execution;
- tokens;
- Sentry launch;
- ERC-8004 registration;
- x402 payments;
- smart-contract escrow;
- paid infrastructure.

If this Challenge is not useful or comprehensible without those extras, the Challenge OS thesis is too weak.

---

## 2. Challenge statement

### Public statement

**Build an Ink-native agent somebody would actually use.**

Your agent must:

- solve one clearly stated user problem;
- use live/public Ink-specific state, protocol functionality, or ecosystem data in a meaningful way;
- be deployed at a public endpoint you control;
- expose a standards-based agent interface;
- survive Inkubator's automated reliability/conformance checks;
- be used by at least one other human participant/tester;
- remain live long enough for final evaluation;
- Ship through Inkubator with its source/evidence snapshot.

The Challenge defines the outcome and verification boundary, not the implementation framework.

Builders may use any language, agent framework, model provider, hosting provider or internal architecture that satisfies the frozen contract.

---

## 3. Pilot shape

CH-000 should begin as a controlled founding run rather than an open internet launch.

Planning defaults:

```text
access                 INVITE_ONLY
entry_capacity         10
team_size              1–2
build_window            7 days
finalization_window     12 hours
final_eval_window       12 hours
public_repo_required    YES for pilot
platform_cash_budget    $0
platform_llm_budget     $0
```

Why public repositories for CH-000:

- makes source inspectable;
- permits zero-cash practice CI using standard GitHub-hosted runners;
- simplifies trust/rehearsal;
- removes private-source complexity from the first Challenge OS architecture test.

Private Challenge entries remain a future capability, not a CH-000 requirement.

---

## 4. Builder promise

A builder joining CH-000 should understand this immediately:

> **Pick one useful Ink problem. Build it wherever you normally build. Inkubator watches the project, checks the agent, tells you what remains, helps you find a tester, and preserves the result if you Ship.**

The Challenge must not require duplicate task/project management inside Inkubator.

---

## 5. Organizer promise

At close, the organizer should have more than submission links.

For every accepted entry the organizer should be able to inspect:

- builder/Party;
- frozen Challenge version;
- repository stable identity + final git SHA;
- deployed agent URL;
- Agent Card snapshot;
- automated evaluation results;
- external tester observation;
- human rubric scores;
- accepted Ship Receipt;
- immutable Challenge result lineage.

If CH-000 produces only a gallery of links, it failed to prove Challenge OS value.

---

## 6. Ink-native requirement

An entry must do something meaningfully specific to Ink rather than merely displaying Ink branding.

At least one of the following must be material to its core behavior:

- Ink chain RPC / onchain state;
- an Ink-native contract/protocol;
- Ink ecosystem/indexer data;
- Ink-specific wallet/domain/agent functionality;
- Ink-native DeFi/social/agent primitives;
- another verifiable Ink integration approved by Challenge authority.

Examples that qualify conceptually:

- an agent that researches live Ink activity;
- an agent that explains Ink transactions/contracts;
- an agent that helps discover or compare Ink protocols;
- an agent that performs a bounded Ink workflow;
- a builder/developer agent for Ink tooling;
- a monitoring/alerting agent for Ink state;
- an agent that composes Ink-native MCP tools;
- a creative agent whose useful behavior depends on Ink state.

A generic chatbot with an Ink-themed system prompt does not qualify.

---

## 7. First-run safety boundary

CH-000 final evaluation is **read-only / non-custodial by default**.

The final evaluator must not ask participant agents to:

- expose private keys;
- sign arbitrary transactions;
- transfer funds;
- approve tokens;
- launch tokens;
- bridge assets;
- execute destructive or financially irreversible actions.

A submitted agent may support such features for its own real users, but CH-000's official evaluation must remain safe and bounded.

If an entry demonstrates write-capable Ink functionality, the judged demo may use:

- simulation;
- unsigned transaction preparation;
- participant-controlled low-value demo actions performed explicitly by the builder;
- a safe test environment where available.

No evaluator obtains participant wallet secrets.

---

## 8. Required artifact contract

CH-000 artifact kind:

`AGENT`

Required submission facts:

```text
public_repository
final_git_sha
public_agent_base_url
public_agent_card_url
one_sentence_user_problem
one_sentence_agent_value
ink_dependency_summary
operator/demo_instructions
```

Required deployment properties:

- HTTPS;
- public internet reachable;
- bounded request size;
- no Inkubator production credentials required;
- no evaluator secret required for public discovery;
- remains available through final evaluation window.

---

## 9. Agent interoperability contract

### Decision candidate: A2A 1.0

For CH-000, the planned interoperability target is **A2A Protocol 1.0**, the current stable released major version at planning time.

Why:

- framework/language neutral;
- explicit Agent Card discovery;
- defined task/message semantics;
- allows Inkubator to probe agents without knowing internal framework;
- gives future Agent Arena work a standards-based seam;
- keeps MCP in its existing role as coding/tool context rather than confusing it with deployed agent interaction.

Minimum CH-000 requirements:

1. valid public Agent Card;
2. at least one declared skill materially related to the Ink-specific value proposition;
3. one supported A2A 1.0 interface;
4. successful SendMessage interaction;
5. task/message result retrievable according to the declared interaction path;
6. protocol errors are returned as valid protocol errors rather than arbitrary HTML/crashes;
7. no plaintext secret in Agent Card.

Recommended discovery URI:

`/.well-known/agent-card.json`

### Compatibility law

The exact A2A minor/patch target is frozen in the LIVE Challenge contract.

A protocol upgrade during the Challenge does not silently change entry requirements.

If A2A proves too heavy for founding builders even with a starter kit, that is evidence to narrow the first Agent contract rather than creating a permanent proprietary protocol by accident.

---

## 10. MCP relationship

MCP remains optional for the submitted agent.

Primary MCP role in Inkubator remains:

> **coding agent / IDE → Inkubator Mission, Next Move, Help and Ship context**

A submitted CH-000 agent may also expose/use MCP when useful, but MCP conformance is not an eligibility requirement.

This preserves the clean separation:

```text
MCP   = tools/resources/context around an agent or builder workflow
A2A   = standardized interaction with the deployed challenge agent
```

---

## 11. Optional Ink capability cartridges

The Challenge should recognize but not require optional capabilities such as:

- `ERC8004_IDENTITY`;
- `SENTRY_AGENT_LAUNCH`;
- `X402_PAYMENT`;
- `INKONCHAIN_MCP`;
- Tydro/Nado/other Ink protocol adapters;
- `.ink` domains.

These create additional Project/Ship facts only when independently observed.

They do not automatically increase Challenge score.

Specifically:

- ERC-8004 registration proves identity registration, not usefulness;
- Sentry launch proves a launch happened, not that the agent is good;
- token price/volume/market cap never determines CH-000 ranking;
- x402 revenue is not technical proof;
- wallet value/funding does not influence judging.

### Post-Ship ceremony candidate

After an accepted Ship, Inkubator may offer:

```text
YOUR AGENT SHIPPED

Optional next steps:
[ REGISTER ERC-8004 IDENTITY ]
[ CHECK SENTRY LAUNCH READINESS ]
[ LAUNCH WITH SENTRY ]
[ ENABLE PAID API / x402 ]
```

These remain explicit participant-controlled actions and may have real financial consequences.

---

## 12. Join flow

Desired join journey:

```text
OPEN CHALLENGE
   ↓
READ: what to build / what counts / deadline
   ↓
JOIN
   ↓
CREATE CHALLENGE ENTRY
   ↓
DECLARE: "What useful thing will your agent do?"
   ↓
CREATE/BIND existing Mission + Project
   ↓
CONNECT public GitHub repo
   ↓
COMMAND becomes Challenge-specific home
```

The first post-join COMMAND should show no internal architecture lesson.

It should show:

```text
BUILD A USEFUL INK AGENT

YOU'RE BUILDING
<agent name + one-line purpose>

TO SHIP
✓ joined
○ source connected
○ agent deployed
○ protocol check
○ external tester
○ final evaluation

DO THIS NEXT
<canonical Mission next_move>
```

---

## 13. Challenge-specific progress model

CH-000 progress is derived from explicit gates, not arbitrary percent-complete guesses.

Suggested visible gates:

```text
1 JOINED
2 SOURCE CONNECTED
3 AGENT DISCOVERABLE
4 PRACTICE CHECKS PASSING
5 EXTERNAL TEST OBSERVED
6 READY FOR FINAL
7 FINAL EVALUATED
8 SHIPPED
```

Mission still owns the exact `next_move`.

Challenge progress may inform the Mission rule but may never create a second competing Next Move.

---

## 14. Practice evaluation

Practice evaluation exists to help builders improve, not determine final authority.

### Practice layer A — repository CI

Prefer builder-controlled GitHub Actions in the public Challenge repository for zero-cash checks such as:

- Challenge manifest syntax;
- Agent Card fixture/schema checks;
- unit tests;
- static lint/typecheck chosen by builder;
- optional local/mock A2A contract test;
- challenge-kit compatibility checks.

The Challenge Kit should provide a starter workflow, but builders may replace their internal implementation.

Participant-controlled CI remains evidence with participant-controlled trust ceiling.

### Practice layer B — Inkubator remote probe

A builder can ask Inkubator to `CHECK AGENT`.

The remote probe may test:

- DNS/public-address safety;
- HTTPS reachability;
- Agent Card retrieval;
- Agent Card validity;
- declared A2A 1.0 interface reachability;
- one bounded SendMessage round trip;
- latency/error envelope;
- no obvious protocol breakage.

The probe result is OBSERVED.

### Practice attempt planning default

```text
max_remote_practice_checks_per_entry_per_hour = 4
max_remote_practice_checks_per_entry_total    = 40
remote_check_timeout_seconds                   = 30
max_response_bytes                             = bounded
platform_llm_usd                               = 0
```

These values remain planning defaults until implementation economics are measured.

---

## 15. External human test

Every finalizable CH-000 entry requires at least one external test by another authenticated Player who is not the entry owner.

Tester flow:

```text
WORLD / CHALLENGE
→ NEEDS TESTER
→ OPEN ENTRY
→ TRY AGENT
→ RECORD RESULT
```

Required tester observation:

```text
outcome: PASS | ISSUE_FOUND | COULD_NOT_TEST
short_note: required
```

Optional:

- reproduction text;
- screenshot/link;
- Assist offer;
- useful reaction.

One human test does not make the agent PROVEN. It is one bounded observation.

The builder may repair after a failed test and request another test.

---

## 16. Finalization snapshot

When the builder selects `READY FOR FINAL`, freeze an immutable evaluation candidate containing:

```text
challenge_contract_hash
entry_id
player/party ids
repository stable id
final_git_sha
agent_base_url
agent_card_snapshot/hash
artifact metadata
practice-result references
external-test references
submitted_at
```

The final evaluator always evaluates this candidate.

A later git push does not silently alter the submitted artifact.

The builder must explicitly create a new final candidate if the frozen contract permits another attempt.

---

## 17. Hidden final evaluation V0

CH-000 should use **remote hidden final checks**, not hostile sandbox execution.

The goal is not to judge the agent's subjective usefulness automatically. The goal is to independently verify that the submitted live agent behaves like the artifact the builder claims exists.

### Hidden suite categories

#### F1 — discovery

- Agent Card reachable at frozen location;
- valid declared protocol version/interface;
- at least one skill;
- URLs resolve only to allowed public network targets;
- no redirects into private/metadata networks.

#### F2 — protocol behavior

- valid request receives valid A2A response;
- unknown/invalid request fails through protocol semantics rather than server crash;
- content type / envelope remain valid;
- task/message flow matches advertised interface.

#### F3 — live/dynamic behavior

Send a challenge containing a fresh random nonce/context value that could not have been known when the artifact was submitted.

The response must demonstrate that the live agent processed the request rather than returning only a static canned submission page.

This is a liveness observation, not an intelligence benchmark.

#### F4 — resilience

Run a small bounded set of malformed/edge-case inputs that should not produce an evaluator-threatening failure, runaway response, redirect abuse or uncontrolled output.

#### F5 — Ink claim spot-check

Use a small hidden prompt/input based on fresh public Ink state to verify that the agent can engage with its declared Ink-specific purpose at a minimum believable level.

Because CH-000 entries may solve different problems, F5 does **not** generate the final usefulness score. It can yield:

`PASS / MANUAL_REVIEW / FAIL`

Human judges own subjective usefulness.

---

## 18. Final attempts

Planning default:

```text
final_attempts_per_entry = 2
```

Rules:

- each attempt binds one immutable artifact snapshot;
- hidden inputs are not disclosed before close;
- failure diagnostics are intentionally less detailed than practice diagnostics;
- platform/evaluator infrastructure failure does not consume an attempt;
- participant endpoint failure does consume an attempt unless operator review confirms platform fault;
- no automatic paid retry infrastructure.

The Challenge contract must state whether best attempt or latest attempt counts. Candidate for CH-000:

`BEST_VALID_FINAL_ATTEMPT`

because the pilot's goal is to help builders reach a working Ship rather than create high-stakes adversarial leaderboard pressure.

---

## 19. Eligibility gates

An entry may proceed to accepted Ship consideration only if all are satisfied:

```text
G1 Challenge entry valid
G2 Public repository connected
G3 Frozen git SHA exists
G4 Deployed agent URL exists
G5 Agent interoperability/conformance gate PASS
G6 External human test observed
G7 Final evaluation has a valid non-infrastructure-error result
G8 Builder submitted before deadline
```

Optional ERC-8004/Sentry/x402 state is excluded from eligibility.

---

## 20. Judging model

CH-000 should be a HYBRID Challenge.

Automated evaluation gates whether the artifact is demonstrably running and interoperable.

Human judging decides whether it is actually useful/interesting.

### Candidate 100-point rubric

```text
30  WORKS
    reliability, interoperability, actual deployed behavior

30  USEFUL
    clarity and importance of the user problem; does the agent materially help?

20  INK-NATIVE DEPTH
    is Ink genuinely part of the solution rather than a label?

10  CRAFT
    operator/user experience, clarity, failure handling, polish

10  ORIGINALITY
    novel approach, surprising composition, weirdness with purpose
```

### Scoring authority

- automated final observations support `WORKS`;
- judges record human rubric observations;
- Challenge authority computes result under the frozen rubric;
- winning/ranking result is not derived from likes, follows, token value or social reach.

### Minimum acceptance versus winning

Shipping and winning are separate.

An entry may produce an accepted Ship without being a Challenge winner.

That matters because proof-of-build should remain valuable to builders who do not place first.

---

## 21. Result categories

CH-000 planning result facts:

```text
SHIPPED
NOT_SHIPPED
FINALIST
WINNER
JUDGE_PICK
WEIRDEST_USEFUL_THING   # optional side award only if frozen before LIVE
```

Do not invent awards after judging starts unless recorded as non-competitive editorial recognition.

---

## 22. Reward model for zero-cash pilot

CH-000 must not imply a cash prize unless separately funded and explicitly frozen before LIVE.

Zero-cash pilot rewards may include:

- accepted Ship Receipt;
- permanent founding-Challenge history;
- winner/category result;
- featured Artifact/Project presentation;
- showcase/demo slot;
- REKT Cheevo tied to real Challenge result;
- optional post-Ship ERC-8004/Sentry path;
- future challenge invitations.

Do not imply Ink Foundation, Kraken, Sentry or any third party will provide money, grants, promotion or official support unless separately authorized by that party.

---

## 23. Challenge Kit V0

Provide one official TypeScript starter **without making TypeScript mandatory**.

Kit candidate contents:

```text
/README.md
/CHALLENGE.md
/rekt-challenge.json
/.github/workflows/rekt-practice.yml
/src/agent/...
/.well-known/agent-card.example.json
/examples/ink-readonly-tool.ts
/examples/inkonchain-mcp.md
/examples/erc8004-optional.md
/examples/sentry-optional.md
```

Kit goals:

- get an A2A 1.0 hello-world endpoint running quickly;
- show one safe Ink read operation;
- include practice checks;
- explain endpoint deployment options without forcing a provider;
- show how to connect Inkubator MCP for Mission/Next Move context;
- keep private keys out of the repository;
- clearly mark real financial-write examples as optional/dangerous.

Builders can use Python, Rust, Go, etc. if their resulting public interface satisfies the frozen contract.

---

## 24. GitHub feedback design

Challenge feedback should return to the builder's normal workflow.

Desired GitHub Check summary:

```text
REKT / CHALLENGE 000

✓ challenge entry
✓ source connected
✓ agent card
✓ A2A endpoint
✓ external tester
○ final evaluation

NEXT
Request final evaluation when ready.
```

Where possible, GitHub Checks should expose actionable detail and links back to the relevant ChallengeEntry.

Implementation note:

Creating rich GitHub check runs requires GitHub App Checks write permission. This is an implementation/permission review item and must not be assumed from the current App configuration.

No permission expansion is authorized by this planning document.

---

## 25. REKT Guide role

The mascot/Guide should answer contextual questions without becoming the only way to understand the Challenge.

Useful examples:

```text
"What do I still need to Ship?"
"Why did my protocol check fail?"
"Find me a tester."
"What does OBSERVED mean here?"
"What is Sentry and do I need it?"
```

Bad dependency:

> A user must ask the Guide what the product itself is for.

The main Challenge loop must remain self-explanatory without the Guide.

---

## 26. Zero-cash operating plan

CH-000 must remain launchable with:

```text
Inkubator rehearsal/frontend/API     existing free-tier posture
Postgres                             free-tier/credit-backed posture
repository practice CI              public GitHub Actions
participant agent runtime            participant-funded / participant free tier
participant model inference          BYOK / participant-funded
remote final evaluator               existing bounded verifier-style worker
sandbox compute                      NONE for CH-000
platform model spend                 $0
platform participant hosting         $0
Sentry/ERC-8004 gas                  participant-funded if used
```

If a free-tier/provider quota is exhausted:

```text
QUEUE / PAUSE / DENY
```

not:

```text
AUTO-SPEND
```

---

## 27. Metrics we need from CH-000

The pilot exists to learn, not merely crown a winner.

### Builder comprehension

- can a new entrant explain the loop after opening the Challenge page?
- time from Join → source connected;
- time from Join → first successful practice check;
- fraction needing operator explanation;
- fraction using Help/Test;
- fraction reaching final evaluation;
- fraction producing accepted Ship;
- desire to enter another Challenge.

### Organizer value

- how much manual operator work per entry?
- did automated checks remove real judging/admin work?
- could the organizer tell what actually worked?
- were final results defensible from recorded evidence?
- would the organizer run another Challenge?
- would an external organizer pay/sponsor for higher limits or managed evaluation?

### Cost

Measure even when cash cost is zero:

```text
remote_probe_count
remote_probe_runtime
final_eval_count
final_eval_runtime
bytes/log storage
GitHub event volume
operator_minutes_per_entry
cost_per_entry_if_free_credits_were_paid
```

We need shadow unit economics before revenue.

---

## 28. Five red-team attacks

### RT1 — "This is just a Devpost hackathon with A2A"

Fail if the system mainly collects URLs and humans manually check them.

Counter-test:

Can Inkubator independently demonstrate that the deployed artifact existed, spoke the frozen protocol, survived final checks, was externally tested and was bound to one immutable source/artifact snapshot?

If no, Challenge OS differentiation is insufficient.

### RT2 — "A2A requirement creates ceremony nobody wants"

Possible.

Counter-test:

The starter path must make the interoperable endpoint cheap enough that it feels like deployment packaging rather than protocol homework.

If founding builders spend disproportionate time fighting A2A rather than building their agent, relax/narrow the contract in the next Challenge.

Do not respond by adding a second bespoke REKT protocol unless evidence requires it.

### RT3 — "Rich builders just buy better models"

True risk.

CH-000 therefore does not pretend to be a pure model-quality benchmark.

It judges usefulness, Ink depth, reliability, craft and originality. A later Agent Arena can standardize models/credits when sponsor funding exists.

### RT4 — "Open-ended agents cannot be fairly auto-scored"

Correct.

CH-000 uses automated checks primarily for existence/reliability/interoperability and human rubric for subjective usefulness.

The future Arena is where hidden task scoring becomes central.

### RT5 — "The optional token stuff will hijack the product"

Prevent structurally:

- token/market data is excluded from CH-000 scoring;
- Sentry is post-Ship optional capability;
- identity/launch/payment facts are separate observations;
- Challenge acceptance does not depend on financialization.

---

## 29. Ten-stack planning verdict

### 1. Socratic

The simplest real job is: **build one useful Ink thing and prove it works.**

### 2. Hegelian

Combine competition with collaboration: entrants compete on results while Help/Test/Assists remain useful during the build.

### 3. Popperian

CH-000 fails if builders/organizers get no extra value beyond a submission form.

### 4. Causal

Measure the value contribution of automated checks, human testing, Next Move and durable Ship separately.

### 5. Systems

Reuse ChallengeEntry → Mission/Project → Evidence/EvaluationRun → Ship. No second project system.

### 6. Cybernetic

Challenge requirements create the target; observations reveal discrepancy; Next Move closes the loop.

### 7. Bayesian

High confidence: repo + deployed endpoint + external test + Ship. Medium confidence: A2A as first standardized seam. Low confidence: financial/onchain launch features as core value, therefore keep optional.

### 8. MDL

One Challenge, one artifact, one endpoint, one source snapshot, one tester, one final evaluation, one Ship. Avoid tournament infrastructure.

### 9. DOE

CH-000 tests an open-ended Agent Challenge. It should be followed by one normal Build Challenge and one standardized Agent Arena before Challenge OS abstraction is considered proven.

### 10. Adversarial

Assume static/canned endpoints, leaked hidden inputs, invalid redirects, protocol spoofing, abandoned deployments and social popularity gaming. Structure evaluation and truth boundaries accordingly.

---

## 30. Research-derived planning principles

CH-000 incorporates the following external lessons:

- challenge prizes work best with a clear outcome/problem, explicit criteria, support/incentives and low enough barriers to attract diverse solvers;
- open-ended hackathon-style problems are better suited to human judging than pretending one objective metric captures creativity;
- visible practice feedback plus hidden/private final evaluation reduces optimization against only the public test;
- GitHub Checks can return rich detailed feedback to the place developers already work, but write access is specific GitHub App authority;
- public repositories can use standard GitHub-hosted Actions without platform-funded runner spend;
- A2A 1.0 is the current stable production-ready interoperability target and separates agent-to-agent interaction from MCP's tool/context role;
- ERC-8004 explicitly does not guarantee that advertised agent capabilities actually work, creating a complementary role for Inkubator evaluation;
- Inspect-style evaluation architecture demonstrates the usefulness of versioned tasks/scorers and explicit time/token/cost limits for later Arena work;
- participant code must remain hostile and outside trusted product authority.

---

## 31. Decisions to settle before any CH-000 implementation

Planning must explicitly close these:

1. Confirm A2A 1.0 as mandatory, or make it `A2A 1.0 OR challenge-defined HTTP adapter` for the pilot.
2. Confirm `10` entry capacity and `1–2` person teams.
3. Confirm public repository requirement for the zero-cash pilot.
4. Freeze exact build/final dates only when launch authority exists.
5. Freeze exact final protocol tests and SSRF/network policy.
6. Decide whether human judges see automated WORKS score before scoring subjective categories.
7. Decide judge count and tie-breaking rule.
8. Decide whether accepted Ship requires a minimum total score or only eligibility gates.
9. Decide final-attempt policy: best valid vs latest valid.
10. Verify current GitHub App permissions before any Checks API plan becomes implementation scope.
11. Decide which free-tier DB/object storage posture is used for the real pilot.
12. Decide whether the first Challenge is invite-only under the existing founding cohort or a separate public experiment.

Default bias: keep the first run small, safe, measurable and comprehensible.

---

## 32. Proposed acceptance test for the plan

Before C1 implementation, a reviewer should be able to answer from this document alone:

- what builders are asked to build;
- why somebody would enter;
- why an organizer would use Inkubator instead of a form;
- what is automated versus human judged;
- what proves the agent is actually live;
- how GitHub work feeds back into the Challenge;
- how another human becomes useful;
- what final evaluation means;
- why PASS still does not equal PROVEN;
- how Sentry/ERC-8004 fit without hijacking the product;
- why the pilot costs the platform $0 in recurring cash infrastructure;
- what evidence would make us abandon or change the design.

---

## 33. Current planning verdict

```text
FIRST_CHALLENGE                  = BUILD_A_USEFUL_INK_AGENT
PILOT_ACCESS                     = INVITE_ONLY_CANDIDATE
ENTRY_CAP                        = 10_CANDIDATE
TEAM_SIZE                        = 1_TO_2
PUBLIC_REPO                      = REQUIRED_CANDIDATE
AGENT_RUNTIME                    = PARTICIPANT_HOSTED
PLATFORM_LLM_SPEND               = 0
PLATFORM_AGENT_HOSTING           = 0
INTEROP_TARGET                   = A2A_1_0_CANDIDATE
MCP                              = OPTIONAL_FOR_SUBMITTED_AGENT
EXTERNAL_HUMAN_TEST              = REQUIRED
FINAL_EVAL                       = REMOTE_HIDDEN_BOUNDED
SANDBOX_EXECUTION                = NOT_REQUIRED_FOR_CH000
SENTRY                           = OPTIONAL_POST_SHIP_CAPABILITY
ERC8004                          = OPTIONAL_CAPABILITY
TOKEN_MARKET_PERFORMANCE         = NEVER_DEFAULT_SCORE
SHIP                             = DURABLE_ACCEPTANCE_BOUNDARY
IMPLEMENTATION_AUTHORITY         = NONE
MERGE_AUTHORITY                  = NONE
SAFE_TO_MERGE                    = NO
```
