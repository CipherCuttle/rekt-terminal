# REKT INK(CUBATOR) — REKT Instrument OS v2

**Status:** CANONICAL / USER-LOCKED VISUAL AUTHORITY

**Locked:** 2026-09-09

**Scope:** art direction, material system, responsive composition, graphic primitives and implementation fidelity. This document supersedes the *visual/material/composition* direction in `REKT_INSTRUMENT_OS_V1.md` where the two conflict. It does **not** supersede Surface Purpose V1, Signal Grammar V1, truth semantics, domain ownership, generated API contracts, accessibility requirements, or the rule `CLAIMED != OBSERVED != PROVEN`.

**Important:** the generated desktop/mobile concept images that produced this decision are **visual reference authority only**. Their placeholder routes, stats, copy, projects, wallet values, NFT names, reputation values and other fixture content are not product/domain authority and must not enter production as invented truth.

---

## 1. Locked visual thesis

REKT Inkubator is a **bright industrial software instrument with embedded cathode displays**.

The product should feel like a precision-designed physical object translated into responsive software:

- warm white / off-white chassis dominates the page;
- black printed typography, rules, micro-labels and technical graphics define structure;
- sparse orange is the physical/action accent;
- dark inset display wells contain the living REKT instrumentation;
- cyan carries observed/live signal graphics;
- REKT violet appears selectively for identity/context;
- acid green remains reserved for PROVEN semantics only;
- small screws, seams, perforation/dot fields, barcode-like marks, calibration ticks and printed labels provide object-like precision;
- the whole page is **not** a CRT: cathode is a localized display medium inside the white chassis.

The visual reaction target is:

> “This looks like a strange, premium REKT instrument/dashboard that could only belong to this product.”

Not:

> “This is a Teenage Engineering clone.”

Reference products may inform grammar and craft, never exact branded assets, layout, control topology or copyrighted artwork.

---

## 2. What changed from v1

V1 over-weighted a near-black field-terminal composition. V2 reverses the material hierarchy:

```text
V1: black field terminal -> instruments inside it
V2: white industrial chassis -> dark instrument windows inside it
```

The retained ideas are:

- software-as-instrument;
- realtime graphical feedback;
- CRT/cathode material in bounded screens;
- event-driven motion;
- bespoke REKT graphical identity;
- `CLAIMED != OBSERVED != PROVEN`;
- renderer boundaries and accessible DOM controls;
- no generic SaaS/card soup;
- no generic icon library as primary domain identity.

The retired default is:

- full-page darkness;
- black negative-space dominance across operational screens;
- “terminal” as a page-wide texture;
- literal synth-device mimicry;
- knobs/keys/control groups that exist only as decoration.

---

## 3. Canonical material stack

### CHASSIS

Dominant white/off-white structural layer.

Properties:

- warm rather than pure blue-white;
- faint paper/polymer/aluminium character, never heavy skeuomorphic texture;
- thin grey seams and panel borders;
- restrained 1–2 px relief/shadow where needed to separate planes;
- tiny corner fasteners and registration marks may be used sparingly;
- no glassmorphism;
- no purple gradient wash;
- no giant ambient glow.

### PRINT

Static technical information printed onto the chassis:

- page titles;
- section labels;
- rules;
- tick marks;
- dot/perforation fields;
- microcopy;
- coordinates/receipt-like identifiers where real;
- barcode-like graphic motifs only when decorative and non-deceptive.

PRINT should feel inexpensive in color count but expensive in typography and alignment.

### DISPLAY WELL

Dark recessed module that contains living instrumentation.

Use for:

- live/observed telemetry;
- source health;
- waveform/scope;
- selected object diagram;
- the supplied REKT pixel mascot as neutral identity, or source-supported state;
- verifier/provenance instrument;
- compact contextual data that benefits from high-contrast monitoring.

Never put every section inside a display well.

### SIGNAL GRAPHICS

Visual vocabulary inside display wells:

- thin cyan/white vector line art;
- sparse orange event/action accents;
- small segmented meters;
- waveform/scope lines;
- crosshairs/registration marks;
- compact labels;
- low-noise grid lines;
- optional tiny raster/scanline treatment.

---

## 4. Color semantics

All production colors must map to named tokens.

Suggested v2 palette roles:

