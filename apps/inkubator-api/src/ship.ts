import {randomUUID} from 'node:crypto';
import {sql, type Kysely, type Selectable} from 'kysely';
import type {DatabaseSchema, ShipSubmissionTable, ShipVerifierObservationTable} from './database.js';
import {appendHistoryEvent} from './events.js';
import {enqueueOutboxJob, SHIP_VERIFICATION_JOB_TYPE} from './jobs.js';
import {getAcceptedShipArtifactForSubmission} from './ship-artifact.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value: string, name: string) { if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`invalid_${name}`); return value.toLowerCase(); }
function title(value: string) { if (typeof value !== 'string') throw new Error('invalid_artifact_title'); const v=value.trim().replace(/\s+/g,' '); if(v.length<1||v.length>120)throw new Error('invalid_artifact_title'); return v; }
function publicHttps(value: string | undefined, name: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 2048) throw new Error(`invalid_${name}`);
  let url: URL; try { url = new URL(value); } catch { throw new Error(`invalid_${name}`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`invalid_${name}`);
  url.hash=''; return url.href;
}
function submissionView(row: Selectable<ShipSubmissionTable>) {
  return {schema_version:'ship.submission.private.v1' as const, submission_id:row.submission_id, mission_id:row.mission_id, project_id:row.project_id,
    artifact:{title:row.artifact_title,url:row.artifact_url,...(row.demo_url?{demo_url:row.demo_url}:{}),...(row.source_url?{source_url:row.source_url}:{})}, state:row.state, submitted_at:row.submitted_at.toISOString()};
}
function observationView(row: Selectable<ShipVerifierObservationTable>) {
  return {schema_version:'ship.verifier_observation.public.v1' as const, outcome:row.outcome, reason_code:row.reason_code,
    ...(row.http_status!==null?{http_status:row.http_status}:{}), duration_ms:row.duration_ms, redirects:row.redirects, observed_at:row.observed_at.toISOString()};
}
function publicSubmissionState(state: string): 'SUBMITTED' | 'OBSERVED' | 'ATTENTION' | 'PROVEN' {
  if (state === 'ACCEPTED') return 'PROVEN';
  if (state === 'REJECTED' || state === 'SUPERSEDED') return 'ATTENTION';
  if (state === 'SUBMITTED' || state === 'OBSERVED' || state === 'ATTENTION') return state;
  throw new Error('ship_submission_state_invalid');
}
function sameSubmission(row: Selectable<ShipSubmissionTable>, missionId:string, actorId:string, artifactTitle:string, artifactUrl:string, demoUrl:string|null, sourceUrl:string|null) {
  return row.mission_id===missionId && row.owner_player_id===actorId && row.artifact_title===artifactTitle && row.artifact_url===artifactUrl && row.demo_url===demoUrl && row.source_url===sourceUrl;
}

