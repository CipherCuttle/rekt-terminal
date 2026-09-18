import {useEffect, useMemo, useState, type ReactNode} from 'react';
import type {
  BuilderCapsuleView,
  ChallengeReceiptTransportView,
  PublicChallengeView,
  QualifierComparisonView,
  RevealArenaView,
  StageIChallengeCreateInput,
  StageIChallengeEntryView,
  StageIQualificationInput,
  StageIQualificationView,
  StageISelectionInput,
  StageISelectionView,
  StageISubmitCredentialView,
  TestArenaModuleCatalogView,
} from '../inkubator-api';
import type {SurfaceState} from './state';

export interface StageIProductApi {
  getMe?(): Promise<unknown>;
  createChallenge?(input: StageIChallengeCreateInput): Promise<PublicChallengeView>;
  launchStageIMockChallenge?(challengeId: string, requestId: string): Promise<PublicChallengeView>;
  joinChallenge?(challengeId: string, requestId: string, entryId: string, expectedTermsDigest: string): Promise<StageIChallengeEntryView>;
  getMyBuild?(challengeId: string): Promise<BuilderCapsuleView>;
  mintSubmitCredential?(challengeId: string, requestId: string, expiresInSeconds?: number): Promise<StageISubmitCredentialView>;
  getRevealArena?(challengeId: string): Promise<RevealArenaView>;
  getTestArenaModules?(): Promise<TestArenaModuleCatalogView>;
  qualifyEntry?(challengeId: string, entryId: string, input: StageIQualificationInput): Promise<StageIQualificationView>;
  getQualifierComparison?(challengeId: string): Promise<QualifierComparisonView>;
  selectQualifier?(challengeId: string, input: StageISelectionInput): Promise<StageISelectionView>;
  getReceipts?(challengeId: string): Promise<ChallengeReceiptTransportView>;
  getChallenge(challengeId: string): Promise<PublicChallengeView>;
}

const STATE_COPY: Record<SurfaceState, string> = {
  NORMAL: 'LIVE / SOURCE-BOUND',
  LOADING: 'LOADING / NO FABRICATION',
  EMPTY: 'EMPTY / NO CANONICAL DATA',
  ERROR: 'ERROR / LAST TRUSTWORTHY VALUE ONLY',
  UNAVAILABLE_OR_STALE: 'UNAVAILABLE / DO NOT SUBSTITUTE LEGACY DATA',
  UNAUTHORIZED: 'UNAUTHORIZED / FAIL CLOSED',
};

function StageIPanel({state, title, children}: {state: SurfaceState; title: string; children: ReactNode}) {
  return (
    <section className="challenge-state" data-surface-state={state.toLowerCase()} aria-live={state === 'ERROR' ? 'assertive' : 'polite'}>
      <div className="challenge-state__status"><span aria-hidden="true" />{STATE_COPY[state]}</div>
      <h2>{title}</h2>
      <div className="challenge-state__body">{children}</div>
    </section>
  );
}

function currentChallengeId(): string | null {
  return new URLSearchParams(window.location.search).get('challenge');
}

