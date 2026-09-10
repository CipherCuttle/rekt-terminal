# Instrument Motion Lab v0.1

Purpose: recover and test a small, deterministic motion grammar before integrating any mascot animation into production REKT Inkubator screens.

Frozen constraints:

- Logical viewport is 320x150.
- Neutral and REKT canvases share the same motion sample function.
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
6. Use 0.25x / 0.5x playback to inspect starts, stops, reversals and scrubbing.
7. Record measurements outside the skin code, then replace provisional constants in the shared motion kernel only when supported by evidence.

The current 2400 ms period and easing curve are intentionally provisional. V0.1 provides the measuring surface; it does not claim OP-1 parity yet.

Next evidence step: collect repeatable measurements for tape reel angular velocity, transport trajectory, start/stop latency, reverse response, cadence and any stepped animation behavior. Freeze those measurements as fixtures before adding Chibi or AppleInu skins.
