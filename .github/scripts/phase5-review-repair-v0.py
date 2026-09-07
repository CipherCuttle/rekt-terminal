from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


social = 'apps/inkubator-api/src/social.ts'

# Compare the complete normalized beacon mutation payload on every replay.
replace_once(
    social,
    """function readLabels(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return [];
  return (value as string[]).slice(0, 8);
}
""",
    """function readLabels(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return [];
  return (value as string[]).slice(0, 8);
}

function sameLabels(value: unknown, expected: string[]): boolean {
  const current = readLabels(value);
  return current.length === expected.length && current.every((label, index) => label === expected[index]);
}
""",
)

# P1/P2: exact beacon replays must be rechecked after serialization, and skills are
# part of the idempotency identity.
replace_once(
    social,
    """    const replay = await tx.selectFrom('help_beacons').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.project_id !== projectId || replay.owner_player_id !== actorId || replay.summary !== summary) throw new Error('help_beacon_idempotency_conflict');
      return beaconView(replay);
    }
    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).forUpdate().executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    if (project.owner_player_id !== actorId) throw new Error('authorization_denied');
    const open = await tx.selectFrom('help_beacons').select('beacon_id').where('project_id', '=', projectId).where('state', '=', 'OPEN').executeTakeFirst();
""",
    """    const replay = await tx.selectFrom('help_beacons').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.project_id !== projectId || replay.owner_player_id !== actorId || replay.summary !== summary || !sameLabels(replay.skills_needed, skillsNeeded)) throw new Error('help_beacon_idempotency_conflict');
      return beaconView(replay);
    }
    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).forUpdate().executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    const lockedReplay = await tx.selectFrom('help_beacons').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (lockedReplay) {
      if (lockedReplay.project_id !== projectId || lockedReplay.owner_player_id !== actorId || lockedReplay.summary !== summary || !sameLabels(lockedReplay.skills_needed, skillsNeeded)) throw new Error('help_beacon_idempotency_conflict');
      return beaconView(lockedReplay);
    }
    if (project.owner_player_id !== actorId) throw new Error('authorization_denied');
    const open = await tx.selectFrom('help_beacons').select('beacon_id').where('project_id', '=', projectId).where('state', '=', 'OPEN').executeTakeFirst();
""",
)

# P1: explicit owner-controlled Help Beacon lifecycle; acceptance does not imply the
# contextual need is resolved.
insert_after = """export async function offerAssist(db: Kysely<DatabaseSchema>, actorIdInput: string, beaconIdInput: string, input: {requestId: string; message: string}) {
"""
close_fn = """export async function closeHelpBeacon(db: Kysely<DatabaseSchema>, actorIdInput: string, beaconIdInput: string, requestIdInput: string) {
  const actorId = uuid(actorIdInput, 'player_id');
  const beaconId = uuid(beaconIdInput, 'beacon_id');
  const requestId = uuid(requestIdInput, 'request_id');
  return db.transaction().execute(async (tx) => {
    const beacon = await tx.selectFrom('help_beacons').selectAll().where('beacon_id', '=', beaconId).forUpdate().executeTakeFirst();
    if (!beacon) throw new Error('help_beacon_not_found');
    if (beacon.owner_player_id !== actorId) throw new Error('authorization_denied');
    if (beacon.state === 'CLOSED') return beaconView(beacon);
    const closed = await tx.updateTable('help_beacons').set({state: 'CLOSED', closed_at: sql`clock_timestamp()`})
      .where('beacon_id', '=', beaconId).where('state', '=', 'OPEN').returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.help_beacon.closed', dedupeKey: `activity:project.help_beacon.closed:${beaconId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: beacon.project_id,
      payload: {schema_version: 'project.help_beacon.closed.v1', beacon_id: beaconId, project_id: beacon.project_id, request_id: requestId, truth_state: 'CLAIMED'},
    });
    return beaconView(closed);
  });
}

"""
replace_once(social, insert_after, close_fn + insert_after)

