import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import type {
  AcceptedShipArtifactView,
  CommandView,
  InkubatorApiClient,
  ProjectShipStateView,
  ShipSubmissionCreateRequest,
  ShipSubmissionPublicView,
  ShipVerifierObservationView,
} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {TerminalShell} from '../shell/TerminalShell';
import './live-ship-v2.css';

type ShipClient = Pick<InkubatorApiClient, 'getMyCommand' | 'getProjectShipState' | 'submitShip'>;

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

function stateTruth(state: ShipSubmissionPublicView['state']) {
  if (state === 'PROVEN') return 'proven';
  if (state === 'OBSERVED') return 'observed';
  if (state === 'ATTENTION') return 'attention';
  return 'claimed';
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

function SubmissionState({submission}: {submission: ShipSubmissionPublicView}) {
  const accepted = submission.accepted_ship;
  return (
    <section className="ship-state" aria-labelledby="ship-state-heading">
      <header className="ship-printed-head">
        <span>01 /</span>
        <h2 id="ship-state-heading">VERIFICATION CHAIN</h2>
        <small>SERVER-OWNED STATE</small>
      </header>

      <div className="ship-state-grid">
        <section className="ship-signal-display" data-truth={stateTruth(submission.state)}>
          <header><small>SUBMISSION / {submission.submission_id}</small><span>{submission.state}</span></header>
          <div className="ship-signal-core">
            <i aria-hidden="true" />
            <div><strong>{submission.state}</strong><p>{stateCopy(submission.state)}</p></div>
          </div>
          <dl>
            <div><dt>TITLE</dt><dd>{submission.artifact.title}</dd></div>
            <div><dt>MISSION</dt><dd>{submission.mission_id}</dd></div>
            <div><dt>SUBMITTED</dt><dd><time dateTime={submission.submitted_at}>{submission.submitted_at}</time></dd></div>
          </dl>
          <a href={submission.artifact.url} target="_blank" rel="noreferrer">OPEN SUBMITTED ARTIFACT →</a>
        </section>
        <VerifierObservation observation={submission.verifier_observation} />
      </div>

      {accepted ? <AcceptedReceipt ship={accepted} /> : (
        <div className="ship-proof-boundary" data-state="not-proven">
          <small>PROOF BOUNDARY</small>
          <strong>NO ACCEPTED SHIP RECEIPT YET</strong>
          <p>Neither the browser nor the builder can mint this state.</p>
        </div>
      )}
    </section>
  );
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
        <h2 id="ship-accepted-heading">{ship.artifact.title}</h2>
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

function Readiness({command}: {command: CommandView}) {
  return (
    <section className="ship-readiness" aria-labelledby="ship-readiness-heading">
      <header className="ship-printed-head"><span>00 /</span><h2 id="ship-readiness-heading">SHIP READINESS</h2><small>MISSION AUTHORITY</small></header>
      <div className="ship-readiness-grid">
        <div className="ship-condition"><small>SHIP CONDITION</small><strong>{command.mission.ship_condition}</strong><p>{command.mission.current_focus}</p></div>
        <div className="ship-next"><small>NEXT MOVE</small><strong>{command.mission.next_move}</strong><span>{command.mission.state}</span></div>
        <ol className="ship-gates" aria-label="Mission gates">
          {command.gates.map((gate) => <li key={gate.key} data-state={gate.state.toLowerCase()}><span>{String(gate.position).padStart(2, '0')}</span><strong>{gate.label}</strong><b>{gate.state}</b></li>)}
        </ol>
      </div>
    </section>
  );
}

function SubmissionForm({command, shipState, shipStateError, client, onSubmitted}: {
  command: CommandView;
  shipState?: ProjectShipStateView;
  shipStateError?: unknown;
  client: ShipClient;
  onSubmitted: () => Promise<unknown>;
}) {
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
    onSuccess: async () => { await onSubmitted(); },
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
      <form onSubmit={submit}>
        <label><span>ARTIFACT TITLE</span><input value={title} maxLength={120} onChange={(event) => updateField(setTitle, event.target.value)} /></label>
        <label className="ship-url-primary"><span>PUBLIC ARTIFACT URL</span><input value={url} inputMode="url" placeholder="https://…" onChange={(event) => updateField(setUrl, event.target.value)} aria-invalid={url.length > 0 && !isPublicHttps(url)} /></label>
        <label><span>DEMO URL / OPTIONAL</span><input value={demoUrl} inputMode="url" placeholder="https://…" onChange={(event) => updateField(setDemoUrl, event.target.value)} aria-invalid={demoUrl.length > 0 && !isPublicHttps(demoUrl, true)} /></label>
        <label><span>SOURCE URL / OPTIONAL / PRIVATE</span><input value={sourceUrl} inputMode="url" placeholder="https://…" onChange={(event) => updateField(setSourceUrl, event.target.value)} aria-invalid={sourceUrl.length > 0 && !isPublicHttps(sourceUrl, true)} /></label>
        <div className="ship-submit-control">
          <div><small>REQUEST / IDEMPOTENT</small><code>{requestId}</code><p>Retries of the unchanged payload reuse this request id. Editing the payload creates a new attempt id.</p></div>
          <button type="submit" disabled={Boolean(blocked) || mutation.isPending}>{mutation.isPending ? 'SUBMITTING…' : 'SUBMIT FOR VERIFICATION'}</button>
        </div>
        {blocked ? <p className="ship-submit-status" role="status">{blocked}</p> : <p className="ship-submit-status" data-ready="true">READY TO RECORD CLAIMED SUBMISSION</p>}
        {mutation.isError ? <div className="ship-submit-error" role="alert"><small>SUBMISSION REJECTED / UNAVAILABLE</small><strong>{errorMessage(mutation.error, 'ship_submission_failed')}</strong><p>No local success state was invented.</p></div> : null}
        {mutation.isSuccess ? <div className="ship-submit-success" role="status"><small>SUBMISSION RECORDED</small><strong>{mutation.data.submission_id}</strong><p>The verifier now owns the next transition.</p></div> : null}
      </form>
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
      <Readiness command={command} />
      {latest ? <SubmissionState submission={latest} /> : (
        <div className="ship-no-submission"><small>SHIP STATE</small><strong>NO SUBMISSION RECORDED</strong><p>The Project has no canonical Ship submission yet.</p></div>
      )}
      <SubmissionForm command={command} shipState={shipState} shipStateError={shipStateError} client={client} onSubmitted={refetch} />
    </TerminalShell>
  );
}

export default function LiveShip({client = createInkubatorApiClient(), refetchIntervalMs = 3000}: LiveShipProps) {
  const commandQuery = useQuery({queryKey: commandKey, queryFn: () => client.getMyCommand(), refetchInterval: refetchIntervalMs, retry: 1});
  const projectId = commandQuery.data?.project.project_id;
  const shipQuery = useQuery({
    queryKey: shipKey(projectId ?? 'pending'),
    queryFn: () => client.getProjectShipState(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: refetchIntervalMs,
    retry: false,
  });

  if (commandQuery.isPending) {
    return <TerminalShell mode="SHIP" kicker="REKT INK(CUBATOR) // LIVE SHIP" title="Ship the thing." description="Connecting canonical Mission authority." workspaceClassName="ship-loading" className="ship-live"><div><small>SHIP BUS</small><h2>CONNECTING MISSION</h2><p>Waiting for the canonical private COMMAND projection.</p></div></TerminalShell>;
  }

  if (commandQuery.isError || !commandQuery.data) {
    return <TerminalShell mode="SHIP" kicker="REKT INK(CUBATOR) // LIVE SHIP" title="Ship the thing." description="Canonical Mission authority unavailable." workspaceClassName="ship-loading ship-loading--error" className="ship-live" role="alert"><div><small>SHIP BUS</small><h2>SHIP LINK UNAVAILABLE</h2><p>{errorMessage(commandQuery.error, 'ship_command_projection_unavailable')}</p><p>No development fixture fallback is permitted.</p></div></TerminalShell>;
  }

  const refetch = async () => {
    await Promise.all([commandQuery.refetch(), shipQuery.refetch()]);
  };

  return <ShipWorkspace command={commandQuery.data} shipState={shipQuery.data} shipStateError={shipQuery.error} client={client} refetch={refetch} />;
}
