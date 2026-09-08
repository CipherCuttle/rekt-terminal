import {useEffect, useMemo, useRef, useState} from 'react';
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

function Sector({
  code,
  title,
  className = '',
  delta,
  children,
}: {
  code: string;
  title: string;
  className?: string;
  delta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`command-sector ${className}`} data-delta={delta}>
      <header className="command-sector-head">
        <span>{code}</span>
        <strong>{title}</strong>
        <i aria-hidden="true" />
      </header>
      <div className="command-sector-body">{children}</div>
    </section>
  );
}

function activeGatePosition(gates: MissionGateView[]): number {
  const touched = gates.filter((gate) => gate.state !== 'UNKNOWN');
  if (touched.length === 0) return 0;
  return Math.max(...touched.map((gate) => gate.position));
}

function MissionRatchet({command}: {command: CommandView}) {
  const ordered = [...command.gates].sort((a, b) => a.position - b.position);
  const maxPosition = Math.max(...ordered.map((gate) => gate.position), 1);
  const activePosition = activeGatePosition(ordered);
  const carriageX = 72 + (activePosition / maxPosition) * 500;
  const blocker = command.mission.blocker;
  const shipReady = command.mission.state === 'SHIP_READY' || command.mission.state === 'SHIPPED';

  return (
    <div className="command-mission" data-state={blocker ? 'blocked' : shipReady ? 'ready' : 'active'}>
      <svg className="command-ratchet" viewBox="0 0 680 230" role="img" aria-label="Mission progress ratchet">
        <path className="command-ratchet-spine" d="M46 142 C112 142 112 88 178 88 S244 160 310 160 S376 94 442 94 S508 142 602 142" />
        <path className="command-ratchet-hook" d="M602 142 C636 142 648 120 634 103 C624 91 610 99 616 110 C620 117 629 112 627 106" />
        {ordered.map((gate, index) => {
          const x = 86 + (gate.position / maxPosition) * 488;
          return (
            <g
              key={gate.key}
              className="command-detent"
              data-tone={gateTone[gate.state]}
              data-delta={`GATE:${gate.key}`}
              transform={`translate(${x} 0)`}
            >
              <path d="M0 116v52" />
              <circle cx="0" cy="108" r="4" />
              <text x="0" y="187" textAnchor="middle">{String(index + 1).padStart(2, '0')}</text>
            </g>
          );
        })}
        <g className="command-ratchet-carriage" transform={`translate(${carriageX} 0)`} data-delta="MISSION">
          <path className="command-ratchet-claw" d="M-24 118 h48 v18 l-10 10 v18 h-28 v-18 l-10-10z" />
          <path className="command-ratchet-jaw" d="M-10 136 l10 9 10-9" />
        </g>
        {blocker ? <path className="command-ratchet-break" d="M322 150 l10-17 10 18 10-17 10 16" /> : null}
      </svg>

      <div className="command-next-move" data-delta="NEXT_MOVE">
        <small>NEXT MOVE // CANONICAL</small>
        <h2>{command.mission.next_move}</h2>
        <p>{command.mission.current_focus}</p>
      </div>

      <div className="command-mission-meta">
        <span>{command.mission.state}</span>
        <span>{command.mission.progress_model_version}</span>
        <span>{command.mission.stack_source}</span>
      </div>
    </div>
  );
}

