import {createHmac} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const webhookSecret = 'parser-order-webhook-secret-123456';
const runtime = {
  appSlug: 'rekt-inkubator-test',
  clientId: 'Iv1.test-client',
  clientSecret: 'test-client-secret',
  webhookSecret,
};

function signature(raw) {
  return `sha256=${createHmac('sha256', webhookSecret).update(raw).digest('hex')}`;
}

test('GitHub webhook authenticates exact bytes before JSON parsing or delivery persistence', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await db.deleteFrom('github_deliveries').execute();
  const app = buildApp({
    db,
    appOrigin,
    allowDevAuth: false,
    sessionTtlSeconds: 3600,
    github: {
      runtime,
      verifier: {async verifyInstallation() { throw new Error('not_used'); }},
    },
  });

  const rawInvalidJson = Buffer.from('{"broken":', 'utf8');
  const delivery = '123e4567-e89b-42d3-a456-426614174000';
  try {
    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/v1/github/webhook',
      headers: {
        'content-type': 'application/json',
        'x-github-delivery': delivery,
        'x-github-event': 'push',
        'x-hub-signature-256': `sha256=${'0'.repeat(64)}`,
      },
      payload: rawInvalidJson,
    });
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthenticated.json().error, 'github_signature_invalid');

    const afterBadSignature = await db
      .selectFrom('github_deliveries')
      .select(({fn}) => fn.countAll().as('count'))
      .executeTakeFirstOrThrow();
    assert.equal(Number(afterBadSignature.count), 0);

    const authenticatedInvalidJson = await app.inject({
      method: 'POST',
      url: '/v1/github/webhook',
      headers: {
        'content-type': 'application/json',
        'x-github-delivery': delivery,
        'x-github-event': 'push',
        'x-hub-signature-256': signature(rawInvalidJson),
      },
      payload: rawInvalidJson,
    });
    assert.equal(authenticatedInvalidJson.statusCode, 400);
    assert.equal(authenticatedInvalidJson.json().error, 'github_payload_invalid_json');

    const afterAuthenticatedInvalidJson = await db
      .selectFrom('github_deliveries')
      .select(({fn}) => fn.countAll().as('count'))
      .executeTakeFirstOrThrow();
    assert.equal(Number(afterAuthenticatedInvalidJson.count), 0);
  } finally {
    await app.close();
    await db.destroy();
  }
});
