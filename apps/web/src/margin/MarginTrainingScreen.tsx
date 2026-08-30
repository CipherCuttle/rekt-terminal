import { useMemo, useRef, useState } from 'react';
import {
  MARGIN_TRAINING_EPISODES,
  advanceMarginMark,
  advanceMarginShortMark,
  closeMarginLong,
  closeMarginShort,
  createMarginSession,
  createShortMarginSession,
  formatUsdMicros,
  marginPositionSnapshot,
  openMarginLong,
  openMarginShort,
  placeMarginShortStop,
  placeMarginStop,
  shortMarginPositionSnapshot,
  usdMicros,
  type MarginActionResult,
  type MarginEpisode,
  type MarginLeverage,
  type MarginSessionState,
  type ShortMarginActionResult,
  type ShortMarginSessionState,
} from '@rekt-ink/sim';
import { usePracticeRuntime, usePracticeSnapshot } from '../practice/react';
import './MarginTrainingScreen.css';

type TrainingSide = 'LONG' | 'SHORT';
type TrainingState = MarginSessionState | ShortMarginSessionState;
type TrainingResult = MarginActionResult | ShortMarginActionResult;

function signedUsd(value: bigint): string {
  if (value === 0n) return '$0.00';
  const sign = value < 0n ? '-' : '+';
  const magnitude = value < 0n ? -value : value;
  return `${sign}$${formatUsdMicros(magnitude, 2)}`;
}

function signedBps(value: bigint): string {
  const sign = value > 0n ? '+' : value < 0n ? '-' : '';
  const magnitude = value < 0n ? -value : value;
  return `${sign}${magnitude / 100n}.${(magnitude % 100n).toString().padStart(2, '0')}%`;
}

function parseUsdInput(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) return null;
  try { return usdMicros(trimmed); } catch { return null; }
}

function defaultStop(episode: MarginEpisode, side: TrainingSide): string {
  const mark = episode.marks[0].priceUsdMicros;
  const price = side === 'LONG' ? (mark * 9_800n) / 10_000n : (mark * 10_200n) / 10_000n;
  return formatUsdMicros(price, 2);
}

