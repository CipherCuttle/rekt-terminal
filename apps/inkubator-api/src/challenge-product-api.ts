import {createRequire} from 'node:module';
import type {FastifyInstance, FastifyReply} from 'fastify';
import {
  assertCompilerBlueprint,
  assertCompilerProposal,
  compileProposal,
  type CompilerBlueprint,
  type CompilerState,
} from '@rekt-ink/protocol/compiler';
import {readChallengeSnapshot, type ChallengeSnapshot} from './challenge-store.js';
import type {InkubatorDatabase} from './database.js';

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

function safeDate(value: Date): string {
  return value.toISOString();
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
}
