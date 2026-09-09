import {useState} from 'react';
import {ReferenceOverlay} from './ReferenceOverlay';
import {RektMascot} from './RektMascot';
import {PrintedHeader, TruthLabel} from './primitives';
import {ThreadInstrument} from './ThreadInstrument';
import {HISTORY_FIXTURE, type HistoryScenario} from './history-fixture';
import './instrument-v2.css';

function ModeNavigation({mobile = false}: {mobile?: boolean}) {
  return <nav className={mobile ? 'iv2-mobile-modes' : 'iv2-mode-rail'} aria-label={mobile ? 'Mobile record sections' : 'Record sections'}>
    <a href="#player" aria-current="page"><span>01</span><b>PLAYER</b><small>BUILDER DOSSIER</small></a>
    <a href="#builder-record"><span>02</span><b>HISTORY</b><small>THE RECORD</small></a>
    <a href="#earned-evidence"><span>03</span><b>EARNED</b><small>WITH EVIDENCE</small></a>
    {!mobile && <div className="iv2-rail-imprint"><span className="iv2-registration" aria-hidden="true" /><p>SAME<br />DEGENS.<br /><b>HIGHER<br />PURPOSE.</b></p><span className="iv2-micro">REKT / INKUBATOR<br />INSTRUMENT SERIES V2</span></div>}
  </nav>;
}

export default function InstrumentV2Lab() {
  const [selectedId, setSelectedId] = useState('work');
  const [scenario, setScenario] = useState<HistoryScenario>('record');
  const [crt, setCrt] = useState(true);
  const hasRecord = scenario === 'record' || scenario === 'stale';
  const events = hasRecord ? HISTORY_FIXTURE : [];
  function selectEarned(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('.iv2-event[aria-pressed="true"]')?.focus();
    });
  }
  return <main className="iv2-page" data-crt={crt ? 'on' : 'off'}>
    <a href="#builder-record" className="iv2-skip">Skip to builder history</a>
    <div className="iv2-reference-stage iv2-machine">
      <header className="iv2-topbar"><a className="iv2-brand" href="?lab=instrument-v2" aria-label="REKT Inkubator calibration"><strong>REKT<span>//</span></strong><span>INKUBATOR</span></a><span className="iv2-topbar-purpose iv2-micro">A RECORD OF THINGS<br />BUILT & SHIPPED.</span><div className="iv2-calibration-label"><i aria-hidden="true" />CALIBRATION FIXTURE<span>NO LIVE DATA</span></div></header>
      <div className="iv2-layout"><ModeNavigation /><div className="iv2-workspace">
        <section id="player" className="iv2-player-header" aria-labelledby="player-title">
          <div className="iv2-player-title"><span className="iv2-micro">PLAYER / THE DURABLE RECORD</span><h1 id="player-title">Builder history<span>.</span></h1><p>What was declared. What was observed. What was earned.</p></div>
          <div className="iv2-identity"><RektMascot /><div><span className="iv2-micro">EXAMPLE BUILDER</span><h2>ink.operator</h2><span className="iv2-identity-project">FIELD NOTES <span>/ PUBLIC TOOL ARCHIVE</span></span></div><p>One project, from first intention<br />to accepted artifact.</p></div>
          <span className="iv2-registration iv2-header-registration" aria-hidden="true" />
        </section>
        <div className="iv2-calibration-controls"><p><b>FIXTURE 01</b><span> Illustrative history. No real builder activity or awards.</span></p><label>SCENARIO<select value={scenario} onChange={event => setScenario(event.target.value as HistoryScenario)}><option value="record">Recorded history</option><option value="empty">Empty history</option><option value="stale">Stale snapshot</option><option value="unavailable">Unavailable source</option><option value="unsupported">Unsupported format</option></select></label><button type="button" aria-pressed={crt} onClick={() => setCrt(value => !value)}>CRT <span>{crt ? 'ON' : 'OFF'}</span></button></div>
        <ThreadInstrument events={events} selectedId={selectedId} onSelect={setSelectedId} scenario={scenario} />
        <section id="earned-evidence" className="iv2-earned" aria-label="Earned evidence">
          <PrintedHeader number="02" title="EARNED, WITH EVIDENCE" detail={scenario === 'stale' ? 'STALE FIXTURE SNAPSHOT' : 'CALIBRATION EXAMPLES'} />
          {hasRecord ? <div className="iv2-earned-grid"><button type="button" onClick={() => selectEarned('ship')}><span className="iv2-earned-mark" aria-hidden="true">↗</span><div><span className="iv2-micro">ACCEPTED ARTIFACT</span><strong>Field Notes</strong><span className="iv2-earned-ref">fixture:receipt-01</span></div><TruthLabel truth="PROVEN" /><span aria-hidden="true">→</span></button><button type="button" onClick={() => selectEarned('cheevo')}><span className="iv2-earned-mark" aria-hidden="true">✳</span><div><span className="iv2-micro">CHEEVO / AWARD EXAMPLE</span><strong>Working URL or GTFO</strong><span className="iv2-earned-ref">fixture:cheevo-01</span></div><TruthLabel truth="PROVEN" /><span aria-hidden="true">→</span></button></div> : <p className="iv2-earned-empty">{scenario === 'empty' ? 'No earned evidence recorded.' : 'Earned evidence is unavailable in this scenario.'}</p>}
        </section>
        <details className="iv2-owner-context"><summary>Surface ownership & calibration boundary <span>+</span></summary><p>Links in the inspector lead to the owning surface’s purpose below. This example does not connect a fictional project to your production account.</p><dl><div id="owner-command"><dt>COMMAND</dt><dd>Mission and gate continuity. What should I do now?</dd></div><div id="owner-project"><dt>PROJECT</dt><dd>Project locus and supported provenance. What is happening to this build?</dd></div><div id="owner-ship"><dt>SHIP</dt><dd>Submission, observation, acceptance and receipt. What was actually accepted?</dd></div><div id="owner-player"><dt>PLAYER</dt><dd>Durable builder history and evidence-linked recognition. What did this builder do and earn?</dd></div></dl></details>
        <footer className="iv2-footer"><strong>CLAIMED ≠ OBSERVED ≠ PROVEN</strong><span className="iv2-micro">REKT INKUBATOR / BUILD SOMETHING THAT REMAINS.</span></footer>
      </div></div><ModeNavigation mobile /><ReferenceOverlay />
    </div>
  </main>;
}
