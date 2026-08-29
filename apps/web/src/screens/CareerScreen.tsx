import { PHASE_0_RECEIPTS, type CapabilityId, type CareerState, type SkillId } from '@rekt-ink/career';
import { formatBpsPercent } from '../practice/format';

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
];

const CAPABILITY_LABEL: Record<string, string> = {
  SPOT_MARKET_BUY_FIXED: 'Fixed 0.05 ETH market buy',
  SPOT_SELL_ALL: 'Close the whole position',
  SCALE_IN: 'Scale into an open position',
  PARTIAL_EXIT: 'Partial close at 25 / 50 / 75%',
  STOP_MARKET: 'Protective stop-market trigger',
  CUSTOM_POSITION_SIZE: 'Entry size beyond the fixed ticket',
  RISK_PERCENT_SIZING: 'Stop distance to position size, at a chosen account risk',
};

export function CareerScreen({ career }: { career: CareerState }) {
  const qualification = career.qualification.scaleControl;
  const stop = career.qualification.stopLoss;
  const risk = career.qualification.riskSizing;

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
          <p className="panel-foot">Later tiers (MARGIN_2X, SHORT) are not part of this build.</p>
        </div>

        <div className="career-column-stack">
          <div className="panel">
            <header className="panel-head">
              <h2>SCALE_CONTROL QUALIFICATION</h2>
            </header>
            <dl className="truth-grid">
              <Fact label="CONTROLLED SPOT TRADES" value={`${qualification.closedSpotTrades} / ${qualification.targetClosedSpotTrades}`} />
              <Fact label="TOTAL CLOSED TRADES" value={String(career.stats.closedSpotTrades)} />
              <Fact
                label="WORST CLOSED LOSS"
                value={formatBpsPercent(BigInt(qualification.maxClosedLossBps))}
                note="HISTORY ONLY"
              />
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
              <Fact
                label="STOPS PLANNED AT ENTRY"
                value={`${risk.stopPlannedTrades} / ${risk.targetStopPlannedTrades}`}
                note="NEVER WIDENED"
              />
              <Fact label="PARTIAL EXITS USED" value={`${risk.partialExitsUsed} / ${risk.targetPartialExits}`} />
              <Fact label="QUALIFIED" value={risk.qualified ? 'YES' : 'NOT YET'} />
            </dl>
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
              <Fact
                label="RISK BUDGETS VIOLATED"
                value={String(career.stats.riskBudgetViolations)}
                note="HISTORY ONLY"
              />
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
                    <span className="receipt-meta">
                      {receipt.rarity} {count > 0 ? `· ×${count}` : '· NOT AWARDED'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
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
