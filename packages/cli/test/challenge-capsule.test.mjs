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

function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonicalize(value[key])]));
  return value;
}
const canonicalJson=(value)=>JSON.stringify(canonicalize(value));
function criteria(value){return Array.isArray(value?.criteria)?value.criteria:[];}
function renderCriteria(title,items){
  const lines=[`## ${title}`,''];
  if(items.length===0)return [...lines,'_No criteria declared._',''];
  return [...lines,...items.map((item)=>`- [${item.mandatory?'x':' '}] **${item.id}** — ${item.description}`),''];
}
function challengeMarkdown(contract){
  const lines=[
    `# ${contract.title}`,'',
    '> DERIVED BUILDER VIEW. Canonical authority is `contract.json` and its frozen `terms_digest`.','',
    `**Challenge:** \`${contract.challenge_id}\`  `,
    `**Contract:** \`${contract.contract_version}\`  `,
    `**Terms digest:** \`${contract.terms_digest}\`  `,
    `**Build starts:** ${new Date(contract.build_start).toISOString()}  `,
    `**Submission deadline:** ${new Date(contract.submission_deadline).toISOString()}`,'',
    '## Brief','',contract.brief,'',
    ...renderCriteria('Outcome Contract',criteria(contract.outcome_contract)),
    ...renderCriteria('Production Envelope',criteria(contract.production_envelope)),
    ...renderCriteria('Delivery Contract',criteria(contract.delivery_contract)),
    ...renderCriteria('Normative Constraints',contract.normative_constraints??[]),
    '## References','',
  ];
  if(contract.normative_references.length===0&&(contract.informational_references?.length??0)===0){
    lines.push('_No references declared._','');
  }else{
    for(const reference of contract.normative_references)lines.push(`- **NORMATIVE** \`${reference.id}\` — ${reference.kind} — digest \`${reference.content_digest}\`${reference.source_url?` — ${reference.source_url}`:''}`);
    for(const reference of contract.informational_references??[])lines.push(`- **INFORMATIONAL** \`${reference.id}\` — ${reference.url}`);
    lines.push('');
  }
  lines.push(
    '## Preferences','',
    'Preferences are non-qualifying selection guidance unless the frozen contract says otherwise.','',
    '```json',canonicalJson(contract.preferences),'```','',
    '## Reference Architecture','',
    'Reference architecture is advisory unless a frozen criterion or normative constraint makes a specific interface/technology mandatory.','',
    '```json',canonicalJson(contract.reference_architecture),'```','',
  );
  return lines.join('\n');
}
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
  const contract=frozenContract();
  const acceptance={
    schema_version:'builder-capsule.acceptance.v1',challenge_id:challengeId,terms_digest:contract.terms_digest,
    criteria:[
      ...criteria(contract.outcome_contract).map((item)=>({section:'OUTCOME',...item})),
      ...criteria(contract.production_envelope).map((item)=>({section:'PRODUCTION_ENVELOPE',...item})),
      ...criteria(contract.delivery_contract).map((item)=>({section:'DELIVERY',...item})),
      ...contract.normative_constraints.map((item)=>({section:'NORMATIVE_CONSTRAINT',...item})),
    ],
    executable_checks_authorized:false,
  };
  const references={schema_version:'builder-capsule.references.v1',challenge_id:challengeId,terms_digest:contract.terms_digest,normative:contract.normative_references,informational:contract.informational_references??[]};
  const contents={
    'CHALLENGE.md':challengeMarkdown(contract),
    'contract.json':`${canonicalJson(contract)}\n`,
    'acceptance/manifest.json':`${canonicalJson(acceptance)}\n`,
    'references/manifest.json':`${canonicalJson(references)}\n`,
  };
  return {
    schema_version:'builder-capsule.v1',challenge_id:challengeId,entry_id:entryId,entry_state:'ACTIVE',contract_version:contract.contract_version,
    terms_digest:contract.terms_digest,submission_deadline:new Date(contract.submission_deadline).toISOString(),
    files:Object.entries(contents).map(([filePath,content])=>({path:filePath,media_type:filePath.endsWith('.md')?'text/markdown':'application/json',sha256:digest(content),content})),
  };
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
    assert.match(logs.out.at(-1),/^challenge check: LOCAL CONSISTENCY PASS /);
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

test('F1 check rejects coordinated helper and metadata hash tampering',async()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'rekt-capsule-'));const previous=globalThis.fetch;const cap=capsule();const logs=io();
  globalThis.fetch=async()=>new Response(JSON.stringify(cap),{status:200,headers:{'content-type':'application/json'}});
  try{
    assert.equal(await main(['challenge','pull',challengeId],{REKT_DEVKIT_TOKEN:'rekt_dk_test'},logs.adapter,cwd),0);
    const root=path.join(cwd,'.rekt','challenge');const manifestPath=path.join(root,'acceptance','manifest.json');
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));manifest.executable_checks_authorized=true;
    const tampered=`${canonicalJson(manifest)}\n`;fs.writeFileSync(manifestPath,tampered,'utf8');
    const metadataPath=path.join(root,'capsule.json');const metadata=JSON.parse(fs.readFileSync(metadataPath,'utf8'));
    metadata.files.find((file)=>file.path==='acceptance/manifest.json').sha256=digest(tampered);fs.writeFileSync(metadataPath,JSON.stringify(metadata,null,2)+'\n','utf8');
    assert.equal(await main(['challenge','check'],{},logs.adapter,cwd),1);
    assert.equal(logs.err.at(-1),'capsule_derived_view_mismatch:acceptance/manifest.json');
  }finally{globalThis.fetch=previous;fs.rmSync(cwd,{recursive:true,force:true});}
});

test('F1 pull rejects path traversal without writing outside the capsule root',async()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'rekt-capsule-'));const previous=globalThis.fetch;const cap=capsule();const logs=io();
  cap.files[0]={...cap.files[0],path:'../owned'};
  globalThis.fetch=async()=>new Response(JSON.stringify(cap),{status:200,headers:{'content-type':'application/json'}});
  try{
    assert.equal(await main(['challenge','pull',challengeId],{REKT_DEVKIT_TOKEN:'rekt_dk_test'},logs.adapter,cwd),1);
    assert.equal(logs.err.at(-1),'capsule_path_invalid:../owned');
    assert.equal(fs.existsSync(path.join(cwd,'.rekt','owned')),false);assert.equal(fs.existsSync(path.join(cwd,'owned')),false);
  }finally{globalThis.fetch=previous;fs.rmSync(cwd,{recursive:true,force:true});}
});

test('F1 pull rejects a symlinked capsule root without writing through it',async()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'rekt-capsule-'));const outside=fs.mkdtempSync(path.join(os.tmpdir(),'rekt-capsule-outside-'));const previous=globalThis.fetch;const cap=capsule();const logs=io();
  globalThis.fetch=async()=>new Response(JSON.stringify(cap),{status:200,headers:{'content-type':'application/json'}});
  try{
    fs.mkdirSync(path.join(cwd,'.rekt'),{recursive:true});fs.symlinkSync(outside,path.join(cwd,'.rekt','challenge'),'dir');
    assert.equal(await main(['challenge','pull',challengeId],{REKT_DEVKIT_TOKEN:'rekt_dk_test'},logs.adapter,cwd),1);
    assert.match(logs.err.at(-1),/^capsule_path_symlink:/);
    assert.equal(fs.existsSync(path.join(outside,'contract.json')),false);assert.equal(fs.existsSync(path.join(outside,'capsule.json')),false);
  }finally{globalThis.fetch=previous;fs.rmSync(cwd,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});}
});
