import {useEffect, useState, type FormEvent, type KeyboardEvent} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {
  AcceptedShipArtifactView,
  CommandView,
  InkubatorApiClient,
  PlayerHistoryView,
  ProjectShipStateView,
  PrivateProject,
  ShipSubmissionCreateRequest,
  ShipSubmissionPublicView,
  ShipVerifierObservationView,
} from '../generated/inkubator-api-client';
import {InkubatorApiError} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {TerminalShell} from '../shell/TerminalShell';
import {PeripheralSignal} from '../instrument-os/PeripheralSignal';
import './live-ship-v2.css';

type ShipClient = Pick<InkubatorApiClient, 'getMyCommand' | 'getProjectShipState' | 'submitShip'> & Partial<Pick<InkubatorApiClient, 'getPrivateProject' | 'getShipReceipt' | 'getMyHistory'>>;

export type LiveShipProps = {
  client?: ShipClient;
  refetchIntervalMs?: number | false;
};

const commandKey = ['inkubator', 'ship', 'command'] as const;
const shipKey = (projectId: string) => ['inkubator', 'ship', projectId, 'state'] as const;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function newRequestId() {
  return globalThis.crypto.randomUUID();
}

function normalizeOptional(value: string) {
  const normalized = value.trim();
  return normalized.length ? normalized : undefined;
}

