from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))

# Database types.
db='apps/inkubator-api/src/database.ts'
replace_once(db, "export interface GitHubSetupStateTable {", """export interface PlayerBlockTable {
  blocker_player_id: string;
  blocked_player_id: string;
  created_at: Generated<Date>;
}

export type ContentReportReason = 'SPAM' | 'ABUSE' | 'PRIVACY' | 'OTHER';
export interface ContentReportTable {
  report_id: string;
  reporter_player_id: string;
  comment_id: string;
  creation_request_id: string;
  reason: ContentReportReason;
  detail: string | null;
  state: 'OPEN';
  created_at: Generated<Date>;
}

export interface ModerationOperatorTable {
  player_id: string;
  scope: 'GLOBAL_MODERATION';
  granted_at: Generated<Date>;
}

export type ExternalTestRequestState = 'OPEN' | 'COMPLETED' | 'CLOSED';
export interface ExternalTestRequestTable {
  test_request_id: string;
  project_id: string;
  owner_player_id: string;
  creation_request_id: string;
  prompt: string;
  state: ExternalTestRequestState;
  created_at: Generated<Date>;
  completed_at: Date | null;
}

export type ExternalTestOutcome = 'PASS' | 'ISSUE_FOUND' | 'BLOCKED';
export interface ExternalTestResultTable {
  test_result_id: string;
  test_request_id: string;
  project_id: string;
  tester_player_id: string;
  creation_request_id: string;
  outcome: ExternalTestOutcome;
  summary: string;
  observed_at: Generated<Date>;
}

export interface GitHubSetupStateTable {""")
replace_once(db, "  project_discussion_settings: ProjectDiscussionSettingTable;\n  github_setup_states:", "  project_discussion_settings: ProjectDiscussionSettingTable;\n  player_blocks: PlayerBlockTable;\n  content_reports: ContentReportTable;\n  moderation_operators: ModerationOperatorTable;\n  external_test_requests: ExternalTestRequestTable;\n  external_test_results: ExternalTestResultTable;\n  github_setup_states:")

# Migration 012.
Path('apps/inkubator-api/src/migrations/012-phase5-tester-moderation.ts').write_text("""import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase5TesterModerationMigration: Migration = {
  async up(db) {
    await db.schema.createTable('player_blocks')
      .addColumn('blocker_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('blocked_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('created_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('player_blocks_pk',['blocker_player_id','blocked_player_id'])
      .addCheckConstraint('player_blocks_not_self',sql`blocker_player_id <> blocked_player_id`).execute();

    await db.schema.createTable('content_reports')
      .addColumn('report_id','uuid',(c)=>c.primaryKey())
      .addColumn('reporter_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('comment_id','uuid',(c)=>c.notNull().references('project_comments.comment_id').onDelete('cascade'))
      .addColumn('creation_request_id','uuid',(c)=>c.notNull().unique())
      .addColumn('reason','text',(c)=>c.notNull())
      .addColumn('detail','text')
      .addColumn('state','text',(c)=>c.notNull().defaultTo('OPEN'))
      .addColumn('created_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('content_reports_reason',sql`reason in ('SPAM','ABUSE','PRIVACY','OTHER')`)
      .addCheckConstraint('content_reports_detail_length',sql`detail is null or char_length(detail) between 1 and 500`)
      .addCheckConstraint('content_reports_state',sql`state = 'OPEN'`).execute();
    await db.schema.createIndex('content_reports_comment_idx').on('content_reports').column('comment_id').execute();

    await db.schema.createTable('moderation_operators')
      .addColumn('player_id','uuid',(c)=>c.primaryKey().references('players.player_id').onDelete('cascade'))
      .addColumn('scope','text',(c)=>c.notNull())
      .addColumn('granted_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('moderation_operators_scope',sql`scope = 'GLOBAL_MODERATION'`).execute();

    await db.schema.createTable('external_test_requests')
      .addColumn('test_request_id','uuid',(c)=>c.primaryKey())
      .addColumn('project_id','uuid',(c)=>c.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('owner_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id','uuid',(c)=>c.notNull().unique())
      .addColumn('prompt','text',(c)=>c.notNull())
      .addColumn('state','text',(c)=>c.notNull().defaultTo('OPEN'))
      .addColumn('created_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('completed_at','timestamptz')
      .addCheckConstraint('external_test_requests_prompt_length',sql`char_length(prompt) between 1 and 500`)
      .addCheckConstraint('external_test_requests_state',sql`state in ('OPEN','COMPLETED','CLOSED')`).execute();
    await sql`create unique index external_test_requests_one_open_per_project on external_test_requests(project_id) where state = 'OPEN'`.execute(db);

    await db.schema.createTable('external_test_results')
      .addColumn('test_result_id','uuid',(c)=>c.primaryKey())
      .addColumn('test_request_id','uuid',(c)=>c.notNull().unique().references('external_test_requests.test_request_id').onDelete('cascade'))
      .addColumn('project_id','uuid',(c)=>c.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('tester_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id','uuid',(c)=>c.notNull().unique())
      .addColumn('outcome','text',(c)=>c.notNull())
      .addColumn('summary','text',(c)=>c.notNull())
      .addColumn('observed_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('external_test_results_outcome',sql`outcome in ('PASS','ISSUE_FOUND','BLOCKED')`)
      .addCheckConstraint('external_test_results_summary_length',sql`char_length(summary) between 1 and 500`).execute();
  },
  async down(db) {
    await db.schema.dropTable('external_test_results').execute();
    await sql`drop index if exists external_test_requests_one_open_per_project`.execute(db);
    await db.schema.dropTable('external_test_requests').execute();
    await db.schema.dropTable('moderation_operators').execute();
    await db.schema.dropTable('content_reports').execute();
    await db.schema.dropTable('player_blocks').execute();
  },
};
""")

