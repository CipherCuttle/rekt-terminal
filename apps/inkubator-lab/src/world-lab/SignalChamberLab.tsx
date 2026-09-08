import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Bodies, Body, Engine, World} from 'matter-js';
import gsap from 'gsap';

export type SignalMode = 'static' | 'gsap' | 'matter';

export type SignalEvent = {
  signal_id: string;
  kind: 'HELP_BEACON_OPENED' | 'ASSIST_ACCEPTED' | 'EXTERNAL_TEST_RECORDED';
  project_id: string;
  project_name: string;
  truth_state: 'CLAIMED' | 'OBSERVED';
  occurred_at: string;
};

export const MAX_ACTIVE_PHYSICS_BODIES_DESKTOP = 8;
export const MAX_ACTIVE_PHYSICS_BODIES_MOBILE = 4;
export const SIGNAL_SPAWN_GAP_MS = 220;
export const SIGNAL_LIFETIME_MS = 5_600;

export const SIGNAL_EVENTS: readonly SignalEvent[] = [
  {signal_id: 'SIG-001', kind: 'ASSIST_ACCEPTED', project_id: 'P-WEIRD', project_name: 'WEIRD LITTLE THING', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:00:00Z'},
  {signal_id: 'SIG-002', kind: 'HELP_BEACON_OPENED', project_id: 'P-RELAY', project_name: 'TINY RELAY', truth_state: 'CLAIMED', occurred_at: '2026-09-08T13:02:00Z'},
  {signal_id: 'SIG-003', kind: 'EXTERNAL_TEST_RECORDED', project_id: 'P-WEIRD', project_name: 'WEIRD LITTLE THING', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:04:00Z'},
  {signal_id: 'SIG-004', kind: 'HELP_BEACON_OPENED', project_id: 'P-NIGHT', project_name: 'NIGHT SHIFT', truth_state: 'CLAIMED', occurred_at: '2026-09-08T13:06:00Z'},
  {signal_id: 'SIG-005', kind: 'ASSIST_ACCEPTED', project_id: 'P-NIGHT', project_name: 'NIGHT SHIFT', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:08:00Z'},
  {signal_id: 'SIG-006', kind: 'EXTERNAL_TEST_RECORDED', project_id: 'P-RELAY', project_name: 'TINY RELAY', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:10:00Z'},
  {signal_id: 'SIG-007', kind: 'HELP_BEACON_OPENED', project_id: 'P-WEIRD', project_name: 'WEIRD LITTLE THING', truth_state: 'CLAIMED', occurred_at: '2026-09-08T13:12:00Z'},
  {signal_id: 'SIG-008', kind: 'ASSIST_ACCEPTED', project_id: 'P-RELAY', project_name: 'TINY RELAY', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:14:00Z'},
];

export const BURST_EVENTS: readonly SignalEvent[] = [
  ...SIGNAL_EVENTS,
  {signal_id: 'SIG-009', kind: 'EXTERNAL_TEST_RECORDED', project_id: 'P-NIGHT', project_name: 'NIGHT SHIFT', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:16:00Z'},
  {signal_id: 'SIG-010', kind: 'HELP_BEACON_OPENED', project_id: 'P-RELAY', project_name: 'TINY RELAY', truth_state: 'CLAIMED', occurred_at: '2026-09-08T13:18:00Z'},
];

const SOURCE_PORTS = [
  {project_id: 'P-WEIRD', project_name: 'WEIRD LITTLE THING'},
  {project_id: 'P-RELAY', project_name: 'TINY RELAY'},
  {project_id: 'P-NIGHT', project_name: 'NIGHT SHIFT'},
] as const;

type ActiveSignal = {event: SignalEvent; token: string};
type CapsulePosition = {xRatio: number; yRatio: number};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function maxActiveBodiesForWidth(width: number) {
  return width <= 640 ? MAX_ACTIVE_PHYSICS_BODIES_MOBILE : MAX_ACTIVE_PHYSICS_BODIES_DESKTOP;
}

function sourceIndex(projectId: string) {
  return Math.max(0, SOURCE_PORTS.findIndex((port) => port.project_id === projectId));
}

function capsulePosition(event: SignalEvent, index: number): CapsulePosition {
  const hash = hashString(`${event.signal_id}:${index}`);
  const port = sourceIndex(event.project_id);
  const xRatio = 0.44 + port * 0.08 + ((hash >>> 8) % 7 - 3) / 100;
  const yRatio = 0.22 + (index % 3) * 0.28 + ((hash >>> 16) % 5 - 2) / 100;
  return {xRatio: Math.min(0.78, xRatio), yRatio: Math.min(0.82, yRatio)};
}

function driftFor(event: SignalEvent, index: number) {
  const hash = hashString(`${event.signal_id}:drift:${index}`);
  return {
    x: ((hash % 9) - 4) * 2,
    y: -8 - ((hash >>> 8) % 10),
    duration: 3.7 + ((hash >>> 16) % 9) / 10,
    delay: ((hash >>> 24) % 5) / 10,
  };
}

function signalKind(kind: SignalEvent['kind']) {
  return kind.replaceAll('_', ' ');
}

function signalTime(value: string) {
  return value.slice(11, 16);
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  return reducedMotion;
}

function SignalCapsule({
  active,
  index,
  mode,
  reducedMotion,
  register,
}: {
  active: ActiveSignal;
  index: number;
  mode: SignalMode;
  reducedMotion: boolean;
  register: (signalId: string, element: HTMLElement | null) => void;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const position = capsulePosition(active.event, index);
  const drift = driftFor(active.event, index);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    gsap.killTweensOf(inner);
    if (reducedMotion) {
      gsap.set(inner, {autoAlpha: 1, scale: 1});
      return;
    }
    const birth = gsap.timeline();
    birth.fromTo(inner, {autoAlpha: 0, scale: 0.9, filter: 'brightness(1.7)'}, {autoAlpha: 1, scale: 1.02, filter: 'brightness(1)', duration: 0.1, ease: 'power1.out'});
    birth.to(inner, {scale: 1, duration: 0.08, ease: 'sine.out'});
    return () => {
      birth.kill();
      gsap.killTweensOf(inner);
    };
  }, [active.event.signal_id, reducedMotion]);

  useLayoutEffect(() => {
    const shell = innerRef.current?.parentElement;
    if (!shell || mode !== 'gsap' || reducedMotion) return;
    const driftTween = gsap.to(shell, {
      x: drift.x,
      y: drift.y,
      duration: drift.duration,
      delay: drift.delay,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    return () => { driftTween.kill(); };
  }, [active.event.signal_id, drift.duration, drift.delay, drift.x, drift.y, mode, reducedMotion]);

  return (
    <article
      ref={(element) => register(active.event.signal_id, element)}
      className="signal-capsule-shell"
      data-signal-id={active.event.signal_id}
      data-truth={active.event.truth_state.toLowerCase()}
      data-origin={active.event.project_id}
      style={{left: mode === 'matter' ? 0 : `${position.xRatio * 100}%`, top: mode === 'matter' ? 0 : `${position.yRatio * 100}%`}}
    >
      <div ref={innerRef} className="signal-capsule" data-truth={active.event.truth_state.toLowerCase()}>
        <div className="signal-capsule-top"><span>{active.event.truth_state}</span><small>{active.event.signal_id}</small></div>
        <strong>{active.event.project_name}</strong>
        <span className="signal-capsule-kind">{signalKind(active.event.kind)}</span>
        <time dateTime={active.event.occurred_at}>{signalTime(active.event.occurred_at)} UTC</time>
      </div>
    </article>
  );
}

function NowSignal({event}: {event?: SignalEvent}) {
  return (
    <section className="signal-now" aria-labelledby="signal-now-title">
      <div className="panel-kicker"><span id="signal-now-title">NOW / LATEST</span><small>CANONICAL EVENT</small></div>
      {event ? (
        <div className="signal-now-event" data-truth={event.truth_state.toLowerCase()}>
          <span className="signal-now-mark" aria-hidden="true">RX</span>
          <div><span>{event.truth_state} // {signalKind(event.kind)}</span><strong>{event.project_name}</strong><small>{event.signal_id} / {signalTime(event.occurred_at)} UTC</small></div>
        </div>
      ) : <p className="signal-empty">WAITING FOR A PUBLIC SIGNAL</p>}
    </section>
  );
}

function EventLedger({events}: {events: readonly SignalEvent[]}) {
  return (
    <section className="signal-ledger" aria-labelledby="signal-ledger-title">
      <div className="panel-kicker"><span id="signal-ledger-title">RECENT SIGNALS</span><small>PERMANENT SEMANTIC LEDGER</small></div>
      {events.length ? (
        <ol aria-label="Recent signals">
          {[...events].reverse().map((event) => (
            <li key={event.signal_id} data-signal-id={event.signal_id} data-truth={event.truth_state.toLowerCase()}>
              <span>{event.truth_state}</span>
              <div><strong>{event.project_name}</strong><small>{signalKind(event.kind)}</small></div>
              <time dateTime={event.occurred_at}>{event.signal_id} / {signalTime(event.occurred_at)} UTC</time>
            </li>
          ))}
        </ol>
      ) : <p className="signal-empty">NO SIGNALS RECORDED</p>}
    </section>
  );
}

export default function SignalChamberLab() {
  const [mode, setMode] = useState<SignalMode>('matter');
  const [ledger, setLedger] = useState<SignalEvent[]>([]);
  const [latest, setLatest] = useState<SignalEvent>();
  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>([]);
  const [visualQueue, setVisualQueue] = useState<SignalEvent[]>([]);
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBodyCount, setActiveBodyCount] = useState(0);
  const reducedMotion = useReducedMotion();
  const chamberRef = useRef<HTMLDivElement>(null);
  const capsuleRefs = useRef(new Map<string, HTMLElement>());
  const activeRef = useRef<ActiveSignal[]>([]);
  const queueRef = useRef<SignalEvent[]>([]);
  const cursorRef = useRef(0);
  const spawnSequenceRef = useRef(0);
  const retirementTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    activeRef.current = activeSignals;
  }, [activeSignals]);

  useEffect(() => {
    queueRef.current = visualQueue;
  }, [visualQueue]);

  const registerCapsule = useCallback((signalId: string, element: HTMLElement | null) => {
    if (element) capsuleRefs.current.set(signalId, element);
    else capsuleRefs.current.delete(signalId);
  }, []);

  const retireSignal = useCallback((token: string) => {
    setActiveSignals((current) => current.filter((item) => item.token !== token));
    retirementTimers.current.delete(token);
  }, []);

  const enqueueVisual = useCallback((event: SignalEvent) => {
    setVisualQueue((current) => [...current, event]);
  }, []);

  const emitEvent = useCallback((event: SignalEvent) => {
    setLedger((current) => current.some((item) => item.signal_id === event.signal_id) ? current : [...current, event]);
    setLatest(event);
    if (!reducedMotion) enqueueVisual(event);
  }, [enqueueVisual, reducedMotion]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    cursorRef.current = 0;
    setCursor(0);
    setLedger([]);
    setLatest(undefined);
    setVisualQueue([]);
    setActiveSignals([]);
    retirementTimers.current.forEach((timer) => clearTimeout(timer));
    retirementTimers.current.clear();
  }, []);

  const nextEvent = useCallback(() => {
    const index = cursorRef.current;
    if (index >= SIGNAL_EVENTS.length) {
      setIsPlaying(false);
      return;
    }
    cursorRef.current += 1;
    setCursor(cursorRef.current);
    emitEvent(SIGNAL_EVENTS[index]);
  }, [emitEvent]);

  const burst = useCallback(() => {
    reset();
    BURST_EVENTS.forEach((event) => emitEvent(event));
    cursorRef.current = SIGNAL_EVENTS.length;
    setCursor(SIGNAL_EVENTS.length);
  }, [emitEvent, reset]);

  useEffect(() => {
    if (!isPlaying || reducedMotion) return;
    nextEvent();
    const timer = setInterval(nextEvent, 1_900);
    return () => clearInterval(timer);
  }, [isPlaying, nextEvent, reducedMotion]);

  useEffect(() => {
    if (!visualQueue.length) return;
    if (reducedMotion) {
      setVisualQueue([]);
      return;
    }
    const chamberWidth = chamberRef.current?.clientWidth ?? window.innerWidth;
    const capacity = maxActiveBodiesForWidth(chamberWidth);
    if (activeRef.current.length >= capacity) {
      const retry = setTimeout(() => setVisualQueue((current) => [...current]), SIGNAL_SPAWN_GAP_MS);
      return () => clearTimeout(retry);
    }
    const timer = setTimeout(() => {
      const event = queueRef.current[0];
      if (!event) return;
      const token = `${event.signal_id}-${spawnSequenceRef.current++}`;
      setVisualQueue((current) => current.slice(1));
      setActiveSignals((current) => [...current, {event, token}]);
      const retirement = setTimeout(() => retireSignal(token), SIGNAL_LIFETIME_MS);
      retirementTimers.current.set(token, retirement);
    }, SIGNAL_SPAWN_GAP_MS);
    return () => clearTimeout(timer);
  }, [activeSignals.length, reducedMotion, retireSignal, visualQueue]);

  useEffect(() => {
    if (mode !== 'matter' || reducedMotion) {
      setActiveBodyCount(0);
      return;
    }
    const chamber = chamberRef.current;
    if (!chamber) return;
    const engine = Engine.create({enableSleeping: false});
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    const bodies = new Map<string, Matter.Body>();
    let walls: Matter.Body[] = [];
    let raf = 0;
    let disposed = false;
    let lastTime = performance.now();

    const dimensions = () => ({width: chamber.clientWidth || chamber.getBoundingClientRect().width || 760, height: chamber.clientHeight || chamber.getBoundingClientRect().height || 470});
    const rebuildWalls = () => {
      const {width, height} = dimensions();
      walls.forEach((wall) => World.remove(engine.world, wall));
      walls = [
        Bodies.rectangle(width / 2, -16, width, 32, {isStatic: true}),
        Bodies.rectangle(width / 2, height + 16, width, 32, {isStatic: true}),
        Bodies.rectangle(-16, height / 2, 32, height, {isStatic: true}),
        Bodies.rectangle(width + 16, height / 2, 32, height, {isStatic: true}),
      ];
      World.add(engine.world, walls);
      const cap = maxActiveBodiesForWidth(width);
      setActiveSignals((current) => current.length > cap ? current.slice(-cap) : current);
    };
    const addMissingBodies = () => {
      const {width, height} = dimensions();
      const active = activeRef.current;
      active.forEach((item, index) => {
        if (bodies.has(item.token)) return;
        const element = capsuleRefs.current.get(item.event.signal_id);
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const capsuleWidth = Math.max(element.offsetWidth || rect.width || 190, 150);
        const capsuleHeight = Math.max(element.offsetHeight || rect.height || 86, 72);
        const position = capsulePosition(item.event, index);
        const body = Bodies.rectangle(width * position.xRatio, height * position.yRatio, capsuleWidth, capsuleHeight, {
          frictionAir: 0.12,
          restitution: 0.08,
          friction: 0.04,
          inertia: Infinity,
          angle: 0,
          chamfer: {radius: 4},
        });
        bodies.set(item.token, body);
        World.add(engine.world, body);
      });
      bodies.forEach((body, token) => {
        if (active.some((item) => item.token === token)) return;
        World.remove(engine.world, body);
        bodies.delete(token);
      });
      setActiveBodyCount(bodies.size);
    };
    const renderBodies = () => {
      const active = activeRef.current;
      active.forEach((item) => {
        const body = bodies.get(item.token);
        const element = capsuleRefs.current.get(item.event.signal_id);
        if (!body || !element) return;
        const width = element.offsetWidth || 190;
        const height = element.offsetHeight || 86;
        const clampedAngle = Math.max(-0.035, Math.min(0.035, body.angle));
        element.style.transform = `translate3d(${body.position.x - width / 2}px, ${body.position.y - height / 2}px, 0) rotate(${clampedAngle}rad)`;
      });
    };
    const frame = (time: number) => {
      if (disposed) return;
      addMissingBodies();
      const delta = Math.min(32, Math.max(8, time - lastTime));
      lastTime = time;
      bodies.forEach((body, index) => {
        const seed = hashString(`${body.id}:${index}`);
        Body.applyForce(body, body.position, {x: (((seed % 7) - 3) * 0.00008), y: -0.00055});
      });
      Engine.update(engine, delta);
      renderBodies();
      raf = requestAnimationFrame(frame);
    };
    rebuildWalls();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(rebuildWalls) : null;
    resizeObserver?.observe(chamber);
    window.addEventListener('resize', rebuildWalls);
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', rebuildWalls);
      World.clear(engine.world, false);
      Engine.clear(engine);
      bodies.clear();
      setActiveBodyCount(0);
    };
  }, [mode, reducedMotion]);

  const selectMode = (nextMode: SignalMode) => {
    reset();
    setMode(nextMode);
  };

  return (
    <main className="signal-lab" data-testid="signal-lab" data-mode={mode} data-reduced-motion={reducedMotion} data-ledger-count={ledger.length} data-active-body-count={activeBodyCount} data-queued-count={visualQueue.length}>
      <header className="signal-lab-header">
        <div><p className="signal-lab-eyebrow">REKT INK(CUBATOR) / WORLD LAB</p><h1>BLACKWATER<br /><em>SIGNAL CHAMBER</em></h1><p className="signal-lab-deck">A bounded falsification experiment for public WORLD events. Motion is the variable.</p></div>
        <div className="signal-experiment-stamp">EXPERIMENT<br /><strong>SYNTHETIC WORLD SIGNALS</strong></div>
      </header>

      <section className="signal-controls" aria-label="Experiment controls">
        <div className="control-block"><span className="control-label">MOTION MODEL</span><div className="mode-toggle" role="group" aria-label="Motion model">
          {(['static', 'gsap', 'matter'] as SignalMode[]).map((option) => <button key={option} type="button" aria-pressed={mode === option} className={mode === option ? 'is-active' : ''} onClick={() => selectMode(option)}>{option.toUpperCase()}</button>)}
        </div></div>
        <div className="control-block control-block--actions"><span className="control-label">PLAYBACK</span><div className="playback-controls">
          <button type="button" onClick={reset}>RESET</button><button type="button" onClick={nextEvent}>NEXT EVENT</button><button type="button" aria-pressed={isPlaying} onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? 'PAUSE' : 'AUTO PLAY'}</button><button type="button" onClick={burst}>BURST TEST</button>
        </div></div>
      </section>

      <div className="signal-lab-grid">
        <aside className="signal-ports" aria-label="Stable project source ports">
          <div className="panel-kicker"><span>SOURCE PORTS</span><small>LAYOUT ONLY</small></div>
          <p className="port-note">Causal entry points for presentation. Port position carries no domain meaning.</p>
          <ol>{SOURCE_PORTS.map((port, index) => <li key={port.project_id} data-project-id={port.project_id}><span className="port-node">{String(index + 1).padStart(2, '0')}</span><div><strong>{port.project_name}</strong><small>{port.project_id} / RX PORT</small></div></li>)}</ol>
        </aside>

        <div className="signal-main-column">
          <NowSignal event={latest} />
          <section className="signal-chamber-panel" aria-labelledby="signal-chamber-title">
            <header className="chamber-header"><div><span>CHAMBER / 00</span><h2 id="signal-chamber-title">PUBLIC SIGNAL RECEIVER</h2></div><small>BOUNDED PHYSICAL PROJECTION // LEDGER NEVER RETIRES</small></header>
            <div ref={chamberRef} className="signal-chamber" data-motion-policy={reducedMotion ? 'reduced' : 'full'}>
              <div className="chamber-grid" aria-hidden="true" />
              <div className="chamber-manifold" aria-hidden="true"><span>RX</span><i /><b>ORIGIN</b></div>
              <div className="chamber-current chamber-current--one" aria-hidden="true" /><div className="chamber-current chamber-current--two" aria-hidden="true" />
              <div className="signal-capsules" aria-live="polite">
                {activeSignals.map((active, index) => <SignalCapsule key={active.token} active={active} index={index} mode={mode} reducedMotion={reducedMotion} register={registerCapsule} />)}
              </div>
              {!activeSignals.length && !latest ? <div className="chamber-empty"><span>RX / IDLE</span><strong>WAITING FOR SIGNAL</strong><small>NEW CANONICAL EVENTS CONDENSE HERE</small></div> : null}
              <div className="chamber-footnote">PHYSICAL PROJECTION / TEMPORARY<br />SEMANTIC LEDGER / PERMANENT</div>
            </div>
            <div className="lab-telemetry" aria-label="Lab telemetry"><span>LAB / MODE <b>{mode.toUpperCase()}</b></span><span>ACTIVE BODIES <b>{activeBodyCount}</b></span><span>QUEUED EVENTS <b>{visualQueue.length}</b></span><span>LEDGER EVENTS <b>{ledger.length}</b></span></div>
          </section>
          <EventLedger events={ledger} />
        </div>
      </div>
    </main>
  );
}
