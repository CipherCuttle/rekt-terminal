/**
 * CAREER_TUNING_HARNESS_V0 — margin episode driver.
 *
 * Runs the *real* shipped `replayMarginActions` over the *real* frozen
 * historical training episodes (`MARGIN_TRAINING_EPISODES`) and derives the
 * completion fact with the *real* shipped `deriveLongMarginCompletion`. The
 * harness never hand-authors a successful episode completion — it only chooses
 * the action stream a policy would take and lets the shipped code decide the
 * outcome.
 */
import {
  careerEthToMarginUsdMicros,
  deriveLongMarginCompletion,
  replayMarginActions,
} from '@rekt-ink/sim';

/**
 * Translate a policy margin plan into a `MarginReplayAction[]` and run it.
 *
 * plan = {
 *   marginFractionBps,   // isolated margin as bps of synthetic collateral
 *   leverage,            // 1 | 2
 *   useStop,             // place an entry-time protective stop
 *   entryStopBps,        // stop distance below entry mark, in bps
 *   close,               // 'EPISODE_END' | 'IMMEDIATE_MANUAL' | 'MID_MANUAL'
 *   widenOnAdverse,      // replace the stop further from price after the first advance
 * }
 */
export function runMarginEpisode({ sessionId, equityWei, episode, plan }) {
  const collateral = careerEthToMarginUsdMicros(equityWei, episode.startEthUsdPriceMicros);
  const mark0 = episode.marks[0].priceUsdMicros;
  const marginUsdMicros = (collateral * BigInt(Math.max(1, Math.trunc(plan.marginFractionBps)))) / 10_000n;
  const leverage = plan.leverage === 1 ? 1 : 2;
  const entryStopBps = BigInt(Math.max(1, Math.trunc(plan.entryStopBps ?? 200)));
  const stopPriceUsdMicros = plan.useStop
    ? (mark0 * (10_000n - entryStopBps)) / 10_000n
    : undefined;

  const actions = [];
  let n = 0;
  const id = () => `${episode.episodeId}:a${n++}`;
  actions.push({ type: 'OPEN_LONG', actionId: id(), marginUsdMicros, leverage, stopPriceUsdMicros });

  const advancesToEnd = episode.marks.length - 1;
  if (plan.close === 'IMMEDIATE_MANUAL') {
    actions.push({ type: 'CLOSE', actionId: id() });
  } else if (plan.close === 'MID_MANUAL') {
    actions.push({ type: 'ADVANCE', actionId: id() });
    if (plan.widenOnAdverse && plan.useStop) {
      actions.push({ type: 'PLACE_STOP', actionId: id(), stopPriceUsdMicros: (mark0 * (10_000n - entryStopBps * 3n)) / 10_000n });
    }
    actions.push({ type: 'CLOSE', actionId: id() });
  } else {
    // EPISODE_END: advance to the terminal historical mark; the engine
    // auto-closes the position with closeReason EPISODE_END on the last advance.
    for (let i = 0; i < advancesToEnd; i += 1) {
      actions.push({ type: 'ADVANCE', actionId: id() });
      if (i === 0 && plan.widenOnAdverse && plan.useStop) {
        actions.push({ type: 'PLACE_STOP', actionId: id(), stopPriceUsdMicros: (mark0 * (10_000n - entryStopBps * 3n)) / 10_000n });
      }
    }
  }

  const state = replayMarginActions({ sessionId, careerEquityWei: equityWei, episode, actions });
  const completion = deriveLongMarginCompletion(state, episode);
  return {
    state,
    completion,
    outcome: {
      closed: state.closed,
      liquidated: state.liquidated,
      closeReason: state.lastTrade ? state.lastTrade.closeReason : null,
      opened: state.events.some((event) => event.type === 'MARGIN_POSITION_OPENED'),
      protectiveStopUsed: completion ? completion.protectiveStopUsed : false,
      plannedMaxAccountRiskBps: completion && completion.plannedMaxAccountRiskBps !== null
        ? completion.plannedMaxAccountRiskBps.toString()
        : null,
    },
  };
}
