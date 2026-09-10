# REKT INK(CUBATOR) — INSTRUMENT OS COHERENCE RESET V0

**Status:** CANONICAL EXECUTION GATE / USER-AUTHORIZED

**Date:** 2026-09-10

**Parent:** `docs/inkubator-design-authority-reconciliation-v0` @ `a5ff58f64844b821462f4f192e3e09e1c4d6799b`

**Scope:** launch-critical frontend convergence only. This gate does not change product truth, backend authority, API contracts, domain ownership, or the permanent Instrument OS v2 visual thesis.

## 1. Why this gate exists

The design direction is not missing from the authority documents. It has drifted in implementation because individually green surface branches, experiments and page-local styling accumulated faster than one shared visual system was enforced.

The current failure mode is local optimization:

- COMMAND, PROJECT, WORLD, PLAYER and SHIP can each be technically valid while feeling like adjacent products;
- shared v2 shell variables exist, but surface styles still define page-local display colors, bezel geometry, spacing and CRT treatments;
- older near-black Instrument OS styling still coexists in the source tree with the v2 bright-chassis system;
- WORLD composition is still open and its integrated production implementation still contains superseded radar semantics;
- five-mode rehearsal navigation proves integration but does not settle final IA;
- mascot, peripheral-motion and other visual experiments can increase entropy if promoted before the shared grammar is frozen.

Therefore the immediate launch bottleneck is **cross-surface coherence**, not another feature.

## 2. Non-negotiable north star

REKT Inkubator remains:

> **A bright industrial software instrument containing purposeful dark living displays.**

Short form:

`WHITE/OFF-WHITE CHASSIS + BLACK PRINT + PURPOSEFUL DARK CATHODE WELLS + CYAN OBSERVED/LIVE SIGNAL + SPARSE ORANGE ACTION/ATTENTION + SELECTIVE REKT VIOLET + ACID GREEN ONLY FOR PROVEN + REKT-SPECIFIC LINE/PIXEL ART`

It must not become:

- a generic white SaaS dashboard;
- a generic dark terminal dashboard;
- a page-wide CRT;
- a literal Teenage Engineering clone;
- themed card soup;
- a collection of cool unrelated widgets;
- an animation showcase.

The static composition must already look intentional before CRT, shader, glow or motion treatment is added.

## 3. The five shared coherence layers

Every launch-critical surface must use one recognizable family at these layers.

### C1 — CHASSIS

One shared physical grammar for:

- outer shell/background hierarchy;
- edge/seam weights;
- panel relief;
- corner treatment;
- registration marks;
- major spacing rhythm;
- navigation material;
- printed technical labels.

Surface-local CSS may compose these primitives but must not invent a second chassis material system.

### C2 — DISPLAY

One shared display-well family for:

- graphite/near-black display surface;
- bezel thickness/radius/relief;
- on-display text roles;
- grid/scanline/noise restraint;
- line-art stroke hierarchy;
- focus/selection treatment inside dark wells;
- reduced-motion/static fallback.

Different instruments may have different content and dimensions. They must still look manufactured by the same system.

### C3 — SIGNAL

Signal Grammar remains authoritative:

- violet = REKT identity/context and explicit CLAIMED use where labelled;
- cyan = OBSERVED/received/live signal;
- orange/amber = action/attention/help;
- coral/red = blocked/failed/destructive;
- muted grey/lilac = stale/unavailable/peripheral;
- acid green = PROVEN only.

No page-local semantic reinterpretation is allowed.

### C4 — COMPOSITION

Each surface gets one dominant question and one dominant visual locus.

- COMMAND — **What should I do now?**
- PROJECT — **What is actually happening to this thing I am building?**
- WORLD — **What useful thing is happening around me that I would otherwise miss?**
- PLAYER — **What has this builder actually done and earned?**
- SHIP — **What artifact exists, what was observed, and what was actually accepted?**

Secondary instruments must support that question. A module that exists only because empty space remained is rejected.

Coherence does **not** mean identical page layouts.

### C5 — CHARACTER + MOTION

The visual bible uses old handheld/Game & Watch/OP-1 simplicity as a constraint:

- few readable states;
- strong silhouettes;
- minimal frame counts;
- small spatial travel;
- no constant spectacle;
- EVENT/CEREMONY motion requires authorized projected change;
- AMBIENT life is quiet and semantically neutral;
- character mood cannot mint system truth.