migrations='apps/inkubator-api/src/migrations.ts'
replace_once(migrations, "import {phase5ProjectDiscussionWorldMigration} from './migrations/011-phase5-project-discussion-world.js';", "import {phase5ProjectDiscussionWorldMigration} from './migrations/011-phase5-project-discussion-world.js';\nimport {phase5TesterModerationMigration} from './migrations/012-phase5-tester-moderation.js';")
replace_once(migrations, "      '011_phase5_project_discussion_world': phase5ProjectDiscussionWorldMigration,", "      '011_phase5_project_discussion_world': phase5ProjectDiscussionWorldMigration,\n      '012_phase5_tester_moderation': phase5TesterModerationMigration,")

social='apps/inkubator-api/src/social.ts'
# Block checks on follow, assist, comment, reaction.
replace_once(social, "    if (!target) throw new Error('player_not_found');\n    const inserted = await tx.insertInto('player_follows')", "    if (!target) throw new Error('player_not_found');\n    if (await interactionBlocked(tx, actorId, targetId)) throw new Error('social_interaction_blocked');\n    const inserted = await tx.insertInto('player_follows')")
replace_once(social, "    if (beacon.owner_player_id === actorId) throw new Error('assist_self_forbidden');\n    const existing =", "    if (beacon.owner_player_id === actorId) throw new Error('assist_self_forbidden');\n    if (await interactionBlocked(tx, actorId, beacon.owner_player_id)) throw new Error('social_interaction_blocked');\n    const existing =")
replace_once(social, "    const project = await tx.selectFrom('projects').select('project_id').where('project_id', '=', projectId).forUpdate().executeTakeFirst();\n    if (!project) throw new Error('project_not_found');\n    if (await discussionLocked", "    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).forUpdate().executeTakeFirst();\n    if (!project) throw new Error('project_not_found');\n    if (await interactionBlocked(tx, actorId, project.owner_player_id)) throw new Error('social_interaction_blocked');\n    if (await discussionLocked")
replace_once(social, "    const comment = await tx.selectFrom('project_comments').select(['comment_id', 'project_id', 'state']).where('comment_id', '=', commentId).executeTakeFirst();\n    if (!comment) throw new Error('comment_not_found');\n    if (comment.state !== 'ACTIVE') throw new Error('comment_not_active');", "    const comment = await tx.selectFrom('project_comments').select(['comment_id', 'project_id', 'author_player_id', 'state']).where('comment_id', '=', commentId).executeTakeFirst();\n    if (!comment) throw new Error('comment_not_found');\n    if (comment.state !== 'ACTIVE') throw new Error('comment_not_active');\n    if (await interactionBlocked(tx, actorId, comment.author_player_id)) throw new Error('social_interaction_blocked');")

# Widen World signal projection to external test observations.
replace_once(social, ".where('event_type', 'in', ['project.help_beacon.opened', 'project.assist.accepted'])", ".where('event_type', 'in', ['project.help_beacon.opened', 'project.assist.accepted', 'project.external_test.observed'])")
replace_once(social, "    kind: 'HELP_BEACON_OPENED' | 'ASSIST_ACCEPTED';", "    kind: 'HELP_BEACON_OPENED' | 'ASSIST_ACCEPTED' | 'EXTERNAL_TEST_RECORDED';")
replace_once(social, "    } else if (event.event_type === 'project.assist.accepted') {\n      signals.push({schema_version: 'world.signal.public.v1', signal_id: event.history_event_id, kind: 'ASSIST_ACCEPTED', project_id: event.subject_id, project_name: projectName, truth_state: 'OBSERVED', occurred_at: event.occurred_at.toISOString()});\n    }", "    } else if (event.event_type === 'project.assist.accepted') {\n      signals.push({schema_version: 'world.signal.public.v1', signal_id: event.history_event_id, kind: 'ASSIST_ACCEPTED', project_id: event.subject_id, project_name: projectName, truth_state: 'OBSERVED', occurred_at: event.occurred_at.toISOString()});\n    } else if (event.event_type === 'project.external_test.observed') {\n      signals.push({schema_version: 'world.signal.public.v1', signal_id: event.history_event_id, kind: 'EXTERNAL_TEST_RECORDED', project_id: event.subject_id, project_name: projectName, truth_state: 'OBSERVED', occurred_at: event.occurred_at.toISOString()});\n    }")

# Insert block helper before discussion helper.
replace_once(social, "async function discussionLocked(db: Kysely<DatabaseSchema>, projectId: string): Promise<boolean> {", """async function interactionBlocked(db: Kysely<DatabaseSchema>, leftPlayerId: string, rightPlayerId: string): Promise<boolean> {
  if (leftPlayerId === rightPlayerId) return false;
  const direct = await db.selectFrom('player_blocks').select('blocker_player_id').where('blocker_player_id', '=', leftPlayerId).where('blocked_player_id', '=', rightPlayerId).executeTakeFirst();
  if (direct) return true;
  const reverse = await db.selectFrom('player_blocks').select('blocker_player_id').where('blocker_player_id', '=', rightPlayerId).where('blocked_player_id', '=', leftPlayerId).executeTakeFirst();
  return Boolean(reverse);
}

async function discussionLocked(db: Kysely<DatabaseSchema>, projectId: string): Promise<boolean> {""")

