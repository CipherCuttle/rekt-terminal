import { useEffect, useMemo, useState } from 'react';
import {
  createMissionFacts,
  debriefForReceipt,
  MISSION_DEFINITIONS,
  type LearningStateV0,
  type MissionId,
  type MissionLearnerInput,
  type MissionReceiptV0,
  type EvidenceClassification,
  type LiquidityDecision,
} from '@rekt-ink/learning';

type TrainingAction = 'EX_ENTRY' | 'EX_EXIT' | 'ST_ENTRY' | 'ST_PLACE_STOP' | 'ST_ALLOW_EXIT';

export function LearningMissionPanel({ missionId, learning, onSubmit, onTrainingAction, onAcknowledgeDebrief }: { missionId: MissionId; learning: LearningStateV0; onSubmit: (input: MissionLearnerInput) => void; onTrainingAction?: (action: TrainingAction) => void; onAcknowledgeDebrief?: () => void }) {
  const definition = MISSION_DEFINITIONS[missionId];
  const [showGuide, setShowGuide] = useState(true);
  const [showTask, setShowTask] = useState(false);
  const [mdAnswers, setMdAnswers] = useState<Record<string, EvidenceClassification>>({});
  const [freshness, setFreshness] = useState<'FRESH' | 'STALE'>('STALE');
  const [entered, setEntered] = useState(false);
  const [closed, setClosed] = useState(false);
  const [markAnswer, setMarkAnswer] = useState<'MARK_IS_OBSERVATION' | 'MARK_IS_FILL' | 'MARK_AND_FILL_ARE_IDENTICAL'>('MARK_IS_OBSERVATION');
  const [feeAnswer, setFeeAnswer] = useState<'FEES_AND_EXECUTION_CHANGE_RESULT' | 'FEES_DO_NOT_MATTER' | 'ONLY_PNL_MATTERS'>('FEES_AND_EXECUTION_CHANGE_RESULT');
  const [deepDecision, setDeepDecision] = useState<LiquidityDecision | ''>('');
  const [thinDecision, setThinDecision] = useState<LiquidityDecision | ''>('');
  const [resizedQuoteWei, setResizedQuoteWei] = useState('250000000000000000');
  const [modelAnswer, setModelAnswer] = useState<'SPOT_FILL_V0_MODEL' | 'EXCHANGE_QUOTE' | 'EXACT_ORDER_BOOK' | ''>('');
  const [stopPlaced, setStopPlaced] = useState(false);
  const [acknowledgement, setAcknowledgement] = useState<'STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL' | 'STOP_GUARANTEES_FILL' | 'STOP_IS_MARK_PRICE'>('STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL');
  const [allowedWidening, setAllowedWidening] = useState<'NEVER_WIDEN' | 'WIDEN_IF_LOSING' | 'MOVE_AFTER_TRIGGER'>('NEVER_WIDEN');
  const [allowedExit, setAllowedExit] = useState<'ALLOW_PLANNED_EXIT' | 'CANCEL_STOP' | 'WAIT_FOR_PROFIT' | ''>('');
  const [riskWidthAnswer, setRiskWidthAnswer] = useState<'WIDER_STOP_SMALLER_SIZE' | 'WIDER_STOP_SAME_SIZE' | 'WIDER_STOP_LARGER_SIZE' | ''>('');
  const [selectedSize, setSelectedSize] = useState('');

  useEffect(() => {
    setShowGuide(true);
    setShowTask(false);
    setMdAnswers({});
    setFreshness('STALE');
    setEntered(false);
    setClosed(false);
    setMarkAnswer('MARK_IS_OBSERVATION');
    setFeeAnswer('FEES_AND_EXECUTION_CHANGE_RESULT');
    setDeepDecision('');
    setThinDecision('');
    setResizedQuoteWei('250000000000000000');
    setModelAnswer('');
    setStopPlaced(false);
    setAcknowledgement('STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL');
    setAllowedWidening('NEVER_WIDEN');
    setAllowedExit('');
    setRiskWidthAnswer('');
    setSelectedSize('');
  }, [missionId]);

  const latest = useMemo(() => [...learning.attempts].reverse().find((attempt) => attempt.missionId === missionId) ?? null, [learning.attempts, missionId]);
  const pendingDebrief = latest?.verdict === 'PASS' && learning.pendingDebriefReceiptId === latest.receiptId;
  const submit = () => {
    if (missionId === 'MD-01') onSubmit({ kind: 'MD-01', classifications: mdAnswers, freshnessAnswer: freshness });
    if (missionId === 'EX-01') onSubmit({ kind: 'EX-01', markAnswer, feeAnswer });
    if (missionId === 'LQ-01' && deepDecision !== '' && thinDecision !== '' && modelAnswer !== '') {
      const input: MissionLearnerInput = { kind: 'LQ-01', deepDecision, thinDecision, modelAnswer };
      onSubmit(thinDecision === 'RESIZE' ? { ...input, resizedQuoteWei } : input);
    }
    if (missionId === 'ST-01' && allowedExit !== '') onSubmit({ kind: 'ST-01', acknowledgement, allowedWidening, allowedExit });
    if (missionId === 'RS-01' && selectedSize !== '' && riskWidthAnswer !== '' && modelAnswer !== '') onSubmit({ kind: 'RS-01', selectedPositionSizeAtoms: selectedSize, widthAnswer: riskWidthAnswer, modelAnswer: modelAnswer === 'SPOT_FILL_V0_MODEL' ? 'RISK_PLAN_V0' : 'SIMPLE_UNCHECKED_FORMULA' });
  };

  return (
    <section className="mission-strip" aria-label="Active learning mission">
      <header className="mission-head">
        <div>
          <p className="mission-kicker">TRAINING MODE · SYNTHETIC</p>
          <h2>{definition.title}</h2>
        </div>
        <span className={`mission-state mission-state-${latest?.verdict?.toLowerCase() ?? 'active'}`}>{latest?.verdict ?? 'ACTIVE'}</span>
      </header>
      <p className="mission-objective">{definition.objective}</p>
      <button type="button" className="mission-guide-toggle" aria-expanded={showGuide} onClick={() => setShowGuide((value) => !value)}>
        {showGuide ? 'HIDE EXPLANATION' : 'SHOW EXPLANATION'}
      </button>
      {showGuide && <p className="mission-guide">{guideFor(missionId)}</p>}

      <div className="mission-actions">
        {pendingDebrief ? <button type="button" className="mission-submit" onClick={() => onAcknowledgeDebrief?.()}>CONTINUE →</button> : <><button type="button" className="mission-task-toggle" aria-expanded={showTask} onClick={() => setShowTask((value) => !value)}>{showTask ? 'HIDE MISSION TASK' : 'OPEN MISSION TASK →'}</button>{showTask && <button type="button" className="mission-submit" onClick={submit}>COMMIT ANSWERS / ACTIONS</button>}</>}
        <span className="mission-note">PASS is decided by the learning domain. No Career unlock, XP, or PnL grade.{pendingDebrief ? ' Review the debrief before continuing.' : ''}</span>
      </div>
      {showTask && !pendingDebrief && <div className="mission-interaction">{renderInteraction(missionId, { mdAnswers, setMdAnswers, freshness, setFreshness, entered, setEntered, closed, setClosed, markAnswer, setMarkAnswer, feeAnswer, setFeeAnswer, deepDecision, setDeepDecision, thinDecision, setThinDecision, resizedQuoteWei, setResizedQuoteWei, modelAnswer, setModelAnswer, stopPlaced, setStopPlaced, acknowledgement, setAcknowledgement, allowedWidening, setAllowedWidening, allowedExit, setAllowedExit, riskWidthAnswer, setRiskWidthAnswer, selectedSize, setSelectedSize, onTrainingAction })}</div>}
      {latest && <MissionDebrief receipt={latest} />}
    </section>
  );
}