export async function submitShip(db: Kysely<DatabaseSchema>, actorIdInput:string, missionIdInput:string, input:{requestId:string;title:string;url:string;demoUrl?:string;sourceUrl?:string}) {
  const actorId=uuid(actorIdInput,'player_id'), missionId=uuid(missionIdInput,'mission_id'), requestId=uuid(input.requestId,'request_id');
  const artifactTitle=title(input.title), artifactUrl=publicHttps(input.url,'artifact_url')!, demoUrl=publicHttps(input.demoUrl,'demo_url'), sourceUrl=publicHttps(input.sourceUrl,'source_url');
  return db.transaction().execute(async tx=>{
    const replay=await tx.selectFrom('ship_submissions').selectAll().where('creation_request_id','=',requestId).executeTakeFirst();
    if(replay){if(!sameSubmission(replay,missionId,actorId,artifactTitle,artifactUrl,demoUrl,sourceUrl))throw new Error('ship_submission_idempotency_conflict');return submissionView(replay);}
    const mission=await tx.selectFrom('missions').select(['mission_id','project_id','owner_player_id','state']).where('mission_id','=',missionId).forUpdate().executeTakeFirst();
    if(!mission)throw new Error('mission_not_found');
    const lockedReplay=await tx.selectFrom('ship_submissions').selectAll().where('creation_request_id','=',requestId).executeTakeFirst();
    if(lockedReplay){if(!sameSubmission(lockedReplay,missionId,actorId,artifactTitle,artifactUrl,demoUrl,sourceUrl))throw new Error('ship_submission_idempotency_conflict');return submissionView(lockedReplay);}
    if(mission.owner_player_id!==actorId)throw new Error('authorization_denied');
    if(mission.state!=='SHIP_READY')throw new Error('mission_not_ship_ready');
    const active=await tx.selectFrom('ship_submissions').select(['submission_id','state']).where('mission_id','=',missionId).where('state','in',['SUBMITTED','OBSERVED','ATTENTION']).executeTakeFirst();
    if(active){
      const activeObservation=await tx.selectFrom('ship_verifier_observations').select('outcome').where('submission_id','=',active.submission_id).executeTakeFirst();
      if(active.state!=='ATTENTION'||activeObservation?.outcome!=='UNAVAILABLE')throw new Error('ship_submission_active');
      const superseded=await tx.updateTable('ship_submissions').set({state:'SUPERSEDED' as any,updated_at:sql`clock_timestamp()`}).where('submission_id','=',active.submission_id).where('state','=','ATTENTION').executeTakeFirst();
      if(Number(superseded.numUpdatedRows)!==1)throw new Error('ship_submission_supersede_invariant');
    }
    const row=await tx.insertInto('ship_submissions').values({submission_id:randomUUID(),mission_id:missionId,project_id:mission.project_id,owner_player_id:actorId,creation_request_id:requestId,
      artifact_title:artifactTitle,artifact_url:artifactUrl,demo_url:demoUrl,source_url:sourceUrl,state:'SUBMITTED'}).returningAll().executeTakeFirstOrThrow();
    await tx.updateTable('missions').set({state:'SUBMITTED',updated_at:sql`clock_timestamp()`}).where('mission_id','=',missionId).execute();
    await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'project.ship.submitted',dedupeKey:`activity:project.ship.submitted:${row.submission_id}`,actorPlayerId:actorId,subjectType:'project',subjectId:mission.project_id,
      payload:{schema_version:'project.ship.submitted.v1',submission_id:row.submission_id,mission_id:missionId,project_id:mission.project_id,artifact_title:artifactTitle,artifact_url:artifactUrl,truth_state:'CLAIMED'}});
    await enqueueOutboxJob(tx,{jobType:SHIP_VERIFICATION_JOB_TYPE,idempotencyKey:`ship.verify:${row.submission_id}`,payload:{schema_version:'ship.verification.job.v1',submission_id:row.submission_id,artifact_url:artifactUrl},maxAttempts:5});
    return submissionView(row);
  });
}

export async function getProjectShipState(db:Kysely<DatabaseSchema>,projectIdInput:string){
  const projectId=uuid(projectIdInput,'project_id');
  const project=await db.selectFrom('projects').select('project_id').where('project_id','=',projectId).executeTakeFirst(); if(!project)throw new Error('project_not_found');
  const submission=await db.selectFrom('ship_submissions').selectAll().where('project_id','=',projectId).orderBy('submitted_at','desc').executeTakeFirst();
  if(!submission)return{schema_version:'project.ship.public.v2' as const,project_id:projectId};
  const observation=await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id','=',submission.submission_id).executeTakeFirst();
  const acceptedShip=await getAcceptedShipArtifactForSubmission(db,submission.submission_id);
  return{schema_version:'project.ship.public.v2' as const,project_id:projectId,latest_submission:{schema_version:'ship.submission.public.v2' as const,submission_id:submission.submission_id,mission_id:submission.mission_id,project_id:submission.project_id,
    // Public Ship projection deliberately omits source_url and verifier redirect targets. Private submission/observation storage remains server-side.
    artifact:{title:submission.artifact_title,url:submission.artifact_url,...(submission.demo_url?{demo_url:submission.demo_url}:{})},state:publicSubmissionState(String(submission.state)),submitted_at:submission.submitted_at.toISOString(),...(observation?{verifier_observation:observationView(observation)}:{}),...(acceptedShip?{accepted_ship:acceptedShip}:{})}};
}
