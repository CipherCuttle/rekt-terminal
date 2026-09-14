#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  assertFrozenBuildContract,
  type BuildContract,
  type Criterion,
} from '@rekt-ink/protocol/challenge';
import {createInkubatorServerClient, type BuilderCapsuleView} from '@rekt-ink/sdk/server';

type Io = {out:(value:string)=>void;err:(value:string)=>void};
type Config = {schema_version:'rekt.local.v1';api_url:string;project_id:string;mission_id:string};
type LocalCapsule = Omit<BuilderCapsuleView,'files'> & {files:Array<Omit<BuilderCapsuleView['files'][number],'content'>>};
type FrozenContract = BuildContract & {terms_digest:string};

const EXPECTED_CAPSULE_PATHS=['CHALLENGE.md','contract.json','acceptance/manifest.json','references/manifest.json'] as const;
const EXPECTED_MEDIA_TYPES:Record<(typeof EXPECTED_CAPSULE_PATHS)[number],BuilderCapsuleView['files'][number]['media_type']>={
  'CHALLENGE.md':'text/markdown',
  'contract.json':'application/json',
  'acceptance/manifest.json':'application/json',
  'references/manifest.json':'application/json',
};
const ENTRY_STATES=new Set(['SEATED','WITHDRAWN_PRE_BUILD','ACTIVE','SUBMITTED','INVALID_SUBMISSION','ABANDONED']);
const SOURCE_KINDS=new Set(['GIT_COMMIT','CONTENT_ADDRESS','ARCHIVE_DIGEST']);
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN=/^[0-9a-f]{64}$/;
const GIT_COMMIT_PATTERN=/^[0-9a-f]{40}$/i;
const defaultIo: Io = {out:(value)=>process.stdout.write(`${value}\n`),err:(value)=>process.stderr.write(`${value}\n`)};

