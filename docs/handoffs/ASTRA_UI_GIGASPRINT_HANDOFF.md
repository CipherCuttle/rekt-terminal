# Astra UI gigasprint handoff

Status: READY_FOR_USER_VISUAL_GATE. Astra's coherent PLAYER calibration and Luna's bounded regression continuation are complete; no Critical/High defects remain.

## Revisions and location

STARTING SHA: `83fcc77c423b4b3823cc7838c0e2a5b7b2d1b6f9`
ENDING SHA: `5e58f41` (Luna continuation; implementation/artifact checkpoint remains `6006327`).
BRANCH: `agent/instrument-v2-mascot-purpose-pass-v0`
WORKTREE: `/home/swirky/DevHub/worktrees/rekt-mascot-purpose`

COMMITS CREATED:

- `79df846` — purpose-bound PLAYER history, supplied mascot, responsive composition, tests.
- `6006327` — complete refreshed static calibration artifact.
- `61501bf` — Astra handoff and hostile review record.
- `5e58f41` — Luna continuation: close responsive, keyboard and mobile axe regressions.

Original worktree remains clean at `/home/swirky/DevHub/worktrees/rekt-command-v11`, branch
`experiment/world-composition-lab-v1`, SHA `68b2b29`. No user WIP was changed,
stashed or discarded. Nothing was pushed, merged or deployed.

## What was implemented

Route: `?lab=instrument-v2`.

One dominant black builder-history display on a warm white chassis. Eight clearly
labelled chronological fixture events; selectable provenance inspector; timestamps,
source/reference, owning-surface context, ordinary-state/truth distinctions and
supporting evidence disclosure. Earned rows select and focus their history record.

Desktop inspector sits beside history. Widths through 950px use inline provenance
under the selected event and bottom section navigation. Tab/Enter and
Up/Down/Home/End work. Empty, stale, unavailable and unsupported scenarios are
distinct; unavailable/unsupported withhold all records and earned evidence.

Removed swordfish SVG, unsourced network/waveform/uptime diagnostics, fake wallet/
search controls, discussion scores, inert navigation, and three accumulated CSS
override files. One scoped stylesheet now owns V2. Retired files remain recoverable
in git history. Small primitives: PrintedHeader, DisplayWell, TruthLabel,
ThreadInstrument/ProvenanceInspector and RektMascot.

GSAP animates a heading for 160ms only when user selection changes. No timer,
hydration, ambient activity or proof ceremony. Reduced motion disables it.
CRT is an optional local scanline layer. No dependencies changed.

The inherited tracked `inkubator/` preview was fully regenerated and committed
separately despite its general ignore rule, matching the calibration parent's
artifact workflow. Do not leave partially regenerated tracked assets.

Purpose audit: `docs/inkubator/BUILDER_HISTORY_CALIBRATION_V0.md`.
Review: `docs/handoffs/ASTRA_UI_GIGASPRINT_REVIEW.md`.

## Visual decisions frozen / DO NOT REOPEN

- Supplied pixel mascot only. No fish, substitute creature, recoloring or lore.
- Warm white chassis, black evidence display, sparse orange control/focus.
- PLAYER means durable builder history, not engagement, wallet or telemetry.
- Thread means sequence here, not measured distance, causal strength or progress.
- CLAIMED ≠ OBSERVED ≠ PROVEN. CONNECTED/SUBMITTED remain operational states.
- Acid green only for PROVEN. Fixtures never represent production activity.
- Mobile/tablet recomposition is intentional; meaning survives motion and CRT off.
- No new renderer, global state library or animation framework.
- No production Player/Ship routes or backend/client capability expansion.

## Mascot implementation status

COMPLETE. Original supplied PNG copied intact to:
`apps/inkubator-lab/public/assets/rekt-mascot.png`.

Original: `/home/swirky/Downloads/31f2f2c6-06cd-4821-8463-f2974b041249.png`.
Both SHA-256 hashes:
`a487ddab6f6e877b8a4663b9bf758043a6e45a22716c1241c5d385aff40453c5`.

Full silhouette centered in black mount using CSS; pixels unedited.
`RektMascot` supports `state="idle"` only and standard/compact sizes. Current caller
has no live state. Empty image alt keeps decorative pixels out of screen-reader
navigation. Asset failure produces neutral text; never another creature.

## Surface status

- PLAYER: complete fixture calibration; no production route or history operation.
- COMMAND: inspected existing projection/layout; production source unchanged; unit tests pass.
- PROJECT: inspected existing locus/provenance; production source unchanged; unit tests pass.
- WORLD: inspected existing implementation; source unchanged. Legacy radar remains an existing compliance gap.
- SHIP: labelled submission/acceptance/receipt history examples only; no production route added.

## Screenshot paths

Ten committed PNGs in `apps/inkubator-lab/e2e/__screenshots__/`:

