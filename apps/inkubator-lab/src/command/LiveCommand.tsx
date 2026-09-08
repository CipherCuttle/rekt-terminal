import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {useGSAP} from '@gsap/react';
import {useQuery} from '@tanstack/react-query';
import gsap from 'gsap';
import {Application, Graphics} from 'pixi.js';
import type {
  CommandView,
  InkubatorApiClient,
  MissionGateState,
  MissionGateView,
} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {MOTION_EASE, MOTION_SECONDS} from '../instrument-os/motion-tokens';
import {TerminalShell} from '../shell/TerminalShell';
import {diffCommandProjection, summarizeCommandDeltas, type CommandProjectionDelta} from './projection-delta';
import '../instrument-os/instrument-os.css';
import './live-command.css';

gsap.registerPlugin(useGSAP);

type CommandClient = Pick<InkubatorApiClient, 'getMyCommand'>;

export type LiveCommandProps = {
  client?: CommandClient;
  refetchIntervalMs?: number | false;
};

const QUERY_KEY = ['inkubator', 'command', 'me'] as const;

const gateTone: Record<MissionGateState, 'neutral' | 'signal' | 'proven' | 'danger' | 'stale'> = {
  UNKNOWN: 'neutral',
  CLAIMED: 'signal',
  ACTIVE: 'signal',
  OBSERVED: 'signal',
  PROVEN: 'proven',
  ATTENTION: 'danger',
  BLOCKED: 'danger',
  STALE: 'stale',
  FAILED: 'danger',
};

const gateSignalValue: Record<MissionGateState, number> = {
  UNKNOWN: 0.18,
  CLAIMED: 0.34,
  ACTIVE: 0.52,
  OBSERVED: 0.66,
  PROVEN: 0.86,
  ATTENTION: 0.42,
  BLOCKED: 0.25,
  STALE: 0.32,
  FAILED: 0.14,
};

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

function orderedGates(command: CommandView): MissionGateView[] {
  return command.gates.slice().sort((a, b) => a.position - b.position);
}

function activeGateIndex(gates: MissionGateView[]): number {
  let active = -1;
  gates.forEach((gate, index) => {
    if (gate.state !== 'UNKNOWN') active = index;
  });
  return active;
}

function gatePercent(index: number, count: number): number {
  if (count <= 1) return 50;
  return 8 + (index / (count - 1)) * 84;
}

function visualState(command: CommandView, gates: MissionGateView[]) {
  const finalGate = gates.at(-1);
  if (finalGate?.state === 'PROVEN') return 'proven';
  if (command.mission.blocker) return 'blocked';
  if (command.project.observation_state === 'STALE' || command.github_evidence.signal_state === 'STALE') return 'stale';
  if (command.mission.state === 'SHIP_READY') return 'ready';
  return 'building';
}

function sourceTruth(command: CommandView): string {
  if (command.project.observation_state === 'OBSERVED') return 'OBSERVED';
  if (command.project.observation_state === 'STALE') return 'STALE';
  if (command.project.observation_state === 'FAILED') return 'FAILED';
  if (command.project.observation_state === 'ACTIVE') return 'ACTIVE';
  return 'UNKNOWN';
}

function shipLabel(command: CommandView, gates: MissionGateView[]): string {
  const finalGate = gates.at(-1);
  if (finalGate?.state === 'PROVEN') return 'PROVEN';
  if (command.mission.state === 'SHIP_READY') return 'READY';
  return 'LOCKED';
}

function AsciiSignalField({progressPercent, state}: {progressPercent: number; state: string}) {
  const rows = [
    '·     .       :           ·       .         ·      :',
    '    .      ·        .          :      ·            .',
    '  ·      :       ·        .         .        ·      ',
    '      .       ·      :          ·        .           ',
    '·        .         ·       .          :        ·     ',
    '   :        ·         .         ·        .           ',
    '      ·         .         :          ·        .      ',
  ].join('\n');

  return (
    <div
      className="command-ascii-ripple"
      data-signal-ripple="true"
      data-tone={state}
      aria-hidden="true"
      style={{'--ripple-x': `${progressPercent}%`} as CSSProperties}
    >
      <pre>{rows}</pre>
    </div>
  );
}

