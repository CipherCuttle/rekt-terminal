import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {
  createInkubatorApiClient,
  type BuildContractPreviewAuthorityInput,
  type BuildContractPreviewView,
  type CompilerInputProvenance,
  type CompilerProposalInput,
  type CompilerStateView,
  type PublicChallengeView,
} from '../inkubator-api';
import {
  CHALLENGE_SURFACES,
  SURFACE_CUES,
  SURFACE_LABELS,
  parseChallengeSurface,
  type ChallengeSurface,
  type SurfaceState,
} from './state';
import './challenge-product.css';
import './compiler-stage-e.css';

const STATE_COPY: Record<SurfaceState, string> = {
  NORMAL: 'LIVE / SOURCE-BOUND',
  LOADING: 'LOADING / NO FABRICATION',
  EMPTY: 'EMPTY / NO CANONICAL DATA',
  ERROR: 'ERROR / LAST TRUSTWORTHY VALUE ONLY',
  UNAVAILABLE_OR_STALE: 'UNAVAILABLE / DO NOT SUBSTITUTE LEGACY DATA',
  UNAUTHORIZED: 'UNAUTHORIZED / FAIL CLOSED',
};

const REQUIREMENTS = [
  ['accounts', 'USER ACCOUNTS', 'Does the software require end-user identity/accounts?'],
  ['persistence', 'DURABLE STATE', 'Must server-side mutable state survive restarts?'],
  ['uploads_private', 'PRIVATE UPLOADS', 'Will users upload non-public files or objects?'],
  ['realtime', 'REALTIME', 'Must clients share synchronized live state?'],
  ['notifications', 'NOTIFICATIONS', 'Must the product deliver notifications outside the active view?'],
  ['onchain_read', 'ONCHAIN READ', 'Must the product read blockchain state?'],
  ['wallet_transactions', 'WALLET TRANSACTIONS', 'Must users create transaction intents for an external wallet?'],
  ['custody_private_keys', 'PRIVATE-KEY CUSTODY', 'Would the product itself hold or sign with private keys?'],
  ['traffic_100x', '100× TRAFFIC', 'Is a 100× traffic/concurrency envelope required?'],
  ['mutable_private_dependencies', 'PRIVATE DEPENDENCIES', 'Does correctness depend on mutable/private external code or data?'],
  ['vague_consulting_scope', 'SUBJECTIVE SCOPE', 'Is success currently subjective effort rather than an observable software outcome?'],
] as const;

type RequirementAnswer = 'UNKNOWN' | 'YES' | 'NO';
export type CompilerRequirementAnswers = Record<(typeof REQUIREMENTS)[number][0], RequirementAnswer>;

function emptyRequirementAnswers(): CompilerRequirementAnswers {
  return Object.fromEntries(REQUIREMENTS.map(([key]) => [key, 'UNKNOWN'])) as CompilerRequirementAnswers;
}

export function buildCompilerProposal(
  sourceIntent: string,
  answers: CompilerRequirementAnswers,
  provenance: CompilerInputProvenance = 'SOURCE',
): CompilerProposalInput {
  return {
    schema_version: 'inkubator.compiler-proposal/1.0',
    source_intent: sourceIntent.trim(),
    requirements: REQUIREMENTS.flatMap(([key]) => {
      const answer = answers[key];
      if (answer === 'UNKNOWN') return [];
      return [{key, value: answer === 'YES', provenance}];
    }),
    knowledge: [],
    outcome_criteria: [],
    delivery_criteria: [],
    preferences: {},
  };
}

export interface ChallengeProductApi {
  compileChallenge(body: CompilerProposalInput): Promise<CompilerStateView>;
  getChallenge(challengeId: string): Promise<PublicChallengeView>;
  previewBuildContract(
    challengeId: string,
    compilerState: CompilerStateView,
    authority: BuildContractPreviewAuthorityInput,
  ): Promise<BuildContractPreviewView>;
}

const DEFAULT_PRODUCT_API: ChallengeProductApi = createInkubatorApiClient();

function surfaceFromLocation(fallback: ChallengeSurface): ChallengeSurface {
  return parseChallengeSurface(new URLSearchParams(window.location.search).get('surface')) ?? fallback;
}

