import {useState, type FormEvent} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {InkubatorApiClient, type CommandView, type MissionUpdateRequest} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {mutationAlert} from './mutation-alert';
import './journey.css';

function ActionForm({label, children, action, disabled = false}: {label: string; children: React.ReactNode; action: (data: FormData, requestId: string) => Promise<unknown>; disabled?: boolean}) {
  const cache = useQueryClient();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const mutation = useMutation({mutationFn: (data: FormData) => action(data, requestId), onSuccess: async () => {await cache.invalidateQueries({queryKey: ['inkubator']});}});
  function submit(event: FormEvent<HTMLFormElement>) {event.preventDefault(); if (mutation.isPending) return; mutation.mutate(new FormData(event.currentTarget));}
  return <form onSubmit={submit} onChange={() => {setRequestId(crypto.randomUUID()); mutation.reset();}}><fieldset disabled={mutation.isPending || disabled}>{children}<button type="submit" disabled={mutation.isPending || disabled}>{mutation.isPending ? 'Saving…' : label}</button>{mutation.isError ? <p role="alert">{mutationAlert(mutation.error)}</p> : null}{mutation.isSuccess ? <p role="status">Recorded by Inkubator.</p> : null}</fieldset></form>;
}

export function CommandActions({command, client = createInkubatorApiClient()}: {command: CommandView; client?: Pick<InkubatorApiClient, 'updateMission' | 'listGitHubRepositories' | 'createGitHubInstall' | 'linkProjectGitHubRepository' | 'createHelpBeacon' | 'createExternalTestRequest'>}) {
  const mission = command.mission;
  const canEdit = ['DECLARED', 'BUILDING', 'BLOCKED', 'SHIP_READY'].includes(mission.state);
  const states: Record<string, MissionUpdateRequest['state'][]> = {DECLARED: ['DECLARED','BUILDING','BLOCKED'], BUILDING: ['BUILDING','BLOCKED','SHIP_READY'], BLOCKED: ['BLOCKED','BUILDING'], SHIP_READY: ['SHIP_READY','BUILDING','BLOCKED']};
  const repositories = useQuery({queryKey: ['inkubator', 'github', 'repositories'], queryFn: () => client.listGitHubRepositories(), retry: false, enabled: !command.project.source_connected});
  const install = useMutation({mutationFn: () => client.createGitHubInstall(), onSuccess: value => window.location.assign(value.install_url)});
  return <section className="journey-controls" aria-label="Mission work controls">
    {canEdit ? <details id="command-work-control"><summary>EDIT WORK / DECLARED STATE</summary><ActionForm label="SAVE WORK STATE" action={(data, requestId) => client.updateMission(mission.mission_id, {request_id: requestId, state: String(data.get('state')) as MissionUpdateRequest['state'], current_focus: String(data.get('focus')), next_move: String(data.get('next')), blocker: String(data.get('blocker')).trim() || null})}>
      <p>Your declaration updates focus and readiness. It cannot establish observation or proof.</p>
      <label>Work state<select aria-label="Work state" name="state" defaultValue={mission.state}>{states[mission.state]?.map(state => <option key={state}>{state}</option>)}</select></label>
      <label>Current focus<input name="focus" required maxLength={240} defaultValue={mission.current_focus}/></label>
      <label>Next move<input name="next" required maxLength={240} defaultValue={mission.next_move}/></label>
      <label>Blocker / optional<input name="blocker" maxLength={240} defaultValue={mission.blocker ?? ''}/></label>
    </ActionForm></details> : null}
    <details id="command-source-control" open={new URLSearchParams(window.location.search).get('source') === 'authorized'}><summary>SOURCE / REPOSITORY ACCESS</summary><div><p>GitHub sign-in identifies you. Installing the read-only GitHub App separately authorizes selected repositories.</p><p className="journey-source-status">{command.project.source_connected ? `SOURCE CONNECTED / ${command.project.source_visibility} / ${command.project.observation_state}` : 'NO REPOSITORY CONNECTED'}</p>
      {!command.project.source_connected ? <><button type="button" disabled={install.isPending} onClick={() => install.mutate()}>{install.isPending ? 'Opening installation…' : 'AUTHORIZE REPOSITORIES'}</button>{install.isError ? <p role="alert">Repository authorization unavailable: {mutationAlert(install.error)} Your sign-in remains separate.</p> : null}
      <ActionForm label="LINK AUTHORIZED REPOSITORY" disabled={!repositories.data?.length} action={(data) => client.linkProjectGitHubRepository(command.project.project_id, {repository_id: String(data.get('repository')).trim()})}><label>Authorized repository<select aria-label="Authorized repository" name="repository" required disabled={!repositories.data?.length}><option value="">Choose a repository</option>{repositories.data?.map(repository => <option key={repository.repository_id} value={repository.repository_id}>{repository.full_name} / {repository.private ? 'PRIVATE' : 'PUBLIC'}</option>)}</select></label>{repositories.isPending ? <p role="status">Loading authorized repositories…</p> : repositories.isError ? <p role="alert">Authorized repositories unavailable.</p> : !repositories.data?.length ? <p>No repositories authorized yet. Authorize repositories above, then return here.</p> : null}<button type="button" onClick={() => void repositories.refetch()}>REFRESH REPOSITORIES</button><p>Private repository details stay within your account. Linking a source does not make its contents public.</p></ActionForm></> : <p>Source arrival is observed server-side. A connection alone is not evidence of completed work.</p>}
    </div></details>
    {canEdit ? <><details id="command-help-control"><summary>HELP / ASK FOR A CONTRIBUTION</summary><ActionForm label="OPEN HELP BEACON" action={(data, requestId) => client.createHelpBeacon(command.project.project_id, {request_id: requestId, summary: String(data.get('summary')), skills_needed: []})}><label>What help would move this build forward?<textarea name="summary" required maxLength={240}/></label><p>A public request invites help. It grants no earned progress.</p></ActionForm></details>
    <details id="command-test-control"><summary>EXTERNAL TEST / ASK FOR EVIDENCE</summary><ActionForm label="REQUEST EXTERNAL TEST" action={(data, requestId) => client.createExternalTestRequest(command.project.project_id, {request_id: requestId, prompt: String(data.get('prompt'))})}><label>What should another builder test?<textarea name="prompt" required maxLength={240}/></label><p>An independent tester must record their own result. Requesting a test is not a PASS.</p></ActionForm></details></> : null}
  </section>;
}