function isPublicHttps(value: string, optional = false) {
  const normalized = value.trim();
  if (!normalized) return optional;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function stateCopy(state: ShipSubmissionPublicView['state']) {
  if (state === 'PROVEN') return 'Accepted by the server rule. An immutable Ship receipt now exists.';
  if (state === 'OBSERVED') return 'The verifier has recorded an observation. Observation alone is not proof.';
  if (state === 'ATTENTION') return 'Verification or acceptance requires attention. This is not PROVEN.';
  return 'Submission recorded. The verifier owns the next state transition.';
}

function VerifierObservation({observation}: {observation?: ShipVerifierObservationView}) {
  if (!observation) {
    return (
      <section className="ship-observation ship-observation--pending" aria-label="Verifier observation">
        <small>VERIFIER OBSERVATION</small>
        <strong>WAITING FOR OBSERVATION</strong>
        <p>No verifier result has been projected yet. A submitted URL is still only a claim.</p>
      </section>
    );
  }

  return (
    <section className="ship-observation" data-outcome={observation.outcome.toLowerCase()} aria-label="Verifier observation">
      <div>
        <small>VERIFIER OBSERVATION</small>
        <strong>{observation.outcome}</strong>
      </div>
      <dl>
        <div><dt>REASON</dt><dd>{observation.reason_code}</dd></div>
        {observation.http_status !== undefined ? <div><dt>HTTP</dt><dd>{observation.http_status}</dd></div> : null}
        <div><dt>DURATION</dt><dd>{observation.duration_ms} ms</dd></div>
        <div><dt>REDIRECTS</dt><dd>{observation.redirects}</dd></div>
      </dl>
      <time dateTime={observation.observed_at}>{observation.observed_at}</time>
      <p>Verifier evidence can establish OBSERVED. Only the acceptance rule can establish PROVEN.</p>
    </section>
  );
}

function SubmissionState({submission, stale = false}: {submission: ShipSubmissionPublicView; stale?: boolean}) {
  const accepted = submission.state === 'PROVEN' ? submission.accepted_ship : undefined;
  const [selected, setSelected] = useState(accepted ? 'receipt' : submission.verifier_observation ? 'observed' : 'submitted');
  const stages = [
    {id: 'submitted', label: 'SUBMITTED', value: submission.submitted_at ? 'Claim recorded' : 'Not in receipt projection', available: Boolean(submission.submitted_at)},
    {id: 'observed', label: 'OBSERVED', value: submission.verifier_observation?.outcome ?? 'Awaiting verifier', available: Boolean(submission.verifier_observation)},
    {id: 'accepted', label: 'ACCEPTED', value: accepted ? 'Acceptance recorded' : 'No acceptance record', available: Boolean(accepted)},
    {id: 'receipt', label: 'PROVEN', value: accepted ? 'Immutable receipt' : 'No receipt issued', available: Boolean(accepted)},
  ];
  const current = stages.some(stage => stage.id === selected && stage.available) ? selected : 'submitted';
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const available = stages.filter(stage => stage.available);
    const position = available.findIndex(stage => stage.id === stages[index].id);
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? Math.min(position + 1, available.length - 1) : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? Math.max(position - 1, 0) : -1;
    if (target < 0) return;
    event.preventDefault(); setSelected(available[target].id);
    document.getElementById(`ship-stage-${available[target].id}`)?.focus();
  }
  const cue = stale ? 'STALE' : accepted ? 'RECEIPT' : submission.verifier_observation?.outcome === 'PASS' ? 'VERIFY_PASS' : submission.verifier_observation?.outcome === 'FAILED' ? 'MISSION_BLOCKED' : submission.verifier_observation?.outcome === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'SHIP_SUBMITTED';
  return <section className="ship-state" aria-labelledby="ship-state-heading">
    <header className="faceplate-print-head"><span>01 /</span><h2 id="ship-state-heading">ARTIFACT RECORD</h2><small>SELECT A STAGE TO INSPECT</small></header>
    <div className="faceplate-split">
      <section className="faceplate-display ship-signal-display" aria-label="Ship record index">
        <header><div><small>SHIP / SERVER RECORD</small><h3>{submission.artifact.title}</h3></div><span className="faceplate-truth" data-truth={accepted ? 'proven' : 'claimed'}>{accepted ? 'PROVEN' : submission.state === 'PROVEN' ? 'PROOF CONTEXT INCOMPLETE' : submission.state}</span></header>
        <div className="ship-stage-index">{stages.map((stage, index) => <button type="button" id={`ship-stage-${stage.id}`} key={stage.id} className="faceplate-record" disabled={!stage.available} aria-pressed={current === stage.id} onClick={() => setSelected(stage.id)} onKeyDown={event => navigate(event, index)}><small>0{index + 1}</small><span><strong>{stage.label}</strong><small>{stage.value}</small></span><span aria-hidden="true">{stage.available ? '↗' : '—'}</span></button>)}</div>
        <div className="ship-channel"><PeripheralSignal cue={cue} eventId={stale ? undefined : `${submission.submission_id}:${submission.state}:${submission.verifier_observation?.observed_at ?? ''}:${accepted?.receipt_id ?? ''}`} /><div><small>{accepted ? 'RECEIPT REGISTERED' : submission.verifier_observation ? 'VERIFIER RECORD RECEIVED' : 'SUBMISSION REGISTERED'}</small><p>{accepted ? accepted.receipt_id : stateCopy(submission.state)}</p></div></div>
        {!accepted ? <p className="ship-proof-boundary">NO ACCEPTED SHIP RECEIPT YET</p> : null}
        <footer><span>↑ ↓ TO INSPECT</span><span>PASS ≠ PROVEN</span></footer>
      </section>
      <aside className="faceplate-inspector" aria-label="Selected Ship record">
        <div key={current} className="faceplate-selection-response"><small>SELECTED RECORD / {stages.find(stage => stage.id === current)?.label}</small>
        {current === 'submitted' ? <><h3>Artifact submitted.</h3><span className="faceplate-truth">CLAIMED</span><p>The builder supplied this artifact. Its submission does not establish verification or acceptance.</p><dl><div><dt>TITLE</dt><dd>{submission.artifact.title}</dd></div><div><dt>SUBMITTED / UTC</dt><dd><time dateTime={submission.submitted_at}>{submission.submitted_at}</time></dd></div><div><dt>SUBMISSION</dt><dd><code>{submission.submission_id}</code></dd></div></dl><a href={submission.artifact.url} target="_blank" rel="noreferrer">Open submitted artifact ↗</a></> : null}
        {current === 'observed' ? <><h3>Verifier observation.</h3><VerifierObservation observation={submission.verifier_observation} /></> : null}
        {current === 'accepted' && accepted ? <><h3>Acceptance recorded.</h3><p>The server accepted the observed evidence under its versioned rule. This is the acceptance reference attached to the issued receipt.</p><dl><div><dt>RULE</dt><dd>{accepted.acceptance_rule_version}</dd></div><div><dt>REVIEW</dt><dd><code>{accepted.evidence.acceptance_review_id}</code></dd></div><div><dt>VERIFIER EVIDENCE</dt><dd><code>{accepted.evidence.verifier_observation_id}</code></dd></div></dl></> : null}
        {current === 'receipt' && accepted ? <AcceptedReceipt ship={accepted} /> : null}
        </div>
      </aside>
    </div>
  </section>;
}

