import { useMemo, useRef, useState } from 'react';
import {
  ETHUSDT_PERP_TRAINING_20260828_0530,
  advanceMarginMark,
  closeMarginLong,
  createMarginSession,
  formatUsdMicros,
  marginPositionSnapshot,
  openMarginLong,
  placeMarginStop,
  usdMicros,
  type MarginActionResult,
  type MarginLeverage,
  type MarginSessionState,
} from '@rekt-ink/sim';
import { usePracticeSnapshot } from '../practice/react';
import './MarginTrainingScreen.css';

const EPISODE = ETHUSDT_PERP_TRAINING_20260828_0530;

function signedUsd(value: bigint): string {
  if (value === 0n) return '$0.00';
  const sign = value < 0n ? '-' : '+';
  const magnitude = value < 0n ? -value : value;
  return `${sign}$${formatUsdMicros(magnitude, 2)}`;
}

function signedBps(value: bigint): string {
  const sign = value > 0n ? '+' : value < 0n ? '-' : '';
  const magnitude = value < 0n ? -value : value;
  const whole = magnitude / 100n;
  const frac = (magnitude % 100n).toString().padStart(2, '0');
  return `${sign}${whole}.${frac}%`;
}

function parseUsdInput(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) return null;
  try {
    return usdMicros(trimmed);
  } catch {
    return null;
  }
}

