import {useEffect, useMemo, useRef, useState} from 'react';
import {useInstrumentNavigation, type InstrumentMode} from '../shell/InstrumentNavigation';
import './rekt-guide.css';

type GuideItem = {
  id: string;
  label: string;
  keywords: string;
  description: string;
  mode?: InstrumentMode;
  targetId?: string;
};

const GUIDE_ITEMS: GuideItem[] = [
  {
    id: 'next-move',
    label: 'What should I do next?',
    keywords: 'next move what now task command focus todo',
    description: 'Open COMMAND and follow the canonical Next Move. Inkubator does not invent a second priority in the guide.',
    mode: 'COMMAND',
  },
  {
    id: 'connect-repository',
    label: 'Connect repository',
    keywords: 'connect repository repo github source access link',
    description: 'Open COMMAND → Source / repository access. GitHub access and the Mission source stay separate on purpose.',
    mode: 'COMMAND',
    targetId: 'command-source-control',
  },
  {
    id: 'update-work',
    label: 'Update work',
    keywords: 'update work focus blocker state next move edit mission',
    description: 'Open COMMAND → Edit work. This changes your declared Mission state; it does not create observation or proof.',
    mode: 'COMMAND',
    targetId: 'command-work-control',
  },
  {
    id: 'ask-help',
    label: 'Ask for help',
    keywords: 'help stuck blocker beacon assist ask human',
    description: 'Open COMMAND → Help. Use the existing Help Beacon when you are blocked or need another builder.',
    mode: 'COMMAND',
    targetId: 'command-help-control',
  },
  {
    id: 'request-test',
    label: 'Request a test',
    keywords: 'test qa verify verifier external testing request',
    description: 'Open COMMAND → Request test. Testing remains an existing Inkubator workflow; the guide only routes you to it.',
    mode: 'COMMAND',
    targetId: 'command-test-control',
  },
  {
    id: 'ship',
    label: 'Open Ship',
    keywords: 'ship launch submit artifact receipt ready',
    description: 'Open SHIP to submit and inspect the artifact path. Acceptance and proof still come from the canonical Ship workflow.',
    mode: 'SHIP',
  },
  {
    id: 'project',
    label: 'Inspect Project',
    keywords: 'project build evidence collaborators source history',
    description: 'PROJECT is the detailed build record: source, evidence, collaborators, tests and blockers.',
    mode: 'PROJECT',
  },
  {
    id: 'world',
    label: 'Explore World',
    keywords: 'world discover public projects signals people help',
    description: 'WORLD is the public signal surface for discovering projects, people and help activity.',
    mode: 'WORLD',
  },
  {
    id: 'player',
    label: 'Open Player',
    keywords: 'player history reputation cheevos identity record',
    description: 'PLAYER is your durable builder record: what you shipped, tested and helped build.',
    mode: 'PLAYER',
  },
  {
    id: 'where-build',
    label: 'Where do I build?',
    keywords: 'where code editor repo coding agent vscode build',
    description: 'Build in your normal repository, editor or coding agent. Inkubator tracks the Mission, evidence, help, testing and Ship around that work.',
  },
  {
    id: 'truth-states',
    label: 'CLAIMED / OBSERVED / PROVEN',
    keywords: 'claimed observed proven truth evidence status meaning',
    description: 'CLAIMED is what someone says. OBSERVED is what Inkubator actually saw. PROVEN is reserved for evidence that satisfies the relevant proof rule.',
  },
];

function revealTarget(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return false;
  const parentDetails = target.closest('details.command-lite-control-drawer');
  if (parentDetails instanceof HTMLDetailsElement) parentDetails.open = true;
  if (target instanceof HTMLDetailsElement) target.open = true;
  target.scrollIntoView({behavior: 'smooth', block: 'start'});
  return true;
}

export function RektGuide({currentMode}: {currentMode: InstrumentMode}) {
  const navigation = useInstrumentNavigation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('next-move');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return GUIDE_ITEMS.slice(0, 6);
    return GUIDE_ITEMS.filter((item) => `${item.label} ${item.keywords} ${item.description}`.toLowerCase().includes(needle)).slice(0, 7);
  }, [query]);

  const selected = GUIDE_ITEMS.find((item) => item.id === selectedId) ?? GUIDE_ITEMS[0];

  function activate(item: GuideItem) {
    setSelectedId(item.id);
    if (item.mode && item.mode !== currentMode) navigation?.onModeSelect(item.mode);
    if (!item.targetId) return;
    if (revealTarget(item.targetId)) return;
    window.setTimeout(() => {
      if (revealTarget(item.targetId!)) return;
      window.setTimeout(() => revealTarget(item.targetId!), 240);
    }, 80);
  }

  return <div className="rekt-guide-root" data-open={open ? 'true' : 'false'}>
    {open ? <aside id="rekt-guide-panel" className="rekt-guide-panel" role="dialog" aria-modal="false" aria-labelledby="rekt-guide-title">
      <header>
        <div><small>INKUBATOR / NAV + HELP</small><h2 id="rekt-guide-title">REKT GUIDE</h2></div>
        <button type="button" className="rekt-guide-close" onClick={() => setOpen(false)} aria-label="Close REKT Guide">×</button>
      </header>
      <label className="rekt-guide-search">
        <span>SEARCH</span>
        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Help, test, repo, ship, truth…" aria-label="Search REKT Guide" />
      </label>
      <div className="rekt-guide-results" aria-label="Guide results">
        {results.length ? results.map((item) => <button type="button" key={item.id} data-selected={selectedId === item.id ? 'true' : 'false'} onClick={() => activate(item)}>
          <span>{item.label}</span><small>{item.mode ? `OPEN ${item.mode}` : 'EXPLAIN'}</small>
        </button>) : <p>No guide result. Try “help”, “repo”, “test” or “ship”.</p>}
      </div>
      <div className="rekt-guide-answer" aria-live="polite">
        <small>GUIDE / {selected.mode ?? 'EXPLAIN'}</small>
        <strong>{selected.label}</strong>
        <p>{selected.description}</p>
      </div>
    </aside> : null}
    <button type="button" className="rekt-guide-launcher" aria-expanded={open} aria-controls="rekt-guide-panel" aria-label={open ? 'Close REKT Guide' : 'Open REKT Guide'} onClick={() => setOpen((value) => !value)}>
      <img src="/assets/rekt-mascot.png" alt="" draggable={false} loading="lazy" />
      <span>GUIDE</span>
    </button>
  </div>;
}

export default RektGuide;
