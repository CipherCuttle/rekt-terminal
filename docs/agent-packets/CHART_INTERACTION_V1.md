# CHART_INTERACTION_V1

Status: `ACTIVE / AUTHORIZED / BOUNDED_PRESENTATION_ONLY`

## Identity
- Phase: `CHART_INTERACTION_V1`
- Canonical base SHA: `207d66b1036fb18f09d9888771a338fc8b4d634d`
- Objective: make the primary trading chart feel fluid under mouse/touch interaction while keeping dense simulator execution annotations readable through truth-preserving semantic zoom.
- Authorized paths: `apps/web/src/lib/chart.ts`, `apps/web/src/lib/chart-marker-lod.ts`, `apps/web/src/terminal/TerminalScreen.tsx`, `apps/web/src/chart-interaction.css`, `apps/web/src/main.tsx`, chart-specific tests, and this packet.
- Forbidden paths: `packages/sim/**`, `packages/career/**`, market/provider normalization, persistence contracts, API semantics, provenance contracts, wallet/execution surfaces.

## Frozen visual/product brief
- Keep TradingView Lightweight Charts as the primary chart.
- Preserve existing terminal visual language; this is interaction refinement, not a terminal redesign.
- Close zoom: exact fill marker price and full BUY/SELL label.
- Medium zoom: exact fill marker price with compact B/S label.
- Far zoom: time-bucket count clusters only; never invent an aggregate execution price.
- Right-side whitespace is navigation chrome and must not count as visible market bars for marker LOD.
- LOD transitions use hysteresis but must resolve direct multi-tier resize/programmatic jumps in one update.
- User panning away from the latest bar must not be forcibly snapped back; expose an explicit `RETURN TO LIVE` action.
- STOP remains explicit at every zoom. ENTRY line remains; ENTRY text may collapse outside DETAIL.

## Required fixture state
- Existing deterministic browser/demo market fixtures.
- Simulator event history containing multiple BUY and SELL fills in one trade cycle.

## Acceptance criteria
- Default recent view opens in DETAIL rather than being collapsed by right-side whitespace.
- Repeated zoom in/out deterministically restores every exact fill.
- DETAIL and COMPACT preserve exact execution-price anchoring.
- CLUSTER never asserts one synthetic/average execution price.
- Large direct zoom/responsive jumps land in the correct final LOD without requiring a second interaction.
- Panning away exposes `RETURN TO LIVE`; incoming ticks continue without changing simulator truth.
- No market, simulator, Career, provenance, or persistence semantics change.

## Performance gates
- Market ticks continue through the existing imperative chart sink; no tick-by-tick React state path is introduced.
- LOD rerenders occur only on visible-range tier/projection changes, not every incoming tick.

## Accessibility gates
- `RETURN TO LIVE` is a real keyboard-focusable button with visible focus inherited from the terminal shell.
- Interaction behavior remains usable with mouse wheel, pointer drag, and touch pinch/drag.

## Visual evidence
- Browser/Vercel preview is the required manual visual surface for this phase.
- User accepted the interaction direction after testing the live preview before merge authorization.

## Allowed dependencies
- Existing `lightweight-charts` only. No new runtime dependency.

## Forbidden changes
- no data-contract changes
- no provenance weakening
- no simulator/Career economic changes
- no fabricated interpolated market observations
- no replacement of Lightweight Charts
- no indicators/drawing-tool expansion

## Review / completion policy
`IMPLEMENT -> TEST -> ONE independent hostile review -> fix Critical/High -> ONE targeted re-review only if Critical/High fixes were needed -> COMMIT -> MOVE FORWARD`.

The independent review produced one P1 authority finding and two P2 interaction findings. The P1 is repaired by this packet. The P2 findings are repaired because they directly undermine the stated chart readability/semantic-zoom objective. No broader review loop is authorized.

## Stop condition
Stop when the bounded repair passes repository CI and one targeted re-review confirms no remaining Critical/High finding. Do not expand scope.

## Completion report
- CHANGESET: adaptive marker LOD, fluid pan/scale controls, explicit realtime return, review repairs.
- VERIFY: repository CI plus targeted re-review after P1 repair.
- DEVIATIONS: none from frozen economic/provenance contracts.
- VERDICT: `CANDIDATE` until targeted re-review and merge.
