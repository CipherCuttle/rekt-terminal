import {useEffect, useRef, useState, type FormEvent, type KeyboardEvent} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {InkubatorApiError, type InkubatorApiClient, type ProjectDiscoveryView, type WorldSignalView} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {PeripheralSignal} from '../instrument-os/PeripheralSignal';
import {useReducedMotion} from '../instrument-os/use-reduced-motion';
import {mutationAlert} from '../journey/mutation-alert';
import {TerminalShell} from '../shell/TerminalShell';
import '../journey/journey.css';
import './live-world-v2.css';

type WorldClient = Pick<InkubatorApiClient, 'discoverProjects' | 'listWorldSignals' | 'getMe' | 'offerAssist' | 'getProjectExternalTests' | 'recordExternalTestResult'>;
export type LiveWorldProps = {client?: WorldClient; refetchIntervalMs?: number | false};
const signalKey = ['inkubator', 'world', 'signals'] as const;
const projectKey = ['inkubator', 'world', 'projects'] as const;

function signalLabel(signal: WorldSignalView) { return signal.kind.replaceAll('_', ' '); }

function WorldParticipation({context, client, refetchIntervalMs}: {context: ProjectDiscoveryView; client: WorldClient; refetchIntervalMs: number | false}) {
  const cache = useQueryClient();
  const me = useQuery({queryKey: ['inkubator', 'world', 'me'], queryFn: () => client.getMe(), retry: false, staleTime: 30_000, refetchOnWindowFocus: 'always'});
  const tests = useQuery({
    queryKey: ['inkubator', 'world', context.project.project_id, 'tests'],
    queryFn: () => client.getProjectExternalTests(context.project.project_id),
    retry: false,
    staleTime: 0,
    refetchInterval: refetchIntervalMs,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  const [assistMessage, setAssistMessage] = useState('');
  const [testOutcome, setTestOutcome] = useState<'PASS' | 'ISSUE_FOUND' | 'BLOCKED'>('PASS');
  const [testSummary, setTestSummary] = useState('');
  const [assistRequestId, setAssistRequestId] = useState(() => crypto.randomUUID());
  const [testRequestId, setTestRequestId] = useState(() => crypto.randomUUID());

  const assist = useMutation({
    mutationFn: () => client.offerAssist(context.open_help_beacon!.beacon_id, {request_id: assistRequestId, message: assistMessage.trim()}),
    onSuccess: async () => {await cache.invalidateQueries({queryKey: ['inkubator']});},
  });
  const openTest = tests.data?.requests.find(request => request.state === 'OPEN');
  const recordTest = useMutation({
    mutationFn: () => client.recordExternalTestResult(openTest!.test_request_id, {request_id: testRequestId, outcome: testOutcome, summary: testSummary.trim()}),
    onSuccess: async () => {await cache.invalidateQueries({queryKey: ['inkubator']});},
  });

  function submitAssist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assistMessage.trim() || assist.isPending || !context.open_help_beacon) return;
    assist.mutate();
  }
  function submitTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!testSummary.trim() || recordTest.isPending || !openTest) return;
    recordTest.mutate();
  }

  if (me.isPending) return <section className="world-participation" role="status"><small>PARTICIPATION</small><p>Checking whether you can respond to this build…</p></section>;
  if (me.error) {
    const signedOut = me.error instanceof InkubatorApiError && me.error.status === 401;
    return <section className="world-participation"><small>PARTICIPATION</small>{signedOut ? <><p>WORLD is public. Sign in when you want to help or record an external test.</p><a href="/v1/auth/github/start">ENTER WITH GITHUB →</a></> : <p role="status">Participation state unavailable. Public WORLD remains readable.</p>}</section>;
  }

  const isOwner = me.data?.player_id === context.owner.player_id;
  if (isOwner) return <section className="world-participation"><small>YOUR PROJECT</small><p>Manage Help and external-test requests in COMMAND. WORLD stays the public receiver.</p><a href="?mode=command">OPEN COMMAND →</a></section>;

  return <section className="world-participation" aria-label="Respond to selected project">
    <small>RESPOND / REAL ACTIONS</small>
    {context.open_help_beacon?.state === 'OPEN' ? assist.isSuccess ? <div role="status"><strong>ASSIST OFFER SENT</strong><p>Your offer is CLAIMED and is waiting for the project owner to accept it.</p></div> : <form onSubmit={submitAssist} onChange={() => {setAssistRequestId(crypto.randomUUID()); assist.reset();}}><fieldset disabled={assist.isPending}><label>Offer help<textarea aria-label="Assist message" value={assistMessage} maxLength={240} required onChange={event => setAssistMessage(event.target.value)} placeholder="What can you do to unblock this build?" /></label><button type="submit" disabled={!assistMessage.trim()}>{assist.isPending ? 'Sending…' : 'OFFER ASSIST →'}</button>{assist.isError ? <p role="alert">{mutationAlert(assist.error)}</p> : null}<p>An offer is a claim. Credit exists only after owner acceptance and later Ship attribution.</p></fieldset></form> : null}

    {tests.isError ? <p role="status">EXTERNAL TEST STATE UNAVAILABLE. Public event context remains readable.</p> : tests.isPending ? <p role="status">Checking open external tests…</p> : openTest ? recordTest.isSuccess ? <div role="status"><strong>TEST RESULT RECORDED / OBSERVED</strong><p>{recordTest.data.outcome} / {recordTest.data.summary}</p></div> : <form onSubmit={submitTest} onChange={() => {setTestRequestId(crypto.randomUUID()); recordTest.reset();}}><fieldset disabled={recordTest.isPending}><p><strong>TEST REQUEST</strong><br />{openTest.prompt}</p><label>Outcome<select aria-label="External test outcome" value={testOutcome} onChange={event => setTestOutcome(event.target.value as 'PASS' | 'ISSUE_FOUND' | 'BLOCKED')}><option>PASS</option><option>ISSUE_FOUND</option><option>BLOCKED</option></select></label><label>What did you observe?<textarea aria-label="External test summary" value={testSummary} maxLength={500} required onChange={event => setTestSummary(event.target.value)} /></label><button type="submit" disabled={!testSummary.trim()}>{recordTest.isPending ? 'Recording…' : 'RECORD TEST RESULT →'}</button>{recordTest.isError ? <p role="alert">{mutationAlert(recordTest.error)}</p> : null}<p>Your result becomes OBSERVED evidence. PASS is still not PROVEN.</p></fieldset></form> : <p>No open external test request for this project.</p>}
  </section>;
}

