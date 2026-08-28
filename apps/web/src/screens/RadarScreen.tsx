import { useMemo, useState } from 'react';
import { ProvenanceChip } from '../components/TruthChip';
import { age, ethShort, money, pct, short } from '../lib/format-display';
import { evaluatePracticeEligibility } from '../practice/eligibility';
import { quoteFromRadarAsset } from '../practice/quote';
import type { RadarAsset } from '../types/api';

const TABS = ['TRENDING', 'NEW', 'GAINERS', 'IGNITION', 'REKT', 'WATCHLIST'] as const;

/**
 * Practice support for a Radar row.
 *
 * Evaluated at the row's own observation time so the answer reflects the
 * instrument (quote asset, price, derivable depth) rather than how long the
 * list has been open. Freshness is re-checked for real when the terminal binds
 * a live feed to the instrument.
 */
function practiceSupport(asset: RadarAsset, nowMs: number): { supported: boolean; reason: string } {
  const quote = quoteFromRadarAsset(asset, nowMs);
  const gate = evaluatePracticeEligibility(quote, quote.observedAtMs);
  return gate.status === 'SUPPORTED'
    ? { supported: true, reason: 'Spot practice is available for this pair.' }
    : { supported: false, reason: gate.detail };
}

export function RadarScreen({ items, onOpen }: { items: RadarAsset[]; onOpen: (asset: RadarAsset) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('TRENDING');
  const nowMs = Date.now();

  const list = useMemo(
    () =>
      [...items].sort((a, b) =>
        tab === 'NEW'
          ? (a.ageMinutes ?? 1e12) - (b.ageMinutes ?? 1e12)
          : tab === 'GAINERS'
            ? (b.change1h ?? -1e9) - (a.change1h ?? -1e9)
            : (b.heat ?? 0) - (a.heat ?? 0),
      ),
    [items, tab],
  );

  return (
    <section className="screen radar-screen">
      <div className="tabs" role="tablist" aria-label="Radar view">
        {TABS.map((entry) => (
          <button key={entry} type="button" role="tab" aria-selected={tab === entry} className={tab === entry ? 'active' : ''} onClick={() => setTab(entry)}>
            {entry}
          </button>
        ))}
      </div>

      <div className="panel radar-panel">
        <div className="radar-scroll">
          <table className="radar">
            <thead>
              <tr>
                <th className="al">ASSET</th>
                <th className="al">PRACTICE</th>
                <th>PRICE ETH</th>
                <th>USD</th>
                <th>5M</th>
                <th>1H</th>
                <th>6H</th>
                <th>BUYS</th>
                <th>SELLS</th>
                <th>VOL 24H</th>
                <th>LIQ</th>
                <th>FDV</th>
                <th>AGE</th>
                <th>HEAT</th>
                <th>SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {list.map((asset) => {
                const support = practiceSupport(asset, nowMs);
                return (
                  <tr
                    key={asset.id}
                    onClick={() => onOpen(asset)}
                    tabIndex={0}
                    onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onOpen(asset)}
                  >
                    <td>
                      <div className="asset-cell">
                        <div className="sigil">{asset.symbol.slice(0, 2)}</div>
                        <div>
                          <div>
                            <b>{asset.symbol}</b> <span className="quote">/{asset.quote}</span>{' '}
                            {asset.verified && (
                              <span className="verified" title="Verified pair">
                                ✓
                              </span>
                            )}
                          </div>
                          <small>
                            {asset.venue} · {short(asset.tokenAddress)}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="al">
                      <span className={support.supported ? 'practice practice-on' : 'practice practice-off'} title={support.reason}>
                        {support.supported ? 'SUPPORTED' : 'UNAVAILABLE'}
                      </span>
                    </td>
                    <td className="num">{ethShort(asset.priceEth)}</td>
                    <td className="num">{money(asset.priceUsd)}</td>
                    <td className={`num ${(asset.change5m ?? 0) >= 0 ? 'num-gain' : 'num-loss'}`}>{pct(asset.change5m)}</td>
                    <td className={`num ${(asset.change1h ?? 0) >= 0 ? 'num-gain' : 'num-loss'}`}>{pct(asset.change1h)}</td>
                    <td className={`num ${(asset.change6h ?? 0) >= 0 ? 'num-gain' : 'num-loss'}`}>{pct(asset.change6h)}</td>
                    <td className="num">{asset.buys ?? '—'}</td>
                    <td className="num">{asset.sells ?? '—'}</td>
                    <td className="num">{money(asset.volume24hUsd)}</td>
                    <td className="num">{money(asset.liquidityUsd)}</td>
                    <td className="num">{money(asset.fdvUsd)}</td>
                    <td className="num">{age(asset.ageMinutes)}</td>
                    <td>
                      <div className="heat">
                        <span className="heat-track">
                          <i style={{ transform: `scaleX(${(asset.heat ?? 0) / 100})` }} />
                        </span>
                        <span className="num">{asset.heat ?? '—'}</span>
                      </div>
                    </td>
                    <td>
                      <ProvenanceChip p={asset.provenance} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">SELECT A SUPPORTED PAIR TO OPEN THE TERMINAL · SOURCE STATE IS NEVER COLOUR-ONLY</p>
      </div>
    </section>
  );
}
