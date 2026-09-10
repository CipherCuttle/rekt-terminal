# REKT Instrument OS — Peripheral Animation Authoring Guide

This directory contains the REKT Inkubator peripheral-motion system.

The purpose of this README is to let a new implementation agent add or modify an animation **without accidentally introducing fake state, visual drift, motion chatter, or a second source of truth**.

The governing visual rule is simple:

> **REKT stays mostly static. The machine around him speaks.**

These animations are not decoration. Each one is a tiny, discrete instrument response to a real Inkubator state transition.

---

## 1. Mental model

The intended visual language is:

- **Game & Watch:** fixed compositions, tiny state changes, discrete frames, almost no continuous motion;
- **Teenage Engineering:** graphics explain what the machine is doing, not merely what looks cool;
- **REKT Inkubator:** visual output must never claim more authority than the backend provides.

Think of each cue as a four-frame mechanical diagram.

A good cue answers one question:

> **What changed, and which physical-looking part of this tiny machine should visibly react?**

If the answer requires several unrelated things moving at once, the cue is probably too complicated.

---

## 2. Canonical files

The core implementation is intentionally small:

- `peripheral-motion.ts` — canonical scene geometry, motion policies, validation, debug metadata;
- `PeripheralSignal.tsx` — renderer and replay semantics;
- `peripheral-signal.css` — visual styling only;
- `peripheral-cues.ts` — authority-aware cue arbitration / cue derivation helpers;
- `peripheral-motion.test.ts` — geometry and motion-contract validation;
- `peripheral-motion-audit.test.ts` — explicit audit of which layers are FIXED / TRACK / TOGGLE;
- `PeripheralSignal.test.tsx` — initial-state, replay, and presentation-only behavior;
- `PeripheralSignal.replay.test.tsx` — same-event dedupe after transient absence;
- `peripheral-cues.test.ts` — truth/authority and arbitration tests;
- `PeripheralMotionLab.tsx` — visual inspection surface.

The lab is available at:

```text
?lab=peripheral
```

Use the lab before wiring any new cue into a live product surface.

---

## 3. Frozen implementation contract

Unless a task explicitly authorizes a new animation model, preserve these invariants:

1. **Logical stage is 160 × 96.**
2. **Each cue has exactly four discrete frames.**
3. **Frame 4 is the settled state.**
4. **No cue loops by default.**
5. **No autoplay of historical state on first mount.**
6. **A cue replays only when its stable domain `eventId` changes.**
7. **The same canonical event ID must not replay merely because it temporarily disappeared from props/state.**
8. **The SVG renderer is presentation-only and remains `aria-hidden`.** Semantic/accessibility feedback belongs in surrounding DOM state text or a status region.
9. **No animation may upgrade truth authority.** OBSERVED must never visually become PROVEN unless canonical authority says PROVEN.
10. **No new animation dependency is required.** This system uses React + SVG + the existing Instrument OS timing tokens.

Changing any of these is an architecture change, not a normal animation addition.

---

## 4. The three layer roles

Every visual layer must declare exactly one motion policy.

### FIXED

A structural anchor that must never change position between frames.

Examples:

- rail;
- receiver socket;
- verifier target;
- printer body;
- dock;
- mast;
- slot markers;
- barrier/wall.

Use:

```ts
policy: {kind: 'fixed'}
```

A fixed layer may not drift even one logical pixel.

If visibility legitimately changes but its position must remain anchored, use:

```ts
policy: {kind: 'fixed', visibilityMayChange: true}
```

Do not use this to avoid declaring a TOGGLE.

### TRACK

A layer that physically travels between frames.

Examples:

- received packet;
- evidence square;
- Next Move pointer;
- verifier scan line;
- Ship package;
- receipt paper.

Use:

```ts
policy: {
  kind: 'track',
  axis: 'x',
  direction: 'increasing',
  minTravel: 60,
  maxOrthogonalDrift: 0,
}
```

