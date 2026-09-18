import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {
  BuilderCapsuleView,
  ChallengeReceiptTransportView,
  PublicChallengeView,
  QualifierComparisonView,
  RevealArenaView,
  StageIChallengeCreateInput,
  StageIQualificationInput,
  StageIQualificationView,
  StageISubmitCredentialView,
  TestArenaModuleCatalogView,
} from '../inkubator-api';
import {
  StageIHistorySurface,
  StageIJoinBridge,
  StageIMyBuildSurface,
  StageIOrganizerBridge,
  StageIReviewSurface,
  type StageIProductApi,
} from './StageIAlphaBridge';

const challengeId = '11111111-1111-4111-8111-111111111111';
const entryId = '22222222-2222-4222-8222-222222222222';
const termsDigest = 'a'.repeat(64);

const draft: PublicChallengeView = {
  schema_version: 'challenge.public.v1',
  challenge_id: challengeId,
  status: 'DRAFT',
  mechanism_version: 'funded-challenge/1.1',
  settlement_policy_version: 'funded-challenge-settlement/1.0',
  ip_terms_version: 'bespoke-winner-transfer/1.0',
  current_contract_version: 'stage-i-alpha-v1',
  current_terms_digest: termsDigest,
  has_frozen_contract: true,
  slot_limit: 3,
  activation_minimum: 1,
  entry_deadline: '2030-01-01T00:00:00.000Z',
  build_start: '2030-01-01T00:00:00.000Z',
  submission_deadline: '2030-01-02T00:00:00.000Z',
  appeal_window_ms: 3_600_000,
  review_deadline: '2030-01-03T00:00:00.000Z',
  entry_count: 0,
  submission_count: 0,
  qualification_count: 0,
  receipt_count: 0,
  created_at: '2026-09-17T00:00:00.000Z',
  updated_at: '2026-09-17T00:00:00.000Z',
};

const entryOpen: PublicChallengeView = {...draft, status: 'ENTRY_OPEN'};

