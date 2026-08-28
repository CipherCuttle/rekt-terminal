import { useState } from 'react';
import { priceX18, wei, type SimState } from '@rekt-ink/sim';
import { formatBpsPercent, formatEth, formatPriceEth, formatQuantity, formatSignedEth } from '../practice/format';

/**
 * Position and account truth, read straight off simulator state.
 *
 * Progressive disclosure: the numbers a trader acts on are always visible; cost
 * basis, fees and drawdown live behind DETAIL so the primary block stays
 * readable at a glance.
 */
export function PositionTruth({ sim, symbol }: { sim: SimState; symbol: string }) {
  const [showDetail, setShowDetail] = useState(false);
  const { account, position } = sim;
  const hasRealized = account.realizedPnlWei !== 0n;

  if (!position) {
    return (
      <section className="panel truth-panel" aria-label="Account">
        <header className="panel-head">
          <h2>ACCOUNT</h2>
          <span className="panel-note">NO OPEN POSITION</span>
        </header>
        <dl className="truth-grid">
          <Figure label="FREE ETH" value={formatEth(account.freeEthWei)} unit="ETH" emphasis />
          <Figure label="EQUITY" value={formatEth(account.equityWei)} unit="ETH" />
          {hasRealized && (
            <Figure
              label="REALIZED PNL"
              value={formatSignedEth(account.realizedPnlWei)}
              unit="ETH"
              tone={account.realizedPnlWei > 0n ? 'gain' : account.realizedPnlWei < 0n ? 'loss' : undefined}
            />
          )}
          {account.maxDrawdownBps > 0n && <Figure label="MAX DRAWDOWN" value={formatBpsPercent(account.maxDrawdownBps)} />}
        </dl>
      </section>
    );
  }

  const unrealized = account.unrealizedPnlWei;
  const tone = unrealized > 0n ? 'gain' : unrealized < 0n ? 'loss' : undefined;

  return (
    <section className="panel truth-panel truth-panel-open" aria-label="Open position">
      <header className="panel-head">
        <h2>POSITION</h2>
        <span className="panel-tag">LONG {symbol}</span>
        <span className="panel-note">SPOT</span>
      </header>

      <dl className="truth-grid">
        <Figure label="QUANTITY" value={formatQuantity(position.openQuantityAtoms)} unit={symbol} emphasis />
        <Figure label="UNREALIZED PNL" value={formatSignedEth(unrealized)} unit="ETH" tone={tone} emphasis />
        <Figure label="AVG ENTRY" value={formatPriceEth(priceX18(position.averageEntryPriceX18))} unit="ETH" />
        <Figure label="MEDIAN ENTRY FILL" value={formatPriceEth(priceX18(position.medianEntryPriceX18))} unit="ETH" />
        <Figure
          label="MARK"
          value={sim.markPriceX18 === null ? '—' : formatPriceEth(priceX18(sim.markPriceX18))}
          unit="ETH"
          note="LAST ACCEPTED"
        />
        <Figure label="EQUITY" value={formatEth(account.equityWei)} unit="ETH" />
      </dl>

      <button type="button" className="detail-toggle" aria-expanded={showDetail} onClick={() => setShowDetail((open) => !open)}>
        {showDetail ? 'HIDE DETAIL' : 'DETAIL'}
      </button>

      {showDetail && (
        <dl className="truth-grid truth-grid-detail">
          <Figure label="COST BASIS" value={formatEth(wei(position.costBasisWei))} unit="ETH" />
          <Figure label="ENTRY FEES HELD" value={formatEth(wei(position.remainingEntryFeesWei), 6)} unit="ETH" />
          <Figure label="FREE ETH" value={formatEth(account.freeEthWei)} unit="ETH" />
          <Figure label="ENTRY FILLS" value={String(position.entryCount)} />
          <Figure label="EXITS TAKEN" value={String(position.exitCount)} />
          <Figure label="MAX DRAWDOWN" value={formatBpsPercent(account.maxDrawdownBps)} />
        </dl>
      )}
    </section>
  );
}

function Figure({
  label,
  value,
  unit,
  tone,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'gain' | 'loss';
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`figure${emphasis ? ' figure-lead' : ''}`}>
      <dt>
        {label}
        {note && <span className="figure-note">{note}</span>}
      </dt>
      <dd className={tone ? `num num-${tone}` : 'num'}>
        {value}
        {unit && <span className="figure-unit">{unit}</span>}
      </dd>
    </div>
  );
}
