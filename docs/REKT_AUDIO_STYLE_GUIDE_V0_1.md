# REKT Incubator — Audio Style Guide v0.1

## Sonic thesis

REKT should sound like a **small analog machine that happens to be a trading/incubation terminal**.

Not futuristic cinema. Not game-menu SFX. Not synthwave. Not a notification pack.

Target character:

**Teenage Engineering tactility × cassette transport × modular test equipment × slightly damaged laboratory electronics.**

The interface should feel as though every interaction physically actuates something behind the screen.

## Canonical reference DNA

### Mechanical reference

**Sony cassette recorder — click at ~00:31**

Reference source:
- https://freesound.org/people/ovejota/sounds/541643/

What matters:
- dry
- short
- physical
- cheap-but-satisfying plastic/mechanical character
- little or no room ambience
- immediate transient
- slight imperfection

This defines the **mechanical half** of the REKT sound language.

### Electronic reference

**Analog Modular “Beep Machine” — approximately 1.9–6.0 seconds**

Reference source:
- https://freesound.org/people/gis_sweden/sounds/414402/

The four small events in this region define the **electronic half**.

What matters:
- tiny analog oscillator gestures
- unstable pitch
- short envelopes
- click-like attacks
- no glossy reverb
- irregularity
- closer to test equipment than music

Do not clean away the imperfections that make these sounds interesting.

## Licensing rule

Prefer **CC0/public-domain sources** for any audio that will ship as raw web/app assets. Do not assume “royalty-free for music” automatically permits redistribution inside a product bundle.

For every production source, preserve a source URL and license note alongside the unprocessed master.

## Core rule

Every new sound must pass:

> Could this sound plausibly have come from a small physical electronic instrument sitting on the desk?

### Keep

- cassette buttons
- rotary encoder ticks
- microswitches
- relays
- muted keys
- servo movement
- oscillator pips
- short filter envelopes
- calibration tones
- tape mechanisms
- springy electronic clicks
- subtle voltage instability

### Reject

- cinematic whooshes
- lasers
- risers
- glossy notification dings
- EDM synth sounds
- cyberpunk drones
- long reverbs
- orchestral impacts
- arcade bleeps
- obvious retro-game sounds

## Canonical palette

Keep the first release to roughly **8–12 source identities**.

```text
audio/rekt-ui/

mechanical/
    mech_tick_a
    mech_tick_b
    mech_click
    mech_clack

analog/
    analog_pip_a
    analog_pip_b
    analog_blip_a
    analog_blip_b

texture/
    tape_floor
    servo_twitch
    electrical_pop

system/
    boot_fragment
```

Most UI events should be produced by combining or lightly transforming these rather than introducing unrelated sounds.

## Duration targets

| Class | Duration | Typical use |
| --- | ---: | --- |
| Micro interaction | 20–70 ms | cursor, tab, encoder-like navigation |
| Normal interaction | 50–140 ms | selection, toggle, button press |
| Semantic event | 120–350 ms | execute, deny, completed operation |
| Major system event | 300–900 ms | mission, unlock, transmission |

Anything longer needs justification.

## Interaction mapping

### Cursor / tab movement

Use `mech_tick_a`.

- 25–45 ms
- very quiet
- no tail
- only on discrete state change

Do not play sound for raw pointer movement.

### Selection

Use `mech_click`.

Optional layer:

```text
mech_click
+
analog_pip_a @ -12 to -18 dB relative
```

The mechanical sound must dominate.

### Toggle / switch

Use two related mechanical variants:

```text
OFF → ON  mech_tick_b, slightly higher
ON  → OFF mech_tick_a, slightly lower
```

Keep the distinction subtle.

### Execute command

This should become a signature REKT interaction:

```text
0 ms      MECH_CLACK
45–90 ms  ANALOG_PIP
```

Conceptually:

```text
physical control
      ↓
machine reacts electronically
```

### Successful operation

Avoid achievement jingles.

Use two related pips:

```text
pip_a
  ↓ 50–120 ms
pip_b
```

The second event can sit roughly +2 to +5 semitones higher, but should not become a melody.

### Invalid / locked action

```text
mech_tick
+
short descending analog event
```

Example pitch motion:

```text
~400 Hz → ~300 Hz over 40–100 ms
```