with Path(social).open('a') as f:
    f.write(r'''

export async function blockPlayer(db: Kysely<DatabaseSchema>, actorIdInput: string, targetIdInput: string, requestIdInput: string) {
  const actorId=uuid(actorIdInput,'player_id'), targetId=uuid(targetIdInput,'player_id'), requestId=uuid(requestIdInput,'request_id');
  if (actorId===targetId) throw new Error('block_self_forbidden');
  return db.transaction().execute(async(tx)=>{
    const target=await tx.selectFrom('players').select('player_id').where('player_id','=',targetId).executeTakeFirst(); if(!target) throw new Error('player_not_found');
    const inserted=await tx.insertInto('player_blocks').values({blocker_player_id:actorId,blocked_player_id:targetId}).onConflict((c)=>c.columns(['blocker_player_id','blocked_player_id']).doNothing()).returning('blocked_player_id').executeTakeFirst();
    await tx.deleteFrom('player_follows').where((eb)=>eb.or([eb.and([eb('follower_player_id','=',actorId),eb('followed_player_id','=',targetId)]),eb.and([eb('follower_player_id','=',targetId),eb('followed_player_id','=',actorId)])])).execute();
    if(inserted) await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'player.blocked',dedupeKey:`activity:player.blocked:${actorId}:${targetId}`,actorPlayerId:actorId,subjectType:'player',subjectId:targetId,payload:{schema_version:'player.blocked.v1',blocker_player_id:actorId,blocked_player_id:targetId}});
    return {schema_version:'player.block.v1' as const,blocker_player_id:actorId,blocked_player_id:targetId,active:true};
  });
}

export async function unblockPlayer(db: Kysely<DatabaseSchema>, actorIdInput:string,targetIdInput:string,requestIdInput:string){
  const actorId=uuid(actorIdInput,'player_id'),targetId=uuid(targetIdInput,'player_id'),requestId=uuid(requestIdInput,'request_id');
  if(actorId===targetId) throw new Error('block_self_forbidden');
  return db.transaction().execute(async(tx)=>{
    const removed=await tx.deleteFrom('player_blocks').where('blocker_player_id','=',actorId).where('blocked_player_id','=',targetId).returning('blocked_player_id').executeTakeFirst();
    if(removed) await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'player.unblocked',dedupeKey:`activity:player.unblocked:${actorId}:${targetId}:${requestId}`,actorPlayerId:actorId,subjectType:'player',subjectId:targetId,payload:{schema_version:'player.unblocked.v1',blocker_player_id:actorId,blocked_player_id:targetId}});
    return {schema_version:'player.block.v1' as const,blocker_player_id:actorId,blocked_player_id:targetId,active:false};
  });
}

export async function reportProjectComment(db: Kysely<DatabaseSchema>,actorIdInput:string,commentIdInput:string,input:{requestId:string;reason:string;detail?:string|null}){
  const actorId=uuid(actorIdInput,'player_id'),commentId=uuid(commentIdInput,'comment_id'),requestId=uuid(input.requestId,'request_id');
  const reasons=new Set(['SPAM','ABUSE','PRIVACY','OTHER']); if(!reasons.has(input.reason)) throw new Error('invalid_report_reason');
  const detail=input.detail==null?null:text(input.detail,'report_detail',500);
  return db.transaction().execute(async(tx)=>{
    const replay=await tx.selectFrom('content_reports').selectAll().where('creation_request_id','=',requestId).executeTakeFirst();
    if(replay){if(replay.reporter_player_id!==actorId||replay.comment_id!==commentId||replay.reason!==input.reason||replay.detail!==detail) throw new Error('report_idempotency_conflict'); return {schema_version:'content.report.private.v1' as const,report_id:replay.report_id,comment_id:commentId,reason:replay.reason,state:replay.state};}
    const comment=await tx.selectFrom('project_comments').select(['comment_id','project_id']).where('comment_id','=',commentId).executeTakeFirst(); if(!comment) throw new Error('comment_not_found');
    const row=await tx.insertInto('content_reports').values({report_id:randomUUID(),reporter_player_id:actorId,comment_id:commentId,creation_request_id:requestId,reason:input.reason as 'SPAM'|'ABUSE'|'PRIVACY'|'OTHER',detail,state:'OPEN'}).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'project.comment.reported',dedupeKey:`activity:project.comment.reported:${row.report_id}`,actorPlayerId:actorId,subjectType:'project',subjectId:comment.project_id,payload:{schema_version:'project.comment.reported.v1',report_id:row.report_id,comment_id:commentId,project_id:comment.project_id,reason:row.reason}});
    return {schema_version:'content.report.private.v1' as const,report_id:row.report_id,comment_id:commentId,reason:row.reason,state:row.state};
  });
}

export async function removeProjectCommentAsOperator(db: Kysely<DatabaseSchema>,actorIdInput:string,commentIdInput:string,input:{requestId:string;reason:string}){
  const actorId=uuid(actorIdInput,'player_id'),commentId=uuid(commentIdInput,'comment_id'),requestId=uuid(input.requestId,'request_id'),reason=text(input.reason,'moderation_reason',240);
  return db.transaction().execute(async(tx)=>{
    const operator=await tx.selectFrom('moderation_operators').select('scope').where('player_id','=',actorId).executeTakeFirst(); if(operator?.scope!=='GLOBAL_MODERATION') throw new Error('moderation_operator_required');
    const comment=await tx.selectFrom('project_comments').selectAll().where('comment_id','=',commentId).forUpdate().executeTakeFirst(); if(!comment) throw new Error('comment_not_found');
    if(comment.state!=='REMOVED'){
      await tx.updateTable('project_comments').set({state:'REMOVED',deleted_at:sql`clock_timestamp()`,updated_at:sql`clock_timestamp()`}).where('comment_id','=',commentId).execute();
      await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'ops.project_comment.removed',dedupeKey:`activity:ops.project_comment.removed:${commentId}`,actorPlayerId:actorId,subjectType:'project',subjectId:comment.project_id,payload:{schema_version:'ops.project_comment.removed.v1',comment_id:commentId,project_id:comment.project_id,reason,truth_state:'OBSERVED'}});
    }
    return {schema_version:'ops.project_comment.remove.v1' as const,comment_id:commentId,state:'REMOVED' as const};
  });
}

function testRequestView(row:{test_request_id:string;project_id:string;prompt:string;state:'OPEN'|'COMPLETED'|'CLOSED'}){return {schema_version:'external_test.request.public.v1' as const,test_request_id:row.test_request_id,project_id:row.project_id,prompt:row.prompt,state:row.state};}
function testResultView(row:{test_result_id:string;test_request_id:string;project_id:string;tester_player_id:string;outcome:'PASS'|'ISSUE_FOUND'|'BLOCKED';summary:string;observed_at:Date},displayName:string){return {schema_version:'external_test.result.public.v1' as const,test_result_id:row.test_result_id,test_request_id:row.test_request_id,project_id:row.project_id,tester:{player_id:row.tester_player_id,display_name:displayName},outcome:row.outcome,summary:row.summary,observed_at:row.observed_at.toISOString()};}

export async function createExternalTestRequest(db:Kysely<DatabaseSchema>,actorIdInput:string,projectIdInput:string,input:{requestId:string;prompt:string}){
  const actorId=uuid(actorIdInput,'player_id'),projectId=uuid(projectIdInput,'project_id'),requestId=uuid(input.requestId,'request_id'),prompt=text(input.prompt,'external_test_prompt',500);
  return db.transaction().execute(async(tx)=>{
    const replay=await tx.selectFrom('external_test_requests').selectAll().where('creation_request_id','=',requestId).executeTakeFirst(); if(replay){if(replay.project_id!==projectId||replay.owner_player_id!==actorId||replay.prompt!==prompt) throw new Error('external_test_request_idempotency_conflict'); return testRequestView(replay);}
    const project=await tx.selectFrom('projects').select(['project_id','owner_player_id']).where('project_id','=',projectId).forUpdate().executeTakeFirst(); if(!project) throw new Error('project_not_found'); if(project.owner_player_id!==actorId) throw new Error('authorization_denied');
    const open=await tx.selectFrom('external_test_requests').select('test_request_id').where('project_id','=',projectId).where('state','=','OPEN').executeTakeFirst(); if(open) throw new Error('external_test_request_already_open');
    const row=await tx.insertInto('external_test_requests').values({test_request_id:randomUUID(),project_id:projectId,owner_player_id:actorId,creation_request_id:requestId,prompt,state:'OPEN',completed_at:null}).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'project.external_test.requested',dedupeKey:`activity:project.external_test.requested:${row.test_request_id}`,actorPlayerId:actorId,subjectType:'project',subjectId:projectId,payload:{schema_version:'project.external_test.requested.v1',test_request_id:row.test_request_id,project_id:projectId,truth_state:'CLAIMED'}});
    return testRequestView(row);
  });
}

export async function recordExternalTestResult(db:Kysely<DatabaseSchema>,actorIdInput:string,testRequestIdInput:string,input:{requestId:string;outcome:string;summary:string}){
  const actorId=uuid(actorIdInput,'player_id'),testRequestId=uuid(testRequestIdInput,'test_request_id'),requestId=uuid(input.requestId,'request_id'),summary=text(input.summary,'external_test_summary',500);
  const outcomes=new Set(['PASS','ISSUE_FOUND','BLOCKED']); if(!outcomes.has(input.outcome)) throw new Error('invalid_external_test_outcome');
  return db.transaction().execute(async(tx)=>{
    const replay=await tx.selectFrom('external_test_results').selectAll().where('creation_request_id','=',requestId).executeTakeFirst(); if(replay){if(replay.test_request_id!==testRequestId||replay.tester_player_id!==actorId||replay.outcome!==input.outcome||replay.summary!==summary) throw new Error('external_test_result_idempotency_conflict'); const tester=await tx.selectFrom('players').select('display_name').where('player_id','=',actorId).executeTakeFirstOrThrow(); return testResultView(replay,tester.display_name);}
    const request=await tx.selectFrom('external_test_requests').selectAll().where('test_request_id','=',testRequestId).forUpdate().executeTakeFirst(); if(!request) throw new Error('external_test_request_not_found'); if(request.owner_player_id===actorId) throw new Error('external_test_self_forbidden'); if(request.state!=='OPEN') throw new Error('external_test_request_not_open');
    if(await interactionBlocked(tx,actorId,request.owner_player_id)) throw new Error('social_interaction_blocked');
    const row=await tx.insertInto('external_test_results').values({test_result_id:randomUUID(),test_request_id:testRequestId,project_id:request.project_id,tester_player_id:actorId,creation_request_id:requestId,outcome:input.outcome as 'PASS'|'ISSUE_FOUND'|'BLOCKED',summary}).returningAll().executeTakeFirstOrThrow();
    await tx.updateTable('external_test_requests').set({state:'COMPLETED',completed_at:sql`clock_timestamp()`}).where('test_request_id','=',testRequestId).execute();
    await appendHistoryEvent(tx,{eventFamily:'evidence',eventType:'project.external_test.observed',dedupeKey:`evidence:project.external_test.observed:${row.test_result_id}`,actorPlayerId:actorId,subjectType:'project',subjectId:request.project_id,payload:{schema_version:'project.external_test.observed.v1',test_result_id:row.test_result_id,test_request_id:testRequestId,project_id:request.project_id,tester_player_id:actorId,outcome:row.outcome,truth_state:'OBSERVED'}});
    const tester=await tx.selectFrom('players').select('display_name').where('player_id','=',actorId).executeTakeFirstOrThrow(); return testResultView(row,tester.display_name);
  });
}

export async function getProjectExternalTests(db:Kysely<DatabaseSchema>,projectIdInput:string){
  const projectId=uuid(projectIdInput,'project_id'); const project=await db.selectFrom('projects').select('project_id').where('project_id','=',projectId).executeTakeFirst(); if(!project) throw new Error('project_not_found');
  const requests=await db.selectFrom('external_test_requests').selectAll().where('project_id','=',projectId).orderBy('created_at','asc').execute();
  const results=await db.selectFrom('external_test_results as result').innerJoin('players as tester','tester.player_id','result.tester_player_id').select(['result.test_result_id','result.test_request_id','result.project_id','result.tester_player_id','result.outcome','result.summary','result.observed_at','tester.display_name']).where('result.project_id','=',projectId).orderBy('result.observed_at','asc').execute();
  return {schema_version:'project.external_tests.public.v1' as const,project_id:projectId,requests:requests.map(testRequestView),results:results.map((r)=>testResultView(r,r.display_name))};
}
''')