function guideFor(id: MissionId): string {
  if (id === 'MD-01') return 'A label describes the evidence path REKT can justify. CONFIRMED, DERIVED, SYNTHETIC, and STALE are not interchangeable. A stale observation is a fail-closed input.';
  if (id === 'EX-01') return 'The mark is an observation. A fill is the result of SPOT_FILL_V0 execution. Fees and modeled execution affect the realized result; a profitable or losing result does not prove understanding.';
  if (id === 'LQ-01') return 'Participation is requested notional relative to usable depth. This is MODEL-SPECIFIC / SPOT_FILL_V0 impact, not an exchange quote or exact order-book simulation. Declining an invalid order is a correct action.';
  if (id === 'ST-01') return 'A stop is an instruction. The trigger observation starts a market exit, but the actual fill can differ because execution still goes through the fill model. Do not widen the invalidation.';
  return 'Account risk and invalidation come before size. The production RISK_PLAN_V0 calculator derives a size that stays within the selected budget under SPOT_FILL_V0 assumptions.';
}

type InteractionState = {
  mdAnswers: Record<string, EvidenceClassification>;
  setMdAnswers: (value: Record<string, EvidenceClassification>) => void;
  freshness: 'FRESH' | 'STALE'; setFreshness: (value: 'FRESH' | 'STALE') => void;
  entered: boolean; setEntered: (value: boolean) => void; closed: boolean; setClosed: (value: boolean) => void;
  markAnswer: 'MARK_IS_OBSERVATION' | 'MARK_IS_FILL' | 'MARK_AND_FILL_ARE_IDENTICAL'; setMarkAnswer: (value: 'MARK_IS_OBSERVATION' | 'MARK_IS_FILL' | 'MARK_AND_FILL_ARE_IDENTICAL') => void;
  feeAnswer: 'FEES_AND_EXECUTION_CHANGE_RESULT' | 'FEES_DO_NOT_MATTER' | 'ONLY_PNL_MATTERS'; setFeeAnswer: (value: 'FEES_AND_EXECUTION_CHANGE_RESULT' | 'FEES_DO_NOT_MATTER' | 'ONLY_PNL_MATTERS') => void;
  deepDecision: LiquidityDecision | ''; setDeepDecision: (value: LiquidityDecision | '') => void; thinDecision: LiquidityDecision | ''; setThinDecision: (value: LiquidityDecision | '') => void;
  resizedQuoteWei: string; setResizedQuoteWei: (value: string) => void;
  modelAnswer: 'SPOT_FILL_V0_MODEL' | 'EXCHANGE_QUOTE' | 'EXACT_ORDER_BOOK' | ''; setModelAnswer: (value: 'SPOT_FILL_V0_MODEL' | 'EXCHANGE_QUOTE' | 'EXACT_ORDER_BOOK' | '') => void;
  stopPlaced: boolean; setStopPlaced: (value: boolean) => void;
  acknowledgement: 'STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL' | 'STOP_GUARANTEES_FILL' | 'STOP_IS_MARK_PRICE'; setAcknowledgement: (value: 'STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL' | 'STOP_GUARANTEES_FILL' | 'STOP_IS_MARK_PRICE') => void;
  allowedWidening: 'NEVER_WIDEN' | 'WIDEN_IF_LOSING' | 'MOVE_AFTER_TRIGGER'; setAllowedWidening: (value: 'NEVER_WIDEN' | 'WIDEN_IF_LOSING' | 'MOVE_AFTER_TRIGGER') => void;
  allowedExit: 'ALLOW_PLANNED_EXIT' | 'CANCEL_STOP' | 'WAIT_FOR_PROFIT' | ''; setAllowedExit: (value: 'ALLOW_PLANNED_EXIT' | 'CANCEL_STOP' | 'WAIT_FOR_PROFIT' | '') => void;
  riskWidthAnswer: 'WIDER_STOP_SMALLER_SIZE' | 'WIDER_STOP_SAME_SIZE' | 'WIDER_STOP_LARGER_SIZE' | ''; setRiskWidthAnswer: (value: 'WIDER_STOP_SMALLER_SIZE' | 'WIDER_STOP_SAME_SIZE' | 'WIDER_STOP_LARGER_SIZE' | '') => void;
  selectedSize: string; setSelectedSize: (value: string) => void;
  onTrainingAction?: (action: TrainingAction) => void;
};