It should communicate **machine refused**, not “YOU MADE AN ERROR”.

### New transmission

```text
tiny servo/tape movement
        ↓
analog pip
```

Attention-grabbing enough to notice, but quieter and stranger than a conventional notification.

### Critical state change

Rare:

```text
mechanical CLACK
+
very short low transient
```

No explosions or dramatic alarms unless the underlying state is genuinely urgent.

## Background machine

The background is **not music**. It is a procedural idle machine.

### Continuous layer

Very faint tape/electrical floor.

Starting point:
- perceived level around `-48 dBFS-ish`
- HPF around `120–250 Hz`
- LPF around `5–8 kHz`

Avoid obvious broadband hiss. The user should mostly notice the bed when it disappears.

### Procedural idle events

Do not create one recognizable loop.

Example:

```text
0.0s    ......................
4.7s             tk
9.3s                    pip
14.1s   ......................
19.8s         chk
26.4s                  pt
34.0s              tick
43.2s   ......................
```

Suggested starting cadence:

- mechanical micro-event: every 4–14 s, ~40–60% probability gate
- electronic micro-event: every 7–22 s, ~30–50% probability gate
- larger machine twitch: every 25–70 s, ~20–35% probability gate

Silence is part of the design.

## Randomization

Do not replay identical micro-events in obvious succession.

Suggested ranges:

```text
pitch:  ±10–35 cents
gain:   ±1.5–3 dB
pan:    ±5–15%
timing: randomized
sample: choose from 2–4 siblings
```

Pitch movement should feel like component tolerance, not a sampler gimmick.

Avoid cartoonish multi-semitone randomization on every click.

## Dynamics hierarchy

```text
background texture       quietest
idle events              ↑
navigation               ↑
selection                ↑
execute                  ↑
important transmission   loudest normal event
```

Nothing should jump dramatically in volume. Do not normalize every asset to 0 dBFS.

Starting peak regions:

```text
micro UI:       -18 → -10 dBFS peak
primary UI:     -14 →  -7 dBFS peak
rare semantic:  -12 →  -5 dBFS peak
```

These are context-dependent starting points, not immutable standards.

## Frequency language

Keep most REKT events concentrated roughly in the `200 Hz – 4 kHz` region.

Avoid:
- huge sub-bass
- piercing 8–12 kHz digital clicks
- bright bell harmonics
- exaggerated stereo width

Mechanical transients may retain useful upper-frequency detail, but should never become fatiguing.

## Reverb

Default: **none**.

Permitted: roughly `0–5%` tiny physical-room ambience on selected sounds.

The terminal should feel close enough to touch. Long reverb destroys that illusion.

## Analog processing

Use processing to create **imperfection**, not vintage cosplay.

Useful:
- very mild saturation
- tiny wow/flutter
- subtle pitch instability
- low-pass filtering
- small envelope changes
- micro timing variation

Avoid stacking clichés:
- vinyl crackle
- huge tape wow
- telephone EQ
- gratuitous bitcrushing
- fake VHS layers everywhere

One artifact can add character. Five usually become costume.

## State-aware audio

### Idle

Noise floor + rare physical/electronic events.

### Active interaction

Reduce idle-event probability slightly so ambience does not compete with user action.

### Processing

Electronic activity may increase slightly, but never use a repetitive loading loop.

Example:

```text
idle analog probability:       0.35
processing analog probability: 0.50
```

### Result received

Consider a brief `150–300 ms` drop in procedural activity before the result sound. Silence can make a result feel more deliberate without making it louder.

## Visual synchronization

Where practical, sound and micro-animation should be driven by the same conceptual machine event.

Examples:
- analog pip → meter/oscilloscope twitch
- mechanical click → tiny switch displacement
- servo movement → scanner-line movement
- execute clack → status LED response
- processing activity → micro indicator movement

Do not create unrelated random visual and audio noise.

## Anti-casino rules

Never attach sound to:
- passive hover
- scrolling
- raw pointer movement
- decorative animation
- continuously updating prices
- every keystroke
- every chart tick

Sound represents **state transitions**, not activity for activity’s sake.

## Cooldowns

Suggested starting values:

```text
navigation tick:        60–100 ms
normal selection:      100–150 ms
analog feedback:       180–300 ms
background mechanical: >= 2 s
background analog:     >= 4 s
```

If multiple events collide, prioritize the most semantically important one.

## Polyphony

Recommended starting limits:

```text
mechanical voices: 2
analog voices:     2
background:        1–2
semantic event:    1
```

Target roughly four active foreground voices maximum. REKT should never sound like a pinball machine.

## User controls

Provide separate control over interaction audio and ambience where practical:

```text
SOUND     ON / OFF
AMBIENCE  ON / OFF
VOLUME    0–100
```

Some users will like tactile clicks but dislike continuous noise.

Respect browser autoplay restrictions. Never start audible ambience before user interaction permits it.

## Asset format

Source archive:

```text
24-bit WAV
48 kHz
mono where appropriate
```

Web delivery:

```text
Opus / OGG
```

Use an additional fallback only when deployment targets require it.

Preserve untouched source masters.

Suggested layout:

```text
audio/

sources/
    sony-cassette/
    beep-machine/

masters/
    mechanical/
    analog/
    texture/

web/
    mechanical/
    analog/
    texture/

manifest.json
```

For every source asset, keep provenance/license metadata.

## Naming convention

Prefer neutral source-identity names:

```text
mech_tick_a
mech_tick_b
analog_pip_a
analog_pip_b
servo_short_a
```

Then map them separately to UI semantics:

```text
NAVIGATE → mech_tick_a
EXECUTE  → mech_clack_a + analog_pip_b
```

This lets UX mappings change without renaming physical assets.

## Manifest concept

```json
{
  "navigate": {
    "samples": ["mech_tick_a", "mech_tick_b"],
    "gainDb": -13,
    "pitchVariationCents": 18,
    "cooldownMs": 80
  },
  "execute": {
    "sequence": [
      { "sample": "mech_clack_a", "delayMs": 0 },
      { "sample": "analog_pip_b", "delayMs": 65 }
    ]
  }
}
```

Audio behavior should be data-driven rather than scattered through React components.

## First production set

Do not build 30 sounds yet.

Cut and validate these first:

```text
01 mech_tick_a
02 mech_tick_b
03 mech_click_a
04 mech_clack_a
05 analog_pip_a
06 analog_pip_b
07 analog_blip_a
08 analog_blip_b
09 tape_floor
10 servo_twitch
```

The Sony cassette click and the selected Beep Machine fragments are the reference anchors. Derive siblings from them before introducing new sonic families.

## Acceptance test

Run the audio in the actual terminal for:
- 10 minutes
- 30 minutes
- 2 hours

Check:

### Tactility
Do interactions feel physical?

### Semantic value
Can users subconsciously distinguish selection, execution and rejection?

### Fatigue
Does any repeated sound become annoying?

### Loop detection
Can the user consciously predict the next idle event?

### Cohesion
Do all sounds plausibly belong to one machine?

### Restraint
Would removing 20% of the audio make the interface better?

If yes, remove it.

## Kill criteria

A sound fails the REKT language if:
- it sounds like a purchased UI pack
- it resembles a phone notification
- it attracts attention without communicating state
- it becomes annoying after ~20 repetitions
- it depends on reverb to sound good
- it sounds explicitly musical
- it clashes with the Sony cassette click
- it clashes with the selected Beep Machine fragments
- it makes the product feel more “gamey” instead of more physical

## North-star experience

A user leaves the terminal untouched.

Almost silence.

A faint electrical floor exists somewhere underneath.

A dry mechanical:

**tk**

Silence.

Several seconds later:

**pt**

A tiny unstable oscillator pulse.

Silence.

A cassette mechanism shifts almost imperceptibly.

The user selects something:

**kt**

They execute:

**CLACK**

65 milliseconds.

**pip**

The screen responds.

It should feel as though something actually happened inside the machine.

## Smallest validation experiment

Before building an audio engine, cut the Sony click plus the four chosen Beep Machine fragments into roughly eight usable variants, level-match them, and run them against the real terminal for at least 20–30 minutes.

If those source gestures remain satisfying under repetition, proceed to the procedural layer as one small `AudioEngine` plus a declarative manifest. Do not scatter direct `new Audio()` calls throughout React components.