# App wiring.
app='apps/inkubator-api/src/app.ts'
replace_once(app, "import {acceptAssist, createHelpBeacon, createProjectComment, deleteOwnProjectComment, followPlayer, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, listProjectComments, listWorldSignals, offerAssist, reactUsefulToComment, setProjectDiscussionLock, watchProject} from './social.js';", "import {acceptAssist, blockPlayer, createExternalTestRequest, createHelpBeacon, createProjectComment, deleteOwnProjectComment, followPlayer, getProjectExternalTests, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, listProjectComments, listWorldSignals, offerAssist, reactUsefulToComment, recordExternalTestResult, removeProjectCommentAsOperator, reportProjectComment, setProjectDiscussionLock, unblockPlayer, watchProject} from './social.js';")
replace_once(app, "  if (message === 'authorization_denied' || message.endsWith('_self_forbidden')) return error(reply, 403, message);", "  if (message === 'authorization_denied' || message.endsWith('_self_forbidden') || message === 'social_interaction_blocked' || message === 'moderation_operator_required') return error(reply, 403, message);")
replace_once(app, "message === 'parent_comment_project_mismatch') return error(reply, 409, message);", "message === 'parent_comment_project_mismatch' || message === 'external_test_request_not_open') return error(reply, 409, message);")
route_anchor="  app.get('/v1/rounds', async (request, reply) => {"
routes=r'''  app.post('/v1/players/:playerId/block', {schema:{body:fastifyBodySchema('SocialMutationRequest')}}, async(request,reply)=>{const authenticated=await authenticate(request,options.db);if(!authenticated)return error(reply,401,'authentication_required');const {playerId}=request.params as {playerId:string};const body=request.body as {request_id:string};try{return await blockPlayer(options.db,authenticated.actor.playerId,playerId,body.request_id);}catch(cause){return phase5Error(reply,cause);}});
  app.delete('/v1/players/:playerId/block', {schema:{body:fastifyBodySchema('SocialMutationRequest')}}, async(request,reply)=>{const authenticated=await authenticate(request,options.db);if(!authenticated)return error(reply,401,'authentication_required');const {playerId}=request.params as {playerId:string};const body=request.body as {request_id:string};try{return await unblockPlayer(options.db,authenticated.actor.playerId,playerId,body.request_id);}catch(cause){return phase5Error(reply,cause);}});
  app.post('/v1/comments/:commentId/report', {schema:{body:fastifyBodySchema('ContentReportCreateRequest')}}, async(request,reply)=>{const authenticated=await authenticate(request,options.db);if(!authenticated)return error(reply,401,'authentication_required');const {commentId}=request.params as {commentId:string};const body=request.body as {request_id:string;reason:string;detail?:string|null};try{return reply.code(201).send(await reportProjectComment(options.db,authenticated.actor.playerId,commentId,{requestId:body.request_id,reason:body.reason,detail:body.detail}));}catch(cause){return phase5Error(reply,cause);}});
  app.delete('/v1/ops/comments/:commentId', {schema:{body:fastifyBodySchema('OperatorCommentRemoveRequest')}}, async(request,reply)=>{const authenticated=await authenticate(request,options.db);if(!authenticated)return error(reply,401,'authentication_required');const {commentId}=request.params as {commentId:string};const body=request.body as {request_id:string;reason:string};try{return await removeProjectCommentAsOperator(options.db,authenticated.actor.playerId,commentId,{requestId:body.request_id,reason:body.reason});}catch(cause){return phase5Error(reply,cause);}});
  app.post('/v1/projects/:projectId/tester-requests', {schema:{body:fastifyBodySchema('ExternalTestRequestCreateRequest')}}, async(request,reply)=>{const authenticated=await authenticate(request,options.db);if(!authenticated)return error(reply,401,'authentication_required');const {projectId}=request.params as {projectId:string};const body=request.body as {request_id:string;prompt:string};try{return reply.code(201).send(await createExternalTestRequest(options.db,authenticated.actor.playerId,projectId,{requestId:body.request_id,prompt:body.prompt}));}catch(cause){return phase5Error(reply,cause);}});
  app.post('/v1/tester-requests/:testRequestId/results', {schema:{body:fastifyBodySchema('ExternalTestResultCreateRequest')}}, async(request,reply)=>{const authenticated=await authenticate(request,options.db);if(!authenticated)return error(reply,401,'authentication_required');const {testRequestId}=request.params as {testRequestId:string};const body=request.body as {request_id:string;outcome:string;summary:string};try{return reply.code(201).send(await recordExternalTestResult(options.db,authenticated.actor.playerId,testRequestId,{requestId:body.request_id,outcome:body.outcome,summary:body.summary}));}catch(cause){return phase5Error(reply,cause);}});
  app.get('/v1/projects/:projectId/external-tests', async(request,reply)=>{const {projectId}=request.params as {projectId:string};try{return await getProjectExternalTests(options.db,projectId);}catch(cause){return phase5Error(reply,cause);}});

'''
replace_once(app,route_anchor,routes+route_anchor)