function RetainedThreadTrace({command, reducedMotion}: {command: CommandView; reducedMotion: boolean}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const baselineRef = useRef<Graphics | null>(null);
  const traceRef = useRef<Graphics | null>(null);
  const commandRef = useRef(command);
  const generationRef = useRef(0);

  commandRef.current = command;

  const draw = () => {
    const host = hostRef.current;
    const app = appRef.current;
    const baseline = baselineRef.current;
    const trace = traceRef.current;
    if (!host || !app || !baseline || !trace) return;

    const bounds = host.getBoundingClientRect();
    const width = Math.max(220, Math.round(bounds.width || 320));
    const height = Math.max(34, Math.round(bounds.height || 44));
    app.renderer.resize(width, height);

    baseline.clear();
    baseline.moveTo(0, height * 0.7).lineTo(width, height * 0.7);
    baseline.stroke({color: 0x34313a, width: 1, alpha: 0.72, pixelLine: true});

    const sourceValue = {
      UNKNOWN: 0.22,
      ACTIVE: 0.54,
      OBSERVED: 0.7,
      STALE: 0.32,
      FAILED: 0.14,
    }[commandRef.current.project.observation_state];
    const values = [sourceValue, ...commandRef.current.gates.map((gate) => gateSignalValue[gate.state])];

    trace.clear();
    values.forEach((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - Math.max(5, Math.min(height - 5, value * height));
      if (index === 0) trace.moveTo(x, y);
      else trace.lineTo(x, y);
    });
    trace.stroke({color: 0x73dfff, width: 1.1, alpha: 0.62});
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent)) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const boot = async () => {
      const app = new Application();
      await app.init({width: 320, height: 44, backgroundAlpha: 0, antialias: true, preference: 'webgl'});
      if (cancelled) {
        app.destroy(true, {children: true});
        return;
      }

      generationRef.current += 1;
      const baseline = new Graphics();
      const trace = new Graphics();
      appRef.current = app;
      baselineRef.current = baseline;
      traceRef.current = trace;
      app.stage.addChild(baseline, trace);

      app.canvas.className = 'command-pixi-canvas';
      app.canvas.setAttribute('aria-hidden', 'true');
      host.dataset.appGeneration = String(generationRef.current);
      host.replaceChildren(app.canvas);
      draw();

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(draw);
        resizeObserver.observe(host);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      appRef.current?.destroy(true, {children: true});
      appRef.current = null;
      baselineRef.current = null;
      traceRef.current = null;
      host.replaceChildren();
    };
  }, []);

  useEffect(draw, [command]);

  return (
    <div
      ref={hostRef}
      className="command-pixi-host"
      role="img"
      aria-label="Live command signal trace"
      data-renderer="pixi"
      data-renderer-lifecycle="retained"
      data-motion-policy={reducedMotion ? 'reduced' : 'full'}
    />
  );
}

function deltaSelector(delta: CommandProjectionDelta): string {
  if (delta.kind === 'GATE') return `[data-delta="GATE:${delta.gateKey}"]`;
  return `[data-delta="${delta.kind}"]`;
}