function AcceptedReceipt({ship}: {ship: AcceptedShipArtifactView}) {
  const owner = ship.builders.find((builder) => builder.role === 'OWNER');
  const party = ship.builders.filter((builder) => builder.role === 'PARTY');

  return (
    <section className="ship-accepted" aria-labelledby="ship-accepted-heading">
      <div className="ship-artifact-stage">
        <small>ACCEPTED ARTIFACT / PROVEN</small>
        <strong>{ship.artifact.title}</strong>
        <a href={ship.artifact.url} target="_blank" rel="noreferrer">OPEN THE THING →</a>
      </div>

      <aside className="ship-receipt">
        <div className="ship-proof-mark" data-truth="proven"><i aria-hidden="true" />PROVEN</div>
        <span>SHIP / IMMUTABLE RECEIPT</span>
        <h2 id="ship-accepted-heading">Accepted receipt</h2>
        <p>The accepted Ship fact crossed the deterministic server proof boundary. Builder and Assist credits below are the immutable Ship-time snapshot.</p>

        <dl className="ship-receipt-meta">
          <div><dt>RECEIPT</dt><dd><code>{ship.receipt_id}</code></dd></div>
          <div><dt>SCHEMA</dt><dd>{ship.receipt_schema_version}</dd></div>
          <div><dt>RULE</dt><dd>{ship.acceptance_rule_version}</dd></div>
          <div><dt>SHIPPED</dt><dd><time dateTime={ship.shipped_at}>{ship.shipped_at}</time></dd></div>
          <div><dt>VERIFIER EVIDENCE</dt><dd><code>{ship.evidence.verifier_observation_id}</code></dd></div>
          <div><dt>ACCEPTANCE REVIEW</dt><dd><code>{ship.evidence.acceptance_review_id}</code></dd></div>
        </dl>

        <section className="ship-credit" aria-label="Ship-time builder attribution">
          <header><small>BUILDERS / SHIP-TIME SNAPSHOT</small><b>{ship.builders.length} CREDITED</b></header>
          <ul>
            {ship.builders.map((builder) => <li key={builder.player_id}><span>{builder.role}</span><strong>{builder.display_name}</strong><code>{builder.player_id}</code></li>)}
          </ul>
        </section>

        <div className="ship-credit-summary">
          <div><small>OWNER</small><strong>{owner?.display_name ?? ship.owner_player_id}</strong></div>
          <div><small>PARTY</small><strong>{String(party.length).padStart(2, '0')}</strong></div>
          <div><small>ASSISTS</small><strong>{String(ship.assists.length).padStart(2, '0')}</strong></div>
        </div>

        {ship.assists.length ? (
          <ul className="ship-assists" aria-label="Accepted assists at Ship time">
            {ship.assists.map((assist) => <li key={assist.assist_id}><small>ACCEPTED ASSIST</small><strong>{assist.display_name}</strong><code>{assist.assist_id}</code></li>)}
          </ul>
        ) : null}
      </aside>
    </section>
  );
}

