import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  IP_TERMS_VERSION,
  freezeBuildContract,
} from '@rekt-ink/protocol/challenge';
import {main} from '../dist/cli.js';

const challengeId='11111111-1111-4111-8111-111111111111';
const entryId='33333333-3333-4333-8333-333333333333';
const t0=1_800_000_000_000;
const digest=(value)=>createHash('sha256').update(value,'utf8').digest('hex');

function frozenContract(){return freezeBuildContract({
  schema_version:BUILD_CONTRACT_SCHEMA_VERSION,challenge_id:challengeId,contract_version:'1.0.0',mechanism_version:MECHANISM_VERSION,
  settlement_policy_version:SETTLEMENT_POLICY_VERSION,ip_terms_version:IP_TERMS_VERSION,title:'Build a dashboard',brief:'Bounded dashboard.',
  outcome_contract:{criteria:[{id:'OUT-1',description:'Works',mandatory:true}]},production_envelope:{criteria:[{id:'ENV-1',description:'Mobile',mandatory:true}]},
  delivery_contract:{criteria:[{id:'DEL-1',description:'Source',mandatory:true}]},preferences:{},reference_architecture:{stack:['React']},
  normative_constraints:[{id:'NORM-1',description:'HTTPS',mandatory:true}],normative_references:[],informational_references:[],
  knowledge:[{kind:'KNOWN',key:'network',material:true,value:'Ink'}],slot_limit:4,activation_minimum:2,entry_deadline:t0+100,build_start:t0+100,
  submission_deadline:t0+1000,appeal_window_ms:200,review_deadline:t0+1800,prize_minor_units:100,settlement_asset:'TEST',
});}
function capsule(){
  const contract=frozenContract();const contents={
    'CHALLENGE.md':'# Challenge\n',
    'contract.json':JSON.stringify(contract,null,2)+'\n',
    'acceptance/manifest.json':JSON.stringify({schema_version:'builder-capsule.acceptance.v1',challenge_id:challengeId,terms_digest:contract.terms_digest,criteria:[],executable_checks_authorized:false})+'\n',
    'references/manifest.json':JSON.stringify({schema_version:'builder-capsule.references.v1',challenge_id:challengeId,terms_digest:contract.terms_digest,normative:[],informational:[]})+'\n',
  };
  return {schema_version:'builder-capsule.v1',challenge_id:challengeId,entry_id:entryId,entry_state:'ACTIVE',contract_version:contract.contract_version,terms_digest:contract.terms_digest,submission_deadline:new Date(contract.submission_deadline).toISOString(),files:Object.entries(contents).map(([filePath,content])=>({path:filePath,media_type:filePath.endsWith('.md')?'text/markdown':'application/json',sha256:digest(content),content}))};
}
function io(){const out=[];const err=[];return {out,err,adapter:{out:(value)=>out.push(value),err:(value)=>err.push(value)}};}

test('F1 pull writes a portable capsule and status/check are local-only',async()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'rekt-capsule-'));const previous=globalThis.fetch;const seen=[];const cap=capsule();const logs=io();
  globalThis.fetch=async(input,init={})=>{seen.push({input:String(input),init});return new Response(JSON.stringify(cap),{status:200,headers:{'content-type':'application/json'}});};
  try{
    assert.equal(await main(['challenge','pull',challengeId,'--api','https://api.test'],{REKT_DEVKIT_TOKEN:'rekt_dk_test'},logs.adapter,cwd),0);
    assert.equal(seen.length,1);assert.equal(seen[0].input,`https://api.test/v1/devkit/challenges/${challengeId}/capsule`);assert.equal(new Headers(seen[0].init.headers).get('authorization'),'Bearer rekt_dk_test');assert.equal(seen[0].init.method,'GET');
    for(const file of cap.files)assert.equal(fs.readFileSync(path.join(cwd,'.rekt','challenge',...file.path.split('/')),'utf8'),file.content);
    assert.equal('content' in JSON.parse(fs.readFileSync(path.join(cwd,'.rekt','challenge','capsule.json'),'utf8')).files[0],false);

    globalThis.fetch=async()=>{throw new Error('network_must_not_be_used');};
    assert.equal(await main(['challenge','status'],{},logs.adapter,cwd),0);
    assert.equal(await main(['challenge','check'],{},logs.adapter,cwd),0);
    assert.match(logs.out.at(-1),/^challenge check: PASS /);
  }finally{globalThis.fetch=previous;fs.rmSync(cwd,{recursive:true,force:true});}
});

test('F1 check detects local tampering',async()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'rekt-capsule-'));const previous=globalThis.fetch;const cap=capsule();const logs=io();
  globalThis.fetch=async()=>new Response(JSON.stringify(cap),{status:200,headers:{'content-type':'application/json'}});
  try{
    assert.equal(await main(['challenge','pull',challengeId],{REKT_DEVKIT_TOKEN:'rekt_dk_test'},logs.adapter,cwd),0);
    fs.appendFileSync(path.join(cwd,'.rekt','challenge','CHALLENGE.md'),'tampered\n');
    assert.equal(await main(['challenge','check'],{},logs.adapter,cwd),1);
    assert.equal(logs.err.at(-1),'capsule_file_digest_mismatch:CHALLENGE.md');
  }finally{globalThis.fetch=previous;fs.rmSync(cwd,{recursive:true,force:true});}
});

test('F1 pull rejects path traversal without writing outside the capsule root',async()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'rekt-capsule-'));const previous=globalThis.fetch;const cap=capsule();const logs=io();
  cap.files[0]={...cap.files[0],path:'../owned'};
  globalThis.fetch=async()=>new Response(JSON.stringify(cap),{status:200,headers:{'content-type':'application/json'}});
  try{
    assert.equal(await main(['challenge','pull',challengeId],{REKT_DEVKIT_TOKEN:'rekt_dk_test'},logs.adapter,cwd),1);
    assert.equal(logs.err.at(-1),'capsule_file_set_invalid');
    assert.equal(fs.existsSync(path.join(cwd,'.rekt','owned')),false);
    assert.equal(fs.existsSync(path.join(cwd,'owned')),false);
  }finally{globalThis.fetch=previous;fs.rmSync(cwd,{recursive:true,force:true});}
});

test('F1 pull validates the full capsule before writing any file',async()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'rekt-capsule-'));const previous=globalThis.fetch;const cap=capsule();const logs=io();
  cap.files[1]={...cap.files[1],sha256:'0'.repeat(64)};
  globalThis.fetch=async()=>new Response(JSON.stringify(cap),{status:200,headers:{'content-type':'application/json'}});
  try{
    assert.equal(await main(['challenge','pull',challengeId],{REKT_DEVKIT_TOKEN:'rekt_dk_test'},logs.adapter,cwd),1);
    assert.equal(logs.err.at(-1),'capsule_server_digest_mismatch:contract.json');
    assert.equal(fs.existsSync(path.join(cwd,'.rekt','challenge','CHALLENGE.md')),false);
    assert.equal(fs.existsSync(path.join(cwd,'.rekt','challenge','capsule.json')),false);
  }finally{globalThis.fetch=previous;fs.rmSync(cwd,{recursive:true,force:true});}
});
