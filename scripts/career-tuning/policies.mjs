/**
 * CAREER_TUNING_HARNESS_V0 — the six adversarial / control policies.
 *
 * Each policy is a pure decision function over a `view` of PRESENT AND PAST
 * facts only. No policy ever sees a future mark, a future fill, a different fee
 * schedule, better liquidity, or a different Career constant. The market and the
 * seed are identical across all six policies at a given scenario seed; only the
 * behaviour below differs.
 *
 * `decideSpot(rng, view) -> action | null` (null == WAIT).
 * `marginPlan(rng, view, episodeIndex) -> plan | null`.
 * `onTradeClosed(memo, summary)` — optional; updates policy memory from a real
 *   closed-trade fact (never from a UI intention).
 *
 * `view.trade` is a scratch object reset whenever a new position opens.
 * `view.memo` persists for the whole run.
 */

const FIXED_TICKET_WEI = 50_000_000_000_000_000n;

function pctBelow(priceX18, bps) {
  const clamped = BigInt(Math.max(1, Math.min(9_500, Math.trunc(bps))));
  return (priceX18 * (10_000n - clamped)) / 10_000n;
}

/** A protective stop strictly below the current price, never inverted. */
function safeStopBelow(view, bps) {
  const fromEntry = pctBelow(view.entryPriceX18 ?? view.currentPriceX18, bps);
  const fromMark = pctBelow(view.currentPriceX18, 20);
  return fromEntry < fromMark ? fromEntry : fromMark;
}

/* -------------------------------------------------------------------------- */
/* 1. DISCIPLINED — the behaviour Career is meant to favour                     */
/* -------------------------------------------------------------------------- */

const DISCIPLINED = {
  id: 'DISCIPLINED',
  version: 'v0',
  decideSpot(_rng, v) {
    if (!v.positionOpen) {
      if (v.has('RISK_PERCENT_SIZING') && v.has('CUSTOM_POSITION_SIZE')) {
        // A conservative account-risk budget between the shipped 1% and 2%
        // presets, with a real invalidation distance. This is disciplined, and
        // it still loses real money in a sustained adverse regime.
        return { kind: 'BUY_RISK_PLANNED', stopPriceX18: pctBelow(v.currentPriceX18, 200), riskBps: 120n };
      }
      return { kind: 'BUY_FIXED' };
    }
    // Guarantee the partial-exit process facts the ladder needs, early in a
    // trade, independent of PnL — exactly what the objective system nudges.
    if (v.has('PARTIAL_EXIT') && v.partialExitsUsed < 2 && !v.trade.partialDone
        && v.positionQtyAtoms > 1n && v.ticksInPosition >= 2) {
      v.trade.partialDone = true;
      return { kind: 'PARTIAL_CLOSE', percent: 25 };
    }
    if (v.hasActiveStop) {
      if (!v.trade.partialDone && v.has('PARTIAL_EXIT') && v.priceVsEntryFrac >= 0.012 && v.positionQtyAtoms > 1n) {
        v.trade.partialDone = true;
        return { kind: 'PARTIAL_CLOSE', percent: 25 };
      }
      if (v.ticksInPosition >= 25 || v.priceVsEntryFrac >= 0.03) return { kind: 'SELL_ALL' };
      return null; // hold; let the stop do its job. Never widen.
    }
    if (v.has('STOP_MARKET')) {
      if (v.priceVsEntryFrac <= -0.02) return { kind: 'SELL_ALL' }; // already past the stop zone: take the loss
      return { kind: 'PLACE_STOP', stopPriceX18: safeStopBelow(v, 150) };
    }
    // Pre-STOP_LOSS: manage risk by hand. A small manual loss cut is the
    // evidence STOP_LOSS qualification asks for.
    if (v.priceVsEntryFrac <= -0.02) return { kind: 'SELL_ALL' };
    if (v.priceVsEntryFrac >= 0.015 || v.ticksInPosition >= 20) return { kind: 'SELL_ALL' };
    return null;
  },
  marginPlan(_rng, _v, _episodeIndex) {
    return { marginFractionBps: 300, leverage: 2, useStop: true, entryStopBps: 200, close: 'EPISODE_END', widenOnAdverse: false };
  },
};

/* -------------------------------------------------------------------------- */
/* 2. ALL_IN — maximum legal exposure, no process optimisation                 */
/* -------------------------------------------------------------------------- */