Mascot/peripheral work remains reusable evidence but is not launch-authoritative until this gate closes.

## 4. Confirmed implementation drift to repair

The reset begins from confirmed source evidence, not aesthetic guessing.

### D1 — shared shell is not yet a complete shared visual system

`terminal-shell-v2.css` owns core v2 tokens and shell material, but individual surface styles still recreate display palettes and physical treatments locally.

Examples already observed:

- PROJECT introduces local dark Thread display values and hard-coded cyan/dark border values;
- PLAYER defines its own display surface, display text, line color, mascot bezel and scanline treatment;
- WORLD defines its own dark radar/signal display roles and hard-coded display accents.

These are not automatically wrong individually, but the duplicated authority makes drift easy and review difficult.

### D2 — old and new material systems coexist

`instrument-os/instrument-os.css` retains the older near-black whole-instrument language, while the v2 shell implements the bright industrial chassis. Existing imports and legacy classes must be audited so old visual defaults cannot silently leak into launch surfaces.

Do **not** mass-delete legacy files merely because they are old; first classify active runtime imports, lab-only usage and dead ancestry.

### D3 — WORLD remains semantically unresolved

The integrated `LiveWorld` radar/hash geometry is superseded. The A/B/C comparison lab is evidence only until the global coherence grammar is frozen and the user selects/synthesizes a final topology.

### D4 — navigation prominence remains unresolved

The five-mode rail is valid rehearsal infrastructure. It is not automatic final IA. PLAYER and SHIP may remain permanent peers or become contextual/deep-link destinations after the surface audit.

## 5. Launch-critical change boundary

Until this gate closes, **do not add**:

- new top-level surfaces;
- new visual libraries;
- new animation runtimes;
- new shader/CRT systems;
- new backend fields to rescue a visual metaphor;
- new mascot personality states beyond existing experiment evidence;
- Chibi/AppleInu skin expansion;
- BROADCAST spectacle;
- speculative metrics, fake telemetry or decorative live state;
- another WORLD candidate beyond A/B/C or a synthesis of them.

Allowed work:

- delete or simplify visual noise;
- extract shared v2 primitives/tokens;
- replace page-local material duplication with shared primitives;
- align typography, spacing, bezel and control grammar;
- improve desktop/mobile composition while preserving semantics;
- repair loading/empty/error/stale states into the same family;
- create comparison screenshots/contact sheets and deterministic visual tests;
- remove superseded radar semantics after WORLD selection.

## 6. Surface audit contract

For every visible module on every launch surface, record:

1. **OWNER** — which surface owns this concept?
2. **QUESTION** — which unique surface question does it help answer?
3. **SOURCE** — which generated projection / local state supplies it?
4. **ENTITLEMENT** — orientation, state, provenance, attention, action, feedback, memory, identity, materiality, rhythm, hierarchy or brand identity?
5. **DOMINANCE** — primary / secondary / tertiary?
6. **KEEP / SIMPLIFY / MOVE / DELETE**.

Anything with no defensible answer is removed from the launch candidate.

## 7. Required implementation sequence

### GATE A — FOUNDATION EXTRACTION

Create the smallest shared launch primitives required to stop page-local visual divergence.

Minimum target family:

- shared chassis tokens;
- shared typography roles;
- shared spacing/edge/bezel tokens;
- `DisplayWell` / equivalent shared display treatment;
- shared micro-label / printed-header treatment;
- shared truth/signal color roles;
- shared motion/reduced-motion contract.

Do not giant-rewrite all components into a design-system package unless extraction proves necessary.

### GATE B — FIVE-SURFACE CONVERGENCE

Apply the shared family to:

`COMMAND → PROJECT → WORLD → PLAYER → SHIP`

Preserve each surface's distinct job and data projection.

### GATE C — WORLD + IA DECISIONS

After the five surfaces can be compared as one family:

- select/synthesize WORLD A/B/C;
- remove prohibited production radar geometry;
- decide permanent navigation prominence for PLAYER / SHIP;
- freeze desktop/mobile information architecture.

### GATE D — REHEARSAL FREEZE

Capture one canonical visual matrix:

- desktop 1440×900 for all launch-critical states;
- mobile 390×844 sibling composition for all launch-critical states;
- normal + loading + empty + error/stale/unsupported where applicable;
- reduced-motion check;
- no fixture state represented as live truth.