function RetainedCommandScope({command, reducedMotion}: {command: CommandView; reducedMotion: boolean}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const traceRef = useRef<Graphics | null>(null);
  const scannerRef = useRef<Graphics | null>(null);
  const commandRef = useRef(command);
  const reducedMotionRef = useRef(reducedMotion);
  const widthRef = useRef(320);
  const generationRef = useRef(0);

  commandRef.current = command;
  reducedMotionRef.current = reducedMotion;

  const draw = () => {
    const host = hostRef.current;
    const app = appRef.current;
    const grid = gridRef.current;
    const trace = traceRef.current;
    const scanner = scannerRef.current;
    if (!host || !app || !grid || !trace || !scanner) return;

    const bounds = host.getBoundingClientRect();
    const width = Math.max(240, Math.round(bounds.width || 320));
    const height = Math.max(92, Math.round(bounds.height || 112));
    widthRef.current = width;
    app.renderer.resize(width, height);

    grid.clear();
    for (let x = 0; x <= width; x += Math.max(40, Math.round(width / 6))) grid.moveTo(x, 0).lineTo(x, height);
    for (let y = 0; y <= height; y += Math.max(22, Math.round(height / 4))) grid.moveTo(0, y).lineTo(width, y);
    grid.stroke({color: 0x9d78ff, alpha: 0.12, pixelLine: true});

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
      const y = height - Math.max(6, Math.min(height - 6, value * height));
      if (index === 0) trace.moveTo(x, y);
      else trace.lineTo(x, y);
    });
    trace.stroke({color: 0x65dcff, width: 1.5});

    scanner.clear().circle(0, 0, 2.5).fill(0x65dcff);
    scanner.alpha = reducedMotionRef.current ? 0.25 : 0.62;
    scanner.y = height * 0.5;
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent)) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const boot = async () => {
      const app = new Application();
      await app.init({width: 320, height: 112, backgroundAlpha: 0, antialias: true, preference: 'webgl'});
      if (cancelled) {
        app.destroy(true, {children: true});
        return;
      }

      generationRef.current += 1;
      const grid = new Graphics();
      const trace = new Graphics();
      const scanner = new Graphics();
      appRef.current = app;
      gridRef.current = grid;
      traceRef.current = trace;
      scannerRef.current = scanner;
      app.stage.addChild(grid, trace, scanner);

      app.canvas.className = 'command-pixi-canvas';
      app.canvas.setAttribute('aria-hidden', 'true');
      host.dataset.appGeneration = String(generationRef.current);
      host.replaceChildren(app.canvas);
      draw();

      app.ticker.add((ticker) => {
        if (reducedMotionRef.current) return;
        scanner.x = (scanner.x + ticker.deltaTime * 0.55) % Math.max(widthRef.current, 1);
      });

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
      gridRef.current = null;
      traceRef.current = null;
      scannerRef.current = null;
      host.replaceChildren();
    };
  }, []);

  useEffect(draw, [command, reducedMotion]);

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

