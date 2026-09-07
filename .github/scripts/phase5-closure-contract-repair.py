from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


# P2 exception: a Project-owner block must prohibit writes anywhere in that Project
# discussion, including reactions to third-party comments.
social = 'apps/inkubator-api/src/social.ts'
replace_once(
    social,
    """    const project = await tx.selectFrom('projects').select('project_id').where('project_id', '=', comment.project_id).forUpdate().executeTakeFirstOrThrow();
    if (await discussionLocked(tx, project.project_id)) throw new Error('project_discussion_locked');
""",
    """    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', comment.project_id).forUpdate().executeTakeFirstOrThrow();
    if (await interactionBlocked(tx, actorId, project.owner_player_id)) throw new Error('social_interaction_blocked');
    if (await discussionLocked(tx, project.project_id)) throw new Error('project_discussion_locked');
""",
)

# P2 exception: every templated OpenAPI path must declare its required typed path
# parameters so the published contract is standards-compliant and generator-safe.
contract = 'apps/inkubator-api/src/contract.ts'
replacements = [
    (
        """    '/v1/players/{playerId}/block':{post:{operationId:'blockPlayer',security:[{sessionCookie:[]}],requestBody:""",
        """    '/v1/players/{playerId}/block':{post:{operationId:'blockPlayer',security:[{sessionCookie:[]}],parameters:[{name:'playerId',in:'path',required:true,schema:ref('PlayerId')}],requestBody:""",
    ),
    (
        """},delete:{operationId:'unblockPlayer',security:[{sessionCookie:[]}],requestBody:""",
        """},delete:{operationId:'unblockPlayer',security:[{sessionCookie:[]}],parameters:[{name:'playerId',in:'path',required:true,schema:ref('PlayerId')}],requestBody:""",
    ),
    (
        """    '/v1/comments/{commentId}/report':{post:{operationId:'reportProjectComment',security:[{sessionCookie:[]}],requestBody:""",
        """    '/v1/comments/{commentId}/report':{post:{operationId:'reportProjectComment',security:[{sessionCookie:[]}],parameters:[{name:'commentId',in:'path',required:true,schema:{type:'string',format:'uuid'}}],requestBody:""",
    ),
    (
        """    '/v1/projects/{projectId}/tester-requests':{post:{operationId:'createExternalTestRequest',security:[{sessionCookie:[]}],requestBody:""",
        """    '/v1/projects/{projectId}/tester-requests':{post:{operationId:'createExternalTestRequest',security:[{sessionCookie:[]}],parameters:[{name:'projectId',in:'path',required:true,schema:ref('ProjectId')}],requestBody:""",
    ),
    (
        """    '/v1/tester-requests/{testRequestId}/results':{post:{operationId:'recordExternalTestResult',security:[{sessionCookie:[]}],requestBody:""",
        """    '/v1/tester-requests/{testRequestId}/results':{post:{operationId:'recordExternalTestResult',security:[{sessionCookie:[]}],parameters:[{name:'testRequestId',in:'path',required:true,schema:{type:'string',format:'uuid'}}],requestBody:""",
    ),
    (
        """    '/v1/projects/{projectId}/external-tests':{get:{operationId:'getProjectExternalTests',responses:""",
        """    '/v1/projects/{projectId}/external-tests':{get:{operationId:'getProjectExternalTests',parameters:[{name:'projectId',in:'path',required:true,schema:ref('ProjectId')}],responses:""",
    ),
]
for old, new in replacements:
    replace_once(contract, old, new)

# P2 exception: Phase-5 endpoints are part of the canonical generated API surface,
# so every Phase-5 operation must be reachable from InkubatorApiClient.
generator = 'apps/inkubator-api/src/generate-client.ts'
replace_once(
    generator,
    """  ['/v1/github/install', 'post'],
] as const;
""",
    """  ['/v1/github/install', 'post'],
  ['/v1/discover/players', 'get'],
  ['/v1/discover/projects', 'get'],
  ['/v1/players/{playerId}/follow', 'post'],
  ['/v1/projects/{projectId}/watch', 'post'],
  ['/v1/projects/{projectId}/help-beacons', 'post'],
  ['/v1/help-beacons/{beaconId}/close', 'post'],
  ['/v1/help-beacons/{beaconId}/assists', 'post'],
  ['/v1/assists/{assistId}/accept', 'post'],
  ['/v1/projects/{projectId}/help-loop', 'get'],
  ['/v1/projects/{projectId}/comments', 'get'],
  ['/v1/projects/{projectId}/comments', 'post'],
  ['/v1/comments/{commentId}/reactions/useful', 'post'],
  ['/v1/comments/{commentId}', 'delete'],
  ['/v1/projects/{projectId}/discussion', 'patch'],
  ['/v1/world/signals', 'get'],
  ['/v1/players/{playerId}/block', 'post'],
  ['/v1/players/{playerId}/block', 'delete'],
  ['/v1/comments/{commentId}/report', 'post'],
  ['/v1/projects/{projectId}/tester-requests', 'post'],
  ['/v1/tester-requests/{testRequestId}/results', 'post'],
  ['/v1/projects/{projectId}/external-tests', 'get'],
] as const;
""",
)

