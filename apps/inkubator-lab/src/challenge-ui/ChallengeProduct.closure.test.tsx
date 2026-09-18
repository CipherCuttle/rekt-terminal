import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import ChallengeProduct, {type ChallengeProductApi} from './ChallengeProduct';
import type {
  BuildContractPreviewView,
  CanonicalBuildContractView,
  CompilerInputProvenance,
  CompilerProposalInput,
  CompilerStateView,
  PublicChallengeView,
} from '../inkubator-api';

const challenge: PublicChallengeView = {
  schema_version: 'challenge.public.v1',
  challenge_id: '11111111-1111-4111-8111-111111111111',
  status: 'DRAFT',
  mechanism_version: 'funded-challenge/1.1',
  settlement_policy_version: 'funded-challenge-settlement/1.0',
  ip_terms_version: 'bespoke-winner-transfer/1.0',
  current_contract_version: null,
  current_terms_digest: null,
  has_frozen_contract: false,
  slot_limit: 4,
  activation_minimum: 2,
  entry_deadline: '2026-09-20T00:00:00.000Z',
  build_start: '2026-09-20T00:00:00.000Z',
  submission_deadline: '2026-09-28T00:00:00.000Z',
  appeal_window_ms: 3600000,
  review_deadline: '2026-09-30T00:00:00.000Z',
  entry_count: 0,
  submission_count: 0,
  qualification_count: 0,
  receipt_count: 0,
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
};

const readableChallenge: PublicChallengeView = {
  ...challenge,
  status: 'ENTRY_OPEN',
  current_contract_version: '1.0.0',
  current_terms_digest: 'a'.repeat(64),
  has_frozen_contract: true,
  contract_summary: {
    contract_version: '1.0.0',
    terms_digest: 'a'.repeat(64),
    title: 'Readable Challenge',
    brief: 'A public locked rule summary for builders.',
    outcome_criteria: [{id: 'outcome-1', description: 'The required outcome is observable.', mandatory: true}],
    production_criteria: [],
    delivery_criteria: [],
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  },
};

const compilerState: CompilerStateView = {
  schema_version: 'inkubator.compiler-state/1.0',
  compiler_version: 'inkubator.compiler/1.0',
  source_intent: 'Build a realtime public launch dashboard',
  project_fingerprint: {project_class: 'WEB_REALTIME', signals: ['realtime']},
  knowledge: [],
  requirements: [{key: 'realtime', value: true, provenance: 'SOURCE'}],
  production_envelope: {
    criteria: [{
      id: 'production.realtime',
      description: 'Realtime consistency must be mechanically testable.',
      mandatory: true,
      provenance: 'DETERMINISTIC_RULE',
    }],
    facts: [{
      key: 'realtime_transport_required',
      value: true,
      provenance: 'DETERMINISTIC_RULE',
      rule_id: 'R_REALTIME_V1',
    }],
  },
  risk_profile: {level: 'HIGH', reasons: ['R_REALTIME_V1: HIGH']},
  quality_profile: {level: 'STRICT', reasons: ['realtime correctness']},
  blueprint_candidates: [{id: 'WEB_REALTIME', version: '1.0.0'}],
  selected_blueprint: {id: 'WEB_REALTIME', version: '1.0.0'},
  causal_facts: [{key: 'realtime_transport_required', value: true, provenance: 'DETERMINISTIC_RULE', rule_id: 'R_REALTIME_V1'}],
  sensitivity_points: ['realtime transport and state synchronization'],
  outcome_contract_candidate: {criteria: []},
  delivery_contract_candidate: {criteria: []},
  preferences: {},
  acceptance_plan: {modules: ['realtime-consistency']},
  questions: [{id: 'Q_REALTIME_TRANSPORT', prompt: 'Which realtime consistency guarantee is required?', blocking: true, rule_id: 'R_REALTIME_V1'}],
  findings: [{severity: 'HIGH', code: 'REALTIME_AMBIGUITY', message: 'Realtime transport semantics are unresolved.', rule_id: 'R_REALTIME_V1'}],
  unresolved_decisions: [{id: 'QUESTION:Q_REALTIME_TRANSPORT', reason: 'Realtime transport must be chosen.'}],
  reference_architecture_candidate: {shape: 'REALTIME_WEB_APP'},
  status: 'NEEDS_DECISION',
};