# P1: offerAssist replay must be rechecked after the beacon row lock.
replace_once(
    social,
    """    const beacon = await tx.selectFrom('help_beacons').selectAll().where('beacon_id', '=', beaconId).forUpdate().executeTakeFirst();
    if (!beacon) throw new Error('help_beacon_not_found');
    if (beacon.state !== 'OPEN') throw new Error('help_beacon_not_open');
""",
    """    const beacon = await tx.selectFrom('help_beacons').selectAll().where('beacon_id', '=', beaconId).forUpdate().executeTakeFirst();
    if (!beacon) throw new Error('help_beacon_not_found');
    const lockedReplay = await tx.selectFrom('assist_offers').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (lockedReplay) {
      if (lockedReplay.beacon_id !== beaconId || lockedReplay.offered_by_player_id !== actorId || lockedReplay.message !== message) throw new Error('assist_idempotency_conflict');
      return assistView(lockedReplay);
    }
    if (beacon.state !== 'OPEN') throw new Error('help_beacon_not_open');
""",
)

# P2: bound the discussion to the newest 200, then restore chronological display.
replace_once(
    social,
    """  const rows = await db.selectFrom('project_comments as comment')
    .innerJoin('players as author', 'author.player_id', 'comment.author_player_id')
    .select(['comment.comment_id', 'comment.project_id', 'comment.author_player_id', 'comment.parent_comment_id', 'comment.body', 'comment.state', 'comment.created_at', 'author.display_name'])
    .where('comment.project_id', '=', projectId)
    .orderBy('comment.created_at', 'asc').orderBy('comment.comment_id', 'asc').limit(200).execute();
""",
    """  const newestRows = await db.selectFrom('project_comments as comment')
    .innerJoin('players as author', 'author.player_id', 'comment.author_player_id')
    .select(['comment.comment_id', 'comment.project_id', 'comment.author_player_id', 'comment.parent_comment_id', 'comment.body', 'comment.state', 'comment.created_at', 'author.display_name'])
    .where('comment.project_id', '=', projectId)
    .orderBy('comment.created_at', 'desc').orderBy('comment.comment_id', 'desc').limit(200).execute();
  const rows = [...newestRows].reverse();
""",
)

# P1: createProjectComment replay after Project lock.
replace_once(
    social,
    """    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).forUpdate().executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    if (await interactionBlocked(tx, actorId, project.owner_player_id)) throw new Error('social_interaction_blocked');
    if (await discussionLocked(tx, projectId)) throw new Error('project_discussion_locked');
""",
    """    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).forUpdate().executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    const lockedReplay = await tx.selectFrom('project_comments').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (lockedReplay) {
      if (lockedReplay.project_id !== projectId || lockedReplay.author_player_id !== actorId || lockedReplay.parent_comment_id !== parentCommentId || lockedReplay.body !== body) throw new Error('comment_idempotency_conflict');
      const author = await tx.selectFrom('players').select('display_name').where('player_id', '=', actorId).executeTakeFirstOrThrow();
      const count = await tx.selectFrom('project_comment_reactions').select(({fn}) => fn.countAll<number>().as('count')).where('comment_id', '=', lockedReplay.comment_id).where('reaction', '=', 'USEFUL').executeTakeFirstOrThrow();
      return commentView(lockedReplay, author.display_name, Number(count.count));
    }
    if (await interactionBlocked(tx, actorId, project.owner_player_id)) throw new Error('social_interaction_blocked');
    if (await discussionLocked(tx, projectId)) throw new Error('project_discussion_locked');
""",
)

