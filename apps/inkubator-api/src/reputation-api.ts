import type {FastifyInstance} from 'fastify';
import type {Kysely} from 'kysely';
import type {DatabaseSchema} from './database.js';
import {getPlayerReputation, getWorldBoards, reconcilePlayerCheevos} from './reputation.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerPhase7ReputationRoutes(app: FastifyInstance, db: Kysely<DatabaseSchema>): void {
  app.get('/v1/players/:playerId/reputation', async (request, reply) => {
    const {playerId} = request.params as {playerId: string};
    if (!UUID_PATTERN.test(playerId)) return reply.code(400).send({error: 'invalid_player_id'});

    // Materialization is server-only, deterministic, idempotent and based exclusively on
    // durable authority facts. The request contains no award/score input and cannot mint
    // anything that the versioned rules do not already prove.
    try {
      await reconcilePlayerCheevos(db, playerId.toLowerCase());
    } catch (error) {
      if (error instanceof Error && error.message === 'player_not_found') return reply.code(404).send({error: 'player_not_found'});
      throw error;
    }

    const reputation = await getPlayerReputation(db, playerId.toLowerCase());
    if (!reputation) return reply.code(404).send({error: 'player_not_found'});
    reply.header('cache-control', 'public, max-age=15');
    return reputation;
  });

  app.get('/v1/world/boards', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=15');
    return getWorldBoards(db);
  });
}
