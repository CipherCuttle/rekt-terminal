import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalizeV0, compilePublicState, digestRecord} from '../src/index.mjs';

const round = {
  schemaVersion: 'inkubator.round/0.1',
  roundId: 'RDEV',
  title: 'DEVELOPMENT ROUND',
  status: 'DRAFT',
  constraint: 'Development fixture only. No public round constraint is locked.',
  rules: {workingUrlRequired: true, demoRequired: true, aiAllowed: true},
};

const player = {
  schemaVersion: 'inkubator.player/0.1',
  playerId: 'PDEV-001',
  handle: '@fixture',
  displayName: 'Fixture Player',
  character: {callSign: 'NULL GHOST', archetype: 'BUILDER'},
};

const receipt = {
  schemaVersion: 'inkubator.ship-receipt/0.1',
  receiptId: 'RDEV-S001',
  roundId: 'RDEV',
  playerId: 'PDEV-001',
  artifact: {
    title: 'DEVELOPMENT ARTIFACT',
    url: 'https://example.com/',
    demoUrl: 'https://example.com/',
  },
  shippedAt: '2026-09-06T18:00:00Z',
  evidence: [
    {
      type: 'LIVE_URL',
      status: 'PASS',
      observedAt: '2026-09-06T18:00:00Z',
      claim: 'Fixture URL was reachable when this development record was authored.',
    },
    {
      type: 'DEMO',
      status: 'SUPPLIED',
      observedAt: '2026-09-06T18:00:00Z',
      claim: 'Fixture demo URL supplied.',
    },
  ],
};

test('canonicalization is key-order invariant', () => {
  assert.equal(canonicalizeV0({b: 2, a: 1}), canonicalizeV0({a: 1, b: 2}));
});

test('fixture receipt digest is deterministic', () => {
  assert.equal(digestRecord(receipt), 'c582a73099e7264b7f7989e72f7cff86110aa91fd5baf4a718cb715ad9cf4495');
});

test('public state derives player shipping facts from receipts', () => {
  const state = compilePublicState({mode: 'development-fixture', rounds: [round], players: [player], receipts: [receipt]});
  assert.equal(state.receipts[0].digest, digestRecord(receipt));
  assert.deepEqual(state.playerStats, [{playerId: 'PDEV-001', ships: 1, rounds: 1}]);
});

test('receipt cannot reference an unknown player', () => {
  assert.throws(
    () => compilePublicState({rounds: [round], players: [], receipts: [receipt]}),
    /unknown playerId PDEV-001/,
  );
});
