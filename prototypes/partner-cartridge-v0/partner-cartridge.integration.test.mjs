import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../apps/inkubator-api/dist/app.js';
import {createDatabase} from '../../apps/inkubator-api/dist/database.js';
import {migrateToLatest} from '../../apps/inkubator-api/dist/migrations.js';
import {runOneJob, SHIP_VERIFICATION_JOB_TYPE} from '../../apps/inkubator-api/dist/jobs.js';
import {operatorReviewShipAcceptance} from '../../apps/inkubator-api/dist/ship-acceptance.js';
import {getAcceptedShipArtifactByReceiptId} from '../../apps/inkubator-api/dist/ship-artifact.js';
import {APPLE_INU_CARTRIDGE, assertPartnerCartridge} from '../../apps/inkubator-api/dist/partner-cartridge.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL required');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'https://inkubator.test';

function cookie(response) {
  const value = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'][0] : response.headers['set-cookie'];
  assert.ok(value);
  return value.split(';')[0];
}

async function session(app, name) {
  const response = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: name}});
  assert.equal(response.statusCode, 201);
  return {cookie: cookie(response), playerId: response.json().player.player_id};
}

function headers(cookieValue) { return {origin: appOrigin, cookie: cookieValue}; }

async function runVerifier(db, submissionId) {
  const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
  const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
  assert.ok(job);
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  const result = await runOneJob(db, {shipVerifierClient: {verify: async ({submissionId: id, url}) => ({
    schema_version: 'ship-verifier.observation.v1', submission_id: id, outcome: 'PASS', reason_code: 'PUBLIC_HTTPS_OK',
    final_url: url, http_status: 200, duration_ms: 11, redirects: 0,
  })}});
  assert.equal(result.status, 'succeeded');
}