const ALL_IN = {
  id: 'ALL_IN',
  version: 'v0',
  decideSpot(_rng, v) {
    if (!v.positionOpen) {
      if (v.has('RISK_PERCENT_SIZING') && v.has('CUSTOM_POSITION_SIZE')) {
        return { kind: 'BUY_RISK_PLANNED', stopPriceX18: pctBelow(v.currentPriceX18, 20), riskBps: 1000n };
      }
      return { kind: 'BUY_FIXED' };
    }
    if (v.has('SCALE_IN') && v.freeEthWei >= FIXED_TICKET_WEI) return { kind: 'SCALE_IN' }; // stack to the hilt
    if (v.priceVsEntryFrac >= 0.10) return { kind: 'SELL_ALL' };
    if (v.priceVsEntryFrac <= -0.18) return { kind: 'SELL_ALL' };
    if (v.ticksInPosition >= 60) return { kind: 'SELL_ALL' };
    return null;
  },
  marginPlan(_rng, _v, _episodeIndex) {
    return { marginFractionBps: 9_000, leverage: 2, useStop: false, entryStopBps: 200, close: 'EPISODE_END', widenOnAdverse: false };
  },
};

/* -------------------------------------------------------------------------- */
/* 3. OVERTRADER — maximum trade frequency, no process                         */
/* -------------------------------------------------------------------------- */

const OVERTRADER = {
  id: 'OVERTRADER',
  version: 'v0',
  decideSpot(_rng, v) {
    if (!v.positionOpen) return { kind: 'BUY_FIXED' };
    return { kind: 'SELL_ALL' }; // close on the very next tick, forever
  },
  marginPlan(_rng, _v, _episodeIndex) {
    return { marginFractionBps: 2_000, leverage: 2, useStop: false, entryStopBps: 200, close: 'IMMEDIATE_MANUAL', widenOnAdverse: false };
  },
};

/* -------------------------------------------------------------------------- */
/* 4. RANDOM — uniform choice over currently legal actions, seeded PRNG only    */
/* -------------------------------------------------------------------------- */

