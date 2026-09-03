import type { MissionReceiptV0 } from './types.js';

export interface DebriefFact {
  readonly label: string;
  readonly value: string;
}

export interface DebriefSection {
  readonly title: 'WHAT THE SCENARIO DID' | 'WHAT YOU DID' | 'WHY THIS MISSION PASSED' | 'WHY THIS MISSION FAILED';
  readonly facts: readonly DebriefFact[];
}

export function debriefForReceipt(receipt: MissionReceiptV0): readonly DebriefSection[] {
  const why = receipt.verdict === 'PASS' ? 'WHY THIS MISSION PASSED' : 'WHY THIS MISSION FAILED';
  if (receipt.missionId === 'MD-01') {
    const facts = receipt.relevantFacts as Extract<typeof receipt.relevantFacts, { kind: 'MD-01' }>;
    return [
      { title: 'WHAT THE SCENARIO DID', facts: facts.items.map((item) => ({ label: item.itemId, value: `${item.expected} · published by ${item.publishedBy}` })) },
      { title: 'WHAT YOU DID', facts: [{ label: 'FRESHNESS ANSWER', value: receipt.learnerInput.kind === 'MD-01' ? receipt.learnerInput.freshnessAnswer : '—' }] },
      { title: why, facts: [{ label: 'REASON CODES', value: receipt.reasonCodes.join(' · ') }, { label: 'PROVENANCE RULE', value: 'The UI cannot invent a stronger evidence path.' }] },
    ];
  }
  if (receipt.missionId === 'EX-01') {
    const facts = receipt.relevantFacts as Extract<typeof receipt.relevantFacts, { kind: 'EX-01' }>;
    return [
      { title: 'WHAT THE SCENARIO DID', facts: [{ label: 'MARK', value: facts.markPriceX18 }, { label: 'ENTRY FILL', value: facts.entryFillPriceX18 }, { label: 'EXIT FILL', value: facts.exitFillPriceX18 }, { label: 'IMPACT', value: `IN ${facts.entryImpactBps} BPS · OUT ${facts.exitImpactBps} BPS` }, { label: 'FEES', value: `IN ${facts.entryFeeWei} · OUT ${facts.exitFeeWei}` }, { label: 'REALIZED RESULT', value: facts.realizedPnlWei }] },
      { title: 'WHAT YOU DID', facts: [{ label: 'ENTRY', value: facts.entryAccepted ? 'ACCEPTED BY SIMULATOR' : 'NOT ACCEPTED' }, { label: 'EXIT', value: facts.exitAccepted ? 'ACCEPTED BY SIMULATOR' : 'NOT ACCEPTED' }] },
      { title: why, facts: [{ label: 'REASON CODES', value: receipt.reasonCodes.join(' · ') }, { label: 'MODEL', value: 'SPOT_FILL_V0 · SYNTHETIC TRAINING SIMULATION' }] },
    ];
  }
  if (receipt.missionId === 'LQ-01') {
    const facts = receipt.relevantFacts as Extract<typeof receipt.relevantFacts, { kind: 'LQ-01' }>;
    return [
      { title: 'WHAT THE SCENARIO DID', facts: [{ label: 'DEEP', value: `${facts.deep.requestedQuoteWei} REQUESTED · ${facts.deep.liquidityWei} LIQUIDITY · ${facts.deep.participationBps} BPS · ${facts.deep.modeledImpactBps ?? 'REJECTED'} IMPACT` }, { label: 'THIN', value: `${facts.thin.requestedQuoteWei} REQUESTED · ${facts.thin.liquidityWei} LIQUIDITY · ${facts.thin.participationBps} BPS · ${facts.thin.rejectionCode ?? 'ACCEPTED'}` }] },
      { title: 'WHAT YOU DID', facts: [{ label: 'DECISION', value: receipt.learnerInput.kind === 'LQ-01' ? `DEEP ${receipt.learnerInput.deepDecision} · THIN ${receipt.learnerInput.thinDecision}` : '—' }] },
      { title: why, facts: [{ label: 'REASON CODES', value: receipt.reasonCodes.join(' · ') }, { label: 'IMPACT LABEL', value: 'MODEL_SPECIFIC / SPOT_FILL_V0' }] },
    ];
  }
  if (receipt.missionId === 'ST-01') {
    const facts = receipt.relevantFacts as Extract<typeof receipt.relevantFacts, { kind: 'ST-01' }>;
    return [
      { title: 'WHAT THE SCENARIO DID', facts: [{ label: 'PLAN', value: facts.planPriceX18 }, { label: 'TRIGGER', value: facts.triggerPriceX18 }, { label: 'ACTUAL FILL', value: facts.actualFillPriceX18 }, { label: 'IMPACT / FEES', value: `${facts.impactBps} BPS / ${facts.feesWei}` }, { label: 'RESULT', value: facts.realizedPnlWei }] },
      { title: 'WHAT YOU DID', facts: [{ label: 'PROCESS', value: receipt.learnerInput.kind === 'ST-01' ? `${facts.entryAccepted ? 'ENTRY ACCEPTED' : 'ENTRY NOT ACCEPTED'} · ${facts.stopPlacementAccepted ? 'STOP ACCEPTED' : 'STOP NOT ACCEPTED'} · ${facts.stopTriggered ? 'TRIGGERED' : 'NOT TRIGGERED'} · ${facts.exitCompleted ? 'EXIT COMPLETED' : 'EXIT NOT COMPLETED'} · ${facts.stopWidened ? 'WIDENED' : 'NOT WIDENED'} · ${receipt.learnerInput.allowedWidening} · ${receipt.learnerInput.allowedExit}` : '—' }] },
      { title: why, facts: [{ label: 'REASON CODES', value: receipt.reasonCodes.join(' · ') }, { label: 'LESSON', value: 'A stop is an instruction, not a guaranteed fill.' }] },
    ];
  }
  const facts = receipt.relevantFacts as Extract<typeof receipt.relevantFacts, { kind: 'RS-01' }>;
  return [
    { title: 'WHAT THE SCENARIO DID', facts: [{ label: 'ACCOUNT EQUITY', value: facts.narrowStop.equityAtPlanWei }, { label: 'RISK BUDGET', value: facts.narrowStop.riskBudgetWei }, { label: 'STOP / INVALIDATION', value: facts.narrowStop.stopPriceX18 }, { label: 'POSITION SIZE', value: facts.narrowStop.positionSizeAtoms }, { label: 'PROJECTED STOP LOSS', value: facts.narrowStop.projectedStopLossWei }, { label: 'WIDER STOP SIZE', value: facts.widerStop.positionSizeAtoms }] },
    { title: 'WHAT YOU DID', facts: [{ label: 'SELECTED SIZE', value: receipt.learnerInput.kind === 'RS-01' ? receipt.learnerInput.selectedPositionSizeAtoms : '—' }, { label: 'PROCESS RESULT', value: 'P&L is shown only as a consequence, never as the grade.' }] },
    { title: why, facts: [{ label: 'REASON CODES', value: receipt.reasonCodes.join(' · ') }, { label: 'MODEL', value: 'RISK_PLAN_V0 → SPOT_FILL_V0' }] },
  ];
}
