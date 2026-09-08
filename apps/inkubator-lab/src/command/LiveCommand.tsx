import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {useGSAP} from '@gsap/react';
import {useQuery} from '@tanstack/react-query';
import gsap from 'gsap';
import type {CommandView, InkubatorApiClient, HelpBeaconView} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {MOTION_EASE, MOTION_SECONDS} from '../instrument-os/motion-tokens';
import {diffCommandProjection, hasCurrentCommandSource, summarizeCommandDeltas, type CommandProjectionDelta} from './projection-delta';
import './live-command.css';

gsap.registerPlugin(useGSAP);
type CommandClient = Pick<InkubatorApiClient, 'getMyCommand'> & Partial<Pick<InkubatorApiClient, 'getProjectHelpLoop'>>;
export type LiveCommandProps = {client?: CommandClient; refetchIntervalMs?: number | false};
const QUERY_KEY = ['inkubator', 'command', 'me'] as const;
const isBreak = (state: string) => ['BLOCKED', 'FAILED', 'ATTENTION'].includes(state);

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

function CommandHeader() {
  return <header className="command-header"><a href="/" className="command-brand" aria-label="REKT home">REKT<span>INKUBATOR</span></a>
    <nav aria-label="Mode"><span aria-current="page">COMMAND</span><details><summary>Explore</summary><a href="?mode=world">World</a><a href="?mode=project">Project</a></details></nav>
  </header>;
}