function SubmissionForm({command, shipState, shipStateError, client, onSubmitted}: {
  command: {project: {name: string}; mission: {mission_id: string; state: CommandView['mission']['state']}};
  shipState?: ProjectShipStateView;
  shipStateError?: unknown;
  client: ShipClient;
  onSubmitted: () => Promise<unknown>;
}) {
  const cache = useQueryClient();
  const [title, setTitle] = useState(command.project.name);
  const [url, setUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [requestId, setRequestId] = useState(newRequestId);

  useEffect(() => setTitle((current) => current || command.project.name), [command.project.name]);

  const latest = shipState?.latest_submission;
  const retryableUnavailable = latest?.state === 'ATTENTION' && latest.verifier_observation?.outcome === 'UNAVAILABLE';
  const stateKnown = Boolean(shipState) && !shipStateError;
  const missionReady = command.mission.state === 'SHIP_READY';
  const noActiveSubmission = !latest || retryableUnavailable;
  const validArtifact = title.trim().length > 0 && title.trim().length <= 120 && isPublicHttps(url) && isPublicHttps(demoUrl, true) && isPublicHttps(sourceUrl, true);

  const mutation = useMutation({
    mutationFn: (body: ShipSubmissionCreateRequest) => client.submitShip(command.mission.mission_id, body),
    onSuccess: async () => { await onSubmitted(); await cache.invalidateQueries({queryKey: ['inkubator']}); },
  });

  function updateField(setter: (value: string) => void, value: string) {
    setter(value);
    setRequestId(newRequestId());
    if (mutation.isError) mutation.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stateKnown || !missionReady || !noActiveSubmission || !validArtifact || mutation.isPending) return;
    mutation.mutate({
      request_id: requestId,
      title: title.trim(),
      url: url.trim(),
      ...(normalizeOptional(demoUrl) ? {demo_url: normalizeOptional(demoUrl)} : {}),
      ...(normalizeOptional(sourceUrl) ? {source_url: normalizeOptional(sourceUrl)} : {}),
    });
  }

  let blocked = '';
  if (!stateKnown) blocked = shipStateError ? 'SHIP STATE UNAVAILABLE — SUBMISSION DISABLED' : 'CONNECTING SHIP STATE';
  else if (!missionReady) blocked = `MISSION ${command.mission.state} — SHIP_READY REQUIRED`;
  else if (!noActiveSubmission) blocked = `${latest!.state} SUBMISSION ALREADY OWNS THIS SHIP ATTEMPT`;
  else if (!validArtifact) blocked = 'ENTER A TITLE AND PUBLIC HTTPS ARTIFACT URL';

  return (
    <section className="ship-submit" aria-labelledby="ship-submit-heading">
      <header className="ship-printed-head"><span>02 /</span><h2 id="ship-submit-heading">SUBMIT THE THING</h2><small>OWNER ACTION / CLAIMED ONLY</small></header>
      <form onSubmit={submit}><fieldset disabled={mutation.isPending}>
        <label><span>ARTIFACT TITLE</span><input value={title} maxLength={120} onChange={(event) => updateField(setTitle, event.target.value)} /></label>
        <label className="ship-url-primary"><span>PUBLIC ARTIFACT URL</span><input value={url} inputMode="url" placeholder="https://…" onChange={(event) => updateField(setUrl, event.target.value)} aria-invalid={url.length > 0 && !isPublicHttps(url)} /></label>
        <label><span>DEMO URL / OPTIONAL</span><input value={demoUrl} inputMode="url" placeholder="https://…" onChange={(event) => updateField(setDemoUrl, event.target.value)} aria-invalid={demoUrl.length > 0 && !isPublicHttps(demoUrl, true)} /></label>
        <label><span>SOURCE URL / OPTIONAL / PRIVATE</span><input value={sourceUrl} inputMode="url" placeholder="https://…" onChange={(event) => updateField(setSourceUrl, event.target.value)} aria-invalid={sourceUrl.length > 0 && !isPublicHttps(sourceUrl, true)} /></label>
        <div className="ship-submit-control">
          <p>Submit a public artifact for independent verification. Private source URLs remain private.</p>
          <button type="submit" disabled={Boolean(blocked) || mutation.isPending}>{mutation.isPending ? 'SUBMITTING…' : 'SUBMIT FOR VERIFICATION'}</button>
        </div>
        {blocked ? <p className="ship-submit-status" role="status">{blocked}</p> : <p className="ship-submit-status" data-ready="true">READY TO RECORD CLAIMED SUBMISSION</p>}
        {mutation.isError ? <div className="ship-submit-error" role="alert"><small>SUBMISSION REJECTED / UNAVAILABLE</small><strong>{errorMessage(mutation.error, 'ship_submission_failed')}</strong><p>No local success state was invented.</p></div> : null}
        {mutation.isSuccess ? <div className="ship-submit-success" role="status"><small>SUBMISSION RECORDED</small><strong>{mutation.data.submission_id}</strong><p>The verifier now owns the next transition.</p></div> : null}
      </fieldset></form>
    </section>
  );
}

