import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {sql} from 'kysely';
import {buildApp} from '../../dist/app.js';
import {compileOrganizerDraft, registerStageEChallengeProductRoutes} from '../../dist/challenge-product-api.js';
import {acquireChallengeSeat, createChallenge} from '../../dist/challenge-store.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('DATABASE_URL is required');
const appOrigin=process.env.INKUBATOR_APP_ORIGIN??'http://127.0.0.1:4175';
const t0=1_900_000_000_000;
const artifactDigest='a'.repeat(64);
function cookieFrom(response){const value=response.headers['set-cookie'];const serialized=Array.isArray(value)?value[0]:value;assert.ok(serialized);return serialized.split(';')[0];}
async function createActor(app,name){const response=await app.inject({method:'POST',url:'/v1/dev/session',headers:{origin:appOrigin},payload:{display_name:name}});assert.equal(response.statusCode,201);return {playerId:response.json().player.player_id,cookie:cookieFrom(response)};}
async function issueToken(app,cookie,label,scopes){const response=await app.inject({method:'POST',url:'/v1/devkit/tokens',headers:{origin:appOrigin,cookie,'content-type':'application/json'},payload:{request_id:randomUUID(),credential_class:'CLI',label,scopes,expires_in_seconds:3600}});assert.equal(response.statusCode,201,response.body);return response.json().token;}
function acceptedState(){return compileOrganizerDraft({schema_version:'inkubator.compiler-proposal/1.0',source_intent:'Build a public static launch page.',requirements:['accounts','persistence','uploads_private','realtime','notifications','onchain_read','wallet_transactions','custody_private_keys'].map(key=>({key,value:false,provenance:'ORGANIZER_ACCEPTED'})),knowledge:[],outcome_criteria:[],delivery_criteria:[],preferences:{}});}
function authority(){return {contract_version:'1.0.0',title:'F2 Submission Challenge',brief:'Build a public static launch page.',preferences:{},normative_constraints:[],normative_references:[],informational_references:[],prize_minor_units:100,settlement_asset:'TEST'};}
async function createFrozenChallenge(app,db,organizer){
  const challengeId=randomUUID();await createChallenge(db,{requestId:randomUUID(),challengeId,organizerPlayerId:organizer.playerId,organizerPayoutIdentity:`org-${challengeId}`,funderPayoutIdentity:`fund-${challengeId}`,mechanismVersion:'funded-challenge/1.1',settlementPolicyVersion:'funded-challenge-settlement/1.0',ipTermsVersion:'bespoke-winner-transfer/1.0',slotLimit:4,activationMinimum:2,entryDeadlineMs:t0+100,buildStartMs:t0+100,submissionDeadlineMs:t0+1000,appealWindowMs:100,reviewDeadlineMs:t0+2000});
  const state=acceptedState();const preview=await app.inject({method:'POST',url:`/v1/challenges/${challengeId}/build-contract-preview`,headers:{origin:appOrigin,'content-type':'application/json'},payload:{compiler_state:state,authority:authority()}});assert.equal(preview.statusCode,200,preview.body);
  const persisted=await app.inject({method:'POST',url:`/v1/challenges/${challengeId}/build-contract`,headers:{origin:appOrigin,cookie:organizer.cookie,'content-type':'application/json'},payload:{request_id:randomUUID(),compiler_state:state,authority:authority(),expected_terms_digest:preview.json().contract.terms_digest}});assert.equal(persisted.statusCode,200,persisted.body);return {challengeId,termsDigest:persisted.json().terms_digest};
}
async function activateEntry(db,challengeId,builderId){
  await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(db);
  const entry=await acquireChallengeSeat(db,{requestId:randomUUID(),entryId:randomUUID(),challengeId,builderPlayerId:builderId,payoutIdentity:`builder-${randomUUID()}`});
  await sql`update challenges set status = 'BUILDING' where challenge_id = ${challengeId}`.execute(db);
  await sql`update challenge_entries set state = 'ACTIVE', build_start = (select build_start from challenges where challenge_id=${challengeId}), submission_deadline = (select submission_deadline from challenges where challenge_id=${challengeId}) where entry_id=${entry.entry_id}`.execute(db);
  return entry.entry_id;
}
function payload(entryId,termsDigest,overrides={}){return {request_id:randomUUID(),submission_id:randomUUID(),entry_id:entryId,expected_terms_digest:termsDigest,submission_version:1,immutable_source_reference:{kind:'GIT_COMMIT',value:'0123456789abcdef0123456789abcdef01234567'},artifact_digest:artifactDigest,evidence_references:[],...overrides};}