test('PARTNER_CARTRIDGE_V0 drives Apple Inu BITE through ordinary Mission and canonical Ship authority', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    assert.throws(() => assertPartnerCartridge({...APPLE_INU_CARTRIDGE, chain_id: 1}), /unsupported_partner_chain/);
    assert.throws(() => assertPartnerCartridge({...APPLE_INU_CARTRIDGE, primitives: [{...APPLE_INU_CARTRIDGE.primitives[0], address: '0xBAD'}]}), /invalid_partner_contract_address/);
    assert.throws(() => assertPartnerCartridge({...APPLE_INU_CARTRIDGE, build_requests: [{...APPLE_INU_CARTRIDGE.build_requests[0], reward: {kind: 'EXTERNAL_PARTNER_PLEDGE', verification_state: 'UNVERIFIED', disclaimer: ''}}]}), /invalid_partner_reward_disclaimer/);

    const registry = await app.inject({method: 'GET', url: '/v1/partner-cartridges'});
    assert.equal(registry.statusCode, 200);
    assert.equal(registry.json().length, 1);
    assert.equal(registry.json()[0].slug, 'apple-inu');
    assert.equal(registry.json()[0].build_requests.length, 3);
    assert.equal(registry.json()[0].build_requests.every((item) => item.reward === null || item.reward.verification_state === 'UNVERIFIED'), true);
    assert.equal((await app.inject({method: 'GET', url: '/v1/partner-cartridges/not-real'})).statusCode, 404);

    const owner = await session(app, `Partner Builder ${randomUUID().slice(0, 8)}`);
    const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: owner.cookie}});
    const round = rounds.json().find((row) => row.code === 'ROUND_01');
    assert.ok(round);
    assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${round.round_id}/join`, headers: headers(owner.cookie)})).statusCode, 200);

    const forgedRequest = randomUUID();
    const forged = await app.inject({method: 'POST', url: '/v1/missions', headers: headers(owner.cookie), payload: {
      request_id: forgedRequest, round_id: round.round_id, project_name: 'Forged Partner Mission', goal: 'Pretend to be official',
      ship_condition: 'Never', current_focus: 'Spoof', next_move: 'Spoof',
      origin: {schema_version: 'partner.mission-origin.v0', kind: 'PARTNER_BUILD_REQUEST', partner_slug: 'apple-inu', partner_name: 'Apple Inu', build_request_id: 'BITE-001', build_request_title: 'SEE THE MONEY', request_version: '0.1', partner_verification_state: 'CURATED'},
    }});
    // Fastify strips undeclared extra properties on this existing route. The security
    // invariant is that attacker-supplied partner provenance never survives.
    assert.equal(forged.statusCode, 201);
    assert.equal(forged.json().mission.origin, undefined);
    const forgedMissionId = forged.json().mission.mission_id;
    const forgedDeclared = await db.selectFrom('history_events').select('payload').where('event_type', '=', 'mission.declared').where('subject_id', '=', forgedMissionId).executeTakeFirstOrThrow();
    assert.equal(Object.hasOwn(forgedDeclared.payload, 'origin'), false);

    const creationRequest = randomUUID();
    const buildUrl = '/v1/partner-cartridges/apple-inu/build-requests/BITE-001/build';
    const created = await app.inject({method: 'POST', url: buildUrl, headers: headers(owner.cookie), payload: {
      request_id: creationRequest, round_id: round.round_id, mark_proven: true, partner_name: 'EVIL OVERRIDE', ship_condition: 'I decide proof',
    }});
    assert.equal(created.statusCode, 201);
    const command = created.json();
    const missionId = command.mission.mission_id;
    const projectId = command.project.project_id;
    assert.equal(command.mission.state, 'DECLARED');
    assert.equal(command.gates.every((gate) => gate.state === 'UNKNOWN'), true);
    assert.deepEqual(command.mission.origin, {schema_version: 'partner.mission-origin.v0', kind: 'PARTNER_BUILD_REQUEST', partner_slug: 'apple-inu', partner_name: 'Apple Inu', build_request_id: 'BITE-001', build_request_title: 'SEE THE MONEY', request_version: '0.1', partner_verification_state: 'CURATED'});
    assert.equal(command.mission.ship_condition.includes('I decide proof'), false);

    const retry = await app.inject({method: 'POST', url: buildUrl, headers: headers(owner.cookie), payload: {request_id: creationRequest, round_id: round.round_id}});
    assert.equal(retry.statusCode, 201);
    assert.equal(retry.json().mission.mission_id, missionId);
    const missionCount = Number((await db.selectFrom('missions').select(({fn}) => fn.countAll().as('count')).where('creation_request_id', '=', creationRequest).executeTakeFirstOrThrow()).count);
    assert.equal(missionCount, 1);
    const conflict = await app.inject({method: 'POST', url: '/v1/partner-cartridges/apple-inu/build-requests/BITE-002/build', headers: headers(owner.cookie), payload: {request_id: creationRequest, round_id: round.round_id}});
    assert.equal(conflict.statusCode, 409);

    const declared = await db.selectFrom('history_events').select('payload').where('event_type', '=', 'mission.declared').where('subject_id', '=', missionId).executeTakeFirstOrThrow();
    assert.equal(declared.payload.origin.partner_slug, 'apple-inu');
    assert.equal(declared.payload.origin.build_request_id, 'BITE-001');
    const reloaded = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie: owner.cookie}});
    assert.equal(reloaded.statusCode, 200);
    assert.equal(reloaded.json().mission.origin.build_request_id, 'BITE-001');

    const forbiddenShip = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: headers(owner.cookie), payload: {request_id: randomUUID(), state: 'SHIPPED'}});
    assert.equal([400, 403].includes(forbiddenShip.statusCode), true);
    assert.equal((await db.selectFrom('history_events').select('history_event_id').where('event_type', '=', 'project.ship.accepted').where('subject_id', '=', projectId).execute()).length, 0);

    for (const state of ['BUILDING', 'SHIP_READY']) {
      const updated = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: headers(owner.cookie), payload: {request_id: randomUUID(), state}});
      assert.equal(updated.statusCode, 200);
    }
    const submission = await app.inject({method: 'POST', url: `/v1/missions/${missionId}/ship-submissions`, headers: headers(owner.cookie), payload: {
      request_id: randomUUID(), title: 'AI Reward Radar', url: 'https://example.com/apple-inu-reward-radar', demo_url: 'https://example.com/apple-inu-reward-radar/demo',
    }});
    assert.equal(submission.statusCode, 201);
    const submissionId = submission.json().submission_id;
    await runVerifier(db, submissionId);
    const accepted = await operatorReviewShipAcceptance(db, submissionId, {requestId: randomUUID(), decision: 'ACCEPT', reason: 'Prototype artifact satisfies its declared Ship condition.'});
    assert.ok(accepted.accepted_receipt);
    const artifact = await getAcceptedShipArtifactByReceiptId(db, accepted.accepted_receipt.receipt_id);
    assert.ok(artifact);
    assert.equal(artifact.truth_state, 'PROVEN');
    assert.equal(artifact.origin.partner_slug, 'apple-inu');
    assert.equal(artifact.origin.build_request_id, 'BITE-001');
    assert.equal(artifact.artifact.title, 'AI Reward Radar');

    const embed = await app.inject({method: 'GET', url: '/v1/partner-cartridges/apple-inu/embed'});
    assert.equal(embed.statusCode, 200);
    const embedJson = embed.json();
    assert.equal(embedJson.schema_version, 'partner.embed.public.v0');
    assert.equal(embedJson.shipped_count, 1);
    assert.equal(embedJson.active_builders, 0);
    assert.equal(embedJson.shipped[0].build_request_id, 'BITE-001');
    const serializedEmbed = JSON.stringify(embedJson);
    assert.equal(serializedEmbed.includes('cookie'), false);
    assert.equal(serializedEmbed.includes('source_url'), false);
    assert.equal(serializedEmbed.includes('display_name'), false);
    assert.equal(serializedEmbed.includes('repository'), false);
  } finally {
    await app.close();
    await db.destroy();
  }
});
