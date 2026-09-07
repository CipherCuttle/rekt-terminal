import fs from 'node:fs';
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
