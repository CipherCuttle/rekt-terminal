import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import type {Kysely} from 'kysely';
import './contract-phase10.js';
import {buildBuilderCapsule} from './builder-capsule.js';
import {acceptChallengeSubmission, readChallengeSnapshot} from './challenge-store.js';
import type {DatabaseSchema, MissionGateRow} from './database.js';
import {consumeDevkitRateLimit, hasDevkitScope, issueDevkitToken, listDevkitTokens, readBearerToken, resolveDevkitCredential, revokeDevkitToken, type DevkitScope, type ResolvedDevkitCredential} from './devkit.js';
import {commandToPrivateView, getCurrentCommand, getPlayerProfile, updateMission, updateMissionGate} from './mission-command.js';
import {getPlayer} from './players.js';
import {toPrivatePlayer} from './projection.js';
import {createHelpBeacon, getProjectHelpLoop, offerAssist} from './social.js';
import {submitShip} from './ship.js';
import {readSessionToken, resolveSessionActor} from './session.js';

const GATE_KEYS = new Set<MissionGateRow['gate_key']>(['FOUNDATION','CORE_EXPERIENCE','QUALITY_TESTING','SHIPABILITY']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const SOURCE_KINDS = new Set(['GIT_COMMIT','CONTENT_ADDRESS','ARCHIVE_DIGEST']);

function error(reply: FastifyReply, status: number, message: string) { return reply.code(status).send({error: message}); }

function domainError(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'devkit_mutation_failed';
  if (message === 'authorization_denied' || message.endsWith('_not_participant_authorized') || message === 'social_interaction_blocked') return error(reply, 403, message);
  if (message.endsWith('_not_found') || message === 'project_not_found' || message === 'player_not_found' || message === 'active_mission_not_found') return error(reply, 404, message);
  if (message.includes('idempotency_conflict') || message.includes('_conflict') || message.endsWith('_already_open') || message.endsWith('_already_offered') || message === 'ship_submission_active') return error(reply, 409, message);
  if (message.startsWith('invalid_') || message.endsWith('_empty') || message === 'mission_transition_invalid') return error(reply, 400, message);
  throw cause;
}

function submissionDomainError(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'challenge_submission_failed';
  if (message === 'challenge_entry_not_found' || message === 'challenge_not_found') return error(reply, 404, message);
  if (
    message === 'challenge_contract_not_frozen' ||
    message === 'challenge_contract_pointer_invalid' ||
    message === 'challenge_terms_digest_stale' ||
    message === 'challenge_not_building' ||
    message === 'challenge_submission_deadline_elapsed' ||
    message === 'challenge_submission_protocol_ineligible' ||
    message === 'challenge_submission_immutable_conflict' ||
    message === 'challenge_ship_lineage_invalid' ||
    message.includes('idempotency_conflict') ||
    message.includes('_conflict')
  ) return error(reply, 409, message);
  if (message.startsWith('invalid_')) return error(reply, 400, message);
  throw cause;
}

function validateSubmissionBody(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_submission_body');
  const body = value as Record<string, unknown>;
  const requestId = body.request_id;
  const submissionId = body.submission_id;
  const entryId = body.entry_id;
  const expectedTermsDigest = body.expected_terms_digest;
  const submissionVersion = body.submission_version;
  const source = body.immutable_source_reference;
  const artifactDigest = body.artifact_digest;
  const evidenceReferences = body.evidence_references;
  const optionalLiveUrl = body.optional_live_url;
  const shipSubmissionId = body.ship_submission_id;

  if (typeof requestId !== 'string' || !UUID_PATTERN.test(requestId)) throw new Error('invalid_request_id');
  if (typeof submissionId !== 'string' || !UUID_PATTERN.test(submissionId)) throw new Error('invalid_submission_id');
  if (typeof entryId !== 'string' || !UUID_PATTERN.test(entryId)) throw new Error('invalid_entry_id');
  if (typeof expectedTermsDigest !== 'string' || !DIGEST_PATTERN.test(expectedTermsDigest)) throw new Error('invalid_expected_terms_digest');
  if (!Number.isSafeInteger(submissionVersion) || Number(submissionVersion) < 1) throw new Error('invalid_submission_version');
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('invalid_immutable_source_reference');
  const sourceRecord = source as Record<string, unknown>;
  if (typeof sourceRecord.kind !== 'string' || !SOURCE_KINDS.has(sourceRecord.kind)) throw new Error('invalid_immutable_source_kind');
  if (typeof sourceRecord.value !== 'string' || sourceRecord.value.trim().length < 1 || sourceRecord.value.length > 500) throw new Error('invalid_immutable_source_value');
  if (typeof artifactDigest !== 'string' || !DIGEST_PATTERN.test(artifactDigest)) throw new Error('invalid_artifact_digest');
  if (!Array.isArray(evidenceReferences) || evidenceReferences.length > 100 || evidenceReferences.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 500) || new Set(evidenceReferences).size !== evidenceReferences.length) throw new Error('invalid_evidence_references');
  if (optionalLiveUrl !== undefined) {
    if (typeof optionalLiveUrl !== 'string' || optionalLiveUrl.length > 2000) throw new Error('invalid_optional_live_url');
    try { new URL(optionalLiveUrl); } catch { throw new Error('invalid_optional_live_url'); }
  }
  if (shipSubmissionId !== undefined && (typeof shipSubmissionId !== 'string' || !UUID_PATTERN.test(shipSubmissionId))) throw new Error('invalid_ship_submission_id');

  return {
    requestId: requestId.toLowerCase(), submissionId: submissionId.toLowerCase(), entryId: entryId.toLowerCase(), expectedTermsDigest,
    submissionVersion: Number(submissionVersion),
    immutableSourceReference: {kind: sourceRecord.kind as 'GIT_COMMIT'|'CONTENT_ADDRESS'|'ARCHIVE_DIGEST', value: sourceRecord.value},
    artifactDigest,
    evidenceReferences: evidenceReferences as string[],
    optionalLiveUrl: optionalLiveUrl as string | undefined,
    shipSubmissionId: shipSubmissionId as string | undefined,
  };
}