# Preserve the authorization invariant in the real multi-player integration path.
tester = 'apps/inkubator-api/test/integration/phase5-tester-moderation.test.mjs'
replace_once(
    tester,
    """assert.equal(blockedFollow.json().error,'social_interaction_blocked');const blockedComment=await app.inject({method:'POST',url:`/v1/projects/${projectId}/comments`,headers:bh,payload:{request_id:randomUUID(),body:'Blocked'}});assert.equal(blockedComment.statusCode,403);\nconst testReq=""",
    """assert.equal(blockedFollow.json().error,'social_interaction_blocked');const blockedComment=await app.inject({method:'POST',url:`/v1/projects/${projectId}/comments`,headers:bh,payload:{request_id:randomUUID(),body:'Blocked'}});assert.equal(blockedComment.statusCode,403);const carolComment=await app.inject({method:'POST',url:`/v1/projects/${projectId}/comments`,headers:ch,payload:{request_id:randomUUID(),body:'Third-party comment'}});assert.equal(carolComment.statusCode,201);const blockedReaction=await app.inject({method:'POST',url:`/v1/comments/${carolComment.json().comment_id}/reactions/useful`,headers:bh,payload:{request_id:randomUUID()}});assert.equal(blockedReaction.statusCode,403);assert.equal(blockedReaction.json().error,'social_interaction_blocked');\nconst testReq=""",
)

# Permanent contract regression: all Phase-5 templated paths are typed and all
# Phase-5 operations are emitted as generated client methods.
Path('apps/inkubator-api/test/unit/phase5-contract-closure.test.mjs').write_text(r'''import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {openapiDocument} from '../../dist/contract.js';

const expected = [
  ['/v1/players/{playerId}/block', 'post', 'playerId'],
  ['/v1/players/{playerId}/block', 'delete', 'playerId'],
  ['/v1/comments/{commentId}/report', 'post', 'commentId'],
  ['/v1/projects/{projectId}/tester-requests', 'post', 'projectId'],
  ['/v1/tester-requests/{testRequestId}/results', 'post', 'testRequestId'],
  ['/v1/projects/{projectId}/external-tests', 'get', 'projectId'],
];
const phase5Methods = [
  'discoverPlayers','discoverProjects','followPlayer','watchProject','createHelpBeacon','closeHelpBeacon','offerAssist','acceptAssist','getProjectHelpLoop','listProjectComments','createProjectComment','reactUsefulToComment','deleteOwnProjectComment','setProjectDiscussionLock','listWorldSignals','blockPlayer','unblockPlayer','reportProjectComment','createExternalTestRequest','recordExternalTestResult','getProjectExternalTests',
];

test('Phase 5 OpenAPI paths and generated client remain complete', () => {
  for (const [route, method, parameterName] of expected) {
    const operation = openapiDocument.paths[route]?.[method];
    assert.ok(operation, `${method.toUpperCase()} ${route}`);
    const parameter = operation.parameters?.find((item) => item.name === parameterName && item.in === 'path');
    assert.ok(parameter, `${method.toUpperCase()} ${route} missing ${parameterName}`);
    assert.equal(parameter.required, true);
    assert.ok(parameter.schema);
  }
  const generated = fs.readFileSync(new URL('../../../inkubator-lab/src/generated/inkubator-api-client.ts', import.meta.url), 'utf8');
  for (const method of phase5Methods) assert.match(generated, new RegExp(`\\n  ${method}\\(`), `generated client missing ${method}`);
});
''')

print('Phase 5 closure contract repair applied')