function ShipWorkspace({command, shipState, shipStateError, client, refetch}: {
  command: CommandView;
  shipState?: ProjectShipStateView;
  shipStateError?: unknown;
  client: ShipClient;
  refetch: () => Promise<unknown>;
}) {
  const latest = shipState?.latest_submission;
  const status = shipStateError
    ? 'SHIP STATE UNAVAILABLE // FAIL CLOSED'
    : latest
      ? `SHIP ${latest.state} // SERVER PROJECTION`
      : command.mission.state === 'SHIP_READY'
        ? 'SHIP READY // OWNER MAY SUBMIT'
        : `SHIP WAITING // MISSION ${command.mission.state}`;

  return (
    <TerminalShell
      mode="SHIP"
      kicker="REKT INK(CUBATOR) // LIVE SHIP"
      title="Ship the thing."
      description="Submission is a claim. Verification is an observation. Acceptance and the immutable receipt are PROVEN server facts."
      readout={[
        {label: 'MISSION', value: command.mission.state},
        {label: 'SHIP', value: shipStateError ? 'UNAVAILABLE' : latest?.state ?? 'NONE'},
        {label: 'SOURCE', value: command.project.source_visibility},
      ]}
      eventStatus={status}
      workspaceClassName="ship-workspace"
      footerItems={['GENERATED API CLIENT', 'BROWSER CANNOT MINT PROVEN', 'CLAIMED ≠ OBSERVED ≠ PROVEN']}
      className="ship-live"
    >
      <div className="ship-context"><small>SHIP CONDITION</small><p>{command.mission.ship_condition}</p><a href="?mode=command">Mission controls in COMMAND ↗</a></div>
      {shipStateError ? <div className="ship-no-submission" role="alert"><strong>SHIP STATE UNAVAILABLE</strong><p>Cannot read the artifact record. Submission is disabled until the connection recovers.</p></div> : !shipState ? <div className="ship-no-submission" role="status"><strong>CONNECTING SHIP STATE</strong></div> : latest ? <SubmissionState key={latest.submission_id} submission={latest} /> : (
        <div className="ship-no-submission"><small>SHIP STATE</small><strong>NO SUBMISSION RECORDED</strong><p>The Project has no canonical Ship submission yet.</p></div>
      )}
      {(!latest || latest.state === 'ATTENTION') && <SubmissionForm command={command} shipState={shipState} shipStateError={shipStateError} client={client} onSubmitted={refetch} />}
    </TerminalShell>
  );
}

export default function LiveShip(props: LiveShipProps) {
  const receiptId = new URLSearchParams(window.location.search).get('receipt');
  return receiptId ? <ReceiptContext {...props} receiptId={receiptId} /> : <ProjectShipContext {...props} />;
}

function ReceiptContext({client = createInkubatorApiClient(), receiptId}: LiveShipProps & {receiptId: string}) {
  const receipt = useQuery({queryKey: ['inkubator', 'ship', 'receipt', receiptId], queryFn: () => {
    if (!client.getShipReceipt) throw new Error('receipt_api_unavailable');
    return client.getShipReceipt(receiptId);
  }, retry: false});
  const requestedProject = new URLSearchParams(window.location.search).get('project');
  const valid = receipt.data?.truth_state === 'PROVEN' && receipt.data.receipt_id === receiptId && (!requestedProject || requestedProject === receipt.data.project_id);
  return <TerminalShell mode="SHIP" kicker="SHIP / DURABLE RECEIPT" title={valid ? receipt.data!.artifact.title : 'Ship receipt.'} description="The accepted artifact and its immutable attribution." workspaceClassName="ship-workspace" className="ship-live">
    {receipt.isPending ? <p role="status">READING RECEIPT</p> : receipt.error || !valid ? <div role="alert"><h2>RECEIPT UNAVAILABLE</h2><button type="button" onClick={() => void receipt.refetch()}>Retry receipt</button></div> : <SubmissionState submission={{schema_version: 'ship.submission.public.v2', submission_id: receipt.data!.submission_id, mission_id: receipt.data!.mission_id, project_id: receipt.data!.project_id, artifact: receipt.data!.artifact, state: 'PROVEN', submitted_at: '', accepted_ship: receipt.data!}} />}
  </TerminalShell>;
}

