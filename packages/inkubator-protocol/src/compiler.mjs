import {validateBuildContractReady} from './challenge-hardened.mjs';

export const COMPILER_PROPOSAL_SCHEMA_VERSION = 'inkubator.compiler-proposal/1.0';
export const COMPILER_STATE_SCHEMA_VERSION = 'inkubator.compiler-state/1.0';
export const COMPILER_BLUEPRINT_SCHEMA_VERSION = 'inkubator.compiler-blueprint/1.0';
export const COMPILER_VERSION = 'inkubator.compiler/1.0';
export const COMPILER_STATUSES = Object.freeze(['READY','NEEDS_DECISION','UNSUPPORTED']);
export const PROVENANCE_KINDS = Object.freeze(['SOURCE','MODEL_PROPOSAL','ORGANIZER_ACCEPTED','DETERMINISTIC_RULE']);
export const INPUT_PROVENANCE_KINDS = Object.freeze(['SOURCE','MODEL_PROPOSAL','ORGANIZER_ACCEPTED']);
export const RISK_LEVELS = Object.freeze(['LOW','MEDIUM','HIGH']);
export const QUALITY_LEVELS = Object.freeze(['STANDARD','ELEVATED','STRICT']);
export const BLUEPRINT_HEALTH = Object.freeze(['ACTIVE','EXPERIMENTAL','RETIRED']);

const RISK_RANK = {LOW:0,MEDIUM:1,HIGH:2};
const QUALITY_RANK = {STANDARD:0,ELEVATED:1,STRICT:2};
const P_KEYS = new Set(['schema_version','source_intent','requirements','knowledge','outcome_criteria','delivery_criteria','preferences']);
const R_KEYS = new Set(['key','value','provenance']);
const K_KEYS = new Set(['kind','key','material','value','provenance']);
const C_KEYS = new Set(['id','description','mandatory','provenance']);
const B_KEYS = new Set(['schema_version','id','version','applicability','default_assumptions','required_questions','sensitivity_points','reference_architecture','supported_production_envelope','risk_profile','acceptance_modules','known_limits','health']);
const A_KEYS = new Set(['required_true','any_true','excluded_true']);

const fail = (ok,msg) => { if (!ok) throw new Error(msg); };
const obj = (v,l) => { fail(v && typeof v === 'object' && !Array.isArray(v),`${l} must be an object`); return v; };
const str = (v,l) => fail(typeof v === 'string' && v.length > 0,`${l} must be a non-empty string`);
const allowed = (v,keys,l) => { for (const k of Object.keys(v)) fail(keys.has(k),`${l} contains undeclared property ${k}`); };
const scalar = (v,l) => fail(v === null || ['string','number','boolean'].includes(typeof v),`${l} must be a JSON scalar`);
const clone = (value) => structuredClone(value);
function freeze(v){ if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v; Object.freeze(v); for (const c of Object.values(v)) freeze(c); return v; }
function cmp(a,b){ const encoder=new TextEncoder(); const left=encoder.encode(a); const right=encoder.encode(b); const length=Math.min(left.length,right.length); for(let i=0;i<length;i+=1) if(left[i]!==right[i]) return left[i]-right[i]; return left.length-right.length; }
const sort = (xs,key=(x)=>x) => [...xs].sort((a,b)=>cmp(String(key(a)),String(key(b))));
const uniq = (xs) => sort([...new Set(xs)]);
const stable = (v) => v === null ? 'null' : `${typeof v}:${String(v)}`;
const maxRisk = (a,b) => RISK_RANK[b] > RISK_RANK[a] ? b : a;
const maxQuality = (a,b) => QUALITY_RANK[b] > QUALITY_RANK[a] ? b : a;

