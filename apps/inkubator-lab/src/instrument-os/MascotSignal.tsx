import {useEffect, useMemo, useState} from 'react';
import {PeripheralSignal} from './PeripheralSignal';
import {assertMascotMotionContracts, REKT_MASCOT_BY_STATE, type MascotEyePose, type MascotEffect, type RektMascotState} from './mascot-motion';
import type {PeripheralCueKind} from './peripheral-motion';
import './mascot-signal.css';

if (import.meta.env.DEV) assertMascotMotionContracts();

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

function Eyes({pose}: {pose: MascotEyePose}) {
  if (pose === 'closed') return <><path d="M42 42.4h6"/><path d="M52 42.4h6"/></>;
  if (pose === 'half') return <><path d="M42 41.8l6 .7"/><path d="M52 42.5l6-.7"/></>;
  if (pose === 'left') return <><path d="M41.5 40.5l6.5 2.7-2.8 1.2-3.7-1.4z" className="fill"/><path d="M51.5 42.1l6.5-1.6-1.1 2.5-4.3 1.4z" className="fill"/></>;
  if (pose === 'right') return <><path d="M42 42.1l6.5-1.6-1 2.5-4.4 1.4z" className="fill"/><path d="M52 40.5l6.5 2.7-2.8 1.2-3.7-1.4z" className="fill"/></>;
  if (pose === 'angry') return <><path d="M41.5 40.2l7 3.1-2.3 1.4-4.7-2.2z" className="fill"/><path d="M51.5 43.3l7-3.1v2.3l-4.7 2.2z" className="fill"/></>;
  if (pose === 'wide') return <><rect x="42" y="40.3" width="6" height="4" rx="1" className="fill"/><rect x="52" y="40.3" width="6" height="4" rx="1" className="fill"/></>;
  return <><path d="M42 40.6l6 2.7-2.4 1.2-3.6-1.7z" className="fill"/><path d="M52 43.3l6-2.7v2.2l-3.6 1.7z" className="fill"/></>;
}

function PersonalityFx({effect}: {effect: MascotEffect}) {
  if (effect === 'none') return null;
  if (effect === 'z' || effect === 'zz' || effect === 'zzz') {
    return <g className="rektMascotFx rektMascotFx--sleep" data-fx={effect}>
      {effect.length >= 1 ? <text x="64" y="34">Z</text> : null}
      {effect.length >= 2 ? <text x="69" y="28">Z</text> : null}
      {effect.length >= 3 ? <text x="75" y="21">Z</text> : null}
    </g>;
  }
  if (effect === 'ellipsis') return <g className="rektMascotFx"><circle cx="70" cy="34" r="1"/><circle cx="75" cy="34" r="1"/><circle cx="80" cy="34" r="1"/></g>;
  if (effect === 'question') return <text className="rektMascotFx rektMascotFx--question" x="72" y="29">?</text>;
  if (effect === 'anger') return <g className="rektMascotFx rektMascotFx--anger"><path d="M65 31l4-4M65 27l4 4M72 28l4-5M73 32l5-2"/></g>;
  return <g className="rektMascotFx rektMascotFx--spark"><path d="M27 31v8M23 35h8M71 24v10M66 29h10"/><path className="accent" d="M77 39v6M74 42h6M30 48v5M27.5 50.5h5"/></g>;
}

export type MascotSignalProps = {
  state: RektMascotState;
  /** Stable event id used to replay ONCE states such as ANGRY and EXCITED. */
  eventId?: string;
  /** Independent system-truth side effect. Never inferred from mascot mood. */
  peripheralCue?: PeripheralCueKind;
  peripheralEventId?: string;
  className?: string;
};

export function MascotSignal({state, eventId, peripheralCue, peripheralEventId, className = ''}: MascotSignalProps) {
  const definition = REKT_MASCOT_BY_STATE.get(state);
  if (!definition) throw new Error(`Unknown REKT mascot state: ${state}`);

  const reducedMotion = useReducedMotion();
  const [frame, setFrame] = useState(0);
  const replayKey = `${state}:${eventId ?? ''}`;

  const sequence = useMemo(() => definition.playback === 'PING_PONG' ? [0, 1, 2, 3, 2, 1] : [0, 1, 2, 3], [definition.playback]);

  useEffect(() => {
    if (reducedMotion) {
      setFrame(definition.playback === 'ONCE' ? 3 : 0);
      return;
    }

    setFrame(0);
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      if (definition.playback === 'ONCE' && step >= sequence.length) {
        setFrame(3);
        window.clearInterval(timer);
        return;
      }
      setFrame(sequence[step % sequence.length]);
    }, definition.frameMs);
    return () => window.clearInterval(timer);
  }, [definition, replayKey, reducedMotion, sequence]);

  const pose = definition.frames[frame];

  return (
    <div className={`rektMascotSignal ${className}`} data-mascot-state={state} data-frame={frame + 1} data-playback={definition.playback}>
      <div className="rektMascotCanvas" style={{transform: `translate(${pose.x}px, ${pose.y}px)`}}>
        <img className="rektMascotBase" src="/assets/rekt-mascot.png" alt="" aria-hidden="true" draggable={false}/>
        <svg className="rektMascotOverlay" viewBox="0 0 100 100" role="presentation" aria-hidden="true" shapeRendering="crispEdges">
          <rect className="rektMascotEyeMask" x="40" y="39" width="20" height="7"/>
          <g className="rektMascotEyes"><Eyes pose={pose.eye}/></g>
          <PersonalityFx effect={pose.effect}/>
        </svg>
      </div>
      {peripheralCue ? <PeripheralSignal cue={peripheralCue} eventId={peripheralEventId} className="rektMascotPeripheral"/> : null}
    </div>
  );
}