const RANDOM = {
  id: 'RANDOM',
  version: 'v0',
  decideSpot(rng, v) {
    const kind = rng.pick(v.legalKinds);
    if (kind === 'WAIT') return null;
    if (kind === 'PLACE_STOP') return { kind, stopPriceX18: pctBelow(v.currentPriceX18, rng.nextInt(10, 400)) };
    if (kind === 'BUY_RISK_PLANNED') {
      return { kind, stopPriceX18: pctBelow(v.currentPriceX18, rng.nextInt(10, 400)), riskBps: BigInt(rng.nextInt(10, 1000)) };
    }
    if (kind === 'PARTIAL_CLOSE') return { kind, percent: rng.pick([10, 25, 50, 75]) };
    return { kind };
  },
  marginPlan(rng, _v, _episodeIndex) {
    return {
      marginFractionBps: rng.nextInt(200, 6_000),
      leverage: rng.pick([1, 2]),
      useStop: rng.chance(0.5),
      entryStopBps: rng.nextInt(50, 800),
      close: rng.pick(['EPISODE_END', 'IMMEDIATE_MANUAL', 'MID_MANUAL']),
      widenOnAdverse: rng.chance(0.5),
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 5. STOP_WIDENER — uses a stop, then moves it away from price when threatened */
/* -------------------------------------------------------------------------- */

/**
 * Models the realistic pattern: a stop is placed at entry, and is nudged
 * further from price ONLY when the market comes close to hitting it ("give it a
 * bit more room"), then re-tightened once price recovers. An earlier, eager
 * "widen on any 0.5% adverse tick" variant was tested during hostile review; it
 * is more self-destructive than a real widener and is NOT the committed model.
 * See docs/CAREER_TUNING_HARNESS_V0.md.
 */
const STOP_WIDENER = {
  id: 'STOP_WIDENER',
  version: 'v0',
  decideSpot(_rng, v) {
    if (!v.positionOpen) {
      if (v.has('RISK_PERCENT_SIZING') && v.has('CUSTOM_POSITION_SIZE')) {
        return { kind: 'BUY_RISK_PLANNED', stopPriceX18: pctBelow(v.currentPriceX18, 200), riskBps: 100n };
      }
      return { kind: 'BUY_FIXED' };
    }
    if (!v.hasActiveStop && v.has('STOP_MARKET')) {
      return { kind: 'PLACE_STOP', stopPriceX18: safeStopBelow(v, 150) }; // initially DOES protect
    }
    if (v.hasActiveStop) {
      // Widen only when price is within ~0.3% above the active stop — i.e. the
      // stop is about to fill.
      const stopThreatened = v.activeStopPriceX18 !== null
        && v.currentPriceX18 <= (v.activeStopPriceX18 * 10_030n) / 10_000n;
      if (stopThreatened) {
        const widened = pctBelow(v.currentPriceX18, 300);
        if (widened < v.activeStopPriceX18) {
          v.trade.everWidened = true;
          return { kind: 'PLACE_STOP', stopPriceX18: widened };
        }
      }
      if (v.trade.everWidened && v.priceVsEntryFrac >= 0.01) {
        const tighter = pctBelow(v.currentPriceX18, 120);
        if (tighter > v.activeStopPriceX18 && tighter < v.currentPriceX18) {
          return { kind: 'PLACE_STOP', stopPriceX18: tighter }; // re-tighten: must NOT erase widen history
        }
      }
      if (!v.trade.partialDone && v.has('PARTIAL_EXIT') && v.partialExitsUsed < 2
          && v.positionQtyAtoms > 1n && v.ticksInPosition >= 2) {
        v.trade.partialDone = true;
        return { kind: 'PARTIAL_CLOSE', percent: 25 };
      }
      if (!v.trade.partialDone && v.has('PARTIAL_EXIT') && v.priceVsEntryFrac >= 0.015 && v.positionQtyAtoms > 1n) {
        v.trade.partialDone = true;
        return { kind: 'PARTIAL_CLOSE', percent: 25 };
      }
      if (v.ticksInPosition >= 30 || v.priceVsEntryFrac >= 0.03) return { kind: 'SELL_ALL' };
      return null;
    }
    if (v.priceVsEntryFrac <= -0.03 || v.priceVsEntryFrac >= 0.02 || v.ticksInPosition >= 20) return { kind: 'SELL_ALL' };
    return null;
  },
  marginPlan(_rng, _v, _episodeIndex) {
    return { marginFractionBps: 300, leverage: 2, useStop: true, entryStopBps: 200, close: 'MID_MANUAL', widenOnAdverse: true };
  },
};

/* -------------------------------------------------------------------------- */
/* 6. REVENGE — modest, then escalates account risk after a realised loss       */
/* -------------------------------------------------------------------------- */

/**
 * The textbook revenge pattern: after each consecutive realised loss the trader
 * "sizes up to win it back" — it raises the ACCOUNT-RISK BUDGET of the *next*
 * fresh risk plan (+120 bps per consecutive loss, capped at the shipped 1000
 * bps ceiling), and resets to baseline after a winning trade. It still places a
 * proper protective stop and never grows a position past a frozen plan's
 * budget.
 *
 * An "averaging down in anger" variant — scaling into an open position past its
 * frozen budget — was tested during hostile review; the shipped simulator's
 * frozen-budget breach detector DOES catch that, producing RISK_BUDGET_VIOLATED.
 * It does NOT catch choosing a larger budget up front. See
 * docs/CAREER_TUNING_HARNESS_V0.md.
 */
const REVENGE = {
  id: 'REVENGE',
  version: 'v0',
  decideSpot(_rng, v) {
    const escalation = v.memo.escalation ?? 0;
    if (!v.positionOpen) {
      const riskBps = Math.min(1_000, 60 + 120 * escalation);
      if (v.has('RISK_PERCENT_SIZING') && v.has('CUSTOM_POSITION_SIZE')) {
        return { kind: 'BUY_RISK_PLANNED', stopPriceX18: pctBelow(v.currentPriceX18, 200), riskBps: BigInt(riskBps) };
      }
      return { kind: 'BUY_FIXED' };
    }
    if (!v.hasActiveStop && v.has('STOP_MARKET')) {
      return { kind: 'PLACE_STOP', stopPriceX18: safeStopBelow(v, 200) };
    }
    if (!v.trade.partialDone && v.has('PARTIAL_EXIT') && v.partialExitsUsed < 2
        && v.positionQtyAtoms > 1n && v.ticksInPosition >= 2) {
      v.trade.partialDone = true;
      return { kind: 'PARTIAL_CLOSE', percent: 25 };
    }
    if (!v.trade.partialDone && v.has('PARTIAL_EXIT') && v.priceVsEntryFrac >= 0.012 && v.positionQtyAtoms > 1n) {
      v.trade.partialDone = true;
      return { kind: 'PARTIAL_CLOSE', percent: 25 };
    }
    if (v.hasActiveStop) {
      if (v.ticksInPosition >= 25 || v.priceVsEntryFrac >= 0.03) return { kind: 'SELL_ALL' };
      return null;
    }
    if (v.priceVsEntryFrac <= -0.02 || v.priceVsEntryFrac >= 0.015 || v.ticksInPosition >= 20) return { kind: 'SELL_ALL' };
    return null;
  },
  onTradeClosed(memo, summary) {
    if (summary.realizedPnlWei < 0n) memo.escalation = Math.min((memo.escalation ?? 0) + 1, 6);
    else memo.escalation = 0; // reset after a winning trade
  },
  marginPlan(_rng, v, _episodeIndex) {
    const escalation = v.memo.escalation ?? 0;
    return {
      marginFractionBps: Math.min(9_000, 300 + 300 * escalation),
      leverage: 2,
      useStop: true,
      entryStopBps: 200,
      close: 'EPISODE_END',
      widenOnAdverse: false,
    };
  },
};

export const POLICIES = Object.freeze([DISCIPLINED, ALL_IN, OVERTRADER, RANDOM, STOP_WIDENER, REVENGE]);
export const POLICY_BY_ID = Object.freeze(Object.fromEntries(POLICIES.map((policy) => [policy.id, policy])));
