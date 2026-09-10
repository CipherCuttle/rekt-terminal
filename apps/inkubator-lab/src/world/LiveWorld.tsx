import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {InkubatorApiClient, WorldSignalView} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {PeripheralSignal} from '../instrument-os/PeripheralSignal';
import {TerminalShell} from '../shell/TerminalShell';
import './live-world-v2.css';

type WorldClient = Pick<InkubatorApiClient, 'discoverProjects' | 'listWorldSignals'>;
export type LiveWorldProps = {client?: WorldClient; refetchIntervalMs?: number | false};
const signalKey = ['inkubator', 'world', 'signals'] as const;
const projectKey = ['inkubator', 'world', 'projects'] as const;

function signalLabel(signal: WorldSignalView) { return signal.kind.replaceAll('_', ' '); }

export default function LiveWorld({client = createInkubatorApiClient(), refetchIntervalMs = 2500}: LiveWorldProps) {
  const signals = useQuery({queryKey: signalKey, queryFn: () => client.listWorldSignals(), refetchInterval: refetchIntervalMs, retry: false});
  const projects = useQuery({queryKey: projectKey, queryFn: () => client.discoverProjects(), refetchInterval: refetchIntervalMs, retry: false});
  const [selectedId, setSelectedId] = useState<string>();
  const previousIds = useRef<Set<string> | null>(null);
  const [eventSequence, setEventSequence] = useState(0);
  const [arrivalId, setArrivalId] = useState<string>();
  const ordered = [...(signals.data ?? [])].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || a.signal_id.localeCompare(b.signal_id));
  const selected = ordered.find(signal => signal.signal_id === selectedId) ?? ordered[0];
  const context = !projects.error ? projects.data?.find(entry => entry.project.project_id === selected?.project_id) : undefined;
  const stale = Boolean(signals.error && signals.data);

  useEffect(() => {
    if (!signals.data || signals.error) return;
    const next = new Set(signals.data.map(signal => signal.signal_id));
    const previous = previousIds.current;
    previousIds.current = next;
    if (!previous) return;
    const added = signals.data.filter(signal => !previous.has(signal.signal_id));
    if (!added.length) return;
    setArrivalId(added.map(signal => signal.signal_id).join(':'));
    setEventSequence(value => value + 1);
  }, [signals.data, signals.error]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowDown' ? Math.min(index + 1, ordered.length - 1) : event.key === 'ArrowUp' ? Math.max(index - 1, 0) : event.key === 'Home' ? 0 : event.key === 'End' ? ordered.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setSelectedId(ordered[next].signal_id);
    event.currentTarget.closest('ol')?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  }

  return <TerminalShell mode="WORLD" kicker="WORLD / PUBLIC EVENTS" title="Public signal." description="Useful events around you. Public evidence, in time order." workspaceClassName="world-workspace" className="world-live" eventSequence={eventSequence} footerItems={['PUBLIC EVENTS / UTC', 'CLAIMED ≠ OBSERVED ≠ PROVEN']}>
    <header className="faceplate-print-head"><span>01 /</span><h2>RECEIVER / SIGNAL TAPE</h2><small>NEWEST FIRST · SELECT TO INSPECT</small></header>
    <div className="faceplate-split">
      <section className="faceplate-display world-tape" aria-label="Public event index" data-stale={stale}>
        <header className="world-display-head"><div><small>PUBLIC CHANNEL</small><h2>World receiver<span aria-hidden="true">_</span></h2></div><span>{signals.isPending ? 'LOADING' : signals.error ? stale ? 'STALE' : 'UNAVAILABLE' : `${ordered.length} EVENTS`}</span></header>
        <div className="world-receiver-status"><span>{signals.error ? 'INPUT UNAVAILABLE' : signals.isPending ? 'READING PUBLIC EVENTS' : 'PUBLIC EVENT RECORD'}</span>{!signals.error && !signals.isPending && <PeripheralSignal cue="SOURCE_RX" eventId={arrivalId} />}</div>
        {signals.error ? <div className="world-input-state" role="status"><strong>{stale ? 'STALE PUBLIC SNAPSHOT' : 'WORLD LINK UNAVAILABLE'}</strong><p>{stale ? 'The last received records remain available for inspection. New events cannot be checked.' : 'Public events could not be loaded.'}</p>{signals.dataUpdatedAt > 0 && <time dateTime={new Date(signals.dataUpdatedAt).toISOString()}>LAST RECEIVED / {new Date(signals.dataUpdatedAt).toISOString()}</time>}<button type="button" onClick={() => void signals.refetch()}>Retry public events</button></div> : signals.isPending ? <div className="world-input-state" role="status"><strong>READING PUBLIC EVENTS</strong><p>The public channel is loading.</p></div> : !ordered.length ? <div className="world-input-state"><strong>NO PUBLIC SIGNALS</strong><p>New public help and evidence records will appear here.</p></div> : null}
        <ol className="world-event-list">{ordered.map((signal, index) => <li key={signal.signal_id}><button className="faceplate-record" type="button" aria-pressed={selected?.signal_id === signal.signal_id} onClick={() => setSelectedId(signal.signal_id)} onKeyDown={event => navigate(event, index)}><time dateTime={signal.occurred_at}>{signal.occurred_at.slice(0, 10)}<small>{signal.occurred_at.slice(11, 16)} UTC</small></time><span><strong>{signalLabel(signal)}</strong><small>{signal.project_name}</small></span><b data-truth={signal.truth_state.toLowerCase()}>{signal.truth_state}</b><span aria-hidden="true">↗</span></button></li>)}</ol>
        <footer>↑ ↓ HOME END TO INSPECT / TIME ORDER, NO RANKING</footer>
      </section>
      <aside className="faceplate-inspector" aria-label="Selected public event"><small>SELECTED EVENT{stale ? ' / STALE SNAPSHOT' : ''}</small>{selected ? <>
        <span className="world-truth" data-truth={selected.truth_state.toLowerCase()}>{selected.truth_state}</span><h2>{signalLabel(selected)}</h2><p>{selected.project_name}</p>
        <dl><div><dt>OCCURRED / UTC</dt><dd><time dateTime={selected.occurred_at}>{selected.occurred_at}</time></dd></div><div><dt>REFERENCE</dt><dd><code>{selected.signal_id}</code></dd></div><div><dt>PUBLIC PROJECT</dt><dd>{selected.project_name}</dd></div></dl>
        <p>{selected.truth_state === 'OBSERVED' ? 'A supported public event was recorded. It does not establish an accepted Ship.' : 'A builder opened a public request for help. This is a declaration, not proof.'}</p>
        {projects.error ? <p role="status">PROJECT CONTEXT UNAVAILABLE</p> : projects.isPending ? <p role="status">Loading public project context.</p> : context?.open_help_beacon?.state === 'OPEN' ? <section className="world-beacon-context"><small>CURRENT OPEN HELP</small><h3>{context.open_help_beacon.summary}</h3><p>{context.open_help_beacon.skills_needed.join(' / ') || 'No skills specified.'}</p><p>OWNER / {context.owner.display_name}</p></section> : <p>No open help request in the current public project record.</p>}
      </> : <><h2>{signals.isPending ? 'Loading the channel.' : signals.error ? 'Channel unavailable.' : 'The channel is quiet.'}</h2><p>Select a public event to read its context.</p></>}</aside>
    </div>
  </TerminalShell>;
}