# Contract schemas + World kind + paths.
contract='apps/inkubator-api/src/contract.ts'
replace_once(contract, "kind: {type: 'string', enum: ['HELP_BEACON_OPENED', 'ASSIST_ACCEPTED']}", "kind: {type: 'string', enum: ['HELP_BEACON_OPENED', 'ASSIST_ACCEPTED', 'EXTERNAL_TEST_RECORDED']}")
schema_anchor="  RoundView: {"
schemas=r'''  PlayerBlockView:{type:'object',additionalProperties:false,required:['schema_version','blocker_player_id','blocked_player_id','active'],properties:{schema_version:{type:'string',const:'player.block.v1'},blocker_player_id:{$ref:'#/components/schemas/PlayerId'},blocked_player_id:{$ref:'#/components/schemas/PlayerId'},active:{type:'boolean'}}},
  ContentReportCreateRequest:{type:'object',additionalProperties:false,required:['request_id','reason'],properties:{request_id:{$ref:'#/components/schemas/RequestId'},reason:{type:'string',enum:['SPAM','ABUSE','PRIVACY','OTHER']},detail:{type:['string','null'],maxLength:500}}},
  ContentReportView:{type:'object',additionalProperties:false,required:['schema_version','report_id','comment_id','reason','state'],properties:{schema_version:{type:'string',const:'content.report.private.v1'},report_id:{type:'string',format:'uuid'},comment_id:{type:'string',format:'uuid'},reason:{type:'string',enum:['SPAM','ABUSE','PRIVACY','OTHER']},state:{type:'string',const:'OPEN'}}},
  OperatorCommentRemoveRequest:{type:'object',additionalProperties:false,required:['request_id','reason'],properties:{request_id:{$ref:'#/components/schemas/RequestId'},reason:{type:'string',minLength:1,maxLength:240}}},
  OperatorCommentRemoveView:{type:'object',additionalProperties:false,required:['schema_version','comment_id','state'],properties:{schema_version:{type:'string',const:'ops.project_comment.remove.v1'},comment_id:{type:'string',format:'uuid'},state:{type:'string',const:'REMOVED'}}},
  ExternalTestRequestCreateRequest:{type:'object',additionalProperties:false,required:['request_id','prompt'],properties:{request_id:{$ref:'#/components/schemas/RequestId'},prompt:{type:'string',minLength:1,maxLength:500}}},
  ExternalTestRequestView:{type:'object',additionalProperties:false,required:['schema_version','test_request_id','project_id','prompt','state'],properties:{schema_version:{type:'string',const:'external_test.request.public.v1'},test_request_id:{type:'string',format:'uuid'},project_id:{$ref:'#/components/schemas/ProjectId'},prompt:{type:'string'},state:{type:'string',enum:['OPEN','COMPLETED','CLOSED']}}},
  ExternalTestResultCreateRequest:{type:'object',additionalProperties:false,required:['request_id','outcome','summary'],properties:{request_id:{$ref:'#/components/schemas/RequestId'},outcome:{type:'string',enum:['PASS','ISSUE_FOUND','BLOCKED']},summary:{type:'string',minLength:1,maxLength:500}}},
  ExternalTestResultView:{type:'object',additionalProperties:false,required:['schema_version','test_result_id','test_request_id','project_id','tester','outcome','summary','observed_at'],properties:{schema_version:{type:'string',const:'external_test.result.public.v1'},test_result_id:{type:'string',format:'uuid'},test_request_id:{type:'string',format:'uuid'},project_id:{$ref:'#/components/schemas/ProjectId'},tester:{$ref:'#/components/schemas/ProjectCommentAuthorView'},outcome:{type:'string',enum:['PASS','ISSUE_FOUND','BLOCKED']},summary:{type:'string'},observed_at:{type:'string',format:'date-time'}}},
  ProjectExternalTestsView:{type:'object',additionalProperties:false,required:['schema_version','project_id','requests','results'],properties:{schema_version:{type:'string',const:'project.external_tests.public.v1'},project_id:{$ref:'#/components/schemas/ProjectId'},requests:{type:'array',items:{$ref:'#/components/schemas/ExternalTestRequestView'}},results:{type:'array',items:{$ref:'#/components/schemas/ExternalTestResultView'}}}},
'''
replace_once(contract,schema_anchor,schemas+schema_anchor)
path_anchor="    '/v1/rounds': {"
paths=r'''    '/v1/players/{playerId}/block':{post:{operationId:'blockPlayer',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('SocialMutationRequest')}}},responses:{'200':{description:'Block social interaction',content:{'application/json':{schema:ref('PlayerBlockView')}}},'403':errorResponse('Self block denied'),'404':errorResponse('Player not found')}},delete:{operationId:'unblockPlayer',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('SocialMutationRequest')}}},responses:{'200':{description:'Remove block',content:{'application/json':{schema:ref('PlayerBlockView')}}}}}},
    '/v1/comments/{commentId}/report':{post:{operationId:'reportProjectComment',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('ContentReportCreateRequest')}}},responses:{'201':{description:'Private moderation report receipt',content:{'application/json':{schema:ref('ContentReportView')}}},'404':errorResponse('Comment not found')}}},
    '/v1/ops/comments/{commentId}':{delete:{operationId:'removeProjectCommentAsOperator',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('OperatorCommentRemoveRequest')}}},responses:{'200':{description:'Operator soft removal',content:{'application/json':{schema:ref('OperatorCommentRemoveView')}}},'403':errorResponse('Moderation operator required'),'404':errorResponse('Comment not found')}}},
    '/v1/projects/{projectId}/tester-requests':{post:{operationId:'createExternalTestRequest',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('ExternalTestRequestCreateRequest')}}},responses:{'201':{description:'Project owner requests external test',content:{'application/json':{schema:ref('ExternalTestRequestView')}}},'403':errorResponse('Project owner only'),'409':errorResponse('Open tester request already exists')}}},
    '/v1/tester-requests/{testRequestId}/results':{post:{operationId:'recordExternalTestResult',security:[{sessionCookie:[]}],requestBody:{required:true,content:{'application/json':{schema:ref('ExternalTestResultCreateRequest')}}},responses:{'201':{description:'Bounded external human observation',content:{'application/json':{schema:ref('ExternalTestResultView')}}},'403':errorResponse('Owner/self/block denied'),'409':errorResponse('Tester request unavailable')}}},
    '/v1/projects/{projectId}/external-tests':{get:{operationId:'getProjectExternalTests',responses:{'200':{description:'Public bounded tester state',content:{'application/json':{schema:ref('ProjectExternalTestsView')}}},'404':errorResponse('Project not found')}}},
'''
replace_once(contract,path_anchor,paths+path_anchor)