function parse(args:string[]){
  const values=new Map<string,string>();const positional:string[]=[];
  for(let i=0;i<args.length;i+=1){
    const item=args[i];
    if(item.startsWith('--')){
      const value=args[i+1];if(!value||value.startsWith('--'))throw new Error(`missing_value_${item.slice(2)}`);
      values.set(item.slice(2),value);i+=1;
    }else positional.push(item);
  }
  return {values,positional};
}
function configPath(cwd:string){return path.join(cwd,'.rekt','config.json');}
function readConfig(cwd:string):Config{const value=JSON.parse(fs.readFileSync(configPath(cwd),'utf8'));if(value?.schema_version!=='rekt.local.v1')throw new Error('rekt_config_invalid');return value;}
function writeConfig(cwd:string,config:Config){fs.mkdirSync(path.dirname(configPath(cwd)),{recursive:true});fs.writeFileSync(configPath(cwd),JSON.stringify(config,null,2)+'\n',{mode:0o600});}
function clientFor(env:NodeJS.ProcessEnv,apiUrl:string){const accessToken=env.REKT_DEVKIT_TOKEN;if(!accessToken)throw new Error('REKT_DEVKIT_TOKEN is required');return createInkubatorServerClient({baseUrl:apiUrl,accessToken});}
function skills(value:string|undefined){return value?value.split(',').map((part)=>part.trim()).filter(Boolean):undefined;}
function sha256(value:string){return createHash('sha256').update(value,'utf8').digest('hex');}
function defaultCapsuleDir(cwd:string){return path.join(cwd,'.rekt','challenge');}
function capsuleMetadataPath(root:string){return path.join(root,'capsule.json');}
function canonicalize(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object'){
    const record=value as Record<string,unknown>;const result:Record<string,unknown>={};
    for(const key of Object.keys(record).sort())result[key]=canonicalize(record[key]);
    return result;
  }
  return value;
}
function canonicalJson(value:unknown){return JSON.stringify(canonicalize(value));}
function jsonEquivalent(left:unknown,right:unknown){return canonicalJson(left)===canonicalJson(right);}
function parseJson(content:string,label:string){try{return JSON.parse(content) as unknown;}catch{throw new Error(`capsule_${label}_json_invalid`);}}
function safeCapsuleTarget(root:string,relativePath:string){
  if(!relativePath||relativePath.includes('\\')||path.posix.isAbsolute(relativePath)||relativePath==='capsule.json')throw new Error(`capsule_path_invalid:${relativePath}`);
  const normalized=path.posix.normalize(relativePath);
  if(normalized!==relativePath||normalized==='.'||normalized==='..'||normalized.startsWith('../')||normalized.includes('/../'))throw new Error(`capsule_path_invalid:${relativePath}`);
  const resolvedRoot=path.resolve(root);const target=path.resolve(resolvedRoot,...normalized.split('/'));
  if(!target.startsWith(`${resolvedRoot}${path.sep}`))throw new Error(`capsule_path_invalid:${relativePath}`);
  return target;
}
function assertNoSymlinkPath(target:string){
  const absolute=path.resolve(target);const root=path.parse(absolute).root;
  let current=root;
  for(const segment of absolute.slice(root.length).split(path.sep).filter(Boolean)){
    current=path.join(current,segment);
    if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw new Error(`capsule_path_symlink:${current}`);
  }
}
function assertCapsuleShape(files:Array<{path:string;media_type:string;sha256:string}>){
  const paths=files.map((file)=>file.path);
  if(new Set(paths).size!==paths.length)throw new Error('capsule_file_duplicate');
  const actual=[...paths].sort();const expected=[...EXPECTED_CAPSULE_PATHS].sort();
  if(actual.length!==expected.length||actual.some((value,index)=>value!==expected[index]))throw new Error('capsule_file_set_invalid');
  for(const file of files){
    const expectedType=EXPECTED_MEDIA_TYPES[file.path as (typeof EXPECTED_CAPSULE_PATHS)[number]];
    if(file.media_type!==expectedType)throw new Error(`capsule_media_type_invalid:${file.path}`);
    if(!DIGEST_PATTERN.test(file.sha256))throw new Error(`capsule_file_digest_invalid:${file.path}`);
  }
}
function criteria(value:unknown):Criterion[]{
  if(!value||typeof value!=='object'||Array.isArray(value))return [];
  const candidate=(value as {criteria?:unknown}).criteria;
  return Array.isArray(candidate)?candidate.filter((item):item is Criterion=>Boolean(
    item&&typeof item==='object'&&typeof (item as Criterion).id==='string'&&typeof (item as Criterion).description==='string'&&typeof (item as Criterion).mandatory==='boolean',
  )):[];
}
function renderCriteria(title:string,items:Criterion[]):string[]{
  const lines=[`## ${title}`,''];
  if(items.length===0)return [...lines,'_No criteria declared._',''];
  return [...lines,...items.map((item)=>`- [${item.mandatory?'x':' '}] **${item.id}** — ${item.description}`),''];
}
function buildChallengeMarkdown(contract:FrozenContract):string{
  const lines=[
    `# ${contract.title}`,
    '',
    '> DERIVED BUILDER VIEW. Canonical authority is `contract.json` and its frozen `terms_digest`.',
    '',
    `**Challenge:** \`${contract.challenge_id}\`  `,
    `**Contract:** \`${contract.contract_version}\`  `,
    `**Terms digest:** \`${contract.terms_digest}\`  `,
    `**Build starts:** ${new Date(contract.build_start).toISOString()}  `,
    `**Submission deadline:** ${new Date(contract.submission_deadline).toISOString()}`,
    '',
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
    for(const reference of contract.normative_references){
      lines.push(`- **NORMATIVE** \`${reference.id}\` — ${reference.kind} — digest \`${reference.content_digest}\`${reference.source_url?` — ${reference.source_url}`:''}`);
    }
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
function expectedAcceptanceManifest(contract:FrozenContract){
  return {
    schema_version:'builder-capsule.acceptance.v1',
    challenge_id:contract.challenge_id,
    terms_digest:contract.terms_digest,
    criteria:[
      ...criteria(contract.outcome_contract).map((item)=>({section:'OUTCOME',...item})),
      ...criteria(contract.production_envelope).map((item)=>({section:'PRODUCTION_ENVELOPE',...item})),
      ...criteria(contract.delivery_contract).map((item)=>({section:'DELIVERY',...item})),
      ...contract.normative_constraints.map((item)=>({section:'NORMATIVE_CONSTRAINT',...item})),
    ],
    executable_checks_authorized:false,
  };
}
function expectedReferencesManifest(contract:FrozenContract){
  return {
    schema_version:'builder-capsule.references.v1',
    challenge_id:contract.challenge_id,
    terms_digest:contract.terms_digest,
    normative:contract.normative_references,
    informational:contract.informational_references??[],
  };
}
function validateFrozenContract(content:string,capsule:{challenge_id:string;contract_version:string;terms_digest:string;submission_deadline:string}):FrozenContract{
  const contract=assertFrozenBuildContract(parseJson(content,'contract')) as FrozenContract;
  if(
    contract.challenge_id!==capsule.challenge_id||
    contract.contract_version!==capsule.contract_version||
    contract.terms_digest!==capsule.terms_digest||
    new Date(contract.submission_deadline).toISOString()!==capsule.submission_deadline
  )throw new Error('capsule_contract_lineage_mismatch');
  return contract;
}
function validateCapsuleMetadata(capsule:{entry_id:string;entry_state:string}){
  if(!UUID_PATTERN.test(capsule.entry_id))throw new Error('capsule_entry_id_invalid');
  if(!ENTRY_STATES.has(capsule.entry_state))throw new Error('capsule_entry_state_invalid');
}
function assertDerivedViews(contents:Map<string,string>,contract:FrozenContract){
  const challenge=contents.get('CHALLENGE.md');if(challenge===undefined)throw new Error('capsule_challenge_view_missing');
  if(challenge!==buildChallengeMarkdown(contract))throw new Error('capsule_derived_view_mismatch:CHALLENGE.md');
  const acceptance=contents.get('acceptance/manifest.json');if(acceptance===undefined)throw new Error('capsule_acceptance_manifest_missing');
  if(!jsonEquivalent(parseJson(acceptance,'acceptance_manifest'),expectedAcceptanceManifest(contract)))throw new Error('capsule_derived_view_mismatch:acceptance/manifest.json');
  const references=contents.get('references/manifest.json');if(references===undefined)throw new Error('capsule_references_manifest_missing');
  if(!jsonEquivalent(parseJson(references,'references_manifest'),expectedReferencesManifest(contract)))throw new Error('capsule_derived_view_mismatch:references/manifest.json');
}
function readLocalCapsule(root:string):LocalCapsule{
  assertNoSymlinkPath(root);assertNoSymlinkPath(capsuleMetadataPath(root));
  const value=JSON.parse(fs.readFileSync(capsuleMetadataPath(root),'utf8')) as LocalCapsule;
  if(value?.schema_version!=='builder-capsule.v1'||!Array.isArray(value.files))throw new Error('builder_capsule_local_invalid');
  assertCapsuleShape(value.files);validateCapsuleMetadata(value);
  return value;
}
function writeCapsule(root:string,capsule:BuilderCapsuleView){
  if(capsule.schema_version!=='builder-capsule.v1')throw new Error('builder_capsule_server_invalid');
  for(const file of capsule.files)safeCapsuleTarget(root,file.path);
  assertCapsuleShape(capsule.files);validateCapsuleMetadata(capsule);
  assertNoSymlinkPath(root);
  const prepared=capsule.files.map((file)=>{
    const target=safeCapsuleTarget(root,file.path);assertNoSymlinkPath(target);
    if(sha256(file.content)!==file.sha256)throw new Error(`capsule_server_digest_mismatch:${file.path}`);
    return {file,target};
  });
  const contents=new Map(prepared.map(({file})=>[file.path,file.content]));
  const contractFile=capsule.files.find((file)=>file.path==='contract.json');if(!contractFile)throw new Error('capsule_contract_missing');
  const contract=validateFrozenContract(contractFile.content,capsule);assertDerivedViews(contents,contract);
  fs.mkdirSync(root,{recursive:true});assertNoSymlinkPath(root);
  for(const {file,target} of prepared){
    fs.mkdirSync(path.dirname(target),{recursive:true});assertNoSymlinkPath(path.dirname(target));assertNoSymlinkPath(target);
    fs.writeFileSync(target,file.content,'utf8');
  }
  const local:LocalCapsule={...capsule,files:capsule.files.map(({content:_content,...file})=>file)};
  assertNoSymlinkPath(capsuleMetadataPath(root));fs.writeFileSync(capsuleMetadataPath(root),JSON.stringify(local,null,2)+'\n','utf8');
}
function checkCapsule(root:string){
  const capsule=readLocalCapsule(root);const contents=new Map<string,string>();
  for(const file of capsule.files){
    const target=safeCapsuleTarget(root,file.path);assertNoSymlinkPath(target);
    if(!fs.existsSync(target))throw new Error(`capsule_file_missing:${file.path}`);
    const content=fs.readFileSync(target,'utf8');if(sha256(content)!==file.sha256)throw new Error(`capsule_file_digest_mismatch:${file.path}`);
    contents.set(file.path,content);
  }
  const contractContent=contents.get('contract.json');if(contractContent===undefined)throw new Error('capsule_contract_missing');
  const contract=validateFrozenContract(contractContent,capsule);assertDerivedViews(contents,contract);
  return capsule;
}
function gitOutput(cwd:string,args:string[],errorCode:string){
  try{return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{throw new Error(errorCode);}
}
function implicitGitSource(cwd:string){
  const gitRoot=gitOutput(cwd,['rev-parse','--show-toplevel'],'challenge_submit_git_root_unavailable');
  const toolRelative=path.relative(gitRoot,path.join(cwd,'.rekt')).split(path.sep).join('/');
  if(toolRelative===''||toolRelative==='..'||toolRelative.startsWith('../'))throw new Error('challenge_submit_rekt_metadata_outside_repo');
  const exclude=`:(exclude)${toolRelative}/**`;
  if(gitOutput(gitRoot,['status','--porcelain','--untracked-files=all','--','.',exclude],'challenge_submit_git_status_unavailable').length>0)throw new Error('challenge_submit_dirty_worktree');
  const head=gitOutput(gitRoot,['rev-parse','HEAD'],'challenge_submit_git_head_unavailable');
  if(!GIT_COMMIT_PATTERN.test(head))throw new Error('challenge_submit_git_head_invalid');
  return head.toLowerCase();
}

async function challengeCommand(rest:string[],env:NodeJS.ProcessEnv,io:Io,cwd:string):Promise<number>{
  const [subcommand,...args]=rest;
  if(!subcommand||subcommand==='help'||subcommand==='--help'){io.out('rekt challenge pull <id> [--api URL] [--out DIR] | status [--out DIR] | check [--out DIR] | submit --version N --artifact-digest SHA256 [--source-kind KIND] [--source REF] [--evidence refs] [--live-url URL] [--ship-submission-id UUID] [--api URL] [--out DIR]');return 0;}
  const {values,positional}=parse(args);const root=path.resolve(cwd,values.get('out')??path.relative(cwd,defaultCapsuleDir(cwd)));
  if(subcommand==='pull'){
    const challengeId=positional[0];if(!challengeId)throw new Error('challenge_id_required');
    const apiUrl=values.get('api')??env.REKT_API_URL??'http://127.0.0.1:8787';
    const capsule=await clientFor(env,apiUrl).challenge.capsule(challengeId);if(capsule.challenge_id!==challengeId.toLowerCase())throw new Error('capsule_challenge_mismatch');writeCapsule(root,capsule);
    io.out(`challenge pulled ${capsule.challenge_id} ${capsule.terms_digest}`);return 0;
  }
  if(subcommand==='status'){
    const capsule=readLocalCapsule(root);io.out(JSON.stringify({schema_version:capsule.schema_version,challenge_id:capsule.challenge_id,entry_id:capsule.entry_id,entry_state:capsule.entry_state,contract_version:capsule.contract_version,terms_digest:capsule.terms_digest,submission_deadline:capsule.submission_deadline},null,2));return 0;
  }
  if(subcommand==='check'){
    const capsule=checkCapsule(root);io.out(`challenge check: LOCAL CONSISTENCY PASS ${capsule.challenge_id} ${capsule.terms_digest}`);return 0;
  }
  if(subcommand==='submit'){
    const capsule=checkCapsule(root);
    const rawVersion=values.get('version');const submissionVersion=rawVersion?Number(rawVersion):NaN;if(!Number.isSafeInteger(submissionVersion)||submissionVersion<1)throw new Error('challenge_submit_version_required');
    const artifactDigest=values.get('artifact-digest');if(!artifactDigest||!DIGEST_PATTERN.test(artifactDigest))throw new Error('challenge_submit_artifact_digest_required');
    const sourceKind=(values.get('source-kind')??'GIT_COMMIT') as 'GIT_COMMIT'|'CONTENT_ADDRESS'|'ARCHIVE_DIGEST';if(!SOURCE_KINDS.has(sourceKind))throw new Error('challenge_submit_source_kind_invalid');
    let source=values.get('source');if(!source){if(sourceKind!=='GIT_COMMIT')throw new Error('challenge_submit_source_required');source=implicitGitSource(cwd);}if(source.length<1)throw new Error('challenge_submit_source_required');
    const evidence=values.get('evidence')?.split(',').map((item)=>item.trim()).filter(Boolean)??[];
    const liveUrl=values.get('live-url');if(liveUrl){try{new URL(liveUrl);}catch{throw new Error('challenge_submit_live_url_invalid');}}
    const shipSubmissionId=values.get('ship-submission-id');if(shipSubmissionId&&!UUID_PATTERN.test(shipSubmissionId))throw new Error('challenge_submit_ship_submission_id_invalid');
    const apiUrl=values.get('api')??env.REKT_API_URL??'http://127.0.0.1:8787';
    const result=await clientFor(env,apiUrl).challenge.submit(capsule.challenge_id,{entryId:capsule.entry_id,expectedTermsDigest:capsule.terms_digest,submissionVersion,immutableSourceReference:{kind:sourceKind,value:source},artifactDigest,evidenceReferences:evidence,...(liveUrl?{optionalLiveUrl:liveUrl}:{}),...(shipSubmissionId?{shipSubmissionId}:{})});
    io.out(JSON.stringify(result,null,2));return 0;
  }
  throw new Error(`unknown_challenge_command_${subcommand}`);
}

export async function main(argv=process.argv.slice(2),env:NodeJS.ProcessEnv=process.env,io:Io=defaultIo,cwd=process.cwd()):Promise<number>{
  const [command,...rest]=argv;if(!command||command==='help'||command==='--help'){io.out('rekt init|status|next|update|beacon|claim|ship|doctor|challenge');return 0;}
  try{
    if(command==='challenge')return await challengeCommand(rest,env,io,cwd);
    if(command==='init'){const parsed=parse(rest);const apiUrl=parsed.values.get('api')??env.REKT_API_URL??'http://127.0.0.1:8787';const state=await clientFor(env,apiUrl).mission.current();writeConfig(cwd,{schema_version:'rekt.local.v1',api_url:apiUrl,project_id:state.project.project_id,mission_id:state.mission.mission_id});io.out(`linked ${state.project.project_id} ${state.mission.mission_id}`);return 0;}
    const config=readConfig(cwd);const client=clientFor(env,config.api_url);
    if(command==='status'){io.out(JSON.stringify(await client.mission.status(),null,2));return 0;}
    if(command==='next'){io.out((await client.mission.current()).mission.next_move);return 0;}
    if(command==='update'){const {values}=parse(rest);await client.mission.update({currentFocus:values.get('focus'),nextMove:values.get('next'),blocker:values.has('blocker')?values.get('blocker')!:undefined,idempotencyKey:values.get('request-id')});io.out('updated');return 0;}
    if(command==='beacon'){const {values,positional}=parse(rest);const summary=values.get('summary')??positional.join(' ');if(!summary)throw new Error('beacon_summary_required');const result=await client.beacon.create({summary,skillsNeeded:skills(values.get('skills')),idempotencyKey:values.get('request-id')});io.out(JSON.stringify(result,null,2));return 0;}
    if(command==='claim'){const {values,positional}=parse(rest);const gateKey=positional[0] as 'FOUNDATION'|'CORE_EXPERIENCE'|'QUALITY_TESTING'|'SHIPABILITY'|undefined;if(!gateKey)throw new Error('gate_key_required');await client.mission.claim({gateKey,state:(values.get('state') as any)??'CLAIMED',idempotencyKey:values.get('request-id')});io.out(`claimed ${gateKey}`);return 0;}
    if(command==='ship'){const {values}=parse(rest);const title=values.get('title'),url=values.get('url');if(!title||!url)throw new Error('ship_title_and_url_required');const result=await client.ship.prepare({title,url,demoUrl:values.get('demo'),sourceUrl:values.get('source'),idempotencyKey:values.get('request-id')});io.out(JSON.stringify(result,null,2));return 0;}
    if(command==='doctor'){const health=await fetch(`${config.api_url.replace(/\/$/,'')}/health`);if(!health.ok)throw new Error(`health_${health.status}`);await client.player.me();await client.mission.current();io.out('doctor: PASS');return 0;}
    throw new Error(`unknown_command_${command}`);
  }catch(cause){io.err(cause instanceof Error?cause.message:String(cause));return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){process.exitCode=await main();}
