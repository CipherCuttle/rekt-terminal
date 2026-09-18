import {useEffect, useMemo, useRef, useState} from 'react';
import {PERIPHERAL_MOTIONS, assertPeripheralMotionContracts, type PeripheralCueKind, type PeripheralLayer, type Primitive} from './peripheral-motion';
import './peripheral-signal.css';

if (import.meta.env.DEV) assertPeripheralMotionContracts();

const byCue = new Map(PERIPHERAL_MOTIONS.map(def => [def.cue, def]));

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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

function PrimitiveShape({primitive}: {primitive: Primitive}) {
  const common = {vectorEffect: 'non-scaling-stroke' as const};
  if (primitive.kind === 'circle') return <circle {...common} cx={primitive.cx} cy={primitive.cy} r={primitive.r} className={primitive.fill ? 'is-fill' : undefined} />;
  if (primitive.kind === 'rect') return <rect {...common} x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height} rx={primitive.rx} className={primitive.fill ? 'is-fill' : undefined} />;
  if (primitive.kind === 'line') return <line {...common} x1={primitive.x1} y1={primitive.y1} x2={primitive.x2} y2={primitive.y2} strokeDasharray={primitive.dash} />;
  if (primitive.kind === 'polygon') return <polygon {...common} points={primitive.points} className="is-fill" />;
  return <path {...common} d={primitive.d} className={primitive.fill ? 'is-fill' : undefined} />;
}

function Layer({layer, frame}: {layer: PeripheralLayer; frame: number}) {
  const pose = layer.frames[frame];
  if (!pose.visible) return null;
  return (
    <g className="rektPeripheralLayer" data-layer={layer.id} data-tone={layer.tone ?? 'ink'} transform={`translate(${pose.x} ${pose.y})`}>
      <PrimitiveShape primitive={layer.primitive} />
    </g>
  );
}

export type PeripheralSignalProps = {
  cue: PeripheralCueKind;
  /** Stable domain event id. Initial value renders settled state without replaying history. */
  eventId?: string;
  className?: string;
  debug?: boolean;
};

export function PeripheralSignal({cue, eventId, className = '', debug = false}: PeripheralSignalProps) {
  const def = byCue.get(cue);
  if (!def) throw new Error(`Unknown REKT peripheral cue: ${cue}`);

  const reducedMotion = useReducedMotion();
  const [frame, setFrame] = useState(3);
  const currentKey = eventId ? `${cue}:${eventId}` : undefined;
  const seenKeys = useRef(new Set<string>());
  const initialized = useRef(false);

  useEffect(() => {
    const historical = !initialized.current;
    initialized.current = true;
    const seen = currentKey ? seenKeys.current.has(currentKey) : false;
    if (currentKey) seenKeys.current.add(currentKey);
    // A status-only/cue change and a reduced-motion change must cancel old timers.
    if (historical || !currentKey || seen || reducedMotion) {
      setFrame(3);
      return;
    }
    setFrame(0);
    const frameMs = def.durationMs / 4;
    const timers = [1, 2, 3].map(next => window.setTimeout(() => setFrame(next), frameMs * next));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [cue, currentKey, def.durationMs, reducedMotion]);

  const moving = useMemo(() => new Set(def.layers.filter(layer => layer.policy.kind === 'track').map(layer => layer.id)), [def]);

  return (
    <svg
      className={`rektPeripheralSignal ${className}`}
      viewBox="0 0 160 96"
      role="presentation"
      aria-hidden="true"
      data-cue={cue}
      data-frame={frame + 1}
      data-motion-contract="v1"
      shapeRendering="crispEdges"
    >
      {debug ? <g className="rektPeripheralDebug"><path d="M80 0v96M0 48h160" /><rect x="0.5" y="0.5" width="159" height="95" /></g> : null}
      {def.layers.map(layer => <Layer key={layer.id} layer={layer} frame={frame} />)}
      {debug ? def.layers.filter(layer => moving.has(layer.id)).map(layer => {
        const points = layer.frames.filter(framePose => framePose.visible).map(framePose => `${framePose.x},${framePose.y}`).join(' ');
        return <polyline key={`track-${layer.id}`} className="rektPeripheralTrack" points={points} />;
      }) : null}
    </svg>
  );
}