function assertProv(v,l,{inputOnly=true}={}){ fail((inputOnly?INPUT_PROVENANCE_KINDS:PROVENANCE_KINDS).includes(v),`${l} invalid ${inputOnly?'input ':''}provenance`); }
function assertRequirement(x,l){ obj(x,l); allowed(x,R_KEYS,l); str(x.key,`${l}.key`); scalar(x.value,`${l}.value`); assertProv(x.provenance,`${l}.provenance`); }
function assertKnowledge(x,l,{inputOnly=true}={}){ obj(x,l); allowed(x,K_KEYS,l); fail(['KNOWN','ASSUMED','UNKNOWN'].includes(x.kind),`${l}.kind invalid`); str(x.key,`${l}.key`); fail(typeof x.material === 'boolean',`${l}.material must be boolean`); assertProv(x.provenance,`${l}.provenance`,{inputOnly}); if ('value' in x) scalar(x.value,`${l}.value`); }
function assertCriterion(x,l){ obj(x,l); allowed(x,C_KEYS,l); str(x.id,`${l}.id`); str(x.description,`${l}.description`); fail(typeof x.mandatory === 'boolean',`${l}.mandatory must be boolean`); assertProv(x.provenance,`${l}.provenance`); }
function stringArray(v,l){ fail(Array.isArray(v),`${l} must be an array`); v.forEach((x,i)=>str(x,`${l}[${i}]`)); }

export function assertCompilerProposal(p){
  obj(p,'compiler proposal'); allowed(p,P_KEYS,'compiler proposal');
  fail(p.schema_version === COMPILER_PROPOSAL_SCHEMA_VERSION,`unsupported compiler proposal schema ${p.schema_version}`); str(p.source_intent,'compiler proposal.source_intent');
  fail(Array.isArray(p.requirements),'compiler proposal.requirements must be an array'); p.requirements.forEach((x,i)=>assertRequirement(x,`compiler proposal.requirements[${i}]`));
  fail(Array.isArray(p.knowledge),'compiler proposal.knowledge must be an array'); p.knowledge.forEach((x,i)=>assertKnowledge(x,`compiler proposal.knowledge[${i}]`));
  fail(Array.isArray(p.outcome_criteria),'compiler proposal.outcome_criteria must be an array'); p.outcome_criteria.forEach((x,i)=>assertCriterion(x,`compiler proposal.outcome_criteria[${i}]`));
  fail(Array.isArray(p.delivery_criteria),'compiler proposal.delivery_criteria must be an array'); p.delivery_criteria.forEach((x,i)=>assertCriterion(x,`compiler proposal.delivery_criteria[${i}]`));
  obj(p.preferences,'compiler proposal.preferences'); return p;
}

export function assertCompilerBlueprint(b){
  obj(b,'compiler blueprint'); allowed(b,B_KEYS,'compiler blueprint'); fail(b.schema_version === COMPILER_BLUEPRINT_SCHEMA_VERSION,`unsupported compiler blueprint schema ${b.schema_version}`); str(b.id,'compiler blueprint.id'); str(b.version,'compiler blueprint.version');
  obj(b.applicability,'compiler blueprint.applicability'); allowed(b.applicability,A_KEYS,'compiler blueprint.applicability'); for (const k of A_KEYS) stringArray(b.applicability[k],`compiler blueprint.applicability.${k}`);
  fail(Array.isArray(b.default_assumptions),'compiler blueprint.default_assumptions must be an array'); b.default_assumptions.forEach((x,i)=>assertKnowledge(x,`compiler blueprint.default_assumptions[${i}]`,{inputOnly:false}));
  stringArray(b.required_questions,'compiler blueprint.required_questions'); stringArray(b.sensitivity_points,'compiler blueprint.sensitivity_points'); obj(b.reference_architecture,'compiler blueprint.reference_architecture'); obj(b.supported_production_envelope,'compiler blueprint.supported_production_envelope');
  fail(RISK_LEVELS.includes(b.risk_profile),'compiler blueprint.risk_profile invalid'); stringArray(b.acceptance_modules,'compiler blueprint.acceptance_modules'); stringArray(b.known_limits,'compiler blueprint.known_limits'); fail(BLUEPRINT_HEALTH.includes(b.health),'compiler blueprint.health invalid'); return b;
}