# Systemic sibling: report creation has the same externally retried pre-lock receipt
# shape. Serialize on the target comment and recheck before insertion.
replace_once(
    social,
    """    const comment=await tx.selectFrom('project_comments').select(['comment_id','project_id']).where('comment_id','=',commentId).executeTakeFirst(); if(!comment) throw new Error('comment_not_found');
    const row=await tx.insertInto('content_reports').values({report_id:randomUUID(),reporter_player_id:actorId,comment_id:commentId,creation_request_id:requestId,reason:input.reason as 'SPAM'|'ABUSE'|'PRIVACY'|'OTHER',detail,state:'OPEN'}).returningAll().executeTakeFirstOrThrow();
""",
    """    const comment=await tx.selectFrom('project_comments').select(['comment_id','project_id']).where('comment_id','=',commentId).forUpdate().executeTakeFirst(); if(!comment) throw new Error('comment_not_found');
    const lockedReplay=await tx.selectFrom('content_reports').selectAll().where('creation_request_id','=',requestId).executeTakeFirst();
    if(lockedReplay){if(lockedReplay.reporter_player_id!==actorId||lockedReplay.comment_id!==commentId||lockedReplay.reason!==input.reason||lockedReplay.detail!==detail) throw new Error('report_idempotency_conflict'); return {schema_version:'content.report.private.v1' as const,report_id:lockedReplay.report_id,comment_id:commentId,reason:lockedReplay.reason,state:lockedReplay.state};}
    const row=await tx.insertInto('content_reports').values({report_id:randomUUID(),reporter_player_id:actorId,comment_id:commentId,creation_request_id:requestId,reason:input.reason as 'SPAM'|'ABUSE'|'PRIVACY'|'OTHER',detail,state:'OPEN'}).returningAll().executeTakeFirstOrThrow();
""",
)

# P1: external test request replay after Project lock.
replace_once(
    social,
    """    const project=await tx.selectFrom('projects').select(['project_id','owner_player_id']).where('project_id','=',projectId).forUpdate().executeTakeFirst(); if(!project) throw new Error('project_not_found'); if(project.owner_player_id!==actorId) throw new Error('authorization_denied');
    const open=await tx.selectFrom('external_test_requests').select('test_request_id').where('project_id','=',projectId).where('state','=','OPEN').executeTakeFirst(); if(open) throw new Error('external_test_request_already_open');
""",
    """    const project=await tx.selectFrom('projects').select(['project_id','owner_player_id']).where('project_id','=',projectId).forUpdate().executeTakeFirst(); if(!project) throw new Error('project_not_found');
    const lockedReplay=await tx.selectFrom('external_test_requests').selectAll().where('creation_request_id','=',requestId).executeTakeFirst(); if(lockedReplay){if(lockedReplay.project_id!==projectId||lockedReplay.owner_player_id!==actorId||lockedReplay.prompt!==prompt) throw new Error('external_test_request_idempotency_conflict'); return testRequestView(lockedReplay);}
    if(project.owner_player_id!==actorId) throw new Error('authorization_denied');
    const open=await tx.selectFrom('external_test_requests').select('test_request_id').where('project_id','=',projectId).where('state','=','OPEN').executeTakeFirst(); if(open) throw new Error('external_test_request_already_open');
""",
)

# P1: result replay after test-request lock, before the now-COMPLETED state check.
replace_once(
    social,
    """    const request=await tx.selectFrom('external_test_requests').selectAll().where('test_request_id','=',testRequestId).forUpdate().executeTakeFirst(); if(!request) throw new Error('external_test_request_not_found'); if(request.owner_player_id===actorId) throw new Error('external_test_self_forbidden'); if(request.state!=='OPEN') throw new Error('external_test_request_not_open');
    if(await interactionBlocked(tx,actorId,request.owner_player_id)) throw new Error('social_interaction_blocked');
""",
    """    const request=await tx.selectFrom('external_test_requests').selectAll().where('test_request_id','=',testRequestId).forUpdate().executeTakeFirst(); if(!request) throw new Error('external_test_request_not_found');
    const lockedReplay=await tx.selectFrom('external_test_results').selectAll().where('creation_request_id','=',requestId).executeTakeFirst(); if(lockedReplay){if(lockedReplay.test_request_id!==testRequestId||lockedReplay.tester_player_id!==actorId||lockedReplay.outcome!==input.outcome||lockedReplay.summary!==summary) throw new Error('external_test_result_idempotency_conflict'); const tester=await tx.selectFrom('players').select('display_name').where('player_id','=',actorId).executeTakeFirstOrThrow(); return testResultView(lockedReplay,tester.display_name);}
    if(request.owner_player_id===actorId) throw new Error('external_test_self_forbidden'); if(request.state!=='OPEN') throw new Error('external_test_request_not_open');
    if(await interactionBlocked(tx,actorId,request.owner_player_id)) throw new Error('social_interaction_blocked');
""",
)

