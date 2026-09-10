import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {
  CommandView,
  InkubatorApiClient,
  PrivateProject,
  ProjectExternalTestsView,
  ProjectHelpLoopView,
  ProjectShipStateView,
} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {TerminalShell} from '../shell/TerminalShell';
import './live-project.css';
import './live-project-v2.css';

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

function ProjectSector({code, title, className = '', children}: {
  code: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`project-sector ${className}`.trim()}>
      <header className="project-sector-head"><span>{code}</span><strong>{title}</strong><i aria-hidden="true" /></header>
      <div className="project-sector-body">{children}</div>
    </section>
  );
}

function LinkUnavailable({label, error}: {label: string; error: unknown}) {
  return (
    <div className="project-link-error" role="status">
      <small>{label} LINK UNAVAILABLE</small>
      <strong>{errorMessage(error, `${label.toLowerCase()}_projection_unavailable`)}</strong>
    </div>
  );
}

function latestExternalResult(tests: ProjectExternalTestsView | undefined) {
  if (!tests?.results.length) return undefined;
  return [...tests.results].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
}

function ProjectProjection({
  command,
  project,
  help,
  helpError,
  tests,
  testsError,
  ship,
  shipError,
}: {
  command: CommandView;
  project: PrivateProject;
  help?: ProjectHelpLoopView;
  helpError?: unknown;
  tests?: ProjectExternalTestsView;
  testsError?: unknown;
  ship?: ProjectShipStateView;
  shipError?: unknown;
}) {
  const latestTest = latestExternalResult(tests);
  const openTest = tests?.requests.find((request) => request.state === 'OPEN');
  const latestShip = ship?.latest_submission;
  const artifact = latestShip?.artifact;
  const artifactUrl = artifact?.demo_url ?? artifact?.url;
  const shipTruth = latestShip?.state === 'PROVEN' ? 'proven' : 'unproven';

  return (
    <TerminalShell
      mode="PROJECT"
      kicker="REKT INK(CUBATOR) // LIVE PROJECT"
      title={project.name}
      description="Canonical project workstation. Current work stays dominant; source, help, external test and ship remain separate truth-bounded projections."
      readout={[
        {label: 'PROJECT', value: project.project_id},
        {label: 'MISSION', value: project.mission_id},
        {label: 'VISIBILITY', value: project.source_visibility},
      ]}
      eventStatus={`PROJECT PROJECTION // ${command.mission.state} / ${project.observation_state}`}
      workspaceClassName="project-workstation"
      footerItems={[
        'TANSTACK QUERY // GENERATED API CLIENT',
        'CURRENT PROJECTION // NOT EVENT HISTORY',
        'CLAIMED ≠ OBSERVED ≠ PROVEN',
      ]}
      className="project-live"
    >
      <section className="project-current-locus" aria-label="Project current locus">
        <div>
          <span>CURRENT LOCUS</span>
          <p>{command.mission.current_focus}</p>
        </div>
        <div className="project-next-move">
          <span>NEXT MOVE</span>
          <h2>{command.mission.next_move}</h2>
          <b aria-hidden="true">→</b>
        </div>
      </section>

      <ProjectSector code="10" title="ARTIFACT / DEPLOY" className="project-sector--artifact">
        {artifact && artifactUrl ? (
          <div className="project-artifact" data-truth={shipTruth}>
            <div className="project-artifact-toolbar">
              <div><small>LATEST SHIP</small><strong>{artifact.title}</strong></div>
              <span data-truth={shipTruth}>{latestShip.state}</span>
            </div>
            <div className="project-artifact-viewport">
              <iframe
                src={artifactUrl}
                title={`${artifact.title} artifact preview`}
                loading="lazy"
                sandbox="allow-scripts allow-forms allow-popups"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="project-artifact-links">
              <a href={artifact.url} target="_blank" rel="noreferrer">OPEN ARTIFACT</a>
              {artifact.demo_url ? <a href={artifact.demo_url} target="_blank" rel="noreferrer">OPEN DEMO</a> : null}
            </div>
          </div>
        ) : shipError ? <LinkUnavailable label="SHIP" error={shipError} /> : (
          <div className="project-empty"><small>ARTIFACT SLOT</small><strong>NO SHIP ARTIFACT SUBMITTED</strong><p>The workstation will frame the canonical submitted artifact here; it does not invent a preview.</p></div>
        )}
      </ProjectSector>

      <ProjectSector code="01" title="SOURCE / RX" className="project-sector--source">
        <div className="project-source" data-state={project.observation_state.toLowerCase()}>
          <div><small>REPOSITORY</small><strong>{project.repository_full_name ?? 'NO REPOSITORY LINKED'}</strong></div>
          <dl>
            <div><dt>CONNECTED</dt><dd>{project.source_connected ? 'YES' : 'NO'}</dd></div>
            <div><dt>VISIBILITY</dt><dd>{project.source_visibility}</dd></div>
            <div><dt>OBSERVATION</dt><dd>{project.observation_state}</dd></div>
            <div><dt>ACTIVE</dt><dd>{project.repository_active === undefined ? 'UNKNOWN' : project.repository_active ? 'YES' : 'NO'}</dd></div>
          </dl>
          {project.last_ref ? <p>LAST REF // {project.last_ref}</p> : <p>LAST REF // NO CANONICAL DELIVERY</p>}
        </div>
      </ProjectSector>

      <ProjectSector code="07" title="SHIP / VERIFIER" className="project-sector--ship">
        {shipError ? <LinkUnavailable label="SHIP" error={shipError} /> : latestShip ? (
          <div className="project-ship" data-truth={shipTruth}>
            <span data-truth={shipTruth}>{latestShip.state}</span>
            <strong>{latestShip.artifact.title}</strong>
            <p>SUBMITTED // {latestShip.submitted_at}</p>
            {latestShip.verifier_observation ? (
              <dl>
                <div><dt>VERIFIER</dt><dd>{latestShip.verifier_observation.outcome}</dd></div>
                <div><dt>REASON</dt><dd>{latestShip.verifier_observation.reason_code}</dd></div>
              </dl>
            ) : <p>VERIFIER // NO OBSERVATION</p>}
            {latestShip.accepted_ship ? <p>RECEIPT // {latestShip.accepted_ship.receipt_id}</p> : null}
          </div>
        ) : <div className="project-empty project-empty--compact"><small>SHIP STATE</small><strong>NONE</strong></div>}
      </ProjectSector>

      <ProjectSector code="06" title="THREAD / CURRENT SIGNAL CHAIN" className="project-sector--thread">
        <ol className="project-thread">
          <li data-state="mission"><span>01</span><div><small>MISSION</small><strong>{command.mission.state}</strong></div></li>
          <li data-state={project.observation_state.toLowerCase()}><span>02</span><div><small>SOURCE</small><strong>{project.observation_state}</strong></div></li>
          <li data-state={latestTest ? 'observed' : openTest ? 'active' : 'unknown'}><span>03</span><div><small>EXTERNAL TEST</small><strong>{latestTest ? `${latestTest.outcome} / OBSERVED` : openTest ? `REQUEST ${openTest.state}` : 'NO TEST SIGNAL'}</strong></div></li>
          <li data-state={latestShip?.state.toLowerCase() ?? 'unknown'} data-truth={shipTruth}><span>04</span><div><small>SHIP</small><strong>{latestShip?.state ?? 'NO SUBMISSION'}</strong></div></li>
        </ol>
      </ProjectSector>

      <ProjectSector code="08" title="HELP / PARTY" className="project-sector--help">
        {helpError ? <LinkUnavailable label="HELP" error={helpError} /> : help ? (
          <div className="project-help">
            <div className="project-owner"><small>OWNER</small><strong>{help.owner.display_name}</strong></div>
            {help.open_help_beacon ? (
              <div className="project-beacon"><small>OPEN HELP BEACON</small><strong>{help.open_help_beacon.summary}</strong><p>{help.open_help_beacon.skills_needed.join(' / ') || 'NO SKILL TAGS'}</p></div>
            ) : <div className="project-empty project-empty--compact"><small>HELP BEACON</small><strong>NONE OPEN</strong></div>}
            <ul aria-label="Project party">
              {help.party_members.length ? help.party_members.map((member) => <li key={member.player_id}><span>{member.role}</span><strong>{member.display_name}</strong></li>) : <li><span>PARTY</span><strong>NO ACCEPTED ASSISTS</strong></li>}
            </ul>
          </div>
        ) : <div className="project-empty project-empty--compact"><small>HELP BUS</small><strong>CONNECTING</strong></div>}
      </ProjectSector>

      <ProjectSector code="09" title="EXTERNAL TEST" className="project-sector--tests">
        {testsError ? <LinkUnavailable label="TEST" error={testsError} /> : tests ? (
          <div className="project-tests">
            <div className="project-test-counts"><span>REQUESTS <b>{tests.requests.length}</b></span><span>RESULTS <b>{tests.results.length}</b></span></div>
            {latestTest ? (
              <div className="project-test-result" data-outcome={latestTest.outcome.toLowerCase()}>
                <small>LATEST OBSERVED TEST</small>
                <strong>{latestTest.outcome}</strong>
                <p>{latestTest.summary}</p>
                <span>{latestTest.tester.display_name} // {latestTest.observed_at}</span>
              </div>
            ) : openTest ? (
              <div className="project-test-result" data-outcome="open"><small>OPEN TEST REQUEST</small><strong>{openTest.state}</strong><p>{openTest.prompt}</p></div>
            ) : <div className="project-empty project-empty--compact"><small>TEST SIGNAL</small><strong>NONE</strong></div>}
          </div>
        ) : <div className="project-empty project-empty--compact"><small>TEST BUS</small><strong>CONNECTING</strong></div>}
      </ProjectSector>
    </TerminalShell>
  );
}

export default function LiveProject({client = createInkubatorApiClient(), refetchIntervalMs = 2500}: LiveProjectProps) {
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
  const fallbackReadout = useMemo(() => projectId ? [{label: 'PROJECT', value: projectId}] : [], [projectId]);

  if (isCorePending) {
    return (
      <TerminalShell mode="PROJECT" kicker="REKT INK(CUBATOR) // LIVE PROJECT" title={fallbackTitle} description="Connecting canonical project projection." readout={fallbackReadout} workspaceClassName="project-loading" className="project-live">
        <div><small>PROJECT WORKSTATION</small><h2>CONNECTING PROJECT BUS</h2><p>Waiting for canonical current-project and private project projections.</p></div>
      </TerminalShell>
    );
  }

  if (criticalError || !commandQuery.data || !projectQuery.data) {
    return (
      <TerminalShell mode="PROJECT" kicker="REKT INK(CUBATOR) // LIVE PROJECT" title={fallbackTitle} description="Canonical project projection unavailable." readout={fallbackReadout} workspaceClassName="project-loading project-loading--error" className="project-live" role="alert">
        <div><small>PROJECT WORKSTATION</small><h2>PROJECT LINK UNAVAILABLE</h2><p>{errorMessage(criticalError, 'project_projection_unavailable')}</p><p>No development fixture fallback is permitted.</p></div>
      </TerminalShell>
    );
  }

  return (
    <ProjectProjection
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