function durableShipEntry(history: PlayerHistoryView) {
  return [...history.entries]
    .filter((entry) => entry.kind === 'SHIP_ACCEPTED' && entry.truth_state === 'PROVEN' && entry.project_id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
}

function ProjectShipContext({client = createInkubatorApiClient(), refetchIntervalMs = 3000}: LiveShipProps) {
  const [contextProject, setContextProject] = useState(() => new URLSearchParams(window.location.search).get('project'));
  const commandQuery = useQuery({queryKey: commandKey, queryFn: () => client.getMyCommand(), enabled: !contextProject, refetchInterval: contextProject ? false : refetchIntervalMs, retry: false});
  // After a Mission completes it leaves the active-command projection by design. The
  // accepted Ship receipt stays durable, so the SHIP surface recovers its authorized
  // project/artifact context from the canonical builder history instead of failing.
  const commandGone = commandQuery.isError && commandQuery.error instanceof InkubatorApiError && commandQuery.error.status === 404;
  const historyQuery = useQuery({queryKey: ['inkubator', 'ship', 'durable-history'], queryFn: () => client.getMyHistory!(), enabled: commandGone && !contextProject && Boolean(client.getMyHistory), retry: false});
  useEffect(() => {
    if (!historyQuery.data || contextProject) return;
    const accepted = durableShipEntry(historyQuery.data);
    if (!accepted) return;
    const url = new URL(window.location.href);
    url.searchParams.set('project', accepted.project_id!);
    if (accepted.receipt_id) url.searchParams.set('receipt', accepted.receipt_id);
    window.history.replaceState({}, '', url); setContextProject(accepted.project_id!);
  }, [historyQuery.data, contextProject]);
  useEffect(() => {
    if (!commandQuery.data || contextProject || !client.getPrivateProject) return;
    const id = commandQuery.data.project.project_id;
    const url = new URL(window.location.href); url.searchParams.set('project', id);
    window.history.replaceState({}, '', url); setContextProject(id);
  }, [commandQuery.data, contextProject, client]);
  const privateQuery = useQuery({queryKey: ['inkubator', 'ship', 'private', contextProject], queryFn: () => client.getPrivateProject!(contextProject!), enabled: Boolean(contextProject && client.getPrivateProject), retry: false, refetchInterval: refetchIntervalMs});
  const projectId = contextProject ?? commandQuery.data?.project.project_id;
  const shipQuery = useQuery({
    queryKey: shipKey(projectId ?? 'pending'),
    queryFn: () => client.getProjectShipState(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: refetchIntervalMs,
    retry: false,
  });

  if (contextProject && client.getPrivateProject) {
    return <TerminalShell mode="SHIP" kicker="ARTIFACT / ACCEPTANCE / RECEIPT" title={privateQuery.data?.name ?? 'Ship the thing.'} description="What exists, what was observed, and what was accepted." className="ship-live" workspaceClassName="ship-workspace" eventStatus={privateQuery.error || shipQuery.error ? 'RECORD UNAVAILABLE / INPUT FROZEN' : 'SERVER RECORD / PRIVATE PROJECT CONTEXT'}>
      {privateQuery.error && (!privateQuery.data || privateQuery.error instanceof InkubatorApiError && [401,403,404].includes(privateQuery.error.status)) ? <div role="alert" className="ship-no-submission"><h2>Project access unavailable.</h2><p>Sign in as a project member or choose your current Mission in COMMAND.</p><a href="?mode=command">Return to COMMAND</a></div> : !privateQuery.data ? <div role="status" className="ship-no-submission">CONNECTING PROJECT</div> : <HistoricalShip project={privateQuery.data} shipState={shipQuery.data} error={privateQuery.error ?? shipQuery.error} client={client} onSubmitted={() => shipQuery.refetch()} />}
    </TerminalShell>;
  }
  if (commandQuery.isPending) {
    return <TerminalShell mode="SHIP" kicker="REKT INK(CUBATOR) // LIVE SHIP" title="Ship the thing." description="Connecting canonical Mission authority." workspaceClassName="ship-loading" className="ship-live"><div><small>SHIP BUS</small><h2>CONNECTING MISSION</h2><p>Waiting for the canonical private COMMAND projection.</p></div></TerminalShell>;
  }

  if (commandGone && !contextProject) {
    const recovering = historyQuery.isPending && Boolean(client.getMyHistory);
    const durableEntry = historyQuery.data ? durableShipEntry(historyQuery.data) : undefined;
    return <TerminalShell mode="SHIP" kicker="SHIP / DURABLE CONTEXT" title={recovering ? 'Recovering your Ship record.' : 'Ship the thing.'} description={recovering ? 'The Mission completed. Its accepted receipt stays addressable.' : 'Canonical Mission authority unavailable.'} workspaceClassName={recovering ? 'ship-loading' : 'ship-loading ship-loading--error'} className="ship-live">
      {recovering ? <div role="status"><small>SHIP BUS</small><h2>MISSION COMPLETE</h2><p>The active Mission has completed. Recovering the durable accepted-artifact context from the canonical builder history.</p></div>
        : <div role="alert"><small>SHIP BUS</small><h2>SHIP LINK UNAVAILABLE</h2><p>{errorMessage(commandQuery.error, 'active_mission_not_found')}</p><p>{historyQuery.error ? 'The durable builder history is also unavailable. No development fixture fallback is permitted.' : 'No accepted Ship receipt exists in the canonical builder history yet.'}</p></div>}
    </TerminalShell>;
  }
  if (commandQuery.isError || !commandQuery.data) {
    return <TerminalShell mode="SHIP" kicker="REKT INK(CUBATOR) // LIVE SHIP" title="Ship the thing." description="Canonical Mission authority unavailable." workspaceClassName="ship-loading ship-loading--error" className="ship-live"><div role="alert"><small>SHIP BUS</small><h2>SHIP LINK UNAVAILABLE</h2><p>{errorMessage(commandQuery.error, 'ship_command_projection_unavailable')}</p><p>No development fixture fallback is permitted.</p></div></TerminalShell>;
  }

  const refetch = async () => {
    await Promise.all([commandQuery.refetch(), shipQuery.refetch()]);
  };

  return <ShipWorkspace command={commandQuery.data} shipState={shipQuery.data} shipStateError={shipQuery.error} client={client} refetch={refetch} />;
}

function HistoricalShip({project, shipState, error, client, onSubmitted}: {project: PrivateProject; shipState?: ProjectShipStateView; error?: unknown; client: ShipClient; onSubmitted: () => Promise<unknown>}) {
  const latest = shipState?.latest_submission;
  return <>
    <div className="ship-context"><small>SHIP CONDITION</small><p>{project.ship_condition}</p><a href="?mode=command">Mission controls in COMMAND ↗</a></div>
    {error ? <><div className="ship-no-submission" role="alert"><h2>SHIP STATE UNAVAILABLE</h2><p>{latest ? 'STALE SNAPSHOT / Last known record retained. Input is frozen.' : 'The record is frozen until the connection recovers.'}</p></div>{latest && !(error instanceof InkubatorApiError && [401,403].includes(error.status)) ? <SubmissionState submission={latest} stale /> : null}</> : !shipState ? <div className="ship-no-submission" role="status">CONNECTING SHIP STATE</div> : latest ? <SubmissionState key={latest.submission_id} submission={latest} /> : <div className="ship-no-submission"><strong>NO SUBMISSION RECORDED</strong><p>Submit when your Mission is ready.</p></div>}
    {(!latest || latest.state === 'ATTENTION') && <SubmissionForm command={{project: {name: project.name}, mission: {mission_id: project.mission_id, state: project.mission_state}}} shipState={shipState} shipStateError={error} client={client} onSubmitted={onSubmitted} />}
  </>;
}