```text
surface.chassis      warm off-white
surface.panel        slightly cooler/lighter white
surface.seam         pale neutral grey
surface.display      near-black graphite
text.ink             near-black
text.secondary       graphite grey
text.on-display      cool off-white
signal.context       REKT violet
signal.observed      cyan
signal.attention     orange/amber
signal.failed        coral/red
signal.proven        acid phosphor green
signal.stale         muted grey
```

Rules:

- cyan does not mean PROVEN;
- orange does not mean failure by default;
- green may not become generic success decoration;
- color is never the only state carrier;
- the white chassis itself is neutral, not “safe” or “proven.”

---

## 5. Typography hierarchy

The v2 visual system depends on typography more than effects.

Roles:

1. **DISPLAY TITLE** — broad, heavy, compact industrial sans; large and rare.
2. **SECTION / CONTROL** — condensed or geometric sans with clear hierarchy.
3. **TECHNICAL / READOUT** — legible mono face for values, timestamps, source IDs and display labels.
4. **BODY** — highly readable neutral grotesk/technical sans.
5. **PIXEL/CRT** — only inside tiny display-specific labels or REKT sprite contexts.

Do not set whole pages in mono. Do not use a novelty futuristic face for body copy.

---

## 6. Canonical graphic motifs

Allowed shared motifs:

- orange/grey paired slash mark;
- small dotted/perforation field;
- diagonal striped registration block;
- thin calibration lines and ticks;
- compact barcode-like motif;
- recessed display frame with tiny corner fasteners;
- cyan/orange scope language;
- the canonical REKT pixel mascot in a recessed identity mount;
- compact network/signal diagrams only when supported by data semantics.

These motifs are a language, not mandatory decorations. A screen may omit any motif that adds noise.

---

## 7. Small embedded terminal rule

Distributed mini-terminals are canonical.

A mini-terminal must have **one job** and a meaningful data source. Examples:

- `SignalScope` — recent observed activity;
- `SourceHealthDisplay` — freshness/integrity state;
- `VerifierDisplay` — proof/verification result;
- `SelectedObjectDisplay` — selected Project/Player/Artifact schematic;
- `ThreadPulseDisplay` — compact chronology/event pulse;
- `SystemStatusDisplay` — bounded operational status;
- `RektStateDisplay` — stateful REKT micro-character tied to real state.

A mini-terminal must not exist only to show random waveforms or fake “LIVE” telemetry.

---

## 8. REKT mascot / cathode graphic system

**User supersession, 2026-09-09:** the swordfish direction is rejected, including
redraws, abstractions, hidden fallbacks and fish-shaped successors.

The supplied pixel-art character is the canonical mascot reference. Preserve its
dark void body, hard pixel silhouette, violet hood/chassis, white eyes, cyan and
sparse orange accents, and asymmetric right-side appendage. Do not invent lore.

Use the original artwork at `apps/inkubator-lab/public/assets/rekt-mascot.png`
through `RektMascot`. Identity is neutral and retains its violet core. The current
calibration exposes `idle` only; observation/attention/blocker/proof states require
real supported caller inputs before implementation. Never recolor the whole art.
Missing artwork receives a neutral text fallback, never an invented replacement.

Keep CRT local to display wells. GSAP may explain selection or actual projection
changes; no timer may manufacture activity or acceptance. The original art itself
remains static and intact.

---

## 9. Responsive composition law

Desktop and mobile are **siblings, not scaled copies**.

### Desktop

- wide modular chassis;
- persistent shell/navigation if product authority permits;
- 12-column or equivalent disciplined grid;
- one primary information/work area;
- 2–4 secondary display wells where justified;
- right-side telemetry column only when it remains useful rather than decorative;
- generous white structural breathing room.

### Mobile

- intentional vertical instrument stack;
- bottom mode navigation where appropriate;
- hero/display modules become full-width;
- dense desktop tables become lists/compact rows;
- critical controls remain thumb reachable;
- paired mini-terminals may become 2-up only when legible, otherwise stack;
- no horizontal desktop squeeze;
- no text below practical mobile legibility to preserve “technical” aesthetics.

Components must respond to their **container**, not only global viewport width.

---

## 10. Layout primitives

Build the production system from these primitives before inventing page-local shells:

- `RektChassis`
- `ChassisPanel`
- `PrintedHeader`
- `RegistrationMark`
- `DisplayWell`
- `DisplayBezel`
- `MicroLabel`
- `MetricCell`
- `MetricStrip`
- `InstrumentGrid`
- `SignalScope`
- `SegmentMeter`
- `Waveform`
- `CathodeDiagram`
- `SourceHealthDisplay`
- `VerifierDisplay`
- `RektSignalFigure`
- `MobileModeBar`
- `DesktopModeRail`

