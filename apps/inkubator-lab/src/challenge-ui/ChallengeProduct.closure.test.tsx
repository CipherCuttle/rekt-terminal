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

afterEach(() => {
  cleanup();
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

  it('exercises Challenge loading, normal and error states without fabricating fallback data', async () => {
    let resolveChallenge: ((value: PublicChallengeView) => void) | undefined;
    const pendingChallenge = new Promise<PublicChallengeView>((resolve) => { resolveChallenge = resolve; });
    const getChallenge = vi.fn(() => pendingChallenge);
    window.history.replaceState({}, '', `/?surface=challenge&challenge=${challenge.challenge_id}`);
    const {unmount} = render(<ChallengeProduct api={api({getChallenge})} />);

    expect(currentState()).toBe('loading');
    resolveChallenge?.(challenge);
    await waitFor(() => expect(currentState()).toBe('normal'));
    expect(screen.getByText('Challenge DRAFT.')).toBeTruthy();
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

    fireEvent.change(screen.getByLabelText('SOURCE INTENT'), {target: {value: compilerState.source_intent}});
    const realtimeRow = screen.getByText('REALTIME').closest('.compiler-requirement');
    expect(realtimeRow).not.toBeNull();
    fireEvent.click(within(realtimeRow as HTMLElement).getByRole('button', {name: 'YES'}));
    fireEvent.click(screen.getByRole('button', {name: /COMPILE DETERMINISTIC STATE/i}));

    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', {name: 'PRODUCTION ENVELOPE'})).toBeTruthy();
    expect(screen.getByText('production.realtime')).toBeTruthy();
    expect(screen.getAllByText(/realtime_transport_required/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', {name: 'FINDINGS'})).toBeTruthy();
    expect(screen.getByText(/HIGH \/ REALTIME_AMBIGUITY/)).toBeTruthy();
    expect(screen.getByText(/Realtime transport semantics are unresolved/)).toBeTruthy();
  });
});
