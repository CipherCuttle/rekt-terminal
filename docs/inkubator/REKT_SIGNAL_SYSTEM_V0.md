# REKT INK(CUBATOR) — REKT Signal System v0

**Status:** CANONICAL / MVP UX-UI CONSTITUTION

**Locked:** 2026-09-06

## Purpose

This document defines the visual and interaction "röd tråd" that must survive across World, Command, Project, Player, Ship and future archive/history surfaces.

Coherence does not mean every screen is the same purple card grid. It means every surface speaks the same visual language while changing intensity according to its job.

## 1. The central visual idea: THE THREAD

The Thread is the recurring visual/product grammar for meaningful progression and history.

Example:

```text
● MISSION DECLARED
│
● CORE LOOP           PROVEN
│
◆ DEPLOYMENT          BLOCKED
│
○ EXTERNAL TEST       NEXT
│
○ SHIP
```

The same grammar may represent:

- Round lifecycle;
- Mission progress;
- Project history;
- Player career history;
- evidence chain;
- Ship history;
- graveyard/cause-of-death history;
- resurrection lineage;
- future Build Replay.

The Thread represents meaningful state gates/history, not a literal task list. Projects may be chaotic underneath it.

## 2. Three visual modes

### BROADCAST

Used for World, Round opening, public discovery, cultural moments and selected ceremony.

Characteristics:

- atmospheric;
- expressive;
- large typography;
- real REKT/Chibi/artifact media;
- controlled React Bits/Three effects;
- broadcast Signals/activity;
- still readable with effects disabled.

Target ratio: roughly 70% atmosphere / 30% instrument.

### COCKPIT

Used for Command, Mission operations, Project collaboration, evidence and dense work surfaces.

Characteristics:

- calm;
- high information hierarchy;
- low decorative motion;
- one dominant current objective;
- stable layout suitable for long sessions;
- progressive disclosure for technical provenance.

Target ratio: roughly 10% atmosphere / 90% instrument.

### ARTIFACT

Used for accepted Ship, Project demo/showcase and Receipt presentation.

Characteristics:

- quiet;
- the thing built dominates;
- supporting proof/Party/Assist data is secondary;
- ceremony yields to artifact content.

## 3. Canonical hierarchy in Command

The eye should find information in this order:

1. MISSION;
2. NEXT MOVE;
3. THREAD / meaningful progress;
4. BLOCKER / ATTENTION;
5. PARTY / HELP;
6. ACTIVITY SIGNAL;
7. EVIDENCE DETAIL.

Do not lead Command with KPI tiles, generic charts, a universal XP score or Bento dashboard density.

## 4. Canonical visual primitives

The smallest sufficient grammar is:

- **FRAME** — operational boundary/section with one clear job;
- **SIGNAL** — state + source class;
- **THREAD** — progression/history;
- **PORTRAIT** — Player identity treatment;
- **EVENT** — meaningful activity row;
- **ARTIFACT** — shipped thing/content-dominant container.

Product patterns built from these may include:

- MetaStrip;
- MissionHeader;
- NextMove;
- EvidenceRow;
- HelpBeacon;
- PartyRail;
- Achievement/Cheevo ceremony;
- ShipReceipt;
- PlayerSummary.

If a new feature requires a completely new visual language rather than composing these patterns, challenge the feature/design first.

## 5. Signal semantics

Visual state names must align with the Product Contract.

Recommended visual mapping:

- `UNKNOWN` — hollow neutral glyph;
- `CLAIMED` — lilac/partial glyph;
- `ACTIVE` — purple active glyph;
- `OBSERVED` — distinct sourced state;
- `PROVEN` — acid-green proof mark;
- `ATTENTION` — amber warning/attention mark;
- `BLOCKED` — coral/red blocker mark;
- `STALE` — muted/expired glyph;
- `FAILED` — explicit failure glyph/label.

Color is never the only state carrier.

## 6. Acid green law

Acid green is scarce.

It means:

- PROVEN;
- current positive live state;
- primary actionable confirmation where appropriate.

It must not be used as generic cyberpunk decoration, arbitrary borders, ambient glow or every primary button simply because it looks cool.

The scarcity of green is what makes proof/current state meaningful.

## 7. Color foundation

Preserve the existing V3 family as the base:

- near black: `#08070e` family;
- deep operational surfaces around `#0d0b18` / `#100d1a`;
- purple: `#7a5cff` family;
- lilac: `#b29aff` family;
- acid proof/action: `#9aff67`;
- primary text: `#f2eff8` family;
- readable muted/meta colors with WCAG-aware contrast.

Exact implementation values move into semantic tokens. Feature code must not invent literal hex values.

## 8. Token architecture

Create a small semantic token layer, ideally compatible with the Design Tokens Community Group format where practical.

Conceptual tokens:

```text
surface.world
surface.instrument
surface.elevated
surface.artifact

signal.context
signal.active
signal.observed
signal.proven
signal.attention
signal.blocked
signal.stale

text.primary
text.secondary
text.meta

border.quiet
border.standard
border.signal
```

Also define typography, spacing, radius/shape and motion semantics.

Do not create hundreds of speculative tokens before a component needs them.

## 9. Typography

Keep the existing family unless user testing/design evidence requires a change:

- UI/display: Inter/system grotesk lineage;
- signal/meta: JetBrains Mono/monospace lineage.

Roles:

- **DISPLAY** — Mission names, Player names, Ship moments, major headings;
- **UI** — controls, body content, comments, explanatory copy;
- **SIGNAL** — timestamps, IDs, evidence state, compact metadata.

