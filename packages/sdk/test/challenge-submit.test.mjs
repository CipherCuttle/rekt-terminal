import assert from 'node:assert/strict';
import test from 'node:test';
import {createInkubatorServerClient} from '../dist/server.js';

const challengeId='11111111-1111-4111-8111-111111111111';
const entryId='33333333-3333-4333-8333-333333333333';
const termsDigest='a'.repeat(64);
const artifactDigest='b'.repeat(64);

test('F2 SDK sends builder submission intent without accepted_at or fabricated authority',async()=>{
  let seen;
  const server=createInkubatorServerClient({baseUrl:'https://api.example.test/',accessToken:'rekt_dk_test',fetchImpl:async(input,init)=>{
    seen={input:String(input),init};const body=JSON.parse(String(init?.body));
    return new Response(JSON.stringify({schema_version:'challenge.submission.accepted.v1',submission_id:body.submission_id,challenge_id:challengeId,entry_id:entryId,submission_version:String(body.submission_version),terms_digest:termsDigest,manifest_digest:'c'.repeat(64),accepted_at:'2026-09-14T04:00:00.000Z',ship_submission_id:null}),{status:201,headers:{'content-type':'application/json'}});
  }});
  const result=await server.challenge.submit(challengeId,{entryId,expectedTermsDigest:termsDigest,submissionVersion:2,immutableSourceReference:{kind:'GIT_COMMIT',value:'0123456789abcdef0123456789abcdef01234567'},artifactDigest,evidenceReferences:['evidence://one'],optionalLiveUrl:'https://example.invalid/build',idempotencyKey:'44444444-4444-4444-8444-444444444444',submissionId:'55555555-5555-4555-8555-555555555555'});
  assert.equal(seen.input,`https://api.example.test/v1/devkit/challenges/${challengeId}/submissions`);assert.equal(seen.init.method,'POST');const headers=new Headers(seen.init.headers);assert.equal(headers.get('authorization'),'Bearer rekt_dk_test');assert.equal(headers.get('content-type'),'application/json');
  const body=JSON.parse(String(seen.init.body));assert.deepEqual(body,{request_id:'44444444-4444-4444-8444-444444444444',submission_id:'55555555-5555-4555-8555-555555555555',entry_id:entryId,expected_terms_digest:termsDigest,submission_version:2,immutable_source_reference:{kind:'GIT_COMMIT',value:'0123456789abcdef0123456789abcdef01234567'},artifact_digest:artifactDigest,evidence_references:['evidence://one'],optional_live_url:'https://example.invalid/build'});assert.equal('accepted_at' in body,false);assert.equal('qualification' in body,false);assert.equal(result.accepted_at,'2026-09-14T04:00:00.000Z');
});
