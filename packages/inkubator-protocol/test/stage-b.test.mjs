import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILD_CONTRACT_SCHEMA_VERSION, MECHANISM_VERSION, SETTLEMENT_POLICY_VERSION, IP_TERMS_VERSION,
  CHALLENGE_STATES, freezeBuildContract, digestBuildContract, assertFrozenBuildContract,
  canTransitionChallenge, transitionChallenge, validateFundingFact, migrateDraftBuildContract,
  validateEntrySet, activateEntries, publicEntryProjection, assertSubmissionManifest,
  selectFinalSubmission, recordArchiveObservation, computeQualification, appendAppealEvent,
  validateSelection, computeDefaultDistribution, computeDefaultResolution, buildSettlementIntent,
  applyFinalizedSettlementFact, computeIpTransferFact, fileReceipt, appendReceiptCorrection,
} from '../src/challenge.mjs';
import {digestRecord} from '../src/index.mjs';

const H = (c) => digestRecord(c);
const t0 = 1_800_000_000_000;
function contract(overrides={}) {
  return {
    schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
    challenge_id: 'CH-1', contract_version: '1', mechanism_version: MECHANISM_VERSION,
    settlement_policy_version: SETTLEMENT_POLICY_VERSION, ip_terms_version: IP_TERMS_VERSION,
    title: 'Build the thing', brief: 'A bounded build.',
    outcome_contract: {criteria:[{id:'OUT-1',description:'Works',mandatory:true}]},
    production_envelope: {criteria:[{id:'ENV-1',description:'Mobile viewport',mandatory:true}]},
    delivery_contract: {criteria:[{id:'DEL-1',description:'Source delivered',mandatory:true}]},
    preferences: {style:'REKT'}, reference_architecture: {stack:['React','Vite']},
    normative_constraints: [{id:'NORM-1',description:'Expose HTTPS',mandatory:true}],
    normative_references: [{id:'REF-1',kind:'FIXTURE',content_digest:'a'.repeat(64),source_url:'https://example.com/frozen'}],
    informational_references: [{id:'INFO-1',url:'https://example.com/live'}],
    knowledge: [{kind:'KNOWN',key:'network',material:true,value:'Ink'}],
    slot_limit:4, activation_minimum:2,
    entry_deadline:t0+100, build_start:t0+100, submission_deadline:t0+1000, appeal_deadline:t0+1200, review_deadline:t0+1400,
    prize_minor_units:1001, prize_display:'1001 units', settlement_asset:'TEST', ...overrides,
  };
}
function frozen(overrides={}) { return freezeBuildContract(contract(overrides)); }
function challenge(status='DRAFT', c=frozen()) { return {challenge_id:c.challenge_id,status,contract:c}; }
function entry(id,builder=id,payout=`pay-${id}`,state='SEATED'){return {entry_id:id,builder_id:builder,payout_id:payout,state}}
function manifest(c,e='E1',v=1,accepted=c.submission_deadline-10, overrides={}){
 return {schema_version:'inkubator.submission-manifest/1.0',challenge_id:c.challenge_id,entry_id:e,terms_digest:c.terms_digest,submission_version:v,immutable_source_reference:{kind:'GIT_COMMIT',value:`sha-${v}`},artifact_digest:H({e,v}),evidence_references:[],accepted_at:accepted,...overrides};
}
function finalizedFact(intent, overrides={}) {return {challenge_id:intent.challenge_id,terms_digest:intent.terms_digest,settlement_policy_version:intent.settlement_policy_version,asset:intent.asset,total_minor_units:intent.total_minor_units,recipients:intent.recipients,finality:'FINALIZED',execution_id:'tx-1',...overrides}}