function localInputValue(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function initialSchedule() {
  const now = Date.now();
  return {
    entry: localInputValue(new Date(now + 30 * 60_000)),
    submission: localInputValue(new Date(now + 24 * 60 * 60_000)),
    review: localInputValue(new Date(now + 26 * 60 * 60_000)),
  };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'transport_failed';
}

function challengeLink(challengeId: string, surface: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('challenge', challengeId);
  url.searchParams.set('surface', surface);
  return `${url.pathname}${url.search}${url.hash}`;
}

function githubLoginHref(): string {
  const returnTo = new URL(window.location.href);
  returnTo.searchParams.set('surface', 'compiler');
  returnTo.searchParams.delete('auth');
  const login = new URL('/v1/auth/github/start', window.location.origin);
  login.searchParams.set('return_to', `${returnTo.pathname}${returnTo.search}${returnTo.hash}`);
  return `${login.pathname}${login.search}`;
}

export function StageIOrganizerBridge({api, challenge: suppliedChallenge, onChallengeChanged}: {api: StageIProductApi; challenge?: PublicChallengeView | null; onChallengeChanged?: (challenge: PublicChallengeView) => void}) {
  const challengeId = currentChallengeId();
  const [schedule] = useState(initialSchedule);
  const [slots, setSlots] = useState('3');
  const [activationMinimum, setActivationMinimum] = useState('1');
  const [entryDeadline, setEntryDeadline] = useState(schedule.entry);
  const [submissionDeadline, setSubmissionDeadline] = useState(schedule.submission);
  const [reviewDeadline, setReviewDeadline] = useState(schedule.review);
  const [appealMinutes, setAppealMinutes] = useState('60');
  const [launchedChallenge, setLaunchedChallenge] = useState<PublicChallengeView | null>(null);
  const [phase, setPhase] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState<string | null>(null);
  const [authState, setAuthState] = useState<'CHECKING' | 'CONNECTED' | 'REQUIRED' | 'UNKNOWN'>(() => api.getMe ? 'CHECKING' : 'UNKNOWN');
  const challenge = launchedChallenge ?? suppliedChallenge ?? null;
  const organizerTitle = !challengeId
    ? 'SET UP THE CHALLENGE'
    : challenge?.status === 'DRAFT'
      ? 'OPEN TO BUILDERS'
      : challenge?.status === 'ENTRY_OPEN'
        ? 'CHALLENGE IS OPEN'
        : 'CHALLENGE IN PROGRESS';
  const organizerDescription = !challengeId
    ? 'Choose how many builders can join and when each part of the Challenge closes.'
    : challenge?.status === 'DRAFT'
      ? 'Your rules stay locked. Opening the Challenge lets builders join under those exact terms.'
      : challenge?.status === 'ENTRY_OPEN'
        ? 'Builders can join now under the locked rules.'
        : `Setup is complete. Canonical state: ${challenge?.status ?? 'READING'}.`;

  useEffect(() => {
    if (!api.getMe) {
      setAuthState('UNKNOWN');
      return;
    }
    let cancelled = false;
    setAuthState('CHECKING');
    void api.getMe().then(() => {
      if (!cancelled) setAuthState('CONNECTED');
    }).catch((cause) => {
      if (cancelled) return;
      const nextMessage = cause instanceof Error ? cause.message : '';
      setAuthState(nextMessage === 'authentication_required' ? 'REQUIRED' : 'UNKNOWN');
    });
    return () => { cancelled = true; };
  }, [api]);

  const create = async () => {
    if (!api.createChallenge || authState === 'REQUIRED' || authState === 'CHECKING') return;
    const slotLimit = Number(slots);
    const activation = Number(activationMinimum);
    const entryMs = new Date(entryDeadline).getTime();
    const submissionMs = new Date(submissionDeadline).getTime();
    const reviewMs = new Date(reviewDeadline).getTime();
    const appealMs = Number(appealMinutes) * 60_000;
    if (
      !Number.isSafeInteger(slotLimit) || slotLimit < 1
      || !Number.isSafeInteger(activation) || activation < 1 || activation > slotLimit
      || !Number.isFinite(entryMs) || !Number.isFinite(submissionMs) || !Number.isFinite(reviewMs)
      || !(entryMs < submissionMs && submissionMs < reviewMs)
      || !Number.isSafeInteger(appealMs) || appealMs < 1
    ) {
      setMessage('invalid_stage_i_schedule');
      return;
    }
    setPhase('LOADING');
    setMessage(null);
    try {
      const view = await api.createChallenge({
        request_id: crypto.randomUUID(),
        challenge_id: crypto.randomUUID(),
        slot_limit: slotLimit,
        activation_minimum: activation,
        entry_deadline_ms: entryMs,
        submission_deadline_ms: submissionMs,
        appeal_window_ms: appealMs,
        review_deadline_ms: reviewMs,
      });
      onChallengeChanged?.(view);
      setPhase('IDLE');
    } catch (cause) {
      const nextMessage = errorMessage(cause);
      if (nextMessage === 'authentication_required') setAuthState('REQUIRED');
      setMessage(nextMessage);
      setPhase('ERROR');
    }
  };

  const launch = async () => {
    if (!challengeId || !api.launchStageIMockChallenge) return;
    setPhase('LOADING');
    setMessage(null);
    try {
      const view = await api.launchStageIMockChallenge(challengeId, crypto.randomUUID());
      setLaunchedChallenge(view);
      onChallengeChanged?.(view);
      setPhase('IDLE');
    } catch (cause) {
      setMessage(errorMessage(cause));
      setPhase('ERROR');
    }
  };

  if (!api.createChallenge || !api.launchStageIMockChallenge) return null;

  return (
    <section className="compiler-contract" aria-labelledby="stage-i-organizer-title">
      <small>{challengeId ? 'STEP 5 / OPEN' : 'STEP 3 / SET UP'}</small>
      <h2 id="stage-i-organizer-title">{organizerTitle}</h2>
      <p>{organizerDescription} <b>THIS REHEARSAL USES TEST VALUE ONLY.</b></p>

      {!challengeId ? (
        <>
          <p>These settings create the draft container for the rules you just reviewed. Nothing opens to builders yet.</p>
          {authState === 'REQUIRED' ? (
            <div className="challenge-auth-gate" role="status">
              <b>CONNECT GITHUB BEFORE CREATING THE DRAFT</b>
              <span>Your GitHub identity becomes the Challenge creator. Public browsing stays available without login.</span>
            </div>
          ) : authState === 'CHECKING' ? (
            <div className="challenge-auth-gate" role="status">
              <b>CHECKING GITHUB SESSION…</b>
              <span>Creation stays disabled until organizer identity is known.</span>
            </div>
          ) : null}
          <div className="compiler-contract__fields">
            <label htmlFor="stage-i-slots">BUILDER SLOTS<input id="stage-i-slots" inputMode="numeric" value={slots} onChange={(event) => setSlots(event.target.value)} /></label>
            <label htmlFor="stage-i-activation">MINIMUM BUILDERS TO START<input id="stage-i-activation" inputMode="numeric" value={activationMinimum} onChange={(event) => setActivationMinimum(event.target.value)} /></label>
            <label htmlFor="stage-i-entry">ENTRY DEADLINE<input id="stage-i-entry" type="datetime-local" value={entryDeadline} onChange={(event) => setEntryDeadline(event.target.value)} /></label>
            <label htmlFor="stage-i-submission">SUBMISSION DEADLINE<input id="stage-i-submission" type="datetime-local" value={submissionDeadline} onChange={(event) => setSubmissionDeadline(event.target.value)} /></label>
            <label htmlFor="stage-i-review">REVIEW DEADLINE<input id="stage-i-review" type="datetime-local" value={reviewDeadline} onChange={(event) => setReviewDeadline(event.target.value)} /></label>
            <label htmlFor="stage-i-appeal">REVIEW APPEAL WINDOW / MINUTES<input id="stage-i-appeal" inputMode="numeric" value={appealMinutes} onChange={(event) => setAppealMinutes(event.target.value)} /></label>
          </div>
          <div className="compiler-contract__actions">
            {authState === 'REQUIRED' ? (
              <a className="journey-next-action journey-next-action--link challenge-auth-login" href={githubLoginHref()}>CONNECT GITHUB TO CREATE →</a>
            ) : (
              <button type="button" className={phase === 'LOADING' || authState === 'CHECKING' ? undefined : 'journey-next-action'} disabled={phase === 'LOADING' || authState === 'CHECKING'} onClick={() => void create()}>
                {phase === 'LOADING' ? 'CREATING DRAFT…' : authState === 'CHECKING' ? 'CHECKING GITHUB…' : 'CREATE DRAFT CHALLENGE'}
              </button>
            )}
            <span>DRAFT ONLY · NOT OPEN TO BUILDERS · NO REAL VALUE</span>
          </div>
        </>
      ) : (
        <>
          <dl className="challenge-facts" aria-label="Stage I mock launch authority">
            <div><dt>CHALLENGE</dt><dd><code>{challengeId}</code></dd></div>
            <div><dt>STATE</dt><dd>{challenge?.status ?? 'READING'}</dd></div>
            <div><dt>CONTRACT</dt><dd>{challenge?.has_frozen_contract ? 'FROZEN' : 'NOT FROZEN'}</dd></div>
            <div><dt>VALUE</dt><dd>TEST ONLY / REAL VALUE FALSE</dd></div>
          </dl>
          <div className="compiler-contract__actions">
            {challenge?.status === 'DRAFT' ? (
              <button
                type="button"
                className={phase !== 'LOADING' && challenge.has_frozen_contract ? 'journey-next-action' : undefined}
                disabled={phase === 'LOADING' || !challenge.has_frozen_contract}
                onClick={() => void launch()}
              >{phase === 'LOADING' ? 'OPENING…' : 'OPEN CHALLENGE / TEST ONLY'}</button>
            ) : null}
            <span>{challenge?.status === 'ENTRY_OPEN' ? 'OPEN · BUILDERS CAN JOIN' : challenge?.status === 'DRAFT' ? !challenge.has_frozen_contract ? 'LOCK THE RULES FIRST' : 'READY TO OPEN · SERVER VALIDATES THE TRANSITION' : challenge ? `CURRENT STATE · ${challenge.status}` : 'READING CANONICAL STATE'}</span>
          </div>
        </>
      )}
      {message ? <p className="compiler-contract__notice">{message}</p> : null}
    </section>
  );
}

export function StageIJoinBridge({api, onJoined}: {api: StageIProductApi; onJoined?: (entry: StageIChallengeEntryView) => void}) {
  const challengeId = currentChallengeId();
  const [challenge, setChallenge] = useState<PublicChallengeView | null>(null);
  const [joined, setJoined] = useState<StageIChallengeEntryView | null>(null);
  const [phase, setPhase] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId || !api.joinChallenge) return;
    let cancelled = false;
    void api.getChallenge(challengeId).then((view) => {
      if (!cancelled) setChallenge(view);
    }).catch(() => {
      if (!cancelled) setChallenge(null);
    });
    return () => { cancelled = true; };
  }, [api, challengeId]);

  if (!challengeId || !api.joinChallenge) return null;

  const join = async () => {
    if (!challenge?.current_terms_digest || challenge.status !== 'ENTRY_OPEN') return;
    setPhase('LOADING');
    setMessage(null);
    try {
      const view = await api.joinChallenge!(
        challengeId,
        crypto.randomUUID(),
        crypto.randomUUID(),
        challenge.current_terms_digest,
      );
      setJoined(view);
      onJoined?.(view);
      setPhase('IDLE');
    } catch (cause) {
      setMessage(errorMessage(cause));
      setPhase('ERROR');
    }
  };

  return (
    <section className="compiler-contract" aria-labelledby="stage-i-join-title">
      <small>BUILDER / JOIN</small>
      <h2 id="stage-i-join-title">READY TO JOIN?</h2>
      <p>Joining means you are building against the exact locked rules shown above. If those terms do not match, the server refuses the entry.</p>
      <div className="compiler-contract__actions">
        <button type="button" className={phase !== 'LOADING' && challenge?.current_terms_digest && challenge.status === 'ENTRY_OPEN' && !joined ? 'journey-next-action' : undefined} disabled={phase === 'LOADING' || !challenge?.current_terms_digest || challenge.status !== 'ENTRY_OPEN' || Boolean(joined)} onClick={() => void join()}>
          {phase === 'LOADING' ? 'JOINING…' : 'JOIN THIS CHALLENGE'}
        </button>
        <span>{joined ? `ENTRY ${joined.entry_id}` : challenge?.status === 'ENTRY_OPEN' ? 'CURRENT TERMS REQUIRED' : 'ENTRY IS NOT OPEN'}</span>
      </div>
      {joined ? <p className="compiler-contract__notice">YOU'RE IN · {joined.state} · <a className="journey-next-action journey-next-action--link" href={challengeLink(challengeId, 'my-build')}>CONTINUE TO MY BUILD →</a></p> : null}
      {message ? <p className="compiler-contract__notice">{message}</p> : null}
    </section>
  );
}

