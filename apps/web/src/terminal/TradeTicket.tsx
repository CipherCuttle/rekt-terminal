import { useState } from 'react';
import { DEFAULT_FIRST_TICKET_WEI, DEFAULT_SPOT_FILL_CONFIG, feeForQuote, wei, priceX18, estimateStopLossWei, type MarketObservation, type SimState } from '@rekt-ink/sim';
import type { CareerState } from '@rekt-ink/career';
import { formatEth, formatPriceEth, formatSignedEth } from '../practice/format';
import type { PracticeIntent } from '../practice/store';
import { priceX18FromNumber } from '../practice/quote';

const TICKET_LABEL = formatEth(DEFAULT_FIRST_TICKET_WEI, 2);
/** Conservative affordability gate: notional plus the model's entry fee. */
const TICKET_COST_WEI = wei(DEFAULT_FIRST_TICKET_WEI + feeForQuote(DEFAULT_FIRST_TICKET_WEI, DEFAULT_SPOT_FILL_CONFIG.feeBps, 'ceil'));

const PARTIAL_STEPS = [25, 50, 75] as const;

export interface TradeTicketProps {
  sim: SimState;
  career: CareerState;
  /** Non-null when the market gate is closed; every control is disabled. */
  blockedReason: string | null;
  onSubmit: (intent: PracticeIntent) => void;
  observation?: MarketObservation | null;
  observationTimeMs?: number;
}

/**
 * The trade ticket.
 *
 * Exactly one action is dominant at any time — BUY when flat, SELL ALL when a
 * position is open. Scale and partial-exit controls only exist once Career has
 * actually unlocked the corresponding capability; there are no placeholder
 * buttons that do nothing.
 */
export function TradeTicket({ sim, career, blockedReason, onSubmit, observation = null, observationTimeMs = 0 }: TradeTicketProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const position = sim.position;
  const scaleUnlocked = career.unlockedSkills.includes('SCALE_CONTROL');
  const canScaleIn = career.unlockedCapabilities.includes('SCALE_IN');
  const canPartialExit = career.unlockedCapabilities.includes('PARTIAL_EXIT');
  const stopUnlocked = career.unlockedCapabilities.includes('STOP_MARKET');
  const [stopPrice, setStopPrice] = useState('');

  const marketBlocked = blockedReason !== null;
  const affordable = sim.account.freeEthWei >= TICKET_COST_WEI;
  const buyDisabled = marketBlocked || !affordable;
  const buyReason = marketBlocked ? blockedReason : affordable ? null : `Needs ${formatEth(TICKET_COST_WEI, 4)} ETH free including fee.`;

  return (
    <section className="panel ticket-panel" aria-label="Trade ticket">
      <header className="panel-head">
        <h2>ACTION</h2>
        <span className="panel-note">PRACTICE · NO REAL EXECUTION</span>
      </header>

      {!position ? (
        <div className="ticket-body">
          <button type="button" className="action action-buy" disabled={buyDisabled} onClick={() => onSubmit({ kind: 'BUY_FIXED' })}>
            <span className="action-verb">BUY</span>
            <span className="action-size">{TICKET_LABEL} ETH</span>
          </button>
          {buyReason && <p className="action-reason">{buyReason}</p>}
          {scaleUnlocked && <button type="button" className="manage-action" disabled={marketBlocked} onClick={() => onSubmit({ kind: 'PROTECT_CAPITAL' })}>PRACTICE PROTECT_CAPITAL</button>}
        </div>
      ) : (
        <div className="ticket-body">
          <button type="button" className="action action-sell" disabled={marketBlocked} onClick={() => onSubmit({ kind: 'SELL_ALL' })}>
            <span className="action-verb">SELL ALL</span>
            <span className="action-size">CLOSE POSITION</span>
          </button>
          {marketBlocked && <p className="action-reason">{blockedReason}</p>}

          {scaleUnlocked && (
            <>
              <button
                type="button"
                className="manage-toggle"
                aria-expanded={manageOpen}
                aria-controls="manage-controls"
                onClick={() => setManageOpen((open) => !open)}
              >
                MANAGE <span className="manage-skill">SCALE_CONTROL</span>
              </button>

              {/* Rendered conditionally rather than hidden: visibility of a
                  trading control must not depend on a stylesheet loading. */}
              {manageOpen && (
              <div id="manage-controls" className="manage-sheet manage-sheet-open">
                <div className="manage-head">
                  <span>MANAGE POSITION</span>
                  <button type="button" className="manage-close" onClick={() => setManageOpen(false)} aria-label="Close manage controls">
                    ×
                  </button>
                </div>

                {canScaleIn && (
                  <button
                    type="button"
                    className="manage-action"
                    disabled={marketBlocked || sim.account.freeEthWei < TICKET_COST_WEI}
                    onClick={() => onSubmit({ kind: 'SCALE_IN' })}
                  >
                    SCALE IN <span className="manage-size">+{TICKET_LABEL} ETH</span>
                  </button>
                )}

                {canPartialExit && (
                  <div className="manage-row" role="group" aria-label="Partial close">
                    {PARTIAL_STEPS.map((percent) => (
                      <button
                        key={percent}
                        type="button"
                        className="manage-action manage-action-partial"
                        disabled={marketBlocked}
                        onClick={() => onSubmit({ kind: 'PARTIAL_CLOSE', percent })}
                      >
                        SELL {percent}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )}
            </>
          )}
          {stopUnlocked && (
            <div className="stop-ticket" aria-label="Protective stop ticket">
              <label>STOP MARKET <input inputMode="decimal" value={stopPrice} placeholder={sim.activeStop ? formatPriceEth(priceX18(sim.activeStop.stopPriceX18)) : 'trigger price'} onChange={(event) => setStopPrice(event.target.value)} /></label>
              <button type="button" className="manage-action" disabled={marketBlocked || !priceX18FromNumber(Number(stopPrice))} onClick={() => { const value = priceX18FromNumber(Number(stopPrice)); if (value) { onSubmit({ kind: 'PLACE_STOP', stopPriceX18: value }); setStopPrice(''); } }}>PLACE STOP</button>
              {sim.activeStop && <p className="action-reason">ACTIVE STOP · {formatPriceEth(priceX18(sim.activeStop.stopPriceX18))} ETH</p>}
              {sim.activeStop && <p className="action-reason">IF STOP FILLS · {observation ? (() => { const estimate = estimateStopLossWei(sim, observation, observationTimeMs); return estimate === null ? 'UNAVAILABLE' : `${formatSignedEth(estimate, 4)} ETH est.`; })() : 'UNAVAILABLE'}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