function LiveProjection({command, help, deltas, eventSequence}: {
  command: CommandView; help?: HelpBeaconView; deltas: CommandProjectionDelta[]; eventSequence: number;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const lastPlayedRef = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);
  const [railWidth, setRailWidth] = useState(1000);
  useEffect(() => {
    if (!threadRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setRailWidth(entry.contentRect.width));
    observer.observe(threadRef.current);
    return () => observer.disconnect();
  }, []);
  const reduced = useReducedMotion();
  const gates = [...command.gates].sort((a, b) => a.position - b.position);
  const breakIndex = gates.findIndex(g => isBreak(g.state));
  const blocked = Boolean(command.mission.blocker) || command.mission.state === 'BLOCKED' || breakIndex >= 0;
  const proven = !blocked && command.mission.state === 'SHIPPED' && gates.some(g => g.key === 'SHIPABILITY' && g.state === 'PROVEN');
  const beacon = blocked && help?.state === 'OPEN' && help.project_id === command.project.project_id;
  const unresolvedIndex = gates.findIndex(g => !['OBSERVED', 'PROVEN'].includes(g.state));
  const activeIndex = Math.max(0, breakIndex >= 0 ? breakIndex : proven || unresolvedIndex < 0 ? gates.length - 1 : unresolvedIndex);
  const xAt = (index: number) => railWidth * (gates.length <= 1 ? .5 : .14 + index * .72 / (gates.length - 1));
  const locus = gates.length ? xAt(activeIndex) : 0;
  // A single silhouette, with one shallow detent between each canonical gate.
  const railTo = (end: number) => {
    let path = 'M0 50';
    for (let i = 0; i < gates.length - 1; i++) {
      const middle = (xAt(i) + xAt(i + 1)) / 2;
      if (middle + 20 < end) path += `H${middle - 20}l6 -4h14l6 4`;
    }
    return path + `H${end}`;
  };
  const state = proven ? 'proven' : beacon ? 'help' : blocked ? 'blocked' : 'building';
  const evidence = command.github_evidence;
  const currentSource = hasCurrentCommandSource(command);
  const latest = evidence.latest_observation;
  const rektState = proven ? 'PROVEN' : beacon ? 'BEACON' : blocked ? 'BLOCKED' : command.mission.state === 'CLOSED_NOT_SHIPPED' ? 'FAILED' : command.mission.state === 'SUBMITTED' ? 'VERIFYING' : command.mission.state === 'BUILDING' ? 'WORKING' : 'IDLE';
  const received = deltas.some(d => d.kind === 'SOURCE' && d.received);
  const changedGate = deltas.find(d => d.kind === 'GATE');
  const receivedIndex = changedGate?.kind === 'GATE' ? gates.findIndex(g => g.key === changedGate.gateKey) : activeIndex;
  const eventLocus = Math.min(xAt(receivedIndex < 0 ? activeIndex : receivedIndex), blocked ? locus : railWidth);

  useGSAP(() => {
    if (!eventSequence || lastPlayedRef.current === eventSequence) return;
    lastPlayedRef.current = eventSequence;
    if (reduced || !rootRef.current) return;
    const root = rootRef.current;
    const select = (selector: string) => root.querySelectorAll(selector);
    const timeline = gsap.timeline({defaults: {ease: MOTION_EASE.relay}});
    const has = (kind: CommandProjectionDelta['kind']) => deltas.some(d => d.kind === kind);
    // No generic pulse for polling, advisory changes, stale data or first paint.
    if (received && currentSource) {
      const path = root.querySelector<SVGPathElement>('.command-packet-route');
      const packet = root.querySelector('.command-packet');
      timeline.set(root, {attr: {'data-effect': 'source-wake'}}, 0)
        .fromTo(select('.command-source .command-socket'), {opacity: .35}, {opacity: 1, duration: MOTION_SECONDS.snap}, 0);
      if (path && packet && typeof path.getTotalLength === 'function') {
        const length = path.getTotalLength();
        const travel = {progress: 0};
        timeline.set(packet, {opacity: 1}, MOTION_SECONDS.snap)
          .set(root, {attr: {'data-effect': 'packet'}}, MOTION_SECONDS.snap)
          .to(travel, {progress: 1, duration: MOTION_SECONDS.relay, ease: 'none', onUpdate: () => {
            const point = path.getPointAtLength(length * travel.progress);
            gsap.set(packet, {attr: {cx: point.x, cy: point.y}});
          }}, MOTION_SECONDS.snap)
          .set(packet, {opacity: 0}, .25);
      }
      timeline.set(root, {attr: {'data-effect': 'received'}}, .25)
        .fromTo(select(`[data-delta="GATE:${gates[receivedIndex]?.key ?? gates[activeIndex]?.key}"]`),
          {opacity: .4}, {opacity: 1, duration: MOTION_SECONDS.relay}, .25)
        .fromTo(select('.command-ripple'), {opacity: .55, scale: .65}, {opacity: 0, scale: 1.2, duration: MOTION_SECONDS.signal}, .33)
        .set(root, {attr: {'data-effect': 'settling'}}, .43);
    }
    if (has('BLOCKER') || has('GATE')) {
      if (blocked) timeline.fromTo(select('.command-break'), {opacity: .35}, {opacity: 1, duration: MOTION_SECONDS.snap}, 0);
      if (proven) timeline.fromTo(select('.command-proof-segment'), {opacity: .25}, {opacity: 1, duration: MOTION_SECONDS.ceremony}, .07)
        .fromTo(select('.command-ripple'), {opacity: .65, scale: .8}, {opacity: 0, scale: 1.3, duration: MOTION_SECONDS.ceremony}, .18);
    }
    if (has('HELP') && beacon) timeline.fromTo(select('.command-beacon-ring'), {opacity: .8, scale: .5}, {opacity: 0, scale: 1.5, duration: MOTION_SECONDS.signal}, .07);
    if (has('NEXT_MOVE')) timeline.fromTo(select('.command-action summary'), {opacity: .7}, {opacity: 1, duration: MOTION_SECONDS.switch}, received ? .43 : .12);
    if (timeline.duration()) timeline.set(root, {attr: {'data-effect': 'settled'}});
  }, {scope: rootRef, dependencies: [eventSequence, reduced], revertOnUpdate: true});

  return <main ref={rootRef} className="command-live" data-state={state} data-motion-policy={reduced ? 'reduced' : 'full'} data-event-sequence={eventSequence}>
    <CommandHeader />
    <section className="command-content">
      <section className="command-mission-copy" data-delta="MISSION" aria-labelledby="command-mission-title">
        <span className="command-kicker">MISSION</span>
        <h1 id="command-mission-title">{command.mission.goal}</h1>
        <p>{command.project.name} <span aria-hidden="true"> / </span> <span>{command.mission.state.replaceAll('_', ' ')}</span></p>
      </section>
      <section className="command-instrument" aria-label="Living Thread">
        <div className="command-flow">
          <div className="command-endpoint command-source" data-delta="SOURCE" data-current={currentSource}>
            <span className="command-kicker">SOURCE</span><strong><svg className="command-socket" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5H2v14h3M5 8h9v8H5zM14 10h5v4h-5M19 12h5M8 10v4" /></svg>GitHub</strong>
            <span>{currentSource ? 'OBSERVED' : evidence.signal_state === 'OBSERVED' ? 'UNAVAILABLE' : evidence.signal_state}</span>
            <small>{command.project.source_visibility}</small>
          </div>
          <div ref={threadRef} className="command-thread" style={{'--locus': `${locus / railWidth * 100}%`, '--event-locus': `${(proven ? locus : eventLocus) / railWidth * 100}%`} as CSSProperties}>
            <svg className="command-rail" viewBox={`0 0 ${railWidth} 100`} preserveAspectRatio="none" aria-hidden="true">
              <path className="command-rail-rest" d={blocked ? `M${locus + 16} 50H${railWidth}` : railTo(railWidth)} />
              <path className="command-rail-active" d={railTo(blocked ? Math.max(0, locus - 14) : locus)} />
              <path className="command-source-lead" data-current={currentSource} d="M0 46v8M0 50h24" />
              {proven ? <path className="command-proof-segment" d={`M${locus} 50H${railWidth}`} /> : null}
              {gates.map((gate, index) => <g key={gate.key} transform={`translate(${xAt(index)} 50)`} data-delta={`GATE:${gate.key}`} data-truth={gate.state.toLowerCase()} className="command-node">
                <circle r={index === activeIndex ? 6 : 4} />
                {index === activeIndex ? <path className="command-locus-bracket" d="M-12-5v-6h6M6-11h6v6M-12 5v6h6M6 11h6V5" /> : null}
                {isBreak(gate.state) ? <path className="command-break" d="M-7-7 7 7M-7 7 7-7" /> : null}
              </g>)}
              {blocked && breakIndex < 0 ? <path className="command-break" d={`M${locus - 7} 43l14 14m-14 0 14-14`} /> : null}
              <path className="command-packet-route" d={railTo(blocked ? Math.min(eventLocus, locus - 14) : eventLocus)} />
              <circle className="command-packet" cx="0" cy="50" r="3" />
            </svg>
            <ol className="command-gates" aria-label="Mission gates">
              {gates.map((gate, index) => <li key={gate.key} style={{left: `${xAt(index) / railWidth * 100}%`}} data-truth={gate.state.toLowerCase()}>
                <span>{gate.label}</span><small>{gate.state}</small>
              </li>)}
            </ol>
            <div className="command-locus" data-delta="BLOCKER"><span>↑</span><b>NOW</b>
              {blocked ? <strong>{beacon ? 'HELP ACTIVE' : 'BLOCKED'}</strong> : proven ? <strong>PROVEN</strong> : null}
              {beacon ? <i className="command-beacon-ring" data-delta="HELP" aria-hidden="true" /> : null}
            </div>
            <pre className="command-ripple" aria-hidden="true">{'   · : ·\n · : + : ·\n   · : ·'}</pre>
          </div>
          <div className="command-endpoint command-ship" data-proven={proven}><span className="command-kicker">SHIP</span><svg className="command-socket" viewBox="0 0 24 24" aria-hidden="true"><path d="M0 12h8m-3-7h3v14H5M11 8h7v8h-7M21 5h2v14h-2M11 12h4" /></svg><strong>{proven ? 'PROVEN' : blocked ? 'LOCKED' : 'NOT PROVEN'}</strong></div>
        </div>
        <div className="command-trace" data-current={currentSource}>
          {latest ? <><svg viewBox="0 0 160 16" aria-hidden="true"><path d="M0 8H72m0 0v-4h4v8h4V8h80" /></svg><span>{latest.kind} / {latest.outcome} · <time dateTime={latest.observed_at}>{latest.observed_at}</time>{!currentSource ? ' / NOT CURRENT' : ''}</span></> : <span>No valid source observation</span>}
        </div>
      </section>
      <section className="command-next-move" data-delta="NEXT_MOVE" aria-labelledby="command-next-title">
        <span className="command-kicker">NEXT MOVE</span>
        <details className="command-action"><summary><h2 id="command-next-title">{command.mission.next_move}</h2><span className="command-action-line" aria-hidden="true">→</span></summary>
          <div className="command-action-detail"><p>{command.mission.current_focus}</p><p>Ship condition: {command.mission.ship_condition}</p></div>
        </details>
        <p>{blocked ? command.mission.blocker ?? 'A mission gate needs attention.' : command.mission.current_focus}</p>
      </section>
      <div className="command-lower">
        <details className="command-context"><summary>Context / provenance</summary><div>
          <p>{evidence.reason_code} · {evidence.rule_version}</p>
          <p>{command.mission.progress_model_version}</p>
          <p>Ship condition: {command.mission.ship_condition}</p>
          <div data-delta="DAEMON"><b>ADVISORY ONLY</b><p>{command.daemon.what_changed}</p><p>{command.daemon.proposed_next_move}</p></div>
        </div></details>
        <div className="command-rekt" aria-label={`REKT ${rektState} — canonical sprite placeholder`}>
          <span className="command-rekt-slot" aria-hidden="true">R</span><span>REKT / <b data-rekt-state>{rektState}</b><b className="command-rekt-rx" aria-hidden="true">RX</b></span><small>SPRITE PLACEHOLDER</small>
        </div>
        <span className="command-state">{beacon ? 'HELP ACTIVE' : blocked ? 'BLOCKED' : command.mission.state.replaceAll('_', ' ')}</span>
      </div>
    </section>
    <footer className="command-footer"><span role="status">{eventSequence ? `EVENT // ${summarizeCommandDeltas(deltas)}` : 'COMMAND / PRIVATE VIEW'}
      <span className="command-sr-only">{deltas.some(d => d.kind === 'SOURCE') ? ' SOURCE CHANGED.' : ''}{deltas.some(d => d.kind === 'NEXT_MOVE') ? ' NEXT MOVE CHANGED.' : ''}{beacon ? ' HELP ACTIVE.' : blocked ? ' BLOCKED.' : proven ? ' PROVEN.' : ''}</span>
    </span><span>CLAIMED ≠ OBSERVED ≠ PROVEN</span></footer>
  </main>;
}