function baseApi(overrides: Partial<StageIProductApi> = {}): StageIProductApi {
  return {
    getChallenge: vi.fn(async () => draft),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('Stage I alpha browser bridge', () => {
  it('creates only Challenge scheduling authority and labels the path TEST-only', async () => {
    const createChallenge = vi.fn(async (input: StageIChallengeCreateInput) => ({...draft, challenge_id: input.challenge_id, current_contract_version: null, current_terms_digest: null, has_frozen_contract: false}));
    const api = baseApi({
      createChallenge,
      launchStageIMockChallenge: vi.fn(async (_challengeId: string, _requestId: string) => entryOpen),
    });

    const onChallengeChanged = vi.fn();
    render(<StageIOrganizerBridge api={api} onChallengeChanged={onChallengeChanged} />);
    expect(screen.getByText(/THIS REHEARSAL USES TEST VALUE ONLY/i)).toBeTruthy();
    expect(screen.getByText(/DRAFT ONLY · NOT OPEN TO BUILDERS · NO REAL VALUE/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'CREATE DRAFT CHALLENGE'}));

    await waitFor(() => expect(createChallenge).toHaveBeenCalledTimes(1));
    const input = createChallenge.mock.calls[0]![0];
    expect(input.request_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(input.challenge_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(input.slot_limit).toBe(3);
    expect(input.activation_minimum).toBe(1);
    expect(input.entry_deadline_ms).toBeLessThan(input.submission_deadline_ms);
    expect(input.submission_deadline_ms).toBeLessThan(input.review_deadline_ms);
    expect(Object.keys(input)).not.toContain('settlement_asset');
    expect(Object.keys(input)).not.toContain('funding');
    expect(onChallengeChanged).toHaveBeenCalledTimes(1);
    expect(onChallengeChanged.mock.calls[0]![0].challenge_id).toBe(input.challenge_id);
  });

  it('does not attempt draft creation when GitHub identity is missing', async () => {
    const createChallenge = vi.fn(async (_input: StageIChallengeCreateInput) => draft);
    const api = baseApi({
      getMe: vi.fn(async () => { throw new Error('authentication_required'); }),
      createChallenge,
      launchStageIMockChallenge: vi.fn(async () => entryOpen),
    });

    render(<StageIOrganizerBridge api={api} />);
    expect(await screen.findByText('CONNECT GITHUB BEFORE CREATING THE DRAFT')).toBeTruthy();
    const connect = screen.getByRole('link', {name: 'CONNECT GITHUB TO CREATE →'});
    const href = new URL(connect.getAttribute('href')!, window.location.origin);
    expect(href.pathname).toBe('/v1/auth/github/start');
    expect(href.searchParams.get('return_to')).toContain('surface=compiler');
    expect(screen.queryByRole('button', {name: 'CREATE DRAFT CHALLENGE'})).toBeNull();
    expect(createChallenge).not.toHaveBeenCalled();
  });

  it('mock-launches only an already frozen DRAFT through the test-only endpoint', async () => {
    const launchStageIMockChallenge = vi.fn(async (_challengeId: string, _requestId: string) => entryOpen);
    window.history.replaceState({}, '', `/?surface=compiler&challenge=${challengeId}`);
    render(<StageIOrganizerBridge challenge={draft} api={baseApi({
      createChallenge: vi.fn(async (_input: StageIChallengeCreateInput) => draft),
      launchStageIMockChallenge,
    })} />);

    await waitFor(() => expect(screen.getByText('DRAFT', {selector: 'dd'})).toBeTruthy());
    fireEvent.click(screen.getByRole('button', {name: 'OPEN CHALLENGE / TEST ONLY'}));
    await waitFor(() => expect(launchStageIMockChallenge).toHaveBeenCalledTimes(1));
    expect(launchStageIMockChallenge.mock.calls[0]![0]).toBe(challengeId);
    expect(launchStageIMockChallenge.mock.calls[0]![1]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(screen.getByText(/OPEN · BUILDERS CAN JOIN/i)).toBeTruthy();
  });

  it('joins against the current frozen terms digest instead of browser-derived terms', async () => {
    const joinChallenge = vi.fn(async (_challengeId, _requestId, generatedEntryId, expectedTermsDigest) => ({
      schema_version: 'challenge.entry.joined.v1' as const,
      challenge_id: challengeId,
      entry_id: generatedEntryId,
      state: 'RESERVED',
      terms_digest: expectedTermsDigest,
    }));
    window.history.replaceState({}, '', `/?surface=challenge&challenge=${challengeId}`);
    render(<StageIJoinBridge api={baseApi({getChallenge: vi.fn(async () => entryOpen), joinChallenge})} />);

    await waitFor(() => expect((screen.getByRole('button', {name: 'JOIN THIS CHALLENGE'}) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', {name: 'JOIN THIS CHALLENGE'}));
    await waitFor(() => expect(joinChallenge).toHaveBeenCalledTimes(1));
    const [joinedChallengeId, requestId, generatedEntryId, expectedTermsDigest] = joinChallenge.mock.calls[0]!;
    expect(joinedChallengeId).toBe(challengeId);
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(generatedEntryId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(expectedTermsDigest).toBe(termsDigest);
  });

  it('renders the canonical Builder Capsule and mints a memory-only challenge:submit credential without submitting', async () => {
    const capsule: BuilderCapsuleView = {
      schema_version: 'builder-capsule.v1',
      challenge_id: challengeId,
      entry_id: entryId,
      entry_state: 'ACTIVE',
      contract_version: 'stage-i-alpha-v1',
      terms_digest: termsDigest,
      submission_deadline: '2030-01-02T00:00:00.000Z',
      files: [{path: 'contract.json', media_type: 'application/json', sha256: 'b'.repeat(64), content: '{"frozen":true}\n'}],
    };
    const credential: StageISubmitCredentialView = {
      schema_version: 'devkit.token.issued.v1',
      token_id: '33333333-3333-4333-8333-333333333333',
      credential_class: 'CLI',
      label: 'Stage I submit',
      scopes: ['challenge:submit'],
      token: 'rekt_dk_secret_test_token',
      expires_at: '2030-01-01T01:00:00.000Z',
      challenge_id: challengeId,
      purpose: 'FINAL_SUBMISSION_ONLY',
    };
    const mintSubmitCredential = vi.fn(async (_challengeId: string, _requestId: string, _expiresInSeconds?: number) => credential);
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    window.history.replaceState({}, '', `/?surface=my-build&challenge=${challengeId}`);
    render(<StageIMyBuildSurface api={baseApi({
      getMyBuild: vi.fn(async () => capsule),
      mintSubmitCredential,
    })} />);

    await waitFor(() => expect(screen.getByText('My Build / ACTIVE.')).toBeTruthy());
    expect(screen.getByText('contract.json', {exact: false})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'MINT 1H SUBMIT CREDENTIAL'}));
    await waitFor(() => expect(mintSubmitCredential).toHaveBeenCalledTimes(1));
    expect(mintSubmitCredential.mock.calls[0]![0]).toBe(challengeId);
    expect(mintSubmitCredential.mock.calls[0]![2]).toBe(3600);
    expect(storageSpy).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('rekt_dk_secret_test_token')).toBeTruthy();
    const command = screen.getByLabelText(/CLI EXAMPLE/i) as HTMLTextAreaElement;
    expect(command.value).toContain(`/v1/challenges/${challengeId}/submissions`);
    expect(command.value).toContain('Authorization: Bearer rekt_dk_secret_test_token');
    expect(command.value).toContain(`"expected_terms_digest": "${termsDigest}"`);
    expect(screen.getByText(/browser does not perform immutable final submission/i)).toBeTruthy();
  });

  it('forwards organizer-supplied frozen acceptance JSON to Test Arena without deriving it in the browser', async () => {
    const reveal: RevealArenaView = {
      schema_version: 'challenge.reveal-arena/1.0',
      challenge_id: challengeId,
      contract_version: 'stage-i-alpha-v1',
      terms_digest: termsDigest,
      reveal_state: 'REVEALED',
      criteria: [{criterion_id: 'criterion-1', group: 'OUTCOME', description: 'Observable criterion'}],
      submissions: [{
        entry_id: entryId,
        submission_id: '44444444-4444-4444-8444-444444444444',
        submission_version: 1,
        accepted_at: '2030-01-01T00:00:00.000Z',
        immutable_source_reference: {kind: 'GIT_COMMIT', value: 'abc123'},
        artifact_digest: 'c'.repeat(64),
        archive: {status: 'CAPTURED', archive_digest: 'd'.repeat(64), reason_code: null, observed_at: '2030-01-01T00:01:00.000Z'},
      }],
    };
    const modules: TestArenaModuleCatalogView = {
      schema_version: 'challenge.test-module-catalog/1.0',
      modules: [{module_id: 'trusted.module', module_version: '1'}],
    };
    const comparison: QualifierComparisonView = {
      schema_version: 'challenge.qualifier-comparison/1.0',
      challenge_id: challengeId,
      contract_version: 'stage-i-alpha-v1',
      terms_digest: termsDigest,
      status: 'SELECTION',
      preferences: {},
      final_qualifier_ids: [entryId],
      selected_entry_id: null,
      qualifiers: reveal.submissions,
    };
    const qualification: StageIQualificationView = {
      schema_version: 'challenge.test-arena-qualification/1.0',
      challenge_id: challengeId,
      entry_id: entryId,
      submission_id: reveal.submissions[0]!.submission_id,
      qualification_id: '55555555-5555-4555-8555-555555555555',
      qualification_version: 'stage-g2b-v1',
      result: 'QUALIFIED',
      execution_digest: 'e'.repeat(64),
    };
    const qualifyEntry = vi.fn(async (_challengeId: string, _entryId: string, _input: StageIQualificationInput) => qualification);
    window.history.replaceState({}, '', `/?surface=review&challenge=${challengeId}`);
    render(<StageIReviewSurface api={baseApi({
      getRevealArena: vi.fn(async () => reveal),
      getTestArenaModules: vi.fn(async () => modules),
      qualifyEntry,
      getQualifierComparison: vi.fn(async () => comparison),
      selectQualifier: vi.fn(async () => ({
        schema_version: 'challenge.selection/1.0' as const,
        challenge_id: challengeId,
        decision_id: '66666666-6666-4666-8666-666666666666',
        decision_version: 'stage-g3-selection-v1',
        selected_entry_id: entryId,
        decision_digest: 'f'.repeat(64),
      })),
    })} />);

    await waitFor(() => expect(screen.getByText('Organizer Reveal / Test Arena / Selection.')).toBeTruthy());
    const manifest = {schema_version: 'inkubator.acceptance-manifest/1.0', frozen: 'verbatim'};
    const observations = [{criterion_id: 'criterion-1', result: 'PASS', evidence_refs: ['human://observed']}];
    fireEvent.change(screen.getByLabelText('ACCEPTANCE MANIFEST REFERENCE'), {target: {value: 'content://manifest-digest'}});
    fireEvent.change(screen.getByLabelText('FROZEN ACCEPTANCE MANIFEST JSON'), {target: {value: JSON.stringify(manifest)}});
    fireEvent.change(screen.getByLabelText('HUMAN OBSERVATIONS JSON'), {target: {value: JSON.stringify(observations)}});
    fireEvent.click(screen.getByRole('button', {name: 'RUN TEST ARENA FOR ENTRY'}));

    await waitFor(() => expect(qualifyEntry).toHaveBeenCalledTimes(1));
    const [qualifiedChallenge, qualifiedEntry, input] = qualifyEntry.mock.calls[0]!;
    expect(qualifiedChallenge).toBe(challengeId);
    expect(qualifiedEntry).toBe(entryId);
    expect(input.acceptance_manifest_reference_id).toBe('content://manifest-digest');
    expect(input.acceptance_manifest).toEqual(manifest);
    expect(input.human_observations).toEqual(observations);
  });

  it('renders only the safe receipt transport supplied by the server', async () => {
    const receipts: ChallengeReceiptTransportView = {
      schema_version: 'challenge.receipt-transport/1.0',
      challenge_id: challengeId,
      receipts: [{
        protocol_receipt_id: 'receipt-1',
        schema_version: 'inkubator.challenge-receipt/1.0',
        digest: 'f'.repeat(64),
        created_at: '2030-01-03T00:00:00.000Z',
        challenge_id: challengeId,
        terms_digest: termsDigest,
        contract_version: 'stage-i-alpha-v1',
        mechanism_version: 'funded-challenge/1.1',
        settlement_policy_version: 'funded-challenge-settlement/1.0',
        ip_terms_version: 'bespoke-winner-transfer/1.0',
        terminal_outcome: 'SELECTED',
        ip_transfer_fact: 'TEST_ONLY',
        settlement_asset: 'TEST',
        total_minor_units: 100,
        winner_entry_id: entryId,
      }],
    };
    window.history.replaceState({}, '', `/?surface=history&challenge=${challengeId}`);
    render(<StageIHistorySurface api={baseApi({getReceipts: vi.fn(async () => receipts)})} />);

    await waitFor(() => expect(screen.getByText('1 durable Challenge receipt.')).toBeTruthy());
    expect(screen.getByText(/SAFE RECEIPT PROJECTION ONLY/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain('private_archive_path');
  });
});