export const CAUSAL_RULES = freeze([
  {id:'R_ACCOUNTS_V1',when:['accounts',true],facts:{persistence_required:true,identity_boundary_required:true},risk:'MEDIUM',sensitivity:['identity/authentication strategy'],acceptance:['identity-boundary']},
  {id:'R_PERSISTENCE_V1',when:['persistence',true],facts:{persistence_required:true},sensitivity:['durable data model and migration strategy'],acceptance:['persistence-roundtrip']},
  {id:'R_PRIVATE_UPLOADS_V1',when:['uploads_private',true],facts:{private_object_storage_required:true,privacy_controls_required:true},risk:'MEDIUM',questions:[['Q_DATA_RETENTION','What retention/deletion policy applies to private uploads?',true]],sensitivity:['file size/type limits and retention/deletion policy'],acceptance:['private-upload-boundary']},
  {id:'R_REALTIME_V1',when:['realtime',true],facts:{realtime_transport_required:true,synchronized_runtime_state_required:true},risk:'MEDIUM',questions:[['Q_REALTIME_TRANSPORT','Which realtime transport/state consistency guarantees are actually required?',true]],sensitivity:['realtime transport and state synchronization'],acceptance:['realtime-consistency']},
  {id:'R_NOTIFICATIONS_V1',when:['notifications',true],facts:{notification_delivery_required:true},questions:[['Q_NOTIFICATION_CHANNELS','Which delivery channels and retry guarantees are required?',false]],sensitivity:['notification delivery/retry semantics'],acceptance:['notification-delivery']},
  {id:'R_HIGH_TRAFFIC_V1',when:['traffic_100x',true],facts:{capacity_strategy_required:true},quality:'ELEVATED',questions:[['Q_TRAFFIC_PROFILE','What peak concurrency/throughput profile defines the 100x target?',true]],sensitivity:['capacity, concurrency and load profile'],acceptance:['capacity-smoke']},
  {id:'R_ONCHAIN_READ_V1',when:['onchain_read',true],facts:{onchain_read_boundary_required:true},risk:'MEDIUM',sensitivity:['chain/RPC source and stale-data behavior'],acceptance:['chain-read-boundary']},
  {id:'R_WALLET_TRANSACTION_V1',when:['wallet_transactions',true],facts:{wallet_signing_boundary_required:true,transaction_intent_boundary_required:true},risk:'HIGH',quality:'STRICT',questions:[['Q_TRANSACTION_BOUNDARY','Which chain/network and transaction intents are allowed?',true]],sensitivity:['wallet signing and transaction-intent boundary'],acceptance:['wallet-transaction-intent']},
  {id:'R_PRIVATE_KEY_CUSTODY_V1',when:['custody_private_keys',true],risk:'HIGH',unsupported:['PRIVATE_KEY_CUSTODY','Private-key custody/signing authority is unsupported for Stage D and pre-production Alpha.']},
  {id:'R_MUTABLE_PRIVATE_DEP_V1',when:['mutable_private_dependencies',true],facts:{dependency_pinning_required:true},risk:'HIGH',questions:[['Q_DEPENDENCY_PINNING','What immutable version/digest and fallback define the private dependency?',true]],sensitivity:['dependency pinning/fallback/removal path']},
  {id:'R_VAGUE_SCOPE_V1',when:['vague_consulting_scope',true],questions:[['Q_OUTCOME_SCOPE','What observable outcome can be tested instead of subjective consulting effort?',true]],finding:['UNTESTABLE_SCOPE','Vague consulting scope cannot become executable DONE WHEN without an observable outcome.'],sensitivity:['observable outcome definition']},
]);

function normalize(p){
  assertCompilerProposal(p);
  const req = sort(p.requirements.map(clone),x=>`${x.key}\0${stable(x.value)}\0${x.provenance}`); const know = sort(p.knowledge.map(clone),x=>`${x.key}\0${x.kind}\0${x.provenance}\0${stable(x.value??null)}`);
  const outcome = sort(p.outcome_criteria.map(clone),x=>x.id); const delivery = sort(p.delivery_criteria.map(clone),x=>x.id);
  for (const [xs,l] of [[outcome,'outcome'],[delivery,'delivery']]) fail(new Set(xs.map(x=>x.id)).size===xs.length,`compiler proposal.${l}_criteria ids must be unique`);
  return {source_intent:p.source_intent,requirements:req,knowledge:know,outcome_criteria:outcome,delivery_criteria:delivery,preferences:clone(p.preferences)};
}