test('canonical-equivalent Build Contracts digest identically',()=>{const a=contract();const b={...a,preferences:{style:'REKT'}};assert.equal(digestBuildContract(a),digestBuildContract(b))});
test('semantic frozen-field change changes digest',()=>{assert.notEqual(digestBuildContract(contract()),digestBuildContract(contract({slot_limit:5})))});
test('normative reference digest changes terms digest',()=>{const a=contract();const b=contract({normative_references:[{...a.normative_references[0],content_digest:'b'.repeat(64)}]});assert.notEqual(digestBuildContract(a),digestBuildContract(b))});
test('material unknown blocks freeze',()=>assert.throws(()=>freezeBuildContract(contract({knowledge:[{kind:'UNKNOWN',key:'traffic',material:true}]})),/material UNKNOWN/));
test('unsupported version fails closed',()=>assert.throws(()=>freezeBuildContract(contract({mechanism_version:'future/99'})),/unsupported mechanism/));
test('frozen contract detects mutation',()=>{const c={...frozen(),title:'changed'};assert.throws(()=>assertFrozenBuildContract(c),/terms_digest/)});
test('draft migration only works before liabilities',()=>{const c=contract();const d={challenge_id:c.challenge_id,status:'DRAFT',contract:c};assert.equal(migrateDraftBuildContract(d,{title:'New'}).contract.title,'New');assert.throws(()=>migrateDraftBuildContract({...d,status:'ENTRY_OPEN'},{title:'No'}),/only DRAFT/)});

test('only declared lifecycle edges are legal',()=>{for(const a of CHALLENGE_STATES)for(const b of CHALLENGE_STATES){if(a===b)assert.equal(canTransitionChallenge(a,b),false)}});
test('funding fact must match amount, asset and contract digest',()=>{const c=contract();const fact={status:'CONFIRMED',challenge_id:c.challenge_id,asset:c.settlement_asset,amount_minor_units:c.prize_minor_units,contract_digest:digestBuildContract(c)};assert.equal(validateFundingFact(c,fact),fact);assert.throws(()=>validateFundingFact(c,{...fact,amount_minor_units:1}),/amount mismatch/)});
test('ENTRY_OPEN requires frozen valid contract and pre-deadline now',()=>{const c=frozen();const out=transitionChallenge(challenge('FUNDED',c),'ENTRY_OPEN',{now:c.entry_deadline-1});assert.equal(out.status,'ENTRY_OPEN');assert.throws(()=>transitionChallenge(challenge('FUNDED',c),'ENTRY_OPEN',{now:c.entry_deadline}),/at\/after/)});
test('activation minimum controls ENTRY_OPEN due transition',()=>{const c=frozen();assert.throws(()=>transitionChallenge(challenge('ENTRY_OPEN',c),'BUILDING',{now:c.entry_deadline,activeSeatCount:1}),/minimum not met/);assert.equal(transitionChallenge(challenge('ENTRY_OPEN',c),'BUILDING',{now:c.entry_deadline,activeSeatCount:2}).status,'BUILDING')});
test('submission lock cannot occur early',()=>{const c=frozen();assert.throws(()=>transitionChallenge(challenge('BUILDING',c),'SUBMISSIONS_LOCKED',{now:c.submission_deadline-1}),/not reached/)});
test('zero qualifiers cannot enter selection',()=>{const c=frozen();assert.throws(()=>transitionChallenge(challenge('FINAL_QUALIFIERS',c),'SELECTION',{finalQualifierIds:[]}),/at least one/)});
test('review deadline selects default path only after deadline',()=>{const c=frozen();assert.throws(()=>transitionChallenge(challenge('SELECTION',c),'DEFAULT_RESOLUTION',{now:c.review_deadline-1}),/not reached/);assert.equal(transitionChallenge(challenge('SELECTION',c),'DEFAULT_RESOLUTION',{now:c.review_deadline,hasValidSelection:false}).status,'DEFAULT_RESOLUTION')});

test('duplicate builder and payout identities fail closed',()=>{assert.throws(()=>validateEntrySet([entry('E1','B1','P1'),entry('E2','B1','P2')]),/builder ids/);assert.throws(()=>validateEntrySet([entry('E1','B1','P1'),entry('E2','B2','P1')]),/payout ids/)});
test('organizer cannot occupy builder seat',()=>assert.throws(()=>validateEntrySet([entry('E1','ORG','P1')],{organizerBuilderId:'ORG'}),/organizer/));
test('activation is order independent and shares times',()=>{const c=frozen();const a=activateEntries([entry('E2'),entry('E1')],c);const b=activateEntries([entry('E1'),entry('E2')],c);assert.deepEqual(a,b);assert.ok(a.every(x=>x.build_start===c.build_start&&x.submission_deadline===c.submission_deadline))});
test('pre-reveal projection seals builder and payout identity',()=>{const p=publicEntryProjection(entry('E1','SECRET','PAY'));assert.deepEqual(p,{entry_id:'E1',state:'SEATED'})});

