import {createRequire} from 'node:module';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  assertFrozenBuildContract,
  freezeBuildContract,
  type BuildContract,
} from '@rekt-ink/protocol/challenge';
import {
  assertCompilerBlueprint,
  assertCompilerProposal,
  assertCompilerState,
  buildBuildContractCandidate,
  compileProposal,
  type CompilerBlueprint,
  type CompilerState,
} from '@rekt-ink/protocol/compiler';
import {
  persistFrozenBuildContract,
  readChallengeSnapshot,
  type ChallengeSnapshot,
} from './challenge-store.js';
import type {InkubatorDatabase} from './database.js';
import {readSessionToken, resolveSessionActor} from './session.js';

const require = createRequire(import.meta.url);
const BLUEPRINT_PATHS = [
  '../../../packages/inkubator-protocol/compiler/blueprints/web-static.v1.json',
  '../../../packages/inkubator-protocol/compiler/blueprints/web-crud.v1.json',
  '../../../packages/inkubator-protocol/compiler/blueprints/web-realtime.v1.json',
  '../../../packages/inkubator-protocol/compiler/blueprints/web3-read-app.v1.json',
  '../../../packages/inkubator-protocol/compiler/blueprints/web3-transaction-app.v1.json',
] as const;

const ACTIVE_BLUEPRINTS = Object.freeze(
  BLUEPRINT_PATHS.map((path) => assertCompilerBlueprint(require(path)) as CompilerBlueprint),
);

export interface PublicBuildContractSummary {
  contract_version: string;
  terms_digest: string;
  title: string;
  brief: string;
  outcome_criteria: Array<{id: string; description: string; mandatory: boolean}>;
  production_criteria: Array<{id: string; description: string; mandatory: boolean}>;
  delivery_criteria: Array<{id: string; description: string; mandatory: boolean}>;
  normative_constraints: Array<{id: string; description: string; mandatory: boolean}>;
  normative_references: Array<{id: string; kind: string; content_digest: string; source_url?: string}>;
  informational_references: Array<{id: string; url: string}>;
  prize_minor_units: number;
  prize_display?: string;
  settlement_asset: string;
}

export interface PublicChallengeView {
  schema_version: 'challenge.public.v1';
  challenge_id: string;
  status: string;
  mechanism_version: string;
  settlement_policy_version: string;
  ip_terms_version: string;
  current_contract_version: string | null;
  current_terms_digest: string | null;
  has_frozen_contract: boolean;
  contract_summary: PublicBuildContractSummary | null;
  slot_limit: number;
  activation_minimum: number;
  entry_deadline: string;
  build_start: string;
  submission_deadline: string;
  appeal_window_ms: number;
  review_deadline: string;
  entry_count: number;
  submission_count: number;
  qualification_count: number;
  receipt_count: number;
  created_at: string;
  updated_at: string;
}

export interface BuildContractPreviewAuthorityInput {
  contract_version: string;
  title: string;
  brief: string;
  preferences: Record<string, unknown>;
  normative_constraints: Array<{id: string; description: string; mandatory: boolean}>;
  normative_references: Array<{id: string; kind: string; content_digest: string; source_url?: string}>;
  informational_references?: Array<{id: string; url: string}>;
  prize_minor_units: number;
  prize_display?: string;
  settlement_asset: string;
}

export interface BuildContractPreviewView {
  schema_version: 'build-contract.preview.v1';
  canonical: false;
  persisted: false;
  contract: BuildContract & {terms_digest: string};
}

export interface CanonicalBuildContractView {
  schema_version: 'build-contract.canonical.v1';
  canonical: true;
  persisted: true;
  challenge_id: string;
  contract_version: string;
  terms_digest: string;
  frozen_at: string;
}

function safeDate(value: Date): string {
  return value.toISOString();
}

