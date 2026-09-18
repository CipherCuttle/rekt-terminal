import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProposal} from '../src/compiler.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const blueprintDir = path.resolve(here, '../compiler/blueprints');
const blueprints = fs.readdirSync(blueprintDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(fs.readFileSync(path.join(blueprintDir, name), 'utf8')));
const corpus = JSON.parse(fs.readFileSync(path.resolve(here, '../compiler/gauntlet/seed-corpus.v1.json'), 'utf8'));

function compileCase(id) {
  const fixture = corpus.cases.find((item) => item.id === id);
  assert.ok(fixture, `missing gauntlet case ${id}`);
  return {fixture, state: compileProposal(fixture.proposal, {blueprints})};
}

for (const fixture of corpus.cases) {
  test(`gauntlet ${fixture.id}`, () => {
    const state = compileProposal(fixture.proposal, {blueprints});
    assert.equal(state.status, fixture.expected.status);
    assert.equal(state.selected_blueprint?.id ?? null, fixture.expected.selected_blueprint);
    assert.equal(state.risk_profile.level, fixture.expected.risk_level);
    const facts = new Map(state.causal_facts.map((item) => [item.key, item.value]));
    for (const key of fixture.expected.facts_present) assert.equal(facts.get(key), true, `${key} should be derived true`);
    for (const key of fixture.expected.facts_absent) assert.equal(facts.has(key), false, `${key} should remain absent`);
  });
}

test('meaningful mutations change architecture/contract consequences', () => {
  const baseline = compileCase('BASE_STATIC').state;
  const accounts = compileCase('MUTATION_ACCOUNTS').state;
  const realtime = compileCase('MUTATION_REALTIME').state;
  const transaction = compileCase('MUTATION_WALLET_TRANSACTION').state;
  assert.notDeepEqual(accounts.production_envelope, baseline.production_envelope);
  assert.notDeepEqual(accounts.reference_architecture_candidate, baseline.reference_architecture_candidate);
  assert.notDeepEqual(realtime.reference_architecture_candidate, baseline.reference_architecture_candidate);
  assert.notDeepEqual(transaction.risk_profile, baseline.risk_profile);
});

test('irrelevant visual wording does not change architecture/risk/storage/auth consequences', () => {
  const baseline = compileCase('BASE_STATIC').state;
  const purple = compileCase('IRRELEVANT_PURPLE').state;
  const semanticProjection = (state) => ({
    project_fingerprint: state.project_fingerprint,
    production_envelope: state.production_envelope,
    risk_profile: state.risk_profile,
    quality_profile: state.quality_profile,
    blueprint_candidates: state.blueprint_candidates,
    selected_blueprint: state.selected_blueprint,
    causal_facts: state.causal_facts,
    reference_architecture_candidate: state.reference_architecture_candidate,
    acceptance_plan: state.acceptance_plan,
    status: state.status,
  });
  assert.deepEqual(semanticProjection(purple), semanticProjection(baseline));
});
