import {useMemo, useState} from 'react';
import {PeripheralSignal} from './PeripheralSignal';
import {PERIPHERAL_MOTIONS, motionDebugSummary, type PeripheralCueKind} from './peripheral-motion';
import './peripheral-motion-lab.css';

const cueLabels = new Map(PERIPHERAL_MOTIONS.map((definition) => [definition.cue, definition.label]));

export default function PeripheralMotionLab() {
  const [cue, setCue] = useState<PeripheralCueKind>('SOURCE_RX');
  const [eventId, setEventId] = useState<string>();
  const [debug, setDebug] = useState(true);
  const [eventSequence, setEventSequence] = useState(0);

  const definition = useMemo(() => PERIPHERAL_MOTIONS.find((item) => item.cue === cue)!, [cue]);
  const roles = useMemo(() => motionDebugSummary().find((item) => item.cue === cue)!, [cue]);

  const replay = () => {
    const next = eventSequence + 1;
    setEventSequence(next);
    setEventId(`lab:${cue}:${next}`);
  };

  return (
    <main className="pml-shell">
      <header className="pml-header">
        <div>
          <small>REKT INK(CUBATOR) // INSTRUMENT OS</small>
          <h1>PERIPHERAL MOTION CONTRACT V1</h1>
          <p>Only declared TRACK layers move. FIXED anchors cannot drift. TOGGLE layers may only appear/disappear at a fixed anchor.</p>
        </div>
        <label className="pml-debug"><input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} /> DEBUG TRACKS</label>
      </header>

      <section className="pml-stage" aria-label="Peripheral animation calibration stage">
        <div className="pml-display" data-tone={definition.tone}>
          <PeripheralSignal cue={cue} eventId={eventId} debug={debug} />
        </div>
        <div className="pml-readout">
          <small>CURRENT CUE</small>
          <strong>{cueLabels.get(cue)}</strong>
          <span>{definition.authority} // {definition.durationMs}MS // FOUR DISCRETE FRAMES</span>
          <button type="button" onClick={replay}>REPLAY NEW EVENT</button>
        </div>
      </section>

      <section className="pml-contract" aria-label="Current movement contract">
        <div><small>FIXED</small><strong>{roles.fixedLayers.length ? roles.fixedLayers.join(' · ') : 'NONE'}</strong></div>
        <div><small>TRACK</small><strong>{roles.movingLayers.length ? roles.movingLayers.join(' · ') : 'NONE'}</strong></div>
        <div><small>TOGGLE</small><strong>{roles.toggledLayers.length ? roles.toggledLayers.join(' · ') : 'NONE'}</strong></div>
      </section>

      <nav className="pml-bank" aria-label="Peripheral cue selector">
        {PERIPHERAL_MOTIONS.map((item) => (
          <button
            type="button"
            key={item.cue}
            aria-pressed={cue === item.cue}
            onClick={() => {
              setCue(item.cue);
              setEventId(undefined);
            }}
          >
            <b>{item.label}</b>
            <span>{item.authority} · {item.durationMs}ms</span>
          </button>
        ))}
      </nav>

      <footer className="pml-footer">
        <span>MAGENTA = DEBUG-ONLY PATH / CENTERLINE</span>
        <span>INITIAL LOAD = SETTLED FRAME / NO HISTORICAL REPLAY</span>
      </footer>
    </main>
  );
}
