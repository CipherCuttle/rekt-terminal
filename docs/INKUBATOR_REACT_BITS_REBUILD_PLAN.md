# REKT INK(CUBATOR) — React Bits Rebuild Plan

> **STATUS: HISTORICAL IMPLEMENTATION REFERENCE — NOT CANONICAL PRODUCT AUTHORITY.**
>
> The canonical MVP authority now lives under [`docs/inkubator/INDEX.md`](./inkubator/INDEX.md). This document records the earlier V3/React Bits visual rebuild intent and remains useful as Broadcast/design ancestry.
>
> **Important current-state correction (2026-09-06):** the feature branch now contains generated/installed `apps/inkubator-lab/src/components/react-bits/*.tsx` source. The earlier licensing statement at the bottom of this plan described the intended boundary at the time, not the current repository state. React Bits Pro licensing/public-source/build handling is now an explicit Platform Foundation F0 cleanup item in the canonical Inkubator docs. Do not treat this historical file as evidence that the current branch is license-clean.

## Decision

Rebuild the Inkubator as a clean purple signal board: a sequence of sharp, flush compartments that make the build loop legible before the effects become interesting. The site should feel like a premium component gallery that happens to be a live community pitch — never like a generic SaaS landing page, shader sampler, or admin dashboard.

The previous frontend is rejected. This work lives on `concept/inkubator-reactbits-v1`; the production branch remains the rollback point until this version earns approval.

## What we borrow

| Reference | Keep | Reject |
| --- | --- | --- |
| Grain Wave | grainy purple material, low-contrast depth, soft movement | full-page visual noise, rainbow color drift |
| Dither Wave | coarse retro texture, a pinned visual chapter, texture as information | repeating it in every card, unreadable text over it |
| Glitch Text | cursor-reactive headline energy and controlled instability | permanent jitter, hard-to-read copy, novelty-first hero |
| Shader template | sticky navigation, full-bleed hero, pinned story, modular showcase bands, scroll-led reveal | template-shaped SaaS sections, copied marketing structure, effect stacking |

## Component jobs

1. **Grain Wave chamber** — one hero atmosphere behind the first useful sentence.
2. **Glitch Text headline** — one active headline plus selected state changes; static fallback for reduced motion.
3. **Dither Wave chamber** — one pinned scroll chapter that explains `CHALLENGE → SHIP → FLEX → REWARD → REPEAT`.
4. **Compartment grid** — flush seams, shared edges, distinct jobs; no floating-card soup.
5. **Scroll index** — native sticky progress and IntersectionObserver state; no heavy scroll dependency until the composition proves it needs one.

## Page map

- **00 / signal** — sticky REKT mark, round readout, Grain Wave hero, one CTA.
- **01 / loop** — pinned story chamber; the active loop step changes as the reader moves.
- **02 / builds** — a clean component-gallery grid for games, tools, experiments, and interactive art.
- **03 / room** — cohort slots and what the room rewards, presented as a sparse inventory board.
- **04 / open channel** — short close, live URL requirement, and one decisive action.

## Visual system

- Base: `#08070e`, `#0d0b18`, `#12101f`.
- Purple: `#7a5cff`, `#a884ff`, `#d6c7ff`.
- Text: `#f2eff8`, `#aaa3b8`, `#756d87`.
- Acid green is a tiny status signal only: `#9aff67`.
- 1px seams and shared edges carry hierarchy; avoid pills, glassmorphism, giant shadows, and ornamental corners.
- Main copy is readable at 16px+; metadata is compact but never smaller than 12px.
- Typography is clean grotesk + mono utility labels. The effect is allowed to distort the headline, never the explanation.

## Ten-lens reasoning stack

1. **Socratic** — what must a visitor understand in five seconds? This is a build loop with a real next action.
2. **Hegelian** — premium calm and degen humor can coexist if humor lives in labels and names, not in the layout’s structural quality.
3. **Popperian** — falsify the design if a visitor remembers the effect but cannot say what happens next.
4. **Causal** — every moving layer must point to one state change: attention, progress, or action.
5. **Systems** — hero, pinned loop, inventory grid, and CTA are one system; each zone gets one dominant visual primitive.
6. **Cybernetic** — scroll position is feedback: the board reports where the reader is and what step is active.
7. **Bayesian** — the supplied screenshot is stronger evidence for flush dark compartments and restrained purple than for neon overload; purple wins, neon stays scarce.
8. **MDL** — minimize dependencies and bespoke motion until the smallest composition already feels complete.
9. **DOE** — test only the variables that can materially change the read: seam density, purple intensity, effect opacity, and section height.
10. **Adversarial** — kill the build if it reads as a React Bits catalog, generic shader template, mobile card pile, or inaccessible animated poster.

## Acceptance / kill criteria

Accept when:

- the first viewport communicates REKT INK(CUBATOR), the round, and the next action without scrolling;
- the compartment seams and purple material feel intentional on desktop and mobile;
- effects pause offscreen and respect reduced motion;
- the loop can be understood with effects disabled;
- the build remains a static, shareable `inkubator/` output.

Kill and revise when:

- the user notices the shader before the product;
- more than one effect competes in a zone;
- cards look like a dashboard or component demo;
- body copy drops below readable sizes or seams disappear on small screens.

## Licensing boundary — historical intent, superseded by canonical Foundation work

The original intent was that private/proprietary React Bits Pro source and registry credentials would not be committed and that public adapter semantics would allow a licensed implementation to be injected without changing page composition.

The current feature branch must now be audited against that intent because generated/installed React Bits source exists in the public tree. The canonical requirements and cleanup sequence are defined in:

- `docs/inkubator/ARCHITECTURE_CONSTITUTION_V0.md`;
- `docs/inkubator/CURRENT_STATE_AND_GAP_V0.md`;
- `docs/inkubator/IMPLEMENTATION_ROADMAP_MVP_V0.md`.

Do not add new licensed source or credentials based on this historical plan.