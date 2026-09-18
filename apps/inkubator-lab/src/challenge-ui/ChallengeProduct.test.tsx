import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import ChallengeProduct, {type ChallengeProductApi} from './ChallengeProduct';
import type {
  BuildContractPreviewView,
  CanonicalBuildContractView,
  CompilerProposalInput,
  CompilerStateView,
  PublicChallengeView,
} from '../inkubator-api';
import {CHALLENGE_SURFACES, parseChallengeSurface, SURFACE_STATES} from './state';

const compilerState: CompilerStateView = {
  schema_version: 'inkubator.compiler-state/1.0',
  compiler_version: 'inkubator.compiler/1.0',
  source_intent: 'Build a realtime public launch dashboard',
  project_fingerprint: {project_class: 'WEB_REALTIME', signals: ['realtime']},
  knowledge: [],
  requirements: [{key: 'realtime', value: true, provenance: 'SOURCE'}],
  production_envelope: {
    criteria: [],
    facts: [{key: 'realtime_transport_required', value: true, provenance: 'DETERMINISTIC_RULE', rule_id: 'R_REALTIME_V1'}],
  },
  risk_profile: {level: 'MEDIUM', reasons: ['R_REALTIME_V1: MEDIUM']},
  quality_profile: {level: 'STANDARD', reasons: []},
  blueprint_candidates: [{id: 'WEB_REALTIME', version: '1.0.0'}],
  selected_blueprint: {id: 'WEB_REALTIME', version: '1.0.0'},
  causal_facts: [{key: 'realtime_transport_required', value: true, provenance: 'DETERMINISTIC_RULE', rule_id: 'R_REALTIME_V1'}],
  sensitivity_points: ['realtime transport and state synchronization'],
  outcome_contract_candidate: {criteria: []},
  delivery_contract_candidate: {criteria: []},
  preferences: {},
  acceptance_plan: {modules: ['realtime-consistency']},
  questions: [{id: 'Q_REALTIME_TRANSPORT', prompt: 'Which realtime transport/state consistency guarantees are actually required?', blocking: true, rule_id: 'R_REALTIME_V1'}],
  findings: [],
  unresolved_decisions: [{id: 'QUESTION:Q_REALTIME_TRANSPORT', reason: 'Which realtime transport/state consistency guarantees are actually required?'}],
  reference_architecture_candidate: {shape: 'REALTIME_WEB_APP'},
  status: 'NEEDS_DECISION',
};

function readyCompilerState(provenance: 'SOURCE' | 'ORGANIZER_ACCEPTED'): CompilerStateView {
  return {
    schema_version: 'inkubator.compiler-state/1.0',
    compiler_version: 'inkubator.compiler/1.0',
    source_intent: 'Build a public static launch page',
    project_fingerprint: {project_class: 'WEB_STATIC', signals: []},
    knowledge: [],
    requirements: [{key: 'realtime', value: false, provenance}],
    production_envelope: {criteria: [], facts: []},
    risk_profile: {level: 'LOW', reasons: []},
    quality_profile: {level: 'STANDARD', reasons: []},
    blueprint_candidates: [{id: 'WEB_STATIC', version: '1.0.0'}],
    selected_blueprint: {id: 'WEB_STATIC', version: '1.0.0'},
    causal_facts: [],
    sensitivity_points: [],
    outcome_contract_candidate: {criteria: []},
    delivery_contract_candidate: {criteria: []},
    preferences: {},
    acceptance_plan: {modules: []},
    questions: [],
    findings: [],
    unresolved_decisions: [],
    reference_architecture_candidate: {shape: 'STATIC_WEB_APP'},
    status: 'READY',
  };
}

const publicContractSummary = {
  contract_version: '1',
  terms_digest: 'terms-digest',
  title: 'Public launch Challenge',
  brief: 'Build the public launch experience described by the locked rules.',
  outcome_criteria: [{id: 'outcome-1', description: 'The launch state is visible.', mandatory: true}],
  production_criteria: [],
  delivery_criteria: [],
  normative_constraints: [],
  normative_references: [],
  informational_references: [],
  prize_minor_units: 100,
  settlement_asset: 'TEST',
};

