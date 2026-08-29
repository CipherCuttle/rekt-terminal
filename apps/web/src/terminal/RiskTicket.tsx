import { useState } from 'react';
import {
  DEFAULT_SPOT_FILL_CONFIG,
  RISK_PLAN_MAX_RISK_BPS,
  RISK_PLAN_PRESET_BPS,
  bps,
  mulDiv,
  planRiskSizedEntry,
  priceX18,
  projectPlannedRisk,
  wei,
  type MarketObservation,
  type RiskPlanResult,
  type SimState,
} from '@rekt-ink/sim';
import { formatBpsPercent, formatEth, formatPriceEth, formatSignedEth } from '../practice/format';
import { priceX18FromDecimalString } from '../practice/quote';
import type { PracticeIntent } from '../practice/store';

/**
 * The risk block.
 *
 * The layout is the lesson. Read top to bottom it is exactly the causal order
 * the phase teaches:
 *
 *   STOP -> ACCOUNT RISK -> MAX LOSS -> POSITION SIZE
 *
 * Size is an output. Nothing here lets the player pick a size and have the
 * stop moved to justify it.
 *
 * All arithmetic is `@rekt-ink/sim`'s. This component holds two inputs — a stop
 * price string and a risk percentage — and renders what the domain returns for
 * them. It computes no money. The preview is display only; when the player
 * commits, the store recomputes the plan from simulator state and never trusts
 * a number that passed through React.
 */

/** Presets from the domain, plus the custom escape hatch. */
const PRESETS = RISK_PLAN_PRESET_BPS;

/** Human reasons for the calculator's fail-closed codes. */
const PLAN_REASON: Record<string, string> = {
  STOP_NOT_BELOW_ENTRY: 'A long stop must sit below the current price.',
  STOP_DISTANCE_TOO_SMALL: 'The stop is too close to price to size against.',
  RISK_BUDGET_ZERO: 'Select an account risk above 0%.',
  RISK_BUDGET_ABOVE_MAX: `Account risk above ${formatBpsPercent(RISK_PLAN_MAX_RISK_BPS)} is not authorized.`,
  SIZE_BELOW_MINIMUM: 'No executable size fits this budget at current depth and free ETH.',
  INSUFFICIENT_CAPITAL: 'No free ETH is available to fund an entry.',
  MISSING_LIQUIDITY: 'Usable depth cannot be derived for this pair.',
  INVALID_PRICE: 'Enter a valid stop price.',
  INVALID_EQUITY: 'Account equity cannot support a risk budget.',
  MODEL_INPUT_UNAVAILABLE: 'Market evidence for this pair is incomplete.',
};

export interface RiskTicketProps {
  sim: SimState;
  /** Non-null when the market gate is closed; every control is disabled. */
  blockedReason: string | null;
  observation: MarketObservation | null;
  observationTimeMs: number;
  onSubmit: (intent: PracticeIntent) => void;
}

/** Parse a percentage string into bps without floating-point money math. */
function riskBpsFromPercent(value: string): bigint | null {
  const match = /^\s*(\d{1,3})(?:\.(\d{1,2}))?\s*%?\s*$/.exec(value);
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  const scaled = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  return scaled > 0n ? scaled : null;
}

