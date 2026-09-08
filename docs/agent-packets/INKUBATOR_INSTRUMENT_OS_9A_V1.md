# INKUBATOR INSTRUMENT OS — PHASE 9A PACKET V1

**Status:** ACTIVE / USER-AUTHORIZED FRONTEND PRIORITY

**Parent authority:** `docs/inkubator/REKT_INSTRUMENT_OS_V1.md`

**Active PR:** #44 — draft / open / unmerged

## Objective

Replace the rejected V3 launch composition with a coherent REKT software-instrument frontend without weakening Phases 0–8 truth/security/domain authority.

## First bounded target

Create an executable Instrument/Motion Lab containing exactly these ten calibration primitives:

1. Signal Path
2. Rotary/Gauge
3. Oscilloscope
4. Numeric Readout
5. Mode Switch
6. Thread Node
7. REKT Sprite
8. CRT Material treatment
9. Verifier Machine
10. Mission Machine

Where meaningful, the lab must express `IDLE / INPUT / ACTIVE / SUCCESS / ERROR` from one explicit calibration state.

## Calibration trust rule

Lab state is synthetic and must be visibly labeled as calibration-only. It must not import production fixture state, mint truth, or visually imply that simulated `SUCCESS` is a real PROVEN product event.

`CLAIMED != OBSERVED != PROVEN` remains immutable.

## Implementation boundary

For the first calibration slice:

- isolate under `?lab=instrument`;
- do not replace production routes;
- do not alter API/domain/verifier semantics;
- do not import V3 fixture/data modules;
- raw composition must work without CRT/postprocessing;
- reduced-motion must disable ambient motion cleanly;
- desktop and mobile must avoid horizontal overflow;
- use DOM/SVG/CSS only for this first proof so visual grammar can be judged before dependency/runtime expansion.

The next slice may add the frozen GSAP/Pixi/TanStack stack once the primitive grammar is accepted. Renderer boundaries in `REKT_INSTRUMENT_OS_V1.md` remain authoritative.

## Acceptance gates for this slice

- exactly ten required primitives render;
- one state selector coordinates all primitives;
- no fixture imports enter the Instrument Lab;
- calibration warning is visible;
- Mission Machine visually dominates the set;
- REKT sprite reads at small size and remains a state indicator, not a mascot layer;
- acid green appears only under success/proven-style calibration;
- reduced-motion removes ambient animation;
- desktop 1440x900 and mobile 390x844 pass without horizontal overflow;
- axe reports zero violations on the lab surface;
- existing V3/Signal System remains untouched except the query-gated lab router in `main.tsx`.

## Next action after PASS

Do not propagate the lab to every screen.

1. inspect screenshots/video of the lab and reject weak primitives;
2. freeze primitive grammar;
3. install/freeze GSAP + PixiJS + TanStack Router/Query under the documented renderer boundaries;
4. build **LIVE COMMAND** first against the generated API client;
5. prove healthy/building, blocked/help-needed, and ship-ready/proven scenarios;
6. only then build shared shell and propagate to PROJECT → WORLD → PLAYER → SHIP → Broadcast.

## Review policy

This calibration slice does not spend the Phase-9 hostile-review budget. Use source/unit/e2e/visual checks for calibration. Spend the one hostile review on the frozen launch candidate, not an early visual lab.
