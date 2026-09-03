import { PHASE_0_RECEIPTS, type CapabilityId, type CareerState, type SkillId } from '@rekt-ink/career';
import { formatBpsPercent } from '../practice/format';
import { MarginTrainingScreen } from '../margin/MarginTrainingScreen';
import { MISSION_DEFINITIONS, MISSION_IDS, nextMissionId, type LearningStateV0, type MissionId } from '@rekt-ink/learning';

/**
 * Career as a capability system.
 *
 * Skills authorise actions; they are not a score. Locked tiers are shown so the
 * progression is legible, but nothing here awards or spends anything — Career
 * only reads facts the simulator recorded.
 */
const SKILL_TIERS: readonly { id: SkillId; capabilities: readonly CapabilityId[]; blurb: string }[] = [
  { id: 'SPOT_BASIC', capabilities: ['SPOT_MARKET_BUY_FIXED', 'SPOT_SELL_ALL'], blurb: 'Fixed-size spot entry and full close.' },
  { id: 'SCALE_CONTROL', capabilities: ['SCALE_IN', 'PARTIAL_EXIT'], blurb: 'Add to a position and take partial exits.' },
  { id: 'STOP_LOSS', capabilities: ['STOP_MARKET'], blurb: 'Place a protective stop on a long spot position.' },
  { id: 'RISK_SIZING', capabilities: ['CUSTOM_POSITION_SIZE', 'RISK_PERCENT_SIZING'], blurb: 'Size a position from your stop distance and an account-risk budget.' },
  { id: 'MARGIN_2X', capabilities: ['PERP_LONG_2X'], blurb: 'Historical isolated long training at 1x or 2x, with explicit liquidation geometry.' },
];

const CAPABILITY_LABEL: Record<string, string> = {
  SPOT_MARKET_BUY_FIXED: 'Fixed 0.05 ETH market buy',
  SPOT_SELL_ALL: 'Close the whole position',
  SCALE_IN: 'Scale into an open position',
  PARTIAL_EXIT: 'Partial close at 25 / 50 / 75%',
  STOP_MARKET: 'Protective stop-market trigger',
  CUSTOM_POSITION_SIZE: 'Entry size beyond the fixed ticket',
  RISK_PERCENT_SIZING: 'Stop distance to position size, at a chosen account risk',
  PERP_LONG_2X: 'Historical isolated perpetual long at 1x / 2x',
};

