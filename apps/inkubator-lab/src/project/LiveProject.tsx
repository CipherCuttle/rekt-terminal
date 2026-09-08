import {useMemo, useRef, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useGSAP} from '@gsap/react';
import gsap from 'gsap';
import type {
  CommandView,
  InkubatorApiClient,
  PrivateProject,
  ProjectExternalTestsView,
  ProjectHelpLoopView,
  ProjectShipStateView,
} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {MOTION_EASE, MOTION_SECONDS} from '../instrument-os/motion-tokens';
import './live-project.css';

gsap.registerPlugin(useGSAP);

type ProjectClient = Pick<
  InkubatorApiClient,
  'getMyCommand' | 'getPrivateProject' | 'getProjectHelpLoop' | 'getProjectExternalTests' | 'getProjectShipState'
>;

export type LiveProjectProps = {
  client?: ProjectClient;
  refetchIntervalMs?: number | false;
};

const commandKey = ['inkubator', 'project', 'command'] as const;
const projectKey = (projectId: string) => ['inkubator', 'project', projectId, 'private'] as const;
const helpKey = (projectId: string) => ['inkubator', 'project', projectId, 'help'] as const;
const testsKey = (projectId: string) => ['inkubator', 'project', projectId, 'tests'] as const;
const shipKey = (projectId: string) => ['inkubator', 'project', projectId, 'ship'] as const;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ProjectFrame({children}: {children: ReactNode}) {
  return <main className="project-live" aria-label="Project instrument">
    <header className="project-header">
      <a href="/" className="project-brand" aria-label="REKT home">REKT<span>INKUBATOR</span></a>
      <nav aria-label="Mode"><a href="?mode=command">COMMAND</a><span aria-current="page">PROJECT</span></nav>
    </header>
    <div className="project-workstation">{children}</div>
    <footer className="project-footer"><span>PROJECT / PRIVATE VIEW</span><span>CLAIMED ≠ OBSERVED ≠ PROVEN</span></footer>
  </main>;
}

function LinkUnavailable({label, error}: {label: string; error: unknown}) {
  return <div className="project-link-error" role="status">
    <strong>{label} LINK UNAVAILABLE</strong>
    <p>{errorMessage(error, `${label.toLowerCase()}_projection_unavailable`)}</p>
  </div>;
}

function latestExternalResult(tests: ProjectExternalTestsView | undefined) {
  return tests ? [...tests.results].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0] : undefined;
}

