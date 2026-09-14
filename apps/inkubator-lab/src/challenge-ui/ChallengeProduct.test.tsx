import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import ChallengeProduct, {type ChallengeProductApi} from './ChallengeProduct';
import type {CompilerStateView, PublicChallengeView} from '../inkubator-api';
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
  acceptance_plan: {modules: ['realtime-consistency']},
  questions: [{id: 'Q_REALTIME_TRANSPORT', prompt: 'Which realtime transport/state consistency guarantees are actually required?', blocking: true, rule_id: 'R_REALTIME_V1'}],
  findings: [],
  unresolved_decisions: [{id: 'QUESTION:Q_REALTIME_TRANSPORT', reason: 'Which realtime transport/state consistency guarantees are actually required?'}],
  reference_architecture_candidate: {shape: 'REALTIME_WEB_APP'},
  status: 'NEEDS_DECISION',
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

function api(overrides: Partial<ChallengeProductApi> = {}): ChallengeProductApi {
  return {
    compileChallenge: vi.fn(async () => compilerState),
    getChallenge: vi.fn(async () => publicChallenge),
    ...overrides,
  };
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
    const compileChallenge = vi.fn(async () => compilerState);
    render(<ChallengeProduct api={api({compileChallenge})} />);
    fireEvent.click(screen.getByRole('button', {name: /COMPILER \/ CREATE/i}));

    const source = screen.getByLabelText('SOURCE INTENT');
    fireEvent.change(source, {target: {value: 'Build a realtime public launch dashboard'}});
    const realtimeRow = screen.getByText('REALTIME').closest('.compiler-requirement');
    expect(realtimeRow).not.toBeNull();
    fireEvent.click(within(realtimeRow as HTMLElement).getByRole('button', {name: 'YES'}));
    fireEvent.click(screen.getByRole('button', {name: /COMPILE DETERMINISTIC STATE/i}));

    await waitFor(() => expect(compileChallenge).toHaveBeenCalledTimes(1));
    const proposal = compileChallenge.mock.calls[0][0];
    expect(proposal.source_intent).toBe('Build a realtime public launch dashboard');
    expect(proposal.requirements).toEqual([{key: 'realtime', value: true, provenance: 'SOURCE'}]);
    expect(screen.getByText('WEB_REALTIME@1.0.0')).toBeTruthy();
    expect(screen.getByText('NEEDS_DECISION')).toBeTruthy();
    expect(screen.getByText(/realtime_transport_required/)).toBeTruthy();
    expect(screen.getByText(/Q_REALTIME_TRANSPORT/)).toBeTruthy();
  });

  it('reads a canonical public Challenge projection instead of Mission or Project state', async () => {
    const getChallenge = vi.fn(async () => publicChallenge);
    window.history.replaceState({}, '', `/?surface=challenge&challenge=${publicChallenge.challenge_id}`);
    render(<ChallengeProduct api={api({getChallenge})} />);

    await waitFor(() => expect(getChallenge).toHaveBeenCalledWith(publicChallenge.challenge_id));
    expect(screen.getByText('Challenge ENTRY_OPEN.')).toBeTruthy();
    expect(screen.getByText('terms-digest')).toBeTruthy();
    expect(screen.getByText(/PUBLIC PROJECTION ONLY/i)).toBeTruthy();
    expect(document.querySelector('[data-surface-state="normal"]')).toBeTruthy();
  });

  it('normalizes deep-link surface names and exposes the full canonical state vocabulary', () => {
    expect(parseChallengeSurface('my-build')).toBe('MY_BUILD');
    expect(parseChallengeSurface('history')).toBe('HISTORY');
    expect(parseChallengeSurface('world')).toBeUndefined();
    expect(SURFACE_STATES).toEqual(['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'UNAVAILABLE_OR_STALE', 'UNAUTHORIZED']);
  });
});