test('F2 immutable submission enforces builder ownership, frozen terms, DB time, replay and immutable versions',async()=>{
  const db=createDatabase(databaseUrl);await migrateToLatest(db);const app=buildApp({db,appOrigin,allowDevAuth:true,sessionTtlSeconds:3600});registerStageEChallengeProductRoutes(app,db);
  try{
    const organizer=await createActor(app,`F2 Organizer ${randomUUID().slice(0,6)}`);const builder=await createActor(app,`F2 Builder ${randomUUID().slice(0,6)}`);const outsider=await createActor(app,`F2 Outsider ${randomUUID().slice(0,6)}`);
    const {challengeId,termsDigest}=await createFrozenChallenge(app,db,organizer);const entryId=await activateEntry(db,challengeId,builder.playerId);
    const builderToken=await issueToken(app,builder.cookie,'f2 builder',['challenge:submit']);const readOnlyToken=await issueToken(app,builder.cookie,'f2 readonly',['project:read']);const outsiderToken=await issueToken(app,outsider.cookie,'f2 outsider',['challenge:submit']);
    const url=`/v1/devkit/challenges/${challengeId}/submissions`;const first=payload(entryId,termsDigest);

    const missingScope=await app.inject({method:'POST',url,headers:{authorization:`Bearer ${readOnlyToken}`},payload:first});assert.equal(missingScope.statusCode,403);assert.equal(missingScope.json().error,'devkit_scope_denied');
    const outsiderAttempt=await app.inject({method:'POST',url,headers:{authorization:`Bearer ${outsiderToken}`},payload:first});assert.equal(outsiderAttempt.statusCode,403);assert.equal(outsiderAttempt.json().error,'challenge_entry_owner_required');
    const before=(await sql`select count(*)::int as count from challenge_submissions where challenge_id=${challengeId}`.execute(db)).rows[0].count;assert.equal(before,0);

    const accepted=await app.inject({method:'POST',url,headers:{authorization:`Bearer ${builderToken}`},payload:first});assert.equal(accepted.statusCode,201,accepted.body);const acceptedBody=accepted.json();assert.equal(acceptedBody.schema_version,'challenge.submission.accepted.v1');assert.equal(acceptedBody.submission_id,first.submission_id);assert.equal(acceptedBody.entry_id,entryId);assert.equal(acceptedBody.terms_digest,termsDigest);assert.notEqual(Date.parse(acceptedBody.accepted_at),0);
    const row=(await sql`select * from challenge_submissions where submission_id=${first.submission_id}`.execute(db)).rows[0];assert.ok(row);assert.equal(new Date(acceptedBody.accepted_at).getTime(),row.accepted_at.getTime());assert.notEqual(row.accepted_at.getTime(),0);

    const replay=await app.inject({method:'POST',url,headers:{authorization:`Bearer ${builderToken}`},payload:first});assert.equal(replay.statusCode,201,replay.body);assert.equal(replay.json().submission_id,acceptedBody.submission_id);assert.equal(replay.json().accepted_at,acceptedBody.accepted_at);

    const stale=payload(entryId,'b'.repeat(64),{submission_version:2});const staleResponse=await app.inject({method:'POST',url,headers:{authorization:`Bearer ${builderToken}`},payload:stale});assert.equal(staleResponse.statusCode,409);assert.equal(staleResponse.json().error,'challenge_terms_digest_stale');
    const afterStale=(await sql`select count(*)::int as count from challenge_submissions where challenge_id=${challengeId}`.execute(db)).rows[0].count;assert.equal(afterStale,1);

    const changedVersion=payload(entryId,termsDigest,{submission_version:1,artifact_digest:'c'.repeat(64)});const immutable=await app.inject({method:'POST',url,headers:{authorization:`Bearer ${builderToken}`},payload:changedVersion});assert.equal(immutable.statusCode,409);assert.equal(immutable.json().error,'challenge_submission_immutable_conflict');

    await sql`
      with boundary as (select clock_timestamp() as now)
      update challenges
      set entry_deadline = boundary.now - interval '2 seconds',
          build_start = boundary.now - interval '2 seconds',
          submission_deadline = boundary.now - interval '1 second'
      from boundary
      where challenge_id = ${challengeId}
    `.execute(db);
    const late=payload(entryId,termsDigest,{submission_version:2});const lateResponse=await app.inject({method:'POST',url,headers:{authorization:`Bearer ${builderToken}`},payload:late});assert.equal(lateResponse.statusCode,409);assert.equal(lateResponse.json().error,'challenge_submission_deadline_elapsed');
  }finally{await app.close();await db.destroy();}
});