function toPublicBuildContractSummary(snapshot: ChallengeSnapshot): PublicBuildContractSummary | null {
  if (!snapshot.contract || snapshot.challenge.status === 'DRAFT') return null;
  const contract = assertFrozenBuildContract(snapshot.contract.contract_json);
  const termsDigest = typeof contract.terms_digest === 'string' ? contract.terms_digest : null;
  if (
    !termsDigest
    || contract.challenge_id !== snapshot.challenge.challenge_id
    || snapshot.contract.challenge_id !== snapshot.challenge.challenge_id
    || !snapshot.challenge.current_contract_version
    || contract.contract_version !== snapshot.challenge.current_contract_version
    || snapshot.contract.contract_version !== snapshot.challenge.current_contract_version
    || !snapshot.challenge.current_terms_digest
    || termsDigest !== snapshot.challenge.current_terms_digest
    || snapshot.contract.terms_digest !== snapshot.challenge.current_terms_digest
  ) {
    throw new Error('challenge_contract_pointer_invalid');
  }
  return {
    contract_version: contract.contract_version,
    terms_digest: termsDigest,
    title: contract.title,
    brief: contract.brief,
    outcome_criteria: contract.outcome_contract.criteria ?? [],
    production_criteria: contract.production_envelope.criteria ?? [],
    delivery_criteria: contract.delivery_contract.criteria ?? [],
    normative_constraints: contract.normative_constraints,
    normative_references: contract.normative_references,
    informational_references: contract.informational_references ?? [],
    prize_minor_units: contract.prize_minor_units,
    ...(contract.prize_display ? {prize_display: contract.prize_display} : {}),
    settlement_asset: contract.settlement_asset,
  };
}

export function toPublicChallengeView(snapshot: ChallengeSnapshot): PublicChallengeView {
  const {challenge} = snapshot;
  return {
    schema_version: 'challenge.public.v1',
    challenge_id: challenge.challenge_id,
    status: challenge.status,
    mechanism_version: challenge.mechanism_version,
    settlement_policy_version: challenge.settlement_policy_version,
    ip_terms_version: challenge.ip_terms_version,
    current_contract_version: challenge.current_contract_version,
    current_terms_digest: challenge.current_terms_digest,
    has_frozen_contract: snapshot.contract !== null,
    contract_summary: toPublicBuildContractSummary(snapshot),
    slot_limit: challenge.slot_limit,
    activation_minimum: challenge.activation_minimum,
    entry_deadline: safeDate(challenge.entry_deadline),
    build_start: safeDate(challenge.build_start),
    submission_deadline: safeDate(challenge.submission_deadline),
    appeal_window_ms: Number(challenge.appeal_window_ms),
    review_deadline: safeDate(challenge.review_deadline),
    entry_count: snapshot.entries.length,
    submission_count: snapshot.submissions.length,
    qualification_count: snapshot.qualifications.length,
    receipt_count: snapshot.receipts.length,
    created_at: safeDate(challenge.created_at),
    updated_at: safeDate(challenge.updated_at),
  };
}

export function compileOrganizerDraft(input: unknown): CompilerState {
  const proposal = assertCompilerProposal(input);
  return compileProposal(proposal, {blueprints: [...ACTIVE_BLUEPRINTS]});
}

function organizerAcceptedInputProvenance(state: CompilerState): string[] {
  return [
    ...state.requirements.map((item) => item.provenance),
    ...state.knowledge.filter((item) => item.provenance !== 'DETERMINISTIC_RULE').map((item) => item.provenance),
    ...state.outcome_contract_candidate.criteria.filter((item) => item.provenance !== 'DETERMINISTIC_RULE').map((item) => item.provenance),
    ...state.delivery_contract_candidate.criteria.filter((item) => item.provenance !== 'DETERMINISTIC_RULE').map((item) => item.provenance),
  ];
}