const publicChallenge: PublicChallengeView = {
  schema_version: 'challenge.public.v1',
  challenge_id: '11111111-1111-4111-8111-111111111111',
  status: 'ENTRY_OPEN',
  mechanism_version: 'mechanism.v1',
  settlement_policy_version: 'settlement.v1',
  ip_terms_version: 'ip.v1',
  current_contract_version: '1',
  current_terms_digest: 'terms-digest',
  has_frozen_contract: true,
  contract_summary: publicContractSummary,
  slot_limit: 4,
  activation_minimum: 2,
  entry_deadline: '2026-09-20T00:00:00.000Z',
  build_start: '2026-09-21T00:00:00.000Z',
  submission_deadline: '2026-09-28T00:00:00.000Z',
  appeal_window_ms: 3600000,
  review_deadline: '2026-09-30T00:00:00.000Z',
  entry_count: 2,
  submission_count: 0,
  qualification_count: 0,
  receipt_count: 0,
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
};

const draftChallenge: PublicChallengeView = {
  ...publicChallenge,
  status: 'DRAFT',
  mechanism_version: 'funded-challenge/1.1',
  settlement_policy_version: 'funded-challenge-settlement/1.0',
  ip_terms_version: 'bespoke-winner-transfer/1.0',
  current_contract_version: null,
  current_terms_digest: null,
  has_frozen_contract: false,
  contract_summary: null,
  entry_deadline: '2026-09-20T00:00:00.000Z',
  build_start: '2026-09-20T00:00:00.000Z',
  entry_count: 0,
};

const contractPreview: BuildContractPreviewView = {
  schema_version: 'build-contract.preview.v1',
  canonical: false,
  persisted: false,
  contract: {
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: draftChallenge.challenge_id,
    contract_version: '1.0.0',
    title: 'Static launch Challenge',
    brief: 'Build a public static launch page',
    terms_digest: 'a'.repeat(64),
  },
};

const canonicalContract: CanonicalBuildContractView = {
  schema_version: 'build-contract.canonical.v1',
  canonical: true,
  persisted: true,
  challenge_id: draftChallenge.challenge_id,
  contract_version: '1.0.0',
  terms_digest: contractPreview.contract.terms_digest,
  frozen_at: '2026-09-14T00:30:00.000Z',
};

const frozenDraftChallenge: PublicChallengeView = {
  ...draftChallenge,
  current_contract_version: canonicalContract.contract_version,
  current_terms_digest: canonicalContract.terms_digest,
  has_frozen_contract: true,
  contract_summary: {
    ...publicContractSummary,
    contract_version: canonicalContract.contract_version,
    terms_digest: canonicalContract.terms_digest,
    title: 'Static launch Challenge',
    brief: 'Build a public static launch page',
  },
};

function api(overrides: Partial<ChallengeProductApi> = {}): ChallengeProductApi {
  return {
    compileChallenge: vi.fn(async (_body: CompilerProposalInput) => compilerState),
    getChallenge: vi.fn(async () => publicChallenge),
    previewBuildContract: vi.fn(async () => contractPreview),
    persistBuildContract: vi.fn(async () => canonicalContract),
    ...overrides,
  };
}