export function MarginTrainingScreen() {
  const runtime = usePracticeRuntime();
  const practice = usePracticeSnapshot();
  const authorized = practice.career.unlockedCapabilities.includes('PERP_LONG_2X');
  const shortAuthorized = practice.career.unlockedCapabilities.includes('PERP_SHORT_2X');
  const sessionOrdinal = useRef(1);
  const actionOrdinal = useRef(1);
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const [side, setSide] = useState<TrainingSide>('LONG');
  const [leverage, setLeverage] = useState<MarginLeverage>(2);
  const [marginInput, setMarginInput] = useState('100');
  const episode = MARGIN_TRAINING_EPISODES[episodeIndex];
  const [stopInput, setStopInput] = useState(() => defaultStop(MARGIN_TRAINING_EPISODES[0], 'LONG'));
  const [state, setState] = useState<TrainingState>(() => createMarginSession({
    sessionId: `${practice.career.careerId}:margin:${sessionOrdinal.current}`,
    careerEquityWei: practice.sim.account.equityWei,
    episode: MARGIN_TRAINING_EPISODES[0],
  }));
  const [message, setMessage] = useState<string | null>(null);

  const snapshot = useMemo(() => side === 'LONG'
    ? marginPositionSnapshot(state as MarginSessionState, episode)
    : shortMarginPositionSnapshot(state as ShortMarginSessionState, episode), [state, episode, side]);
  const mark = episode.marks[state.currentMarkIndex];
  const position = state.position;
  const canAdvance = !state.closed && state.currentMarkIndex < episode.marks.length - 1;
  const shortProgress = practice.career.qualification.short.qualifyingLongEpisodeIds.length;

  function actionId(prefix: string): string {
    const id = `${prefix}-${actionOrdinal.current}`;
    actionOrdinal.current += 1;
    return id;
  }

  function createTrainingState(nextSide: TrainingSide, nextEpisode: MarginEpisode): TrainingState {
    sessionOrdinal.current += 1;
    actionOrdinal.current = 1;
    const input = { sessionId: `${practice.career.careerId}:margin:${sessionOrdinal.current}`, careerEquityWei: practice.sim.account.equityWei, episode: nextEpisode };
    return nextSide === 'LONG' ? createMarginSession(input) : createShortMarginSession(input);
  }

  function resetTraining(nextSide: TrainingSide, nextEpisodeIndex: number): void {
    const nextEpisode = MARGIN_TRAINING_EPISODES[nextEpisodeIndex];
    setSide(nextSide);
    setEpisodeIndex(nextEpisodeIndex);
    setStopInput(defaultStop(nextEpisode, nextSide));
    setState(createTrainingState(nextSide, nextEpisode));
    setMessage(null);
  }

  function apply(result: TrainingResult): void {
    if (side === 'LONG' && !state.closed && result.state.closed) {
      runtime.session.recordLongMarginEpisodeCompletion(result.state as MarginSessionState, episode);
    }
    setState(result.state);
    setMessage(result.accepted ? null : `${result.code ?? 'REJECTED'} // ${result.reason ?? 'The simulator refused this action.'}`);
  }

  function openPosition(): void {
    if (!authorized || state.position || state.closed || (side === 'SHORT' && !shortAuthorized)) return;
    const marginUsdMicros = parseUsdInput(marginInput);
    const stopPriceUsdMicros = parseUsdInput(stopInput);
    if (marginUsdMicros === null || marginUsdMicros <= 0n) { setMessage('INVALID_MARGIN // Enter a positive USD margin amount.'); return; }
    if (stopInput.trim() !== '' && stopPriceUsdMicros === null) { setMessage('INVALID_STOP // Enter a decimal USD stop or leave it blank.'); return; }
    if (side === 'LONG') {
      apply(openMarginLong(state as MarginSessionState, episode, { actionId: actionId('open-long'), marginUsdMicros, leverage, stopPriceUsdMicros: stopInput.trim() === '' ? null : stopPriceUsdMicros }));
    } else {
      apply(openMarginShort(state as ShortMarginSessionState, episode, { actionId: actionId('open-short'), marginUsdMicros, leverage, stopPriceUsdMicros: stopInput.trim() === '' ? null : stopPriceUsdMicros }));
    }
  }

  function replaceStop(): void {
    if (!position) return;
    const stopPriceUsdMicros = parseUsdInput(stopInput);
    if (stopPriceUsdMicros === null) { setMessage('INVALID_STOP // Enter a decimal USD protective stop.'); return; }
    if (side === 'LONG') apply(placeMarginStop(state as MarginSessionState, episode, { actionId: actionId('stop-long'), stopPriceUsdMicros }));
    else apply(placeMarginShortStop(state as ShortMarginSessionState, episode, { actionId: actionId('stop-short'), stopPriceUsdMicros }));
  }

  function nextMark(): void {
    if (!canAdvance) return;
    if (side === 'LONG') apply(advanceMarginMark(state as MarginSessionState, episode, { actionId: actionId('mark-long') }));
    else apply(advanceMarginShortMark(state as ShortMarginSessionState, episode, { actionId: actionId('mark-short') }));
  }

  function closeNow(): void {
    if (!position || state.closed) return;
    if (side === 'LONG') apply(closeMarginLong(state as MarginSessionState, episode, { actionId: actionId('close-long') }));
    else apply(closeMarginShort(state as ShortMarginSessionState, episode, { actionId: actionId('close-short') }));
  }

  if (!authorized) return null;

  return (
    <section className="margin-training" aria-label="MARGIN 2x historical training">
      <header className="margin-training__header">
        <div>
          <p className="margin-training__eyebrow">NEW DESK AUTHORIZED</p>
          <h2>MARGIN<span>//</span>TRAINING</h2>
          <p className="margin-training__sub">ETHUSDT PERP · ISOLATED {side} · HISTORICAL REPLAY</p>
        </div>
        <div className="margin-training__truth" aria-label="Training truth labels">
          <span>MARKET {episode.marketProvenance}</span><span>ECONOMICS SYNTHETIC</span><span>{episode.intrabarRule}</span>
        </div>
      </header>

      <div className="margin-training__notice">
        <strong>SIM_MARGIN_V0</strong> · venue-neutral leverage training, not a Binance liquidation replica. Future marks remain hidden until replay advance.
        {!shortAuthorized && <span> · SHORT QUALIFICATION {shortProgress}/2</span>}
      </div>

      <div className="margin-training__grid">
        <div className="margin-training__panel margin-training__market">
          <div className="margin-training__panel-title"><span>EPISODE // {episode.episodeId}</span><span>{state.currentMarkIndex + 1}/{episode.marks.length}</span></div>
          <div className="margin-training__leverage" role="group" aria-label="Historical episode">
            {MARGIN_TRAINING_EPISODES.map((candidate, index) => (
              <button key={candidate.episodeId} type="button" className={episodeIndex === index ? 'active' : ''} disabled={Boolean(position)} onClick={() => resetTraining(side, index)}>EP {index + 1}</button>
            ))}
          </div>
          <div className="margin-training__mark"><span>MARK</span><strong>${formatUsdMicros(mark.priceUsdMicros, 2)}</strong></div>
          <dl className="margin-training__facts">
            <div><dt>COLLATERAL</dt><dd>${formatUsdMicros(state.initialCollateralUsdMicros, 2)}</dd></div>
            <div><dt>FREE</dt><dd>${formatUsdMicros(state.freeCollateralUsdMicros, 2)}</dd></div>
            <div><dt>SOURCE</dt><dd>{episode.sourceVenue}</dd></div>
            <div><dt>MODEL</dt><dd>{state.modelVersion}</dd></div>
          </dl>
          <div className="margin-training__timeline" aria-label="Historical replay progress">
            {episode.marks.map((episodeMark, index) => <span key={episodeMark.markId} className={index <= state.currentMarkIndex ? 'seen' : ''} aria-label={index <= state.currentMarkIndex ? `Mark ${index + 1} revealed` : `Mark ${index + 1} hidden`} />)}
          </div>
        </div>

        <div className="margin-training__panel margin-training__ticket">
          <div className="margin-training__panel-title"><span>ISOLATED {side}</span><span>MAX 2x</span></div>
          {shortAuthorized && (
            <div className="margin-training__leverage" role="group" aria-label="Position side">
              {(['LONG', 'SHORT'] as const).map((value) => <button key={value} type="button" className={side === value ? 'active' : ''} disabled={Boolean(position)} onClick={() => resetTraining(value, episodeIndex)}>{value}</button>)}
            </div>
          )}
          <div className="margin-training__leverage" role="group" aria-label="Leverage">
            {[1, 2].map((value) => <button key={value} type="button" className={leverage === value ? 'active' : ''} disabled={Boolean(position) || state.closed} onClick={() => setLeverage(value as MarginLeverage)}>{value}x</button>)}
          </div>
          <label><span>ISOLATED MARGIN · USD</span><input aria-label="Isolated margin USD" value={marginInput} disabled={Boolean(position) || state.closed} inputMode="decimal" onChange={(event) => setMarginInput(event.target.value)} /></label>
          <label><span>PROTECTIVE STOP · USD</span><input aria-label="Margin protective stop USD" value={stopInput} disabled={state.closed} inputMode="decimal" onChange={(event) => setStopInput(event.target.value)} /></label>
          {!position && !state.closed && <button type="button" className="margin-training__primary" onClick={openPosition}>OPEN {side} // {leverage}x</button>}
          {position && !state.closed && <button type="button" className="margin-training__secondary" onClick={replaceStop}>UPDATE STOP</button>}
          {message && <p className="margin-training__error" role="alert">{message}</p>}
        </div>

        <div className="margin-training__panel margin-training__position">
          <div className="margin-training__panel-title"><span>POSITION TRUTH</span><span>{position ? 'OPEN' : state.closed ? 'CLOSED' : 'FLAT'}</span></div>
          {position && snapshot ? (
            <dl className="margin-training__facts margin-training__facts--position">
              <div><dt>SIDE</dt><dd>{side}</dd></div><div><dt>LEVERAGE</dt><dd>{position.leverage}x</dd></div>
              <div><dt>ENTRY</dt><dd>${formatUsdMicros(position.entryFillPriceUsdMicros, 2)}</dd></div><div><dt>MARGIN</dt><dd>${formatUsdMicros(position.isolatedMarginUsdMicros, 2)}</dd></div>
              <div><dt>NOTIONAL</dt><dd>${formatUsdMicros(snapshot.markNotionalUsdMicros, 2)}</dd></div><div><dt>uPNL</dt><dd>{signedUsd(snapshot.netPnlAfterEntryFeeUsdMicros)}</dd></div>
              <div><dt>ROE</dt><dd>{signedBps(snapshot.roeBps)}</dd></div><div><dt>FUNDING</dt><dd>{signedUsd(-snapshot.accruedFundingUsdMicros)}</dd></div>
              <div><dt>EST. LIQ</dt><dd>{snapshot.liquidationPriceUsdMicros === null ? 'NONE' : `$${formatUsdMicros(snapshot.liquidationPriceUsdMicros, 2)}`}</dd></div>
              <div><dt>STOP</dt><dd>{position.stopPriceUsdMicros === null ? 'NONE' : `$${formatUsdMicros(position.stopPriceUsdMicros, 2)}`}</dd></div>
              <div><dt>POSITION EQ</dt><dd>${formatUsdMicros(snapshot.positionEquityUsdMicros, 2)}</dd></div>
            </dl>
          ) : state.lastTrade ? (
            <dl className="margin-training__facts margin-training__facts--position">
              <div><dt>SIDE</dt><dd>{state.lastTrade.side}</dd></div><div><dt>RESULT</dt><dd>{state.lastTrade.closeReason}</dd></div>
              <div><dt>LEVERAGE</dt><dd>{state.lastTrade.leverage}x</dd></div><div><dt>ENTRY</dt><dd>${formatUsdMicros(state.lastTrade.entryPriceUsdMicros, 2)}</dd></div>
              <div><dt>EXIT</dt><dd>${formatUsdMicros(state.lastTrade.exitPriceUsdMicros, 2)}</dd></div><div><dt>NET PNL</dt><dd>{signedUsd(state.lastTrade.netPnlUsdMicros)}</dd></div>
              <div><dt>FUNDING</dt><dd>{signedUsd(-state.lastTrade.fundingUsdMicros)}</dd></div><div><dt>LIQ FEE</dt><dd>-${formatUsdMicros(state.lastTrade.liquidationFeeUsdMicros, 2)}</dd></div>
              <div><dt>LIQUIDATED</dt><dd>{state.lastTrade.liquidated ? 'YES' : 'NO'}</dd></div>
            </dl>
          ) : <p className="margin-training__flat">Choose isolated margin, 1x/2x and a protective stop. The simulator—not React—derives exposure, ROE and liquidation.</p>}
        </div>
      </div>

      <div className="margin-training__actions">
        <button type="button" disabled={!canAdvance} onClick={nextMark}>NEXT HISTORICAL MARK</button>
        <button type="button" disabled={!position || state.closed} onClick={closeNow}>CLOSE POSITION</button>
        <button type="button" onClick={() => resetTraining(side, episodeIndex)}>RESTART EPISODE</button>
      </div>
      <div className="margin-training__events" aria-label="Margin event log">
        {state.events.slice(-6).map((event) => <div key={event.eventId}><span>#{event.sequence}</span><strong>{event.type}</strong><small>{event.reason ?? ''}</small></div>)}
      </div>
    </section>
  );
}
