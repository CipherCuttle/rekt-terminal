import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {main} from '../dist/cli.js';

test('SDK-H10 deleting .rekt state causes no canonical mutation', async () => {
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'rekt-cli-'));let mutations=0;
  const previous=globalThis.fetch;
  globalThis.fetch=async(_input,init={})=>{if((init.method??'GET')!=='GET')mutations+=1;return new Response(JSON.stringify({schema_version:'command.private.v2',project:{project_id:'11111111-1111-4111-8111-111111111111'},mission:{mission_id:'22222222-2222-4222-8222-222222222222',next_move:'ship it'},gates:[],github_evidence:{},daemon:{}}),{status:200,headers:{'content-type':'application/json'}});};
  const io={out:()=>{},err:()=>{}};
  try{assert.equal(await main(['init','--api','https://api.test'],{REKT_DEVKIT_TOKEN:'rekt_dk_test'},io,cwd),0);assert.equal(mutations,0);const config=JSON.parse(fs.readFileSync(path.join(cwd,'.rekt','config.json'),'utf8'));assert.equal('token' in config,false);fs.rmSync(path.join(cwd,'.rekt'),{recursive:true,force:true});assert.equal(mutations,0);}finally{globalThis.fetch=previous;fs.rmSync(cwd,{recursive:true,force:true});}
});