export function MarginTrainingScreen() {
  const practice = usePracticeSnapshot();
  const authorized = practice.career.unlockedCapabilities.includes('PERP_LONG_2X');
  const sessionOrdinal = useRef(1);
  const actionOrdinal = useRef(1);
  const [leverage, setLeverage] = useState<MarginLeverage>(2);
  const [marginInput, setMarginInput] = useState('100');
  const [stopInput, setStopInput] = useState('2400');
  const [state, setState] = useState<MarginSessionState>(() => createMarginSession({
    sessionId: `${practice.career.careerId}:margin:${sessionOrdinal.current}`,
    careerEquityWei: practice.sim.account.equityWei,
    episode: EPISODE,
  }));
  const [message, setMessage] = useState<string | null>(null);

  const snapshot = useMemo(() => marginPositionSnapshot(state, EPISODE), [state]);
  const mark = EPISODE.marks[state.currentMarkIndex];
  const position = state.position;
  const canAdvance = !state.closed && state.currentMarkIndex < EPISODE.marks.length - 1;

  function actionId(prefix: string): string {
    const id = `${prefix}-${actionOrdinal.current}`;
    actionOrdinal.current += 1;
    return id;
  }

  function apply(result: MarginActionResult): void {
    setState(result.state);
    setMessage(result.accepted ? null : `${result.code ?? 'REJECTED'} // ${result.reason ?? 'The simulator refused this action.'}`);
  }

  function openLong(): void {
    if (!authorized || state.position || state.closed) return;
    const marginUsdMicros = parseUsdInput(marginInput);
    const stopPriceUsdMicros = parseUsdInput(stopInput);
    if (marginUsdMicros === null || marginUsdMicros <= 0n) {
      setMessage('INVALID_MARGIN // Enter a positive USD margin amount.');
      return;
    }
    if (stopInput.trim() !== '' && stopPriceUsdMicros === null) {
      setMessage('INVALID_STOP // Enter a decimal USD stop or leave it blank.');
      return;
    }
    apply(openMarginLong(state, EPISODE, {
      actionId: actionId('open'),
      marginUsdMicros,
      leverage,
      stopPriceUsdMicros: stopInput.trim() === '' ? null : stopPriceUsdMicros,
    }));
  }

  function replaceStop(): void {
    if (!position) return;
    const stopPriceUsdMicros = parseUsdInput(stopInput);
    if (stopPriceUsdMicros === null) {
      setMessage('INVALID_STOP // Enter a decimal USD protective stop.');
      return;
    }
    apply(placeMarginStop(state, EPISODE, { actionId: actionId('stop'), stopPriceUsdMicros }));
  }

  function nextMark(): void {
    if (!canAdvance) return;
    apply(advanceMarginMark(state, EPISODE, { actionId: actionId('mark') }));
  }

  function closeNow(): void {
    if (!position || state.closed) return;
    apply(closeMarginLong(state, EPISODE, { actionId: actionId('close') }));
  }

  function restart(): void {
    sessionOrdinal.current += 1;
    actionOrdinal.current = 1;
    setState(createMarginSession({
      sessionId: `${practice.career.careerId}:margin:${sessionOrdinal.current}`,
      careerEquityWei: practice.sim.account.equityWei,
      episode: EPISODE,
    }));
    setMessage(null);
  }

  if (!authorized) return null;

  return (
    <section className="margin-training" aria-label="MARGIN 2x historical training">
      <header className="margin-training__header">
        <div>
          <p className="margin-training__eyebrow">NEW DESK AUTHORIZED</p>
          <h2>MARGIN<span>//</span>TRAINING</h2>
          <p className="margin-training__sub">ETHUSDT PERP · ISOLATED LONG · HISTORICAL REPLAY</p>
        </div>
        <div className="margin-training__truth" aria-label="Training truth labels">
          <span>MARKET {EPISODE.marketProvenance}</span>
          <span>ECONOMICS SYNTHETIC</span>
          <span>{EPISODE.intrabarRule}</span>
        </div>
      </header>

      <div className="margin-training__notice">
        <strong>SIM_MARGIN_V0</strong> · venue-neutral leverage training, not a Binance liquidation replica. Future marks remain hidden until you advance the replay.
      </div>

      <div className="margin-training__grid">
        <div className="margin-training__panel margin-training__market">
          <div className="margin-training__panel-title">
            <span>EPISODE // {EPISODE.episodeId}</span>
            <span>{state.currentMarkIndex + 1}/{EPISODE.marks.length}</span>
          </div>
          <div className="margin-training__mark">
            <span>MARK</span>
            <strong>${formatUsdMicros(mark.priceUsdMicros, 2)}</strong>
          </div>
          <dl className="margin-training__facts">
            <div><dt>COLLATERAL</dt><dd>${formatUsdMicros(state.initialCollateralUsdMicros, 2)}</dd></div>
            <div><dt>FREE</dt><dd>${formatUsdMicros(state.freeCollateralUsdMicros, 2)}</dd></div>
            <div><dt>SOURCE</dt><dd>{EPISODE.sourceVenue}</dd></div>
            <div><dt>MODEL</dt><dd>{state.modelVersion}</dd></div>
          </dl>
          <div className="margin-training__timeline" aria-label="Historical replay progress">
            {EPISODE.marks.map((episodeMark, index) => (
              <span key={episodeMark.markId} className={index <= state.currentMarkIndex ? 'seen' : ''} aria-label={index <= state.currentMarkIndex ? `Mark ${index + 1} revealed` : `Mark ${index + 1} hidden`} />
            ))}
          </div>
        </div>

        <div className="margin-training__panel margin-training__ticket">
          <div className="margin-training__panel-title"><span>ISOLATED LONG</span><span>MAX 2x</span></div>
          <div className="margin-training__leverage" role="group" aria-label="Leverage">
            {[1, 2].map((value) => (
              <button key={value} type="button" className={leverage === value ? 'active' : ''} disabled={Boolean(position) || state.closed} onClick={() => setLeverage(value as MarginLeverage)}>
                {value}x
              </button>
            ))}
          </div>
          <label>
            <span>ISOLATED MARGIN · USD</span>
            <input aria-label="Isolated margin USD" value={marginInput} disabled={Boolean(position) || state.closed} inputMode="decimal" onChange={(event) => setMarginInput(event.target.value)} />
          </label>
          <label>
            <span>PROTECTIVE STOP · USD</span>
            <input aria-label="Margin protective stop USD" value={stopInput} disabled={state.closed} inputMode="decimal" onChange={(event) => setStopInput(event.target.value)} />
          </label>
          {!position && !state.closed && <button type="button" className="margin-training__primary" onClick={openLong}>OPEN LONG // {leverage}x</button>}
          {position && !state.closed && <button type="button" className="margin-training__secondary" onClick={replaceStop}>UPDATE STOP</button>}
          {message && <p className="margin-training__error" role="alert">{message}</p>}
        </div>

        <div className="margin-training__panel margin-training__position">
          <div className="margin-training__panel-title"><span>POSITION TRUTH</span><span>{position ? 'OPEN' : state.closed ? 'CLOSED' : 'FLAT'}</span></div>
          {position && snapshot ? (
            <dl className="margin-training__facts margin-training__facts--position">
              <div><dt>LEVERAGE</dt><dd>{position.leverage}x</dd></div>
              <div><dt>ENTRY</dt><dd>${formatUsdMicros(position.entryFillPriceUsdMicros, 2)}</dd></div>
              <div><dt>MARGIN</dt><dd>${formatUsdMicros(position.isolatedMarginUsdMicros, 2)}</dd></div>
              <div><dt>NOTIONAL</dt><dd>${formatUsdMicros(snapshot.markNotionalUsdMicros, 2)}</dd></div>
              <div><dt>uPNL</dt><dd>{signedUsd(snapshot.netPnlAfterEntryFeeUsdMicros)}</dd></div>
              <div><dt>ROE</dt><dd>{signedBps(snapshot.roeBps)}</dd></div>
              <div><dt>FUNDING</dt><dd>{signedUsd(-snapshot.accruedFundingUsdMicros)}</dd></div>
              <div><dt>EST. LIQ</dt><dd>{snapshot.liquidationPriceUsdMicros === null ? 'NONE @ 1x' : `$${formatUsdMicros(snapshot.liquidationPriceUsdMicros, 2)}`}</dd></div>
              <div><dt>STOP</dt><dd>{position.stopPriceUsdMicros === null ? 'NONE' : `$${formatUsdMicros(position.stopPriceUsdMicros, 2)}`}</dd></div>
              <div><dt>POSITION EQ</dt><dd>${formatUsdMicros(snapshot.positionEquityUsdMicros, 2)}</dd></div>
            </dl>
          ) : state.lastTrade ? (
            <dl className="margin-training__facts margin-training__facts--position">
              <div><dt>RESULT</dt><dd>{state.lastTrade.closeReason}</dd></div>
              <div><dt>LEVERAGE</dt><dd>{state.lastTrade.leverage}x</dd></div>
              <div><dt>ENTRY</dt><dd>${formatUsdMicros(state.lastTrade.entryPriceUsdMicros, 2)}</dd></div>
              <div><dt>EXIT</dt><dd>${formatUsdMicros(state.lastTrade.exitPriceUsdMicros, 2)}</dd></div>
              <div><dt>NET PNL</dt><dd>{signedUsd(state.lastTrade.netPnlUsdMicros)}</dd></div>
              <div><dt>FUNDING</dt><dd>{signedUsd(-state.lastTrade.fundingUsdMicros)}</dd></div>
              <div><dt>LIQ FEE</dt><dd>-${formatUsdMicros(state.lastTrade.liquidationFeeUsdMicros, 2)}</dd></div>
              <div><dt>LIQUIDATED</dt><dd>{state.lastTrade.liquidated ? 'YES' : 'NO'}</dd></div>
            </dl>
          ) : (
            <p className="margin-training__flat">Choose isolated margin, 1x/2x and a protective stop. The simulator—not the UI—derives exposure, ROE and liquidation.</p>
          )}
        </div>
      </div>

      <div className="margin-training__actions">
        <button type="button" disabled={!canAdvance} onClick={nextMark}>NEXT HISTORICAL MARK</button>
        <button type="button" disabled={!position || state.closed} onClick={closeNow}>CLOSE POSITION</button>
        <button type="button" onClick={restart}>RESTART EPISODE</button>
      </div>

      <div className="margin-training__events" aria-label="Margin event log">
        {state.events.slice(-6).map((event) => (
          <div key={event.eventId}><span>#{event.sequence}</span><strong>{event.type}</strong><small>{event.reason ?? ''}</small></div>
        ))}
      </div>
    </section>
  );
}
