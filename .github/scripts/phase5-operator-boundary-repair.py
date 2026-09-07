from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


# The current authenticated principal is a Player. Phase 5 needs an operator-removal
# domain seam, not a newly invented Player->operator authority model. Keep the seam
# internal and remove the public HTTP capability/table until operator identity is
# canonically defined by a later authority.
db = 'apps/inkubator-api/src/database.ts'
replace_once(
    db,
    """export interface ModerationOperatorTable {
  player_id: string;
  scope: 'GLOBAL_MODERATION';
  granted_at: Generated<Date>;
}

""",
    '',
)
replace_once(db, '  moderation_operators: ModerationOperatorTable;\n', '')

migration = 'apps/inkubator-api/src/migrations/012-phase5-tester-moderation.ts'
replace_once(
    migration,
    """    await db.schema.createTable('moderation_operators')
      .addColumn('player_id','uuid',(c)=>c.primaryKey().references('players.player_id').onDelete('cascade'))
      .addColumn('scope','text',(c)=>c.notNull())
      .addColumn('granted_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('moderation_operators_scope',sql`scope = 'GLOBAL_MODERATION'`).execute();

""",
    '',
)
replace_once(migration, "    await db.schema.dropTable('moderation_operators').execute();\n", '')

social = 'apps/inkubator-api/src/social.ts'
old_operator = """export async function removeProjectCommentAsOperator(db: Kysely<DatabaseSchema>,actorIdInput:string,commentIdInput:string,input:{requestId:string;reason:string}){
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
"""
new_operator = """export async function operatorRemoveProjectComment(db: Kysely<DatabaseSchema>,commentIdInput:string,input:{requestId:string;reason:string}){
  const commentId=uuid(commentIdInput,'comment_id'),requestId=uuid(input.requestId,'request_id'),reason=text(input.reason,'moderation_reason',240);
  return db.transaction().execute(async(tx)=>{
    const comment=await tx.selectFrom('project_comments').selectAll().where('comment_id','=',commentId).forUpdate().executeTakeFirst(); if(!comment) throw new Error('comment_not_found');
    if(comment.state!=='REMOVED'){
      await tx.updateTable('project_comments').set({state:'REMOVED',deleted_at:sql`clock_timestamp()`,updated_at:sql`clock_timestamp()`}).where('comment_id','=',commentId).execute();
      await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'ops.project_comment.removed',dedupeKey:`activity:ops.project_comment.removed:${commentId}`,actorPlayerId:null,subjectType:'project',subjectId:comment.project_id,payload:{schema_version:'ops.project_comment.removed.v1',comment_id:commentId,project_id:comment.project_id,reason,request_id:requestId,truth_state:'OBSERVED'}});
    }
    return {schema_version:'ops.project_comment.remove.v1' as const,comment_id:commentId,state:'REMOVED' as const};
  });
}
"""
replace_once(social, old_operator, new_operator)

app = 'apps/inkubator-api/src/app.ts'
replace_once(app, 'removeProjectCommentAsOperator, ', '')
replace_once(app, " || message === 'moderation_operator_required'", '')
app_path = Path(app)
app_lines = app_path.read_text().splitlines(keepends=True)
removed_routes = [line for line in app_lines if line.lstrip().startswith("app.delete('/v1/ops/comments/:commentId'")]
if len(removed_routes) != 1:
    raise SystemExit(f'expected exactly one public operator route, found {len(removed_routes)}')
app_path.write_text(''.join(line for line in app_lines if line not in removed_routes))

contract = Path('apps/inkubator-api/src/contract.ts')
contract_lines = contract.read_text().splitlines(keepends=True)
for prefix in (
    'OperatorCommentRemoveRequest:',
    'OperatorCommentRemoveView:',
    "'/v1/ops/comments/{commentId}':",
):
    matching = [line for line in contract_lines if line.lstrip().startswith(prefix)]
    if len(matching) != 1:
        raise SystemExit(f'expected exactly one contract line for {prefix}, found {len(matching)}')
    contract_lines = [line for line in contract_lines if line not in matching]
contract.write_text(''.join(contract_lines))

# Focused falsification now exercises the operator-removal primitive directly and
# proves that no Player-facing operator endpoint exists.
test_path = Path('apps/inkubator-api/test/integration/phase5-tester-moderation.test.mjs')
test_text = test_path.read_text()
replace_import = "import {migrateToLatest} from '../../dist/migrations.js';"
if replace_import not in test_text:
    raise SystemExit('focused test import anchor missing')
test_text = test_text.replace(
    replace_import,
    replace_import + "import {operatorRemoveProjectComment} from '../../dist/social.js';",
    1,
)
test_text = test_text.replace(
    ",mod=await session(app,`Mod T ${randomUUID().slice(0,5)}`)",
    '',
    1,
).replace(
    ",mh={origin:appOrigin,cookie:mod.cookie}",
    '',
    1,
)
old_test = "const ownerRemove=await app.inject({method:'DELETE',url:`/v1/ops/comments/${commentId}`,headers:ah,payload:{request_id:randomUUID(),reason:'owner is not operator'}});assert.equal(ownerRemove.statusCode,403);await db.insertInto('moderation_operators').values({player_id:mod.playerId,scope:'GLOBAL_MODERATION'}).execute();const removed=await app.inject({method:'DELETE',url:`/v1/ops/comments/${commentId}`,headers:mh,payload:{request_id:randomUUID(),reason:'confirmed moderation removal'}});assert.equal(removed.statusCode,200);assert.equal(removed.json().state,'REMOVED');"
new_test = "const publicOps=await app.inject({method:'DELETE',url:`/v1/ops/comments/${commentId}`,headers:ah,payload:{request_id:randomUUID(),reason:'must not be public'}});assert.equal(publicOps.statusCode,404);const removed=await operatorRemoveProjectComment(db,commentId,{requestId:randomUUID(),reason:'confirmed moderation removal'});assert.equal(removed.state,'REMOVED');"
if old_test not in test_text:
    raise SystemExit('focused operator test anchor missing')
test_text = test_text.replace(old_test, new_test, 1)
if 'moderation_operators' in test_text or 'removeProjectCommentAsOperator' in test_text:
    raise SystemExit('stale operator authority remains in focused test')
test_path.write_text(test_text)

# Static tripwires: the domain seam may exist, but no Player/operator authority or
# public ops route may remain in the product surface.
checks = {
    'apps/inkubator-api/src/database.ts': ['ModerationOperatorTable', 'moderation_operators'],
    'apps/inkubator-api/src/migrations/012-phase5-tester-moderation.ts': ['moderation_operators', 'GLOBAL_MODERATION'],
    'apps/inkubator-api/src/app.ts': ["/v1/ops/comments", 'moderation_operator_required', 'removeProjectCommentAsOperator'],
    'apps/inkubator-api/src/contract.ts': ["/v1/ops/comments", 'OperatorCommentRemoveRequest', 'OperatorCommentRemoveView'],
}
for path, forbidden in checks.items():
    text = Path(path).read_text()
    for token in forbidden:
        if token in text:
            raise SystemExit(f'forbidden operator authority token remains: {path}: {token}')

print('Phase 5 operator boundary repaired: internal seam retained; public invented authority removed')