Declare the intended axis and direction. Orthogonal drift should normally be `0`.

A TRACK should represent one clear physical action, not wandering or easing around the stage.

### TOGGLE

A layer whose position is fixed but whose visibility changes between frames.

Examples:

- radio arcs appearing one by one;
- impact mark;
- verification check;
- proof rays;
- stale hollow mark;
- unavailable slash.

Use:

```ts
policy: {kind: 'toggle'}
```

TOGGLE layers must not move. Only visibility changes.

---

## 5. How to design a new cue

Use this sequence every time.

### Step A — start from semantics, not artwork

Write one sentence:

```text
WHEN <canonical event/state change> happens,
SHOW <one tiny mechanism> changing,
BECAUSE it communicates <specific user-relevant fact>.
```

Example:

```text
WHEN a new source observation arrives,
SHOW a packet moving toward the receiver,
BECAUSE a canonical external signal entered the Inkubator.
```

If you cannot write that sentence clearly, do not animate it yet.

### Step B — assign truth authority

Choose one:

- `CONTEXT`
- `STATUS`
- `CLAIMED`
- `OBSERVED`
- `PROVEN`
- `UNKNOWN`

The visual tone must not exceed that authority.

Canonical color language:

```text
ink / white     structural geometry
violet          context / advisory / claim
cyan            observed / live evidence
orange          attention / request for action
coral           blocked / failed
acid green      PROVEN only
muted gray      stale / unavailable / unknown
```

**Green is scarce.**

A verifier returning PASS is still an observed verifier result unless the acceptance boundary separately establishes PROVEN.

### Step C — sketch the four frames

Keep the composition nearly identical.

Preferred pattern:

```text
F1     rest / incoming state
F2     first mechanical change
F3     second mechanical change
F4     stable settled result
```

Do not create four unrelated illustrations.

### Step D — identify every layer

For every primitive, ask:

```text
Should this object physically translate?
```

- no movement → FIXED;
- appears/disappears only → TOGGLE;
- changes position → TRACK.

If unsure, default to FIXED.

Motion is the exception.

### Step E — add geometry to `peripheral-motion.ts`

Use the existing primitive helpers and frame helpers instead of hand-rolling renderer state.

Useful helpers include:

```ts
SAME(...)
VIS(...)
TRACK_X(...)
TRACK_Y(...)
```

Example shape:

```ts
{
  cue: 'SOURCE_RX',
  label: 'SOURCE RX',
  authority: 'OBSERVED',
  tone: 'observed',
  durationMs: ms(MOTION_SECONDS.signal),
  layers: [
    line('rail', 30, 52, 112, 52, 'ink', SAME(0, 0), {kind: 'fixed'}),
    path('receiver', 'M124 34h8v36h-8', 'ink'),
    dot(
      'packet',
      0,
      0,
      4,
      'observed',
      TRACK_X([32, 58, 86, 112], 52),
      {
        kind: 'track',
        axis: 'x',
        direction: 'increasing',
        minTravel: 70,
        maxOrthogonalDrift: 0,
      },
    ),
  ],
}
```

### Step F — update the explicit motion-role audit

`peripheral-motion-audit.test.ts` intentionally repeats the expected role assignment.

That duplication is deliberate.

If a layer changes from FIXED to TRACK, the agent must consciously modify the audit. A casual geometry edit should not silently change what is allowed to move.

### Step G — inspect with debug tracks

Open the Peripheral Motion Lab with debug geometry enabled.

Look for:

- static anchors staying perfectly still;
- moving elements following the declared path;
- no one-pixel wobble;
- no unexplained diagonal travel;
- no overlap that makes the machine unreadable;
- final-frame composition remaining legible without motion;
- no movement elsewhere on screen that competes with the cue.

The debug overlay exists to catch mistakes that are visually easy to miss at normal playback speed.

