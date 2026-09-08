import {McpServer} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type {ReturnTypeOfCreateInkubatorClient} from './types.js';

export const MCP_RESOURCE_URIS = ['inkubator://mission/current','inkubator://project/current','inkubator://mission/ship-condition','inkubator://project/activity','inkubator://player/profile'] as const;
export const MCP_TOOL_NAMES = ['get_mission_status','get_next_move','get_ship_condition','get_project_status','list_help_beacons','get_activity','claim_milestone','post_project_update','create_help_beacon','offer_assist','prepare_ship'] as const;
const text = (value: unknown) => ({content:[{type:'text' as const,text:typeof value==='string'?value:JSON.stringify(value)}]});

export function createInkubatorMcpServer({client}:{client:ReturnTypeOfCreateInkubatorClient}) {
  const server=new McpServer({name:'rekt-inkubator',version:'0.1.0'});
  server.registerResource('mission-current',MCP_RESOURCE_URIS[0],{mimeType:'application/json'},async(uri)=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(await client.mission.current())}]}));
  server.registerResource('project-current',MCP_RESOURCE_URIS[1],{mimeType:'application/json'},async(uri)=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(await client.project.current())}]}));
  server.registerResource('ship-condition',MCP_RESOURCE_URIS[2],{mimeType:'text/plain'},async(uri)=>({contents:[{uri:uri.href,mimeType:'text/plain',text:(await client.mission.current()).mission.ship_condition}]}));
  server.registerResource('project-activity',MCP_RESOURCE_URIS[3],{mimeType:'application/json'},async(uri)=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(await client.project.activity())}]}));
  server.registerResource('player-profile',MCP_RESOURCE_URIS[4],{mimeType:'application/json'},async(uri)=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(await client.player.profile())}]}));
  server.registerTool('get_mission_status',{description:'Read canonical current Mission state'},async()=>text(await client.mission.status()));
  server.registerTool('get_next_move',{description:'Read canonical next move'},async()=>text((await client.mission.current()).mission.next_move));
  server.registerTool('get_ship_condition',{description:'Read canonical Ship condition'},async()=>text((await client.mission.current()).mission.ship_condition));
  server.registerTool('get_project_status',{description:'Read canonical current Project'},async()=>text(await client.project.current()));
  server.registerTool('list_help_beacons',{description:'List current Project Help Beacons'},async()=>text(await client.beacon.list()));
  server.registerTool('get_activity',{description:'Read privacy-safe current Project activity'},async()=>text(await client.project.activity()));
  server.registerTool('claim_milestone',{description:'Submit a participant CLAIM; never PROOF',inputSchema:z.object({gateKey:z.enum(['FOUNDATION','CORE_EXPERIENCE','QUALITY_TESTING','SHIPABILITY']),state:z.enum(['UNKNOWN','CLAIMED','ACTIVE','ATTENTION','BLOCKED','STALE','FAILED']).optional(),idempotencyKey:z.string().uuid().optional()})},async(args)=>text(await client.mission.claim(args)));
  server.registerTool('post_project_update',{description:'Update participant-controlled Mission fields',inputSchema:z.object({currentFocus:z.string().optional(),nextMove:z.string().optional(),blocker:z.string().nullable().optional(),idempotencyKey:z.string().uuid().optional()})},async(args)=>text(await client.mission.update(args)));
  server.registerTool('create_help_beacon',{description:'Create a bounded Help Beacon',inputSchema:z.object({summary:z.string().min(1),skillsNeeded:z.array(z.string()).max(8).optional(),idempotencyKey:z.string().uuid().optional()})},async(args)=>text(await client.beacon.create(args)));
  server.registerTool('offer_assist',{description:'Offer bounded Assist',inputSchema:z.object({beaconId:z.string().uuid(),message:z.string().min(1),idempotencyKey:z.string().uuid().optional()})},async(args)=>text(await client.assist.offer(args)));
  server.registerTool('prepare_ship',{description:'Submit claimed Ship material to canonical verifier path; does not approve Ship',inputSchema:z.object({title:z.string().min(1),url:z.string().url(),demoUrl:z.string().url().optional(),sourceUrl:z.string().url().optional(),idempotencyKey:z.string().uuid().optional()})},async(args)=>text(await client.ship.prepare(args)));
  return server;
}
