# Instrument Motion Lab v0.2

Purpose: recover and test a small, deterministic motion grammar before integrating any mascot animation into production REKT Inkubator screens.

Frozen constraints:

- Logical viewport is 320x150.
- Neutral and REKT canvases share the same motion sample function and tape geometry.
- Skin code may change artwork only, not timing or trajectory constants.
- No unseeded randomness.
- Persistent motion must represent state, transport, progress, causality, or affordance.
- The lab is experimental and must remain isolated from production terminal semantics until a scene passes visual/reference review.
- Reference footage is operator-supplied and local-only. Do not commit or bundle Teenage Engineering footage or extracted OP-1 artwork.

Current scene: a transport/tape grammar proof using paired reel rotation, a bounded transport path, and a REKT actor rendered over the same trajectory.

## Reference analysis workflow

Open the web app with `?motionLab=1`, then:

1. Load a locally stored, tightly cropped capture of the OP-1 display.
2. Set the capture FPS to the source frame rate.
3. Use `-1 FRAME` / `+1 FRAME` to inspect motion frame-by-frame.
4. Adjust `MOTION OFFSET MS` to align the provisional motion clock with the reference event boundary.
5. Adjust overlay opacity and compare the neutral geometry against the reference.
6. Select a landmark (`transport`, reel centers, or spoke tips), turn `MARK` on, and click the observed point in the reference frame.
7. Repeat across frames. The lab compares every captured point with the predicted point from the shared motion kernel and reports per-point error plus overall RMSE in logical-display pixels.
8. Use 0.25x / 0.5x playback to inspect starts, stops, reversals and scrubbing.
9. Export a `REKT_INSTRUMENT_MOTION_MEASUREMENTS_V1` JSON receipt when a useful measurement set has been captured.
10. Replace provisional motion constants only when the measurements support the change; never tune the REKT skin separately.

Reference and predicted landmarks are intentionally simple: a circle marks the observed reference point and an X marks the model prediction. Changing `MOTION OFFSET MS` recomputes existing errors, which makes temporal alignment measurable instead of purely visual.

Preferred source material:

- Teenage Engineering official OP-1 tape-mode training video (2013): https://www.youtube.com/watch?v=JLDP40_ZiI4
- Teenage Engineering original OP-1 tape guide: https://teenage.engineering/guides/op-1/original/tape-mode

Treat those as observation sources only. Do not redistribute their footage or artwork from this repository.

The current 2400 ms period and easing curve are intentionally provisional. V0.2 provides the measuring surface; it does not claim OP-1 parity yet.

## Evidence gate before new skins

Do not add Chibi or AppleInu motion variants yet. First capture enough independent tape observations to estimate at least:

- reel-center geometry;
- reel angular velocity/cadence;
- transport trajectory;
- start/stop response;
- reverse response;
- any visible frame quantization or stepped animation behavior.

Freeze the resulting measurements as fixtures/receipts. Only then replace provisional constants and re-run the same neutral-vs-reference comparison. The skin expansion gate opens when the neutral model is evidence-backed and the remaining visual error is understood rather than eyeballed.