test('accepted-before-deadline manifest remains final independent of archive state',()=>{const c=frozen();const m=manifest(c);assert.equal(selectFinalSubmission([m],c,'E1').submission_version,1);const obs=recordArchiveObservation(m,'PLATFORM_UNAVAILABLE','github down');assert.equal(obs.accepted_at,m.accepted_at)});
test('accepted-after-deadline never becomes final',()=>{const c=frozen();assert.equal(selectFinalSubmission([manifest(c,'E1',1,c.submission_deadline+1)],c,'E1'),null)});
test('latest valid manifest wins and invalid later cannot displace it',()=>{const c=frozen();const one=manifest(c,'E1',1,c.submission_deadline-20);const two=manifest(c,'E1',2,c.submission_deadline-10);const bad={...manifest(c,'E1',3,c.submission_deadline-1),artifact_digest:'bad'};assert.equal(selectFinalSubmission([one,bad,two],c,'E1').submission_version,2)});
test('wrong terms digest invalidates submission',()=>{const c=frozen();assert.equal(selectFinalSubmission([{...manifest(c),terms_digest:'b'.repeat(64)}],c,'E1'),null)});
test('mutable URL alone cannot satisfy immutable identity',()=>{const c=frozen();const m=manifest(c);delete m.immutable_source_reference;assert.throws(()=>assertSubmissionManifest(m),/immutable_source_reference/)});

test('qualification requires every frozen mandatory criterion exactly once',()=>{const c=frozen();const pass=['OUT-1','ENV-1','DEL-1','NORM-1'].map(criterion_id=>({criterion_id,result:'PASS'}));assert.equal(computeQualification(c,pass).overall,'QUALIFIED');assert.equal(computeQualification(c,pass.map((x,i)=>i===1?{...x,result:'FAIL'}:x)).overall,'NOT_QUALIFIED');assert.equal(computeQualification(c,pass.map((x,i)=>i===1?{...x,result:'DISPUTED'}:x)).overall,'DISPUTED');assert.throws(()=>computeQualification(c,[...pass,{criterion_id:'NEW',result:'PASS'}]),/exactly match/)});
test('preferences never participate in qualification',()=>{const c1=frozen({preferences:{style:'A'}});const c2=frozen({preferences:{style:'B'}});const r=['OUT-1','ENV-1','DEL-1','NORM-1'].map(criterion_id=>({criterion_id,result:'PASS'}));assert.equal(computeQualification(c1,r).overall,computeQualification(c2,r).overall)});
test('appeal budget is exactly one appeal and one resolution',()=>{const a=appendAppealEvent([],{type:'APPEAL',reason:'evidence'});assert.throws(()=>appendAppealEvent(a,{type:'APPEAL',reason:'again'}),/exhausted/);const r=appendAppealEvent(a,{type:'RESOLUTION',result:'PASS'});assert.equal(r.length,2);assert.throws(()=>appendAppealEvent(r,{type:'RESOLUTION'}),/requires exactly/)});
test('selection must be a final qualifier',()=>assert.throws(()=>validateSelection('E3',['E1','E2']),/not a final qualifier/));

test('default resolution has 0/1/many deterministic semantics',()=>{assert.equal(computeDefaultResolution([],10).type,'REFUND_NO_QUALIFIER');assert.deepEqual(computeDefaultResolution(['E1'],10),{type:'WINNER_PAYOUT',winner_entry_id:'E1',distributions:[{entry_id:'E1',amount_minor_units:10}]});assert.equal(computeDefaultResolution(['E1','E2'],10).type,'DEFAULT_DISTRIBUTION')});
test('default distribution conserves integer minor units and is order independent',()=>{for(let n=2;n<=8;n++)for(let prize=0;prize<40;prize++){const ids=Array.from({length:n},(_,i)=>`E${i}`);const a=computeDefaultDistribution(prize,ids);const b=computeDefaultDistribution(prize,[...ids].reverse());assert.deepEqual(a,b);assert.equal(a.reduce((s,x)=>s+x.amount_minor_units,0),prize);assert.ok(Math.max(...a.map(x=>x.amount_minor_units))-Math.min(...a.map(x=>x.amount_minor_units))<=1)}});

