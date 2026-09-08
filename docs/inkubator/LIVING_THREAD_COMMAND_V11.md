# Living Thread COMMAND v11 — bounded local direction

User-authorized local art-direction increment, 2026-09-08. Base: b4f3a1ff7228759127154a748a6bc65eb6690c7f. Visual baseline: prototypes/thread-command-v0/index.html at a9b0df98b0d47980b91baeaf8ea7e27c462e8470.

For COMMAND only, this brief supersedes the chassis, ratchet, micro-readout density and mono-first composition in REKT_INSTRUMENT_OS_V1.md and its calibration receipt. Preserve the prototype's Mission → floating Thread → NOW → Next Move hierarchy and negative space. This narrows the frontend increment; no product, backend, economics, trust or other mode changes.

CommandView, generated API client, TanStack Query, diffCommandProjection and GSAP remain. HELP uses the existing public help-loop projection, joined by project ID, never advisory text. Ship proof requires canonical SHIPPED plus a PROVEN Shipability gate, never participant SHIP_READY. Source reception requires current available evidence. Private command data stays on the authenticated command surface. No mutation endpoint is invoked by the visual preview.

The old synthetic numeric Pixi trace is replaced with a small SVG observation mark and the actual latest observation kind/outcome/time. Pixi remains installed for existing retained renderers elsewhere. No canonical sprite sheet or bundled fonts exist: use a marked 28px sprite slot and system sans/mono. Native details expose provenance and advisory content.

## Implementation and verification receipt

Three deliberate passes completed:
1. Composition — Mission, floating Thread, NOW, one Next Move, negative space; captured pass1-1440.png.
2. Craft — measured SVG rail geometry, shallow detents, matched sockets, system sans hierarchy, factual trace and 28px sprite boundary; captured pass2-1440.png and pass2-390.png.
3. Causal motion — GSAP event choreography, local break/beacon/proof, quiet idle, accessible persistent truth; final desktop/mobile states and RX video.

All commands below ran from the candidate unless noted, using:
`export PATH=/home/swirky/.nvm/versions/node/v24.20.0/bin:$PATH`

| Exact command | Result |
| --- | --- |
| `source /home/swirky/.nvm/nvm.sh && nvm install 24.20.0` | Installed canonical Node 24.20.0 / npm 11.19.0 |
| `npm ci` | PASS; lockfile unchanged, 422 packages installed |
| `npx playwright install chromium` (lab workspace) | PASS; browser and FFmpeg installed |
| `npm run dev -w @rekt-ink/inkubator-lab -- --strictPort` | Serving 127.0.0.1:5174 |
| `npm run test -w @rekt-ink/inkubator-lab -- src/command/LiveCommand.test.tsx src/command/projection-delta.test.ts` | PASS; 9 focused tests |
| `npm run test -w @rekt-ink/inkubator-lab` | PASS; 11 files, 45 tests |
| `npm run typecheck -w @rekt-ink/inkubator-lab` | PASS |
| `npm run build:inkubator` | PASS |
| `npm run test:e2e -w @rekt-ink/inkubator-lab -- e2e/live-command.spec.ts e2e/command-preview.spec.ts` | PASS; 10 tests after the hostile-review repair, including 20 state/viewport/motion combinations and a grayscale mobile truth-label regression; zero axe violations |
| `npm run typecheck` | PASS |
| `npm test` | PASS; 366 tests across canonical repository scripts |
| `npm run build` | PASS; core, Inkubator and devkit |
| `npm run verify:inkubator-api-client` | PASS after API build prerequisite |
| `node scripts/verify-inkubator-signal-system.mjs --dist` | PASS |
| `npm run verify` | Base failure at verify:inkubator-foundation; see below |
| `npm run verify:inkubator-foundation` (untouched base checkout) | Same failure and message |
| `npm exec -w @rekt-ink/inkubator-lab -- vite preview --host 127.0.0.1 --port 5175 --strictPort` | Production browser check PASS; preview query exposes zero controls/module requests; temporary server stopped |
| `git status --short`, `git diff --check`, `git diff --stat`, `git diff` | Intended source/test/receipt changes only; no whitespace errors |

The canonical verification failure is:
`Inkubator foundation invariant failed: build:core must be the canonical repository build contract`.
It reproduces on detached b4f3a1ff7228759127154a748a6bc65eb6690c7f at /tmp/rekt-command-v11-base-check. The failing script and package.json are byte-identical to the candidate. This is a known base failure, not a PASS. No CI repair was attempted.

During implementation, the first focused run still asserted the replaced project-title/Pixi layout; tests were updated to assert Mission hierarchy and factual SVG trace. Axe found and prompted repair of the preview landmark. Visual inspection found GSAP cleanup restoring an old REKT label; the persistent label is now React-owned and all five states are asserted. An initial preview type error and missing API build prerequisite were resolved before the final passing checks.

Production output was inspected before restoring this task's generated tracked build changes with `git restore --source=HEAD -- inkubator`. No generated output or dependency changes are part of the commit. The original worktree still reports only its two pre-existing untracked evidence files.

## Local evidence

Evidence directory: /tmp/rekt-command-v11-evidence

- pass1-1440.png
- pass2-1440.png, pass2-390.png
- final-{building,rx,blocked,help,proven}-{1440,390}.png
- final-{building,rx,blocked,help,proven}-{1440,390}-reduced.png
- video-final/page@670f186a2512a88b69a55b9d130e0b70.webm
- review-mobile-truth-grayscale.png
- lab-tests.log, lab-typecheck.log, lab-build.log, e2e.log
- root-tests.log, root-typecheck.log, root-build.log
- canonical-verify.log, base-foundation.log, api-client.log, signal-invariants.log

Desktop captures use a 1440×900 viewport. Mobile captures use a 390×844 viewport and save the full scrollable page. Native disclosure opens the supplied Next Move detail; it does not pretend to execute verifier jobs or open a receipt URL absent from CommandView.

Local preview:
`http://127.0.0.1:5174/?preview=command&state=building`
Replace building with rx, blocked, help or proven. Fixtures use synthetic observations and proof and are visibly labeled; no production credentials are required.

## Independent hostile review

Exactly one independent hostile review inspected the source changes, ten desktop/mobile state captures, reduced-motion HELP and canonical private projection mapping.

- Critical: none.
- High: mobile visually hid intermediate gate-state labels, leaving OBSERVED versus PROVEN distinguishable only by color. Repaired by restoring visible 10px labels, with a mixed-gate grayscale browser regression and axe check.
- Medium (deferred under the explicit Critical/High-only repair policy): switching mission IDs can replay the prior mission's semantic effect/footer because the delta sequence persists while the presentation component remounts. Canonical mission/proof state is unchanged.
- Low (deferred): mobile RX's longer Next Move wraps; its explanatory copy extends below the initial 844px viewport. The action remains prominent and the page scrolls without clipping/cards.

The review judged the final art direction deliberate, quiet product design that behaves like an instrument. No dashboard, fake shell, oversized mascot, fake metric, authority promotion, dependency addition or public-data boundary change was found.

Exactly one targeted re-review verified the High repair against CSS, regression assertions and the grayscale screenshot: PASS; Critical 0, High 0 remaining. Medium/Low remain deferred. No further review or aesthetic iteration performed.

Final local verdict: READY_FOR_LOCAL_VISUAL_REVIEW. SAFE_TO_MERGE=NO.

Development preview is isolated behind import.meta.env.DEV and visibly marked LOCAL PREVIEW / SYNTHETIC. Production build must exclude its module. Exactly three implementation passes, one independent hostile review, targeted re-review only for Critical/High repairs. Local commit only; no merge/push authority.
