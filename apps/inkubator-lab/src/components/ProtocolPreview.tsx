import {inkubatorState} from '../generated/inkubator-state';

export default function ProtocolPreview() {
  const receipt = inkubatorState.receipts[0];
  const round = inkubatorState.rounds.find((item) => item.roundId === receipt.roundId)!;
  const player = inkubatorState.players.find((item) => item.playerId === receipt.playerId)!;
  const stats = inkubatorState.playerStats.find((item) => item.playerId === player.playerId)!;
  const liveEvidence = receipt.evidence.find((item) => item.type === 'LIVE_URL');
  const initials = player.character.callSign.split(/\s+/).map((part) => part[0]).join('').slice(0, 2);

  return (
    <div className="d3-protocol-preview" aria-label="INK(CUBATOR) protocol development preview">
      <div className="d3-protocol-preview-head">
        <span>PROTOCOL / RECEIPT V0.1</span>
        <b>DEVELOPMENT FIXTURE · NOT A REAL SHIP</b>
      </div>

      <div className="d3-protocol-grid">
        <article className="d3-player-card">
          <div className="d3-instrument-kicker"><span>PLAYER // {player.playerId}</span><b>{player.character.archetype}</b></div>
          <div className="d3-player-identity">
            <div className="d3-player-avatar" aria-hidden="true">{initials}</div>
            <div><small>CALL SIGN</small><h3>{player.character.callSign}</h3><p>{player.handle}</p></div>
          </div>
          <div className="d3-player-facts" aria-label="Derived fixture player facts">
            <span><small>SHIPS</small>{String(stats.ships).padStart(2, '0')}</span>
            <span><small>ROUNDS</small>{String(stats.rounds).padStart(2, '0')}</span>
            <span><small>RANK</small>—</span>
          </div>
          <p className="d3-player-note">Character identity persists. Rankings activate only when real rounds create real ship history.</p>
        </article>

        <article className="d3-receipt-card">
          <div className="d3-instrument-kicker"><span>SHIP RECEIPT // {receipt.receiptId}</span><b className="is-pass">OBSERVED PASS</b></div>
          <div className="d3-receipt-title"><div><small>ARTIFACT / FIXTURE</small><h3>{receipt.artifact.title}</h3></div><span>{round.roundId}</span></div>
          <p className="d3-receipt-explainer">Receipts record evidence, not taste or safety. Human curation decides what slaps; the machine only records what it actually observed.</p>

          <div className="d3-receipt-facts">
            <div><small>LIVE CHECK</small><strong>{liveEvidence?.status ?? 'UNKNOWN'}</strong><span>{liveEvidence ? <time dateTime={liveEvidence.observedAt}>{liveEvidence.observedAt.slice(0, 10)}</time> : 'NO EVIDENCE'}</span></div>
            <div><small>ROUND STATE</small><strong>{round.status}</strong><span>{round.title}</span></div>
            <div><small>PLAYER</small><strong>{player.character.callSign}</strong><span>{player.playerId}</span></div>
          </div>

          <details className="d3-receipt-details">
            <summary>VIEW TECHNICAL EVIDENCE</summary>
            <div className="d3-evidence-list">
              {receipt.evidence.map((item) => (
                <div key={`${item.type}-${item.observedAt}`}><span>{item.type}</span><b>{item.status}</b><p>{item.claim}</p><time dateTime={item.observedAt}>{item.observedAt}</time></div>
              ))}
            </div>
            <div className="d3-digest"><span>CONTENT DIGEST / {receipt.digestAlgorithm.toUpperCase()}</span><code>{receipt.digest}</code><small>{receipt.digestProfile}</small></div>
          </details>
        </article>
      </div>
    </div>
  );
}
