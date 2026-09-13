import {useEffect, useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {InkubatorApiError, type CommandView, type InkubatorApiClient} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {PeripheralSignal} from '../instrument-os/PeripheralSignal';
import type {PeripheralCueKind} from '../instrument-os/peripheral-motion';
import {useReducedMotion} from '../instrument-os/use-reduced-motion';
import {TerminalShell} from '../shell/TerminalShell';
import {useInstrumentNavigation, type InstrumentMode} from '../shell/InstrumentNavigation';
import {diffCommandProjection, summarizeCommandDeltas, type CommandProjectionDelta} from './projection-delta';
import {commandGuidanceAction} from './command-guidance';
import {CommandActions} from '../journey/CommandActions';
import './live-command.css';

type CommandClient = Pick<InkubatorApiClient, 'getMyCommand'>;
export type LiveCommandProps = {client?: CommandClient; refetchIntervalMs?: number | false};
const QUERY_KEY = ['inkubator', 'command', 'me'] as const;

type PrimaryAction = {label: string; href: string; mode: InstrumentMode};

/**
 * Only expose an authority-changing destination when canonical state determines it.
 * Free-text Next Move stays the authority; guidance may reveal existing controls but
 * cannot invent proof, progress or a second Mission priority.
 */
export function commandPrimaryAction(command: CommandView): PrimaryAction | null {
  if (command.mission.state === 'SHIP_READY') return {label: 'OPEN SHIP', href: '?mode=ship', mode: 'SHIP'};
  return null;
}

/** One explanatory cue. Keys contain canonical values, never poll/lifecycle counters. */
export function commandCue(command: CommandView, deltas: CommandProjectionDelta[]): {cue: PeripheralCueKind; eventId?: string} {
  const evidence = command.github_evidence;
  if (evidence.signal_state === 'STALE') return {cue: 'STALE'};
  if (evidence.source_state !== 'AVAILABLE') return {cue: 'UNAVAILABLE'};
  if (command.mission.blocker) return {cue: 'MISSION_BLOCKED', eventId: `${command.mission.mission_id}:${command.mission.blocker}`};
  if (deltas.some(delta => delta.kind === 'NEXT_MOVE')) return {cue: 'NEXT_MOVE_CHANGED', eventId: `${command.mission.mission_id}:${command.mission.next_move}`};
  if (evidence.latest_observation && evidence.signal_state === 'OBSERVED') return {cue: 'SOURCE_RX', eventId: evidence.latest_observation.observation_id};
  return {cue: 'SOURCE_LINK', eventId: command.project.source_connected ? command.project.project_id : undefined};
}

function LiveProjection({command, deltas, eventSequence, channelError}: {command: CommandView; deltas: CommandProjectionDelta[]; eventSequence: number; channelError?: string}) {
  const navigation = useInstrumentNavigation();
  const reducedMotion = useReducedMotion();
  const [copyState, setCopyState] = useState<'IDLE' | 'COPIED' | 'FAILED'>('IDLE');
  const gates = command.gates.slice().sort((a, b) => a.position - b.position);
  const signal = channelError ? {cue: 'UNAVAILABLE' as const} : commandCue(command, deltas);
  const latest = command.github_evidence.latest_observation;
  const primaryAction = commandPrimaryAction(command);
  const guidanceAction = channelError ? null : commandGuidanceAction(command);

  useEffect(() => {
    setCopyState('IDLE');
  }, [command.mission.next_move]);

  function revealGuidanceControl(targetId: string) {
    const target = document.getElementById(targetId);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'start'});
  }

  async function copyNextMove() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(command.mission.next_move);
      setCopyState('COPIED');
    } catch {
      setCopyState('FAILED');
    }
  }

  return (
    <TerminalShell mode="COMMAND" kicker="REKT / COMMAND / WHAT NOW?" title={command.project.name}
      readout={[{label: 'LINK', value: command.github_evidence.source_state}, {label: 'STATE', value: command.mission.state}]}
      eventStatus={<>CHANGE // {eventSequence === 0 ? 'CANONICAL PROJECTION LOADED' : summarizeCommandDeltas(deltas)}</>}
      workspaceClassName="command-console" className="command-live" motion="peripheral-v1" eventSequence={eventSequence}
      motionPolicy={reducedMotion ? 'reduced' : 'full'}
      footerItems={['MISSION // CANONICAL PROJECTION', 'CLAIMED ≠ OBSERVED ≠ PROVEN']}>
      <section className="command-thread-instrument" aria-label="Living Thread mission instrument">
        <div className="command-mission-copy"><span>01 / CURRENT MISSION</span><h2>{command.mission.goal}</h2><p>{command.mission.current_focus}</p></div>
        <div className="command-next-move" data-delta="NEXT_MOVE"><span>NEXT MOVE / ONE ACTION</span><h2>{command.mission.next_move}</h2>
          {primaryAction ? <a className="command-primary-action" href={primaryAction.href} onClick={event => {
            if (!navigation) return;
            event.preventDefault();
            navigation.onModeSelect(primaryAction.mode);
          }}>{primaryAction.label} →</a> : null}
          {guidanceAction ? <div className="command-guidance" data-phase={guidanceAction.phase.toLowerCase()}>
            <small>INKUBATOR / {guidanceAction.phase}</small>
            <p>{guidanceAction.explanation}</p>
            {guidanceAction.kind === 'CONTROL' ? <button type="button" className="command-guidance-action" onClick={() => revealGuidanceControl(guidanceAction.targetId)}>{guidanceAction.label} →</button> : <button type="button" className="command-guidance-action" onClick={() => void copyNextMove()}>{copyState === 'COPIED' ? 'NEXT MOVE COPIED' : guidanceAction.label}</button>}
            {guidanceAction.kind === 'COPY_NEXT_MOVE' && copyState === 'FAILED' ? <span className="command-guidance-status" role="status">COPY UNAVAILABLE / select the Next Move above.</span> : null}
          </div> : null}
          {!channelError ? <CommandActions command={command}/> : null}
        </div>
        <div className="faceplate-display command-thread-stage">
          {channelError ? <p className="command-channel-error" role="alert">CHANNEL UNAVAILABLE / Last known state retained. Refresh to retry.</p> : null}
          <div className="command-display-title"><span>MISSION GATES / ORDERED STATE</span><span>{gates.length} RECORDS</span></div>
          <ol className="command-thread-gates" aria-label="Mission gates">{gates.map((gate, index) => <li key={gate.key} className="command-thread-gate" data-truth={gate.state.toLowerCase()} data-delta={`GATE:${gate.key}`}><span>{String(index + 1).padStart(2, '0')}</span><b>{gate.label}</b><small>{gate.state}</small></li>)}</ol>
          {command.mission.blocker ? <div className="command-thread-break"><small>BLOCKED</small><p>{command.mission.blocker}</p></div> : null}
          <div className="command-source-status"><PeripheralSignal {...signal}/><div><small>GITHUB / {command.project.source_visibility}</small><strong>{command.github_evidence.signal_state}</strong><p>{latest ? `${latest.kind} · ${latest.outcome}` : 'No current observation.'}</p>{latest ? <time dateTime={latest.observed_at}>LAST OBSERVED / {latest.observed_at}</time> : null}</div></div>
        </div>
        <aside className="command-advisory" aria-label="Daemon advisory"><span>{command.daemon.authority.replace('_', ' ')}</span><p>{command.daemon.what_changed}</p>{command.daemon.likely_blocker ? <p>LIKELY BLOCKER · {command.daemon.likely_blocker}</p> : null}<small>Advice does not change proof or acceptance.</small></aside>
        <div className="command-ship-condition"><span>SHIP CONDITION</span><p>{command.mission.ship_condition}</p></div>
      </section>
    </TerminalShell>
  );
}

function CommandLoadingState({error}: {error?: string}) {
  const failed = Boolean(error);
  return (
    <TerminalShell
      mode="COMMAND"
      kicker="REKT / COMMAND / WHAT NOW?"
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
  if (!query.data || (query.error instanceof InkubatorApiError && [401, 403].includes(query.error.status))) return <CommandLoadingState error={errorMessage} />;

  return <LiveProjection command={query.data} deltas={deltas} eventSequence={eventSequence} channelError={query.isError ? errorMessage : undefined} />;
}