Existing domain primitives from V1 remain valid where compatible.

---

## 11. Interaction and motion

The page should look excellent while completely static.

Motion is then layered as:

- `REACTIVE`: switches, selection, focus, drawer/panel changes;
- `EVENT`: observed backend event changes an instrument;
- `AMBIENT`: extremely subtle display life only;
- `CEREMONY`: rare proof/ship moments.

Avoid constantly animating every scope merely because the display looks like an instrument.

For reduced motion:

- freeze decorative scopes;
- preserve state through static geometry, labels and glyphs;
- remove jitter/persistence effects;
- never hide information because animation is disabled.

---

## 12. Renderer authority

Production default remains:

```text
DOM + Base UI
  semantic content, forms, lists, navigation, accessible interaction

CSS Grid / Subgrid / Container Queries
  responsive chassis and module composition

SVG
  vector diagrams, line-art instruments, ticks, meters, REKT figures

GSAP
  bounded SVG/event choreography

Canvas/uPlot
  high-frequency live time-series scopes when needed

PixiJS 8
  selective procedural 2D display graphics or sprites only

Three/R3F
  rare Broadcast/spatial/ceremony use only
```

Do not use Pixi/Canvas for text/forms that need ordinary DOM accessibility.

---

## 13. CRT implementation rule

CRT is local and restrained.

Allowed techniques:

- repeating-linear-gradient scanline overlay;
- subtle SVG `feTurbulence` noise;
- tiny `feDisplacementMap` sync distortion during explicit events;
- local bloom/halation around bright lines;
- slight phosphor persistence on non-text graphics;
- tiny noise texture.

Forbidden:

- page-wide barrel distortion;
- unreadable chromatic aberration on small text;
- constant jitter;
- heavy bloom;
- postprocessing that changes semantic color meaning.

---

## 14. Fidelity workflow

Generated concept images are targets, not code.

For each screen/component:

1. place reference image beside the implementation;
2. reproduce raw composition without CRT effects;
3. lock typography/spacing/geometry;
4. add display graphics;
5. add semantic live data;
6. add restrained motion;
7. add CRT postprocess;
8. capture desktop + mobile Playwright screenshots;
9. compare against approved reference/baseline;
10. accept intentional deviations explicitly.

Never compensate for wrong spacing with glow/effects.

---

## 15. Acceptance gates

A candidate passes only if:

- the page is visually majority light/chassis on operational surfaces;
- it no longer reads as a copied synth or fake hardware product;
- white print/chassis language and dark instrument windows form one coherent system;
- mini-terminals each have a real purpose;
- raw UI without CRT is high quality;
- mobile is a designed composition, not a desktop shrink;
- meaningful information is DOM-accessible;
- typography is legible at target sizes;
- visual semantics obey Signal Grammar;
- no fake stats/live activity/provenance enter production;
- removing the REKT logo still leaves a recognizable product family;
- screenshot comparisons pass approved visual baselines at canonical desktop/mobile viewports;
- reduced-motion remains coherent;
- no page introduces a new material language without an explicit successor decision.

---

## 16. Kill criteria

Reject/rework if:

- it looks like a generic white SaaS dashboard;
- it looks like a literal Teenage Engineering device clone;
- the whole page becomes a CRT;
- mini-terminals are fake telemetry wallpaper;
- black reclaims visual dominance on ordinary operational surfaces;
- orange/cyan/green lose semantic discipline;
- the page depends on shader/postprocess to feel designed;
- desktop and mobile drift into separate visual brands;
- screenshot fidelity is achieved by hardcoding one viewport while breaking responsive behavior;
- fixture data is mistaken for domain truth.

---

## 17. Permanent design decision

Until explicitly superseded by a later user-authorized canonical document, **REKT Instrument OS v2 is the visual authority for REKT Inkubator frontend work**.

Short form:

> **WHITE INDUSTRIAL CHASSIS + BLACK PRINT + EMBEDDED DARK CATHODE INSTRUMENTS + CYAN LIVE SIGNAL + SPARSE ORANGE ACTION + REKT-SPECIFIC LINE ART.**

All future frontend implementation, review and generated concept work should be judged against this direction first, while continuing to obey Surface Purpose and Signal Grammar.
