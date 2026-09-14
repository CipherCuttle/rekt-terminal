import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  IP_TERMS_VERSION,
} from '../src/challenge-hardened.mjs';
import {
  assertCompilerProposal,
  assertCompilerState,
  buildBuildContractCandidate,
  compileProposal,
  COMPILER_PROPOSAL_SCHEMA_VERSION,
} from '../src/compiler.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const blueprintDir = path.resolve(here, '../compiler/blueprints');
const blueprints = fs.readdirSync(blueprintDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(fs.readFileSync(path.join(blueprintDir, name), 'utf8')));

const baseProposal = () => ({
  schema_version: COMPILER_PROPOSAL_SCHEMA_VERSION,
  source_intent: 'Make a static REKT launch page.',
  requirements: [
    {key: 'accounts', value: false, provenance: 'SOURCE'},
    {key: 'persistence', value: false, provenance: 'SOURCE'},
    {key: 'uploads_private', value: false, provenance: 'SOURCE'},
    {key: 'realtime', value: false, provenance: 'SOURCE'},
    {key: 'notifications', value: false, provenance: 'SOURCE'},
    {key: 'onchain_read', value: false, provenance: 'SOURCE'},
    {key: 'wallet_transactions', value: false, provenance: 'SOURCE'},
    {key: 'custody_private_keys', value: false, provenance: 'SOURCE'},
  ],
  knowledge: [],
  outcome_criteria: [{id: 'O1', description: 'Page renders approved content.', mandatory: true, provenance: 'ORGANIZER_ACCEPTED'}],
  delivery_criteria: [{id: 'D1', description: 'Immutable source revision is delivered.', mandatory: true, provenance: 'ORGANIZER_ACCEPTED'}],
  preferences: {visual_theme: 'REKT'},
});

const authorityFields = () => ({
  schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
  challenge_id: 'CH-STAGE-D',
  contract_version: '1',
  mechanism_version: MECHANISM_VERSION,
  settlement_policy_version: SETTLEMENT_POLICY_VERSION,
  ip_terms_version: IP_TERMS_VERSION,
  title: 'Stage D fixture',
  brief: 'Stage D compiler candidate fixture',
  preferences: {visual_theme: 'ORGANIZER_ACCEPTED_REKT'},
  normative_constraints: [],
  normative_references: [],
  informational_references: [],
  slot_limit: 2,
  activation_minimum: 1,
  entry_deadline: 100,
  build_start: 100,
  submission_deadline: 200,
  appeal_window_ms: 50,
  review_deadline: 400,
  prize_minor_units: 100,
  settlement_asset: 'TEST',
});

test('CompilerState + blueprint schemas accept compiler output and seed blueprints', () => {
  const ajv = new Ajv2020({allErrors: true, strict: true});
  addFormats(ajv);
  const stateSchema = JSON.parse(fs.readFileSync(path.resolve(here, '../schema/compiler-state.schema.json'), 'utf8'));
  const blueprintSchema = JSON.parse(fs.readFileSync(path.resolve(here, '../schema/compiler-blueprint.schema.json'), 'utf8'));
  const validateState = ajv.compile(stateSchema);
  const validateBlueprint = ajv.compile(blueprintSchema);
  for (const blueprint of blueprints) assert.equal(validateBlueprint(blueprint), true, JSON.stringify(validateBlueprint.errors));
  const state = compileProposal(baseProposal(), {blueprints});
  assert.equal(validateState(state), true, JSON.stringify(validateState.errors));
});

test('compiler output is order-stable for semantically identical structured input', () => {
  const forward = baseProposal();
  const reversed = {...baseProposal(), requirements: [...baseProposal().requirements].reverse()};
  assert.deepEqual(compileProposal(forward, {blueprints}), compileProposal(reversed, {blueprints}));
});

test('conflicting requirement proposals surface as unresolved instead of being silently reconciled', () => {
  const proposal = baseProposal();
  proposal.requirements.push({key: 'accounts', value: true, provenance: 'MODEL_PROPOSAL'});
  const state = compileProposal(proposal, {blueprints});
  assert.equal(state.status, 'NEEDS_DECISION');
  assert.ok(state.unresolved_decisions.some((item) => item.id === 'REQ_CONFLICT:accounts'));
});

test('model/provider proposals cannot inject deterministic/authority fields', () => {
  const injected = {...baseProposal(), risk_profile: {level: 'LOW'}};
  assert.throws(() => assertCompilerProposal(injected), /undeclared property risk_profile/);
  const forged = baseProposal();
  forged.requirements[0] = {...forged.requirements[0], provenance: 'DETERMINISTIC_RULE'};
  assert.throws(() => assertCompilerProposal(forged), /invalid input provenance/);
});

test('incomplete blueprint-selection facts fail closed instead of selecting WEB_STATIC', () => {
  const proposal = baseProposal();
  proposal.requirements = proposal.requirements.filter((item) => item.key !== 'custody_private_keys');
  proposal.requirements.push({key: 'custody_private_key', value: true, provenance: 'MODEL_PROPOSAL'});
  const state = compileProposal(proposal, {blueprints});
  assert.equal(state.status, 'NEEDS_DECISION');
  assert.equal(state.selected_blueprint, null);
  assert.ok(state.unresolved_decisions.some((item) => item.id === 'MISSING_REQUIREMENT:custody_private_keys'));
});

