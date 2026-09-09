import fs from 'node:fs';

function mustReplace(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`prototype patch anchor missing: ${label}`);
  return source.replace(needle, replacement);
}

const protoRoot = new URL('./', import.meta.url);
const apiSrc = new URL('../../apps/inkubator-api/src/', protoRoot);

for (const name of ['partner-origin.ts', 'partner-cartridge.ts']) {
  fs.copyFileSync(new URL(`src/${name}`, protoRoot), new URL(name, apiSrc));
}

{
  const file = new URL('mission-command.ts', apiSrc);
  let source = fs.readFileSync(file, 'utf8');
  source = mustReplace(source,
    "import {appendHistoryEvent, HISTORY_EVENT_VERSION} from './events.js';\n",
    "import {appendHistoryEvent, HISTORY_EVENT_VERSION} from './events.js';\nimport {normalizePartnerMissionOrigin, readMissionPartnerOrigin, type PartnerMissionOrigin} from './partner-origin.js';\n",
    'mission import');
  source = mustReplace(source,
    "  stackLabels?: string[];\n}\n\nexport interface MissionUpdateInput",
    "  stackLabels?: string[];\n  origin?: PartnerMissionOrigin;\n}\n\nexport interface MissionUpdateInput",
    'MissionCreateInput origin');
  source = mustReplace(source,
    "  observedStacks: DetectedStack[];\n}\n",
    "  observedStacks: DetectedStack[];\n  origin: PartnerMissionOrigin | null;\n}\n",
    'CommandSnapshot origin');
  source = mustReplace(source,
    "  const stackLabels = normalizeStackLabels(input.stackLabels) ?? [];\n\n  return db.transaction().execute",
    "  const stackLabels = normalizeStackLabels(input.stackLabels) ?? [];\n  const origin = input.origin ? normalizePartnerMissionOrigin(input.origin) : null;\n\n  return db.transaction().execute",
    'createMission normalize origin');
  source = mustReplace(source,
    "    stack_labels: stackLabels,\n    stack_source: stackLabels.length ? 'PLAYER_CONFIRMED' : 'UNKNOWN',\n  };\n  try {",
    "    stack_labels: stackLabels,\n    stack_source: stackLabels.length ? 'PLAYER_CONFIRMED' : 'UNKNOWN',\n    ...(origin ? {origin} : {}),\n  };\n  try {",
    'existing mission payload origin');
  source = mustReplace(source,
    "        stack_labels: stackLabels,\n        stack_source: stackLabels.length ? 'PLAYER_CONFIRMED' : 'UNKNOWN',\n      },\n    });",
    "        stack_labels: stackLabels,\n        stack_source: stackLabels.length ? 'PLAYER_CONFIRMED' : 'UNKNOWN',\n        ...(origin ? {origin} : {}),\n      },\n    });",
    'declared history payload origin');
  source = mustReplace(source,
    "  return {project, mission, round, gates, repository, githubEvidence, daemonAdvisory, observedStacks};\n}",
    "  const origin = await readMissionPartnerOrigin(db, missionId);\n  return {project, mission, round, gates, repository, githubEvidence, daemonAdvisory, observedStacks, origin};\n}",
    'command snapshot origin read');
  source = mustReplace(source,
    "      stack_labels: stackLabels,\n      stack_source: snapshot.mission.stack_source,\n    },",
    "      stack_labels: stackLabels,\n      stack_source: snapshot.mission.stack_source,\n      ...(snapshot.origin ? {origin: snapshot.origin} : {}),\n    },",
    'command projection origin');
  fs.writeFileSync(file, source);
}

{
  const file = new URL('app.ts', apiSrc);
  let source = fs.readFileSync(file, 'utf8');
  source = mustReplace(source,
    "} from './mission-command.js';\nimport {createPlayer",
    "} from './mission-command.js';\nimport {createPartnerMission, getPartnerCartridge, listPartnerCartridges, partnerCartridgeEmbedView} from './partner-cartridge.js';\nimport {createPlayer",
    'partner import');
  const routes = `  app.get('/v1/partner-cartridges', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=15');
    return listPartnerCartridges();
  });

  app.get('/v1/partner-cartridges/:slug', async (request, reply) => {
    const {slug} = request.params as {slug: string};
    const cartridge = getPartnerCartridge(slug);
    if (!cartridge) return error(reply, 404, 'partner_cartridge_not_found');
    reply.header('cache-control', 'public, max-age=15');
    return cartridge;
  });

  app.get('/v1/partner-cartridges/:slug/embed', async (request, reply) => {
    const {slug} = request.params as {slug: string};
    try {
      reply.header('cache-control', 'public, max-age=15');
      return await partnerCartridgeEmbedView(options.db, slug);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'partner_cartridge_not_found') return error(reply, 404, cause.message);
      throw cause;
    }
  });

  app.post('/v1/partner-cartridges/:slug/build-requests/:buildRequestId/build', async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {slug, buildRequestId} = request.params as {slug: string; buildRequestId: string};
    const body = request.body as {request_id?: string; round_id?: string};
    try {
      const command = await createPartnerMission(options.db, authenticated.actor.playerId, {
        requestId: body?.request_id ?? '', roundId: body?.round_id ?? '', partnerSlug: slug, buildRequestId,
      });
      reply.header('cache-control', 'no-store');
      return reply.code(201).send(commandToPrivateView(command));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'partner_build_failed';
      if (message === 'partner_cartridge_not_found' || message === 'partner_build_request_not_found') return error(reply, 404, message);
      return phase3Error(reply, cause);
    }
  });

`;
  source = mustReplace(source,
    "  app.get('/v1/world/signals', async (_request, reply) => {",
    routes + "  app.get('/v1/world/signals', async (_request, reply) => {",
    'partner routes');
  fs.writeFileSync(file, source);
}

{
  const file = new URL('ship-artifact.ts', apiSrc);
  let source = fs.readFileSync(file, 'utf8');
  source = mustReplace(source,
    "import type {DatabaseSchema} from './database.js';\n",
    "import type {DatabaseSchema} from './database.js';\nimport {readMissionPartnerOrigin} from './partner-origin.js';\n",
    'ship origin import');
  source = mustReplace(source,
    "  const assists = assistAttributions.map((row) => ({\n    assist_id: row.assist_id,\n    player_id: row.player_id,\n    display_name: row.display_name,\n    accepted_at: row.accepted_at.toISOString(),\n    source_state: 'ACCEPTED' as const,\n  }));\n\n  return {",
    "  const assists = assistAttributions.map((row) => ({\n    assist_id: row.assist_id,\n    player_id: row.player_id,\n    display_name: row.display_name,\n    accepted_at: row.accepted_at.toISOString(),\n    source_state: 'ACCEPTED' as const,\n  }));\n  const origin = await readMissionPartnerOrigin(dbInput, receipt.mission_id);\n\n  return {",
    'ship origin read');
  source = mustReplace(source,
    "    mission_id: receipt.mission_id,\n    project_id: receipt.project_id,",
    "    mission_id: receipt.mission_id,\n    ...(origin ? {origin} : {}),\n    project_id: receipt.project_id,",
    'ship origin projection');
  fs.writeFileSync(file, source);
}

console.log('PARTNER_CARTRIDGE_V0_PATCH=APPLIED');