# Focused integration test.
Path('apps/inkubator-api/test/integration/phase5-tester-moderation.test.mjs').write_text(r'''import {randomUUID} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';import {buildApp} from '../../dist/app.js';import {createDatabase} from '../../dist/database.js';import {migrateToLatest} from '../../dist/migrations.js';
const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('DATABASE_URL is required');const appOrigin=process.env.INKUBATOR_APP_ORIGIN??'http://127.0.0.1:4175';
function cookie(r){const v=Array.isArray(r.headers['set-cookie'])?r.headers['set-cookie'][0]:r.headers['set-cookie'];assert.ok(v);return v.split(';')[0];}async function session(app,name){const r=await app.inject({method:'POST',url:'/v1/dev/session',headers:{origin:appOrigin},payload:{display_name:name}});assert.equal(r.statusCode,201);return{cookie:cookie(r),playerId:r.json().player.player_id};}async function makeProject(app,c){const rounds=await app.inject({method:'GET',url:'/v1/rounds',headers:{cookie:c}});const round=rounds.json().find(r=>r.code==='ROUND_01');await app.inject({method:'POST',url:`/v1/rounds/${round.round_id}/join`,headers:{origin:appOrigin,cookie:c}});const r=await app.inject({method:'POST',url:'/v1/missions',headers:{origin:appOrigin,cookie:c},payload:{request_id:randomUUID(),round_id:round.round_id,project_name:'Tester Moderation',goal:'Get external human evidence safely',ship_condition:'Tester observation recorded',current_focus:'Need tester',next_move:'Request test'}});assert.equal(r.statusCode,201);return{projectId:r.json().project.project_id,missionId:r.json().mission.mission_id};}

test('Phase 5 tester/moderation is deny-by-default, idempotent and never mints PROVEN',async()=>{const db=createDatabase(databaseUrl);await migrateToLatest(db);const app=buildApp({db,appOrigin,allowDevAuth:true,sessionTtlSeconds:3600,github:null});try{const alice=await session(app,`Alice T ${randomUUID().slice(0,5)}`),bob=await session(app,`Bob T ${randomUUID().slice(0,5)}`),carol=await session(app,`Carol T ${randomUUID().slice(0,5)}`),mod=await session(app,`Mod T ${randomUUID().slice(0,5)}`);const ah={origin:appOrigin,cookie:alice.cookie},bh={origin:appOrigin,cookie:bob.cookie},ch={origin:appOrigin,cookie:carol.cookie},mh={origin:appOrigin,cookie:mod.cookie};const {projectId,missionId}=await makeProject(app,alice.cookie);
const comment=await app.inject({method:'POST',url:`/v1/projects/${projectId}/comments`,headers:bh,payload:{request_id:randomUUID(),body:'This looks suspicious but useful.'}});assert.equal(comment.statusCode,201);const commentId=comment.json().comment_id;
const reportReq=randomUUID();const report=await app.inject({method:'POST',url:`/v1/comments/${commentId}/report`,headers:ch,payload:{request_id:reportReq,reason:'ABUSE',detail:'Needs moderator review'}});assert.equal(report.statusCode,201);assert.equal((await app.inject({method:'POST',url:`/v1/comments/${commentId}/report`,headers:ch,payload:{request_id:reportReq,reason:'ABUSE',detail:'Needs moderator review'}})).json().report_id,report.json().report_id);assert.equal((await db.selectFrom('content_reports').selectAll().where('comment_id','=',commentId).execute()).length,1);
const ownerRemove=await app.inject({method:'DELETE',url:`/v1/ops/comments/${commentId}`,headers:ah,payload:{request_id:randomUUID(),reason:'owner is not operator'}});assert.equal(ownerRemove.statusCode,403);await db.insertInto('moderation_operators').values({player_id:mod.playerId,scope:'GLOBAL_MODERATION'}).execute();const removed=await app.inject({method:'DELETE',url:`/v1/ops/comments/${commentId}`,headers:mh,payload:{request_id:randomUUID(),reason:'confirmed moderation removal'}});assert.equal(removed.statusCode,200);assert.equal(removed.json().state,'REMOVED');const comments=await app.inject({method:'GET',url:`/v1/projects/${projectId}/comments`});const removedView=comments.json().comments.find(c=>c.comment_id===commentId);assert.equal(removedView.state,'REMOVED');assert.equal('body'in removedView,false);
assert.equal((await app.inject({method:'POST',url:`/v1/players/${bob.playerId}/block`,headers:ah,payload:{request_id:randomUUID()}})).statusCode,200);const blockedFollow=await app.inject({method:'POST',url:`/v1/players/${alice.playerId}/follow`,headers:bh,payload:{request_id:randomUUID()}});assert.equal(blockedFollow.statusCode,403);assert.equal(blockedFollow.json().error,'social_interaction_blocked');const blockedComment=await app.inject({method:'POST',url:`/v1/projects/${projectId}/comments`,headers:bh,payload:{request_id:randomUUID(),body:'Blocked'}});assert.equal(blockedComment.statusCode,403);
const testReq=await app.inject({method:'POST',url:`/v1/projects/${projectId}/tester-requests`,headers:ah,payload:{request_id:randomUUID(),prompt:'Try onboarding on mobile and report the first failure.'}});assert.equal(testReq.statusCode,201);const testRequestId=testReq.json().test_request_id;const self=await app.inject({method:'POST',url:`/v1/tester-requests/${testRequestId}/results`,headers:ah,payload:{request_id:randomUUID(),outcome:'PASS',summary:'Self test'}});assert.equal(self.statusCode,403);const blockedTest=await app.inject({method:'POST',url:`/v1/tester-requests/${testRequestId}/results`,headers:bh,payload:{request_id:randomUUID(),outcome:'ISSUE_FOUND',summary:'Blocked tester should not write'}});assert.equal(blockedTest.statusCode,403);
assert.equal((await app.inject({method:'DELETE',url:`/v1/players/${bob.playerId}/block`,headers:ah,payload:{request_id:randomUUID()}})).statusCode,200);const resultReq=randomUUID();const result=await app.inject({method:'POST',url:`/v1/tester-requests/${testRequestId}/results`,headers:bh,payload:{request_id:resultReq,outcome:'ISSUE_FOUND',summary:'Primary CTA is hidden below the fold on mobile.'}});assert.equal(result.statusCode,201);const replay=await app.inject({method:'POST',url:`/v1/tester-requests/${testRequestId}/results`,headers:bh,payload:{request_id:resultReq,outcome:'ISSUE_FOUND',summary:'Primary CTA is hidden below the fold on mobile.'}});assert.equal(replay.statusCode,201);assert.equal(replay.json().test_result_id,result.json().test_result_id);assert.equal((await db.selectFrom('external_test_results').selectAll().where('test_request_id','=',testRequestId).execute()).length,1);
const evidence=await db.selectFrom('history_events').selectAll().where('event_type','=','project.external_test.observed').where('subject_id','=',projectId).execute();assert.equal(evidence.length,1);assert.equal(evidence[0].event_family,'evidence');assert.equal(evidence[0].payload.truth_state,'OBSERVED');assert.equal(evidence[0].payload.outcome,'ISSUE_FOUND');const state=await app.inject({method:'GET',url:`/v1/projects/${projectId}/external-tests`});assert.equal(state.statusCode,200);assert.equal(state.json().requests[0].state,'COMPLETED');assert.equal(state.json().results[0].tester.player_id,bob.playerId);
const world=await app.inject({method:'GET',url:'/v1/world/signals'});const signal=world.json().find(s=>s.project_id===projectId&&s.kind==='EXTERNAL_TEST_RECORDED');assert.ok(signal);assert.equal(signal.truth_state,'OBSERVED');assert.equal(JSON.stringify(world.json()).includes('Primary CTA is hidden below the fold'),false);
const opsEvents=await db.selectFrom('history_events').selectAll().where('event_type','=','ops.project_comment.removed').where('subject_id','=',projectId).execute();assert.equal(opsEvents.length,1);assert.equal(opsEvents[0].payload.truth_state,'OBSERVED');assert.equal(JSON.stringify(opsEvents).includes('This looks suspicious but useful.'),false);const gates=await db.selectFrom('mission_gates').selectAll().where('mission_id','=',missionId).execute();assert.equal(gates.every(g=>g.signal_state==='UNKNOWN'),true);const events=await db.selectFrom('history_events').selectAll().where('subject_id','=',projectId).execute();assert.equal(JSON.stringify(events).includes('PROVEN'),false);
}finally{await app.close();await db.destroy();}});
''')
print('Phase 5 tester/moderation slice applied')