function resolve(req){
  const buckets=new Map(); for(const r of req){ const b=buckets.get(r.key)||new Map(); b.set(stable(r.value),r.value); buckets.set(r.key,b); }
  const values=new Map(), conflicts=[]; for(const key of sort([...buckets.keys()])){ const b=buckets.get(key); if(b.size===1) values.set(key,[...b.values()][0]); else conflicts.push(key); } return {values,conflicts};
}

function applyRules(values){
  const facts=new Map(), questions=[], findings=[], unsupported=[], sensitivity=[], acceptance=[]; let risk='LOW',quality='STANDARD'; const riskReasons=[],qualityReasons=[];
  for(const rule of sort(CAUSAL_RULES,x=>x.id)){
    const [key,want]=rule.when; if(!values.has(key)||!Object.is(values.get(key),want)) continue;
    for(const [k,v] of Object.entries(rule.facts||{})){ const old=facts.get(k); if(old&&!Object.is(old.value,v)) findings.push({severity:'HIGH',code:'CAUSAL_CONTRADICTION',message:`Rules disagree on derived fact ${k}`,rule_id:rule.id}); else if(!old) facts.set(k,{key:k,value:v,provenance:'DETERMINISTIC_RULE',rule_id:rule.id}); }
    if(rule.risk){ risk=maxRisk(risk,rule.risk); riskReasons.push(`${rule.id}: ${rule.risk}`); }
    if(rule.quality){ quality=maxQuality(quality,rule.quality); qualityReasons.push(`${rule.id}: ${rule.quality}`); }
    for(const q of rule.questions||[]) questions.push({id:q[0],prompt:q[1],blocking:q[2],rule_id:rule.id});
    if(rule.finding) findings.push({severity:'HIGH',code:rule.finding[0],message:rule.finding[1],rule_id:rule.id});
    if(rule.unsupported) unsupported.push({code:rule.unsupported[0],message:rule.unsupported[1],rule_id:rule.id});
    sensitivity.push(...(rule.sensitivity||[])); acceptance.push(...(rule.acceptance||[]));
  }
  return {facts:sort([...facts.values()],x=>x.key),questions:sort(questions,x=>`${x.id}\0${x.rule_id}`),findings:sort(findings,x=>`${x.code}\0${x.rule_id}`),unsupported:sort(unsupported,x=>x.code),sensitivity:uniq(sensitivity),acceptance:uniq(acceptance),risk:{level:risk,reasons:uniq(riskReasons)},quality:{level:quality,reasons:uniq(qualityReasons)}};
}

function applicable(b,v){ const a=b.applicability; if(b.health!=='ACTIVE')return false; if(a.required_true.some(k=>v.get(k)!==true))return false; if(a.any_true.length&&!a.any_true.some(k=>v.get(k)===true))return false; if(a.excluded_true.some(k=>v.get(k)===true))return false; return true; }
function envelopeCriteria(facts){ return facts.filter(x=>x.value===true).map(x=>({id:`PE_${x.key.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`,description:`Production envelope requires ${x.key.replaceAll('_',' ')}.`,mandatory:true,provenance:'DETERMINISTIC_RULE'})); }