async function browserSessionPlayer(request: FastifyRequest, reply: FastifyReply, db: Kysely<DatabaseSchema>): Promise<string | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) { error(reply, 401, 'authentication_required'); return null; }
  const actor = await resolveSessionActor(db, token);
  if (!actor) { error(reply, 401, 'authentication_required'); return null; }
  return actor.playerId;
}

async function sessionPlayer(request: FastifyRequest, reply: FastifyReply, db: Kysely<DatabaseSchema>, appOrigin: string): Promise<string | null> {
  if (request.headers.origin !== appOrigin) { error(reply, 403, 'origin_not_allowed'); return null; }
  const token = readSessionToken(request.headers.cookie);
  if (!token) { error(reply, 401, 'authentication_required'); return null; }
  const actor = await resolveSessionActor(db, token);
  if (!actor) { error(reply, 401, 'authentication_required'); return null; }
  return actor.playerId;
}

async function credential(request: FastifyRequest, reply: FastifyReply, db: Kysely<DatabaseSchema>, scope: DevkitScope): Promise<ResolvedDevkitCredential | null> {
  const token = readBearerToken(request.headers.authorization);
  if (!token) { error(reply, 401, 'devkit_credential_required'); return null; }
  const resolved = await resolveDevkitCredential(db, token);
  if (!resolved) { error(reply, 401, 'devkit_credential_invalid'); return null; }
  const rate = await consumeDevkitRateLimit(db, resolved.tokenId);
  if (!rate.allowed) {
    if (rate.invalid) { error(reply, 401, 'devkit_credential_invalid'); return null; }
    reply.header('retry-after', String(rate.retryAfterSeconds));
    reply.header('x-ratelimit-limit', '60');
    error(reply, 429, 'devkit_rate_limited');
    return null;
  }
  reply.header('x-ratelimit-limit', '60');
  reply.header('x-ratelimit-remaining', String(rate.remaining));
  if (!hasDevkitScope(resolved, scope)) { error(reply, 403, 'devkit_scope_denied'); return null; }
  return resolved;
}

function profileView(playerId: string, profile: Awaited<ReturnType<typeof getPlayerProfile>>) {
  const labels = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
  return {schema_version:'player.profile.v2' as const,player_id:playerId,...(profile?.bio?{bio:profile.bio}:{}),...(profile?.character_name?{character_name:profile.character_name}:{}),...(profile?.character_archetype?{character_archetype:profile.character_archetype}:{}),skills_needed:labels(profile?.skills_needed),can_help_with:labels(profile?.can_help_with)};
}