function staticCompilerState(provenance: CompilerInputProvenance = 'SOURCE'): CompilerStateView {
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

const preview: BuildContractPreviewView = {
  schema_version: 'build-contract.preview.v1',
  canonical: false,
  persisted: false,
  contract: {
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challenge.challenge_id,
    contract_version: '1.0.0',
    title: 'Challenge',
    brief: 'Build it',
    terms_digest: 'a'.repeat(64),
  },
};

const canonical: CanonicalBuildContractView = {
  schema_version: 'build-contract.canonical.v1',
  canonical: true,
  persisted: true,
  challenge_id: challenge.challenge_id,
  contract_version: '1.0.0',
  terms_digest: 'a'.repeat(64),
  frozen_at: '2026-09-14T00:00:00.000Z',
};

function api(overrides: Partial<ChallengeProductApi> = {}): ChallengeProductApi {
  return {
    compileChallenge: vi.fn(async (_body: CompilerProposalInput) => compilerState),
    getChallenge: vi.fn(async () => challenge),
    previewBuildContract: vi.fn(async () => preview),
    persistBuildContract: vi.fn(async () => canonical),
    ...overrides,
  };
}

function currentState(): string | null {
  return document.querySelector('[data-surface-state]')?.getAttribute('data-surface-state') ?? null;
}

function currentRealtimeRequirementRow(): HTMLElement {
  const row = screen.getByText('REALTIME').closest('.compiler-requirement');
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

function moveToRealtimeRequirement(): HTMLElement {
  for (let index = 0; index < 3; index += 1) {
    fireEvent.click(screen.getByRole('button', {name: 'NEXT DETAIL →'}));
  }
  return currentRealtimeRequirementRow();
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

function returnToRealtimeRequirement(): HTMLElement {
  const requirementGuide = document.querySelector('.compiler-requirements--guided');
  expect(requirementGuide).not.toBeNull();
  for (let index = 0; index < 7; index += 1) {
    fireEvent.click(within(requirementGuide as HTMLElement).getByRole('button', {name: '← BACK'}));
  }
  return currentRealtimeRequirementRow();
}

afterEach(() => {
  cleanup();
  window.sessionStorage.removeItem('inkubator.compiler-draft.v1');
  window.history.replaceState({}, '', '/');
});

describe('Stage E closure matrix', () => {
  it('keeps all seven forward surfaces truthful without parked legacy substitution', () => {
    render(<ChallengeProduct api={api()} />);
    const nav = screen.getByRole('navigation', {name: 'Challenge product'});

    expect(currentState()).toBe('unavailable_or_stale');

    fireEvent.click(within(nav).getByRole('button', {name: /COMPILER \/ CREATE/i}));
    expect(currentState()).toBe('empty');

    fireEvent.click(within(nav).getByRole('button', {name: /^03.*CHALLENGE/i}));
    expect(currentState()).toBe('empty');

    fireEvent.click(within(nav).getByRole('button', {name: /MY BUILD/i}));
    expect(currentState()).toBe('unavailable_or_stale');
    expect(screen.getByText(/Project progress is not treated as Challenge authority/i)).toBeTruthy();

    fireEvent.click(within(nav).getByRole('button', {name: /REVIEW \/ TEST ARENA/i}));
    expect(currentState()).toBe('unavailable_or_stale');
    expect(screen.getByText(/Stage G owns reveal/i)).toBeTruthy();

    fireEvent.click(within(nav).getByRole('button', {name: /RECEIPT \/ HISTORY/i}));
    expect(currentState()).toBe('unavailable_or_stale');
    expect(screen.getByText(/historical Ship UI is not substituted/i)).toBeTruthy();

    fireEvent.click(within(nav).getByRole('button', {name: /OPERATOR EXCEPTIONS/i}));
    expect(currentState()).toBe('unauthorized');
  });

  it('exercises Challenge loading, readable and error states without fabricating fallback data', async () => {
    let resolveChallenge: ((value: PublicChallengeView) => void) | undefined;
    const pendingChallenge = new Promise<PublicChallengeView>((resolve) => { resolveChallenge = resolve; });
    const getChallenge = vi.fn(() => pendingChallenge);
    window.history.replaceState({}, '', `/?surface=challenge&challenge=${challenge.challenge_id}`);
    const {unmount} = render(<ChallengeProduct api={api({getChallenge})} />);

    expect(currentState()).toBe('loading');
    resolveChallenge?.(readableChallenge);
    await waitFor(() => expect(screen.getByRole('heading', {name: 'Readable Challenge'})).toBeTruthy());
    expect(screen.getByText('A public locked rule summary for builders.')).toBeTruthy();
    expect(screen.getByText('The required outcome is observable.')).toBeTruthy();
    unmount();

    const failedGetChallenge: ChallengeProductApi['getChallenge'] = vi.fn(async () => {
      throw new Error('transport_down');
    });
    render(<ChallengeProduct api={api({getChallenge: failedGetChallenge})} />);
    await waitFor(() => expect(currentState()).toBe('error'));
    expect(screen.getByText(/will not substitute mutable Mission or Project state/i)).toBeTruthy();
  });

  it('exposes Production Envelope and findings as real CompilerState evidence', async () => {
    const compileChallenge: ChallengeProductApi['compileChallenge'] = vi.fn(async () => compilerState);
    window.history.replaceState({}, '', '/?surface=compiler');
    render(<ChallengeProduct api={api({compileChallenge})} />);

    enterGuidedCompilerInput(compilerState.source_intent, 'YES');
    fireEvent.click(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}));

    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Technical compiler details'));
    expect(screen.getByRole('heading', {name: 'PRODUCTION ENVELOPE'})).toBeTruthy();
    expect(screen.getByText('production.realtime')).toBeTruthy();
    expect(screen.getAllByText(/realtime_transport_required/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', {name: 'FINDINGS'})).toBeTruthy();
    expect(screen.getByText(/HIGH \/ REALTIME_AMBIGUITY/)).toBeTruthy();
    expect(screen.getByText(/Realtime transport semantics are unresolved/)).toBeTruthy();
  });

  it('visibly changes deterministic readouts when a meaningful requirement changes', async () => {
    const compileChallenge: ChallengeProductApi['compileChallenge'] = vi.fn(async (body: CompilerProposalInput) => (
      body.requirements.some((item) => item.key === 'realtime' && item.value === true)
        ? compilerState
        : staticCompilerState('SOURCE')
    ));
    window.history.replaceState({}, '', '/?surface=compiler');
    render(<ChallengeProduct api={api({compileChallenge})} />);

    enterGuidedCompilerInput('Build a public launch experience', 'YES');
    fireEvent.click(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}));
    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Technical compiler details'));
    expect(screen.getByText('WEB_REALTIME@1.0.0')).toBeTruthy();
    expect(screen.getByText('HIGH', {selector: 'b'})).toBeTruthy();
    expect(screen.getAllByText(/realtime_transport_required/).length).toBeGreaterThan(0);

    const realtimeRow = returnToRealtimeRequirement();
    fireEvent.click(within(realtimeRow).getByRole('button', {name: 'NO'}));
    fireEvent.click(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}));
    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByText('Technical compiler details'));
    expect(screen.getByText('WEB_STATIC@1.0.0')).toBeTruthy();
    expect(screen.getByText('LOW', {selector: 'b'})).toBeTruthy();
    expect(screen.queryAllByText(/realtime_transport_required/)).toHaveLength(0);
  });

  it('discards a stale organizer-accept response after the source draft changes', async () => {
    let resolveAccepted: ((value: CompilerStateView) => void) | undefined;
    const pendingAccepted = new Promise<CompilerStateView>((resolve) => { resolveAccepted = resolve; });
    const sourceState = staticCompilerState('SOURCE');
    const acceptedState = staticCompilerState('ORGANIZER_ACCEPTED');
    const compileChallenge: ChallengeProductApi['compileChallenge'] = vi.fn((body: CompilerProposalInput) => (
      body.requirements.some((item) => item.provenance === 'ORGANIZER_ACCEPTED')
        ? pendingAccepted
        : Promise.resolve(sourceState)
    ));
    window.history.replaceState({}, '', `/?surface=compiler&challenge=${challenge.challenge_id}`);
    render(<ChallengeProduct api={api({compileChallenge})} />);

    enterGuidedCompilerInput('Build the first draft', 'NO');
    fireEvent.click(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}));
    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', {name: 'USE THESE RULES'}));
    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('YOUR IDEA'), {target: {value: 'Build the edited second draft'}});
    expect(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'})).toBeTruthy();

    resolveAccepted?.(acceptedState);
    await waitFor(() => expect(screen.queryByRole('button', {name: 'PREVIEW LOCKED RULES'})).toBeNull());
    expect(screen.queryByRole('button', {name: 'USE THESE RULES'})).toBeNull();
    expect(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'})).toBeTruthy();
  });

  it('keeps canonical persistence successful when only the post-write projection refresh fails', async () => {
    const sourceState = staticCompilerState('SOURCE');
    const acceptedState = staticCompilerState('ORGANIZER_ACCEPTED');
    const compileChallenge: ChallengeProductApi['compileChallenge'] = vi.fn(async (body: CompilerProposalInput) => (
      body.requirements.some((item) => item.provenance === 'ORGANIZER_ACCEPTED') ? acceptedState : sourceState
    ));
    const getChallenge: ChallengeProductApi['getChallenge'] = vi.fn()
      .mockResolvedValueOnce(challenge)
      .mockRejectedValueOnce(new Error('projection_refresh_down'));
    const previewBuildContract: ChallengeProductApi['previewBuildContract'] = vi.fn(async () => preview);
    const persistBuildContract: ChallengeProductApi['persistBuildContract'] = vi.fn(async () => canonical);
    window.history.replaceState({}, '', `/?surface=compiler&challenge=${challenge.challenge_id}`);
    render(<ChallengeProduct api={api({compileChallenge, getChallenge, previewBuildContract, persistBuildContract})} />);

    await waitFor(() => expect(getChallenge).toHaveBeenCalledTimes(1));
    enterGuidedCompilerInput('Build a public static launch page', 'NO');
    fireEvent.click(screen.getByRole('button', {name: 'CHECK MY CHALLENGE'}));
    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', {name: 'USE THESE RULES'}));
    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText('CHALLENGE TITLE'), {target: {value: 'Challenge'}});
    fireEvent.click(screen.getByRole('button', {name: 'PREVIEW LOCKED RULES'}));
    await waitFor(() => expect(previewBuildContract).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', {name: 'LOCK THESE RULES'}));

    await waitFor(() => expect(persistBuildContract).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getChallenge).toHaveBeenCalledTimes(2));
    expect(screen.getByText('CANONICAL / PERSISTED', {selector: 'strong'})).toBeTruthy();
    expect(screen.getByText(/CANONICAL CONTRACT PERSISTED — CHALLENGE PROJECTION REFRESH UNAVAILABLE/i)).toBeTruthy();
    expect(screen.queryByText(/CANONICAL PERSISTENCE REJECTED/i)).toBeNull();
    expect(document.querySelector('[data-build-contract-canonical="persisted"]')).toBeTruthy();
  });
});