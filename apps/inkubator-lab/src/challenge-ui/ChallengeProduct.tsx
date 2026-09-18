import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {
  createInkubatorApiClient,
  type BuildContractPreviewAuthorityInput,
  type BuildContractPreviewView,
  type CanonicalBuildContractView,
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
import {
  StageIHistorySurface,
  StageIJoinBridge,
  StageIMyBuildSurface,
  StageIOrganizerBridge,
  StageIReviewSurface,
  type StageIProductApi,
} from './StageIAlphaBridge';
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

export interface ChallengeProductApi extends StageIProductApi {
  compileChallenge(body: CompilerProposalInput): Promise<CompilerStateView>;
  getChallenge(challengeId: string): Promise<PublicChallengeView>;
  previewBuildContract(
    challengeId: string,
    compilerState: CompilerStateView,
    authority: BuildContractPreviewAuthorityInput,
  ): Promise<BuildContractPreviewView>;
  persistBuildContract(
    challengeId: string,
    requestId: string,
    compilerState: CompilerStateView,
    authority: BuildContractPreviewAuthorityInput,
    expectedTermsDigest: string,
  ): Promise<CanonicalBuildContractView>;
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

type JourneyGuideProps = {
  role: 'ORGANIZER' | 'BUILDER';
  step: number;
  total: number;
  title: string;
  body: string;
  detail?: string;
};

function JourneyGuide({role, step, total, title, body, detail}: JourneyGuideProps) {
  return (
    <aside className="journey-guide" data-journey-role={role.toLowerCase()} data-journey-step={step} aria-label={`${role} journey guidance`}>
      <div className="journey-guide__meta"><span>{role} JOURNEY</span><b>STEP {step} OF {total}</b></div>
      <h2>{title}</h2>
      <p>{body}</p>
      {detail ? <small>{detail}</small> : null}
    </aside>
  );
}

type OrganizerGuidanceInput = {
  sourceIntent: string;
  clarificationComplete: boolean;
  compilerState: CompilerStateView | null;
  accepted: boolean;
  challenge: PublicChallengeView | null;
};

export function deriveOrganizerGuidance(input: OrganizerGuidanceInput): Omit<JourneyGuideProps, 'role' | 'total'> {
  const {sourceIntent, clarificationComplete, compilerState, accepted, challenge} = input;

  if (challenge?.has_frozen_contract) {
    if (challenge.status === 'ENTRY_OPEN') {
      return {step: 5, title: 'YOUR CHALLENGE IS OPEN', body: 'Builders can now join under the locked rules. You can leave this screen and share the Challenge link.', detail: 'The server remains authoritative for lifecycle state and deadlines.'};
    }
    if (challenge.status === 'DRAFT') {
      return {step: 5, title: 'OPEN IT TO BUILDERS', body: 'The rules are locked. Opening the Challenge is the only remaining organizer action in this setup flow.', detail: 'Opening does not change the locked Build Contract.'};
    }
    return {step: 5, title: 'CHALLENGE IN PROGRESS', body: `The guided setup is complete. The canonical Challenge is now in ${challenge.status}; setup actions will not pretend that it can be opened again.`, detail: 'Use the lifecycle surfaces for the next canonical action.'};
  }
  if (!sourceIntent.trim()) {
    return {step: 1, title: 'DESCRIBE WHAT YOU WANT BUILT', body: 'Start in normal language. Describe the finished software or outcome you want builders to deliver.', detail: 'You do not need to know Inkubator protocol terms.'};
  }
  if (!clarificationComplete) {
    return {step: 2, title: 'CLARIFY A FEW DETAILS', body: 'Answer one detail at a time. Yes, No, and Not sure are all valid answers.', detail: 'Unknown stays unknown; the UI will not invent requirements for you.'};
  }
  if (!compilerState) {
    return {step: 3, title: 'CHECK YOUR CHALLENGE RULES', body: 'You have supplied enough input to ask the deterministic compiler what is ready and what still needs clarification.', detail: 'No Challenge is created or opened by this check.'};
  }
  if (compilerState.status !== 'READY') {
    return {step: 2, title: 'A FEW DETAILS STILL NEED CLARITY', body: 'Review the compiler questions, adjust the answers above, then check the Challenge again.', detail: `${compilerState.questions.length} compiler question${compilerState.questions.length === 1 ? '' : 's'} remain.`};
  }
  if (!accepted) {
    return {step: 3, title: 'REVIEW THE RULES', body: 'The compiler is ready. Confirm that these are the rules you actually want before creating the draft Challenge.', detail: 'Technical compiler output is available below if you want to inspect it.'};
  }
  if (!challenge) {
    return {step: 3, title: 'SET UP THE CHALLENGE', body: 'The rules are accepted. Choose builder capacity and deadlines; this creates a draft only.', detail: 'Nothing is visible to builders until you lock the rules and open it.'};
  }
  return {step: 4, title: 'LOCK THE RULES', body: 'Review the final Challenge details, preview exactly what will be frozen, then lock those rules.', detail: 'Locking is permanent for this Challenge. The server recomputes and verifies the canonical contract.'};
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
        <h3>PRODUCTION ENVELOPE</h3>
        {compilerState.production_envelope.criteria.length || compilerState.production_envelope.facts.length ? (
          <ul>
            {compilerState.production_envelope.criteria.map((criterion) => (
              <li key={`criterion:${criterion.id}`}><b>{criterion.id}</b> — {criterion.description} <small>{criterion.mandatory ? 'MANDATORY' : 'OPTIONAL'} / {criterion.provenance}</small></li>
            ))}
            {compilerState.production_envelope.facts.map((fact) => (
              <li key={`fact:${fact.rule_id}:${fact.key}`}><code>{fact.key}</code> = {String(fact.value)} <small>{fact.rule_id} / {fact.provenance}</small></li>
            ))}
          </ul>
        ) : <p>No production-envelope criteria or facts derived yet.</p>}
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
        <h3>FINDINGS</h3>
        {compilerState.findings.length ? (
          <ul>{compilerState.findings.map((finding) => <li key={`${finding.rule_id}:${finding.code}`}><b>{finding.severity} / {finding.code}</b> — {finding.message} <small>{finding.rule_id}</small></li>)}</ul>
        ) : <p>None.</p>}
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
  const [challengeId, setChallengeId] = useState(() => new URLSearchParams(window.location.search).get('challenge'));
  const [sourceIntent, setSourceIntent] = useState('');
  const [answers, setAnswers] = useState<CompilerRequirementAnswers>(() => emptyRequirementAnswers());
  const [requirementIndex, setRequirementIndex] = useState(0);
  const [clarificationComplete, setClarificationComplete] = useState(false);
  const [compilerState, setCompilerState] = useState<CompilerStateView | null>(null);
  const [compilePhase, setCompilePhase] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [accepted, setAccepted] = useState(false);
  const [challengeView, setChallengeView] = useState<PublicChallengeView | null>(null);
  const [challengePhase, setChallengePhase] = useState<'IDLE' | 'LOADING' | 'NOT_FOUND' | 'ERROR'>('IDLE');
  const [contractVersion, setContractVersion] = useState('1.0.0');
  const [contractTitle, setContractTitle] = useState('');
  const [prizeMinorUnits, setPrizeMinorUnits] = useState('100');
  const [settlementAsset, setSettlementAsset] = useState('TEST');
  const [preview, setPreview] = useState<BuildContractPreviewView | null>(null);
  const [previewAuthority, setPreviewAuthority] = useState<BuildContractPreviewAuthorityInput | null>(null);
  const [previewPhase, setPreviewPhase] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [persistRequestId, setPersistRequestId] = useState<string | null>(null);
  const [persistPhase, setPersistPhase] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [canonicalContract, setCanonicalContract] = useState<CanonicalBuildContractView | null>(null);
  const compilerRequestRevision = useRef(0);

  useEffect(() => {
    const onPopState = () => setChallengeId(new URLSearchParams(window.location.search).get('challenge'));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!challengeId) {
      setChallengeView(null);
      setChallengePhase('IDLE');
      return;
    }
    let cancelled = false;
    setChallengeView((current) => current?.challenge_id === challengeId ? current : null);
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

  const syncChallengeContext = (view: PublicChallengeView) => {
    const url = new URL(window.location.href);
    url.searchParams.set('surface', 'compiler');
    url.searchParams.set('challenge', view.challenge_id);
    window.history.replaceState({challengeSurface: 'COMPILER'}, '', url);
    setChallengeId(view.challenge_id);
    setChallengeView(view);
    setChallengePhase('IDLE');
  };

  const invalidate = () => {
    compilerRequestRevision.current += 1;
    setCompilerState(null);
    setCompilePhase('IDLE');
    setAccepted(false);
    setPreview(null);
    setPreviewAuthority(null);
    setPreviewPhase('IDLE');
    setPersistRequestId(null);
    setPersistPhase('IDLE');
    setCanonicalContract(null);
  };

  const invalidatePreview = () => {
    setPreview(null);
    setPreviewAuthority(null);
    setPreviewPhase('IDLE');
    setPersistRequestId(null);
    setPersistPhase('IDLE');
    setCanonicalContract(null);
  };

  const updateAnswer = (key: keyof CompilerRequirementAnswers, answer: RequirementAnswer) => {
    setAnswers((current) => ({...current, [key]: answer}));
    invalidate();
  };

  const compile = async (provenance: CompilerInputProvenance = 'SOURCE') => {
    if (!sourceIntent.trim()) return;
    const requestRevision = ++compilerRequestRevision.current;
    setCompilePhase('LOADING');
    setCompilerState(null);
    setPreview(null);
    setPreviewAuthority(null);
    setPersistRequestId(null);
    setCanonicalContract(null);
    try {
      const next = await api.compileChallenge(buildCompilerProposal(sourceIntent, answers, provenance));
      if (compilerRequestRevision.current !== requestRevision) return;
      setCompilerState(next);
      setAccepted(provenance === 'ORGANIZER_ACCEPTED');
      setCompilePhase('IDLE');
    } catch {
      if (compilerRequestRevision.current !== requestRevision) return;
      setAccepted(false);
      setCompilePhase('ERROR');
    }
  };

  const buildAuthority = (): BuildContractPreviewAuthorityInput | null => {
    const prize = Number(prizeMinorUnits);
    if (!Number.isSafeInteger(prize) || prize < 1) return null;
    return {
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
  };

  const previewContract = async () => {
    if (!challengeId || !compilerState || !challengeView) return;
    const authority = buildAuthority();
    if (!authority) return;
    setPreview(null);
    setPreviewAuthority(null);
    setPersistRequestId(null);
    setCanonicalContract(null);
    setPreviewPhase('LOADING');
    try {
      const next = await api.previewBuildContract(challengeId, compilerState, authority);
      setPreview(next);
      setPreviewAuthority(authority);
      setPersistRequestId(crypto.randomUUID());
      setPreviewPhase('IDLE');
    } catch {
      setPreviewPhase('ERROR');
    }
  };

  const persistContract = async () => {
    if (!challengeId || !compilerState || !preview || !previewAuthority || !persistRequestId) return;
    setPersistPhase('LOADING');
    setCanonicalContract(null);
    let next: CanonicalBuildContractView;
    try {
      next = await api.persistBuildContract(
        challengeId,
        persistRequestId,
        compilerState,
        previewAuthority,
        preview.contract.terms_digest,
      );
      if (next.terms_digest !== preview.contract.terms_digest) throw new Error('canonical_digest_mismatch');
    } catch {
      setPersistPhase('ERROR');
      return;
    }

    setCanonicalContract(next);
    setPersistPhase('IDLE');
    setChallengePhase('LOADING');
    try {
      setChallengeView(await api.getChallenge(challengeId));
      setChallengePhase('IDLE');
    } catch {
      setChallengePhase('ERROR');
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
  const persistReady = Boolean(
    preview
    && previewAuthority
    && persistRequestId
    && !canonicalContract
    && persistPhase !== 'LOADING',
  );
  const currentRequirement = REQUIREMENTS[requirementIndex] ?? REQUIREMENTS[0];
  const guidance = deriveOrganizerGuidance({sourceIntent, clarificationComplete, compilerState, accepted, challenge: challengeView});
  const compilerReadyAndAccepted = compilerState?.status === 'READY' && accepted;

  return (
    <div className="compiler-foundation">
      <JourneyGuide role="ORGANIZER" total={5} {...guidance} />
      <section className="compiler-intake" aria-labelledby="compiler-intake-title">
        <small>STEP 1 / DESCRIBE</small>
        <h2 id="compiler-intake-title">WHAT DO YOU WANT BUILT?</h2>
        <p>Describe the finished thing in your own words. Inkubator keeps your words as source intent instead of pretending it understood details you never supplied.</p>
        <label htmlFor="compiler-source-intent">YOUR IDEA</label>
        <textarea
          id="compiler-source-intent"
          value={sourceIntent}
          onChange={(event) => { setSourceIntent(event.target.value); invalidate(); }}
          placeholder="Example: Build a public dashboard that tracks…"
          rows={6}
        />

        {sourceIntent.trim() ? (
          <fieldset className="compiler-requirements compiler-requirements--guided">
            <legend>STEP 2 / CLARIFY · DETAIL {requirementIndex + 1} OF {REQUIREMENTS.length}</legend>
            <div className="compiler-requirement" key={currentRequirement[0]}>
              <div><b>{currentRequirement[1]}</b><small>{currentRequirement[2]}</small></div>
              <div className="compiler-requirement__choices" aria-label={currentRequirement[1]}>
                {(['YES', 'NO', 'UNKNOWN'] as const).map((answer) => (
                  <button
                    type="button"
                    key={answer}
                    aria-pressed={answers[currentRequirement[0]] === answer}
                    onClick={() => updateAnswer(currentRequirement[0], answer)}
                  >{answer === 'UNKNOWN' ? 'NOT SURE' : answer}</button>
                ))}
              </div>
            </div>
            <div className="journey-question-nav">
              <button type="button" disabled={requirementIndex === 0} onClick={() => setRequirementIndex((current) => Math.max(0, current - 1))}>← BACK</button>
              <span>{clarificationComplete ? 'DETAILS REVIEWED' : 'NOT SURE IS A VALID ANSWER'}</span>
              <button
                type="button"
                onClick={() => {
                  if (requirementIndex === REQUIREMENTS.length - 1) {
                    setClarificationComplete(true);
                  } else {
                    setRequirementIndex((current) => Math.min(REQUIREMENTS.length - 1, current + 1));
                  }
                }}
              >{requirementIndex === REQUIREMENTS.length - 1 ? 'DONE WITH DETAILS ✓' : 'NEXT DETAIL →'}</button>
            </div>
          </fieldset>
        ) : null}

        {clarificationComplete ? (
          <div className="compiler-intake__actions">
            {!compilerState ? (
              <button type="button" disabled={compilePhase === 'LOADING'} onClick={() => void compile('SOURCE')}>
                {compilePhase === 'LOADING' ? 'CHECKING…' : 'CHECK MY CHALLENGE'}
              </button>
            ) : !accepted ? (
              <button type="button" disabled={compilePhase === 'LOADING' || compilerState.status !== 'READY'} onClick={() => void compile('ORGANIZER_ACCEPTED')}>
                {compilePhase === 'LOADING' ? 'CONFIRMING…' : 'USE THESE RULES'}
              </button>
            ) : null}
            <span>{compilerState ? `${compilerState.compiler_version} / ${compilerState.status} / ${accepted ? 'RULES ACCEPTED' : 'REVIEW REQUIRED'}` : 'READY TO CHECK · NOTHING CREATED YET'}</span>
          </div>
        ) : null}
      </section>

      <StatePanel state={state} title={title}>
        {compilerState ? (
          <>
            <div className="journey-review-summary">
              <strong>{compilerState.status === 'READY' ? 'THE RULES ARE READY TO REVIEW.' : 'THE COMPILER STILL NEEDS CLARITY.'}</strong>
              <p>{compilerState.status === 'READY' ? 'Check that this matches what you meant, then use these rules to continue.' : `${compilerState.questions.length} question${compilerState.questions.length === 1 ? '' : 's'} remain. Adjust the details above and check again.`}</p>
              {compilerState.status !== 'READY' && compilerState.questions.length ? (
                <ul className="journey-review-questions">
                  {compilerState.questions.map((question) => <li key={`${question.rule_id}:${question.id}`}>{question.prompt}</li>)}
                </ul>
              ) : null}
            </div>
            <details className="journey-technical-details">
              <summary>Technical compiler details</summary>
              <CompilerReadout compilerState={compilerState} />
            </details>
          </>
        ) : (
          <>
            <p>{compilePhase === 'ERROR' ? 'The last trustworthy state is the organizer input shown above. Retry after the transport is healthy.' : clarificationComplete ? 'Your answers are still only organizer input. Check the Challenge when you are ready; nothing is created or locked by that check.' : 'Not sure stays unknown. Inkubator does not silently fill in requirements you did not provide.'}</p>
            <details className="journey-technical-details">
              <summary>How Inkubator treats authority</summary>
              <dl className="authority-ledger" aria-label="Compiler authority legend">
                <div><dt>SOURCE</dt><dd>what the organizer actually supplied</dd></div>
                <div><dt>MODEL_PROPOSAL</dt><dd>untrusted interpretation only</dd></div>
                <div><dt>ORGANIZER_ACCEPTED</dt><dd>explicit human acceptance</dd></div>
                <div><dt>DETERMINISTIC_RULE</dt><dd>machine-derived consequence</dd></div>
              </dl>
            </details>
          </>
        )}
      </StatePanel>

      {compilerReadyAndAccepted && !challengeId ? <StageIOrganizerBridge api={api} challenge={challengeView} onChallengeChanged={syncChallengeContext} /> : null}

      {compilerReadyAndAccepted && challengeId && !challengeView?.has_frozen_contract ? (
      <section className="compiler-contract" aria-labelledby="compiler-contract-title">
        <small>STEP 4 / LOCK</small>
        <h2 id="compiler-contract-title">REVIEW AND LOCK THE RULES</h2>
        <p>Preview the exact rules first. When you lock them, Inkubator recomputes the same accepted contract server-side and freezes that canonical version for this Challenge.</p>

        {!challengeId ? <p className="compiler-contract__notice">SELECT A DRAFT CHALLENGE — add a canonical <code>?challenge=&lt;id&gt;</code> context before freezing a preview.</p> : null}
        {challengePhase === 'LOADING' ? <p className="compiler-contract__notice">READING CHALLENGE AUTHORITY…</p> : null}
        {challengePhase === 'NOT_FOUND' ? <p className="compiler-contract__notice">CHALLENGE NOT FOUND.</p> : null}
        {challengePhase === 'ERROR' ? <p className="compiler-contract__notice">{canonicalContract ? 'CANONICAL CONTRACT PERSISTED — CHALLENGE PROJECTION REFRESH UNAVAILABLE.' : 'CHALLENGE TRANSPORT ERROR — freeze disabled.'}</p> : null}
        {challengeView ? (
          <dl className="challenge-facts" aria-label="Build Contract Challenge authority">
            <div><dt>CHALLENGE</dt><dd><code>{challengeView.challenge_id}</code></dd></div>
            <div><dt>STATE</dt><dd>{challengeView.status}</dd></div>
            <div><dt>CONTRACT</dt><dd>{challengeView.has_frozen_contract ? 'FROZEN' : 'UNFROZEN'}</dd></div>
            <div><dt>SCHEDULE AUTHORITY</dt><dd>{challengeView.entry_deadline} → {challengeView.submission_deadline}</dd></div>
          </dl>
        ) : null}

        <div className="compiler-contract__fields">
          <label htmlFor="contract-version">RULESET VERSION<input id="contract-version" value={contractVersion} onChange={(event) => { setContractVersion(event.target.value); invalidatePreview(); }} placeholder="1.0.0" /></label>
          <label htmlFor="contract-title">CHALLENGE TITLE<input id="contract-title" value={contractTitle} onChange={(event) => { setContractTitle(event.target.value); invalidatePreview(); }} placeholder="Give builders a clear title" /></label>
          <label htmlFor="contract-prize">TEST PRIZE / UNITS<input id="contract-prize" inputMode="numeric" value={prizeMinorUnits} onChange={(event) => { setPrizeMinorUnits(event.target.value); invalidatePreview(); }} placeholder="100" /></label>
          <label htmlFor="contract-asset">TEST ASSET<input id="contract-asset" value={settlementAsset} onChange={(event) => { setSettlementAsset(event.target.value); invalidatePreview(); }} placeholder="TEST" /></label>
        </div>

        <div className="compiler-contract__actions">
          <button type="button" disabled={!previewReady} onClick={() => void previewContract()}>
            {previewPhase === 'LOADING' ? 'BUILDING PREVIEW…' : 'PREVIEW LOCKED RULES'}
          </button>
          <button type="button" disabled={!persistReady} onClick={() => void persistContract()}>
            {persistPhase === 'LOADING' ? 'LOCKING RULES…' : 'LOCK THESE RULES'}
          </button>
          <span>{canonicalContract ? 'RULES LOCKED' : preview ? 'PREVIEW READY · LOCKING IS PERMANENT' : !challengeReadyForPreview ? 'DRAFT CHALLENGE REQUIRED' : 'PREVIEW BEFORE LOCKING'}</span>
        </div>

        {previewPhase === 'ERROR' ? <p className="compiler-contract__notice">PREVIEW REJECTED — authority, readiness or Build Contract validation failed. Nothing was persisted.</p> : null}
        {persistPhase === 'ERROR' ? <p className="compiler-contract__notice">CANONICAL PERSISTENCE REJECTED — authentication, organizer authority, preview lineage or idempotency validation failed.</p> : null}
        {preview ? (
          <div className="compiler-contract__result" data-build-contract-preview="noncanonical">
            <strong>PREVIEW ONLY · NOT LOCKED YET</strong>
            <span>TERMS DIGEST <code>{preview.contract.terms_digest}</code></span>
            <details className="journey-technical-details"><summary>Exact contract JSON</summary><pre>{JSON.stringify(preview.contract, null, 2)}</pre></details>
          </div>
        ) : null}
        {canonicalContract ? (
          <div className="compiler-contract__result" data-build-contract-canonical="persisted">
            <strong>CANONICAL / PERSISTED</strong>
            <span>TERMS DIGEST <code>{canonicalContract.terms_digest}</code></span>
            <span>CONTRACT {canonicalContract.contract_version} · FROZEN {canonicalContract.frozen_at}</span>
          </div>
        ) : null}
      </section>
      ) : null}

      {challengeView?.has_frozen_contract ? <StageIOrganizerBridge api={api} challenge={challengeView} onChallengeChanged={syncChallengeContext} /> : null}
    </div>
  );
}

function ChallengeSurface({api}: {api: ChallengeProductApi}) {
  const challengeId = new URLSearchParams(window.location.search).get('challenge');
  const [view, setView] = useState<PublicChallengeView | null>(null);
  const [phase, setPhase] = useState<'IDLE' | 'LOADING' | 'NOT_FOUND' | 'ERROR'>('IDLE');
  const [joined, setJoined] = useState(false);

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

  const summary = view.contract_summary;
  const readableContract = Boolean(
    view.has_frozen_contract
    && summary
    && view.current_terms_digest
    && summary.terms_digest === view.current_terms_digest,
  );

  return (
    <>
      <JourneyGuide
        role="BUILDER"
        step={joined ? 2 : 1}
        total={2}
        title={joined ? "YOU'RE IN" : !readableContract ? 'RULES NOT AVAILABLE YET' : view.status === 'ENTRY_OPEN' ? 'READ IT, THEN JOIN' : 'READ THE CHALLENGE'}
        body={joined ? 'Your entry is bound to these locked rules. Continue to My Build for the builder capsule and submission path.' : !readableContract ? 'The canonical locked rule summary is unavailable. Inkubator will not offer a Join action until you can inspect the rules you would be accepting.' : view.status === 'ENTRY_OPEN' ? 'Read the locked rules and deadlines below. Join only if this is the Challenge you want to build.' : 'Read the locked rules below. Entry is not open yet, so there is nothing you need to submit or guess.'}
        detail={joined ? 'The next surface is My Build.' : readableContract ? 'Joining is bound to the exact terms digest shown here.' : 'Fail closed: no readable locked rules, no Join button.'}
      />

      {readableContract && summary ? (
        <section className="challenge-rule-summary" aria-labelledby="challenge-rule-summary-title">
          <small>LOCKED CHALLENGE RULES · VERSION {summary.contract_version}</small>
          <h2 id="challenge-rule-summary-title">{summary.title}</h2>
          <p className="challenge-rule-summary__brief">{summary.brief}</p>
          <dl className="challenge-rule-summary__highlights">
            <div><dt>TEST REWARD</dt><dd>{summary.prize_display ?? `${summary.prize_minor_units} ${summary.settlement_asset}`}</dd></div>
            <div><dt>BUILDERS</dt><dd>{view.entry_count} / {view.slot_limit} joined</dd></div>
            <div><dt>ENTRY CLOSES</dt><dd>{view.entry_deadline}</dd></div>
            <div><dt>SUBMIT BY</dt><dd>{view.submission_deadline}</dd></div>
          </dl>

          {summary.outcome_criteria.length ? (
            <section className="challenge-rule-summary__group">
              <h3>WHAT NEEDS TO WORK</h3>
              <ul>{summary.outcome_criteria.map((criterion) => <li key={`outcome:${criterion.id}`}><b>{criterion.description}</b><small>{criterion.mandatory ? 'REQUIRED' : 'OPTIONAL'}</small></li>)}</ul>
            </section>
          ) : null}
          {summary.production_criteria.length ? (
            <section className="challenge-rule-summary__group">
              <h3>HOW IT NEEDS TO HOLD UP</h3>
              <ul>{summary.production_criteria.map((criterion) => <li key={`production:${criterion.id}`}><b>{criterion.description}</b><small>{criterion.mandatory ? 'REQUIRED' : 'OPTIONAL'}</small></li>)}</ul>
            </section>
          ) : null}
          {summary.delivery_criteria.length ? (
            <section className="challenge-rule-summary__group">
              <h3>WHAT YOU NEED TO DELIVER</h3>
              <ul>{summary.delivery_criteria.map((criterion) => <li key={`delivery:${criterion.id}`}><b>{criterion.description}</b><small>{criterion.mandatory ? 'REQUIRED' : 'OPTIONAL'}</small></li>)}</ul>
            </section>
          ) : null}
          {summary.normative_constraints.length ? (
            <section className="challenge-rule-summary__group">
              <h3>OTHER LOCKED RULES</h3>
              <ul>{summary.normative_constraints.map((criterion) => <li key={`constraint:${criterion.id}`}><b>{criterion.description}</b><small>{criterion.mandatory ? 'REQUIRED' : 'OPTIONAL'}</small></li>)}</ul>
            </section>
          ) : null}

          <details className="journey-technical-details">
            <summary>Technical terms and references</summary>
            <dl className="challenge-facts" aria-label="Canonical Challenge facts">
              <div><dt>CHALLENGE</dt><dd><code>{view.challenge_id}</code></dd></div>
              <div><dt>TERMS DIGEST</dt><dd><code>{summary.terms_digest}</code></dd></div>
              <div><dt>CONTRACT</dt><dd>{summary.contract_version} / FROZEN</dd></div>
              <div><dt>STATE</dt><dd>{view.status}</dd></div>
            </dl>
            {summary.normative_references.length ? <ul>{summary.normative_references.map((reference) => <li key={reference.id}><code>{reference.id}</code> · {reference.kind} · <code>{reference.content_digest}</code></li>)}</ul> : null}
            {summary.informational_references.length ? <ul>{summary.informational_references.map((reference) => <li key={reference.id}><a href={reference.url} target="_blank" rel="noreferrer">{reference.id}</a></li>)}</ul> : null}
          </details>
          <p className="challenge-state__foot">PUBLIC LOCKED-RULE PROJECTION ONLY — PAYOUT IDENTITIES, PRIVATE ENTRY DATA AND ARCHIVE INTERNALS ARE NOT EXPOSED.</p>
        </section>
      ) : (
        <StatePanel state="UNAVAILABLE_OR_STALE" title="Locked Challenge rules are unavailable.">
          <p>Inkubator will not ask you to join against a digest you cannot inspect. Retry when the canonical frozen rule projection is available.</p>
        </StatePanel>
      )}

      {readableContract ? <StageIJoinBridge api={api} onJoined={() => setJoined(true)} /> : null}
    </>
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
  if (surface === 'MY_BUILD') return api.getMyBuild && api.mintSubmitCredential ? <StageIMyBuildSurface api={api} /> : <MyBuildSurface />;
  if (surface === 'REVIEW') return api.getRevealArena && api.getTestArenaModules && api.qualifyEntry && api.getQualifierComparison && api.selectQualifier ? <StageIReviewSurface api={api} /> : <ReviewSurface />;
  if (surface === 'HISTORY') return api.getReceipts ? <StageIHistorySurface api={api} /> : <HistorySurface />;
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
        <span className="challenge-purpose">CHALLENGE OS / STAGE I ALPHA</span>
        <span className="challenge-authority">TRUTH BEFORE THEATER</span>
      </header>

      <section className="challenge-heading">
        <div>
          <small>{String(currentIndex + 1).padStart(2, '0')} / {String(CHALLENGE_SURFACES.length).padStart(2, '0')} · {SURFACE_CUES[surface]}</small>
          <h1>{SURFACE_LABELS[surface]}</h1>
          <p>IDEA → FAIR BUILD CONTRACT → COMPETITION → REAL SOFTWARE → DURABLE RESULT</p>
        </div>
        <div className="challenge-heading__readout" aria-label="Stage readout">
          <span>PHASE<b>STAGE I ALPHA</b></span>
          <span>AUTHORITY<b>CHALLENGE-FIRST</b></span>
          <span>MONEY<b>TEST ONLY / NO REAL VALUE</b></span>
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
        <span>STAGE I / ALPHA REHEARSAL</span>
        <span>TEST VALUE ONLY</span>
        <span>REAL DATA / FROZEN AUTHORITY</span>
      </footer>
    </main>
  );
}