# HTTP route for the owner-only beacon close transition.
app = 'apps/inkubator-api/src/app.ts'
replace_once(
    app,
    """import {acceptAssist, blockPlayer, createExternalTestRequest, createHelpBeacon, createProjectComment, deleteOwnProjectComment, followPlayer, getProjectExternalTests, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, listProjectComments, listWorldSignals, offerAssist, reactUsefulToComment, recordExternalTestResult, reportProjectComment, setProjectDiscussionLock, unblockPlayer, watchProject} from './social.js';
""",
    """import {acceptAssist, blockPlayer, closeHelpBeacon, createExternalTestRequest, createHelpBeacon, createProjectComment, deleteOwnProjectComment, followPlayer, getProjectExternalTests, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, listProjectComments, listWorldSignals, offerAssist, reactUsefulToComment, recordExternalTestResult, reportProjectComment, setProjectDiscussionLock, unblockPlayer, watchProject} from './social.js';
""",
)
route_anchor = """  app.post('/v1/help-beacons/:beaconId/assists', {schema: {body: fastifyBodySchema('AssistOfferCreateRequest')}}, async (request, reply) => {
"""
close_route = """  app.post('/v1/help-beacons/:beaconId/close', {schema: {body: fastifyBodySchema('SocialMutationRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {beaconId} = request.params as {beaconId: string};
    const body = request.body as {request_id: string};
    try { return await closeHelpBeacon(options.db, authenticated.actor.playerId, beaconId, body.request_id); }
    catch (cause) { return phase5Error(reply, cause); }
  });

"""
replace_once(app, route_anchor, close_route + route_anchor)

# OpenAPI/typed-client boundary for the new close transition.
contract = 'apps/inkubator-api/src/contract.ts'
contract_anchor = """    '/v1/help-beacons/{beaconId}/assists': {post: {operationId: 'offerAssist', security: [{sessionCookie: []}], parameters: [{name: 'beaconId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('AssistOfferCreateRequest')}}}, responses: {'201': {description: 'Assist offered', content: {'application/json': {schema: ref('AssistView')}}}, '400': errorResponse('Invalid Assist'), '401': errorResponse('Authentication required'), '403': errorResponse('Self-assist forbidden'), '404': errorResponse('Beacon not found'), '409': errorResponse('Assist conflict')}}},
"""
close_contract = """    '/v1/help-beacons/{beaconId}/close': {post: {operationId: 'closeHelpBeacon', security: [{sessionCookie: []}], parameters: [{name: 'beaconId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Project owner closes Help Beacon', content: {'application/json': {schema: ref('HelpBeaconView')}}}, '400': errorResponse('Invalid Beacon'), '401': errorResponse('Authentication required'), '403': errorResponse('Project owner required'), '404': errorResponse('Beacon not found')}}},
"""
replace_once(contract, contract_anchor, close_contract + contract_anchor)

