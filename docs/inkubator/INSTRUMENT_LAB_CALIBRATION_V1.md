# REKT Instrument Lab Calibration V1

Status: **PASS / FROZEN FOR PROPAGATION TO LIVE COMMAND ONLY**

This receipt records the single Phase-9A visual calibration pass required before production-screen propagation. It is implementation/calibration evidence, **not** the Phase-9 hostile review.

## Authority

Visual and motion authority: `docs/inkubator/REKT_INSTRUMENT_OS_V1.md`.

Runtime/trust authority from earlier phases is unchanged.

## Candidate and evidence

- calibrated runtime candidate: `b89ca2d7ea8262d26bdd329c3f65b443e524d125`
- capture-only workflow commit: `e6fdb2a0d68b534f0b0ebe84b9016375a0c30faf`
- capture workflow run: `34227353687`
- artifact: `phase9-instrument-calibration`
- artifact id: `10056301492`
- artifact digest: `sha256:893785c31c8f968a4f76c136ca0f0e11d1ec082fe48824daa08acb53209f706e`
- capture workflow removed after evidence generation.

The capture-only commit changed no Inkubator runtime or dependency files.

Evidence contains:

- raw desktop `1440×900` screenshot;
- raw mobile `390×844` screenshot;
- short state-transition recording covering `IDLE → INPUT → ACTIVE → SUCCESS → ERROR`.

CRT was OFF for both screenshots and the transition capture.

## Calibration repairs incorporated

1. Removed orphan `CommandPrototype.tsx`; no production propagation remained during calibration.
2. Removed global SUCCESS→green channel remapping. Cyan remains the ordinary signal/observation channel.
3. Replaced fake `TRUTH CONFIDENCE 000–100` with concrete synthetic `LAST RX AGE` calibration values.
4. Replaced the smooth REKT hood/halo drawing with an explicit `24×24` canonical pixel-sprite asset-slot boundary. The placeholder is not visual authority for the final entity.
5. Replaced the generic Mission HUD with the Mission Ratchet: a curled/tentacle mechanical track, detents, moving claw, jam state, and proof release.
6. Kept all ten primitives while reducing equal-card visual dependence into one open calibration bed with instrument dividers.
7. Extracted GSAP motion timing/ease vocabulary into `motion-tokens.ts`.
8. Changed the Pixi calibration scope to retain one `Application` and redraw state without application/context recreation.
9. CRT became an opt-in prototype material toggle and defaults OFF.
10. Kept the existing GSAP/Pixi/TanStack dependency lock unchanged; no new dependency was added.

## Single visual calibration verdict

### 1. Recognizably REKT without the logo

**PASS, bounded.**

The black/violet/cyan machine language, micro-instrument typography, and curled tentacle-ratchet geometry carry the product-family identity without depending on the REKT logo. The pixel entity remains intentionally unfrozen and therefore does not carry this verdict.

### 2. Instrument rather than dashboard

**PASS.**

The raw desktop composition reads as one piece of equipment with a mode rail and calibration bed. Individual primitives remain inspectable without becoming ten equal SaaS cards. Mobile preserves Mission first and reads as stacked instrument modules rather than a squeezed dashboard.

### 3. Motion explains a cause

**PASS.**

State-transition capture shows the selected synthetic event entering the signal path, then propagating through Thread/Mission/Verifier responses. SUCCESS creates proof confirmation; ERROR produces a jam/failure response. Motion is event choreography rather than ambient decoration.

### 4. Raw UI works with CRT disabled

**PASS.**

All required evidence was captured with `data-crt="off"`. Hierarchy, geometry, state, and readability do not depend on scanlines/postprocessing.

### 5. Green is rare

**PASS.**

ACTIVE/default state contains no acid-green channel substitution. SUCCESS retains ordinary signal cyan and introduces green only at explicit PROVEN/current-confirmation loci: proof release, PROVEN Thread, and PROVEN Verifier.

### 6. REKT entity is subordinate to the machine

**PASS.**

The entity primitive is a small marked asset slot, not the composition anchor, assistant, mascot layer, or source of product truth.

### 7. Memorable/weird graphical metaphor

**PASS.**

The Mission Ratchet is the chosen recognizable metaphor: the mission is a claw moving through detents on a curled/tentacle track; blockage becomes a mechanical jam and proof becomes release at the end of the track. It remains legible as state geometry with text removed.

## Propagation authority after this receipt

The Instrument Lab visual gate is closed for this pass.

Authorized next production slice: **LIVE COMMAND only**.

LIVE COMMAND must:

- use the generated Inkubator API client and TanStack Query;
- import no development fixture as production truth;
- preserve `CLAIMED != OBSERVED != PROVEN`;
- keep source/private boundaries and Daemon advisory-only authority intact;
- drive animation from **event/projection deltas**, not from a generic UI state selector;
- retain long-lived renderers rather than recreate Pixi/WebGL contexts on normal state change;
- keep acid green limited to explicit PROVEN/current confirmation loci;
- inherit the raw Instrument grammar before CRT/material treatment.

Not authorized by this receipt: PROJECT, WORLD, PLAYER, SHIP, Broadcast propagation.

`PHASE9_HOSTILE_REVIEW_BUDGET = 0/1 USED`

`SAFE_TO_MERGE = NO`
