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
  const [step, setStep] = useState<1 | 2>(1);
  const [roundId, setRoundId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [goal, setGoal] = useState('');
  const [shipCondition, setShipCondition] = useState('');
  const [nextMove, setNextMove] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const openRounds = rounds.data?.filter(round => round.state === 'OPEN') ?? [];
  const selectedRound = roundId || openRounds[0]?.round_id || '';
  const mutation = useMutation({mutationFn: async () => {
    await client.joinRound(selectedRound);
    return client.createMission({
      request_id: requestId,
      round_id: selectedRound,
      project_name: projectName,
      goal,
      ship_condition: shipCondition,
      current_focus: nextMove,
      next_move: nextMove,
    });
  }, onSuccess: async () => {await cache.invalidateQueries({queryKey: ['inkubator']});}});
  function resetMutation() { setRequestId(crypto.randomUUID()); mutation.reset(); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (mutation.isPending || step !== 2) return; mutation.mutate(); }
  const canContinue = projectName.trim().length > 0 && goal.trim().length > 0;

  return <TerminalShell mode="COMMAND" kicker="01 / DECLARE" title="What are you shipping?" description="Two short decisions create the Mission. Inkubator can derive the rest as the build moves." workspaceClassName="journey-workspace">
    <section className="journey-display"><small>COMMAND / NO ACTIVE MISSION</small><h2>{step === 1 ? 'Name the thing.' : 'Define real.'}</h2><p>{step === 1 ? 'Tell Inkubator what this build is. No profile ceremony, task backlog or fake progress required.' : 'Say what must work for this to count as shipped, then choose the first concrete move.'}</p><span>CLAIMED ≠ OBSERVED ≠ PROVEN</span></section>
    <form className="journey-form" onSubmit={submit} onChange={resetMutation}>
      <fieldset disabled={mutation.isPending}><div className="journey-stepper" aria-label="Mission setup progress"><span aria-current={step === 1 ? 'step' : undefined}>01 / BUILD</span><span aria-current={step === 2 ? 'step' : undefined}>02 / SHIP WHEN</span></div>
      {rounds.isPending ? <p role="status">Loading available Rounds…</p> : rounds.isError ? <p role="alert">Rounds unavailable. <button type="button" onClick={() => void rounds.refetch()}>Retry</button></p> : !openRounds.length ? <p role="status">No Round is open. Your identity is saved; return when a Round opens.</p> : step === 1 ? <>
        <h2>Declare the build</h2>
        <label>Project name<input name="project" required maxLength={120} autoFocus value={projectName} onChange={event => setProjectName(event.target.value)}/></label>
        <label>What are you building?<textarea name="goal" required maxLength={240} value={goal} onChange={event => setGoal(event.target.value)}/></label>
        <button className="journey-primary" disabled={!canContinue} type="button" onClick={() => setStep(2)}>CONTINUE →</button>
      </> : <>
        <h2>When is it real?</h2>
        {openRounds.length > 1 ? <label>Round<select value={selectedRound} onChange={event => setRoundId(event.target.value)}>{openRounds.map(round => <option key={round.round_id} value={round.round_id}>{round.title}</option>)}</select></label> : <p className="journey-round-lock"><span>ROUND</span><strong>{openRounds[0].title}</strong><small>{openRounds[0].constraint}</small></p>}
        <label>What must work for this to count as shipped?<textarea name="condition" required maxLength={240} autoFocus value={shipCondition} onChange={event => setShipCondition(event.target.value)}/></label>
        <label>What are you doing next?<input name="next" required maxLength={240} value={nextMove} onChange={event => setNextMove(event.target.value)}/></label>
        <p className="journey-step-note">This becomes both your current focus and first Next Move. You can split them later if the build changes.</p>
        <div className="journey-form-actions"><button type="button" className="journey-secondary" onClick={() => setStep(1)}>← BACK</button><button className="journey-primary" disabled={!shipCondition.trim() || !nextMove.trim() || mutation.isPending} type="submit">{mutation.isPending ? 'Declaring…' : 'DECLARE MISSION'}</button></div>
      </>}
      {mutation.isError ? <p role="alert">{mutationAlert(mutation.error)}</p> : null}
    </fieldset></form>
  </TerminalShell>;
}