function assertOrganizerAcceptedCompilerState(state: CompilerState): void {
  const provenance = organizerAcceptedInputProvenance(state);
  if (provenance.length === 0 || provenance.some((kind) => kind !== 'ORGANIZER_ACCEPTED')) {
    throw new Error('compiler_organizer_acceptance_required');
  }
}

export function deriveFrozenBuildContract(
  compilerStateInput: unknown,
  authority: BuildContractPreviewAuthorityInput,
  snapshot: ChallengeSnapshot,
): BuildContract & {terms_digest: string} {
  if (snapshot.challenge.status !== 'DRAFT') throw new Error('challenge_contract_persist_requires_draft');

  const compilerState = assertCompilerState(compilerStateInput, {blueprints: [...ACTIVE_BLUEPRINTS]});
  assertOrganizerAcceptedCompilerState(compilerState);

  const challenge = snapshot.challenge;
  const candidate = buildBuildContractCandidate(
    compilerState,
    {
      schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
      challenge_id: challenge.challenge_id,
      contract_version: authority.contract_version,
      mechanism_version: challenge.mechanism_version,
      settlement_policy_version: challenge.settlement_policy_version,
      ip_terms_version: challenge.ip_terms_version,
      title: authority.title,
      brief: authority.brief,
      preferences: authority.preferences,
      normative_constraints: authority.normative_constraints,
      normative_references: authority.normative_references,
      ...(authority.informational_references ? {informational_references: authority.informational_references} : {}),
      slot_limit: challenge.slot_limit,
      activation_minimum: challenge.activation_minimum,
      entry_deadline: challenge.entry_deadline.getTime(),
      build_start: challenge.build_start.getTime(),
      submission_deadline: challenge.submission_deadline.getTime(),
      appeal_window_ms: Number(challenge.appeal_window_ms),
      review_deadline: challenge.review_deadline.getTime(),
      prize_minor_units: authority.prize_minor_units,
      ...(authority.prize_display ? {prize_display: authority.prize_display} : {}),
      settlement_asset: authority.settlement_asset,
    },
    {blueprints: [...ACTIVE_BLUEPRINTS]},
  );
  return freezeBuildContract(candidate as BuildContract) as BuildContract & {terms_digest: string};
}

export function buildFrozenBuildContractPreview(
  compilerStateInput: unknown,
  authority: BuildContractPreviewAuthorityInput,
  snapshot: ChallengeSnapshot,
): BuildContractPreviewView {
  if (
    snapshot.challenge.status !== 'DRAFT'
    || snapshot.contract !== null
    || snapshot.challenge.current_contract_version !== null
    || snapshot.challenge.current_terms_digest !== null
  ) {
    throw new Error('challenge_contract_preview_requires_unfrozen_draft');
  }

  return {
    schema_version: 'build-contract.preview.v1',
    canonical: false,
    persisted: false,
    contract: deriveFrozenBuildContract(compilerStateInput, authority, snapshot),
  };
}

async function authenticatedPlayerId(request: FastifyRequest, db: InkubatorDatabase): Promise<string | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) return null;
  return (await resolveSessionActor(db, token))?.playerId ?? null;
}

function apiError(reply: FastifyReply, statusCode: number, message: string) {
  return reply.code(statusCode).send({error: message});
}