# Focused regression: force two identical requests to pass their first replay lookup
# and block on the same parent-row lock before releasing serialization.
test_path = Path('apps/inkubator-api/test/integration/phase5-review-repair.test.mjs')
test_path.write_text(r'''import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('DATABASE_URL is required');
const appOrigin=process.env.INKUBATOR_APP_ORIGIN??'http://127.0.0.1:4175';
const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
function cookie(response){const value=response.headers['set-cookie'];const serialized=Array.isArray(value)?value[0]:value;assert.ok(serialized);return serialized.split(';')[0];}
async function session(app,name){const r=await app.inject({method:'POST',url:'/v1/dev/session',headers:{origin:appOrigin},payload:{display_name:name}});assert.equal(r.statusCode,201);return{cookie:cookie(r),playerId:r.json().player.player_id};}
async function project(app,authCookie,name){const rounds=await app.inject({method:'GET',url:'/v1/rounds',headers:{cookie:authCookie}});const founding=rounds.json().find((round)=>round.code==='ROUND_01');assert.ok(founding);await app.inject({method:'POST',url:`/v1/rounds/${founding.round_id}/join`,headers:{origin:appOrigin,cookie:authCookie}});const r=await app.inject({method:'POST',url:'/v1/missions',headers:{origin:appOrigin,cookie:authCookie},payload:{request_id:randomUUID(),round_id:founding.round_id,project_name:name,goal:'Exercise review repair',ship_condition:'Concurrency is deterministic',current_focus:'repair',next_move:'verify'}});assert.equal(r.statusCode,201);return r.json().project.project_id;}
async function developmentProject(app,authCookie,name){const r=await app.inject({method:'POST',url:'/v1/development/projects',headers:{origin:appOrigin,cookie:authCookie},payload:{name,goal:'window',ship_condition:'window',current_focus:'window',next_move:'window'}});assert.equal(r.statusCode,201);return r.json().project_id;}
async function waitForLockWaiters(db,minimum=2){for(let i=0;i<100;i++){const result=await sql`select count(*)::int as count from pg_stat_activity where datname=current_database() and wait_event_type='Lock'`.execute(db);if(Number(result.rows[0]?.count??0)>=minimum)return;await sleep(20);}throw new Error(`expected_${minimum}_lock_waiters`);}
async function raceBehindLock(db,lock,pair){let pending;await db.transaction().execute(async(tx)=>{await lock(tx);pending=Promise.all([pair(),pair()]);await waitForLockWaiters(db,2);});return pending;}

test('Phase 5 review repair serializes concurrent retries and restores repeatable Beacon lifecycle',async()=>{const db=createDatabase(databaseUrl);await migrateToLatest(db);const app=buildApp({db,appOrigin,allowDevAuth:true,sessionTtlSeconds:3600,github:null});try{
 const owner=await session(app,`Owner R ${randomUUID().slice(0,5)}`),helper=await session(app,`Helper R ${randomUUID().slice(0,5)}`);const oh={origin:appOrigin,cookie:owner.cookie},hh={origin:appOrigin,cookie:helper.cookie};const projectId=await project(app,owner.cookie,`Review ${randomUUID().slice(0,5)}`);
 const beaconRequest=randomUUID();const beaconCall=()=>app.inject({method:'POST',url:`/v1/projects/${projectId}/help-beacons`,headers:oh,payload:{request_id:beaconRequest,summary:'Need concurrency help',skills_needed:['testing','TypeScript']}});const beacons=await raceBehindLock(db,(tx)=>tx.selectFrom('projects').select('project_id').where('project_id','=',projectId).forUpdate().executeTakeFirstOrThrow(),beaconCall);assert.deepEqual(beacons.map((r)=>r.statusCode),[201,201]);assert.equal(beacons[0].json().beacon_id,beacons[1].json().beacon_id);const beaconId=beacons[0].json().beacon_id;
 const skillConflict=await app.inject({method:'POST',url:`/v1/projects/${projectId}/help-beacons`,headers:oh,payload:{request_id:beaconRequest,summary:'Need concurrency help',skills_needed:['different']}});assert.equal(skillConflict.statusCode,409);
 const assistRequest=randomUUID();const assistCall=()=>app.inject({method:'POST',url:`/v1/help-beacons/${beaconId}/assists`,headers:hh,payload:{request_id:assistRequest,message:'I can help'}});const assists=await raceBehindLock(db,(tx)=>tx.selectFrom('help_beacons').select('beacon_id').where('beacon_id','=',beaconId).forUpdate().executeTakeFirstOrThrow(),assistCall);assert.deepEqual(assists.map((r)=>r.statusCode),[201,201]);assert.equal(assists[0].json().assist_id,assists[1].json().assist_id);
 const deniedClose=await app.inject({method:'POST',url:`/v1/help-beacons/${beaconId}/close`,headers:hh,payload:{request_id:randomUUID()}});assert.equal(deniedClose.statusCode,403);const closeRequest=randomUUID();const closed=await app.inject({method:'POST',url:`/v1/help-beacons/${beaconId}/close`,headers:oh,payload:{request_id:closeRequest}});assert.equal(closed.statusCode,200);assert.equal(closed.json().state,'CLOSED');const closeRetry=await app.inject({method:'POST',url:`/v1/help-beacons/${beaconId}/close`,headers:oh,payload:{request_id:closeRequest}});assert.equal(closeRetry.statusCode,200);assert.equal(closeRetry.json().state,'CLOSED');const second=await app.inject({method:'POST',url:`/v1/projects/${projectId}/help-beacons`,headers:oh,payload:{request_id:randomUUID(),summary:'A later contextual need'}});assert.equal(second.statusCode,201);assert.notEqual(second.json().beacon_id,beaconId);
 const commentRequest=randomUUID();const commentCall=()=>app.inject({method:'POST',url:`/v1/projects/${projectId}/comments`,headers:hh,payload:{request_id:commentRequest,body:'Concurrent comment'}});const comments=await raceBehindLock(db,(tx)=>tx.selectFrom('projects').select('project_id').where('project_id','=',projectId).forUpdate().executeTakeFirstOrThrow(),commentCall);assert.deepEqual(comments.map((r)=>r.statusCode),[201,201]);assert.equal(comments[0].json().comment_id,comments[1].json().comment_id);const commentId=comments[0].json().comment_id;
 const reportRequest=randomUUID();const reportCall=()=>app.inject({method:'POST',url:`/v1/comments/${commentId}/report`,headers:oh,payload:{request_id:reportRequest,reason:'OTHER',detail:'Concurrent report'}});const reports=await raceBehindLock(db,(tx)=>tx.selectFrom('project_comments').select('comment_id').where('comment_id','=',commentId).forUpdate().executeTakeFirstOrThrow(),reportCall);assert.deepEqual(reports.map((r)=>r.statusCode),[201,201]);assert.equal(reports[0].json().report_id,reports[1].json().report_id);
 const testRequestIdempotency=randomUUID();const testRequestCall=()=>app.inject({method:'POST',url:`/v1/projects/${projectId}/tester-requests`,headers:oh,payload:{request_id:testRequestIdempotency,prompt:'Test concurrency'}});const requests=await raceBehindLock(db,(tx)=>tx.selectFrom('projects').select('project_id').where('project_id','=',projectId).forUpdate().executeTakeFirstOrThrow(),testRequestCall);assert.deepEqual(requests.map((r)=>r.statusCode),[201,201]);assert.equal(requests[0].json().test_request_id,requests[1].json().test_request_id);const testRequestId=requests[0].json().test_request_id;
 const resultRequest=randomUUID();const resultCall=()=>app.inject({method:'POST',url:`/v1/tester-requests/${testRequestId}/results`,headers:hh,payload:{request_id:resultRequest,outcome:'PASS',summary:'Concurrent result'}});const results=await raceBehindLock(db,(tx)=>tx.selectFrom('external_test_requests').select('test_request_id').where('test_request_id','=',testRequestId).forUpdate().executeTakeFirstOrThrow(),resultCall);assert.deepEqual(results.map((r)=>r.statusCode),[201,201]);assert.equal(results[0].json().test_result_id,results[1].json().test_result_id);
 const windowProject=await developmentProject(app,owner.cookie,`Window ${randomUUID().slice(0,5)}`);const base=Date.UTC(2026,0,1);const bulk=Array.from({length:201},(_,i)=>({comment_id:randomUUID(),project_id:windowProject,author_player_id:owner.playerId,parent_comment_id:null,creation_request_id:randomUUID(),deletion_request_id:null,body:`window-${i}`,state:'ACTIVE',deleted_at:null,created_at:new Date(base+i*1000),updated_at:new Date(base+i*1000)}));await db.insertInto('project_comments').values(bulk).execute();const listed=await app.inject({method:'GET',url:`/v1/projects/${windowProject}/comments`});assert.equal(listed.statusCode,200);assert.equal(listed.json().comments.length,200);assert.equal(listed.json().comments.some((c)=>c.body==='window-0'),false);assert.equal(listed.json().comments[0].body,'window-1');assert.equal(listed.json().comments.at(-1).body,'window-200');
 const closeEvents=await db.selectFrom('history_events').selectAll().where('event_type','=','project.help_beacon.closed').where('subject_id','=',projectId).execute();assert.equal(closeEvents.length,1);assert.equal(JSON.stringify(closeEvents).includes('PROVEN'),false);
}finally{await app.close();await db.destroy();}});
''')

print('Phase 5 review repair applied')