async function currentCommand(db: Kysely<DatabaseSchema>, playerId: string) {
  return getCurrentCommand(db, playerId);
}

export function registerPhase8DevkitRoutes(app: FastifyInstance, db: Kysely<DatabaseSchema>, options: {appOrigin: string}): void {
  app.get('/v1/projects/:projectId/pending-assists', async (request, reply) => {
    const playerId = await browserSessionPlayer(request, reply, db); if (!playerId) return;
    const {projectId} = request.params as {projectId:string};
    if (!UUID_PATTERN.test(projectId)) return error(reply, 400, 'invalid_project_id');
    const project = await db.selectFrom('projects').select(['project_id','owner_player_id']).where('project_id','=',projectId).executeTakeFirst();
    if (!project) return error(reply, 404, 'project_not_found');
    if (project.owner_player_id !== playerId) return error(reply, 403, 'authorization_denied');
    const rows = await db.selectFrom('assist_offers as assist')
      .innerJoin('players as player','player.player_id','assist.offered_by_player_id')
      .select(['assist.assist_id','assist.beacon_id','assist.project_id','assist.offered_by_player_id','assist.message','assist.state','assist.offered_at','player.display_name'])
      .where('assist.project_id','=',projectId).where('assist.state','=','OFFERED')
      .orderBy('assist.offered_at','asc').orderBy('assist.assist_id','asc').limit(50).execute();
    reply.header('cache-control','no-store');
    return {schema_version:'project.pending_assists.private.v1',project_id:projectId,assists:rows.map(row=>({assist_id:row.assist_id,beacon_id:row.beacon_id,project_id:row.project_id,offered_by_player_id:row.offered_by_player_id,offered_by_display_name:row.display_name,message:row.message,state:'OFFERED' as const,offered_at:row.offered_at.toISOString()}))};
  });

  app.post('/v1/devkit/tokens', async (request, reply) => {
    const playerId = await sessionPlayer(request, reply, db, options.appOrigin); if (!playerId) return;
    const body = request.body as {request_id:string;credential_class:'CLI'|'MCP'|'AUTOMATION';label:string;scopes:string[];expires_in_seconds:number};
    try { return reply.code(201).send(await issueDevkitToken(db, playerId, {requestId:body.request_id,credentialClass:body.credential_class,label:body.label,scopes:body.scopes,expiresInSeconds:body.expires_in_seconds})); }
    catch (cause) { const message=cause instanceof Error?cause.message:'devkit_token_issue_failed'; if(message==='devkit_token_issue_replayed')return error(reply,409,message); if(message.startsWith('invalid_'))return error(reply,400,message); throw cause; }
  });

  app.get('/v1/devkit/tokens', async (request, reply) => {
    const playerId = await sessionPlayer(request, reply, db, options.appOrigin); if (!playerId) return;
    reply.header('cache-control','no-store'); return listDevkitTokens(db, playerId);
  });

  app.post('/v1/devkit/tokens/:tokenId/revoke', async (request, reply) => {
    const playerId=await sessionPlayer(request,reply,db,options.appOrigin);if(!playerId)return;const {tokenId}=request.params as {tokenId:string};
    try{return await revokeDevkitToken(db,playerId,tokenId);}catch(cause){const message=cause instanceof Error?cause.message:'devkit_token_revoke_failed';if(message==='devkit_token_not_found')return error(reply,404,message);if(message.startsWith('invalid_'))return error(reply,400,message);throw cause;}
  });

  app.get('/v1/devkit/me', async(request,reply)=>{const auth=await credential(request,reply,db,'player:read');if(!auth)return;const player=await getPlayer(db,auth.playerId);if(!player)return error(reply,401,'devkit_credential_invalid');reply.header('cache-control','no-store');return toPrivatePlayer(player);});
  app.get('/v1/devkit/player/profile', async(request,reply)=>{const auth=await credential(request,reply,db,'player:read');if(!auth)return;reply.header('cache-control','no-store');return profileView(auth.playerId,await getPlayerProfile(db,auth.playerId));});

  app.get('/v1/devkit/challenges/:challengeId/capsule', async(request,reply)=>{
    const auth=await credential(request,reply,db,'project:read');if(!auth)return;
    const {challengeId}=request.params as {challengeId:string};
    if(!UUID_PATTERN.test(challengeId))return error(reply,400,'invalid_challenge_id');
    try{
      const snapshot=await readChallengeSnapshot(db,challengeId);
      if(!snapshot)return error(reply,404,'challenge_not_found');
      const capsule=buildBuilderCapsule(snapshot,auth.playerId);
      reply.header('cache-control','no-store');
      return capsule;
    }catch(cause){
      const message=cause instanceof Error?cause.message:'builder_capsule_unavailable';
      if(message==='challenge_entry_required')return error(reply,403,message);
      if(message==='challenge_contract_not_frozen'||message==='challenge_contract_pointer_invalid')return error(reply,409,message);
      if(message==='invalid_challenge_id')return error(reply,400,message);
      throw cause;
    }
  });

  app.post('/v1/devkit/challenges/:challengeId/submissions', async(request,reply)=>{
    const auth=await credential(request,reply,db,'challenge:submit');if(!auth)return;
    const {challengeId}=request.params as {challengeId:string};
    if(!UUID_PATTERN.test(challengeId))return error(reply,400,'invalid_challenge_id');
    try{
      const input=validateSubmissionBody(request.body);
      const snapshot=await readChallengeSnapshot(db,challengeId);
      if(!snapshot)return error(reply,404,'challenge_not_found');
      const entry=snapshot.entries.find((candidate)=>candidate.entry_id===input.entryId);
      if(!entry)return error(reply,404,'challenge_entry_not_found');
      if(entry.builder_player_id!==auth.playerId)return error(reply,403,'challenge_entry_owner_required');
      if(!snapshot.contract||!snapshot.challenge.current_terms_digest)return error(reply,409,'challenge_contract_not_frozen');
      if(snapshot.contract.terms_digest!==snapshot.challenge.current_terms_digest)return error(reply,409,'challenge_contract_pointer_invalid');
      if(input.expectedTermsDigest!==snapshot.challenge.current_terms_digest)return error(reply,409,'challenge_terms_digest_stale');
      const manifest={
        schema_version:'inkubator.submission-manifest/1.0' as const,
        challenge_id:challengeId.toLowerCase(),
        entry_id:input.entryId,
        terms_digest:snapshot.challenge.current_terms_digest,
        submission_version:input.submissionVersion,
        immutable_source_reference:input.immutableSourceReference,
        artifact_digest:input.artifactDigest,
        evidence_references:input.evidenceReferences,
        ...(input.optionalLiveUrl?{optional_live_url:input.optionalLiveUrl}:{}),
        accepted_at:0,
      };
      const row=await acceptChallengeSubmission(db,{requestId:input.requestId,submissionId:input.submissionId,challengeId,entryId:input.entryId,manifest,...(input.shipSubmissionId?{shipSubmissionId:input.shipSubmissionId}:{})});
      reply.header('cache-control','no-store');
      return reply.code(201).send({schema_version:'challenge.submission.accepted.v1',submission_id:row.submission_id,challenge_id:row.challenge_id,entry_id:row.entry_id,submission_version:row.submission_version,terms_digest:row.terms_digest,manifest_digest:row.manifest_digest,accepted_at:row.accepted_at.toISOString(),ship_submission_id:row.ship_submission_id});
    }catch(cause){return submissionDomainError(reply,cause);}
  });

  app.get('/v1/devkit/mission/current', async(request,reply)=>{const auth=await credential(request,reply,db,'mission:read');if(!auth)return;const command=await currentCommand(db,auth.playerId);if(!command)return error(reply,404,'active_mission_not_found');reply.header('cache-control','no-store');return commandToPrivateView(command);});

  app.patch('/v1/devkit/mission/current', async(request,reply)=>{const auth=await credential(request,reply,db,'update:write');if(!auth)return;const current=await currentCommand(db,auth.playerId);if(!current)return error(reply,404,'active_mission_not_found');const body=request.body as {request_id:string;current_focus?:string;next_move?:string;blocker?:string|null;stack_labels?:string[]};try{const command=await updateMission(db,auth.playerId,current.mission.mission_id,{requestId:body.request_id,currentFocus:body.current_focus,nextMove:body.next_move,blocker:body.blocker,stackLabels:body.stack_labels});return commandToPrivateView(command);}catch(cause){return domainError(reply,cause);}});

  app.post('/v1/devkit/mission/current/claims/:gateKey', async(request,reply)=>{const auth=await credential(request,reply,db,'claim:write');if(!auth)return;const current=await currentCommand(db,auth.playerId);if(!current)return error(reply,404,'active_mission_not_found');const {gateKey}=request.params as {gateKey:string};if(!GATE_KEYS.has(gateKey as MissionGateRow['gate_key']))return error(reply,400,'invalid_gate_key');const body=request.body as {request_id:string;state:any};try{const command=await updateMissionGate(db,auth.playerId,current.mission.mission_id,gateKey as MissionGateRow['gate_key'],{requestId:body.request_id,signalState:body.state});return commandToPrivateView(command);}catch(cause){return domainError(reply,cause);}});

  app.get('/v1/devkit/project/current', async(request,reply)=>{const auth=await credential(request,reply,db,'project:read');if(!auth)return;const current=await currentCommand(db,auth.playerId);if(!current)return error(reply,404,'active_mission_not_found');return commandToPrivateView(current).project;});

  app.get('/v1/devkit/project/current/help-beacons', async(request,reply)=>{const auth=await credential(request,reply,db,'project:read');if(!auth)return;const current=await currentCommand(db,auth.playerId);if(!current)return error(reply,404,'active_mission_not_found');try{const loop=await getProjectHelpLoop(db,current.project.project_id);return {schema_version:'devkit.help_beacons.v1',project_id:current.project.project_id,beacons:loop.open_help_beacon?[loop.open_help_beacon]:[]};}catch(cause){return domainError(reply,cause);}});

  app.post('/v1/devkit/project/current/help-beacons', async(request,reply)=>{const auth=await credential(request,reply,db,'beacon:write');if(!auth)return;const current=await currentCommand(db,auth.playerId);if(!current)return error(reply,404,'active_mission_not_found');const body=request.body as {request_id:string;summary:string;skills_needed?:string[]};try{return reply.code(201).send(await createHelpBeacon(db,auth.playerId,current.project.project_id,{requestId:body.request_id,summary:body.summary,skillsNeeded:body.skills_needed}));}catch(cause){return domainError(reply,cause);}});

  app.post('/v1/devkit/help-beacons/:beaconId/assists', async(request,reply)=>{const auth=await credential(request,reply,db,'assist:write');if(!auth)return;const {beaconId}=request.params as {beaconId:string};const body=request.body as {request_id:string;message:string};try{return reply.code(201).send(await offerAssist(db,auth.playerId,beaconId,{requestId:body.request_id,message:body.message}));}catch(cause){return domainError(reply,cause);}});

  app.get('/v1/devkit/project/current/activity', async(request,reply)=>{const auth=await credential(request,reply,db,'project:read');if(!auth)return;const current=await currentCommand(db,auth.playerId);if(!current)return error(reply,404,'active_mission_not_found');const rows=await db.selectFrom('history_events').select(['event_type','occurred_at']).where('subject_type','=','project').where('subject_id','=',current.project.project_id).orderBy('occurred_at','desc').limit(50).execute();return {schema_version:'devkit.activity.v1',project_id:current.project.project_id,events:rows.map(row=>({event_type:row.event_type,occurred_at:row.occurred_at.toISOString()}))};});

  app.post('/v1/devkit/mission/current/ship', async(request,reply)=>{const auth=await credential(request,reply,db,'ship:prepare');if(!auth)return;const current=await currentCommand(db,auth.playerId);if(!current)return error(reply,404,'active_mission_not_found');const body=request.body as {request_id:string;title:string;url:string;demo_url?:string;source_url?:string};try{return reply.code(201).send(await submitShip(db,auth.playerId,current.mission.mission_id,{requestId:body.request_id,title:body.title,url:body.url,...(body.demo_url?{demoUrl:body.demo_url}:{}),...(body.source_url?{sourceUrl:body.source_url}:{})}));}catch(cause){return domainError(reply,cause);}});
}