function CommandLoadingState({error}: {error?: string}) {
  return <main className="command-live"><CommandHeader /><section className="command-content command-loading" role={error ? 'alert' : 'status'}>
    <span className="command-kicker">COMMAND</span><h1>{error ? 'COMMAND LINK UNAVAILABLE' : 'CONNECTING COMMAND'}</h1>
    <p>{error ?? 'Waiting for the canonical command projection.'}</p>
    {error ? <p>No development fixture fallback is permitted.</p> : null}
  </section></main>;
}

export default function LiveCommand({client: suppliedClient, refetchIntervalMs = 2500}: LiveCommandProps) {
  const client = useMemo(() => suppliedClient ?? createInkubatorApiClient(), [suppliedClient]);
  const previousRef = useRef<{command: CommandView; help?: HelpBeaconView} | null>(null);
  const [deltas, setDeltas] = useState<CommandProjectionDelta[]>([]);
  const [eventSequence, setEventSequence] = useState(0);
  const query = useQuery({queryKey: QUERY_KEY, queryFn: () => client.getMyCommand(), refetchInterval: refetchIntervalMs, retry: 1});
  const projectId = query.data?.project.project_id;
  const helpQuery = useQuery({
    queryKey: ['inkubator', 'command-help', projectId],
    queryFn: () => client.getProjectHelpLoop!(projectId!),
    enabled: Boolean(projectId && !query.isError && client.getProjectHelpLoop),
    refetchInterval: refetchIntervalMs, retry: false,
  });
  const help = !helpQuery.isError && helpQuery.data?.project_id === projectId ? helpQuery.data?.open_help_beacon : undefined;
  useEffect(() => {
    if (!query.data || query.isError) { previousRef.current = null; return; }
    const previous = previousRef.current;
    previousRef.current = {command: query.data, help};
    if (!previous || previous.command.mission.mission_id !== query.data.mission.mission_id) return;
    const next = diffCommandProjection(previous.command, query.data, previous.help, help);
    if (!next.length) return;
    setDeltas(next);
    setEventSequence(value => value + 1);
  }, [query.data, query.dataUpdatedAt, query.isError, help]);
  if (query.isPending) return <CommandLoadingState />;
  if (query.isError || !query.data) return <CommandLoadingState error={query.error instanceof Error ? query.error.message : 'command_projection_unavailable'} />;
  return <LiveProjection key={query.data.mission.mission_id} command={query.data} help={help} deltas={deltas} eventSequence={eventSequence} />;
}
