import {useMemo, useState} from 'react';
import {MascotSignal} from './MascotSignal';
import {PERIPHERAL_MOTIONS, type PeripheralCueKind} from './peripheral-motion';
import {REKT_MASCOT_MOTIONS, type RektMascotState} from './mascot-motion';
import './mascot-motion-lab.css';

export default function MascotMotionLab() {
  const [state, setState] = useState<RektMascotState>('LAZY');
  const [mascotSequence, setMascotSequence] = useState(0);
  const [peripheralCue, setPeripheralCue] = useState<PeripheralCueKind | undefined>();
  const [peripheralSequence, setPeripheralSequence] = useState(0);

  const definition = useMemo(() => REKT_MASCOT_MOTIONS.find((item) => item.state === state)!, [state]);

  const replayMascot = () => setMascotSequence((value) => value + 1);
  const firePeripheral = () => setPeripheralSequence((value) => value + 1);

  return (
    <main className="mml-shell">
      <header className="mml-header">
        <div>
          <small>REKT INK(CUBATOR) // INSTRUMENT OS</small>
          <h1>REKT MASCOT MOTION CONTRACT V0.2</h1>
          <p>Same creator-derived REKT. Always a little grumpy. Lazy degen operator. Never angry, never kawaii. System-truth effects stay independent.</p>
        </div>
        <nav className="mml-links" aria-label="Motion labs">
          <a href="?lab=peripheral">PERIPHERAL CONTRACT</a>
          <a aria-current="page" href="?lab=mascot">MASCOT CONTRACT</a>
        </nav>
      </header>

      <section className="mml-stage">
        <div className="mml-screen" aria-label="Animated REKT mascot calibration screen">
          <MascotSignal
            state={state}
            eventId={`mascot:${state}:${mascotSequence}`}
            peripheralCue={peripheralCue}
            peripheralEventId={peripheralCue ? `peripheral:${peripheralCue}:${peripheralSequence}` : undefined}
          />
        </div>
        <aside className="mml-readout">
          <small>PERSONALITY STATE // METAPHOR ONLY</small>
          <strong>{state}</strong>
          <span>{definition.label}</span>
          <code>{definition.playback} // 4 FRAMES // {definition.frameMs}MS/FRAME</code>
          <button type="button" onClick={replayMascot}>REPLAY PERSONALITY</button>
          <hr/>
          <small>SYSTEM SIDE EFFECT // TRUTH CHANNEL</small>
          <strong>{peripheralCue ?? 'NONE'}</strong>
          <span>Independent truth-authority channel. Mascot mood never manufactures PROVEN, OBSERVED, BLOCKED, or receipt state.</span>
          <button type="button" disabled={!peripheralCue} onClick={firePeripheral}>FIRE SIDE EFFECT</button>
        </aside>
      </section>

      <section className="mml-bank" aria-label="Mascot personality states">
        {REKT_MASCOT_MOTIONS.map((item) => (
          <button
            type="button"
            key={item.state}
            aria-pressed={state === item.state}
            onClick={() => {
              setState(item.state);
              setMascotSequence((value) => value + 1);
            }}
          >
            <b>{item.state}</b>
            <span>{item.label}</span>
          </button>
        ))}
      </section>

      <section className="mml-fx" aria-label="Independent system side effects">
        <button type="button" aria-pressed={!peripheralCue} onClick={() => setPeripheralCue(undefined)}><b>NO SYSTEM FX</b><span>PERSONALITY ONLY</span></button>
        {PERIPHERAL_MOTIONS.map((item) => (
          <button
            type="button"
            key={item.cue}
            aria-pressed={peripheralCue === item.cue}
            onClick={() => {
              setPeripheralCue(item.cue);
              setPeripheralSequence((value) => value + 1);
            }}
          >
            <b>{item.label}</b>
            <span>{item.authority}</span>
          </button>
        ))}
      </section>

      <footer className="mml-footer">
        <span>CREATOR-DERIVED REKT ASSET = BODY / HOOD / GEAR / LONG TENTACLE AUTHORITY</span>
        <span>PERSONALITY = METAPHOR // SIDE EFFECTS = SYSTEM TRUTH</span>
      </footer>
    </main>
  );
}
