import type {ReactNode} from 'react';
import {worldCompositionFixtures, worldScenarioLabels, worldVariantLabels} from './world-composition-fixtures';
import type {WorldCompositionScenario, WorldCompositionVariant, WorldEvent} from './world-composition-types';
import './world-composition-lab.css';

export type WorldCompositionLabProps = {
  variant?: WorldCompositionVariant;
  scenario?: WorldCompositionScenario;
};

const kindLabels: Record<WorldEvent['kind'], string> = {
  HELP_BEACON_OPENED: 'HELP BEACON OPENED',
  ASSIST_ACCEPTED: 'ASSIST ACCEPTED',
  EXTERNAL_TEST_RECORDED: 'EXTERNAL TEST RECORDED',
};

const truthLabels: Record<WorldEvent['truthState'], string> = {
  CLAIMED: 'CLAIMED',
  OBSERVED: 'OBSERVED',
};

const truthNotes: Record<WorldEvent['truthState'], string> = {
  CLAIMED: 'Public request / not proof',
  OBSERVED: 'Public observation / not proof',
};

function EventRow({event, featured = false}: {event: WorldEvent; featured?: boolean}) {
  return (
    <li
      className={`world-lab-event${featured ? ' world-lab-event--featured' : ''}`}
      data-event-id={event.id}
      data-truth={event.truthState}
      data-kind={event.kind}
    >
      <div className="world-lab-event__index" aria-hidden="true">{event.id.slice(-2)}</div>
      <div className="world-lab-event__signal" data-truth={event.truthState} aria-hidden="true">
        <span />
      </div>
      <div className="world-lab-event__body">
        <div className="world-lab-event__meta">
          <span>{kindLabels[event.kind]}</span>
          <time dateTime={event.occurredAt}>{event.recency}</time>
        </div>
        <div className="world-lab-event__title-row">
          <h3>{event.projectName}</h3>
          <span className="world-lab-truth" data-truth={event.truthState}>
            <span className="world-lab-truth__glyph" aria-hidden="true">{event.truthState === 'CLAIMED' ? '//' : '::'}</span>
            {truthLabels[event.truthState]}
          </span>
        </div>
        <p>{event.detail}</p>
        <span className="world-lab-event__truth-note">{truthNotes[event.truthState]}</span>
      </div>
    </li>
  );
}

function EventList({events, label}: {events: WorldEvent[]; label: string}) {
  return (
    <ol className="world-lab-event-list" aria-label={label}>
      {events.map((event) => <EventRow key={event.id} event={event} />)}
    </ol>
  );
}

function TopologyFrame({label, description, children}: {label: string; description: string; children: ReactNode}) {
  return (
    <section className="world-lab-topology" aria-label={label}>
      <div className="world-lab-topology__header">
        <div>
          <span className="world-lab-kicker">{label}</span>
          <h2>{description}</h2>
        </div>
        <span className="world-lab-topology__rule" aria-hidden="true">PUBLIC TIME / ORDERED</span>
      </div>
      {children}
    </section>
  );
}

function SignalTape({events}: {events: WorldEvent[]}) {
  return (
    <TopologyFrame label="SIGNAL TAPE" description="Public activity, in time order">
      <div className="world-lab-tape-note">
        <span>READING ORDER</span>
        <strong>NEWEST ↓ OLDEST</strong>
        <span>NO SPATIAL CLAIMS</span>
      </div>
      <EventList events={events} label="Signal tape events" />
    </TopologyFrame>
  );
}

function DispatchTape({events}: {events: WorldEvent[]}) {
  const [latest, ...history] = events;
  return (
    <TopologyFrame label="NOW + SIGNAL TAPE" description="One current intercept, then the public tape">
      <div className="world-lab-dispatch-now">
        <div className="world-lab-dispatch-now__label">
          <span className="world-lab-kicker">CURRENT / LATEST EVENT</span>
          <span className="world-lab-dispatch-now__marker" data-kind={latest.kind} aria-hidden="true">NOW</span>
        </div>
        <ol className="world-lab-featured-list" aria-label="Latest signal">
          <EventRow event={latest} featured />
        </ol>
      </div>
      <div className="world-lab-history-heading">
        <span className="world-lab-kicker">RECENT HISTORY</span>
        <span>{history.length} PRIOR PUBLIC EVENTS</span>
      </div>
      <EventList events={history} label="Signal tape history" />
    </TopologyFrame>
  );
}

