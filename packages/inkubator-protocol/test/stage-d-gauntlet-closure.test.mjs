import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAUSAL_RULES, compileProposal} from '../src/compiler.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const blueprintDir = path.resolve(here, '../compiler/blueprints');
const gauntletDir = path.resolve(here, '../compiler/gauntlet');
const blueprints = fs.readdirSync(blueprintDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(fs.readFileSync(path.join(blueprintDir, name), 'utf8')));
const seedCorpus = JSON.parse(fs.readFileSync(path.join(gauntletDir, 'seed-corpus.v1.json'), 'utf8'));
const closureCorpus = JSON.parse(fs.readFileSync(path.join(gauntletDir, 'closure-corpus.v1.json'), 'utf8'));
const allCases = [...seedCorpus.cases, ...closureCorpus.cases];

function compileFixture(fixture) {
  return compileProposal(fixture.proposal, {blueprints});
}

for (const fixture of closureCorpus.cases) {
  test(`closure gauntlet ${fixture.id}`, () => {
    const state = compileFixture(fixture);
    assert.equal(state.status, fixture.expected.status);
    assert.equal(state.selected_blueprint?.id ?? null, fixture.expected.selected_blueprint);
    assert.equal(state.risk_profile.level, fixture.expected.risk_level);
    assert.equal(state.quality_profile.level, fixture.expected.quality_level);

    const factKeys = new Set(state.causal_facts.filter((item) => item.value === true).map((item) => item.key));
    for (const key of fixture.expected.facts_present) assert.ok(factKeys.has(key), `${key} should be derived true`);

    const questionIds = [...new Set(state.questions.map((item) => item.id))].sort();
    assert.deepEqual(questionIds, [...fixture.expected.question_ids].sort());

    const findingCodes = [...new Set(state.findings.map((item) => item.code))].sort();
    assert.deepEqual(findingCodes, [...fixture.expected.finding_codes].sort());
  });
}

test('seed + closure corpus exercises every Stage-D causal rule', () => {
  const exercised = new Set();
  for (const fixture of allCases) {
    const state = compileFixture(fixture);
    for (const item of [...state.causal_facts, ...state.questions, ...state.findings]) {
      if (item.rule_id?.startsWith('R_')) exercised.add(item.rule_id);
    }
  }

  const expected = CAUSAL_RULES.map((rule) => rule.id).sort();
  assert.deepEqual([...exercised].sort(), expected);
});

test('seed + closure corpus selects every active V1 blueprint at least once', () => {
  const selected = new Set();
  for (const fixture of allCases) {
    const state = compileFixture(fixture);
    if (state.selected_blueprint) selected.add(state.selected_blueprint.id);
  }

  const expected = blueprints
    .filter((blueprint) => blueprint.health === 'ACTIVE')
    .map((blueprint) => blueprint.id)
    .sort();
  assert.deepEqual([...selected].sort(), expected);
});

test('seed + closure gauntlet IDs remain globally unique', () => {
  const ids = allCases.map((fixture) => fixture.id);
  assert.equal(new Set(ids).size, ids.length);
});