### Step H — connect it to a real event only after the lab passes

A live component should receive a stable canonical event identifier:

```tsx
<PeripheralSignal
  cue="SOURCE_RX"
  eventId={observation.observation_id}
/>
```

Do **not** use:

```ts
Date.now()
Math.random()
renderCounter
pollSequence
componentMountCount
```

Those values describe UI lifecycle, not domain events, and can create fake animation.

---

## 6. Timing

Use existing Instrument OS tokens from `motion-tokens.ts`.

Do not introduce arbitrary numbers because an animation "feels about right".

Current vocabulary includes:

```text
SNAP        ~70 ms
SWITCH      ~120 ms
RELAY       ~180 ms
MECHANICAL  ~240 ms
SIGNAL      ~380 ms
MODE        ~480 ms
CEREMONY    ~900 ms
```

Choose the smallest timing class that communicates the change.

Examples:

```text
packet received        SIGNAL
barrier impact         MECHANICAL
Next Move relocation   MODE
proof acceptance       CEREMONY
```

The four frames divide the selected duration. These are discrete machine states, not fluid tweened character animation.

---

## 7. Current cue semantics

Treat these meanings as contracts unless product semantics change explicitly.

| Cue | Intended meaning | Moving asset |
| --- | --- | --- |
| `SOURCE_LINK` | source/repository link state | none; arcs toggle |
| `SOURCE_RX` | new canonical source observation received | packet |
| `OBSERVED` | evidence captured into trusted observation boundary | evidence square |
| `NEXT_MOVE_CHANGED` | canonical/advisory Next Move changed | pointer |
| `MISSION_BLOCKED` | flow reached a blocker | packet; barrier fixed |
| `HELP_BEACON` | Help Beacon opened/active | none; beacon arcs toggle |
| `VERIFYING` | verifier is actively inspecting | scan line |
| `VERIFY_PASS` | verifier returned PASS at OBSERVED authority | none; check toggles |
| `SHIP_SUBMITTED` | Ship submission exists / claimed | package |
| `SHIP_PROVEN` | canonical acceptance established PROVEN | none; proof marks toggle |
| `RECEIPT` | immutable accepted-Ship receipt exists | paper |
| `STALE` | previously available signal is no longer current | none; signal marks disappear |
| `UNAVAILABLE` | source/verifier is unavailable; absence is not failure | none; signal marks disappear + slash |

Do not repurpose a cue because its icon looks convenient.

If the semantic meaning changes, change the cue contract and tests explicitly.

---

## 8. Replay semantics

`PeripheralSignal` deliberately renders frame 4 on initial mount.

This prevents navigation or remounting from replaying historical events as though they just happened.

The lifecycle is:

```text
INITIAL RENDER
  ↓
settled frame 4
  ↓
new stable eventId arrives
  ↓
frame 1 → frame 2 → frame 3 → frame 4
  ↓
freeze
```

If the same `eventId` is supplied again, do nothing.

This is a truth boundary, not just an animation preference.

---

## 9. Cue arbitration

Several backend facts can change during the same polling/refetch cycle.

Do not fire every animation simultaneously.

The intended flow is:

```text
canonical projection
      ↓
projection diff / domain events
      ↓
typed peripheral cues
      ↓
authority checks
      ↓
priority / dedupe / coalescing
      ↓
one principal explanatory cue
      ↓
PeripheralSignal
```

Prefer the cue that best explains the user's next decision.

A source update that also causes several derived UI changes should not produce a carnival of RX + gate + sheen + pointer + verifier + mascot motion.

Restraint is part of the system.

---

## 10. Accessibility

The peripheral graphic is always presentation-only.

Keep:

```tsx
role="presentation"
aria-hidden="true"
```

Do not put semantic state into the SVG's accessible name.

Expose the same fact in normal UI text or a status region when an announcement is appropriate:

```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  GitHub source observation received.
</div>
```