function LivingThread({command, reducedMotion}: {
  command: CommandView;
  deltas: CommandProjectionDelta[];
  reducedMotion: boolean;
}) {
  const gates = orderedGates(command);
  const activeIndex = activeGateIndex(gates);
  const progressPercent = activeIndex < 0 ? 0 : gatePercent(activeIndex, gates.length);
  const state = visualState(command, gates);
  const latest = command.github_evidence.latest_observation;
  const finalGate = gates.at(-1);
  const blocker = command.mission.blocker;

  return (
    <section
      className="command-thread-instrument"
      data-thread-state={state}
      style={{'--thread-progress': `${progressPercent}%`} as CSSProperties}
      aria-label="Living Thread mission instrument"
    >
      <div className="command-mission-copy" data-delta="MISSION">
        <span>MISSION / CURRENT</span>
        <h2>{command.mission.goal}</h2>
        <p>{command.mission.current_focus}</p>
      </div>

      <div className="command-thread-stage">
        <AsciiSignalField progressPercent={progressPercent} state={state} />

        <div className="command-source-endpoint" data-delta="SOURCE">
          <small>SOURCE</small>
          <strong>GitHub</strong>
          <span data-truth={sourceTruth(command).toLowerCase()}>{sourceTruth(command)}</span>
          <i>{command.project.source_visibility}</i>
          <em>{latest ? `${latest.kind} · ${latest.outcome}` : 'NO CURRENT OBSERVATION'}</em>
        </div>

        <div className="command-thread-scroll">
          <div className="command-thread-track">
            <div className="command-thread-base" aria-hidden="true" />
            <div className="command-thread-progress" aria-hidden="true" />
            <div className="command-thread-packet" data-thread-packet="true" aria-hidden="true" />
            <div className="command-thread-now" data-thread-now="true" aria-hidden="true"><span>NOW</span></div>

            {blocker ? (
              <div className="command-thread-break" data-delta="BLOCKER" aria-label={`Mission blocker: ${blocker}`}>
                <i aria-hidden="true" />
                <span>{blocker}</span>
              </div>
            ) : null}

            <ol className="command-thread-gates" aria-label="Mission gates">
              {gates.map((gate, index) => {
                const percent = gatePercent(index, gates.length);
                const current = index === activeIndex;
                return (
                  <li
                    key={gate.key}
                    className="command-thread-gate"
                    data-tone={gateTone[gate.state]}
                    data-truth={gate.state.toLowerCase()}
                    data-current={current ? 'true' : 'false'}
                    data-delta={`GATE:${gate.key}`}
                    style={{'--gate-x': `${percent}%`} as CSSProperties}
                  >
                    <span className="command-thread-node" aria-hidden="true" />
                    <b>{gate.label}</b>
                    <small>{gate.state}</small>
                  </li>
                );
              })}
            </ol>

            <div className="command-thread-trace">
              <RetainedThreadTrace command={command} reducedMotion={reducedMotion} />
            </div>
          </div>
        </div>

        <div className="command-ship-endpoint" data-delta="MISSION">
          <small>SHIP</small>
          <strong>{shipLabel(command, gates)}</strong>
          <span>{finalGate ? finalGate.label : 'NO GATE'}</span>
          <i>{command.mission.ship_condition}</i>
        </div>
      </div>

      <div className="command-next-move" data-delta="NEXT_MOVE">
        <span>NEXT MOVE</span>
        <div className="command-next-action">
          <h2>{command.mission.next_move}</h2>
          <b aria-hidden="true">→</b>
          <i className="command-next-sheen" data-next-sheen="true" aria-hidden="true" />
        </div>
      </div>

      <div className="command-context-line">
        <div className="command-rekt-slot" data-rekt-state={state} data-asset-status="placeholder" aria-label="REKT sprite asset slot">
          <svg viewBox="0 0 34 34" aria-hidden="true">
            <path className="command-rekt-outline" d="M9 9 13 4h8l5 5 3 5-3 2v9l-4 5H12l-4-5v-9l-3-2 4-5Z" />
            <path className="command-rekt-body" d="M10 13h14v11l-4 4h-6l-4-4V13Z" />
            <path className="command-rekt-eye" d="m12 16 4 1-2 2-2-1zM22 16l-4 1 2 2 2-1z" />
            <path className="command-rekt-tentacle" d="M17 28c1 3 5 3 6 1 1-2-1-3-2-2" />
          </svg>
          <span>REKT / {state === 'proven' ? 'PROVEN' : blocker ? 'BLOCKED' : sourceTruth(command) === 'OBSERVED' ? 'WORKING' : 'IDLE'}</span>
        </div>

        <aside className="command-advisory" data-delta="DAEMON" aria-label="Daemon advisory">
          <span>{command.daemon.authority.replace('_', ' ')}</span>
          <p>{command.daemon.what_changed}</p>
          {command.daemon.likely_blocker ? <p>LIKELY BLOCKER · {command.daemon.likely_blocker}</p> : null}
        </aside>
      </div>
    </section>
  );
}