Do not use tiny 9–10px mono as the default application body language. Operational metadata should remain comfortably readable; body UI generally stays in the 13–16px+ range with accessible line height.

## 10. Shape grammar

### FRAME

Mostly square/low-radius operational geometry. One-pixel seams/shared edges remain part of the identity.

### PORTRAIT

Player/character identity may preserve the asymmetric clipped/rounded treatment already explored in the protocol preview. Keep it specific to identity rather than applying it to every card.

### CEREMONY

More expressive/squircle/distorted shapes are reserved for rare moments such as Ship, major Cheevo, Round opening or resurrection.

Avoid generic SaaS 12px rounded-card soup and glassmorphism everywhere.

## 11. Navigation

Primary authenticated navigation should remain small:

- WORLD;
- COMMAND;
- MISSIONS;
- PLAYERS.

Project/Player contextual navigation lives within the current object rather than inflating the global sidebar.

OPS is operator-only and visually boring/functional.

Desktop navigation should be quiet enough that current work dominates.

Mobile may use a bottom navigation model for the same four primary destinations when user testing supports it.

## 12. Interaction doctrine

1. **One dominant objective.** Command always makes current Mission/Next Move legible.
2. **Recognition over recall.** Do not make users remember Round, blocker, deadline, Party or ship condition.
3. **System status visible.** Syncing/checking/failed/stale/proven states are explicit.
4. **Progressive disclosure.** Human-readable state first; technical provenance expandable.
5. **Normal web behavior under game language.** Familiar keyboard/focus/forms/navigation win over lore gimmicks.
6. **No drag-only critical flow.** Every drag interaction has a click/keyboard alternative.
7. **Responsive priority, not desktop squeeze.** Mobile reorders content around Mission/Next Move rather than merely shrinking columns.

## 13. Motion grammar

Motion has four jobs only:

- **AMBIENT** — world atmosphere;
- **NAVIGATION** — preserve spatial/context continuity;
- **STATE** — communicate a meaningful change;
- **CEREMONY** — rare achievement/Ship moment.

Rule:

> If nothing changed, nothing should move — except deliberately ambient Broadcast layers.

React Bits/Three/R3F are for atmospheric Broadcast jobs, not ordinary form/dialog/table UI.

Motion DOM animation must respect `prefers-reduced-motion` and product low-FX behavior where implemented.

## 14. The World must feel alive without surveillance

Show socially useful aggregated/contextual presence such as:

- builders active;
- testing;
- shipping;
- Help Beacons;
- meaningful project Signals.

Do not expose surveillance-like telemetry such as file viewed, exact idle time, commit inactivity shaming or fine-grained presence that turns the world into employee monitoring.

## 15. Profiles tell stories

Player profile hierarchy should favor:

- identity/current Mission;
- Ship history;
- Assist/help history;
- earned traits/Cheevos;
- Round history;
- current Project/needs.

Do not make follower count or universal points the dominant profile identity.

## 16. Leaderboards look like ledgers, not casinos

Use contextual boards such as Shippers, Assists, Collaboration or Comeback.

Keep them compact, readable and evidence-linked.

Avoid giant podium/XP/casino visuals that turn the product into speculation-status theater.

## 17. Design-system implementation target

Recommended MVP UI stack:

- Base UI — accessible unstyled interaction primitives;
- custom `Ink*` wrappers so feature code depends on Inkubator semantics, not library component names;
- CSS Modules + semantic CSS custom properties;
- Storybook as executable catalog;
- Lucide for mundane interface icons;
- small custom Ink glyph set for domain concepts;
- container queries for reusable pattern responsiveness;
- Playwright visual snapshots and interaction tests;
- axe-core automated accessibility checks plus manual keyboard/screen-reader review.

Do not migrate the existing product to Tailwind merely for convention. Preserve the existing handcrafted CSS strengths while extracting semantic tokens/patterns.

## 18. Initial executable component set

Before broad app implementation, build and exercise roughly:

- InkButton / InkIconButton;
- InkFrame;
- InkSignal;
- InkMetaStrip;
- InkPortrait;
- InkThread;
- InkEvent;
- InkBeacon;
- InkTabs;
- InkDialog;
- InkTooltip;
- MissionHeader / NextMove / EvidenceRow as first product patterns.

Every pattern must cover happy, loading, empty, error, disabled/permission, focus, reduced-motion and narrow-container states where applicable.

## 19. Five golden screens

The design system is not considered coherent until the same fixture can render convincingly through:

1. WORLD;
2. COMMAND;
3. PROJECT;
4. PLAYER;
5. SHIP.

A user should recognize one product family even with the logo hidden, while each screen still has a different compositional job.

## 20. Visual kill criteria

Revise if:

- Command looks like a React Bits showcase;
- every surface uses the same card grid;
- technical provenance overwhelms non-technical builders;
- the shader/effect is remembered but the current action is not;
- green loses semantic meaning through decorative overuse;
- mobile becomes a pile of desktop cards;
- game vocabulary obscures basic interaction;
- a screen is beautiful but unusable for a multi-hour build session;
- a new feature invents a second status vocabulary or independent token palette.

## 21. Compatibility with historical V3

The closed V3 six-beat public design remains the visual ancestry and a valid Broadcast reference. The MVP app should evolve from its palette, typography, seams, restraint and effects-with-jobs discipline rather than discarding it for a generic dashboard template.

The public landing page may evolve structurally as the real World becomes populated, but its identity should remain recognizably descended from the V3 dossier/broadcast system.