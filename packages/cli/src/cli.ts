#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createInkubatorClient} from '@rekt-ink/sdk';

type Io = {out:(value:string)=>void;err:(value:string)=>void};
type Config = {schema_version:'rekt.local.v1';api_url:string;project_id:string;mission_id:string};
const defaultIo: Io = {out:(value)=>process.stdout.write(`${value}\n`),err:(value)=>process.stderr.write(`${value}\n`)};
function parse(args:string[]){const values=new Map<string,string>();const positional:string[]=[];for(let i=0;i<args.length;i+=1){const item=args[i];if(item.startsWith('--')){const value=args[i+1];if(!value||value.startsWith('--'))throw new Error(`missing_value_${item.slice(2)}`);values.set(item.slice(2),value);i+=1;}else positional.push(item);}return {values,positional};}
function configPath(cwd:string){return path.join(cwd,'.rekt','config.json');}
function readConfig(cwd:string):Config{const value=JSON.parse(fs.readFileSync(configPath(cwd),'utf8'));if(value?.schema_version!=='rekt.local.v1')throw new Error('rekt_config_invalid');return value;}
function writeConfig(cwd:string,config:Config){fs.mkdirSync(path.dirname(configPath(cwd)),{recursive:true});fs.writeFileSync(configPath(cwd),JSON.stringify(config,null,2)+'\n',{mode:0o600});}
function clientFor(env:NodeJS.ProcessEnv,apiUrl:string){const accessToken=env.REKT_DEVKIT_TOKEN;if(!accessToken)throw new Error('REKT_DEVKIT_TOKEN is required');return createInkubatorClient({baseUrl:apiUrl,accessToken});}
function skills(value:string|undefined){return value?value.split(',').map((part)=>part.trim()).filter(Boolean):undefined;}

export async function main(argv=process.argv.slice(2),env:NodeJS.ProcessEnv=process.env,io:Io=defaultIo,cwd=process.cwd()):Promise<number>{
  const [command,...rest]=argv; if(!command||command==='help'||command==='--help'){io.out('rekt init|status|next|update|beacon|claim|ship|doctor');return 0;}
  try{
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
