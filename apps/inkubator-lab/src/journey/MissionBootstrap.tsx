import {useState, type FormEvent} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {InkubatorApiClient} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {mutationAlert} from './mutation-alert';
import {TerminalShell} from '../shell/TerminalShell';
import './journey.css';

export default function MissionBootstrap({client = createInkubatorApiClient()}: {client?: Pick<InkubatorApiClient, 'listRounds' | 'joinRound' | 'createMission'>} = {}) {
  const cache = useQueryClient();
  const rounds = useQuery({queryKey: ['inkubator', 'rounds'], queryFn: () => client.listRounds(), retry: false});
  const [roundId, setRoundId] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const openRounds = rounds.data?.filter(round => round.state === 'OPEN') ?? [];
  const selectedRound = roundId || openRounds[0]?.round_id || '';
  const mutation = useMutation({mutationFn: async (data: FormData) => {
    await client.joinRound(selectedRound);
    return client.createMission({request_id: requestId, round_id: selectedRound,
      project_name: String(data.get('project')), goal: String(data.get('goal')), ship_condition: String(data.get('condition')),
      current_focus: String(data.get('focus')), next_move: String(data.get('next'))});
  }, onSuccess: async () => {await cache.invalidateQueries({queryKey: ['inkubator']});}});
  function submit(event: FormEvent<HTMLFormElement>) {event.preventDefault(); if (mutation.isPending) return; mutation.mutate(new FormData(event.currentTarget));}
  return <TerminalShell mode="COMMAND" kicker="01 / DECLARE" title="Start a build." description="Your identity is connected. Declare a Mission and its Project to give COMMAND a next move." workspaceClassName="journey-workspace">
    <section className="journey-display"><small>COMMAND / NO ACTIVE MISSION</small><h2>Make the next move explicit.</h2><p>A Mission is your declaration of what to build and what a shipped result must satisfy. It grants no proof.</p><span>CLAIMED ≠ OBSERVED ≠ PROVEN</span></section>
    <form className="journey-form" onSubmit={submit} onChange={() => {setRequestId(crypto.randomUUID()); mutation.reset();}}>
      <fieldset disabled={mutation.isPending}><h2>Declare your Mission</h2>
      {rounds.isPending ? <p role="status">Loading available Rounds…</p> : rounds.isError ? <p role="alert">Rounds unavailable. <button type="button" onClick={() => void rounds.refetch()}>Retry</button></p> : !openRounds.length ? <p role="status">No Round is open. Your identity is saved; return when a Round opens.</p> : <>
        <label>Round<select value={selectedRound} onChange={event => setRoundId(event.target.value)}>{openRounds.map(round => <option key={round.round_id} value={round.round_id}>{round.title}</option>)}</select></label>
        <label>Project name<input name="project" required maxLength={120}/></label>
        <label>What are you building?<input name="goal" required maxLength={240}/></label>
        <label>What must be true to Ship?<textarea name="condition" required maxLength={240}/></label>
        <label>Current focus<input name="focus" required maxLength={240}/></label>
        <label>Your next move<input name="next" required maxLength={240}/></label>
        <button className="journey-primary" disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Declaring…' : 'DECLARE MISSION'}</button>
      </>}
      {mutation.isError ? <p role="alert">{mutationAlert(mutation.error)}</p> : null}
    </fieldset></form>
  </TerminalShell>;
}
