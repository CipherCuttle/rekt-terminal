# Builder history calibration v0

User-authorized frontend sprint, 2026-09-09. Parent: `83fcc77`.
Route: `?lab=instrument-v2`. This is a calibration, not a production PLAYER route.

## Purpose decisions

| Element | Owner / question | Source / truth | Encoding / motion |
| --- | --- | --- | --- |
| Builder heading and identity | PLAYER: whose history is this? | Explicit example identity | Chassis print; static |
| Mascot mount | SHELL: REKT identity | Original supplied artwork; neutral idle | Black material mount; static |
| Build history | PLAYER: what did this builder do? | `HISTORY_FIXTURE`, eight declared examples | Ordered list and sequence line; no time-distance scale or causal inference |
| Record count | PLAYER: how many records are shown? | Visible array length | Ordinary count; no performance metric |
| Truth labels | Respective event owner: what authority is represented? | Literal fixture truth/operational state | Text + mark + color; no inferred promotion |
| Provenance inspector | PLAYER quoting owner context: what supports this record? | Selected example source, UTC timestamp and reference | DOM details; 160ms selection response only |
| Earned evidence | PLAYER: what was earned and why? | Two explicitly simulated evidence-linked examples | White rows linking to matching history event; no award evaluation |
| Ownership disclosure | SHELL: which surface owns this context? | Frozen Surface Purpose V1 | Local anchor into an explanatory disclosure |
| Fixture/CRT controls | Calibration: which state/material is under inspection? | Local presentation state | Native controls; never mutate domain data |
| Seams and registration marks | Materiality / hierarchy | No data | Static, no meter or activity meaning |

## Boundaries

- No backend, generated client, query, domain reducer or production route changes.
- No complete Player history operation is claimed. `HistoryEvent` is a local
  fixture type, not a universal DTO or a production adapter.
- CLAIMED, OBSERVED and PROVEN retain their separate meanings. CONNECTED and
  SUBMITTED are ordinary operational states; the shared label primitive does not
  introduce a global domain lifecycle.
- Acceptance examples include explicit fixture receipt/evidence references. The
  Cheevo example describes a versioned backend award, but executes no award rule.
- Empty, stale, unavailable and unsupported are separate selectable scenarios.
  Unsupported/unavailable withhold all records and earned evidence. Stale retains
  historical evidence with an explicit stale warning on history and earned rows.
- An owning-surface link opens local purpose context, not a fictional object's
  production route. No production PLAYER/SHIP route is introduced.
- No initial-load animation, polling effect, ambient activity, or proof ceremony.
  GSAP only responds to changing the selection; reduced motion disables it.
- Desktop places provenance beside history. Mobile places it under the selected
  event. Only the displayed inspector participates in the accessibility tree.
- Tab/Enter and Up/Down/Home/End navigate ordinary event buttons. Earned rows
  select and focus their corresponding record. Dragging is never required.
- The shader-free, CRT-off interface carries all meaning in semantic DOM.

## Implementation decisions

The three inherited calibration override stylesheets were removed, together with
all rejected diagnostic geometry. One scoped stylesheet now owns V2 composition.
Production CSS and production COMMAND/PROJECT/WORLD implementations are unchanged.
The original supplied mascot is copied intact; see its asset README and checksum.
No dependencies were added or changed. `npm ci` installs the existing lockfile.

## Verification

Run from the repository root:

```sh
npm ci
npm run typecheck -w @rekt-ink/inkubator-lab
npm run test -w @rekt-ink/inkubator-lab
npm run verify:inkubator-signal-system
npm run build -w @rekt-ink/inkubator-lab
```

Run from `apps/inkubator-lab`:

```sh
npx playwright test -c playwright.instrument-v2.config.ts
```

The dedicated config uses port 5184 to preserve other worktree previews. Eight
visual baselines cover 1440×1000, 1280×800, 390×844 and 430×932, with cathode and
CRT-off/reduced-motion compositions. The test suite also covers keyboard/owning
context, state boundaries, missing art and the pre-existing ten-primitive lab.