Only then freeze the combined frontend candidate for Phase-9 rehearsal.

## 8. Visual acceptance tests

The coherence gate passes only if:

- removing the REKT logo still leaves all five surfaces recognizably from one product family;
- operational pages are visually majority light chassis;
- dark wells are purposeful and subordinate to the chassis, not page-wide darkness;
- typography roles are consistent across surfaces;
- bezel/edge/seam treatment is visibly related across surfaces;
- one dominant locus is identifiable within roughly one second on each page;
- no page introduces a unique material language without explicit authority;
- each mini-terminal has one real job and real source;
- semantic color survives cross-page comparison;
- desktop/mobile feel like siblings rather than different brands;
- static screenshots still look designed with motion/effects disabled;
- no page requires explanation to distinguish primary from secondary information.

## 9. Kill criteria

Reject the candidate if:

- convergence merely makes every page look identically boxed;
- shared primitives become a giant abstraction layer that slows iteration;
- a page becomes less legible to preserve aesthetic consistency;
- visual effects are used to hide weak hierarchy;
- WORLD gets new data/relationships solely to justify a composition;
- the mascot becomes a second authority channel;
- the reset expands backend scope;
- the team continues creating parallel visual experiments before closing this gate.

## 10. Backend boundary during this gate

Backend work is limited to defects that block truthful frontend rehearsal.

Already-established Phase-9 backend capability is not reopened for speculative architecture.

Remaining backend/ops closure after frontend freeze:

1. dedicated Inkubator deployment;
2. dedicated rehearsal Postgres/environment;
3. real GitHub OAuth callback + GitHub App installation lifecycle;
4. provider-native deploy → successor → rollback evidence;
5. full browser OWNER → MISSION → COMMAND → PROJECT → HELP/PARTY → EXTERNAL TEST → SHIP journey;
6. durable history/reputation/receipt verification;
7. 2–3 real human founding-cohort actors;
8. failure drills;
9. one broad hostile review;
10. Critical/High repair only, then one targeted rereview if required.

No new queue, service, truth store, ranking model or backend subsystem is authorized by this coherence reset.

## 11. PR/experiment disposition during reset

- PR #61 design-authority reconciliation — **KEEP / parent authority**.
- PR #62 WORLD A/B/C — **KEEP AS ACTIVE DECISION EVIDENCE; DO NOT POLISH ALL THREE FURTHER**.
- PR #63 mascot contract — **PAUSE AS EXPERIMENT EVIDENCE; DO NOT PROMOTE TO LAUNCH UI YET**.
- peripheral/motion labs — **KEEP AS TOOLING/EVIDENCE; NO SCOPE EXPANSION**.
- React Bits / old Golden Screens — **historical ancestry only**.

## 12. New execution order

This gate temporarily amends execution order to:

`AUTHORITY RECONCILIATION → COHERENCE RESET → WORLD DECISION → FINAL IA → DEPLOYED INTEGRATED REHEARSAL → HUMAN FOUNDING-COHORT REHEARSAL → BROAD HOSTILE REVIEW → CLOSURE`

BROADCAST ENTRY is deferred until the core instrument is coherent enough that Broadcast can inherit the language rather than redefine it.

## 13. Review discipline

This is not permission for infinite visual tweaking.

For each bounded implementation slice:

`IMPLEMENT → TEST → VISUAL MATRIX CHECK → ONE independent hostile review at combined freeze → fix Critical/High → ONE targeted rereview if needed → MOVE FORWARD`

Do not restart for Medium/Low polish unless it violates the gate objective or frozen authority.

## 14. Current verdict

`DESIGN_DIRECTION = FOUND`

`PRIMARY_BOTTLENECK = CROSS_SURFACE_COHERENCE`

`NEW_FEATURE_SCOPE = FROZEN`

`WORLD_FINAL_COMPOSITION = OPEN`

`FINAL_NAV_IA = OPEN`

`MASCOT_PR_63 = PAUSED_EXPERIMENT_EVIDENCE`

`BACKEND_ARCHITECTURE_EXPANSION = NOT_AUTHORIZED`

`NEXT_IMPLEMENTATION = SHARED_FOUNDATION_EXTRACTION + FIVE_SURFACE_AUDIT`

`PHASE_9_BROAD_HOSTILE_REVIEW = UNSPENT`

`SAFE_TO_MERGE = NO`

`MERGE_AUTHORITY = NONE`
