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

/**
 * Every awake pose keeps the creator-logo's inward/downward grumpy bias.
 * There are deliberately no round, sparkling, smiling, or wide kawaii eyes.
 */
function Eyes({pose}: {pose: MascotEyePose}) {
  if (pose === 'closed') return <><path d="M42 42.5h6"/><path d="M52 42.5h6"/></>;
  if (pose === 'half') return <><path d="M42 41.5l6 1.4"/><path d="M52 42.9l6-1.4"/></>;
  if (pose === 'sideLeft') return <><path d="M41.5 40.7l6.5 2.8-2.6 1.1-3.9-1.7z" className="fill"/><path d="M51.7 42.1l6.1-1.5-1 2.4-4.2 1.3z" className="fill"/></>;
  if (pose === 'sideRight') return <><path d="M42.2 42.1l6.1-1.5-1 2.4-4.2 1.3z" className="fill"/><path d="M51.5 40.7l6.5 2.8-2.6 1.1-3.9-1.7z" className="fill"/></>;
  if (pose === 'squint') return <><path d="M42 41.3l6.2 2.1-2.3 1-3.9-1.3z" className="fill"/><path d="M51.8 43.4l6.2-2.1v1.8l-3.9 1.3z" className="fill"/></>;
  if (pose === 'grump') return <><path d="M41.5 40.2l7 3.1-2.3 1.4-4.7-2.2z" className="fill"/><path d="M51.5 43.3l7-3.1v2.3l-4.7 2.2z" className="fill"/></>;
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
  if (effect === 'ellipsis') return <g className="rektMascotFx rektMascotFx--muted"><circle cx="70" cy="34" r="1"/><circle cx="75" cy="34" r="1"/><circle cx="80" cy="34" r="1"/></g>;
  if (effect === 'question') return <text className="rektMascotFx rektMascotFx--question" x="72" y="29">?</text>;
  if (effect === 'sigh') return <g className="rektMascotFx rektMascotFx--sigh"><path d="M66 33q4-3 8 0q4 3 8 0"/><path d="M72 38q3-2 6 0"/></g>;
  if (effect === 'grumble') return <g className="rektMascotFx rektMascotFx--grumble"><path d="M67 27l3 2 3-3 3 2 3-3"/><path d="M72 33l2 1 2-2 2 1"/></g>;
  return <g className="rektMascotFx rektMascotFx--task">
    <rect x="61" y="58" width="20" height="11" rx="1"/>
    <path d="M64 61h10M64 64h7M77 61h1M77 64h1"/>
  </g>;
}

export type MascotSignalProps = {
  state: RektMascotState;
  /** Stable event id used to replay finite personality reactions. */
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
    <div
      className={`rektMascotSignal ${className}`}
      data-mascot-state={state}
      data-frame={frame + 1}
      data-playback={definition.playback}
      data-mascot-contract="v0.2-grumpy"
      data-personality-role="metaphor"
    >
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