function LiveProjection({command, deltas, eventSequence}: {
  command: CommandView;
  deltas: CommandProjectionDelta[];
  eventSequence: number;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    if (eventSequence === 0 || reducedMotion) return;
    const root = rootRef.current;
    if (!root) return;

    const timeline = gsap.timeline({defaults: {ease: MOTION_EASE.relay}});
    const hasSource = deltas.some((delta) => delta.kind === 'SOURCE');
    const gateDeltas = deltas.filter((delta) => delta.kind === 'GATE');
    const hasBlocker = deltas.some((delta) => delta.kind === 'BLOCKER');
    const hasMission = deltas.some((delta) => delta.kind === 'MISSION');
    const hasNextMove = deltas.some((delta) => delta.kind === 'NEXT_MOVE');
    const hasDaemon = deltas.some((delta) => delta.kind === 'DAEMON');

    if (hasSource) {
      const source = root.querySelector('[data-delta="SOURCE"]');
      const packet = root.querySelector('[data-thread-packet="true"]');
      const ripple = root.querySelector('[data-signal-ripple="true"]');
      if (source) timeline.fromTo(source, {opacity: 0.55}, {opacity: 1, duration: MOTION_SECONDS.snap});
      if (packet) {
        timeline.fromTo(
          packet,
          {left: '0%', opacity: 0, scale: 0.7},
          {left: 'var(--thread-progress)', opacity: 1, scale: 1, duration: MOTION_SECONDS.signal},
          '>-0.01',
        ).to(packet, {opacity: 0, duration: MOTION_SECONDS.snap});
      }
      if (ripple) {
        timeline.fromTo(
          ripple,
          {opacity: 0.05, scaleX: 0.995},
          {opacity: 0.18, scaleX: 1.004, duration: MOTION_SECONDS.relay},
          '-=0.12',
        ).to(ripple, {opacity: 0.07, scaleX: 1, duration: MOTION_SECONDS.relay});
      }
    }

    gateDeltas.forEach((delta) => {
      const target = root.querySelector(deltaSelector(delta));
      if (!target) return;
      timeline.fromTo(
        target,
        {y: -2, opacity: 0.56},
        {y: 0, opacity: 1, duration: MOTION_SECONDS.relay},
        hasSource ? '-=0.08' : '>',
      );
    });

    if (hasBlocker) {
      const blocker = root.querySelector('[data-delta="BLOCKER"]');
      if (blocker) timeline.fromTo(blocker, {scale: 0.94, opacity: 0}, {scale: 1, opacity: 1, duration: MOTION_SECONDS.mechanical}, '-=0.04');
    }

    if (hasMission) {
      const now = root.querySelector('[data-thread-now="true"]');
      if (now) timeline.fromTo(now, {y: -3, opacity: 0.45}, {y: 0, opacity: 1, duration: MOTION_SECONDS.mechanical}, '-=0.08');
    }

    if (hasNextMove) {
      const next = root.querySelector('[data-delta="NEXT_MOVE"]');
      const sheen = root.querySelector('[data-next-sheen="true"]');
      if (next) timeline.fromTo(next, {y: 3, opacity: 0.68}, {y: 0, opacity: 1, duration: MOTION_SECONDS.switch}, '-=0.04');
      if (sheen) {
        timeline.fromTo(
          sheen,
          {xPercent: -130, opacity: 0},
          {xPercent: 130, opacity: 0.34, duration: MOTION_SECONDS.signal},
          '-=0.04',
        ).to(sheen, {opacity: 0, duration: MOTION_SECONDS.snap});
      }
    }

    if (hasDaemon) {
      const daemon = root.querySelector('[data-delta="DAEMON"]');
      if (daemon) timeline.fromTo(daemon, {opacity: 0.42}, {opacity: 1, duration: MOTION_SECONDS.relay}, '-=0.05');
    }
  }, {scope: rootRef, dependencies: [eventSequence, reducedMotion], revertOnUpdate: true});

  return (
    <TerminalShell
      rootRef={rootRef}
      mode="COMMAND"
      kicker="REKT / COMMAND"
      title={command.project.name}
      readout={[
        {label: 'LINK', value: command.github_evidence.source_state},
        {label: 'STATE', value: command.mission.state},
      ]}
      eventStatus={<>EVENT // {eventSequence === 0 ? 'LIVE PROJECTION LOADED' : summarizeCommandDeltas(deltas)}</>}
      workspaceClassName="command-console"
      className="command-live"
      motion="gsap"
      motionPolicy={reducedMotion ? 'reduced' : 'full'}
      crt="off"
      eventSequence={eventSequence}
      footerItems={['THREAD // CANONICAL PROJECTION', 'CLAIMED ≠ OBSERVED ≠ PROVEN']}
    >
      <LivingThread command={command} deltas={deltas} reducedMotion={reducedMotion} />
    </TerminalShell>
  );
}

