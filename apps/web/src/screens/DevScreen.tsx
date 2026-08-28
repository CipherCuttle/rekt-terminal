/**
 * Dormant secondary surfaces.
 *
 * NFT provenance and wallet forensics are not part of the MVP trade loop and
 * are removed from primary navigation. The implementations are preserved here
 * and reachable with `?dev=1` so the work is not lost and can be promoted back
 * when those features have a product home.
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { money, short } from '../lib/format-display';
import { ProvenanceChip } from '../components/TruthChip';
import type { MarketEnvironment, WalletTrace } from '../types/api';

export function DevScreen({ environment, onWallet }: { environment: MarketEnvironment; onWallet: (address: string) => void }) {
  const [nft, setNft] = useState<any>(null);
  const [revealed, setRevealed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setNft(null);
    setUnavailable(false);
    api.nft('0x0000000000000000000000000000000000000000', '413', environment).then(setNft).catch(() => setUnavailable(true));
  }, [environment]);

  if (unavailable) {
    return (
      <section className="screen">
        <div className="panel empty">
          LIVE NFT SEMANTICS · UNAVAILABLE
          <br />
          <small>SALE CLASSIFICATION FAILS CLOSED UNTIL REKT CONTRACT + MARKETPLACE/PAYMENT EVIDENCE ADAPTERS ARE CONFIGURED.</small>
        </div>
      </section>
    );
  }
  if (!nft) {
    return (
      <section className="screen">
        <div className="panel empty">NFT {environment} LOADING…</div>
      </section>
    );
  }

  return (
    <section className="screen nft-grid">
      <div className="panel nft-art">
        <header className="panel-head">
          <h2>{nft.name}</h2>
          <span className="panel-note">ERC-721 · INK · DORMANT SURFACE</span>
        </header>
        <button type="button" className={`pixel-art ${revealed ? 'revealed' : ''}`} onClick={() => setRevealed(true)} aria-label="Reveal NFT artwork">
          <div className="rekt-face">{revealed ? 'REKT 0413' : 'PIXEL REVEAL'}</div>
        </button>
        <div className="kv">
          <span>CURRENT OWNER</span>
          <b>{short(nft.owner)}</b>
        </div>
        <button type="button" className="trace" onClick={() => onWallet(nft.owner)}>
          TRACE OWNER → WALLET//TRACE
        </button>
      </div>
      <div className="panel">
        <header className="panel-head">
          <h2>PROVENANCE TIMELINE</h2>
          <span className="panel-note">SALE ≠ TRANSFER</span>
        </header>
        <div className="timeline">
          {nft.timeline.map((entry: any) => (
            <div className={`tl ${entry.type === 'SALE_CONFIRMED' ? 'sale' : 'xfer'}`} key={entry.at}>
              <time>{entry.at.slice(0, 16).replace('T', ' ')}</time>
              <b>{entry.type}</b>
              <span>
                {entry.from ? short(entry.from) : 'MINT'} → {short(entry.to)}{' '}
                {entry.priceEth != null ? `· ${entry.priceEth} ETH` : entry.type === 'TRANSFER' ? '· NOT A SALE · NO PAYMENT EVIDENCE' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WalletDrawer({ data, onClose }: { data: WalletTrace; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside id="drawer" className="open" aria-label="Wallet trace inspector">
      <div className="d-head">
        <b>WALLET//TRACE</b>
        <span className="truth truth-derived">{short(data.address)}</span>
        <div className="grow" />
        <button type="button" onClick={onClose}>
          ESC ×
        </button>
      </div>
      <div className="d-body">
        <div>
          <div className="lbl">VISIBLE ONCHAIN VALUE · NEVER NET WORTH</div>
          <div className="bigval num">{money(data.visibleValueUsd)}</div>
          <div className="num">{data.eth == null ? '—' : `${data.eth.toFixed(4)} ETH`}</div>
        </div>
        <div>
          <span className="clsbadge">{data.classifier}</span>
          {data.confidence != null && (
            <div className="confidence">
              <i style={{ transform: `scaleX(${data.confidence})` }} />
            </div>
          )}
        </div>
        <div className="kv">
          <span>ADDRESS AGE</span>
          <b>{data.addressAgeDays == null ? 'UNAVAILABLE' : `${data.addressAgeDays}d`}</b>
        </div>
        <div className="kv">
          <span>MEDIAN HOLD</span>
          <b>{data.medianHold ?? 'UNAVAILABLE'}</b>
        </div>
        <div>
          <div className="lbl">WHY</div>
          <ul className="why">
            {data.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <div>
          <ProvenanceChip p={data.provenance} />
          <p className="note">
            {data.provenance.source} · {data.provenance.method}
          </p>
        </div>
      </div>
    </aside>
  );
}