function ReceiverTape({events}: {events: WorldEvent[]}) {
  const [latest, ...history] = events;
  return (
    <TopologyFrame label="RECEIVER + SIGNAL TAPE" description="A receiving area for the latest public signal">
      <div className="world-lab-receiver">
        <div className="world-lab-receiver__plate" aria-hidden="true">
          <span className="world-lab-receiver__plate-label">RX / PUBLIC INPUT</span>
          <strong>RECEIVER</strong>
          <span className="world-lab-receiver__plate-readout">LATEST SIGNAL<br />{latest.recency}</span>
        </div>
        <div className="world-lab-receiver__event">
          <span className="world-lab-kicker" data-kind={latest.kind}>CURRENT INPUT / NO SPATIAL MEANING</span>
          <ol className="world-lab-featured-list" aria-label="Latest received signal">
            <EventRow event={latest} featured />
          </ol>
        </div>
      </div>
      <div className="world-lab-history-heading">
        <span className="world-lab-kicker">STABLE HISTORY</span>
        <span>{history.length} PRIOR PUBLIC EVENTS</span>
      </div>
      <EventList events={history} label="Receiver signal tape history" />
    </TopologyFrame>
  );
}

export default function WorldCompositionLab({variant = 'tape', scenario = 'normal'}: WorldCompositionLabProps) {
  const events = worldCompositionFixtures[scenario];
  const latest = events[0];

  return (
    <main
      className="world-composition-lab"
      data-world-composition-lab
      data-variant={variant}
      data-scenario={scenario}
      data-motion="off"
      data-crt="off"
    >
      <div className="world-lab-shell">
        <header className="world-lab-masthead">
          <div className="world-lab-brand">
            <span>REKT INK(CUBATOR)</span>
            <b>WORLD / COMPOSITION LAB V1</b>
          </div>
          <div className="world-lab-masthead__status">
            <span>STATIC COMPARISON</span>
            <strong>TRUTHFUL PUBLIC PROJECTION</strong>
          </div>
        </header>

        <section className="world-lab-intro" aria-labelledby="world-lab-title">
          <div>
            <span className="world-lab-kicker">WORLD / PERIPHERAL PUBLIC AWARENESS</span>
            <h1 id="world-lab-title">What is happening around me?</h1>
            <p>Three topology candidates share one truthful temporal backbone. This isolated fixture is for choosing information topology, not animation or production authority.</p>
          </div>
          <dl className="world-lab-readout">
            <div><dt>VARIANT</dt><dd>{worldVariantLabels[variant]}</dd></div>
            <div><dt>SCENARIO</dt><dd>{worldScenarioLabels[scenario]}</dd></div>
            <div><dt>EVENTS</dt><dd>{String(events.length).padStart(2, '0')}</dd></div>
            <div><dt>LATEST</dt><dd>{latest.truthState}</dd></div>
          </dl>
        </section>

        <div className="world-lab-lawbar" role="note">
          <span>ALLOWED WORLD EVENTS</span>
          <strong>HELP_BEACON_OPENED → CLAIMED</strong>
          <strong>ASSIST_ACCEPTED → OBSERVED</strong>
          <strong>EXTERNAL_TEST_RECORDED → OBSERVED</strong>
          <span>ACID GREEN / PROVEN ONLY / NOT PRESENT</span>
        </div>

        {variant === 'tape' ? <SignalTape events={events} /> : variant === 'dispatch' ? <DispatchTape events={events} /> : <ReceiverTape events={events} />}

        <footer className="world-lab-footer">
          <span>DEVELOPMENT FIXTURE / NOT LIVE DATA</span>
          <span>COMPOSITIONAL GEOMETRY ONLY / NO RADAR / NO MOTION</span>
        </footer>
      </div>
    </main>
  );
}

export {EventRow};
