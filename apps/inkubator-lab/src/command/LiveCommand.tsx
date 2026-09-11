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
import {CommandActions} from '../journey/CommandActions';
import './live-command.css';

type CommandClient = Pick<InkubatorApiClient, 'getMyCommand'>;
export type LiveCommandProps = {client?: CommandClient; refetchIntervalMs?: number | false};
const QUERY_KEY = ['inkubator', 'command', 'me'] as const;

type PrimaryAction = {label: string; href: string; mode?: InstrumentMode; targetId?: string};

export function commandPrimaryAction(command: CommandView): PrimaryAction {
  if (command.mission.state === 'SHIP_READY') return {label: 'OPEN SHIP', href: '?mode=ship', mode: 'SHIP'};
  if (!command.project.source_connected) return {label: 'CONNECT SOURCE', href: '#command-source-control', targetId: 'command-source-control'};
  if (command.mission.blocker) return {label: 'ASK FOR HELP', href: '#command-help-control', targetId: 'command-help-control'};
  return {label: 'OPEN PROJECT', href: '?mode=project', mode: 'PROJECT'};
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
  const gates = command.gates.slice().sort((a, b) => a.position - b.position);
  const signal = channelError ? {cue: 'UNAVAILABLE' as const} : commandCue(command, deltas);
  const latest = command.github_evidence.latest_observation;
  const primaryAction = commandPrimaryAction(command);
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
          <a className="command-primary-action" href={primaryAction.href} onClick={event => {
            if (primaryAction.mode && navigation) {
              event.preventDefault();
              navigation.onModeSelect(primaryAction.mode);
              return;
            }
            if (primaryAction.targetId) {
              const target = document.getElementById(primaryAction.targetId) as HTMLDetailsElement | null;
              if (!target) return;
              event.preventDefault();
              target.open = true;
              target.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'center'});
              target.querySelector<HTMLElement>('button,input,textarea,select,summary')?.focus();
            }
          }}>{primaryAction.label} →</a>
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