function ProjectProjection({command, project, help, helpError, tests, testsError, ship, shipError}: {
  command: CommandView;
  project: PrivateProject;
  help?: ProjectHelpLoopView;
  helpError?: unknown;
  tests?: ProjectExternalTestsView;
  testsError?: unknown;
  ship?: ProjectShipStateView;
  shipError?: unknown;
}) {
  // Query can retain cached data after a refetch error. Unavailable links cannot
  // contribute an artifact, proof, or apparently current signal anywhere.
  const currentHelp = helpError ? undefined : help;
  const currentTests = testsError ? undefined : tests;
  const currentShip = shipError ? undefined : ship;
  const latestTest = latestExternalResult(currentTests);
  const openTest = currentTests?.requests.find(request => request.state === 'OPEN');
  const latestShip = currentShip?.latest_submission;
  const artifact = latestShip?.artifact;
  const artifactUrl = artifact?.demo_url ?? artifact?.url;
  const accepted = latestShip?.state === 'PROVEN' && Boolean(latestShip.accepted_ship);
  const shipTruth = accepted ? 'proven' : 'unproven';
  const shipState = shipError ? 'UNAVAILABLE' : !ship ? 'CONNECTING' : latestShip?.state ?? 'NO SUBMISSION';
  const source = command.github_evidence;
  const sourceCurrent = source.source_state === 'AVAILABLE' && source.signal_state !== 'STALE';
  const observation = sourceCurrent ? source.latest_observation : undefined;
  const verifier = latestShip?.verifier_observation;
  const latestSignal = [
    ...(observation ? [{label: `SOURCE / ${observation.kind} / ${observation.outcome}`, at: observation.observed_at}] : []),
    ...(latestTest ? [{label: `EXTERNAL TEST / ${latestTest.outcome} / OBSERVED`, at: latestTest.observed_at}] : []),
    ...(latestShip ? [{label: 'SHIP REQUEST / CLAIMED', at: latestShip.submitted_at}] : []),
    ...(verifier ? [{label: `VERIFIER / ${verifier.outcome} / OBSERVED`, at: verifier.observed_at}] : []),
  ].sort((a, b) => b.at.localeCompare(a.at))[0];
  const boundary = shipError ? 'Ship acceptance unavailable.'
    : !ship ? 'Waiting for Ship state.'
    : accepted ? 'Accepted Ship receipt recorded.'
    : latestShip?.state === 'PROVEN' ? 'Acceptance receipt unavailable.'
    : 'No accepted Ship receipt.';
  const rootRef = useRef<HTMLDivElement>(null);
  // A visual-change fingerprint only; canonical values remain in Query.
  const signal = JSON.stringify([
    project.project_id, project.current_focus, project.next_move, project.mission_state,
    command.mission.blocker, project.observation_state, source,
    currentHelp, currentTests, currentShip, Boolean(helpError), Boolean(testsError), Boolean(shipError),
  ]);
  const previousSignal = useRef(signal);
  useGSAP(() => {
    const changed = previousSignal.current !== signal;
    previousSignal.current = signal;
    if (!changed || typeof window.matchMedia !== 'function') return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('[data-project-pulse]', {scale: 1.8}, {
        scale: 1, duration: MOTION_SECONDS.signal, ease: MOTION_EASE.signal,
      });
    });
    return () => media.revert();
  }, {scope: rootRef, dependencies: [signal], revertOnUpdate: true});

  return <ProjectFrame>
    <div ref={rootRef}>
      <header className="project-identity">
        <span className="project-label">PROJECT / {project.project_id}</span>
        <h1>{project.name}</h1>
        <p>{project.goal}</p>
      </header>

      <section className="project-thread" aria-label="Living Project Thread">
        <div className="project-thread-caption"><span className="project-label">LIVING PROJECT THREAD</span><span>CURRENT PROJECTION</span></div>
        <div className="project-flow">
          <section className="project-source" aria-label="Source">
            <span className="project-label">01 / SOURCE</span>
            <span className="project-socket" aria-hidden="true">⊙</span>
            <strong>{project.repository_full_name ?? 'NO REPOSITORY LINKED'}</strong>
            <span data-state={project.observation_state}>{project.observation_state}</span>
            <small>{source.source_state === 'UNAVAILABLE' ? 'EVIDENCE UNAVAILABLE' : `EVIDENCE / ${source.signal_state}`}</small>
          </section>
          <section className="project-locus" aria-label="Current locus" aria-current="step">
            <div className="project-locus-header"><span className="project-label">CURRENT PROJECT</span><span className="project-mission-state">{project.mission_state.replaceAll('_', ' ')}</span></div>
            <div className="project-locus-position">
              <span className="project-locus-mark" data-project-pulse="" aria-hidden="true">◆</span>
              <div><span className="project-label">YOU ARE HERE / CURRENT FOCUS</span><h2>{project.current_focus}</h2></div>
            </div>
            <div className="project-recent" role="status" aria-label="Latest recorded signal">
              <span className="project-rx" data-project-pulse={latestSignal ? '' : undefined} aria-hidden="true">RX</span>
              <span className="project-label">LAST SIGNAL</span>
              {latestSignal ? <><span className="project-signal-label">{latestSignal.label}</span><time dateTime={latestSignal.at}>{latestSignal.at.replace('T', ' ').replace('Z', ' UTC')}</time></>
                : <span className="project-signal-label">NO CURRENT TIMESTAMPED SIGNAL</span>}
            </div>
          </section>
          <section className="project-boundary" aria-label="Ship boundary" data-truth={shipTruth}>
            <span className="project-label">02 / SHIP</span>
            <span className="project-socket project-receipt-gate" aria-hidden="true">{accepted ? '⊢' : '⊣'}</span>
            <strong>{shipState}</strong>
            <span>{accepted ? 'ACCEPTED / PROVEN' : 'ACCEPTANCE NOT ESTABLISHED'}</span>
            <small>{boundary}</small>
          </section>
        </div>
      </section>

      <section className="project-next" aria-label="Next Move">
        <span className="project-label">NEXT MOVE</span>
        <details className="project-action">
          <summary><h2>{project.next_move}</h2><span aria-hidden="true">→</span></summary>
          <div className="project-action-detail">
            <p>Current project instruction. This control opens context; it does not submit or accept a Ship.</p>
            <p>SHIP CONDITION / {project.ship_condition}</p>
            <ul aria-label="Mission gates">{command.gates.map(gate => <li key={gate.key}>{gate.label} / {gate.state}</li>)}</ul>
          </div>
        </details>
        <p className="project-ship-hold"><span>{accepted ? 'SHIP RECEIPT' : 'SHIP BOUNDARY'}</span> {command.mission.blocker ?? boundary}</p>
        <p className="project-condition">REQUIRED / {project.ship_condition}</p>
      </section>

      <div className="project-evidence">
        <div className="project-attachment-rail"><span className="project-label">THREAD ATTACHMENTS</span><span>ARTIFACT / HELP / TEST / RECEIPT</span></div>
        <section className="project-artifact" aria-label="Artifact and deployment" data-truth={shipTruth}>
          <header><h2 className="project-label">ARTIFACT / DEPLOYMENT</h2><span>ATTACHED TO THREAD</span></header>
          {artifact && artifactUrl ? <>
            <div className="project-artifact-title"><strong>{artifact.title}</strong><span>URL SUPPLIED / CLAIMED</span></div>
            <p className="project-preview-trust">Preview is not deployment verification or Ship acceptance.</p>
            <div className="project-artifact-viewport">
              <iframe src={artifactUrl} title={`${artifact.title} artifact preview`} loading="lazy"
                sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" />
            </div>
            <div className="project-artifact-links">
              <a href={artifact.url} target="_blank" rel="noreferrer">OPEN ARTIFACT ↗</a>
              {artifact.demo_url ? <a href={artifact.demo_url} target="_blank" rel="noreferrer">OPEN DEMO ↗</a> : null}
            </div>
          </> : <div className="project-artifact-empty">
            <span aria-hidden="true">[ ─ ]</span>
            <strong>{shipError ? 'ARTIFACT UNAVAILABLE' : !ship ? 'CONNECTING ARTIFACT' : 'NO SHIP ARTIFACT SUBMITTED'}</strong>
            <p>{shipError ? 'Ship link unavailable; cached previews are withheld.' : 'The submitted artifact will appear here.'}</p>
          </div>}
          <details className="project-provenance"><summary>Source provenance</summary>
            <dl>
              <div><dt>CONNECTED</dt><dd>{project.source_connected ? 'YES' : 'NO'}</dd></div>
              <div><dt>VISIBILITY</dt><dd>{project.source_visibility}</dd></div>
              <div><dt>ACTIVE</dt><dd>{project.repository_active === undefined ? 'UNKNOWN' : project.repository_active ? 'YES' : 'NO'}</dd></div>
              <div><dt>LAST REF</dt><dd>{project.last_ref ?? 'NO CANONICAL DELIVERY'}</dd></div>
              <div><dt>EVIDENCE</dt><dd>{source.reason_code}</dd></div>
            </dl>
          </details>
        </section>

        <aside className="project-attachments" aria-label="Attached evidence">
          <section aria-label="Help and party" data-link={helpError ? 'unavailable' : currentHelp ? 'attached' : 'connecting'}>
            <h2 className="project-label">HELP / PARTY</h2>
            {helpError ? <LinkUnavailable label="HELP" error={helpError} /> : currentHelp ? <>
              <strong>{currentHelp.open_help_beacon?.summary ?? 'NO HELP BEACON OPEN'}</strong>
              <p>{currentHelp.open_help_beacon?.skills_needed.join(' / ')}</p>
              <p>OWNER / {currentHelp.owner.display_name}</p>
              <ul aria-label="Project party">{currentHelp.party_members.length
                ? currentHelp.party_members.map(member => <li key={member.player_id}>{member.role} / <strong>{member.display_name}</strong></li>)
                : <li>NO ACCEPTED ASSISTS</li>}</ul>
            </> : <p>HELP CONNECTING</p>}
          </section>
          <section aria-label="External tests" data-link={testsError ? 'unavailable' : currentTests ? 'attached' : 'connecting'}>
            <h2 className="project-label">EXTERNAL TEST</h2>
            {testsError ? <LinkUnavailable label="TEST" error={testsError} /> : currentTests ? <>
              <strong data-state={latestTest?.outcome}>{latestTest ? `${latestTest.outcome} / OBSERVED` : openTest ? 'REQUEST OPEN / NO RESULT' : 'NO TEST RESULT'}</strong>
              <p>{latestTest?.summary ?? openTest?.prompt ?? 'Test presence does not establish PASS.'}</p>
              {latestTest ? <p>{latestTest.tester.display_name} / <time dateTime={latestTest.observed_at}>{latestTest.observed_at}</time></p> : null}
            </> : <p>TEST CONNECTING</p>}
          </section>
          <section aria-label="Verifier and receipt" data-truth={shipTruth} data-link={shipError ? 'unavailable' : currentShip ? 'attached' : 'connecting'}>
            <h2 className="project-label">VERIFIER / RECEIPT</h2>
            {shipError ? <LinkUnavailable label="SHIP" error={shipError} /> : <>
              <strong>{verifier ? `VERIFIER / ${verifier.outcome}` : 'NO VERIFIER OBSERVATION'}</strong>
              <p>{verifier?.reason_code ?? 'No verifier result is available.'}</p>
              <p>{accepted ? `ACCEPTED RECEIPT / ${latestShip?.accepted_ship?.receipt_id}` : boundary}</p>
              {verifier && !accepted ? <p>Verifier response ≠ accepted Ship.</p> : null}
            </>}
          </section>
        </aside>
      </div>
    </div>
  </ProjectFrame>;
}