export function StageIMyBuildSurface({api}: {api: StageIProductApi}) {
  const challengeId = currentChallengeId();
  const [capsule, setCapsule] = useState<BuilderCapsuleView | null>(null);
  const [credential, setCredential] = useState<StageISubmitCredentialView | null>(null);
  const [phase, setPhase] = useState<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>(challengeId ? 'LOADING' : 'EMPTY');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId || !api.getMyBuild) {
      setPhase('EMPTY');
      return;
    }
    let cancelled = false;
    setPhase('LOADING');
    void api.getMyBuild(challengeId).then((view) => {
      if (cancelled) return;
      setCapsule(view);
      setPhase('NORMAL');
    }).catch((cause) => {
      if (cancelled) return;
      setMessage(errorMessage(cause));
      setPhase('ERROR');
    });
    return () => { cancelled = true; };
  }, [api, challengeId]);

  const instructions = useMemo(() => {
    if (!capsule || !credential) return '';
    const endpoint = `${window.location.origin}/v1/challenges/${capsule.challenge_id}/submissions`;
    const body = JSON.stringify({
      request_id: '<REQUEST_UUID>',
      submission_id: '<SUBMISSION_UUID>',
      entry_id: capsule.entry_id,
      expected_terms_digest: capsule.terms_digest,
      submission_version: 1,
      immutable_source_reference: {kind: 'GIT_COMMIT', value: '<IMMUTABLE_COMMIT_SHA>'},
      artifact_digest: '<SHA256_ARTIFACT_DIGEST>',
      evidence_references: ['<EVIDENCE_REFERENCE>'],
    }, null, 2);
    return `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer ${credential.token}' \\
  -H 'Content-Type: application/json' \\
  --data '${body}'`;
  }, [capsule, credential]);

  if (!challengeId) return <StageIPanel state="EMPTY" title="No Challenge selected."><p>Open My Build with a canonical <code>?challenge=&lt;id&gt;</code> context.</p></StageIPanel>;
  if (!api.getMyBuild || !api.mintSubmitCredential) return <StageIPanel state="UNAVAILABLE_OR_STALE" title="Stage I builder transport is unavailable."><p>No legacy Project state is substituted.</p></StageIPanel>;
  if (phase === 'LOADING') return <StageIPanel state="LOADING" title="Reading canonical Builder Capsule."><p><code>{challengeId}</code></p></StageIPanel>;
  if (phase === 'ERROR' || !capsule) return <StageIPanel state="ERROR" title="Builder Capsule unavailable."><p>{message ?? 'builder_capsule_unavailable'}</p><p>No private entry data is guessed or substituted.</p></StageIPanel>;

  const mint = async () => {
    setMessage(null);
    try {
      const issued = await api.mintSubmitCredential!(challengeId, crypto.randomUUID(), 3600);
      setCredential(issued);
    } catch (cause) {
      setMessage(errorMessage(cause));
    }
  };

  return (
    <StageIPanel state="NORMAL" title={`My Build / ${capsule.entry_state}.`}>
      <dl className="challenge-facts" aria-label="Canonical Builder Capsule">
        <div><dt>CHALLENGE</dt><dd><code>{capsule.challenge_id}</code></dd></div>
        <div><dt>ENTRY</dt><dd><code>{capsule.entry_id}</code></dd></div>
        <div><dt>CONTRACT</dt><dd>{capsule.contract_version}</dd></div>
        <div><dt>TERMS</dt><dd><code>{capsule.terms_digest}</code></dd></div>
        <div><dt>DEADLINE</dt><dd>{capsule.submission_deadline}</dd></div>
      </dl>
      <h3>BUILDER CAPSULE FILES</h3>
      {capsule.files.map((file) => (
        <details key={file.path}>
          <summary>{file.path} · {file.media_type} · <code>{file.sha256}</code></summary>
          <pre>{file.content}</pre>
        </details>
      ))}
      <div className="compiler-contract__actions">
        <button type="button" onClick={() => void mint()} disabled={Boolean(credential)}>MINT 1H SUBMIT CREDENTIAL</button>
        <span>CLI / <code>challenge:submit</code> ONLY / MEMORY ONLY</span>
      </div>
      <p className="challenge-state__foot">The browser does not perform immutable final submission. The credential is held only in this React state; reloading clears it. It is not written to localStorage.</p>
      {credential ? (
        <div className="compiler-contract__result" data-stage-i-submit-credential="issued">
          <strong>FINAL-SUBMISSION CREDENTIAL / COPY NOW</strong>
          <span>SCOPE <code>{credential.scopes.join(', ')}</code> · EXPIRES {credential.expires_at}</span>
          <label htmlFor="stage-i-submit-token">BEARER TOKEN</label>
          <textarea id="stage-i-submit-token" readOnly rows={3} value={credential.token} />
          <label htmlFor="stage-i-submit-command">CLI EXAMPLE / EDIT PLACEHOLDERS BEFORE USE</label>
          <textarea id="stage-i-submit-command" readOnly rows={18} value={instructions} />
        </div>
      ) : null}
      {message ? <p className="compiler-contract__notice">{message}</p> : null}
    </StageIPanel>
  );
}

