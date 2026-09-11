import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {InkubatorApiClient, type CommandView, type MissionUpdateRequest} from '../generated/inkubator-api-client';
import {createInkubatorApiClient, type InkubatorProductApiClient} from '../inkubator-api';
import {mutationAlert} from './mutation-alert';
import './journey.css';

function ActionForm({label, children, action, disabled = false, successMessage = 'Recorded by Inkubator.'}: {label: string; children: React.ReactNode; action: (data: FormData, requestId: string) => Promise<unknown>; disabled?: boolean; successMessage?: string}) {
  const cache = useQueryClient();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const mutation = useMutation({mutationFn: (data: FormData) => action(data, requestId), onSuccess: async () => {await cache.invalidateQueries({queryKey: ['inkubator']});}});
  function submit(event: FormEvent<HTMLFormElement>) {event.preventDefault(); if (mutation.isPending) return; mutation.mutate(new FormData(event.currentTarget));}
  return <form onSubmit={submit} onChange={() => {setRequestId(crypto.randomUUID()); mutation.reset();}}><fieldset disabled={mutation.isPending}>{children}<button type="submit" disabled={mutation.isPending || disabled}>{mutation.isPending ? 'Saving…' : label}</button>{mutation.isError ? <p role="alert">{mutationAlert(mutation.error)}</p> : null}{mutation.isSuccess ? <p role="status">{successMessage}</p> : null}</fieldset></form>;
}

type CommandActionsClient = Pick<InkubatorApiClient, 'updateMission' | 'listGitHubRepositories' | 'createGitHubInstall' | 'linkProjectGitHubRepository' | 'createHelpBeacon' | 'closeHelpBeacon' | 'getProjectHelpLoop' | 'acceptAssist' | 'createExternalTestRequest' | 'getProjectExternalTests'> & Pick<InkubatorProductApiClient, 'getProjectPendingAssists'>;

