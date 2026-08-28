import { useEffect, useRef } from 'react';
import { priceX18, wei } from '@rekt-ink/sim';
import { formatBpsPercent, formatEth, formatPriceEth, formatSignedEth } from '../practice/format';
import type { TradeReview } from '../practice/store';

/**
 * Trade review.
 *
 * OUTCOME and PROCESS are separated deliberately. A profitable trade is not
 * evidence of skill, and the qualification verdict is read from Career's own
 * counters rather than inferred from the PnL sign.
 *
 * Every number here comes from the recorded TradeSummary or from the cycle's
 * actual fills. Nothing is estimated.
 */
export function TradeReviewCard({ review, symbol, onDismiss }: { review: TradeReview; symbol: string; onDismiss: () => void }) {
  const { summary, economics } = review;
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dismissRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const net = summary.realizedPnlWei;
  const tone = net > 0n ? 'gain' : net < 0n ? 'loss' : 'flat';
  const qualification = review.careerAfter.qualification.scaleControl;
  const lossOverLimit = Number(summary.lossBpsOfThenCurrentEquity) > qualification.lossLimitBps;

  return (
    <div className="review-scrim" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <article className="review-card">
        <header className="review-head">
          <div>
            <p className="review-kicker">TRADE CLOSED · {summary.tradeId.toUpperCase()}</p>
            <h2 id="review-title">
              {symbol} <span className="review-mode">SPOT LONG</span>
            </h2>
          </div>
          <button ref={dismissRef} type="button" className="review-close" onClick={onDismiss}>
            DISMISS <kbd>ESC</kbd>
          </button>
        </header>

        <section className="review-section" aria-label="Outcome">
          <h3 className="review-section-title">OUTCOME</h3>
          <p className={`review-net num num-${tone}`}>
            {formatSignedEth(net, 6)}
            <span className="review-net-unit">ETH</span>
          </p>
          <dl className="review-grid">
            <Row label="AVG ENTRY" value={`${formatPriceEth(priceX18(summary.averageEntryPriceX18))} ETH`} />
            <Row label="MEDIAN ENTRY FILL" value={`${formatPriceEth(priceX18(summary.medianEntryPriceX18))} ETH`} />
            <Row label="AVG EXIT" value={`${formatPriceEth(economics.exitPriceX18)} ETH`} />
            <Row label="FEES PAID" value={`${formatEth(economics.totalFeesWei, 6)} ETH`} />
            <Row label="EQUITY AT OPEN" value={`${formatEth(wei(summary.accountEquityAtOpenWei))} ETH`} />
            <Row label="EQUITY AT CLOSE" value={`${formatEth(wei(summary.accountEquityAtCloseWei))} ETH`} />
            <Row label="MAX DRAWDOWN AT CLOSE" value={formatBpsPercent(summary.maxDrawdownBpsAtClose)} />
            {summary.lossBpsOfThenCurrentEquity > 0n && (
              <Row label="LOSS VS EQUITY AT OPEN" value={formatBpsPercent(summary.lossBpsOfThenCurrentEquity)} tone="loss" />
            )}
            <Row label="FILLS" value={`${economics.entryFillCount} IN · ${economics.exitFillCount} OUT`} />
          </dl>
        </section>

        <section className="review-section review-process" aria-label="Process and qualification">
          <h3 className="review-section-title">PROCESS / QUALIFICATION</h3>
          <p className={`review-verdict ${review.countedTowardQualification ? 'verdict-yes' : 'verdict-no'}`}>
            {review.countedTowardQualification ? 'COUNTED TOWARD SCALE_CONTROL' : 'DID NOT COUNT TOWARD SCALE_CONTROL'}
          </p>
          {!review.countedTowardQualification && (
            <p className="review-note">
              {lossOverLimit
                ? `Closed loss was ${formatBpsPercent(summary.lossBpsOfThenCurrentEquity)} of equity at open; the gate is ${formatBpsPercent(BigInt(qualification.lossLimitBps))}.`
                : 'Account equity at close was not positive.'}
            </p>
          )}
          <dl className="review-grid">
            <Row label="CONTROLLED SPOT TRADES" value={`${qualification.closedSpotTrades} / ${qualification.targetClosedSpotTrades}`} />
            <Row label="TOTAL CLOSED TRADES" value={String(review.careerAfter.stats.closedSpotTrades)} />
            <Row label="WORST CLOSED LOSS" value={formatBpsPercent(BigInt(qualification.maxClosedLossBps))} />
            <Row label="PARTIAL EXIT USED" value={summary.partialExitUsed ? 'YES' : 'NO'} />
          </dl>
          <p className="review-caveat">Outcome measures the market. Qualification measures process. A profitable trade is not by itself evidence of skill.</p>
        </section>

        {review.unlockedSkills.length > 0 && (
          <section className="review-unlock" aria-label="Capability unlocked">
            <p className="unlock-flag">CAPABILITY UNLOCKED</p>
            <p className="unlock-name">{review.unlockedSkills.join(' · ')}</p>
            <p className="unlock-detail">Scale-in and partial exit are now authorised in the ticket.</p>
          </section>
        )}

        <p className="review-model">
          MODEL {summary.modelVersions.join(' · ')} · SIMULATED FILLS · NO ORDER LEFT THIS DEVICE
        </p>
      </article>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'loss' }) {
  return (
    <div className="review-row">
      <dt>{label}</dt>
      <dd className={tone ? `num num-${tone}` : 'num'}>{value}</dd>
    </div>
  );
}