export function CareerScreen({ career, learning, onStartMission }: { career: CareerState; learning?: LearningStateV0; onStartMission?: (missionId: MissionId) => void }) {
  const learningState = learning;
  const qualification = career.qualification.scaleControl;
  const stop = career.qualification.stopLoss;
  const risk = career.qualification.riskSizing;
  const margin = career.qualification.margin2x;
  const recentClean = margin.recentRiskPlannedOutcomes.filter((entry) => entry.outcome === 'RESPECTED').length;

  return (
    <section className="screen career-screen">
      <div className="career-columns">
        <div className="panel">
          <header className="panel-head">
            <h2>CAPABILITIES</h2>
            <span className="panel-note">AUTHORISATION, NOT SCORE</span>
          </header>
          <ul className="skill-list">
            {SKILL_TIERS.map((tier) => {
              const unlocked = career.unlockedSkills.includes(tier.id);
              return (
                <li key={tier.id} className={`skill${unlocked ? ' skill-unlocked' : ' skill-locked'}`}>
                  <div className="skill-head">
                    <span className="skill-name">{tier.id}</span>
                    <span className="skill-state">{unlocked ? 'UNLOCKED' : 'LOCKED'}</span>
                  </div>
                  <p className="skill-blurb">{tier.blurb}</p>
                  <ul className="capability-list">
                    {tier.capabilities.map((capability) => (
                      <li key={capability} className={career.unlockedCapabilities.includes(capability) ? 'cap cap-on' : 'cap cap-off'}>
                        {CAPABILITY_LABEL[capability] ?? capability}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          <p className="panel-foot">SHORT remains locked until the later leveraged-long qualification phase.</p>
        </div>

        <LearningProgressPanel learning={learningState} onStartMission={onStartMission} />

        <div className="career-column-stack">
          <div className="panel">
            <header className="panel-head">
              <h2>SCALE_CONTROL QUALIFICATION</h2>
            </header>
            <dl className="truth-grid">
              <Fact label="CONTROLLED SPOT TRADES" value={`${qualification.closedSpotTrades} / ${qualification.targetClosedSpotTrades}`} />
              <Fact label="TOTAL CLOSED TRADES" value={String(career.stats.closedSpotTrades)} />
              <Fact label="WORST CLOSED LOSS" value={formatBpsPercent(BigInt(qualification.maxClosedLossBps))} note="HISTORY ONLY" />
              <Fact label="EQUITY POSITIVE AT LAST CLOSE" value={qualification.positiveAccountEquity ? 'YES' : 'NO'} />
              <Fact label="QUALIFIED" value={qualification.qualified ? 'YES' : 'NOT YET'} />
            </dl>
            <p className="panel-foot">{career.objective.text}</p>
          </div>

          <div className="panel">
            <header className="panel-head"><h2>STOP_LOSS QUALIFICATION</h2></header>
            <dl className="truth-grid">
              <Fact label="TOTAL CLOSED SPOT TRADES" value={`${stop.totalClosedSpotTrades} / ${stop.targetClosedSpotTrades}`} />
              <Fact label="CONTROLLED LOSS CUTS" value={String(stop.manualLossCuts + stop.protectCapitalChallenges)} />
              <Fact label="EQUITY ≥ 70% START" value={stop.accountEquityAtLeast70Percent ? 'YES' : 'NO'} />
              <Fact label="QUALIFIED" value={stop.qualified ? 'YES' : 'NOT YET'} />
            </dl>
            <p className="panel-foot">{career.objective.text}</p>
          </div>

          <div className="panel">
            <header className="panel-head"><h2>RISK_SIZING QUALIFICATION</h2></header>
            <dl className="truth-grid">
              <Fact label="STOPS PLANNED AT ENTRY" value={`${risk.stopPlannedTrades} / ${risk.targetStopPlannedTrades}`} note="NEVER WIDENED" />
              <Fact label="PARTIAL EXITS USED" value={`${risk.partialExitsUsed} / ${risk.targetPartialExits}`} />
              <Fact label="QUALIFIED" value={risk.qualified ? 'YES' : 'NOT YET'} />
            </dl>
            <p className="panel-foot">{career.objective.text}</p>
          </div>

          <div className="panel">
            <header className="panel-head">
              <h2>MARGIN_2X QUALIFICATION</h2>
              <span className="panel-note">PROCESS BEFORE LEVERAGE</span>
            </header>
            <dl className="truth-grid">
              <Fact label="CLOSED SPOT TRADES" value={`${margin.closedSpotTrades} / ${margin.targetClosedSpotTrades}`} />
              <Fact label="RISK-PLANNED TRADES" value={`${margin.riskPlannedTrades} / ${margin.targetRiskPlannedTrades}`} />
              <Fact label="PARTIAL EXITS" value={`${margin.partialExitsUsed} / ${margin.targetPartialExits}`} />
              <Fact label="RECENT VERIFIED RISK PLANS" value={`${recentClean} / ${margin.targetCleanRecentRiskPlans}`} note="LAST 3 ONLY" />
              <Fact label="CAREER MAX DRAWDOWN" value={margin.maxAccountDrawdownBps === null ? 'UNKNOWN' : formatBpsPercent(BigInt(margin.maxAccountDrawdownBps))} note="LIMIT 20%" />
              <Fact label="BANKROLL RESETS" value={margin.accountResetsUsed === null ? 'UNKNOWN' : String(margin.accountResetsUsed)} note="MUST BE 0" />
              <Fact label="QUALIFIED" value={margin.qualified ? 'YES' : 'NOT YET'} />
            </dl>
            {margin.recentRiskPlannedOutcomes.length > 0 && (
              <p className="panel-foot">RECENT // {margin.recentRiskPlannedOutcomes.map((entry) => entry.outcome).join(' · ')}</p>
            )}
            <p className="panel-foot">{career.objective.text}</p>
          </div>

          <div className="panel">
            <header className="panel-head">
              <h2>BEHAVIOUR</h2>
              <span className="panel-note">FROM SIMULATOR RECEIPTS ONLY</span>
            </header>
            <dl className="truth-grid">
              <Fact label="SCALE-INS USED" value={String(career.stats.scaleInsUsed)} />
              <Fact label="PARTIAL EXITS USED" value={String(career.stats.partialExitsUsed)} />
              <Fact label="RISK PLANS SET" value={String(career.stats.riskPlansCreated)} />
              <Fact label="RISK BUDGETS RESPECTED" value={String(career.stats.riskBudgetsRespected)} />
              <Fact label="RISK BUDGETS VIOLATED" value={String(career.stats.riskBudgetViolations)} note="HISTORY ONLY" />
              <Fact label="BANKROLL RESETS" value={career.stats.accountResetsUsed === null ? 'UNKNOWN' : String(career.stats.accountResetsUsed)} />
            </dl>
          </div>

          <div className="panel">
            <header className="panel-head">
              <h2>RECEIPTS</h2>
              <span className="panel-note">COSMETIC</span>
            </header>
            <ul className="receipt-list">
              {PHASE_0_RECEIPTS.map((receipt) => {
                const count = career.receipts[receipt.id] ?? 0;
                return (
                  <li key={receipt.id} className={count > 0 ? 'receipt receipt-on' : 'receipt receipt-off'}>
                    <span>{receipt.name}</span>
                    <span className="receipt-meta">{receipt.rarity} {count > 0 ? `· ×${count}` : '· NOT AWARDED'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {career.unlockedSkills.includes('MARGIN_2X') && <MarginTrainingScreen />}
    </section>
  );
}

function LearningProgressPanel({ learning, onStartMission }: { learning?: LearningStateV0; onStartMission?: (missionId: MissionId) => void }) {
  const completed = new Set(learning?.completed.map((entry) => entry.missionId) ?? []);
  const next = learning ? nextMissionId(learning) : null;
  return (
    <div className="panel learning-progress-panel">
      <header className="panel-head">
        <h2>LEARNING MISSIONS</h2>
        <span className="panel-note">COMPETENCE · NOT MASTERY</span>
      </header>
      <p className="panel-foot learning-boundary">Five deterministic terminal drills. Synthetic training evidence never grants Career capabilities or proves mastery.</p>
      <ol className="learning-list">
        {MISSION_IDS.map((id) => (
          <li key={id} className={completed.has(id) ? 'learning-item learning-item-done' : id === next ? 'learning-item learning-item-next' : 'learning-item'}>
            <div><span className="learning-id">{id}</span><span>{MISSION_DEFINITIONS[id].title.replace(`${id} — `, '')}</span></div>
            <span className="learning-status">{completed.has(id) ? 'PASSED' : id === next ? 'READY' : 'LOCKED'}</span>
          </li>
        ))}
      </ol>
      {next && onStartMission ? <button type="button" className="learning-cta" onClick={() => onStartMission(next)}>OPEN {next} IN TERMINAL →</button> : <p className="learning-complete">ALL FIVE MISSIONS PASSED · TRANSFER EXAM NOT INCLUDED</p>}
    </div>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="figure">
      <dt>
        {label}
        {note && <span className="figure-note">{note}</span>}
      </dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