function moveToRealtimeRequirement() {
  for (let index = 0; index < 3; index += 1) {
    fireEvent.click(screen.getByRole('button', {name: 'NEXT DETAIL →'}));
  }
  const row = screen.getByText('REALTIME').closest('.compiler-requirement');
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

function finishClarificationAfterRealtime(answer: 'YES' | 'NO') {
  const row = moveToRealtimeRequirement();
  fireEvent.click(within(row).getByRole('button', {name: answer}));
  for (let index = 0; index < 7; index += 1) {
    fireEvent.click(screen.getByRole('button', {name: 'NEXT DETAIL →'}));
  }
  fireEvent.click(screen.getByRole('button', {name: 'DONE WITH DETAILS ✓'}));
}

function enterGuidedCompilerInput(source: string, realtime: 'YES' | 'NO') {
  fireEvent.change(screen.getByLabelText('YOUR IDEA'), {target: {value: source}});
  finishClarificationAfterRealtime(realtime);
  fireEvent.change(screen.getByPlaceholderText(/The dashboard always shows the current launch state after reload/i), {
    target: {value: 'The finished experience visibly satisfies the requested outcome.'},
  });
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Stage E Challenge product shell', () => {
  it('locks the seven-surface Challenge IA and excludes the historical five-mode navigation', () => {
    render(<ChallengeProduct api={api()} />);
    const nav = screen.getByRole('navigation', {name: 'Challenge product'});
    expect(within(nav).getAllByRole('button')).toHaveLength(7);
    expect(CHALLENGE_SURFACES).toEqual(['DISCOVER', 'COMPILER', 'CHALLENGE', 'MY_BUILD', 'REVIEW', 'HISTORY', 'OPERATOR']);
    expect(within(nav).queryByText('WORLD')).toBeNull();
    expect(within(nav).queryByText('COMMAND')).toBeNull();
    expect(within(nav).queryByText('PROJECT')).toBeNull();
    expect(within(nav).queryByText('PLAYER')).toBeNull();
    expect(within(nav).queryByText('SHIP')).toBeNull();
  });

  it('uses an explicit unavailable state instead of legacy discovery data', () => {
    render(<ChallengeProduct api={api()} />);
    expect(screen.getByText(/Challenge discovery transport is not exposed yet/i)).toBeTruthy();
    expect(screen.getByText(/Historical World, Project and social discovery routes are intentionally not substituted/i)).toBeTruthy();
    expect(document.querySelector('[data-surface-state="unavailable_or_stale"]')).toBeTruthy();
  });

  it('compiles only explicit SOURCE requirements and renders deterministic compiler state', async () => {
    const compileChallenge = vi.fn(async (_body: CompilerProposalInput) => compilerState);
    render(<ChallengeProduct api={api({compileChallenge})} />);
    fireEvent.click(screen.getByRole('button', {name: /COMPILER \/ CREATE/i}));

    enterGuidedCompilerInput('Build a realtime public launch dashboard', 'YES');
    fireEvent.click(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}));

    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));
    const proposal = compileChallenge.mock.calls[0]![0];
    expect(proposal.source_intent).toBe('Build a realtime public launch dashboard');
    expect(proposal.requirements).toEqual([{key: 'realtime', value: true, provenance: 'SOURCE'}]);
    expect(screen.getAllByText(/Which realtime transport\/state consistency guarantees/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Technical compiler details'));
    expect(screen.getByText('WEB_REALTIME@1.0.0')).toBeTruthy();
    expect(screen.getByText('NEEDS_DECISION')).toBeTruthy();
    expect(screen.getAllByText(/realtime_transport_required/).length).toBeGreaterThan(0);
    expect(screen.getByText(/QUESTION:Q_REALTIME_TRANSPORT/)).toBeTruthy();
    expect(screen.getByText('SOURCE', {selector: 'small'})).toBeTruthy();
  });

  it('makes blocking compiler follow-ups answerable and feeds them back as authoritative knowledge', async () => {
    const resolvedState: CompilerStateView = {
      ...compilerState,
      knowledge: [{kind: 'KNOWN', key: 'Q_REALTIME_TRANSPORT', material: true, value: 'WebSocket updates with server-authoritative ordering.', provenance: 'SOURCE'}],
      unresolved_decisions: [],
      status: 'READY',
    };
    const compileChallenge = vi.fn(async (body: CompilerProposalInput) => (
      body.knowledge.some((item) => item.key === 'Q_REALTIME_TRANSPORT' && item.value)
        ? resolvedState
        : compilerState
    ));
    render(<ChallengeProduct api={api({compileChallenge})} />);
    fireEvent.click(screen.getByRole('button', {name: /COMPILER \/ CREATE/i}));

    enterGuidedCompilerInput('Build a realtime public launch dashboard', 'YES');
    fireEvent.click(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}));
    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));

    const followUp = screen.getByLabelText(/Which realtime transport\/state consistency guarantees are actually required/i);
    fireEvent.change(followUp, {target: {value: 'WebSocket updates with server-authoritative ordering.'}});
    fireEvent.click(screen.getByRole('button', {name: 'CHECK AGAIN →'}));

    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(2));
    expect(compileChallenge.mock.calls[1]![0].knowledge).toEqual([{
      kind: 'KNOWN',
      key: 'Q_REALTIME_TRANSPORT',
      material: true,
      value: 'WebSocket updates with server-authoritative ordering.',
      provenance: 'SOURCE',
    }]);
    expect(screen.getByText('REVIEW THE RULES')).toBeTruthy();
    expect((screen.getByRole('button', {name: 'USE THESE RULES'}) as HTMLButtonElement).disabled).toBe(false);
  });

  it('routes an unsupported compiler choice directly back to the blocking requirement', async () => {
    const unsupportedState: CompilerStateView = {
      ...compilerState,
      requirements: [{key: 'custody_private_keys', value: true, provenance: 'SOURCE'}],
      questions: [],
      unresolved_decisions: [],
      findings: [{
        severity: 'HIGH',
        code: 'PRIVATE_KEY_CUSTODY',
        message: 'Private-key custody/signing authority is unsupported for Stage D and pre-production Alpha.',
        rule_id: 'R_PRIVATE_KEY_CUSTODY_V1',
      }],
      status: 'UNSUPPORTED',
    };
    const compileChallenge = vi.fn(async () => unsupportedState);
    render(<ChallengeProduct api={api({compileChallenge})} />);
    fireEvent.click(screen.getByRole('button', {name: /COMPILER \/ CREATE/i}));

    enterGuidedCompilerInput('Build a wallet-assisted app', 'NO');
    fireEvent.click(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}));
    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));

    expect(screen.getByText('ONE OF YOUR CHOICES NEEDS CHANGING')).toBeTruthy();
    const change = screen.getByRole('button', {name: 'CHANGE PRIVATE-KEY CUSTODY ANSWER →'});
    fireEvent.click(change);
    const custodyRow = screen.getByText('PRIVATE-KEY CUSTODY').closest('.compiler-requirement');
    expect(custodyRow).not.toBeNull();
    expect(within(custodyRow as HTMLElement).getByText(/Would the product itself hold or sign with private keys/i)).toBeTruthy();
    fireEvent.click(within(custodyRow as HTMLElement).getByRole('button', {name: 'NO'}));
    expect((screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}) as HTMLButtonElement).disabled).toBe(false);
  });

  it('binds canonical persistence to the exact accepted preview digest and refreshes Challenge truth', async () => {
    const sourceState = readyCompilerState('SOURCE');
    const acceptedState = readyCompilerState('ORGANIZER_ACCEPTED');
    const compileChallenge = vi.fn(async (body: CompilerProposalInput) => (
      body.requirements.some((item) => item.provenance === 'ORGANIZER_ACCEPTED') ? acceptedState : sourceState
    ));
    const getChallenge = vi.fn()
      .mockResolvedValueOnce(draftChallenge)
      .mockResolvedValueOnce(frozenDraftChallenge);
    const previewBuildContract = vi.fn(async () => contractPreview);
    const persistBuildContract = vi.fn<ChallengeProductApi['persistBuildContract']>(async () => canonicalContract);
    window.history.replaceState({}, '', `/?surface=compiler&challenge=${draftChallenge.challenge_id}`);
    render(<ChallengeProduct api={api({compileChallenge, getChallenge, previewBuildContract, persistBuildContract})} />);

    await waitFor(() => expect(getChallenge).toHaveBeenCalledWith(draftChallenge.challenge_id));
    enterGuidedCompilerInput('Build a public static launch page', 'NO');
    fireEvent.click(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}));

    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));
    expect(screen.getByText('REVIEW THE RULES')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'PREVIEW LOCKED RULES'})).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: 'USE THESE RULES'}));
    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(2));
    expect(compileChallenge.mock.calls[1]![0].requirements).toEqual([
      {key: 'realtime', value: false, provenance: 'ORGANIZER_ACCEPTED'},
    ]);

    const previewButton = screen.getByRole('button', {name: 'PREVIEW LOCKED RULES'}) as HTMLButtonElement;
    const persistButton = screen.getByRole('button', {name: 'LOCK THESE RULES'}) as HTMLButtonElement;
    expect(previewButton.disabled).toBe(true);
    expect(persistButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('CHALLENGE TITLE'), {target: {value: 'Static launch Challenge'}});
    expect(previewButton.disabled).toBe(false);
    fireEvent.click(previewButton);

    await waitFor(() => expect(previewBuildContract).toHaveBeenCalledTimes(1));
    const acceptedAuthority = expect.objectContaining({
      contract_version: '1.0.0',
      title: 'Static launch Challenge',
      brief: 'Build a public static launch page',
      prize_minor_units: 100,
      settlement_asset: 'TEST',
    });
    expect(previewBuildContract).toHaveBeenCalledWith(draftChallenge.challenge_id, acceptedState, acceptedAuthority);
    expect(screen.getByText('PREVIEW ONLY · NOT LOCKED YET', {selector: 'strong'})).toBeTruthy();
    expect(document.querySelector('[data-build-contract-preview="noncanonical"]')).toBeTruthy();
    expect(persistButton.disabled).toBe(false);

    fireEvent.click(persistButton);
    await waitFor(() => expect(persistBuildContract).toHaveBeenCalledTimes(1));
    const [persistChallengeId, requestId, persistState, persistAuthority, expectedDigest] = persistBuildContract.mock.calls[0]!;
    expect(persistChallengeId).toBe(draftChallenge.challenge_id);
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(persistState).toEqual(acceptedState);
    expect(persistAuthority).toEqual(expect.objectContaining({contract_version: '1.0.0', title: 'Static launch Challenge'}));
    expect(expectedDigest).toBe(contractPreview.contract.terms_digest);
    await waitFor(() => expect(getChallenge).toHaveBeenCalledTimes(2));
    expect(screen.getByText('OPEN IT TO BUILDERS')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'LOCK THESE RULES'})).toBeNull();
  });

  it('reads a canonical public Challenge projection instead of Mission or Project state', async () => {
    const getChallenge = vi.fn(async () => publicChallenge);
    window.history.replaceState({}, '', `/?surface=challenge&challenge=${publicChallenge.challenge_id}`);
    render(<ChallengeProduct api={api({getChallenge})} />);

    await waitFor(() => expect(getChallenge).toHaveBeenCalledWith(publicChallenge.challenge_id));
    expect(screen.getByText('READ IT, THEN JOIN')).toBeTruthy();
    expect(screen.getByRole('heading', {name: publicContractSummary.title})).toBeTruthy();
    expect(screen.getByText(publicContractSummary.brief)).toBeTruthy();
    expect(screen.getByText('The launch state is visible.')).toBeTruthy();
    expect(screen.getByText(/PUBLIC LOCKED-RULE PROJECTION ONLY/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain('Mission');
    expect(document.body.textContent).not.toContain('Project state');
  });

  it('normalizes deep-link surface names and exposes the full canonical state vocabulary', () => {
    expect(parseChallengeSurface('my-build')).toBe('MY_BUILD');
    expect(parseChallengeSurface('history')).toBe('HISTORY');
    expect(parseChallengeSurface('world')).toBeUndefined();
    expect(SURFACE_STATES).toEqual(['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'UNAVAILABLE_OR_STALE', 'UNAUTHORIZED']);
  });
});