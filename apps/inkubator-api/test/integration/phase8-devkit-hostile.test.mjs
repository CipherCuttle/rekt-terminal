import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {buildApp} from '../../dist/app.js';

const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('DATABASE_URL required');
const origin='https://inkubator.test';
const requestId=()=>randomUUID();
function cookieOf(response){const raw=response.headers['set-cookie'];if(typeof raw!=='string')throw new Error('cookie_missing');return raw.split(';')[0];}

test('Phase 8 DevKit keeps one canonical truth state behind bounded credentials',async()=>{
  const db=createDatabase(databaseUrl);await migrateToLatest(db);const app=buildApp({db,appOrigin:origin,allowDevAuth:true,sessionTtlSeconds:3600});
  try{
    const session=await app.inject({method:'POST',url:'/v1/dev/session',headers:{origin},payload:{display_name:`DevKit ${randomUUID().slice(0,8)}`}});assert.equal(session.statusCode,201);const cookie=cookieOf(session);const playerId=session.json().player.player_id;
    const roundId=randomUUID();await db.insertInto('rounds').values({round_id:roundId,schema_version:'round.current.v1',code:`DK_${randomUUID().replaceAll('-','').slice(0,10)}`,title:'DevKit Hostile Round',constraint_text:'Preserve truth boundary',state:'OPEN'}).execute();
    assert.equal((await app.inject({method:'POST',url:`/v1/rounds/${roundId}/join`,headers:{origin,cookie}})).statusCode,200);
    const created=await app.inject({method:'POST',url:'/v1/missions',headers:{origin,cookie},payload:{request_id:requestId(),round_id:roundId,project_name:'DevKit Project',goal:'One truth system',ship_condition:'Public HTTPS artifact',current_focus:'Build DevKit',next_move:'Verify scopes'}});assert.equal(created.statusCode,201);

    const tokenRequest=requestId();const issued=await app.inject({method:'POST',url:'/v1/devkit/tokens',headers:{origin,cookie},payload:{request_id:tokenRequest,credential_class:'CLI',label:'Hostile test',scopes:['player:read','project:read','mission:read','claim:write','update:write','beacon:write','assist:write','ship:prepare'],expires_in_seconds:3600}});assert.equal(issued.statusCode,201,issued.body);const token=issued.json().token;const tokenId=issued.json().token_id;const bearer={authorization:`Bearer ${token}`};
    const replay=await app.inject({method:'POST',url:'/v1/devkit/tokens',headers:{origin,cookie},payload:{request_id:tokenRequest,credential_class:'CLI',label:'Hostile test',scopes:['mission:read'],expires_in_seconds:3600}});assert.equal(replay.statusCode,409);assert.equal((await db.selectFrom('devkit_tokens').select('token_id').where('player_id','=',playerId).execute()).length,1);

    const web=await app.inject({method:'GET',url:'/v1/me/command',headers:{cookie}});const devkit=await app.inject({method:'GET',url:'/v1/devkit/mission/current',headers:bearer});assert.equal(web.statusCode,200);assert.equal(devkit.statusCode,200);assert.deepEqual(devkit.json(),web.json());

    const proven=await app.inject({method:'POST',url:'/v1/devkit/mission/current/claims/FOUNDATION',headers:bearer,payload:{request_id:requestId(),state:'PROVEN'}});assert.equal(proven.statusCode,403);const afterProven=await app.inject({method:'GET',url:'/v1/devkit/mission/current',headers:bearer});assert.notEqual(afterProven.json().gates.find((gate)=>gate.key==='FOUNDATION')?.state,'PROVEN');

    const updateId=requestId();const payload={request_id:updateId,current_focus:'Same canonical update'};const first=await app.inject({method:'PATCH',url:'/v1/devkit/mission/current',headers:bearer,payload});const second=await app.inject({method:'PATCH',url:'/v1/devkit/mission/current',headers:bearer,payload});assert.equal(first.statusCode,200,first.body);assert.equal(second.statusCode,200,second.body);assert.deepEqual(second.json(),first.json());const events=await db.selectFrom('history_events').select('history_event_id').where('dedupe_key','like',`%${updateId}%`).execute();assert.equal(events.length,1);

    const readOnly=await app.inject({method:'POST',url:'/v1/devkit/tokens',headers:{origin,cookie},payload:{request_id:requestId(),credential_class:'MCP',label:'Read only',scopes:['mission:read'],expires_in_seconds:3600}});const readBearer={authorization:`Bearer ${readOnly.json().token}`};assert.equal((await app.inject({method:'PATCH',url:'/v1/devkit/mission/current',headers:readBearer,payload:{request_id:requestId(),current_focus:'forbidden'}})).statusCode,403);

    await db.updateTable('devkit_tokens').set({rate_count:60,rate_window_started_at:new Date()}).where('token_id','=',tokenId).execute();const limited=await app.inject({method:'GET',url:'/v1/devkit/mission/current',headers:bearer});assert.equal(limited.statusCode,429);assert.equal(limited.headers['retry-after']!==undefined,true);
    await db.updateTable('devkit_tokens').set({rate_count:0,rate_window_started_at:new Date(0)}).where('token_id','=',tokenId).execute();

    const revoked=await app.inject({method:'POST',url:`/v1/devkit/tokens/${tokenId}/revoke`,headers:{origin,cookie}});assert.equal(revoked.statusCode,200);assert.equal((await app.inject({method:'GET',url:'/v1/devkit/mission/current',headers:bearer})).statusCode,401);
  } finally {await app.close();await db.destroy();}
});