export default function LiveWorld({client = createInkubatorApiClient(), refetchIntervalMs = 2500}: LiveWorldProps) {
  const reducedMotion = useReducedMotion();
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

  return <TerminalShell mode="WORLD" kicker="WORLD / PUBLIC EVENTS" title="Public signal." description="Useful events around you. Public evidence, in time order." workspaceClassName="world-workspace" className="world-live" eventSequence={eventSequence} motionPolicy={reducedMotion ? 'reduced' : 'full'} footerItems={['PUBLIC EVENTS / UTC', 'CLAIMED ≠ OBSERVED ≠ PROVEN']}>
    <header className="faceplate-print-head"><span>01 /</span><h2>RECEIVER / SIGNAL TAPE</h2><small>NEWEST FIRST · SELECT TO INSPECT</small></header>
    <div className="faceplate-split">
      <section className="faceplate-display world-tape" aria-label="Public event index" data-stale={stale}>
        <header className="world-display-head"><div><small>PUBLIC CHANNEL</small><h2>World receiver<span aria-hidden="true">_</span></h2></div><span>{signals.isPending ? 'LOADING' : signals.error ? stale ? 'STALE' : 'UNAVAILABLE' : `${ordered.length} EVENTS`}</span></header>
        <div className="world-receiver-status"><span>{signals.error ? 'INPUT UNAVAILABLE' : signals.isPending ? 'READING PUBLIC EVENTS' : 'PUBLIC EVENT RECORD'}</span>{!signals.error && !signals.isPending && <PeripheralSignal cue="SOURCE_RX" eventId={arrivalId} />}</div>
        {signals.error ? <div className="world-input-state" role="status"><strong>{stale ? 'STALE PUBLIC SNAPSHOT' : 'WORLD LINK UNAVAILABLE'}</strong><p>{stale ? 'The last received records remain available for inspection. New events cannot be checked.' : 'Public events could not be loaded.'}</p>{signals.dataUpdatedAt > 0 && <time dateTime={new Date(signals.dataUpdatedAt).toISOString()}>LAST RECEIVED / {new Date(signals.dataUpdatedAt).toISOString()}</time>}<button type="button" onClick={() => void signals.refetch()}>Retry public events</button></div> : signals.isPending ? <div className="world-input-state" role="status"><strong>READING PUBLIC EVENTS</strong><p>The public channel is loading.</p></div> : !ordered.length ? <div className="world-input-state"><strong>NO PUBLIC SIGNALS</strong><p>New public help and evidence records will appear here.</p></div> : null}
        <ol className="world-event-list">{ordered.map((signal, index) => <li key={signal.signal_id} data-signal-id={signal.signal_id}><button className="faceplate-record" type="button" aria-pressed={selected?.signal_id === signal.signal_id} onClick={() => setSelectedId(signal.signal_id)} onKeyDown={event => navigate(event, index)}><time dateTime={signal.occurred_at}>{signal.occurred_at.slice(0, 10)}<small>{signal.occurred_at.slice(11, 16)} UTC</small></time><span><strong>{signalLabel(signal)}</strong><small>{signal.project_name}</small></span><b data-truth={signal.truth_state.toLowerCase()}>{signal.truth_state}</b><span aria-hidden="true">↗</span></button></li>)}</ol>
        <footer>↑ ↓ HOME END TO INSPECT / TIME ORDER, NO RANKING</footer>
      </section>
      <aside className="faceplate-inspector" aria-label="Selected public event"><small>SELECTED EVENT{stale ? ' / STALE SNAPSHOT' : ''}</small>{selected ? <>
        <span className="world-truth" data-truth={selected.truth_state.toLowerCase()}>{selected.truth_state}</span><h2>{signalLabel(selected)}</h2><p>{selected.project_name}</p>
        <dl><div><dt>OCCURRED / UTC</dt><dd><time dateTime={selected.occurred_at}>{selected.occurred_at}</time></dd></div><div><dt>REFERENCE</dt><dd><code>{selected.signal_id}</code></dd></div><div><dt>PUBLIC PROJECT</dt><dd>{selected.project_name}</dd></div></dl>
        <p>{selected.truth_state === 'OBSERVED' ? 'A supported public event was recorded. It does not establish an accepted Ship.' : 'A builder opened a public request for help. This is a declaration, not proof.'}</p>
        {projects.error ? <p role="status">PROJECT CONTEXT UNAVAILABLE</p> : projects.isPending ? <p role="status">Loading public project context.</p> : context ? <><section className="world-beacon-context"><small>{context.open_help_beacon?.state === 'OPEN' ? 'CURRENT OPEN HELP' : 'PUBLIC PROJECT'}</small><h3>{context.open_help_beacon?.summary ?? context.project.name}</h3>{context.open_help_beacon ? <><p>{context.open_help_beacon.skills_needed.join(' / ') || 'No skills specified.'}</p><p>OWNER / {context.owner.display_name}</p></> : <p>OWNER / {context.owner.display_name}</p>}</section><WorldParticipation key={context.project.project_id} context={context} client={client} refetchIntervalMs={refetchIntervalMs} /></> : <p>No public project context is available for this event.</p>}
      </> : <><h2>{signals.isPending ? 'Loading the channel.' : signals.error ? 'Channel unavailable.' : 'The channel is quiet.'}</h2><p>Select a public event to read its context.</p></>}</aside>
    </div>
  </TerminalShell>;
}
