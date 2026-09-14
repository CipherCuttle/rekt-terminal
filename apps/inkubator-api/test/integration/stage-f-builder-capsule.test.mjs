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
function cookieFrom(response){const value=response.headers['set-cookie'];const serialized=Array.isArray(value)?value[0]:value;assert.ok(serialized);return serialized.split(';')[0];}
async function createActor(app,name){const response=await app.inject({method:'POST',url:'/v1/dev/session',headers:{origin:appOrigin},payload:{display_name:name}});assert.equal(response.statusCode,201);return {playerId:response.json().player.player_id,cookie:cookieFrom(response)};}
async function issueToken(app,cookie,label){const response=await app.inject({method:'POST',url:'/v1/devkit/tokens',headers:{origin:appOrigin,cookie,'content-type':'application/json'},payload:{request_id:randomUUID(),credential_class:'CLI',label,scopes:['project:read'],expires_in_seconds:3600}});assert.equal(response.statusCode,201);return response.json().token;}
function acceptedState(){return compileOrganizerDraft({schema_version:'inkubator.compiler-proposal/1.0',source_intent:'Build a public static launch page.',requirements:['accounts','persistence','uploads_private','realtime','notifications','onchain_read','wallet_transactions','custody_private_keys'].map(key=>({key,value:false,provenance:'ORGANIZER_ACCEPTED'})),knowledge:[],outcome_criteria:[],delivery_criteria:[],preferences:{}});}
function authority(){return {contract_version:'1.0.0',title:'Builder Capsule Challenge',brief:'Build a public static launch page.',preferences:{},normative_constraints:[],normative_references:[],informational_references:[],prize_minor_units:100,settlement_asset:'TEST'};}
async function createFrozenChallenge(app,db,organizer){
  const challengeId=randomUUID();await createChallenge(db,{requestId:randomUUID(),challengeId,organizerPlayerId:organizer.playerId,organizerPayoutIdentity:`org-${challengeId}`,funderPayoutIdentity:`fund-${challengeId}`,mechanismVersion:'funded-challenge/1.1',settlementPolicyVersion:'funded-challenge-settlement/1.0',ipTermsVersion:'bespoke-winner-transfer/1.0',slotLimit:4,activationMinimum:2,entryDeadlineMs:t0+100,buildStartMs:t0+100,submissionDeadlineMs:t0+1000,appealWindowMs:100,reviewDeadlineMs:t0+2000});
  const state=acceptedState();const preview=await app.inject({method:'POST',url:`/v1/challenges/${challengeId}/build-contract-preview`,headers:{origin:appOrigin,'content-type':'application/json'},payload:{compiler_state:state,authority:authority()}});assert.equal(preview.statusCode,200);
  const persisted=await app.inject({method:'POST',url:`/v1/challenges/${challengeId}/build-contract`,headers:{origin:appOrigin,cookie:organizer.cookie,'content-type':'application/json'},payload:{request_id:randomUUID(),compiler_state:state,authority:authority(),expected_terms_digest:preview.json().contract.terms_digest}});assert.equal(persisted.statusCode,200);return {challengeId,termsDigest:persisted.json().terms_digest};
}
async function seatEntry(db,challengeId,builderId){
  await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(db);
  const entry=await acquireChallengeSeat(db,{requestId:randomUUID(),entryId:randomUUID(),challengeId,builderPlayerId:builderId,payoutIdentity:`builder-${randomUUID()}`});
  return entry.entry_id;
}

test('Stage F Builder Capsule is scoped to the authenticated Challenge builder and frozen contract',async()=>{
  const db=createDatabase(databaseUrl);await migrateToLatest(db);const app=buildApp({db,appOrigin,allowDevAuth:true,sessionTtlSeconds:3600});registerStageEChallengeProductRoutes(app,db);
  try{
    const organizer=await createActor(app,`F1 Organizer ${randomUUID().slice(0,6)}`);const builder=await createActor(app,`F1 Builder ${randomUUID().slice(0,6)}`);const outsider=await createActor(app,`F1 Outsider ${randomUUID().slice(0,6)}`);
    const {challengeId,termsDigest}=await createFrozenChallenge(app,db,organizer);const entryId=await seatEntry(db,challengeId,builder.playerId);
    const builderToken=await issueToken(app,builder.cookie,'builder capsule');const outsiderToken=await issueToken(app,outsider.cookie,'outsider capsule');

    const read=await app.inject({method:'GET',url:`/v1/devkit/challenges/${challengeId}/capsule`,headers:{authorization:`Bearer ${builderToken}`}});assert.equal(read.statusCode,200);const capsule=read.json();assert.equal(capsule.schema_version,'builder-capsule.v1');assert.equal(capsule.challenge_id,challengeId);assert.equal(capsule.entry_id,entryId);assert.equal(capsule.terms_digest,termsDigest);assert.deepEqual(capsule.files.map(file=>file.path),['CHALLENGE.md','contract.json','acceptance/manifest.json','references/manifest.json']);assert.equal(JSON.parse(capsule.files.find(file=>file.path==='contract.json').content).terms_digest,termsDigest);

    const denied=await app.inject({method:'GET',url:`/v1/devkit/challenges/${challengeId}/capsule`,headers:{authorization:`Bearer ${outsiderToken}`}});assert.equal(denied.statusCode,403);assert.equal(denied.json().error,'challenge_entry_required');
    const anonymous=await app.inject({method:'GET',url:`/v1/devkit/challenges/${challengeId}/capsule`});assert.equal(anonymous.statusCode,401);assert.equal(anonymous.json().error,'devkit_credential_required');

    const unfrozenId=randomUUID();await createChallenge(db,{requestId:randomUUID(),challengeId:unfrozenId,organizerPlayerId:organizer.playerId,organizerPayoutIdentity:`org-${unfrozenId}`,funderPayoutIdentity:`fund-${unfrozenId}`,mechanismVersion:'funded-challenge/1.1',settlementPolicyVersion:'funded-challenge-settlement/1.0',ipTermsVersion:'bespoke-winner-transfer/1.0',slotLimit:4,activationMinimum:2,entryDeadlineMs:t0+100,buildStartMs:t0+100,submissionDeadlineMs:t0+1000,appealWindowMs:100,reviewDeadlineMs:t0+2000});await seatEntry(db,unfrozenId,builder.playerId);
    const unfrozen=await app.inject({method:'GET',url:`/v1/devkit/challenges/${unfrozenId}/capsule`,headers:{authorization:`Bearer ${builderToken}`}});assert.equal(unfrozen.statusCode,409);assert.equal(unfrozen.json().error,'challenge_contract_not_frozen');
  }finally{await app.close();await db.destroy();}
});
