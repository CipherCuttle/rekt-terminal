import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {
  createInkubatorApiClient,
  InkubatorApiError,
  type BuildContractPreviewAuthorityInput,
  type BuildContractPreviewView,
  type ChallengeEntryPrivateView,
  type CanonicalBuildContractView,
  type CompilerInputProvenance,
  type CompilerProposalInput,
  type CompilerStateView,
  type CreateDraftChallengeInput,
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
import {GitHubSessionWidget, type GitHubSessionWidgetApi} from './GitHubSessionWidget';

const STATE_COPY: Record<SurfaceState, string> = {
  NORMAL: 'READY / SOURCE-BOUND',
  LOADING: 'CHECKING THE LATEST STATE…',
  EMPTY: 'NOTHING HERE YET',
  ERROR: 'WE COULDN’T LOAD THIS STATE',
  UNAVAILABLE_OR_STALE: 'THIS PART ISN’T AVAILABLE RIGHT NOW',
  UNAUTHORIZED: 'YOU DON’T HAVE ACCESS TO THIS',
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

export interface ChallengeProductApi extends GitHubSessionWidgetApi {
  createDraftChallenge(body: CreateDraftChallengeInput): Promise<PublicChallengeView>;
  joinChallenge(
    challengeId: string,
    requestId: string,
    entryId: string,
    payoutIdentity: string,
  ): Promise<ChallengeEntryPrivateView>;
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

function DiscoverSurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="No open challenges to show yet.">
      <p>Open challenges will appear here when the canonical discovery feed is available.</p>
      <p className="challenge-state__foot">NO FIXTURE OR LEGACY DISCOVERY DATA IS SUBSTITUTED.</p>
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
  const [previewAuthority, setPreviewAuthority] = useState<BuildContractPreviewAuthorityInput | null>(null);
  const [previewPhase, setPreviewPhase] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [persistRequestId, setPersistRequestId] = useState<string | null>(null);
  const [persistPhase, setPersistPhase] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [canonicalContract, setCanonicalContract] = useState<CanonicalBuildContractView | null>(null);
  const [slotLimit, setSlotLimit] = useState('');
  const [activationMinimum, setActivationMinimum] = useState('');
  const [entryDeadline, setEntryDeadline] = useState('');
  const [buildStart, setBuildStart] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  const [reviewDeadline, setReviewDeadline] = useState('');
  const [appealWindowHours, setAppealWindowHours] = useState('');
  const [createPhase, setCreatePhase] = useState<'IDLE' | 'LOADING' | 'AUTH_REQUIRED' | 'ERROR'>('IDLE');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftRequestId, setDraftRequestId] = useState<string>(() => crypto.randomUUID());
  const [draftChallengeId, setDraftChallengeId] = useState<string>(() => crypto.randomUUID());
  const compilerRequestRevision = useRef(0);

  useEffect(() => {
    if (challengeId) {
      setDraftHydrated(true);
      return;
    }
    try {
      const raw = window.sessionStorage.getItem('rekt-inkubator-create-draft-v1');
      if (raw) {
        const saved = JSON.parse(raw) as {
          sourceIntent?: string;
          answers?: CompilerRequirementAnswers;
          slotLimit?: string;
          activationMinimum?: string;
          entryDeadline?: string;
          buildStart?: string;
          submissionDeadline?: string;
          reviewDeadline?: string;
          appealWindowHours?: string;
          draftRequestId?: string;
          draftChallengeId?: string;
        };
        if (typeof saved.sourceIntent === 'string') setSourceIntent(saved.sourceIntent);
        if (saved.answers && typeof saved.answers === 'object') {
          const restored = emptyRequirementAnswers();
          for (const [key] of REQUIREMENTS) {
            const value = saved.answers[key];
            if (value === 'YES' || value === 'NO' || value === 'UNKNOWN') restored[key] = value;
          }
          setAnswers(restored);
        }
        if (typeof saved.slotLimit === 'string') setSlotLimit(saved.slotLimit);
        if (typeof saved.activationMinimum === 'string') setActivationMinimum(saved.activationMinimum);
        if (typeof saved.entryDeadline === 'string') setEntryDeadline(saved.entryDeadline);
        if (typeof saved.buildStart === 'string') setBuildStart(saved.buildStart);
        if (typeof saved.submissionDeadline === 'string') setSubmissionDeadline(saved.submissionDeadline);
        if (typeof saved.reviewDeadline === 'string') setReviewDeadline(saved.reviewDeadline);
        if (typeof saved.appealWindowHours === 'string') setAppealWindowHours(saved.appealWindowHours);
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (typeof saved.draftRequestId === 'string' && uuidPattern.test(saved.draftRequestId)) setDraftRequestId(saved.draftRequestId);
        if (typeof saved.draftChallengeId === 'string' && uuidPattern.test(saved.draftChallengeId)) setDraftChallengeId(saved.draftChallengeId);
      }
    } catch {
      window.sessionStorage.removeItem('rekt-inkubator-create-draft-v1');
    } finally {
      setDraftHydrated(true);
    }
  }, [challengeId]);

  useEffect(() => {
    if (!draftHydrated || challengeId) return;
    window.sessionStorage.setItem('rekt-inkubator-create-draft-v1', JSON.stringify({
      sourceIntent,
      answers,
      slotLimit,
      activationMinimum,
      entryDeadline,
      buildStart,
      submissionDeadline,
      reviewDeadline,
      appealWindowHours,
      draftRequestId,
      draftChallengeId,
    }));
  }, [
    draftHydrated,
    challengeId,
    sourceIntent,
    answers,
    slotLimit,
    activationMinimum,
    entryDeadline,
    buildStart,
    submissionDeadline,
    reviewDeadline,
    appealWindowHours,
    draftRequestId,
    draftChallengeId,
  ]);

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

  const createDraftChallenge = async () => {
    const slot = Number(slotLimit);
    const activation = Number(activationMinimum);
    const entryMs = Date.parse(entryDeadline);
    const buildMs = Date.parse(buildStart);
    const submissionMs = Date.parse(submissionDeadline);
    const reviewMs = Date.parse(reviewDeadline);
    const appealHours = Number(appealWindowHours);
    if (
      !Number.isSafeInteger(slot) || slot < 1
      || !Number.isSafeInteger(activation) || activation < 1 || activation > slot
      || !Number.isSafeInteger(entryMs) || !Number.isSafeInteger(buildMs)
      || !Number.isSafeInteger(submissionMs) || !Number.isSafeInteger(reviewMs)
      || !Number.isFinite(appealHours) || appealHours <= 0
      || entryMs > buildMs || buildMs >= submissionMs || submissionMs > reviewMs
    ) return;

    const adoptCreatedChallenge = (created: PublicChallengeView) => {
      const url = new URL(window.location.href);
      url.searchParams.set('surface', 'compiler');
      url.searchParams.set('challenge', created.challenge_id);
      window.history.replaceState({challengeSurface: 'COMPILER'}, '', url);
      window.sessionStorage.removeItem('rekt-inkubator-create-draft-v1');
      setChallengeView(created);
      setChallengePhase('IDLE');
      setCreatePhase('IDLE');
    };

    setCreatePhase('LOADING');
    try {
      const created = await api.createDraftChallenge({
        request_id: draftRequestId,
        challenge_id: draftChallengeId,
        slot_limit: slot,
        activation_minimum: activation,
        entry_deadline_ms: entryMs,
        build_start_ms: buildMs,
        submission_deadline_ms: submissionMs,
        appeal_window_ms: Math.round(appealHours * 60 * 60 * 1000),
        review_deadline_ms: reviewMs,
      });
      adoptCreatedChallenge(created);
    } catch (cause) {
      if (cause instanceof InkubatorApiError && cause.status === 401) {
        setCreatePhase('AUTH_REQUIRED');
        return;
      }
      try {
        const recovered = await api.getChallenge(draftChallengeId);
        adoptCreatedChallenge(recovered);
        return;
      } catch {
        setCreatePhase('ERROR');
      }
    }
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
    setChallengeView(null);
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

  return (
    <div className="compiler-foundation">
      <section className="compiler-intake" aria-labelledby="compiler-intake-title">
        <small>CREATE / DRAFT</small>
        <h2 id="compiler-intake-title">WHAT DO YOU WANT BUILT?</h2>
        <p>Say it normally. You can tighten the rules before anything gets locked.</p>
        <label htmlFor="compiler-source-intent">BUILD BRIEF</label>
        <textarea
          id="compiler-source-intent"
          value={sourceIntent}
          onChange={(event) => { setSourceIntent(event.target.value); invalidate(); }}
          placeholder="Example: Build a public dashboard that tracks…"
          rows={6}
        />

        <fieldset className="compiler-requirements">
          <legend>IMPORTANT BUILD DECISIONS / YES · NO · NOT SURE</legend>
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
                  >{answer === 'UNKNOWN' ? 'NOT SURE' : answer}</button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <div className="compiler-intake__actions">
          <button type="button" disabled={!sourceIntent.trim() || compilePhase === 'LOADING'} onClick={() => void compile('SOURCE')}>
            {compilePhase === 'LOADING' ? 'CHECKING…' : 'CHECK THE SPEC →'}
          </button>
          <button type="button" disabled={!compilerState || compilePhase === 'LOADING'} onClick={() => void compile('ORGANIZER_ACCEPTED')}>
            USE THESE RULES →
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
        <small>BUILD CONTRACT / REVIEW</small>
        <h2 id="compiler-contract-title">WHAT COUNTS AS DONE</h2>
        <p>Review the exact rules builders will compete against. Technical contract evidence stays inspectable, but nothing is locked until the final server-confirmed step.</p>

        {!challengeId ? (
          <section className="compiler-draft-setup" aria-labelledby="compiler-draft-setup-title">
            <small>CHALLENGE SETUP / DRAFT</small>
            <h3 id="compiler-draft-setup-title">SET THE BUILD WINDOW</h3>
            <p>Create the real draft Challenge first. No payout rail is configured and nothing here authorizes production money.</p>
            <div className="compiler-contract__fields">
              <label htmlFor="draft-slots">BUILDER SLOTS<input id="draft-slots" inputMode="numeric" value={slotLimit} onChange={(event) => setSlotLimit(event.target.value)} placeholder="6" /></label>
              <label htmlFor="draft-activation">MINIMUM BUILDERS<input id="draft-activation" inputMode="numeric" value={activationMinimum} onChange={(event) => setActivationMinimum(event.target.value)} placeholder="2" /></label>
              <label htmlFor="draft-entry-deadline">JOIN CLOSES<input id="draft-entry-deadline" type="datetime-local" value={entryDeadline} onChange={(event) => setEntryDeadline(event.target.value)} /></label>
              <label htmlFor="draft-build-start">BUILD STARTS<input id="draft-build-start" type="datetime-local" value={buildStart} onChange={(event) => setBuildStart(event.target.value)} /></label>
              <label htmlFor="draft-submit-deadline">SUBMIT BY<input id="draft-submit-deadline" type="datetime-local" value={submissionDeadline} onChange={(event) => setSubmissionDeadline(event.target.value)} /></label>
              <label htmlFor="draft-review-deadline">REVIEW BY<input id="draft-review-deadline" type="datetime-local" value={reviewDeadline} onChange={(event) => setReviewDeadline(event.target.value)} /></label>
              <label htmlFor="draft-appeal-window">APPEAL WINDOW / HOURS<input id="draft-appeal-window" inputMode="decimal" value={appealWindowHours} onChange={(event) => setAppealWindowHours(event.target.value)} placeholder="24" /></label>
            </div>
            <div className="compiler-contract__actions">
              <button type="button" disabled={createPhase === 'LOADING'} onClick={() => void createDraftChallenge()}>
                {createPhase === 'LOADING' ? 'CREATING DRAFT…' : 'CREATE DRAFT CHALLENGE'}
              </button>
              <span>{createPhase === 'AUTH_REQUIRED' ? 'SIGN IN REQUIRED' : createPhase === 'ERROR' ? 'DRAFT CREATION FAILED' : 'NOTHING IS LOCKED YET'}</span>
            </div>
            {createPhase === 'AUTH_REQUIRED' ? <p className="compiler-contract__notice">SIGN IN TO CREATE THIS DRAFT. <a href="/v1/auth/github/start">CONTINUE WITH GITHUB →</a></p> : null}
            {createPhase === 'ERROR' ? <p className="compiler-contract__notice">THE DRAFT COULD NOT BE CREATED. CHECK THE SCHEDULE AND TRY AGAIN.</p> : null}
          </section>
        ) : null}
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
          <label htmlFor="contract-version">VERSION<input id="contract-version" value={contractVersion} onChange={(event) => { setContractVersion(event.target.value); invalidatePreview(); }} placeholder="1.0.0" /></label>
          <label htmlFor="contract-title">CHALLENGE TITLE<input id="contract-title" value={contractTitle} onChange={(event) => { setContractTitle(event.target.value); invalidatePreview(); }} placeholder="Challenge title" /></label>
          <label htmlFor="contract-prize">PRIZE / TEST VALUE<input id="contract-prize" inputMode="numeric" value={prizeMinorUnits} onChange={(event) => { setPrizeMinorUnits(event.target.value); invalidatePreview(); }} placeholder="100" /></label>
          <label htmlFor="contract-asset">TEST SETTLEMENT ASSET<input id="contract-asset" value={settlementAsset} onChange={(event) => { setSettlementAsset(event.target.value); invalidatePreview(); }} placeholder="TEST" /></label>
        </div>

        <div className="compiler-contract__actions">
          <button type="button" disabled={!previewReady} onClick={() => void previewContract()}>
            {previewPhase === 'LOADING' ? 'PREPARING REVIEW…' : 'REVIEW LOCKED VERSION'}
          </button>
          <button type="button" disabled={!persistReady} onClick={() => void persistContract()}>
            {persistPhase === 'LOADING' ? 'LOCKING RULES…' : 'LOCK CHALLENGE RULES'}
          </button>
          <span>{canonicalContract ? 'CANONICAL / PERSISTED' : preview ? 'AUTHENTICATED ORGANIZER REQUIRED TO PERSIST' : !accepted ? 'ORGANIZER ACCEPTANCE REQUIRED' : compilerState?.status !== 'READY' ? 'COMPILER MUST BE READY' : !challengeReadyForPreview ? 'UNFROZEN DRAFT CHALLENGE REQUIRED' : 'PREVIEW FIRST / NO PERSISTENCE YET'}</span>
        </div>

        {previewPhase === 'ERROR' ? <p className="compiler-contract__notice">PREVIEW REJECTED — authority, readiness or Build Contract validation failed. Nothing was persisted.</p> : null}
        {persistPhase === 'ERROR' ? <p className="compiler-contract__notice">CANONICAL PERSISTENCE REJECTED — authentication, organizer authority, preview lineage or idempotency validation failed.</p> : null}
        {preview ? (
          <div className="compiler-contract__result" data-build-contract-preview="noncanonical">
            <strong>PREVIEW / NOT LOCKED</strong>
            <span>TERMS DIGEST <code>{preview.contract.terms_digest}</code></span>
            <pre>{JSON.stringify(preview.contract, null, 2)}</pre>
          </div>
        ) : null}
        {canonicalContract ? (
          <div className="compiler-contract__result" data-build-contract-canonical="persisted">
            <strong>RULES LOCKED</strong>
            <span>TERMS DIGEST <code>{canonicalContract.terms_digest}</code></span>
            <span>CONTRACT {canonicalContract.contract_version} · FROZEN {canonicalContract.frozen_at}</span>
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
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Your build view is not connected yet.">
      <p>This will appear only when a canonical Challenge entry projection is available. Existing Project progress is not substituted.</p>
    </StatePanel>
  );
}

function ReviewSurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Review is not connected in this forward flow yet.">
      <p>Qualification and comparison must come from the canonical Challenge evaluation path; no legacy substitute is shown.</p>
    </StatePanel>
  );
}

function HistorySurface() {
  return (
    <StatePanel state="UNAVAILABLE_OR_STALE" title="Challenge history is not connected yet.">
      <p>Only canonical Challenge receipts will appear here. Historical Ship UI is not substituted.</p>
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

  const challengeContext = new URLSearchParams(window.location.search).get('challenge');
  const primarySurfaces = useMemo<ChallengeSurface[]>(
    () => challengeContext || surface === 'CHALLENGE' ? ['DISCOVER', 'COMPILER', 'CHALLENGE'] : ['DISCOVER', 'COMPILER'],
    [challengeContext, surface],
  );

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
        <span className="challenge-purpose">BUILD CHALLENGES</span>
        <div className="challenge-topbar__right">
          <span className="challenge-authority">LOCK THE RULES. SHIP THE THING.</span>
          <GitHubSessionWidget api={api} />
        </div>
      </header>

      <section className="challenge-heading">
        <div>
          <small>{String(currentIndex + 1).padStart(2, '0')} / {String(CHALLENGE_SURFACES.length).padStart(2, '0')} · {SURFACE_CUES[surface]}</small>
          <h1>{surface === 'DISCOVER' ? 'CHALLENGES' : surface === 'COMPILER' ? 'CREATE A CHALLENGE' : SURFACE_LABELS[surface]}</h1>
          <p>DESCRIBE → LOCK WHAT “DONE” MEANS → BUILD → CHECK → RECEIPT</p>
        </div>
        <div className="challenge-heading__readout" aria-label="Product readout">
          <span>RULES<b>VERSIONED</b></span>
          <span>STATE<b>SOURCE-BOUND</b></span>
          <span>SETTLEMENT<b>DISABLED</b></span>
        </div>
      </section>

      <section className="challenge-chassis">
        <nav className="challenge-nav" aria-label="Challenge product">
          <span className="challenge-nav__label">GO TO</span>
          {primarySurfaces.map((item) => {
            const index = CHALLENGE_SURFACES.indexOf(item);
            return (
            <button
              key={item}
              type="button"
              aria-current={item === surface ? 'page' : undefined}
              onClick={() => selectSurface(item)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <b>{item === 'DISCOVER' ? 'CHALLENGES' : item === 'COMPILER' ? 'CREATE' : 'CHALLENGE'}</b>
              <small>{item === 'DISCOVER' ? 'FIND A BUILD' : item === 'COMPILER' ? 'DEFINE THE RULES' : 'READ THE RULES'}</small>
            </button>
          )})}
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