function LiveProjection({command, deltas, eventSequence}: {
  command: CommandView;
  deltas: CommandProjectionDelta[];
  eventSequence: number;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const latest = command.github_evidence.latest_observation;

  useGSAP(() => {
    if (eventSequence === 0 || reducedMotion) return;
    const root = rootRef.current;
    if (!root) return;

    const targets = deltas.flatMap((delta) => Array.from(root.querySelectorAll<HTMLElement | SVGElement>(deltaSelector(delta))));
    const uniqueTargets = [...new Set(targets)];
    if (uniqueTargets.length === 0) return;

    gsap.timeline({defaults: {ease: MOTION_EASE.relay}})
      .fromTo(uniqueTargets, {filter: 'brightness(1.65)', opacity: 0.62}, {filter: 'brightness(1)', opacity: 1, duration: MOTION_SECONDS.relay, stagger: 0.045});
  }, {scope: rootRef, dependencies: [eventSequence, reducedMotion], revertOnUpdate: true});

  return (
    <TerminalShell
      rootRef={rootRef}
      mode="COMMAND"
      kicker="REKT INK(CUBATOR) // LIVE COMMAND"
      title={command.project.name}
      description="Canonical private command projection. Backend observations move the instrument; the frontend does not mint truth."
      readout={[
        {label: 'PROJECT', value: command.project.project_id},
        {label: 'MISSION', value: command.mission.mission_id},
      ]}
      eventStatus={<>EVENT // {eventSequence === 0 ? 'LIVE PROJECTION LOADED' : summarizeCommandDeltas(deltas)}</>}
      workspaceClassName="command-console"
      className="command-live"
      motion="gsap"
      motionPolicy={reducedMotion ? 'reduced' : 'full'}
      crt="off"
      eventSequence={eventSequence}
      footerItems={[
        'TANSTACK QUERY // GENERATED API CLIENT',
        'GSAP // PROJECTION DELTAS ONLY',
        'PIXI // RETAINED SIGNAL TRACE',
        'CLAIMED ≠ OBSERVED ≠ PROVEN',
      ]}
    >
      <Sector code="10" title="MISSION / NEXT MOVE" className="command-sector--mission" delta="MISSION">
        <MissionRatchet command={command} />
      </Sector>

      <Sector code="01" title="SOURCE / OBSERVATION" className="command-sector--source" delta="SOURCE">
        <div className="command-source">
          <div><small>VISIBILITY</small><strong>{command.project.source_visibility}</strong></div>
          <div><small>OBSERVATION</small><strong>{command.project.observation_state}</strong></div>
          <div><small>SIGNAL</small><strong>{command.github_evidence.signal_state}</strong></div>
          <p>{command.github_evidence.reason_code}</p>
          {latest ? <p>LAST // {latest.kind} / {latest.outcome} / {latest.observed_at}</p> : <p>LAST // NO VALID OBSERVATION</p>}
        </div>
      </Sector>

      <Sector code="03" title="GATE TRACE" className="command-sector--scope">
        <RetainedCommandScope command={command} reducedMotion={reducedMotion} />
        <div className="command-scope-caption"><span>RX → GATES</span><b>{command.github_evidence.rule_version}</b></div>
      </Sector>

      <Sector code="06" title="THREAD / GATES" className="command-sector--gates">
        <ol className="command-gates">
          {command.gates.slice().sort((a, b) => a.position - b.position).map((gate) => (
            <li key={gate.key} data-tone={gateTone[gate.state]} data-truth={gate.state.toLowerCase()} data-delta={`GATE:${gate.key}`}>
              <span>{String(gate.position).padStart(2, '0')}</span>
              <div><b>{gate.label}</b><small>{gate.key}</small></div>
              <strong>{gate.state}</strong>
            </li>
          ))}
        </ol>
      </Sector>

      <Sector code="08" title="BLOCKER" className="command-sector--blocker" delta="BLOCKER">
        <div className="command-blocker" data-present={command.mission.blocker ? 'true' : 'false'}>
          <small>{command.mission.blocker ? 'MISSION BLOCKED' : 'NO DECLARED BLOCKER'}</small>
          <strong>{command.mission.blocker ?? '—'}</strong>
        </div>
      </Sector>

      <Sector code="09" title="DAEMON / ADVISORY" className="command-sector--daemon" delta="DAEMON">
        <div className="command-daemon">
          <span>{command.daemon.authority.replace('_', ' ')}</span>
          <b>{command.daemon.what_changed}</b>
          {command.daemon.likely_blocker ? <p>LIKELY BLOCKER // {command.daemon.likely_blocker}</p> : null}
          {command.daemon.scope_damage_warning ? <p>WARNING // {command.daemon.scope_damage_warning}</p> : null}
          <p>PROPOSED NEXT MOVE // {command.daemon.proposed_next_move}</p>
        </div>
      </Sector>

      <Sector code="04" title="MISSION CONTRACT" className="command-sector--contract">
        <dl className="command-contract">
          <div><dt>GOAL</dt><dd>{command.mission.goal}</dd></div>
          <div><dt>SHIP CONDITION</dt><dd>{command.mission.ship_condition}</dd></div>
          {command.round ? <div><dt>ROUND</dt><dd>{command.round.code} // {command.round.constraint}</dd></div> : null}
        </dl>
      </Sector>
    </TerminalShell>
  );
}

function CommandLoadingState({error}: {error?: string}) {
  const failed = Boolean(error);
  return (
    <TerminalShell
      mode="COMMAND"
      kicker="REKT INK(CUBATOR) // LIVE COMMAND"
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