export function CommandActions({command, client = createInkubatorApiClient()}: {command: CommandView; client?: CommandActionsClient}) {
  const cache = useQueryClient();
  const mission = command.mission;
  const canEdit = ['DECLARED', 'BUILDING', 'BLOCKED', 'SHIP_READY'].includes(mission.state);
  const states: Record<string, MissionUpdateRequest['state'][]> = {DECLARED: ['DECLARED','BUILDING','BLOCKED'], BUILDING: ['BUILDING','BLOCKED','SHIP_READY'], BLOCKED: ['BLOCKED','BUILDING'], SHIP_READY: ['SHIP_READY','BUILDING','BLOCKED']};
  const returningFromAuthorization = new URLSearchParams(window.location.search).get('source') === 'authorized';
  const authorizationFailed = new URLSearchParams(window.location.search).get('source') === 'authorization_failed';
  const linkedSourceUnavailable = !command.project.source_connected && command.project.source_visibility !== 'NONE';

  const repositories = useQuery({
    queryKey: ['inkubator', 'github', 'repositories'],
    queryFn: () => client.listGitHubRepositories(),
    retry: false,
    enabled: !command.project.source_connected,
    staleTime: 0,
    refetchInterval: !command.project.source_connected ? 4000 : false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  const helpLoop = useQuery({
    queryKey: ['inkubator', 'project', command.project.project_id, 'help'],
    queryFn: () => client.getProjectHelpLoop(command.project.project_id),
    retry: false,
    enabled: canEdit,
    staleTime: 0,
    refetchInterval: canEdit ? 4000 : false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  const pendingAssists = useQuery({
    queryKey: ['inkubator', 'project', command.project.project_id, 'pending-assists'],
    queryFn: () => client.getProjectPendingAssists(command.project.project_id),
    retry: false,
    enabled: canEdit && Boolean(helpLoop.data?.open_help_beacon),
    staleTime: 0,
    refetchInterval: canEdit && helpLoop.data?.open_help_beacon ? 4000 : false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  const externalTests = useQuery({
    queryKey: ['inkubator', 'project', command.project.project_id, 'tests'],
    queryFn: () => client.getProjectExternalTests(command.project.project_id),
    retry: false,
    enabled: canEdit,
    staleTime: 0,
    refetchInterval: canEdit ? 4000 : false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  const install = useMutation({mutationFn: () => client.createGitHubInstall(), onSuccess: value => window.location.assign(value.install_url)});
  const closeHelp = useMutation({
    mutationFn: (beaconId: string) => client.closeHelpBeacon(beaconId, {request_id: crypto.randomUUID()}),
    onSuccess: async () => {await cache.invalidateQueries({queryKey: ['inkubator']});},
  });
  const acceptAssist = useMutation({
    mutationFn: (assistId: string) => client.acceptAssist(assistId, {request_id: crypto.randomUUID()}),
    onSuccess: async () => {await cache.invalidateQueries({queryKey: ['inkubator']});},
  });

  useEffect(() => {
    if (!returningFromAuthorization || command.project.source_connected || !repositories.data?.length) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('source');
    window.history.replaceState(window.history.state, '', url);
  }, [returningFromAuthorization, command.project.source_connected, repositories.data?.length]);

  const openBeacon = helpLoop.data?.open_help_beacon;
  const openTest = externalTests.data?.requests.find(request => request.state === 'OPEN');
  const latestTest = useMemo(() => [...(externalTests.data?.results ?? [])].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0], [externalTests.data?.results]);
  const repositoriesReady = (repositories.data?.length ?? 0) > 0;

  return <section className="journey-controls" aria-label="Mission work controls">
    {canEdit ? <details id="command-work-control"><summary>EDIT WORK / DECLARED STATE</summary><ActionForm label="SAVE WORK STATE" action={(data, requestId) => client.updateMission(mission.mission_id, {request_id: requestId, state: String(data.get('state')) as MissionUpdateRequest['state'], current_focus: String(data.get('focus')), next_move: String(data.get('next')), blocker: String(data.get('blocker')).trim() || null})} successMessage="Work state updated. COMMAND will reconcile to the canonical projection.">
      <p>Your declaration updates focus and readiness. It cannot establish observation or proof.</p>
      <label>Work state<select aria-label="Work state" name="state" defaultValue={mission.state}>{states[mission.state]?.map(state => <option key={state}>{state}</option>)}</select></label>
      <label>Current focus<input name="focus" required maxLength={240} defaultValue={mission.current_focus}/></label>
      <label>Next move<input name="next" required maxLength={240} defaultValue={mission.next_move}/></label>
      <label>Blocker / optional<input name="blocker" maxLength={240} defaultValue={mission.blocker ?? ''}/></label>
    </ActionForm></details> : null}

    <details id="command-source-control" open={!command.project.source_connected || returningFromAuthorization || authorizationFailed}><summary>SOURCE / REPOSITORY ACCESS</summary><div><p>GitHub sign-in identifies you. Installing the read-only GitHub App separately authorizes selected repositories.</p>{authorizationFailed ? <p className="journey-source-status" role="alert">AUTHORIZATION DID NOT COMPLETE / {new URLSearchParams(window.location.search).get('reason') ?? 'TRY AGAIN'}</p> : null}<p className="journey-source-status">{command.project.source_connected ? `SOURCE CONNECTED / ${command.project.source_visibility} / ${command.project.observation_state}` : linkedSourceUnavailable ? `LINKED SOURCE / ACCESS REVOKED / ${command.project.source_visibility}` : repositoriesReady ? `REPOSITORY ACCESS READY / ${repositories.data!.length} AVAILABLE` : returningFromAuthorization ? 'AUTHORIZATION RETURNED / CHECKING REPOSITORY ACCESS' : 'NO REPOSITORY CONNECTED'}</p>
      {!command.project.source_connected ? <>
        <button type="button" disabled={install.isPending} onClick={() => install.mutate()}>{install.isPending ? 'PENDING / OPENING AUTHORIZATION…' : repositoriesReady ? 'CHANGE REPOSITORY ACCESS' : linkedSourceUnavailable ? 'REAUTHORIZE SOURCE' : 'AUTHORIZE REPOSITORIES'}</button>{install.isError ? <p role="alert">Repository authorization unavailable: {mutationAlert(install.error)} Your sign-in remains separate.</p> : null}
        <ActionForm label="LINK AUTHORIZED REPOSITORY" disabled={!repositoriesReady} action={(data) => client.linkProjectGitHubRepository(command.project.project_id, {repository_id: String(data.get('repository')).trim()})} successMessage="Repository linked. COMMAND will now watch the canonical source projection.">
          <label>Authorized repository<select aria-label="Authorized repository" name="repository" required disabled={!repositoriesReady}><option value="">Choose a repository</option>{repositories.data?.map(repository => <option key={repository.repository_id} value={repository.repository_id}>{repository.full_name} / {repository.private ? 'PRIVATE' : 'PUBLIC'}</option>)}</select></label>
          {repositories.isPending ? <p role="status">Loading authorized repositories…</p> : repositories.isError ? <p role="alert">Authorized repositories unavailable. Inkubator will retry on focus, reconnect and while this source is unlinked.</p> : !repositoriesReady ? <p>{returningFromAuthorization ? 'GitHub returned successfully. Waiting for authorized repositories to appear…' : 'No repositories authorized yet. Authorize repositories above; this list refreshes automatically when permission changes.'}</p> : <p role="status">Authorization detected. Choose the repository this Mission should observe.</p>}
          <button type="button" onClick={() => void repositories.refetch()}>CHECK NOW</button><p>Private repository details stay within your account. Linking a source does not make its contents public.</p>
        </ActionForm>
      </> : <p>Source arrival is observed server-side. A connection alone is not evidence of completed work.</p>}
    </div></details>

    {canEdit ? <>
      <details id="command-help-control" open={Boolean(mission.blocker || openBeacon)}><summary>HELP / ASK FOR A CONTRIBUTION</summary>
        {helpLoop.isError ? <p role="alert">HELP STATE UNAVAILABLE. <button type="button" onClick={() => void helpLoop.refetch()}>CHECK AGAIN</button></p> : openBeacon ? <div className="journey-followup" role="status"><small>HELP BEACON / OPEN</small><strong>{openBeacon.summary}</strong><p>This request is live in WORLD. Inkubator keeps checking for accepted collaboration.</p><button type="button" disabled={closeHelp.isPending} onClick={() => closeHelp.mutate(openBeacon.beacon_id)}>{closeHelp.isPending ? 'Closing…' : 'CLOSE HELP BEACON'}</button>{closeHelp.isError ? <p role="alert">{mutationAlert(closeHelp.error)}</p> : null}</div> : helpLoop.isPending ? <p role="status">Checking current Help state…</p> : <ActionForm label="OPEN HELP BEACON" action={(data, requestId) => client.createHelpBeacon(command.project.project_id, {request_id: requestId, summary: String(data.get('summary')), skills_needed: []})} successMessage="Help Beacon opened. WORLD and PROJECT will reconcile automatically."><label>What help would move this build forward?<textarea name="summary" required maxLength={240}/></label><p>A public request invites help. It grants no earned progress.</p></ActionForm>}
        {openBeacon ? pendingAssists.isError ? <p role="alert">PENDING ASSISTS UNAVAILABLE. {mutationAlert(pendingAssists.error)} <button type="button" onClick={() => void pendingAssists.refetch()}>CHECK AGAIN</button></p> : pendingAssists.isPending ? <p role="status">Checking pending Assist offers…</p> : pendingAssists.data?.assists.length ? <div className="journey-pending-assists"><small>ASSIST OFFERS / {pendingAssists.data.assists.length} PENDING</small>{pendingAssists.data.assists.map(assist => <article key={assist.assist_id}><strong>{assist.offered_by_display_name}</strong><p>{assist.message}</p><button type="button" disabled={acceptAssist.isPending} onClick={() => acceptAssist.mutate(assist.assist_id)}>{acceptAssist.isPending && acceptAssist.variables === assist.assist_id ? 'Accepting…' : 'ACCEPT ASSIST'}</button></article>)}</div> : <p className="journey-followup-note">NO PENDING ASSISTS / waiting for another builder. This state refreshes automatically.</p> : null}
        {acceptAssist.isError ? <p role="alert">{mutationAlert(acceptAssist.error)}</p> : null}{acceptAssist.isSuccess ? <p role="status">Assist accepted. Party state will reconcile automatically.</p> : null}
      </details>

      <details id="command-test-control" open={Boolean(openTest)}><summary>EXTERNAL TEST / ASK FOR EVIDENCE</summary>
        {externalTests.isError ? <p role="alert">TEST STATE UNAVAILABLE. <button type="button" onClick={() => void externalTests.refetch()}>CHECK AGAIN</button></p> : openTest ? <div className="journey-followup" role="status"><small>EXTERNAL TEST / OPEN</small><strong>{openTest.prompt}</strong><p>Waiting for another builder to record a result. This state refreshes automatically.</p></div> : externalTests.isPending ? <p role="status">Checking external-test state…</p> : <ActionForm label="REQUEST EXTERNAL TEST" action={(data, requestId) => client.createExternalTestRequest(command.project.project_id, {request_id: requestId, prompt: String(data.get('prompt'))})} successMessage="External test requested. PROJECT will reconcile when another builder records evidence."><label>What should another builder test?<textarea name="prompt" required maxLength={240}/></label><p>An independent tester must record their own result. Requesting a test is not a PASS.</p></ActionForm>}
        {latestTest ? <p className="journey-followup-note">LATEST RESULT / {latestTest.outcome} / {latestTest.tester.display_name} / {latestTest.summary}</p> : null}
      </details>
    </> : null}
  </section>;
}