- `builder-history-1440.png`, `builder-history-raw-1440.png` — 1440×1000 viewport.
- `builder-history-1280.png`, `builder-history-raw-1280.png` — 1280×800.
- `builder-history-390.png`, `builder-history-raw-390.png` — 390×844.
- `builder-history-430.png`, `builder-history-raw-430.png` — 430×932.
- `builder-history-900.png`, `builder-history-raw-900.png` — 900×1000.

Full-document captures; raw captures select SUBMITTED with CRT off/reduced motion.
The fixed mobile bar remains at its viewport position in full-document captures.
Desktop/mobile passes were visually inspected. Supplementary final tablet capture:
`/tmp/rekt-purpose-tablet-final.png` (900×1000, may expire).

## Test/build results

Exact commands from repository root:

| Command | Result |
| --- | --- |
| `npm ci` | PASS; existing lockfile; Node 24.20.0/npm 11.19.0 |
| `npm run typecheck -w @rekt-ink/inkubator-lab` | PASS |
| `npm run test -w @rekt-ink/inkubator-lab` | PASS: 11 files, 54 tests |
| `npm run verify:inkubator-signal-system` | PASS |
| `npm run build -w @rekt-ink/inkubator-lab` | PASS: TypeScript + Vite 7.0.0, 2865 modules, final build 2.64s |
| `npx playwright test -c apps/inkubator-lab/playwright.instrument-v2.config.ts` | PASS: 12 tests, including 900px visual baselines, mobile keyboard/provenance and mobile fail-closed axe checks |
| `git diff --check` | PASS |

Browser verification: ten visual comparisons, all five required viewports without
overflow, desktop and mobile axe scans with zero violations, keyboard/provenance/
owner links, five scenarios, missing art, reduced motion, existing ten-primitive
instrument lab.

Built preview at `http://127.0.0.1:5185/?lab=instrument-v2`, 900×1000:
no page errors, original image decoded, no overflow, inline inspector and selected
receipt visible. Started from app directory:
`npx vite preview --host 127.0.0.1 --port 5185`.

Initial new tests failed on text selectors (adjacent fixture text nodes and a
desktop-only subtitle in a mobile accessible name). Selectors fixed. The final run
compares all existing baselines, including the two newly generated 900px captures.

Existing non-fatal warnings: Pixi/jsdom canvas getContext in unit tests;
npm esbuild install-script notices; NO_COLOR/FORCE_COLOR in Playwright.
No unrelated failing tests found. Full backend/integration suite and real assistive-
technology screen-reader session were not run and are not claimed as passed.

## Review and known defects

ONE independent hostile review: no Critical/High findings.
Medium: cramped 761–900px layout. Fixed by stacking through 950px and enlarging
intermediate desktop labels. Low: literal inspector year. Fixed to read timestamp.
Final build/browser checks pass after both fixes. No targeted re-review required.

No known unfinished visual defects in the delivered unit. This remains a single-
project fixture, not runtime validation or a production history projection. Owner
links open explanatory local context rather than fictional production objects.
Other production surfaces retain their pre-existing limitations.

## Luna continuation

Luna completed the three bounded regression tasks listed for continuation:

- Added 900×1000 to the responsive visual loop, aligned the inline inspector
  assertion with the CSS stacking breakpoint (`width <= 950`), and committed the
  two new 900px cathode/raw baselines.
- Added a 390px keyboard regression covering Work observed → ArrowDown → End →
  Home, selected provenance, focus retention and the hidden desktop inspector.
- Added 390px axe checks for unavailable/unsupported scenarios and verified that
  returning to Recorded history restores the selected Work observed provenance.

No production runtime adapter, backend operation, generated client type or route
was added. The remaining gate is user visual approval of the committed captures.

## Exact continuation commands

```sh
cd /home/swirky/DevHub/worktrees/rekt-mascot-purpose
git status --short
git branch --show-current
git log -3 --oneline
npm ci
npm run typecheck -w @rekt-ink/inkubator-lab
npm run test -w @rekt-ink/inkubator-lab
npm run verify:inkubator-signal-system
npx playwright test -c apps/inkubator-lab/playwright.instrument-v2.config.ts
npm run build -w @rekt-ink/inkubator-lab
git diff --check
npm run dev -w @rekt-ink/inkubator-lab -- --port 5184
```

Open `http://127.0.0.1:5184/?lab=instrument-v2`.
Reference overlay remains available via `&calibrate=1`.

For new tablet baselines only, from app directory:
```sh
npx playwright test -c playwright.instrument-v2.config.ts -g '900' --update-snapshots
npx playwright test -c playwright.instrument-v2.config.ts
```

Do not blindly update approved baselines. No push/merge/deployment implied.

## Exact files changed

Status vs starting parent, without rename compaction. Generated hash changes are
Vite output, not manual backend edits. This handoff is added by final docs commit.