export function RiskTicket({ sim, blockedReason, observation, observationTimeMs, onSubmit }: RiskTicketProps) {
  const [stopInput, setStopInput] = useState('');
  const [riskBps, setRiskBps] = useState<bigint>(PRESETS[1]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  // A CUSTOM field that does not parse must not leave the previous percentage
  // silently armed behind an empty box.
  const customValid = !customOpen || riskBpsFromPercent(customInput) !== null;

  const marketBlocked = blockedReason !== null;
  const stopPriceX18 = priceX18FromDecimalString(stopInput);

  const plan: RiskPlanResult | null =
    observation === null || stopPriceX18 === null
      ? null
      : planRiskSizedEntry({
          planId: 'preview',
          instrumentId: observation.instrumentId,
          quoteAsset: observation.quoteAsset,
          equityAtPlanWei: sim.account.equityWei,
          availableCapitalWei: sim.account.freeEthWei,
          intendedEntryPriceX18: priceX18(observation.referencePriceX18),
          stopPriceX18,
          riskBps: bps(riskBps),
          usableQuoteLiquidityWei: wei(observation.usableQuoteLiquidityWei),
          createdAtMs: observationTimeMs,
          observationId: observation.observationId,
          sourceId: observation.sourceId,
          config: DEFAULT_SPOT_FILL_CONFIG,
        });

  // The domain's own rounding, not the component's: this is the same floor
  // division `planRiskSizedEntry` applies, so the figure on screen is the
  // figure the plan is built from.
  const budgetWei = wei(mulDiv(sim.account.equityWei, riskBps, 10_000n, 'floor'));
  const ready = plan !== null && plan.ok && !marketBlocked && customValid;

  return (
    <section className="risk-ticket" aria-label="Risk plan">
      <div className="risk-head">
        <span>RISK PLAN</span>
        <span className="risk-skill">RISK_SIZING</span>
      </div>

      <label className="risk-field">
        <span className="risk-label">STOP</span>
        <input
          inputMode="decimal"
          className="risk-input num"
          value={stopInput}
          placeholder="invalidation price"
          onChange={(event) => setStopInput(event.target.value)}
          aria-label="Stop price"
        />
      </label>

      <div className="risk-field">
        <span className="risk-label">ACCOUNT RISK</span>
        <div className="risk-presets" role="group" aria-label="Account risk">
          {PRESETS.map((preset) => (
            <button
              key={String(preset)}
              type="button"
              className={`risk-preset${riskBps === preset && !customOpen ? ' risk-preset-on' : ''}`}
              aria-pressed={riskBps === preset && !customOpen}
              onClick={() => {
                setRiskBps(preset);
                setCustomOpen(false);
              }}
            >
              {formatBpsPercent(preset)}
            </button>
          ))}
          <button
            type="button"
            className={`risk-preset${customOpen ? ' risk-preset-on' : ''}`}
            aria-pressed={customOpen}
            onClick={() => setCustomOpen((open) => !open)}
          >
            CUSTOM
          </button>
        </div>
      </div>

      {customOpen && (
        <label className="risk-field">
          <span className="risk-label">CUSTOM %</span>
          <input
            inputMode="decimal"
            className="risk-input num"
            value={customInput}
            placeholder="1.50"
            onChange={(event) => {
              setCustomInput(event.target.value);
              const parsed = riskBpsFromPercent(event.target.value);
              // An unparseable or out-of-range entry is left visible and
              // refused rather than snapped to a nearby legal value.
              if (parsed !== null) setRiskBps(parsed);
            }}
            aria-label="Custom account risk percent"
          />
        </label>
      )}

      <dl className="risk-figures">
        <div className="risk-figure">
          <dt>MAX LOSS</dt>
          <dd className="num">
            {/* Only shown for a budget the domain accepted. A rejected risk
                percentage must not render a figure that looks authoritative. */}
            {plan?.ok && customValid ? formatEth(budgetWei, 4) : '—'}
            <span className="figure-unit">ETH</span>
          </dd>
        </div>
        <div className="risk-figure">
          <dt>POSITION SIZE</dt>
          <dd className="num">
            {plan?.ok && customValid ? formatEth(plan.plan.plannedNotionalWei, 4) : '—'}
            <span className="figure-unit">ETH</span>
          </dd>
        </div>
      </dl>

      {plan?.ok && customValid && (
        <p className="risk-note">
          IF STOP FILLS AT TRIGGER · {formatSignedEth(wei(-plan.plan.projectedLossWei), 4)} ETH EST · DERIVED / RISK_PLAN_V0
          <br />
          {/* SIM_CONTRACT_V0 §10: a stop is an instruction, not a guaranteed
              fill. Saying so where the number is read, not in a modal. */}
          A STOP IS AN INSTRUCTION · A GAP FILLS WORSE THAN THIS
        </p>
      )}
      {plan !== null && !plan.ok && (
        // Invalid plans state the refusal instead of silently coercing an input
        // into something that would compute.
        <p className="risk-reason" role="status">
          {plan.code} · {PLAN_REASON[plan.code] ?? 'This plan cannot be sized.'}
        </p>
      )}
      {plan === null && <p className="risk-reason">Enter an invalidation price to size the trade.</p>}
      {customOpen && !customValid && (
        <p className="risk-reason" role="status">
          CUSTOM_RISK_INVALID · Enter an account risk between 0.01% and {formatBpsPercent(RISK_PLAN_MAX_RISK_BPS)}.
        </p>
      )}

      <button
        type="button"
        className="action action-buy risk-action"
        disabled={!ready}
        onClick={() => {
          if (!plan?.ok || stopPriceX18 === null || !customValid) return;
          onSubmit({ kind: 'BUY_RISK_PLANNED', stopPriceX18, riskBps });
          setStopInput('');
        }}
      >
        <span className="action-verb">BUY</span>
        <span className="action-size">
          {plan?.ok && customValid ? `${formatEth(plan.plan.plannedNotionalWei, 4)} ETH · RISK ${formatBpsPercent(riskBps)}` : 'SIZED BY RISK PLAN'}
        </span>
      </button>
      {marketBlocked && <p className="action-reason">{blockedReason}</p>}
    </section>
  );
}

/**
 * Live risk readout for an open, risk-planned position.
 *
 * Recomputed from simulator state on every render, so it moves correctly when
 * the stop is tightened or widened, when the position is scaled into, and when
 * it is partially exited — without ever changing the frozen plan.
 */
export function RiskExposure({
  sim,
  observation,
  observationTimeMs,
}: {
  sim: SimState;
  observation: MarketObservation | null;
  observationTimeMs: number;
}) {
  if (!sim.activeRiskPlan || !sim.position || observation === null) return null;
  const projection = projectPlannedRisk(sim, observation, observationTimeMs, DEFAULT_SPOT_FILL_CONFIG);
  const plan = sim.activeRiskPlan;

  const over = projection.status === 'OVER_BUDGET' || projection.breached;
  return (
    <section className={`risk-exposure${over ? ' risk-exposure-over' : ''}`} aria-label="Planned risk">
      <div className="risk-head">
        <span>PLANNED RISK</span>
        <span className="risk-skill">{formatBpsPercent(plan.maxLossBpsOfEquity)} OF EQUITY</span>
      </div>
      <dl className="risk-figures">
        <div className="risk-figure">
          <dt>BUDGET</dt>
          <dd className="num">
            {formatEth(plan.maxLossWei, 4)}
            <span className="figure-unit">ETH</span>
          </dd>
        </div>
        <div className="risk-figure">
          <dt>IF STOP FILLS</dt>
          <dd className={`num${over ? ' num-loss' : ''}`}>
            {projection.status === 'WITHIN_BUDGET' || projection.status === 'OVER_BUDGET'
              ? formatSignedEth(wei(-projection.projectedLossWei), 4)
              : '—'}
            <span className="figure-unit">ETH</span>
          </dd>
        </div>
      </dl>
      <p className="risk-note">
        PLAN STOP {formatPriceEth(plan.stopPriceX18)} ETH ·{' '}
        {projection.status === 'UNPROTECTED'
          ? 'NO ACTIVE STOP · LOSS IS UNBOUNDED'
          : projection.status === 'UNAVAILABLE'
            ? 'PROJECTION UNAVAILABLE ON CURRENT EVIDENCE'
            : `EST · DERIVED / RISK_PLAN_V0${projection.breached ? ' · BUDGET BREACHED THIS TRADE' : ''}`}
        {/* The model would refuse an exit this large at this depth, so the
            figure above is a floor on the cost of unwinding, not the cost. */}
        {!projection.exitExecutable && (
          <>
            <br />
            POSITION EXCEEDS MODELLED EXIT DEPTH · REAL COST IS WORSE
          </>
        )}
        {projection.unverified && (
          <>
            <br />
            EXPOSURE UNVERIFIED THIS TRADE · COMPLIANCE NOT CLAIMED
          </>
        )}
      </p>
    </section>
  );
}
