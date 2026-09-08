# REKT INK(CUBATOR) — REKT Instrument OS v1

**Status:** CANONICAL / FRONTEND VISUAL + MOTION AUTHORITY

**Locked:** 2026-09-08

**Scope change:** explicit user-authorized visual-direction change. This document supersedes the implementation/aesthetic direction in `REKT_SIGNAL_SYSTEM_V0.md` where the two conflict, while preserving its truth semantics, Thread concept, three intensity modes, accessibility requirements and anti-gamification constraints.

**2026-09-08 constitutional amendment:** [Surface Purpose V1](REKT_SURFACE_PURPOSE_V1.md) and [Signal Grammar V1](REKT_SIGNAL_GRAMMAR_V1.md) now govern surface ownership and presentation constraints where older wording here conflicts. Compatible material/atmosphere guidance remains authoritative. See [Decision Register G1–G3](DECISION_REGISTER_V0.md#surface-purpose--signal-grammar-amendments--2026-09-08). Surface concepts do not mandate equal navigation prominence or authorize PLAYER/SHIP builds. Renderer selection, event eligibility and motion classes must satisfy the new grammar; historical rebuild sequencing is not permission to resume production work.

## 1. Product-level visual thesis

REKT Inkubator is not a dark SaaS dashboard and not a marketing microsite with terminal decoration.

It is a **software instrument for building**:

> a black REKT field terminal whose display behaves with the graphical intelligence of a high-end music instrument, where real product events visibly travel through the machine and small REKT entities live inside the instrumentation.

Primary reference hierarchy:

1. **Teenage Engineering / OP-1 interaction philosophy** — realtime graphical feedback, playful system metaphors, compact instruments, motion that explains state;
2. **CRT / cool-retro-term material language** — black display, phosphor, raster, persistence, restrained signal instability;
3. **diegetic field-computer/HUD logic** — the UI should feel like equipment that belongs to the REKT world;
4. **REKT Ink identity** — black negative space, purple pixel/line language, tiny expressive REKT states, degen humor without mascotification.

Reference products are inspiration only. Do not copy their exact assets, layouts, icons, sounds, characters or branded interaction patterns.

## 2. Non-negotiable composition rule

Do not design five pages independently.

Build one visual operating system and expose it through five lenses:

- `WORLD` — peripheral public awareness through temporal/event semantics; final topology unresolved (G1);
- `COMMAND` — primary logged-in mission instrument;
- `PROJECT` — shared project workstation;
- `PLAYER` — persistent builder record/save-file;
- `SHIP` — artifact-first proof/receipt surface.

The browser should conceptually disappear. The user is changing modes on one machine.

## 3. Three intensity modes

The existing `BROADCAST → COCKPIT → ARTIFACT` grammar remains authoritative.

### BROADCAST

Landing/WORLD/selected ceremonies.

May use large typography, richer motion, R3F/Three, shader fields, real artwork/media and stronger atmospheric treatment.

### COCKPIT

COMMAND and most PROJECT work.

Calm enough for hours. Dense but legible. Motion is mostly reactive or event-driven. The current Mission and `NEXT MOVE` dominate.

### ARTIFACT

SHIP and artifact presentation.

The thing built dominates. REKT instrumentation frames proof and provenance rather than competing with the artifact.

## 4. Canonical information hierarchy

In COMMAND the eye must find, in order:

1. MISSION;
2. NEXT MOVE;
3. THREAD / meaningful progression;
4. BLOCKER / ATTENTION;
5. source/evidence status;
6. PARTY / HELP;
7. advisory Daemon detail;
8. technical provenance on demand.

`NEXT MOVE` remains sacred.

Do not lead with KPI tiles, generic charts, bento grids, universal XP, follower counts or engagement metrics.

## 5. The interface renders causality

A backend fact should ripple consistently through every relevant surface only when that surface's actual authorized projection changes. The example below does not add GitHub push or Ship event kinds to the current WORLD contract (G1; Signal Grammar §15).

Example:

```text
GitHub push
  -> source RX wakes
  -> cyan signal travels
  -> Thread receives an OBSERVED node
  -> Mission instrument changes
  -> Next Move may change
  -> small REKT RX state reacts
  -> Project/World projection updates as appropriate
```

Animation is not decoration layered on data. The animation is a representation of the state transition.

The UI must preserve the Product Contract truth ceiling:

`CLAIMED != OBSERVED != PROVEN`

No animation, shader, color or celebratory treatment may visually manufacture stronger authority than the backend actually holds.

## 6. Visual material

Base display:

- near/pure black dominant background;
- dense negative space;
- mostly square/rectilinear instrument geometry;
- thin vector/pixel linework;
- tiny status readouts, tick marks, scopes and diagrams;
- subtle CRT treatment applied after the raw design already works.

Avoid:

- glassmorphism card systems;
- generic purple gradient blobs;
- giant soft glows;
- decorative HUD hexagons;
- card lift/drop-shadow hover language;
- cyberpunk neon for its own sake;
- effect-heavy surfaces that collapse when shaders are disabled.

## 7. Color semantics

Feature code must use semantic tokens rather than arbitrary literals.

Recommended direction:

- `surface.void` — near black;
- `text.primary` — warm/off white;
- `signal.context` — REKT violet/lilac;
- `signal.observed` — cyan;
- `signal.attention` — amber/orange;
- `signal.blocked` / `signal.failed` — red/coral;
- `signal.proven` — acid phosphor green;
- `signal.stale` — muted grey/lilac.

ACID GREEN = PROVEN ONLY (G2). Current/actionable states use hierarchy, locus, typography, glyphs or focus/affordance. Earlier green-for-current/actionable usage is superseded; a future scoped implementation sweep is required. It is not ambient decoration.

Color is never the only state carrier; combine glyph, label, shape, motion and provenance.

## 8. Typography

The old Inter-first visible-product direction is superseded.

Target roles:

- **DISPLAY / INSTRUMENT** — compact technical mono/pixel-influenced face, e.g. Departure Mono-class direction;
- **READING / OPERATIONAL** — high-legibility mono/technical face, with a Berkeley Mono-class aesthetic if licensing permits;
- **PIXEL LABELS** — bespoke bitmap/pixel treatments only where they remain readable.

Do not set all long-form copy in tiny pixel text. Terminal identity must not destroy legibility.

## 9. Canonical graphic primitives

The v0 primitives evolve into instrument primitives:

- `TerminalShell` — persistent machine chassis;
- `ModeRail` — WORLD / COMMAND / PROJECT / PLAYER / SHIP switching;
- `InstrumentFrame` — bounded instrument with one job;
- `SignalLamp` — sourced status indicator;
- `SignalPath` — causal route;
- `Scope` — realtime activity trace;
- `Radar` — superseded for production WORLD without canonical spatial/relationship semantics (G1);
- `Dial` / `Meter` / `NumericReadout` — truthful bounded state only;
- `ThreadRail` — one optional rendering of durable causal/temporal continuity, not a mandatory literal rail (G3);
- `SourceNode` — provenance-bearing input;
- `RektSprite` — small state micro-animation;
- `MissionMachine` — COMMAND's central visual object;
- `VerifierMachine` — Ship/test inspection object;
- `ArtifactViewport` — real artifact/demo/media view.

A new feature should compose these before inventing another panel language.

## 10. REKT micro-sprite system

REKT is a small resident state indicator, not a giant mascot layer.

Canonical visual DNA:

- hooded black/negative-space body;
- purple pixel outline;
- bright simple eyes;
- gear/halo motif where readable;
- optional front-layer tentacle trait where appropriate;
- sparse cyan/orange event accents;
- black background compatibility;
- no text baked into sprites.

Canonical state family:

- `IDLE`;
- `RX` / signal received;
- `WORKING`;
- `BLOCKED`;
- `BEACON` / help;
- `VERIFYING`;
- `PROVEN` / celebration;
- `FAILED` / dead.

Small display sizes are primary: 16/24/32 px, 48 px only for emphasis. Author from a larger master grid where necessary.

Motion should be low-frame, silhouette-readable and restrained. No mascot bouncing, squash-and-stretch cartoon loops or constant celebratory motion.

## 11. Motion grammar

Motion classes:

- `AMBIENT` — quiet independent machine life;
- `REACTIVE` — immediate user-control response;
- `EVENT` — canonical state/input change;
- `CEREMONY` — rare Ship/PROVEN/major achievement transition.

Rule:

> Ambient motion is quiet. Event motion is precise. Proof motion is rare.

Suggested timing vocabulary:

- `SNAP` — ~70 ms;
- `SWITCH` — ~120 ms;
- `RELAY` — ~180 ms;
- `MECHANICAL` — ~240 ms;
- `SIGNAL` — ~380 ms;
- `MODE` — ~480 ms;
- `CEREMONY` — ~900 ms, bounded.

Named eases should express machine behavior rather than generic `ease-in-out` everywhere.

## 12. Frontend runtime/tooling authority

Keep existing:

- React 19;
- Vite 7;
- Base UI for accessible unstyled interaction primitives;
- Three + React Three Fiber for Broadcast/WORLD/rare ceremony only;
- Storybook, Playwright, axe and visual snapshots.

Adopt for the Instrument OS rebuild:

- **TanStack Router** — real route/mode architecture;
- **TanStack Query** — canonical server-state/cache layer over the generated Inkubator API client;
- **GSAP + `@gsap/react`** — primary choreography authority;
- GSAP SVG/text/layout capabilities such as DrawSVG, MotionPath, Flip and restrained ScrambleText where useful;
- **PixiJS 8** — 2D GPU instrument graphics, scopes, sprite sheets, radar and procedural display graphics;
- **Pixelarticons** or equivalent strict-grid open utility icon set for mundane controls;
- bespoke REKT instrument glyphs for domain semantics.

Selective/experimental only:

- **Rive** — a small number of authored stateful hero instruments if a prototype proves superior to SVG/Pixi;
- xterm.js — only for actual CLI/log/dev-terminal content, never as the main product UI;
- React Bits Pro — atmospheric set pieces only under a compliant private/license boundary.

Do not add Motion/Framer Motion, Anime.js, React Spring, Lottie or another general motion authority without a concrete missing capability. Avoid animation-stack soup.

## 13. Renderer boundaries

Use the simplest renderer that fits the job:

```text
DOM / Base UI
  -> semantic text, controls, forms, accessibility

SVG + GSAP
  -> signal paths, gauges, line diagrams, Thread geometry

PixiJS
  -> living 2D display, sprites, scopes, raster telemetry

Three/R3F
  -> atmospheric/spatial Broadcast and rare ceremony
```

COMMAND must not require a Three scene for ordinary operation.

## 14. Icon policy

Visible product identity must not be Lucide soup.

Three tiers:

1. bespoke REKT glyphs for Mission/Thread/Source/Signal/Help/Assist/Verify/Ship/Observed/Proven/Blocked/Stale/Player/World;
2. strict-grid pixel utility icons for mundane actions such as close/search/refresh/external-link/settings;
3. generic vector icon libraries only for OPS/developer surfaces or when no domain identity is required.

## 15. Screen-specific manifestation

### COMMAND

Build first. Persistent shell, Mission Machine, one dominant Next Move, graphical Thread, source/provenance instruments, blocker/help rail and small REKT state. Daemon advice is visibly advisory.

### PROJECT

A workstation, not tabs + cards. Real artifact/deploy preview, shared Thread, Help/Test/Source/Ship instruments attached to context.

### WORLD

Peripheral public awareness, grounded in the actual public project/Player discovery and WORLD event projections. Semantic-free network/radar direction is superseded (G1). The current WORLD event kinds are HELP_BEACON_OPENED (CLAIMED), ASSIST_ACCEPTED (OBSERVED) and EXTERNAL_TEST_RECORDED (OBSERVED); Proven Ships are not a current WorldSignalView event form. Final topology remains open among PURE SIGNAL TAPE, NOW / DISPATCH + SIGNAL TAPE, and RECEIVER / EXPRESSIVE ARRIVAL + SIGNAL TAPE. No candidate is frozen as winner; blackwater remains experiment evidence only.

### PLAYER

A builder dossier/save-file. Identity, current Mission and one vertical history Thread. Ships/Assists/failures/recoveries/Cheevos make the character.

### SHIP

Artifact-first. Real screenshot/embed/demo dominates. Verification/proof instrumentation is secondary. PROVEN transition is rare and shareable.

## 16. Existing frontend disposition

The existing V3 marketing microsite and Phase-2 Golden Screens are **historical/reference fixtures, not launch frontend authority**.

Preserve them for comparison and regression evidence until replacements pass, but do not incrementally polish them into the final product.

In particular, retire as launch direction:

- scrolling marketing-section composition as the authenticated product model;
- generic card grids;
- Inter-first visible product identity;
- decorative purple gradient fallback effects;
- fixture-driven Golden Screens as production routes;
- React Bits fallback layers as primary atmosphere;
- generic iconography as domain identity.

## 17. Data wiring rule

Production screens must use the generated Inkubator API client as the network contract.

No fixture import may enter a production route.

Start with Query-based refetch/polling where sufficient; add realtime transport only where evidence shows polling cannot deliver the intended experience.

A single backend fact should project consistently into every relevant route rather than maintaining parallel frontend truth.

## 18. CRT rule

CRT is a material layer, not a design crutch.

The raw UI must pass visual review with CRT/postprocessing disabled.

Then the display layer may add restrained:

- scanline modulation;
- phosphor mask/bloom/halation;
- subtle persistence;
- tiny noise/raster jitter;
- localized sync instability during specific events;
- vignette/curvature only where composition supports it.

Do not destroy text clarity or induce constant motion.

## 19. Performance policy

Aesthetic fit and perceived quality outrank marginal Lighthouse score improvements.

This does **not** mean performance is optional. Runtime smoothness is part of visual quality.

Prioritize:

- stable input response;
- smooth motion on target hardware;
- no shader initialization flash;
- crisp pixel rendering;
- no layout jank;
- intentional loading/degraded states;
- mobile layouts designed rather than squeezed;
- reduced-motion that remains visually coherent.

Do not remove a high-value visual system merely to gain a few synthetic audit points unless it causes a real user-visible quality or accessibility defect.

## 20. Instrument/Motion Lab gate

Before rebuilding all screens, create an executable Instrument Lab containing the real final primitives:

1. signal path;
2. rotary/gauge;
3. oscilloscope;
4. numeric readout;
5. mode switch;
6. Thread node;
7. REKT sprite states;
8. CRT display treatment;
9. Verifier instrument;
10. Mission Machine.

Each must demonstrate at least `IDLE / INPUT / ACTIVE / SUCCESS / ERROR` where meaningful.

This is calibration before production, not permission to ship an endless design-system project.

## 21. Rebuild order

Canonical rebuild sequence:

`FREEZE OLD V3 -> INSTRUMENT SYSTEM -> MOTION LAB -> LIVE COMMAND -> SHARED SHELL -> PROJECT -> WORLD -> PLAYER -> SHIP -> BROADCAST ENTRY`

COMMAND is the first production-quality proof because it is the hardest and most important operating surface.

## 22. Acceptance gates

Do not call the rebuild successful unless:

- removing the logo still leaves an unmistakable REKT product family;
- raw UI without CRT already looks high quality;
- first-time users can identify Mission/current state/blocker/Next Move without explanation;
- meaningful backend events produce coordinated, truthful visual response;
- CLAIMED never visually reads as OBSERVED/PROVEN;
- PROVEN is rare and unmistakable;
- source stale/unavailable states fail visibly closed;
- production routes contain no fixture imports;
- an accepted Ship is reflected only through each surface's available authorized projection; no Ship event is invented for the current WORLD event contract (G1);
- COMMAND remains usable for long sessions;
- keyboard/focus/reduced-motion/mobile behavior remains intentional;
- no generic card/gradient/icon language silently re-enters as the dominant visual model.

## 23. Kill criteria

Reject/rework a candidate if:

- it looks like a crypto dashboard with a REKT logo;
- it is remembered for a shader rather than the current action;
- everything moves continuously;
- animations do not correspond to causes/state;
- the REKT sprite becomes Clippy/a mascot layer;
- OP-1 inspiration becomes literal imitation;
- multiple general animation libraries compete for authority;
- Three/Pixi/Rive canvases proliferate without renderer boundaries;
- decorative visual effects weaken truth legibility;
- the old V3 composition is merely reskinned rather than replaced.

## 24. Compatibility and migration

Preserved from `REKT_SIGNAL_SYSTEM_V0.md`:

- Thread as the cross-product red thread;
- `BROADCAST / COCKPIT / ARTIFACT` modes;
- Mission/Next Move hierarchy;
- semantic truth vocabulary;
- acid-green scarcity;
- progressive disclosure;
- privacy/public-projection boundaries;
- accessible familiar web behavior;
- responsive/reduced-motion requirements.

Superseded:

- Inter/system grotesk as default visible-product direction;
- Motion as the main candidate animation layer;
- Lucide as the visible product's default icon language;
- V3 as the compositional ancestor to incrementally evolve;
- generic `FRAME`/card implementation as the primary screen architecture.

The backend/domain/trust model is unchanged. This is a frontend visual/interaction authority change, not a weakening of product truth or security boundaries.
