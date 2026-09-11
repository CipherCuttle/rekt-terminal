import test from 'node:test';
import assert from 'node:assert/strict';
import '../../dist/contract-phase8.js';
import {componentSchemas, openapiDocument} from '../../dist/contract.js';

test('pending Assist inbox is authenticated owner-private and absent from the public Help projection', () => {
  const operation = openapiDocument.paths['/v1/projects/{projectId}/pending-assists']?.get;
  assert.ok(operation);
  assert.deepEqual(operation.security, [{sessionCookie: []}]);
  assert.equal(operation.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/ProjectPendingAssistsView');
  assert.ok(operation.responses['401']);
  assert.ok(operation.responses['403']);
  assert.ok(operation.responses['404']);

  const pending = componentSchemas.ProjectPendingAssistsView;
  assert.equal(pending.properties.schema_version.const, 'project.pending_assists.private.v1');
  assert.equal(pending.properties.assists.items.$ref, '#/components/schemas/ProjectPendingAssistView');

  const publicHelp = componentSchemas.ProjectHelpLoopView;
  assert.equal(Object.hasOwn(publicHelp.properties, 'pending_assists'), false);
  assert.equal(JSON.stringify(publicHelp).includes('ProjectPendingAssistView'), false);
});