```text
A	apps/inkubator-lab/e2e/__screenshots__/builder-history-1280.png
A	apps/inkubator-lab/e2e/__screenshots__/builder-history-1440.png
A	apps/inkubator-lab/e2e/__screenshots__/builder-history-390.png
A	apps/inkubator-lab/e2e/__screenshots__/builder-history-430.png
A	apps/inkubator-lab/e2e/__screenshots__/builder-history-raw-1280.png
A	apps/inkubator-lab/e2e/__screenshots__/builder-history-raw-1440.png
A	apps/inkubator-lab/e2e/__screenshots__/builder-history-raw-390.png
A	apps/inkubator-lab/e2e/__screenshots__/builder-history-raw-430.png
A	apps/inkubator-lab/e2e/instrument-v2.spec.ts
A	apps/inkubator-lab/playwright.instrument-v2.config.ts
A	apps/inkubator-lab/public/assets/README.md
A	apps/inkubator-lab/public/assets/rekt-mascot.png
M	apps/inkubator-lab/src/instrument-v2/InstrumentV2Lab.tsx
A	apps/inkubator-lab/src/instrument-v2/RektMascot.tsx
A	apps/inkubator-lab/src/instrument-v2/ThreadInstrument.tsx
A	apps/inkubator-lab/src/instrument-v2/history-fixture.ts
D	apps/inkubator-lab/src/instrument-v2/instrument-v2-calibration-pass2.css
D	apps/inkubator-lab/src/instrument-v2/instrument-v2-calibration-pass3.css
D	apps/inkubator-lab/src/instrument-v2/instrument-v2-calibration.css
M	apps/inkubator-lab/src/instrument-v2/instrument-v2.css
A	apps/inkubator-lab/src/instrument-v2/primitives.tsx
M	apps/inkubator-lab/src/main.tsx
A	docs/handoffs/ASTRA_UI_GIGASPRINT_REVIEW.md
A	docs/inkubator/BUILDER_HISTORY_CALIBRATION_V0.md
M	docs/inkubator/REKT_INSTRUMENT_OS_V2.md
A	inkubator/assets/AppV3-BSork5f_.js
D	inkubator/assets/AppV3-CX3Y3Pvg.js
D	inkubator/assets/BufferResource-6gKFwOS6.js
A	inkubator/assets/BufferResource-DkWWvB_u.js
A	inkubator/assets/CanvasPool-BorzMOxS.js
D	inkubator/assets/CanvasPool-CDZe7RRh.js
D	inkubator/assets/CanvasRenderer-BDuzSCme.js
A	inkubator/assets/CanvasRenderer-aCB8Sja1.js
D	inkubator/assets/Filter-Be-whcHq.js
A	inkubator/assets/Filter-CRGSJb7F.js
A	inkubator/assets/GoldenScreens-CHtjAfBC.js
D	inkubator/assets/GoldenScreens-he9Y-gSM.js
A	inkubator/assets/InstrumentLab-BqKaBUv0.js
D	inkubator/assets/InstrumentLab-CStTuEgy.css
D	inkubator/assets/InstrumentLab-f_lf8uqs.js
A	inkubator/assets/InstrumentV2Lab-B4PLx6DT.js
A	inkubator/assets/InstrumentV2Lab-bWS5cyWS.css
A	inkubator/assets/LiveCommand-CNXVVADl.css
A	inkubator/assets/LiveCommand-Ds8x-4V3.js
A	inkubator/assets/LiveProject-BjkZu9VO.js
A	inkubator/assets/LiveProject-XLZg7hui.css
A	inkubator/assets/LiveWorld-BdlB4X3L.js
A	inkubator/assets/LiveWorld-lGrsU-xN.css
A	inkubator/assets/README.md
A	inkubator/assets/RenderTargetSystem-DD-5KKdd.js
D	inkubator/assets/RenderTargetSystem-o5zip3xn.js
D	inkubator/assets/WebGLRenderer-B8-88ZuB.js
A	inkubator/assets/WebGLRenderer-Cq7mdK1X.js
A	inkubator/assets/WebGPURenderer-BsSaAeSP.js
D	inkubator/assets/WebGPURenderer-DhyQ_xc2.js
A	inkubator/assets/browserAll-BWqj6r38.js
D	inkubator/assets/browserAll-DmQZ1AuQ.js
D	inkubator/assets/canvasUtils-B4fbAiXG.js
A	inkubator/assets/canvasUtils-BbEaV_Tm.js
A	inkubator/assets/index-Bl_lQLcg.js
D	inkubator/assets/index-CjRRRTz1.js
A	inkubator/assets/index-QzjfNoUG.js
A	inkubator/assets/inkubator-api-DFnfbRis.js
A	inkubator/assets/instrument-os-CStTuEgy.css
A	inkubator/assets/motion-tokens-57m1jz1C.js
A	inkubator/assets/rekt-mascot.png
D	inkubator/assets/webworkerAll-BHQS5b9r.js
A	inkubator/assets/webworkerAll-BW5WiZdR.js
M	inkubator/index.html
A	docs/handoffs/ASTRA_UI_GIGASPRINT_HANDOFF.md
```
