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
      status: 'SUPPLIED',
      observedAt: '2026-09-06T18:00:00Z',
      claim: 'Fixture URL supplied; no automated live verification has run.',
    },
    {
      type: 'DEMO',
      status: 'SUPPLIED',
      observedAt: '2026-09-06T18:00:00Z',
      claim: 'Fixture demo URL supplied; no automated demo verification has run.',
    },
  ],
};

test('canonicalization is key-order invariant', () => {
  assert.equal(canonicalizeV0({b: 2, a: 1}), canonicalizeV0({a: 1, b: 2}));
});

test('fixture receipt digest is deterministic', () => {
  assert.equal(digestRecord(receipt), '5afddb330bb6b64e62c48ebf368f853f4c7c39a66e7f97261d96bb68febe84f8');
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

test('JSON Schema rejects undeclared player properties', () => {
  const invalidPlayer = {...player, xp: 9001};
  assert.throws(
    () => compilePublicState({rounds: [round], players: [invalidPlayer], receipts: [receipt]}),
    /additional properties/i,
  );
});

test('character identity is optional at the protocol boundary', () => {
  const {character: _character, ...playerWithoutCharacter} = player;
  const state = compilePublicState({rounds: [round], players: [playerWithoutCharacter], receipts: [receipt]});
  assert.equal(state.players[0].playerId, player.playerId);
});