export function compileProposal(proposal,{blueprints=[]}={}){
  const n=normalize(proposal), {values,conflicts}=resolve(n.requirements), rr=applyRules(values);
  const registry=blueprints.map(b=>{assertCompilerBlueprint(b);return clone(b)}); fail(new Set(registry.map(b=>`${b.id}@${b.version}`)).size===registry.length,'compiler blueprint id/version must be unique');
  const candidates=sort(registry.filter(b=>applicable(b,values)),b=>`${b.id}\0${b.version}`), selected=candidates.length===1?candidates[0]:null;
  const explicit=new Set(n.knowledge.map(x=>x.key)); const defaults=(selected?.default_assumptions||[]).filter(x=>!explicit.has(x.key)).map(x=>({...clone(x),provenance:'DETERMINISTIC_RULE'})); const knowledge=sort([...n.knowledge,...defaults],x=>`${x.key}\0${x.kind}\0${x.provenance}`);
  let risk=rr.risk; if(selected&&RISK_RANK[selected.risk_profile]>RISK_RANK[risk.level]) risk={level:selected.risk_profile,reasons:uniq([...risk.reasons,`BLUEPRINT:${selected.id}@${selected.version}: baseline ${selected.risk_profile} risk`])};
  const unresolved=conflicts.map(k=>({id:`REQ_CONFLICT:${k}`,reason:`Conflicting values were proposed for requirement ${k}.`}));
  for(const x of knowledge.filter(x=>x.kind==='UNKNOWN'&&x.material)) unresolved.push({id:`UNKNOWN:${x.key}`,reason:`Material UNKNOWN ${x.key} blocks readiness.`});
  for(const q of rr.questions.filter(q=>q.blocking)) unresolved.push({id:`QUESTION:${q.id}`,reason:q.prompt});
  if(!candidates.length&&!rr.unsupported.length) unresolved.push({id:'BLUEPRINT:NO_MATCH',reason:'No active blueprint supports the resolved requirements.'}); if(candidates.length>1) unresolved.push({id:'BLUEPRINT:AMBIGUOUS',reason:'Multiple active blueprints support the resolved requirements; selection is material.'});
  const questions=[...rr.questions,...(selected?.required_questions||[]).map(id=>({id,prompt:id,blocking:false,rule_id:`BLUEPRINT:${selected.id}@${selected.version}`}))];
  const status=rr.unsupported.length?'UNSUPPORTED':unresolved.length?'NEEDS_DECISION':'READY';
  return freeze({schema_version:COMPILER_STATE_SCHEMA_VERSION,compiler_version:COMPILER_VERSION,source_intent:n.source_intent,project_fingerprint:{project_class:selected?.id??'UNRESOLVED',signals:uniq([...values].filter(([,v])=>v===true).map(([k])=>k))},knowledge,requirements:n.requirements,production_envelope:{criteria:envelopeCriteria(rr.facts),facts:rr.facts},risk_profile:risk,quality_profile:rr.quality,blueprint_candidates:candidates.map(b=>({id:b.id,version:b.version})),selected_blueprint:selected?{id:selected.id,version:selected.version}:null,causal_facts:rr.facts,sensitivity_points:uniq([...(selected?.sensitivity_points||[]),...rr.sensitivity]),outcome_contract_candidate:{criteria:n.outcome_criteria},delivery_contract_candidate:{criteria:n.delivery_criteria},preferences:n.preferences,reference_architecture_candidate:selected?clone(selected.reference_architecture):{},acceptance_plan:{modules:uniq([...(selected?.acceptance_modules||[]),...rr.acceptance])},questions:sort(questions,x=>`${x.id}\0${x.rule_id}`),findings:sort([...rr.findings,...rr.unsupported.map(x=>({severity:'HIGH',...x}))],x=>`${x.code}\0${x.rule_id}`),unresolved_decisions:sort(unresolved,x=>x.id),status});
}

export function assertCompilerState(s){ obj(s,'compiler state'); fail(s.schema_version===COMPILER_STATE_SCHEMA_VERSION,`unsupported compiler state schema ${s.schema_version}`); fail(s.compiler_version===COMPILER_VERSION,`unsupported compiler version ${s.compiler_version}`); fail(COMPILER_STATUSES.includes(s.status),'compiler state.status invalid'); return s; }
const stripCriterion=x=>({id:x.id,description:x.description,mandatory:x.mandatory});
const stripKnowledge=x=>{const y={kind:x.kind,key:x.key,material:x.material}; if('value'in x)y.value=clone(x.value); return y;};
export function buildBuildContractCandidate(state,authorityFields){ assertCompilerState(state); fail(state.status==='READY',`compiler state must be READY, got ${state.status}`); obj(authorityFields,'Build Contract authority fields'); const candidate={...clone(authorityFields),outcome_contract:{criteria:state.outcome_contract_candidate.criteria.map(stripCriterion)},production_envelope:{criteria:state.production_envelope.criteria.map(stripCriterion)},delivery_contract:{criteria:state.delivery_contract_candidate.criteria.map(stripCriterion)},preferences:clone(state.preferences),reference_architecture:clone(state.reference_architecture_candidate),knowledge:state.knowledge.map(stripKnowledge)}; delete candidate.terms_digest; validateBuildContractReady(candidate); return freeze(candidate); }
