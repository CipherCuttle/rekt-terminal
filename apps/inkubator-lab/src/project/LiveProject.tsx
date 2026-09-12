import {useState, type KeyboardEvent, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {InkubatorApiError, type InkubatorApiClient} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {TerminalShell} from '../shell/TerminalShell';
import './live-project-v2.css';

type ProjectClient = Pick<InkubatorApiClient, 'getMyCommand' | 'getPrivateProject' | 'getProjectHelpLoop' | 'getProjectExternalTests' | 'getProjectShipState'>;
export type LiveProjectProps = {client?: ProjectClient; refetchIntervalMs?: number | false};
type Record = {id: string; label: string; state: string; detail: string; truth?: string; body: ReactNode};
function Meta({label, children}: {label: string; children: ReactNode}) {return <div><dt>{label}</dt><dd>{children}</dd></div>;}
function unavailable(label: string) {return <p role="status">{label} LINK UNAVAILABLE. Current information could not be checked.</p>;}

export default function LiveProject({client = createInkubatorApiClient(), refetchIntervalMs = 2500}: LiveProjectProps) {
  const contextProject = new URLSearchParams(window.location.search).get('project');
  const command = useQuery({queryKey: ['inkubator', 'project', 'command'], queryFn: () => client.getMyCommand(), enabled: !contextProject, refetchInterval: refetchIntervalMs, retry: false});
  const projectId = contextProject ?? command.data?.project.project_id;
  const options = {enabled: Boolean(projectId), refetchInterval: refetchIntervalMs, retry: false};
  const project = useQuery({queryKey: ['inkubator', 'project', projectId ?? 'pending', 'private'], queryFn: () => client.getPrivateProject(projectId!), ...options});
  const help = useQuery({queryKey: ['inkubator', 'project', projectId ?? 'pending', 'help'], queryFn: () => client.getProjectHelpLoop(projectId!), ...options});
  const tests = useQuery({queryKey: ['inkubator', 'project', projectId ?? 'pending', 'tests'], queryFn: () => client.getProjectExternalTests(projectId!), ...options});
  const ship = useQuery({queryKey: ['inkubator', 'project', projectId ?? 'pending', 'ship'], queryFn: () => client.getProjectShipState(projectId!), ...options});
  const [selectedId, setSelectedId] = useState('source');
  const loading = (!contextProject && command.isPending) || (Boolean(projectId) && project.isPending);
  const coreError = (!contextProject && command.error) || project.error;
  const denied = coreError instanceof InkubatorApiError && [401,403,404].includes(coreError.status);
  const failed = denied || (!loading && ((!contextProject && !command.data) || !project.data));
  const title = project.data?.name ?? command.data?.project.name ?? 'Project workbench.';

  if (loading || failed) return <TerminalShell mode="PROJECT" kicker="PROJECT / CURRENT BUILD" title={title} description="Source, tests and artifact evidence for this build." workspaceClassName="project-workstation" className="project-live"><section className="faceplate-display project-channel-state" role={failed ? 'alert' : 'status'}><small>PROJECT INPUT</small><h2>{failed ? 'PROJECT LINK UNAVAILABLE' : 'READING PROJECT'}</h2><p>{failed ? 'Current project information could not be checked. Return to COMMAND to select or set up your build.' : 'Loading your current project and source.'}</p>{failed && <button type="button" onClick={() => {void command.refetch(); void project.refetch();}}>Retry project</button>}<a href="?mode=command">Open COMMAND →</a></section></TerminalShell>;

  const p = project.data!;
  const c = contextProject ? undefined : command.data;
  const h = help.error ? undefined : help.data;
  const t = tests.error ? undefined : tests.data;
  const s = ship.error ? undefined : ship.data;
  const latestTest = [...(t?.results ?? [])].sort((a,b) => b.observed_at.localeCompare(a.observed_at))[0];
  const openTest = t?.requests.find(request => request.state === 'OPEN');
  const latestShip = s?.latest_submission;
  const sourceTruth = p.observation_state === 'OBSERVED' ? 'OBSERVED' : undefined;
  const records: Record[] = [
    {id:'source', label:'GitHub source', state:p.observation_state, detail:p.repository_full_name ?? 'NO REPOSITORY LINKED', truth:sourceTruth, body:<>
      <p>{p.source_connected ? 'Repository access is connected. Recorded source state appears below.' : 'Sign-in establishes identity. Repository access needs a separate connection in COMMAND.'}</p><dl><Meta label="REPOSITORY">{p.repository_full_name ?? 'Not linked'}</Meta><Meta label="VISIBILITY">{p.source_visibility}</Meta><Meta label="CONNECTION">{p.source_connected ? 'Connected' : 'Not connected'}</Meta><Meta label="OBSERVATION">{p.observation_state}</Meta><Meta label="LAST REF">{p.last_ref ?? 'No recorded ref'}</Meta>{p.last_delivery_id && <Meta label="DELIVERY"><code>{p.last_delivery_id}</code></Meta>}{c?.github_evidence.latest_observation && <Meta label="LAST OBSERVED / UTC"><time dateTime={c?.github_evidence.latest_observation.observed_at}>{c?.github_evidence.latest_observation.observed_at}</time></Meta>}</dl><p>{p.observation_state === 'STALE' ? 'The source observation is stale. This instrument is holding the recorded state.' : 'A source observation does not establish an accepted Ship.'}</p></>},
    {id:'tests',label:'External tests',state:tests.error ? 'UNAVAILABLE' : tests.isPending ? 'LOADING' : latestTest ? 'OBSERVED' : openTest ? 'REQUEST OPEN' : 'EMPTY',detail:tests.error ? 'TEST LINK UNAVAILABLE' : latestTest?.summary ?? openTest?.prompt ?? (tests.isPending ? 'Reading test records' : 'No external test recorded'),truth:latestTest ? 'OBSERVED' : undefined,body:tests.error ? unavailable('TEST') : tests.isPending ? <p role="status">Loading external tests.</p> : <><p>{latestTest ? 'An external tester recorded this result. A test PASS is observed evidence, not Ship proof.' : openTest ? 'A request is open. A request alone does not establish test evidence.' : 'No external test result exists yet.'}</p><dl>{latestTest && <><Meta label="OUTCOME">{latestTest.outcome}</Meta><Meta label="SUMMARY">{latestTest.summary}</Meta><Meta label="TESTER">{latestTest.tester.display_name}</Meta><Meta label="OBSERVED / UTC"><time dateTime={latestTest.observed_at}>{latestTest.observed_at}</time></Meta><Meta label="REFERENCE"><code>{latestTest.test_result_id}</code></Meta></>}{openTest && <Meta label="OPEN REQUEST">{openTest.prompt}</Meta>}<Meta label="RECORDED RESULTS">{t?.results.length ?? 0}</Meta></dl></>},
    {id:'help',label:'Help / party',state:help.error ? 'UNAVAILABLE' : help.isPending ? 'LOADING' : h?.open_help_beacon ? 'REQUEST OPEN' : 'NO OPEN REQUEST',detail:help.error ? 'HELP LINK UNAVAILABLE' : h?.open_help_beacon?.summary ?? (help.isPending ? 'Reading help records' : 'Current builder collaboration'),body:help.error ? unavailable('HELP') : help.isPending ? <p role="status">Loading help and party.</p> : <><p>Help requests are declarations. Party membership follows accepted collaboration records.</p><dl><Meta label="OWNER">{h?.owner.display_name ?? 'Unavailable'}</Meta><Meta label="OPEN HELP">{h?.open_help_beacon?.summary ?? 'None open'}</Meta>{h?.open_help_beacon && <Meta label="SKILLS REQUESTED">{h.open_help_beacon.skills_needed.join(' / ') || 'None specified'}</Meta>}</dl><h3>Party</h3>{h?.party_members.length ? <ul>{h.party_members.map(member => <li key={member.player_id}>{member.display_name} / {member.role}</li>)}</ul> : <p>No accepted assists recorded.</p>}</>},
    {id:'ship',label:'Ship artifact',state:ship.error ? 'UNAVAILABLE' : ship.isPending ? 'LOADING' : latestShip?.state ?? 'EMPTY',detail:ship.error ? 'SHIP LINK UNAVAILABLE' : latestShip?.artifact.title ?? (ship.isPending ? 'Reading artifact state' : 'No artifact submitted'),truth:latestShip?.state === 'PROVEN' && latestShip.accepted_ship ? 'PROVEN' : latestShip?.state === 'OBSERVED' ? 'OBSERVED' : latestShip ? 'CLAIMED' : undefined,body:ship.error ? unavailable('SHIP') : ship.isPending ? <p role="status">Loading Ship state.</p> : latestShip ? <><p>Artifact submission, verifier observation and acceptance are separate records. Inspect the full chain in SHIP.</p><dl><Meta label="ARTIFACT">{latestShip.artifact.title}</Meta><Meta label="STATE">{latestShip.state}</Meta><Meta label="SUBMITTED / UTC"><time dateTime={latestShip.submitted_at}>{latestShip.submitted_at}</time></Meta>{latestShip.verifier_observation && <Meta label="VERIFIER">{latestShip.verifier_observation.outcome} / OBSERVATION</Meta>}{latestShip.accepted_ship && <Meta label="RECEIPT"><code>{latestShip.accepted_ship.receipt_id}</code></Meta>}</dl><a href={latestShip.artifact.url} target="_blank" rel="noreferrer">Open artifact ↗</a><a href={`?mode=ship&project=${encodeURIComponent(p.project_id)}`}>Inspect SHIP →</a></> : <><p>No artifact has been submitted for this project.</p><a href={`?mode=ship&project=${encodeURIComponent(p.project_id)}`}>Inspect SHIP readiness →</a></>},
  ];
  const selected = records.find(record => record.id === selectedId) ?? records[0];
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowDown' ? Math.min(index + 1, records.length - 1) : event.key === 'ArrowUp' ? Math.max(index - 1, 0) : event.key === 'Home' ? 0 : event.key === 'End' ? records.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();setSelectedId(records[next].id);event.currentTarget.closest('ol')?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  }
  return <TerminalShell mode="PROJECT" kicker="PROJECT / CURRENT BUILD" title={p.name} description="What is actually happening to this build? Inspect the source, people, tests and artifact." workspaceClassName="project-workstation" className="project-live" footerItems={['CURRENT RECORDS / NOT EVENT HISTORY','CLAIMED ≠ OBSERVED ≠ PROVEN']}>
    {coreError ? <p role="alert">STALE PROJECT SNAPSHOT / Last known records retained. Current state cannot be checked.</p> : null}
    <div className="project-focus"><div><small>CURRENT FOCUS</small><p>{p.current_focus}</p></div><a href="?mode=command">Next Move in COMMAND →</a></div>
    <header className="faceplate-print-head"><span>01 /</span><h2>BUILD / EVIDENCE INDEX</h2><small>SELECT A CHANNEL TO INSPECT</small></header>
    <div className="faceplate-split"><section className="faceplate-display project-index" aria-label="Project record index"><header><small>PROJECT / PRIVATE WORKBENCH</small><h2>Current records<span aria-hidden="true">_</span></h2></header><ol>{records.map((record,index) => <li key={record.id}><button className="faceplate-record" type="button" aria-pressed={selected.id === record.id} data-truth={record.truth?.toLowerCase()} onClick={() => setSelectedId(record.id)} onKeyDown={event => navigate(event,index)}><span className="project-record-number">0{index+1}</span><span><strong>{record.label}</strong><small>{record.detail}</small></span><b>{record.state}</b><span aria-hidden="true">↗</span></button></li>)}</ol><footer>↑ ↓ HOME END TO INSPECT / SOURCE STAYS PRIVATE</footer></section>
    <aside className="faceplate-inspector project-inspector" aria-label="Selected project record"><small>SELECTED CHANNEL / {selected.id.toUpperCase()}</small><span className="project-record-state" data-truth={selected.truth?.toLowerCase()}>{selected.state}</span><h2>{selected.label}</h2>{selected.body}</aside></div>
  </TerminalShell>;
}