test('settlement intent is not execution and mismatches fail closed',()=>{const c=frozen();const resolution=computeDefaultResolution(['E1'],c.prize_minor_units);const intent=buildSettlementIntent({contract:c,resolution,recipientByEntryId:{E1:'0xabc'}});assert.equal(computeIpTransferFact(intent,finalizedFact(intent)),'TRANSFER_TRIGGERED');assert.throws(()=>applyFinalizedSettlementFact(intent,finalizedFact(intent,{asset:'WRONG'})),/does not match/);assert.throws(()=>applyFinalizedSettlementFact(intent,{...finalizedFact(intent),finality:'PENDING'}),/not finalized/)});
test('multi-qualifier default distribution never triggers IP transfer',()=>{const c=frozen();const resolution=computeDefaultResolution(['E2','E1'],c.prize_minor_units);const intent=buildSettlementIntent({contract:c,resolution,recipientByEntryId:{E1:'A',E2:'B'}});assert.equal(computeIpTransferFact(intent,finalizedFact(intent)),'NOT_TRIGGERED')});
test('pre-build refund never triggers IP transfer',()=>{const c=frozen();const intent=buildSettlementIntent({contract:c,resolution:{type:'REFUND_PRE_BUILD',winner_entry_id:null,distributions:[]},refundRecipientId:'ORG'});assert.equal(computeIpTransferFact(intent,finalizedFact(intent)),'NOT_TRIGGERED')});
test('finalized settlement replay is idempotent and conflicts reject',()=>{const c=frozen();const intent=buildSettlementIntent({contract:c,resolution:computeDefaultResolution(['E1'],c.prize_minor_units),recipientByEntryId:{E1:'A'}});const fact=finalizedFact(intent);const first=applyFinalizedSettlementFact(intent,fact);assert.equal(applyFinalizedSettlementFact(intent,fact,first),first);assert.throws(()=>applyFinalizedSettlementFact(intent,{...fact,execution_id:'tx-2'},first),/conflicting/)});

test('receipt filing is deterministic and references frozen versions',()=>{const c=frozen();const intent=buildSettlementIntent({contract:c,resolution:computeDefaultResolution(['E1'],c.prize_minor_units),recipientByEntryId:{E1:'A'}});const fact=finalizedFact(intent);const a=fileReceipt({contract:c,settlementIntent:intent,settlementExecutionFact:fact});const b=fileReceipt({contract:c,settlementIntent:intent,settlementExecutionFact:fact});assert.deepEqual(a,b);assert.equal(a.terms_digest,c.terms_digest);assert.equal(a.ip_transfer_fact,'TRANSFER_TRIGGERED')});
test('receipt correction appends without rewriting money or frozen terms',()=>{const c=frozen();const intent=buildSettlementIntent({contract:c,resolution:computeDefaultResolution(['E1'],c.prize_minor_units),recipientByEntryId:{E1:'A'}});const r=fileReceipt({contract:c,settlementIntent:intent,settlementExecutionFact:finalizedFact(intent)});const correction=appendReceiptCorrection([r],{supersedes:r.receipt_id,reason:'display typo',authority:'resolver',corrected_projection:{title:'fixed'}});assert.equal(correction.supersedes,r.receipt_id);assert.throws(()=>appendReceiptCorrection([r],{supersedes:r.receipt_id,reason:'no',authority:'resolver',corrected_projection:{terms_digest:'b'.repeat(64)}}),/cannot rewrite/)});

test('protocol never requires Date.now for time-sensitive transitions',()=>{const original=Date.now;Date.now=()=>{throw new Error('hidden clock used')};try{const c=frozen();assert.equal(transitionChallenge(challenge('BUILDING',c),'SUBMISSIONS_LOCKED',{now:c.submission_deadline}).status,'SUBMISSIONS_LOCKED')}finally{Date.now=original}});