export default function LiveProject({client: suppliedClient, refetchIntervalMs = 2500}: LiveProjectProps) {
  const client = useMemo(() => suppliedClient ?? createInkubatorApiClient(), [suppliedClient]);
  const commandQuery = useQuery({queryKey: commandKey, queryFn: () => client.getMyCommand(), refetchInterval: refetchIntervalMs, retry: 1});
  const projectId = commandQuery.data?.project.project_id;

  const projectQuery = useQuery({
    queryKey: projectKey(projectId ?? 'pending'),
    queryFn: () => client.getPrivateProject(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: refetchIntervalMs,
    retry: 1,
  });
  const helpQuery = useQuery({
    queryKey: helpKey(projectId ?? 'pending'),
    queryFn: () => client.getProjectHelpLoop(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: refetchIntervalMs,
    retry: 1,
  });
  const testsQuery = useQuery({
    queryKey: testsKey(projectId ?? 'pending'),
    queryFn: () => client.getProjectExternalTests(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: refetchIntervalMs,
    retry: 1,
  });
  const shipQuery = useQuery({
    queryKey: shipKey(projectId ?? 'pending'),
    queryFn: () => client.getProjectShipState(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: refetchIntervalMs,
    retry: 1,
  });

  const criticalError = commandQuery.error ?? projectQuery.error;
  const isCorePending = commandQuery.isPending || (Boolean(projectId) && projectQuery.isPending);
  const fallbackTitle = commandQuery.data?.project.name ?? 'PROJECT BUS';
  if (criticalError || (!isCorePending && (!commandQuery.data || !projectQuery.data))) {
    return <ProjectFrame><section className="project-loading project-loading--error" role="alert">
      <span className="project-label">{fallbackTitle}</span><h1>PROJECT LINK UNAVAILABLE</h1>
      <p>{errorMessage(criticalError, 'project_projection_unavailable')}</p><p>No development fixture fallback is permitted.</p>
    </section></ProjectFrame>;
  }

  if (isCorePending || !commandQuery.data || !projectQuery.data) {
    return <ProjectFrame><section className="project-loading" role="status">
      <span className="project-label">{fallbackTitle}</span><h1>CONNECTING PROJECT BUS</h1>
      <p>Waiting for canonical current-project and private project projections.</p>
    </section></ProjectFrame>;
  }

  return (
    <ProjectProjection
      key={projectId}
      command={commandQuery.data}
      project={projectQuery.data}
      help={helpQuery.data}
      helpError={helpQuery.error}
      tests={testsQuery.data}
      testsError={testsQuery.error}
      ship={shipQuery.data}
      shipError={shipQuery.error}
    />
  );
}