function CommandLoadingState({error}: {error?: string}) {
  const failed = Boolean(error);
  return (
    <TerminalShell
      mode="COMMAND"
      kicker="REKT / COMMAND"
      title={failed ? 'COMMAND LINK UNAVAILABLE' : 'CONNECTING COMMAND BUS'}
      description={failed ? 'Canonical private command projection is unavailable; the machine remains fail-closed.' : 'Waiting for canonical `/v1/me/command` projection.'}
      readout={[
        {label: 'MODE', value: 'COMMAND'},
        {label: 'LINK', value: failed ? 'OFFLINE' : 'CONNECTING'},
      ]}
      workspaceClassName="ios-shell-loading"
      className="command-live"
      role={failed ? 'alert' : undefined}
      crt="off"
      footerItems={['GENERATED API CLIENT', 'NO FIXTURE FALLBACK', 'CLAIMED ≠ OBSERVED ≠ PROVEN']}
    >
      <div className="ios-shell-loading-panel" data-state={failed ? 'error' : 'pending'}>
        <small>{failed ? 'FAIL CLOSED // CANONICAL SOURCE UNAVAILABLE' : 'RX // WAITING FOR COMMAND PROJECTION'}</small>
        <h2>{failed ? 'CANONICAL SOURCE OFFLINE' : 'AWAITING PROJECTION'}</h2>
        {failed ? <p>{error}</p> : null}
        {failed ? <p>No development fixture fallback is permitted.</p> : null}
      </div>
    </TerminalShell>
  );
}

export default function LiveCommand({
  client = createInkubatorApiClient(),
  refetchIntervalMs = 2500,
}: LiveCommandProps) {
  const previousRef = useRef<CommandView | null>(null);
  const [deltas, setDeltas] = useState<CommandProjectionDelta[]>([]);
  const [eventSequence, setEventSequence] = useState(0);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => client.getMyCommand(),
    refetchInterval: refetchIntervalMs,
    retry: 1,
  });

  useEffect(() => {
    if (!query.data) return;
    const previous = previousRef.current;
    previousRef.current = query.data;
    if (!previous) return;

    const nextDeltas = diffCommandProjection(previous, query.data);
    if (nextDeltas.length === 0) return;
    setDeltas(nextDeltas);
    setEventSequence((value) => value + 1);
  }, [query.data, query.dataUpdatedAt]);

  const errorMessage = useMemo(() => {
    if (!(query.error instanceof Error)) return 'command_projection_unavailable';
    return query.error.message;
  }, [query.error]);

  if (query.isPending) return <CommandLoadingState />;
  if (query.isError || !query.data) return <CommandLoadingState error={errorMessage} />;

  return <LiveProjection command={query.data} deltas={deltas} eventSequence={eventSequence} />;
}
