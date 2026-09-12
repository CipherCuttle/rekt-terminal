import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
function cookie(response) { const raw = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'][0] : response.headers['set-cookie']; assert.ok(raw); return raw.split(';')[0]; }
async function session(app, name) { const response = await app.inject({method:'POST', url:'/v1/dev/session', headers:{origin:appOrigin}, payload:{display_name:name}}); assert.equal(response.statusCode,201); return {cookie:cookie(response), playerId:response.json().player.player_id}; }
async function project(app, authCookie) {
  const rounds = await app.inject({method:'GET',url:'/v1/rounds',headers:{cookie:authCookie}}); const round = rounds.json().find((r)=>r.code==='ROUND_01'); assert.ok(round);
  assert.equal((await app.inject({method:'POST',url:`/v1/rounds/${round.round_id}/join`,headers:{origin:appOrigin,cookie:authCookie}})).statusCode,200);
  const created = await app.inject({method:'POST',url:'/v1/missions',headers:{origin:appOrigin,cookie:authCookie},payload:{request_id:randomUUID(),round_id:round.round_id,project_name:'Discussion World',goal:'Make social context useful',ship_condition:'Discussion remains bounded',current_focus:'Ask for help',next_move:'Open beacon'}}); assert.equal(created.statusCode,201); return {projectId:created.json().project.project_id, missionId:created.json().mission.mission_id};
}

test('Phase 5 discussion is project-scoped, moderation-safe and World broadcasts meaning rather than engagement', async () => {
  const db = createDatabase(databaseUrl); await migrateToLatest(db); const app = buildApp({db,appOrigin,allowDevAuth:true,sessionTtlSeconds:3600,github:null});
  try {
    const alice = await session(app, `Alice D ${randomUUID().slice(0,6)}`); const bob = await session(app, `Bob D ${randomUUID().slice(0,6)}`); const carol = await session(app, `Carol D ${randomUUID().slice(0,6)}`);
    const ah={origin:appOrigin,cookie:alice.cookie}, bh={origin:appOrigin,cookie:bob.cookie}, ch={origin:appOrigin,cookie:carol.cookie};
    const first=await project(app,alice.cookie); const second=await project(app,carol.cookie);

    const beacon=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/help-beacons`,headers:ah,payload:{request_id:randomUUID(),summary:'Need a useful human'}}); assert.equal(beacon.statusCode,201);
    const assist=await app.inject({method:'POST',url:`/v1/help-beacons/${beacon.json().beacon_id}/assists`,headers:bh,payload:{request_id:randomUUID(),message:'I can review the flow'}}); assert.equal(assist.statusCode,201);
    assert.equal((await app.inject({method:'POST',url:`/v1/assists/${assist.json().assist_id}/accept`,headers:ah,payload:{request_id:randomUUID()}})).statusCode,200);
    const acceptedEvent=await db.selectFrom('history_events').select('payload').where('event_type','=','project.assist.accepted').where('subject_id','=',first.projectId).executeTakeFirstOrThrow(); assert.equal(acceptedEvent.payload.truth_state,'OBSERVED');

    const commentReq=randomUUID();
    const comment=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/comments`,headers:bh,payload:{request_id:commentReq,body:'The onboarding copy is ambiguous.'}}); assert.equal(comment.statusCode,201); const commentId=comment.json().comment_id;
    const replay=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/comments`,headers:bh,payload:{request_id:commentReq,body:'The onboarding copy is ambiguous.'}}); assert.equal(replay.statusCode,201); assert.equal(replay.json().comment_id,commentId);
    const commentEvents=await db.selectFrom('history_events').selectAll().where('event_type','=','project.comment.created').where('subject_id','=',first.projectId).execute(); assert.equal(commentEvents.length,1); assert.equal(commentEvents[0].payload.truth_state,'CLAIMED');

    const reply=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/comments`,headers:ah,payload:{request_id:randomUUID(),body:'Good catch — fixing it.',parent_comment_id:commentId}}); assert.equal(reply.statusCode,201); assert.equal(reply.json().parent_comment_id,commentId);
    const cross=await app.inject({method:'POST',url:`/v1/projects/${second.projectId}/comments`,headers:ch,payload:{request_id:randomUUID(),body:'Cross project reply',parent_comment_id:commentId}}); assert.equal(cross.statusCode,409); assert.equal(cross.json().error,'parent_comment_project_mismatch');

    const reactReq=randomUUID();
    assert.equal((await app.inject({method:'POST',url:`/v1/comments/${commentId}/reactions/useful`,headers:ah,payload:{request_id:reactReq}})).statusCode,200);
    assert.equal((await app.inject({method:'POST',url:`/v1/comments/${commentId}/reactions/useful`,headers:ah,payload:{request_id:randomUUID()}})).statusCode,200);
    const reactionRows=await db.selectFrom('project_comment_reactions').selectAll().where('comment_id','=',commentId).where('player_id','=',alice.playerId).execute(); assert.equal(reactionRows.length,1);
    const reactionEvents=await db.selectFrom('history_events').selectAll().where('event_type','=','project.comment.reacted').where('subject_id','=',first.projectId).execute(); assert.equal(reactionEvents.length,1);

    const bobLock=await app.inject({method:'PATCH',url:`/v1/projects/${first.projectId}/discussion`,headers:bh,payload:{request_id:randomUUID(),locked:true}}); assert.equal(bobLock.statusCode,403);
    assert.equal((await app.inject({method:'PATCH',url:`/v1/projects/${first.projectId}/discussion`,headers:ah,payload:{request_id:randomUUID(),locked:true}})).statusCode,200);
    const lockedComment=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/comments`,headers:bh,payload:{request_id:randomUUID(),body:'Should be blocked'}}); assert.equal(lockedComment.statusCode,409); assert.equal(lockedComment.json().error,'project_discussion_locked');
    const lockedReaction=await app.inject({method:'POST',url:`/v1/comments/${reply.json().comment_id}/reactions/useful`,headers:bh,payload:{request_id:randomUUID()}}); assert.equal(lockedReaction.statusCode,409);
    const listedLocked=await app.inject({method:'GET',url:`/v1/projects/${first.projectId}/comments`}); assert.equal(listedLocked.statusCode,200); assert.equal(listedLocked.json().locked,true); assert.equal(listedLocked.json().comments.length,2);
    assert.equal((await app.inject({method:'PATCH',url:`/v1/projects/${first.projectId}/discussion`,headers:ah,payload:{request_id:randomUUID(),locked:false}})).statusCode,200);

    const aliceCannotDelete=await app.inject({method:'DELETE',url:`/v1/comments/${commentId}`,headers:ah,payload:{request_id:randomUUID()}}); assert.equal(aliceCannotDelete.statusCode,403);
    const deleted=await app.inject({method:'DELETE',url:`/v1/comments/${commentId}`,headers:bh,payload:{request_id:randomUUID()}}); assert.equal(deleted.statusCode,200); assert.equal(deleted.json().state,'DELETED');
    const afterDelete=await app.inject({method:'GET',url:`/v1/projects/${first.projectId}/comments`}); const deletedView=afterDelete.json().comments.find((c)=>c.comment_id===commentId); assert.equal(deletedView.state,'DELETED'); assert.equal('body' in deletedView,false);
    const reactDeleted=await app.inject({method:'POST',url:`/v1/comments/${commentId}/reactions/useful`,headers:ch,payload:{request_id:randomUUID()}}); assert.equal(reactDeleted.statusCode,409);

    const world=await app.inject({method:'GET',url:'/v1/world/signals'}); assert.equal(world.statusCode,200); const mine=world.json().filter((s)=>s.project_id===first.projectId); assert.ok(mine.some((s)=>s.kind==='HELP_BEACON_OPENED'&&s.truth_state==='CLAIMED')); assert.ok(mine.some((s)=>s.kind==='ASSIST_ACCEPTED'&&s.truth_state==='OBSERVED'));
    assert.equal(JSON.stringify(world.json()).includes('The onboarding copy is ambiguous.'),false); assert.equal(JSON.stringify(world.json()).includes('USEFUL'),false);
    assert.equal(mine.every((s)=>['HELP_BEACON_OPENED','ASSIST_ACCEPTED'].includes(s.kind)),true);

    const gates=await db.selectFrom('mission_gates').selectAll().where('mission_id','=',first.missionId).execute(); assert.equal(gates.every((g)=>g.signal_state==='UNKNOWN'),true);
    const projectEvents=await db.selectFrom('history_events').selectAll().where('subject_id','=',first.projectId).execute(); assert.equal(JSON.stringify(projectEvents).includes('PROVEN'),false);
  } finally { await app.close(); await db.destroy(); }
});