function StatePanel({state, title, children}: {state: SurfaceState; title: string; children: ReactNode}) {
  return (
    <section className="challenge-state" data-surface-state={state.toLowerCase()} aria-live={state === 'ERROR' ? 'assertive' : 'polite'}>
      <div className="challenge-state__status"><span aria-hidden="true" />{STATE_COPY[state]}</div>
      <h2>{title}</h2>
      <div className="challenge-state__body">{children}</div>
    </section>
  );
}

function DiscoverSurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Challenge discovery transport is not exposed yet.">
      <p>The forward product will list Challenge-first opportunities here. Historical World, Project and social discovery routes are intentionally not substituted.</p>
      <p className="challenge-state__foot">NEXT SOURCE: canonical Challenge discovery projection.</p>
    </StatePanel>
  );
}

function CompilerReadout({compilerState}: {compilerState: CompilerStateView}) {
  const selected = compilerState.selected_blueprint;
  const knowledgeCounts = compilerState.knowledge.reduce(
    (counts, item) => ({...counts, [item.kind]: counts[item.kind] + 1}),
    {KNOWN: 0, ASSUMED: 0, UNKNOWN: 0},
  );

  return (
    <div className="compiler-machine" data-compiler-status={compilerState.status.toLowerCase()}>
      <div className="compiler-machine__readout" aria-label="Deterministic compiler readout">
        <span>READINESS<b>{compilerState.status}</b></span>
        <span>BLUEPRINT<b>{selected ? `${selected.id}@${selected.version}` : 'UNRESOLVED'}</b></span>
        <span>RISK<b>{compilerState.risk_profile.level}</b></span>
        <span>QUALITY<b>{compilerState.quality_profile.level}</b></span>
      </div>

      <section className="compiler-machine__section">
        <h3>INPUT AUTHORITY</h3>
        {compilerState.requirements.length ? (
          <ul>{compilerState.requirements.map((requirement) => <li key={requirement.key}><code>{requirement.key}</code> = {String(requirement.value)} <small>{requirement.provenance}</small></li>)}</ul>
        ) : <p>No explicit structured inputs yet.</p>}
      </section>

      <section className="compiler-machine__section">
        <h3>KNOWN / ASSUMED / UNKNOWN</h3>
        <p>{knowledgeCounts.KNOWN} / {knowledgeCounts.ASSUMED} / {knowledgeCounts.UNKNOWN}</p>
      </section>

      <section className="compiler-machine__section">
        <h3>DETERMINISTIC FACTS</h3>
        {compilerState.causal_facts.length ? (
          <ul>{compilerState.causal_facts.map((fact) => <li key={`${fact.rule_id}:${fact.key}`}><code>{fact.key}</code> = {String(fact.value)} <small>{fact.rule_id}</small></li>)}</ul>
        ) : <p>None derived from the current organizer inputs.</p>}
      </section>

      <section className="compiler-machine__section">
        <h3>ACCEPTANCE MODULES</h3>
        {compilerState.acceptance_plan.modules.length ? <ul>{compilerState.acceptance_plan.modules.map((module) => <li key={module}>{module}</li>)}</ul> : <p>No acceptance modules selected yet.</p>}
      </section>

      <section className="compiler-machine__section">
        <h3>UNRESOLVED DECISIONS</h3>
        {compilerState.unresolved_decisions.length ? <ul>{compilerState.unresolved_decisions.map((item) => <li key={item.id}><b>{item.id}</b> — {item.reason}</li>)}</ul> : <p>None.</p>}
      </section>

      <section className="compiler-machine__section">
        <h3>QUESTIONS</h3>
        {compilerState.questions.length ? <ul>{compilerState.questions.map((question) => <li key={`${question.rule_id}:${question.id}`}><b>{question.blocking ? 'BLOCKING' : 'OPEN'}</b> — {question.prompt}</li>)}</ul> : <p>None.</p>}
      </section>

      <section className="compiler-machine__section">
        <h3>SENSITIVITY POINTS</h3>
        {compilerState.sensitivity_points.length ? <ul>{compilerState.sensitivity_points.map((point) => <li key={point}>{point}</li>)}</ul> : <p>None.</p>}
      </section>

      <section className="compiler-machine__section">
        <h3>REFERENCE ARCHITECTURE</h3>
        <pre>{JSON.stringify(compilerState.reference_architecture_candidate, null, 2)}</pre>
      </section>
    </div>
  );
}