export function registerStageEChallengeProductRoutes(app: FastifyInstance, db: InkubatorDatabase): void {
  app.get('/v1/challenges/:challengeId', async (request, reply) => {
    const {challengeId} = request.params as {challengeId: string};
    try {
      const snapshot = await readChallengeSnapshot(db, challengeId);
      if (!snapshot) return apiError(reply, 404, 'challenge_not_found');
      reply.header('cache-control', 'no-store');
      return toPublicChallengeView(snapshot);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'invalid_challenge_id') {
        return apiError(reply, 400, 'invalid_challenge_id');
      }
      throw cause;
    }
  });

  app.post('/v1/compiler/compile', async (request, reply) => {
    try {
      reply.header('cache-control', 'no-store');
      return compileOrganizerDraft(request.body);
    } catch {
      return apiError(reply, 400, 'compiler_input_invalid');
    }
  });

  app.post('/v1/challenges/:challengeId/build-contract-preview', async (request, reply) => {
    const {challengeId} = request.params as {challengeId: string};
    const body = request.body as {
      compiler_state?: unknown;
      authority?: BuildContractPreviewAuthorityInput;
    } | null;
    try {
      const snapshot = await readChallengeSnapshot(db, challengeId);
      if (!snapshot) return apiError(reply, 404, 'challenge_not_found');
      if (!body?.authority) return apiError(reply, 400, 'build_contract_preview_invalid');
      reply.header('cache-control', 'no-store');
      return buildFrozenBuildContractPreview(body.compiler_state, body.authority, snapshot);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'build_contract_preview_invalid';
      if (message === 'invalid_challenge_id') return apiError(reply, 400, message);
      if (message === 'compiler_organizer_acceptance_required') return apiError(reply, 409, message);
      if (message === 'challenge_contract_preview_requires_unfrozen_draft' || message === 'challenge_contract_persist_requires_draft') {
        return apiError(reply, 409, message);
      }
      return apiError(reply, 400, 'build_contract_preview_invalid');
    }
  });

  app.post('/v1/challenges/:challengeId/build-contract', async (request, reply) => {
    const {challengeId} = request.params as {challengeId: string};
    const actorPlayerId = await authenticatedPlayerId(request, db);
    if (!actorPlayerId) return apiError(reply, 401, 'authentication_required');

    const body = request.body as {
      request_id?: unknown;
      compiler_state?: unknown;
      authority?: BuildContractPreviewAuthorityInput;
      expected_terms_digest?: unknown;
    } | null;
    if (
      typeof body?.request_id !== 'string'
      || typeof body.expected_terms_digest !== 'string'
      || !body.authority
    ) {
      return apiError(reply, 400, 'build_contract_persist_invalid');
    }

    try {
      const snapshot = await readChallengeSnapshot(db, challengeId);
      if (!snapshot) return apiError(reply, 404, 'challenge_not_found');
      const contract = deriveFrozenBuildContract(body.compiler_state, body.authority, snapshot);
      if (contract.terms_digest !== body.expected_terms_digest) {
        return apiError(reply, 409, 'build_contract_preview_stale');
      }
      const stored = await persistFrozenBuildContract(db, {
        requestId: body.request_id,
        actorPlayerId,
        challengeId,
        contract,
      });
      if (stored.terms_digest !== body.expected_terms_digest) throw new Error('build_contract_persist_digest_mismatch');
      reply.header('cache-control', 'no-store');
      const view: CanonicalBuildContractView = {
        schema_version: 'build-contract.canonical.v1',
        canonical: true,
        persisted: true,
        challenge_id: stored.challenge_id,
        contract_version: stored.contract_version,
        terms_digest: stored.terms_digest,
        frozen_at: safeDate(stored.frozen_at),
      };
      return view;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'build_contract_persist_failed';
      if (message === 'invalid_challenge_id' || message === 'invalid_request_id') return apiError(reply, 400, message);
      if (message === 'challenge_not_found') return apiError(reply, 404, message);
      if (message === 'challenge_organizer_required') return apiError(reply, 403, message);
      if (
        message === 'compiler_organizer_acceptance_required'
        || message === 'challenge_contract_persist_requires_draft'
        || message === 'challenge_contract_already_frozen'
        || message === 'challenge_contract_immutable_conflict'
        || message === 'contract_challenge_authority_mismatch'
        || message.includes('idempotency_conflict')
      ) {
        return apiError(reply, 409, message);
      }
      if (message.startsWith('invalid_') || message.startsWith('contract_') || message.startsWith('build contract')) {
        return apiError(reply, 400, 'build_contract_persist_invalid');
      }
      throw cause;
    }
  });
}