function training(state: InteractionState, action: TrainingAction): void {
  state.onTrainingAction?.(action);
}

function renderInteraction(id: MissionId, state: InteractionState) {
  if (id === 'MD-01') {
    const items = (createMissionFacts('MD-01') as Extract<ReturnType<typeof createMissionFacts>, { kind: 'MD-01' }>).items.filter((item) => !item.workedExample);
    return <div className="mission-form"><p className="mission-worked">WORKED EXAMPLE · chain receipt → CONFIRMED</p>{items.map((item) => <label key={item.itemId}>{item.itemId}<select value={state.mdAnswers[item.itemId] ?? ''} onChange={(event) => state.setMdAnswers({ ...state.mdAnswers, [item.itemId]: event.currentTarget.value as EvidenceClassification })}><option value="">SELECT LABEL</option><option>CONFIRMED</option><option>DERIVED</option><option>SYNTHETIC</option><option>STALE</option></select></label>)}<label>STALE OBSERVATION → FAIL CLOSED<select value={state.freshness} onChange={(event) => state.setFreshness(event.currentTarget.value as 'FRESH' | 'STALE')}><option>STALE</option><option>FRESH</option></select></label></div>;
  }
  if (id === 'EX-01') return <div className="mission-form"><ActionToggle label="ENTER FIXED TRAINING TRADE" active={state.entered} onClick={() => { state.setEntered(!state.entered); training(state, 'EX_ENTRY'); }} /><label>MARK MEANS<select value={state.markAnswer} onChange={(event) => state.setMarkAnswer(event.currentTarget.value as InteractionState['markAnswer'])}><option value="MARK_IS_OBSERVATION">MARK IS AN OBSERVATION</option><option value="MARK_IS_FILL">MARK IS THE FILL</option><option value="MARK_AND_FILL_ARE_IDENTICAL">MARK AND FILL ARE IDENTICAL</option></select></label><label>REALIZED RESULT CHANGES BECAUSE<select value={state.feeAnswer} onChange={(event) => state.setFeeAnswer(event.currentTarget.value as InteractionState['feeAnswer'])}><option value="FEES_AND_EXECUTION_CHANGE_RESULT">FEES + EXECUTION</option><option value="FEES_DO_NOT_MATTER">FEES DO NOT MATTER</option><option value="ONLY_PNL_MATTERS">ONLY PNL MATTERS</option></select></label><ActionToggle label="CLOSE TRAINING TRADE" active={state.closed} onClick={() => { state.setClosed(!state.closed); training(state, 'EX_EXIT'); }} /></div>;
  if (id === 'LQ-01') return <div className="mission-form"><p className="mission-worked">SAME REQUESTED NOTIONAL · DEEP vs THIN DEPTH</p><label>DEEP LIQUIDITY<select value={state.deepDecision} onChange={(event) => state.setDeepDecision(event.currentTarget.value as InteractionState['deepDecision'])}><option value="">SELECT DECISION</option><option>SEND</option><option>RESIZE</option><option>DECLINE</option></select></label><label>THIN LIQUIDITY<select value={state.thinDecision} onChange={(event) => state.setThinDecision(event.currentTarget.value as InteractionState['thinDecision'])}><option value="">SELECT DECISION</option><option>DECLINE</option><option>RESIZE</option><option>SEND</option></select></label>{state.thinDecision === 'RESIZE' && <label>RESIZED NOTIONAL (WEI)<input value={state.resizedQuoteWei} onChange={(event) => state.setResizedQuoteWei(event.currentTarget.value)} inputMode="numeric" /></label>}<label>IMPACT IS<select value={state.modelAnswer} onChange={(event) => state.setModelAnswer(event.currentTarget.value as InteractionState['modelAnswer'])}><option value="">SELECT MODEL</option><option value="SPOT_FILL_V0_MODEL">MODEL-SPECIFIC / SPOT_FILL_V0</option><option value="EXCHANGE_QUOTE">AN EXCHANGE QUOTE</option><option value="EXACT_ORDER_BOOK">AN EXACT ORDER BOOK</option></select></label></div>;
  if (id === 'ST-01') return <div className="mission-form"><ActionToggle label="ENTER ADVERSE-MOVE TRAINING TRADE" active={state.entered} onClick={() => { state.setEntered(!state.entered); training(state, 'ST_ENTRY'); }} /><ActionToggle label="PLACE VALID PROTECTIVE STOP" active={state.stopPlaced} onClick={() => { state.setStopPlaced(!state.stopPlaced); training(state, 'ST_PLACE_STOP'); }} /><label>STOP MEANS<select value={state.acknowledgement} onChange={(event) => state.setAcknowledgement(event.currentTarget.value as InteractionState['acknowledgement'])}><option value="STOP_IS_INSTRUCTION_NOT_GUARANTEED_FILL">INSTRUCTION · NOT GUARANTEED FILL</option><option value="STOP_GUARANTEES_FILL">GUARANTEED FILL</option><option value="STOP_IS_MARK_PRICE">MARK PRICE</option></select></label><label>WHEN LOSING<select value={state.allowedWidening} onChange={(event) => state.setAllowedWidening(event.currentTarget.value as InteractionState['allowedWidening'])}><option value="NEVER_WIDEN">NEVER WIDEN</option><option value="WIDEN_IF_LOSING">WIDEN IF LOSING</option><option value="MOVE_AFTER_TRIGGER">MOVE AFTER TRIGGER</option></select></label><label>PLANNED EXIT<select value={state.allowedExit} onChange={(event) => { const value = event.currentTarget.value as InteractionState['allowedExit']; state.setAllowedExit(value); if (value === 'ALLOW_PLANNED_EXIT') training(state, 'ST_ALLOW_EXIT'); }}><option value="">SELECT EXIT ACTION</option><option value="ALLOW_PLANNED_EXIT">ALLOW PLANNED EXIT</option><option value="CANCEL_STOP">CANCEL STOP</option><option value="WAIT_FOR_PROFIT">WAIT FOR PROFIT</option></select></label></div>;
  const facts = createMissionFacts('RS-01') as Extract<ReturnType<typeof createMissionFacts>, { kind: 'RS-01' }>;
  return <div className="mission-form"><p className="mission-worked">PRODUCTION PLAN · RISK_PLAN_V0 · WIDER STOP SIZE {facts.widerStop.positionSizeAtoms} ATOMS</p><label>SELECT POSITION SIZE (ATOMS)<input value={state.selectedSize} onChange={(event) => state.setSelectedSize(event.currentTarget.value)} inputMode="numeric" placeholder="ENTER A SIZE" /></label><p className="mission-help">MAX ACCEPTED FOR THIS TRAINING PLAN: {facts.narrowStop.positionSizeAtoms} ATOMS</p><label>WIDER STOP IMPLIES<select value={state.riskWidthAnswer} onChange={(event) => state.setRiskWidthAnswer(event.currentTarget.value as InteractionState['riskWidthAnswer'])}><option value="">SELECT RELATIONSHIP</option><option value="WIDER_STOP_SMALLER_SIZE">SMALLER SIZE</option><option value="WIDER_STOP_SAME_SIZE">SAME SIZE</option><option value="WIDER_STOP_LARGER_SIZE">LARGER SIZE</option></select></label><label>AUTHORITATIVE MODEL<select value={state.modelAnswer === '' ? '' : state.modelAnswer === 'SPOT_FILL_V0_MODEL' ? 'RISK_PLAN_V0' : 'SIMPLE_UNCHECKED_FORMULA'} onChange={(event) => state.setModelAnswer(event.currentTarget.value === '' ? '' : event.currentTarget.value === 'RISK_PLAN_V0' ? 'SPOT_FILL_V0_MODEL' : 'EXCHANGE_QUOTE')}><option value="">SELECT MODEL</option><option value="RISK_PLAN_V0">RISK_PLAN_V0 → SPOT_FILL_V0</option><option value="SIMPLE_UNCHECKED_FORMULA">SIMPLE UNCHECKED FORMULA</option></select></label></div>;
}

function ActionToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`mission-toggle${active ? ' mission-toggle-on' : ''}`} aria-pressed={active} onClick={onClick}>{active ? '✓ ' : ''}{label}</button>;
}

function MissionDebrief({ receipt }: { receipt: MissionReceiptV0 }) {
  return <div className={`mission-debrief mission-debrief-${receipt.verdict.toLowerCase()}`}><header><h3>{receipt.verdict === 'PASS' ? 'MISSION PASSED' : 'MISSION FAILED · RETRY AVAILABLE'}</h3><span>{receipt.scenario.label} · {receipt.scenario.provenance}</span></header>{debriefForReceipt(receipt).map((section) => <section key={section.title}><h4>{section.title}</h4><dl>{section.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></section>)}</div>;
}