export function StageIReviewSurface({api}: {api: StageIProductApi}) {
  const challengeId = currentChallengeId();
  const [reveal, setReveal] = useState<RevealArenaView | null>(null);
  const [comparison, setComparison] = useState<QualifierComparisonView | null>(null);
  const [modules, setModules] = useState<TestArenaModuleCatalogView | null>(null);
  const [entryId, setEntryId] = useState('');
  const [manifestReferenceId, setManifestReferenceId] = useState('');
  const [manifestJson, setManifestJson] = useState('{}');
  const [observationsJson, setObservationsJson] = useState('[]');
  const [qualification, setQualification] = useState<StageIQualificationView | null>(null);
  const [selection, setSelection] = useState<StageISelectionView | null>(null);
  const [phase, setPhase] = useState<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>(challengeId ? 'LOADING' : 'EMPTY');
  const [notice, setNotice] = useState<string[]>([]);

  const refresh = async () => {
    if (!challengeId) return;
    setPhase('LOADING');
    const nextNotice: string[] = [];
    const [revealResult, moduleResult, comparisonResult] = await Promise.allSettled([
      api.getRevealArena?.(challengeId) ?? Promise.reject(new Error('reveal_transport_unavailable')),
      api.getTestArenaModules?.() ?? Promise.reject(new Error('test_module_transport_unavailable')),
      api.getQualifierComparison?.(challengeId) ?? Promise.reject(new Error('comparison_transport_unavailable')),
    ]);
    if (revealResult.status === 'fulfilled') {
      setReveal(revealResult.value);
      setEntryId((current) => current || revealResult.value.submissions[0]?.entry_id || '');
    } else {
      setReveal(null);
      nextNotice.push(errorMessage(revealResult.reason));
    }
    if (moduleResult.status === 'fulfilled') setModules(moduleResult.value);
    else { setModules(null); nextNotice.push(errorMessage(moduleResult.reason)); }
    if (comparisonResult.status === 'fulfilled') setComparison(comparisonResult.value);
    else { setComparison(null); nextNotice.push(errorMessage(comparisonResult.reason)); }
    setNotice(nextNotice);
    setPhase(revealResult.status === 'rejected' && moduleResult.status === 'rejected' && comparisonResult.status === 'rejected' ? 'ERROR' : 'NORMAL');
  };

  useEffect(() => { void refresh(); }, [challengeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!challengeId) return <StageIPanel state="EMPTY" title="No Challenge selected."><p>Open Review / Test Arena with a canonical Challenge context.</p></StageIPanel>;
  if (!api.getRevealArena || !api.getTestArenaModules || !api.qualifyEntry || !api.getQualifierComparison || !api.selectQualifier) {
    return <StageIPanel state="UNAVAILABLE_OR_STALE" title="Stage I organizer review transport is unavailable."><p>No hidden tests or substitute judging path is used.</p></StageIPanel>;
  }
  if (phase === 'LOADING' && !reveal && !modules && !comparison) return <StageIPanel state="LOADING" title="Reading reveal and Test Arena authority."><p><code>{challengeId}</code></p></StageIPanel>;

  const qualify = async () => {
    if (!entryId.trim() || !manifestReferenceId.trim()) return;
    try {
      const acceptanceManifest = JSON.parse(manifestJson) as Record<string, unknown>;
      const humanObservations = JSON.parse(observationsJson) as StageIQualificationInput['human_observations'];
      const result = await api.qualifyEntry!(challengeId, entryId.trim(), {
        request_id: crypto.randomUUID(),
        qualification_id: crypto.randomUUID(),
        acceptance_manifest_reference_id: manifestReferenceId.trim(),
        acceptance_manifest: acceptanceManifest,
        human_observations: humanObservations,
      });
      setQualification(result);
      setNotice([]);
      await refresh();
    } catch (cause) {
      setNotice([errorMessage(cause)]);
    }
  };

  const select = async (selectedEntryId: string) => {
    try {
      const result = await api.selectQualifier!(challengeId, {
        request_id: crypto.randomUUID(),
        decision_id: crypto.randomUUID(),
        selected_entry_id: selectedEntryId,
      });
      setSelection(result);
      setNotice([]);
      await refresh();
    } catch (cause) {
      setNotice([errorMessage(cause)]);
    }
  };

  return (
    <StageIPanel state={phase === 'ERROR' ? 'ERROR' : 'NORMAL'} title="Organizer Reveal / Test Arena / Selection.">
      <p>Only existing Stage G authority is projected here. There are no hidden criteria, no LLM judge, and no browser-generated acceptance semantics.</p>
      {notice.length ? <p className="compiler-contract__notice">CURRENT-LIFECYCLE / AUTHORITY NOTICE: {notice.join(' · ')}</p> : null}

      <h3>REVEAL ARENA</h3>
      {reveal ? (
        <>
          <p>CONTRACT {reveal.contract_version} · TERMS <code>{reveal.terms_digest}</code></p>
          <ul>{reveal.criteria.map((criterion) => <li key={criterion.criterion_id}><b>{criterion.group}</b> / {criterion.criterion_id} — {criterion.description}</li>)}</ul>
          {reveal.submissions.map((submission) => (
            <details key={submission.submission_id}>
              <summary>ENTRY {submission.entry_id} / SUBMISSION {submission.submission_id}</summary>
              <pre>{JSON.stringify(submission, null, 2)}</pre>
            </details>
          ))}
        </>
      ) : <p>Reveal is sealed or unavailable in the current lifecycle state.</p>}

      <h3>TRUSTED TEST MODULE CATALOG</h3>
      {modules ? <pre>{JSON.stringify(modules.modules, null, 2)}</pre> : <p>Module catalog unavailable.</p>}

      <h3>EXECUTE FROZEN ACCEPTANCE MANIFEST</h3>
      <p>The organizer must supply the already-frozen Stage-G acceptance manifest and reference. This UI deliberately does not convert the Builder Capsule manifest into qualification authority.</p>
      <div className="compiler-contract__fields">
        <label htmlFor="stage-i-qualify-entry">ENTRY ID<input id="stage-i-qualify-entry" value={entryId} onChange={(event) => setEntryId(event.target.value)} /></label>
        <label htmlFor="stage-i-manifest-ref">ACCEPTANCE MANIFEST REFERENCE<input id="stage-i-manifest-ref" value={manifestReferenceId} onChange={(event) => setManifestReferenceId(event.target.value)} /></label>
      </div>
      <label htmlFor="stage-i-manifest-json">FROZEN ACCEPTANCE MANIFEST JSON</label>
      <textarea id="stage-i-manifest-json" rows={12} value={manifestJson} onChange={(event) => setManifestJson(event.target.value)} />
      <label htmlFor="stage-i-observations-json">HUMAN OBSERVATIONS JSON</label>
      <textarea id="stage-i-observations-json" rows={8} value={observationsJson} onChange={(event) => setObservationsJson(event.target.value)} />
      <div className="compiler-contract__actions"><button type="button" onClick={() => void qualify()}>RUN TEST ARENA FOR ENTRY</button><span>SERVER VALIDATES FROZEN BINDINGS + FINAL SUBMISSION</span></div>
      {qualification ? <pre>{JSON.stringify(qualification, null, 2)}</pre> : null}

      <h3>FINAL QUALIFIERS / SELECTION</h3>
      {comparison ? (
        <>
          <p>{comparison.status} · {comparison.final_qualifier_ids.length} FINAL QUALIFIERS · SELECTED {comparison.selected_entry_id ?? 'NONE'}</p>
          {comparison.qualifiers.map((candidate) => (
            <div key={candidate.entry_id} className="compiler-contract__actions">
              <span><code>{candidate.entry_id}</code> / {candidate.submission_id}</span>
              <button type="button" disabled={Boolean(comparison.selected_entry_id)} onClick={() => void select(candidate.entry_id)}>SELECT QUALIFIER</button>
            </div>
          ))}
        </>
      ) : <p>Qualifier comparison is unavailable until the canonical lifecycle reaches selection.</p>}
      {selection ? <p className="compiler-contract__notice">SELECTION RECORDED / <code>{selection.selected_entry_id}</code> / {selection.decision_digest}</p> : null}
    </StageIPanel>
  );
}

export function StageIHistorySurface({api}: {api: StageIProductApi}) {
  const challengeId = currentChallengeId();
  const [receipts, setReceipts] = useState<ChallengeReceiptTransportView | null>(null);
  const [phase, setPhase] = useState<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>(challengeId ? 'LOADING' : 'EMPTY');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId || !api.getReceipts) {
      setPhase('EMPTY');
      return;
    }
    let cancelled = false;
    setPhase('LOADING');
    void api.getReceipts(challengeId).then((view) => {
      if (cancelled) return;
      setReceipts(view);
      setPhase('NORMAL');
    }).catch((cause) => {
      if (cancelled) return;
      setMessage(errorMessage(cause));
      setPhase('ERROR');
    });
    return () => { cancelled = true; };
  }, [api, challengeId]);

  if (!challengeId) return <StageIPanel state="EMPTY" title="No Challenge selected."><p>Open Receipt / History with a canonical Challenge context.</p></StageIPanel>;
  if (!api.getReceipts) return <StageIPanel state="UNAVAILABLE_OR_STALE" title="Receipt transport unavailable."><p>Historical Ship UI is not substituted.</p></StageIPanel>;
  if (phase === 'LOADING') return <StageIPanel state="LOADING" title="Reading durable Challenge receipts."><p><code>{challengeId}</code></p></StageIPanel>;
  if (phase === 'ERROR' || !receipts) return <StageIPanel state="ERROR" title="Receipt transport failed."><p>{message ?? 'challenge_receipt_transport_failed'}</p></StageIPanel>;
  if (receipts.receipts.length === 0) return <StageIPanel state="EMPTY" title="No durable Challenge receipts yet."><p>The UI does not infer settlement or selection from intermediate state.</p></StageIPanel>;

  return (
    <StageIPanel state="NORMAL" title={`${receipts.receipts.length} durable Challenge receipt${receipts.receipts.length === 1 ? '' : 's'}.`}>
      {receipts.receipts.map((receipt) => (
        <details key={receipt.protocol_receipt_id}>
          <summary>{receipt.schema_version} / {receipt.protocol_receipt_id}</summary>
          <pre>{JSON.stringify(receipt, null, 2)}</pre>
        </details>
      ))}
      <p className="challenge-state__foot">SAFE RECEIPT PROJECTION ONLY — private archive internals are not exposed.</p>
    </StageIPanel>
  );
}
