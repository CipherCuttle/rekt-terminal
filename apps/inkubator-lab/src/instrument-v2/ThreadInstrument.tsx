import {useRef, type KeyboardEvent} from 'react';
import {useGSAP} from '@gsap/react';
import gsap from 'gsap';
import {DisplayWell, PrintedHeader, TruthLabel} from './primitives';
import {formatEventDate, SCENARIO_COPY, type HistoryEvent, type HistoryScenario} from './history-fixture';

gsap.registerPlugin(useGSAP);

export function ProvenanceInspector({event, mobile = false}: {event: HistoryEvent; mobile?: boolean}) {
  const id = `inspector-${mobile ? 'mobile' : 'desktop'}-${event.id}`;
  function openOwner() {
    const details = document.querySelector<HTMLDetailsElement>('.iv2-owner-context');
    if (details) details.open = true;
  }
  return <section className={`iv2-inspector ${mobile ? 'iv2-inspector-mobile' : ''}`} aria-labelledby={id}>
    <div className="iv2-inspector-index iv2-micro">SELECTED RECORD <span>↙</span></div>
    <TruthLabel truth={event.truth} />
    <h3 id={id}>{event.title}</h3>
    <p className="iv2-context">{event.context}</p>
    <dl className="iv2-provenance">
      <div><dt>RECORDED / UTC</dt><dd><time dateTime={event.at}>{formatEventDate(event.at)} {event.at.slice(0, 4)} · {event.at.slice(11, 19)}</time></dd></div>
      <div><dt>SOURCE</dt><dd>{event.source}</dd></div>
      <div><dt>REFERENCE</dt><dd><code>{event.reference}</code></dd></div>
      <div><dt>OWNING SURFACE</dt><dd><a href={`#owner-${event.owner.toLowerCase()}`} onClick={openOwner}>{event.owner} context <span aria-hidden="true">↗</span></a></dd></div>
    </dl>
    {event.evidence && <details className="iv2-evidence-detail"><summary>Supporting references <span>{event.evidence.length.toString().padStart(2, '0')}</span></summary><dl>{event.evidence.map(item => <div key={item.reference}><dt>{item.label}</dt><dd>{item.reference}</dd></div>)}</dl></details>}
    <p className="iv2-boundary"><span className="iv2-micro">READ THIS AS</span>{event.boundary}</p>
    <span className="iv2-inspector-foot iv2-micro">CALIBRATION EVIDENCE / NOT A LIVE RECORD</span>
  </section>;
}

export function ThreadInstrument({events, selectedId, onSelect, scenario}: {events: readonly HistoryEvent[]; selectedId: string; onSelect: (id: string) => void; scenario: HistoryScenario}) {
  const root = useRef<HTMLElement>(null);
  const previousSelection = useRef(selectedId);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const selected = events.find(event => event.id === selectedId);
  useGSAP(() => {
    if (previousSelection.current === selectedId) return;
    previousSelection.current = selectedId;
    // REACTIVE only: selecting a different record. No hydration, timer or proof ceremony.
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.iv2-inspector h3', {opacity: .45, x: 3}, {opacity: 1, x: 0, duration: .16, ease: 'power1.out'});
    });
    return () => media.revert();
  }, {scope: root, dependencies: [selectedId], revertOnUpdate: true});
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowDown') next = Math.min(index + 1, events.length - 1);
    else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = events.length - 1;
    else return;
    event.preventDefault();
    onSelect(events[next].id);
    refs.current.get(events[next].id)?.focus();
  }
  return <section ref={root} id="builder-record" className="iv2-record-section" aria-label="Builder history instrument">
    <PrintedHeader number="01" title="THE BUILDER RECORD" detail="SELECT A RECORD TO INSPECT" />
    <div className="iv2-record-grid">
      <DisplayWell label="Chronological builder history" className="iv2-history">
        <header className="iv2-history-head"><div><span className="iv2-micro">CAREER THREAD / FIXTURE 01</span><h2>Build history<span aria-hidden="true">_</span></h2></div><span className="iv2-history-count">{events.length.toString().padStart(2, '0')}<small>RECORDS</small></span></header>
        <div className="iv2-history-ruler iv2-micro"><span>SEP 2026 / UTC</span><span>OLDEST → NEWEST</span></div>
        {scenario !== 'record' && <div className="iv2-record-message" data-condition={scenario} role="status"><strong>{SCENARIO_COPY[scenario].title}</strong><p>{SCENARIO_COPY[scenario].detail}</p></div>}
        <ol className="iv2-event-list" aria-label="Recorded events">
          {events.map((event, index) => <li key={event.id} data-selected={event.id === selectedId}>
            <button type="button" className="iv2-event" aria-pressed={event.id === selectedId}
              ref={node => {if (node) refs.current.set(event.id, node); else refs.current.delete(event.id);}}
              onClick={() => onSelect(event.id)} onKeyDown={key => navigate(key, index)}>
              <time dateTime={event.at}>{formatEventDate(event.at)}<small>{event.at.slice(11, 16)}</small></time>
              <span className="iv2-thread-node" data-truth={event.truth} aria-hidden="true"><i /></span>
              <span className="iv2-event-copy"><strong>{event.title}</strong><small>{event.owner} / FIELD NOTES</small></span>
              <TruthLabel truth={event.truth} /><span className="iv2-event-arrow" aria-hidden="true">↗</span>
            </button>
            {event.id === selectedId && <ProvenanceInspector event={event} mobile />}
          </li>)}
        </ol>
        <footer className="iv2-history-foot iv2-micro"><span>SEQUENCE, NOT A PROGRESS SCORE</span><span>↑ ↓ TO SELECT</span></footer>
      </DisplayWell>
      <div className="iv2-inspector-desktop">{selected ? <ProvenanceInspector event={selected} /> : <div className="iv2-inspector-empty"><span className="iv2-micro">PROVENANCE INSPECTOR</span><h3>No record selected.</h3><p>Context appears when a supported history record is available.</p></div>}</div>
    </div>
    <p className="iv2-sr-only" role="status">{selected ? `Selected ${selected.title}. ${selected.truth}. Source: ${selected.source}. Calibration fixture.` : 'No supported record selected.'}</p>
  </section>;
}
