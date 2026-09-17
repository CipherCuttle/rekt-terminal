import * as base from './challenge.mjs';
import {digestRecord} from './index.mjs';
import {assertSafeInt, assertString, canonicalIds, deepClone, deepFreeze, invariant, isObject} from './challenge-hardening-util.mjs';

export function transitionChallenge(challenge, to, context = {}) {
  const contract = challenge?.contract;

  if (to === 'NOT_ACTIVATED' || to === 'BUILDING') {
    assertSafeInt(context.activeSeatCount, 'activeSeatCount', {min: 0});
    invariant(context.activeSeatCount <= contract.slot_limit, 'activeSeatCount exceeds slot_limit');
  }

  if (to === 'FINAL_QUALIFIERS') {
    const finalQualifierIds = canonicalIds(context.finalQualifierIds, 'final qualifier ids');
    const transitioned = base.transitionChallenge(challenge, to, context);
    return deepFreeze({...deepClone(transitioned), final_qualifier_ids: finalQualifierIds});
  }

  if (to === 'SELECTION') {
    const finalQualifierIds = canonicalIds(challenge.final_qualifier_ids ?? [], 'challenge.final_qualifier_ids');
    invariant(finalQualifierIds.length > 0, 'selection requires at least one final qualifier');
    return base.transitionChallenge(challenge, to, {...context, finalQualifierIds});
  }

  if (to === 'SETTLEMENT_PENDING') {
    const nextContext = {...context};
    let selectedEntryId = null;

    if (challenge.status === 'FINAL_QUALIFIERS') {
      const finalQualifierIds = canonicalIds(challenge.final_qualifier_ids ?? [], 'challenge.final_qualifier_ids');
      invariant(finalQualifierIds.length === 0, 'direct settlement from FINAL_QUALIFIERS is only for zero qualifiers');
      nextContext.finalQualifierIds = finalQualifierIds;
    }

    if (challenge.status === 'SELECTION') {
      assertSafeInt(context.now, 'now', {min: 0});
      invariant(context.now < contract.review_deadline, 'organizer selection deadline elapsed');
      const finalQualifierIds = canonicalIds(challenge.final_qualifier_ids ?? [], 'challenge.final_qualifier_ids');
      selectedEntryId = context.selectedEntryId;
      assertString(selectedEntryId, 'selectedEntryId');
      base.validateSelection(selectedEntryId, finalQualifierIds);
      nextContext.finalQualifierIds = finalQualifierIds;
    }

    if (challenge.status === 'DEFAULT_RESOLUTION') {
      nextContext.finalQualifierIds = canonicalIds(challenge.final_qualifier_ids ?? [], 'challenge.final_qualifier_ids');
    }

    const transitioned = base.transitionChallenge(challenge, to, nextContext);
    const patch = {authorized_settlement_intent: deepClone(context.settlementIntent)};
    if (selectedEntryId) patch.selected_entry_id = selectedEntryId;
    return deepFreeze({...deepClone(transitioned), ...patch});
  }

  if (to === 'SETTLED') {
    invariant(isObject(challenge.authorized_settlement_intent), 'authorized settlement intent missing');
    base.assertSettlementIntentMatchesContract(contract, challenge.authorized_settlement_intent);

    if (context.settlementIntent) {
      base.assertSettlementIntentMatchesContract(contract, context.settlementIntent);
      invariant(
        digestRecord(context.settlementIntent) === digestRecord(challenge.authorized_settlement_intent),
        'finalization intent differs from stored authorization',
      );
    }

    const executionFact = base.applyFinalizedSettlementFact(
      challenge.authorized_settlement_intent,
      context.executionFact,
      challenge.settlement_execution_fact ?? null,
    );

    const transitioned = base.transitionChallenge(challenge, to, {
      ...context,
      settlementIntent: challenge.authorized_settlement_intent,
      existingExecutionFact: challenge.settlement_execution_fact ?? null,
    });

    return deepFreeze({...deepClone(transitioned), settlement_execution_fact: deepClone(executionFact)});
  }

  if (to === 'RECEIPT_FILED') {
    base.assertReceiptMatchesContract(contract, context.receipt);
    invariant(isObject(challenge.authorized_settlement_intent), 'authorized settlement intent missing');
    invariant(isObject(challenge.settlement_execution_fact), 'settlement execution fact missing');
    invariant(
      digestRecord(context.receipt.settlement_intent) === digestRecord(challenge.authorized_settlement_intent),
      'receipt settlement intent differs from stored authorization',
    );
    invariant(
      digestRecord(context.receipt.settlement_execution_fact) === digestRecord(challenge.settlement_execution_fact),
      'receipt execution fact differs from stored settlement fact',
    );
    const transitioned = base.transitionChallenge(challenge, to, context);
    return deepFreeze({...deepClone(transitioned), receipt_id: context.receipt.receipt_id});
  }

  return base.transitionChallenge(challenge, to, context);
}