test('organizer-accepted knowledge can answer a blocking causal question', () => {
  const proposal = baseProposal();
  proposal.requirements = proposal.requirements.map((item) => item.key === 'realtime' ? {...item, value: true} : item);
  let state = compileProposal(proposal, {blueprints});
  assert.equal(state.status, 'NEEDS_DECISION');
  assert.ok(state.unresolved_decisions.some((item) => item.id === 'QUESTION:Q_REALTIME_TRANSPORT'));

  proposal.knowledge.push({
    kind: 'KNOWN',
    key: 'Q_REALTIME_TRANSPORT',
    material: true,
    value: 'WebSocket transport; server order is authoritative.',
    provenance: 'ORGANIZER_ACCEPTED',
  });
  state = compileProposal(proposal, {blueprints});
  assert.equal(state.status, 'READY');
  assert.equal(state.selected_blueprint?.id, 'WEB_REALTIME');
});

test('knowledge that contradicts a deterministic causal fact blocks readiness', () => {
  const proposal = baseProposal();
  proposal.requirements = proposal.requirements.map((item) => item.key === 'accounts' ? {...item, value: true} : item);
  proposal.knowledge.push({
    kind: 'KNOWN',
    key: 'persistence_required',
    material: true,
    value: false,
    provenance: 'SOURCE',
  });
  const state = compileProposal(proposal, {blueprints});
  assert.equal(state.status, 'NEEDS_DECISION');
  assert.ok(state.unresolved_decisions.some((item) => item.id === 'KNOWLEDGE_CAUSAL_CONTRADICTION:persistence_required'));
});

test('criterion IDs must remain unique across outcome, production and delivery layers', () => {
  const proposal = baseProposal();
  proposal.delivery_criteria[0] = {...proposal.delivery_criteria[0], id: 'O1'};
  const state = compileProposal(proposal, {blueprints});
  assert.equal(state.status, 'NEEDS_DECISION');
  assert.ok(state.unresolved_decisions.some((item) => item.id === 'CRITERION_ID_CONFLICT:O1'));
});

test('model-only semantic facts cannot become READY authority', () => {
  const requirementProposal = baseProposal();
  requirementProposal.requirements[0] = {...requirementProposal.requirements[0], provenance: 'MODEL_PROPOSAL'};
  let state = compileProposal(requirementProposal, {blueprints});
  assert.equal(state.status, 'NEEDS_DECISION');
  assert.ok(state.unresolved_decisions.some((item) => item.id === 'REQUIREMENT_ACCEPTANCE:accounts'));

  const criterionProposal = baseProposal();
  criterionProposal.outcome_criteria[0] = {...criterionProposal.outcome_criteria[0], provenance: 'MODEL_PROPOSAL'};
  state = compileProposal(criterionProposal, {blueprints});
  assert.equal(state.status, 'NEEDS_DECISION');
  assert.ok(state.unresolved_decisions.some((item) => item.id === 'CRITERION_ACCEPTANCE:O1'));
});

test('forged READY CompilerState is rejected unless it matches deterministic replay', () => {
  const state = compileProposal(baseProposal(), {blueprints});
  const forged = structuredClone(state);
  forged.reference_architecture_candidate = {shape: 'PROVIDER_FORGED'};
  assert.throws(() => assertCompilerState(forged, {blueprints}), /does not match deterministic replay/);
  assert.throws(() => buildBuildContractCandidate(forged, authorityFields(), {blueprints}), /does not match deterministic replay/);
});

test('replay rejects a caller-forged blueprint registry even when state matches the forgery', () => {
  const forgedBlueprints = structuredClone(blueprints);
  const staticBlueprint = forgedBlueprints.find((item) => item.id === 'WEB_STATIC');
  staticBlueprint.reference_architecture = {shape: 'PROVIDER_FORGED', components: ['provider-controlled-runtime']};
  const forgedState = compileProposal(baseProposal(), {blueprints: forgedBlueprints});
  assert.equal(forgedState.status, 'READY');
  assert.equal(forgedState.reference_architecture_candidate.shape, 'PROVIDER_FORGED');
  assert.throws(() => assertCompilerState(forgedState, {blueprints: forgedBlueprints}), /content digest mismatch/);
  assert.throws(() => buildBuildContractCandidate(forgedState, authorityFields(), {blueprints: forgedBlueprints}), /content digest mismatch/);
});

test('READY CompilerState can produce a Stage-B-valid candidate without freezing it', () => {
  const state = compileProposal(baseProposal(), {blueprints});
  assert.equal(state.status, 'READY');
  const candidate = buildBuildContractCandidate(state, authorityFields(), {blueprints});
  assert.equal(candidate.terms_digest, undefined);
  assert.equal(candidate.outcome_contract.criteria[0].id, 'O1');
  assert.equal(candidate.reference_architecture.shape, 'STATIC_SITE');
  assert.deepEqual(candidate.preferences, {visual_theme: 'ORGANIZER_ACCEPTED_REKT'});
});

test('Build Contract bridge requires organizer-accepted preferences instead of compiler proposal preferences', () => {
  const state = compileProposal(baseProposal(), {blueprints});
  const fields = authorityFields();
  delete fields.preferences;
  assert.throws(() => buildBuildContractCandidate(state, fields, {blueprints}), /preferences is required as organizer-accepted authority/);
});