Respect `prefers-reduced-motion`.

Reduced motion should show the settled result rather than removing the state information.

---

## 11. Aesthetic rules

### Do

- preserve lots of negative space;
- use one mechanism per cue;
- keep structural geometry fixed;
- make motion discrete and readable frame-by-frame;
- let the final static frame tell the truth by itself;
- use symbols with obvious mechanical causality;
- keep REKT as the visual anchor, mostly static;
- use color as redundant semantic information, not the sole carrier of meaning.

### Do not

- add particles;
- add ambient orbiting objects;
- make every state pulse;
- animate borders for decoration;
- use continuous looping unless the real state is truly continuous and a task explicitly authorizes it;
- make mascot body motion the default feedback mechanism;
- introduce CRT distortion into the primitive itself;
- use green for success-ish vibes;
- turn UNKNOWN/STALE/UNAVAILABLE into dramatic failure animation;
- animate multiple unrelated objects merely to make the screen feel busy;
- invent a new timing number instead of using the existing motion vocabulary.

A useful test:

> If the animation still looks exciting after removing its semantic label, it may be doing too much.

---

## 12. Placement-quality checklist

Before committing a cue, inspect all four frames and answer YES to every item:

```text
[ ] Every visible layer has an explicit motion role.
[ ] Every FIXED layer has identical x/y coordinates in all frames.
[ ] Every TOGGLE layer has identical x/y coordinates in all frames.
[ ] Every TRACK moves only on its declared axis.
[ ] Every TRACK obeys its declared direction.
[ ] Orthogonal drift is within the declared tolerance (normally zero).
[ ] Track travel is large enough to be intentional and legible.
[ ] No measurable primitive leaves the 160×96 stage.
[ ] Frame 4 is a valid settled state.
[ ] Initial mount does not replay the cue.
[ ] A repeated canonical event ID does not replay the cue.
[ ] The cue authority does not exceed backend authority.
[ ] PROVEN visuals can only be reached through PROVEN authority.
[ ] The sprite remains aria-hidden / presentation-only.
[ ] Reduced-motion users still receive the correct settled state.
[ ] No second animation nearby competes with this cue.
```

---

## 13. Required verification

Use the repository-pinned toolchain:

```text
Node 24.20.x
npm 11.19.x
```

At minimum, after changing this subsystem run:

```bash
npm test -w @rekt-ink/inkubator-lab
npm run build:inkubator
npm run verify:inkubator-signal-system
```

For a motion-only change, the relevant automated protection includes:

```text
peripheral-motion.test.ts
peripheral-motion-audit.test.ts
PeripheralSignal.test.tsx
PeripheralSignal.replay.test.tsx
peripheral-cues.test.ts
```

Do not weaken a failing invariant to make the tests green. Fix the animation definition unless the task explicitly changes the invariant.

---

## 14. Agent workflow

For a new agent entering this subsystem, use:

```text
PLAN
  identify the canonical event and authority ceiling
  identify exactly one mechanism that should respond
  classify all layers before coding

CHANGESET
  add/modify the cue in peripheral-motion.ts
  update the explicit role audit
  update cue derivation/arbitration only if semantics require it
  keep diff small

VERIFY
  run motion-contract tests
  inspect all four frames in ?lab=peripheral with debug paths
  verify initial mount + replay dedupe
  run Inkubator tests/build/signal verification

VERDICT
  PASS only if moving objects move intentionally,
  fixed objects stay pixel-stable,
  and the visual authority exactly matches canonical truth
```

Do not merge from this workflow without explicit merge authority.

---

## 15. Decision rule for adding an animation

Before adding anything permanent, ask:

```text
Does this motion communicate a real state/input/progress/causal transition
that would be harder to understand without it?
```

If **yes**, implement the smallest four-frame mechanism that explains it.

If **no**, keep the screen still.

That silence is intentional. It is part of the REKT Instrument OS aesthetic.