function CompilerSurface({api}: {api: ChallengeProductApi}) {
  const challengeId = new URLSearchParams(window.location.search).get('challenge');
  const [sourceIntent, setSourceIntent] = useState('');
  const [answers, setAnswers] = useState<CompilerRequirementAnswers>(() => emptyRequirementAnswers());
  const [compilerState, setCompilerState] = useState<CompilerStateView | null>(null);
  const [compilePhase, setCompilePhase] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [accepted, setAccepted] = useState(false);
  const [challengeView, setChallengeView] = useState<PublicChallengeView | null>(null);
  const [challengePhase, setChallengePhase] = useState<'IDLE' | 'LOADING' | 'NOT_FOUND' | 'ERROR'>('IDLE');
  const [contractVersion, setContractVersion] = useState('');
  const [contractTitle, setContractTitle] = useState('');
  const [prizeMinorUnits, setPrizeMinorUnits] = useState('');
  const [settlementAsset, setSettlementAsset] = useState('');
  const [preview, setPreview] = useState<BuildContractPreviewView | null>(null);
  const [previewPhase, setPreviewPhase] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');

  useEffect(() => {
    if (!challengeId) {
      setChallengeView(null);
      setChallengePhase('IDLE');
      return;
    }
    let cancelled = false;
    setChallengeView(null);
    setChallengePhase('LOADING');
    void api.getChallenge(challengeId).then((next) => {
      if (cancelled) return;
      setChallengeView(next);
      setChallengePhase('IDLE');
    }).catch((cause) => {
      if (cancelled) return;
      setChallengePhase(cause instanceof Error && cause.message === 'challenge_not_found' ? 'NOT_FOUND' : 'ERROR');
    });
    return () => { cancelled = true; };
  }, [api, challengeId]);

  const invalidate = () => {
    setCompilerState(null);
    setCompilePhase('IDLE');
    setAccepted(false);
    setPreview(null);
    setPreviewPhase('IDLE');
  };

  const invalidatePreview = () => {
    setPreview(null);
    setPreviewPhase('IDLE');
  };

  const updateAnswer = (key: keyof CompilerRequirementAnswers, answer: RequirementAnswer) => {
    setAnswers((current) => ({...current, [key]: answer}));
    invalidate();
  };

  const compile = async (provenance: CompilerInputProvenance = 'SOURCE') => {
    if (!sourceIntent.trim()) return;
    setCompilePhase('LOADING');
    setCompilerState(null);
    setPreview(null);
    try {
      const next = await api.compileChallenge(buildCompilerProposal(sourceIntent, answers, provenance));
      setCompilerState(next);
      setAccepted(provenance === 'ORGANIZER_ACCEPTED');
      setCompilePhase('IDLE');
    } catch {
      setAccepted(false);
      setCompilePhase('ERROR');
    }
  };

  const previewContract = async () => {
    if (!challengeId || !compilerState || !challengeView) return;
    const prize = Number(prizeMinorUnits);
    if (!Number.isSafeInteger(prize) || prize < 1) return;
    setPreview(null);
    setPreviewPhase('LOADING');
    const authority: BuildContractPreviewAuthorityInput = {
      contract_version: contractVersion.trim(),
      title: contractTitle.trim(),
      brief: sourceIntent.trim(),
      preferences: {},
      normative_constraints: [],
      normative_references: [],
      informational_references: [],
      prize_minor_units: prize,
      settlement_asset: settlementAsset.trim(),
    };
    try {
      const next = await api.previewBuildContract(challengeId, compilerState, authority);
      setPreview(next);
      setPreviewPhase('IDLE');
    } catch {
      setPreviewPhase('ERROR');
    }
  };

  let state: SurfaceState = sourceIntent.trim() ? 'NORMAL' : 'EMPTY';
  let title = sourceIntent.trim() ? 'Source draft ready. Compile explicit requirements when you want deterministic state.' : 'Start with a fuzzy idea.';
  if (compilePhase === 'LOADING') {
    state = 'LOADING';
    title = accepted ? 'Replaying organizer-accepted inputs through the deterministic compiler.' : 'Running the deterministic Stage-D compiler.';
  } else if (compilePhase === 'ERROR') {
    state = 'ERROR';
    title = 'Compiler transport failed. No result was fabricated.';
  } else if (compilerState) {
    state = 'NORMAL';
    title = `Compiler state: ${compilerState.status}${accepted ? ' / ORGANIZER_ACCEPTED' : ''}.`;
  }

  const challengeReadyForPreview = Boolean(
    challengeView
    && challengeView.status === 'DRAFT'
    && !challengeView.has_frozen_contract
    && challengeView.current_contract_version === null
    && challengeView.current_terms_digest === null,
  );
  const prize = Number(prizeMinorUnits);
  const previewReady = Boolean(
    challengeId
    && challengeReadyForPreview
    && compilerState?.status === 'READY'
    && accepted
    && contractVersion.trim()
    && contractTitle.trim()
    && settlementAsset.trim()
    && Number.isSafeInteger(prize)
    && prize > 0
    && previewPhase !== 'LOADING',
  );

  return (
    <div className="compiler-foundation">
      <section className="compiler-intake" aria-labelledby="compiler-intake-title">
        <small>SOURCE / ORGANIZER DRAFT</small>
        <h2 id="compiler-intake-title">WHAT SHOULD EXIST WHEN THIS IS DONE?</h2>
        <p>Free text remains SOURCE intent. Structured requirements below are explicit organizer statements; this UI does not pretend to parse them from prose.</p>
        <label htmlFor="compiler-source-intent">SOURCE INTENT</label>
        <textarea
          id="compiler-source-intent"
          value={sourceIntent}
          onChange={(event) => { setSourceIntent(event.target.value); invalidate(); }}
          placeholder="Example: Build a public dashboard that tracks…"
          rows={6}
        />

        <fieldset className="compiler-requirements">
          <legend>SOURCE REQUIREMENTS / YES · NO · UNKNOWN</legend>
          {REQUIREMENTS.map(([key, label, help]) => (
            <div className="compiler-requirement" key={key}>
              <div><b>{label}</b><small>{help}</small></div>
              <div className="compiler-requirement__choices" aria-label={label}>
                {(['YES', 'NO', 'UNKNOWN'] as const).map((answer) => (
                  <button
                    type="button"
                    key={answer}
                    aria-pressed={answers[key] === answer}
                    onClick={() => updateAnswer(key, answer)}
                  >{answer}</button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <div className="compiler-intake__actions">
          <button type="button" disabled={!sourceIntent.trim() || compilePhase === 'LOADING'} onClick={() => void compile('SOURCE')}>
            {compilePhase === 'LOADING' ? 'COMPILING…' : 'COMPILE DETERMINISTIC STATE'}
          </button>
          <button type="button" disabled={!compilerState || compilePhase === 'LOADING'} onClick={() => void compile('ORGANIZER_ACCEPTED')}>
            ACCEPT CURRENT INPUTS
          </button>
          <span>{compilerState ? `${compilerState.compiler_version} / ${compilerState.status} / ${accepted ? 'ORGANIZER_ACCEPTED' : 'SOURCE'}` : sourceIntent.trim() ? 'SOURCE DRAFT / UNCOMPILED' : 'NO SOURCE INTENT YET'}</span>
        </div>
      </section>

      <StatePanel state={state} title={title}>
        {compilerState ? <CompilerReadout compilerState={compilerState} /> : (
          <>
            <p>{compilePhase === 'ERROR' ? 'The last trustworthy state is the organizer input shown at left. Retry after the transport is healthy.' : 'Unknown requirements stay UNKNOWN. The compiler will expose missing decisions, blueprint applicability, deterministic facts, risk, quality and acceptance modules without model authority.'}</p>
            <dl className="authority-ledger" aria-label="Compiler authority legend">
              <div><dt>SOURCE</dt><dd>what the organizer actually supplied</dd></div>
              <div><dt>MODEL_PROPOSAL</dt><dd>untrusted interpretation only</dd></div>
              <div><dt>ORGANIZER_ACCEPTED</dt><dd>explicit human acceptance</dd></div>
              <div><dt>DETERMINISTIC_RULE</dt><dd>machine-derived consequence</dd></div>
            </dl>
          </>
        )}
      </StatePanel>

      <section className="compiler-contract" aria-labelledby="compiler-contract-title">
        <small>BUILD CONTRACT / STAGE-B PREVIEW</small>
        <h2 id="compiler-contract-title">NEGOTIATED MOCK BUILD CONTRACT</h2>
        <p>The preview uses the real Stage-B Build Contract candidate + digest-freeze semantics. It is deliberately <b>NONCANONICAL / NOT PERSISTED</b>; no Challenge state, funding state, wallet state or settlement state is mutated here.</p>

        {!challengeId ? <p className="compiler-contract__notice">SELECT A DRAFT CHALLENGE — add a canonical <code>?challenge=&lt;id&gt;</code> context before freezing a preview.</p> : null}
        {challengePhase === 'LOADING' ? <p className="compiler-contract__notice">READING CHALLENGE AUTHORITY…</p> : null}
        {challengePhase === 'NOT_FOUND' ? <p className="compiler-contract__notice">CHALLENGE NOT FOUND.</p> : null}
        {challengePhase === 'ERROR' ? <p className="compiler-contract__notice">CHALLENGE TRANSPORT ERROR — preview disabled.</p> : null}
        {challengeView ? (
          <dl className="challenge-facts" aria-label="Build Contract Challenge authority">
            <div><dt>CHALLENGE</dt><dd><code>{challengeView.challenge_id}</code></dd></div>
            <div><dt>STATE</dt><dd>{challengeView.status}</dd></div>
            <div><dt>CONTRACT</dt><dd>{challengeView.has_frozen_contract ? 'FROZEN' : 'UNFROZEN'}</dd></div>
            <div><dt>SCHEDULE AUTHORITY</dt><dd>{challengeView.entry_deadline} → {challengeView.submission_deadline}</dd></div>
          </dl>
        ) : null}

        <div className="compiler-contract__fields">
          <label htmlFor="contract-version">CONTRACT VERSION<input id="contract-version" value={contractVersion} onChange={(event) => { setContractVersion(event.target.value); invalidatePreview(); }} placeholder="1.0.0" /></label>
          <label htmlFor="contract-title">TITLE<input id="contract-title" value={contractTitle} onChange={(event) => { setContractTitle(event.target.value); invalidatePreview(); }} placeholder="Challenge title" /></label>
          <label htmlFor="contract-prize">PRIZE / MINOR UNITS<input id="contract-prize" inputMode="numeric" value={prizeMinorUnits} onChange={(event) => { setPrizeMinorUnits(event.target.value); invalidatePreview(); }} placeholder="100" /></label>
          <label htmlFor="contract-asset">SETTLEMENT ASSET<input id="contract-asset" value={settlementAsset} onChange={(event) => { setSettlementAsset(event.target.value); invalidatePreview(); }} placeholder="TEST" /></label>
        </div>

        <div className="compiler-contract__actions">
          <button type="button" disabled={!previewReady} onClick={() => void previewContract()}>
            {previewPhase === 'LOADING' ? 'FREEZING PREVIEW…' : 'FREEZE NONCANONICAL PREVIEW'}
          </button>
          <span>{!accepted ? 'ORGANIZER ACCEPTANCE REQUIRED' : compilerState?.status !== 'READY' ? 'COMPILER MUST BE READY' : !challengeReadyForPreview ? 'UNFROZEN DRAFT CHALLENGE REQUIRED' : 'PREVIEW ONLY / NO PERSISTENCE'}</span>
        </div>

        {previewPhase === 'ERROR' ? <p className="compiler-contract__notice">PREVIEW REJECTED — authority, readiness or Build Contract validation failed. Nothing was persisted.</p> : null}
        {preview ? (
          <div className="compiler-contract__result" data-build-contract-preview="noncanonical">
            <strong>NONCANONICAL / NOT PERSISTED</strong>
            <span>TERMS DIGEST <code>{preview.contract.terms_digest}</code></span>
            <pre>{JSON.stringify(preview.contract, null, 2)}</pre>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ChallengeSurface({api}: {api: ChallengeProductApi}) {
  const challengeId = new URLSearchParams(window.location.search).get('challenge');
  const [view, setView] = useState<PublicChallengeView | null>(null);
  const [phase, setPhase] = useState<'IDLE' | 'LOADING' | 'NOT_FOUND' | 'ERROR'>('IDLE');

  useEffect(() => {
    if (!challengeId) {
      setView(null);
      setPhase('IDLE');
      return;
    }
    let cancelled = false;
    setView(null);
    setPhase('LOADING');
    void api.getChallenge(challengeId).then((next) => {
      if (cancelled) return;
      setView(next);
      setPhase('IDLE');
    }).catch((cause) => {
      if (cancelled) return;
      setPhase(cause instanceof Error && cause.message === 'challenge_not_found' ? 'NOT_FOUND' : 'ERROR');
    });
    return () => { cancelled = true; };
  }, [api, challengeId]);

  if (!challengeId) {
    return <StatePanel state="EMPTY" title="No Challenge selected."><p>Select a canonical Challenge from Discover or open a Challenge deep link.</p></StatePanel>;
  }
  if (phase === 'LOADING') {
    return <StatePanel state="LOADING" title="Reading canonical Challenge state."><p>Requested Challenge: <code>{challengeId}</code>.</p></StatePanel>;
  }
  if (phase === 'NOT_FOUND') {
    return <StatePanel state="EMPTY" title="Challenge not found."><p>No Stage-C Challenge exists for <code>{challengeId}</code>.</p></StatePanel>;
  }
  if (phase === 'ERROR' || !view) {
    return <StatePanel state="ERROR" title="Challenge transport failed."><p>The UI will not substitute mutable Mission or Project state.</p></StatePanel>;
  }

  return (
    <StatePanel state="NORMAL" title={`Challenge ${view.status}.`}>
      <dl className="challenge-facts" aria-label="Canonical Challenge facts">
        <div><dt>CHALLENGE</dt><dd><code>{view.challenge_id}</code></dd></div>
        <div><dt>TERMS</dt><dd>{view.current_terms_digest ?? 'NOT FROZEN'}</dd></div>
        <div><dt>CONTRACT</dt><dd>{view.current_contract_version ?? 'DRAFT'} / {view.has_frozen_contract ? 'FROZEN' : 'UNFROZEN'}</dd></div>
        <div><dt>SLOTS</dt><dd>{view.entry_count} / {view.slot_limit} · activation minimum {view.activation_minimum}</dd></div>
        <div><dt>BUILD START</dt><dd>{view.build_start}</dd></div>
        <div><dt>SUBMISSION DEADLINE</dt><dd>{view.submission_deadline}</dd></div>
        <div><dt>EVIDENCE COUNTS</dt><dd>{view.submission_count} submissions · {view.qualification_count} qualifications · {view.receipt_count} receipts</dd></div>
      </dl>
      <p className="challenge-state__foot">PUBLIC PROJECTION ONLY — PAYOUT IDENTITIES AND PRIVATE ENTRY DATA ARE NOT EXPOSED.</p>
    </StatePanel>
  );
}

function MyBuildSurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Challenge Entry transport is not exposed yet.">
      <p>My Build will be entry-specific and authenticated. Existing Project progress is not treated as Challenge authority.</p>
    </StatePanel>
  );
}

function ReviewSurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Test Arena mechanics are not authorized in Stage E.">
      <p>This is the future organizer review surface. Stage G owns reveal, normalized testing, qualification and side-by-side evaluation mechanics.</p>
    </StatePanel>
  );
}

function HistorySurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Challenge receipt read transport is not exposed yet.">
      <p>Durable evidence and Ship ancestry may be reused behind the boundary, but historical Ship UI is not substituted for Challenge receipts.</p>
    </StatePanel>
  );
}

function OperatorSurface() {
  return (
    <StatePanel state="UNAUTHORIZED" title="Operator authorization required.">
      <p>Exception handling is fail-closed. No operator controls are exposed until a canonical authorized operator context is established.</p>
    </StatePanel>
  );
}

function Surface({surface, api}: {surface: ChallengeSurface; api: ChallengeProductApi}) {
  if (surface === 'DISCOVER') return <DiscoverSurface />;
  if (surface === 'COMPILER') return <CompilerSurface api={api} />;
  if (surface === 'CHALLENGE') return <ChallengeSurface api={api} />;
  if (surface === 'MY_BUILD') return <MyBuildSurface />;
  if (surface === 'REVIEW') return <ReviewSurface />;
  if (surface === 'HISTORY') return <HistorySurface />;
  return <OperatorSurface />;
}

export default function ChallengeProduct({initialSurface = 'DISCOVER', api = DEFAULT_PRODUCT_API}: {initialSurface?: ChallengeSurface; api?: ChallengeProductApi}) {
  const [surface, setSurface] = useState(() => surfaceFromLocation(initialSurface));

  useEffect(() => {
    const onPopState = () => setSurface(surfaceFromLocation(initialSurface));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initialSurface]);

  const currentIndex = useMemo(() => CHALLENGE_SURFACES.indexOf(surface), [surface]);

  const selectSurface = (next: ChallengeSurface) => {
    if (next === surface) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    url.searchParams.delete('lab');
    url.searchParams.set('surface', next.toLowerCase().replaceAll('_', '-'));
    window.history.pushState({challengeSurface: next}, '', url);
    setSurface(next);
  };

  return (
    <main className="challenge-product" data-challenge-surface={surface.toLowerCase()}>
      <a className="challenge-skip" href="#challenge-workspace">Skip to Challenge workspace</a>
      <header className="challenge-topbar">
        <a className="challenge-brand" href="?surface=discover"><strong>REKT<i>//</i></strong><span>INKUBATOR</span></a>
        <span className="challenge-purpose">CHALLENGE OS / STAGE E</span>
        <span className="challenge-authority">TRUTH BEFORE THEATER</span>
      </header>

      <section className="challenge-heading">
        <div>
          <small>{String(currentIndex + 1).padStart(2, '0')} / {String(CHALLENGE_SURFACES.length).padStart(2, '0')} · {SURFACE_CUES[surface]}</small>
          <h1>{SURFACE_LABELS[surface]}</h1>
          <p>IDEA → FAIR BUILD CONTRACT → COMPETITION → REAL SOFTWARE → DURABLE RESULT</p>
        </div>
        <div className="challenge-heading__readout" aria-label="Stage readout">
          <span>PHASE<b>STAGE E</b></span>
          <span>AUTHORITY<b>CHALLENGE-FIRST</b></span>
          <span>MONEY<b>NOT AUTHORIZED</b></span>
        </div>
      </section>

      <section className="challenge-chassis">
        <nav className="challenge-nav" aria-label="Challenge product">
          <span className="challenge-nav__label">SURFACE / SELECT</span>
          {CHALLENGE_SURFACES.map((item, index) => (
            <button
              key={item}
              type="button"
              aria-current={item === surface ? 'page' : undefined}
              onClick={() => selectSurface(item)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <b>{SURFACE_LABELS[item]}</b>
              <small>{SURFACE_CUES[item]}</small>
            </button>
          ))}
          <div className="challenge-nav__imprint" data-decorative aria-hidden="true">
            <span />
            <p>SAME DEGENS.<br /><b>BETTER CONTRACTS.</b></p>
          </div>
        </nav>

        <section id="challenge-workspace" tabIndex={-1} className="challenge-workspace" aria-label={`${SURFACE_LABELS[surface]} workspace`}>
          <Surface surface={surface} api={api} />
        </section>
      </section>

      <footer className="challenge-footer">
        <span>E-GATE-1 / IA LOCKED</span>
        <span>E-GATE-2 / STATES LOCKED</span>
        <span>E-GATE-3 / REAL DATA ONLY</span>
      </footer>
    </main>
  );
}