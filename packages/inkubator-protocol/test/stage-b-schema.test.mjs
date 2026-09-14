import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {freezeBuildContract, BUILD_CONTRACT_SCHEMA_VERSION, MECHANISM_VERSION, SETTLEMENT_POLICY_VERSION, IP_TERMS_VERSION} from '../src/challenge.mjs';
import {digestRecord} from '../src/index.mjs';

const ajv = new Ajv2020({allErrors:true, strict:true});
addFormats(ajv);
const buildSchema = JSON.parse(fs.readFileSync(new URL('../schema/build-contract.schema.json', import.meta.url),'utf8'));
const submissionSchema = JSON.parse(fs.readFileSync(new URL('../schema/submission-manifest.schema.json', import.meta.url),'utf8'));
const validateBuild = ajv.compile(buildSchema);
const validateSubmission = ajv.compile(submissionSchema);

function buildContract() {
  return freezeBuildContract({
    schema_version: BUILD_CONTRACT_SCHEMA_VERSION, challenge_id:'CH-SCHEMA', contract_version:'1', mechanism_version:MECHANISM_VERSION,
    settlement_policy_version:SETTLEMENT_POLICY_VERSION, ip_terms_version:IP_TERMS_VERSION, title:'Schema fixture', brief:'Schema fixture',
    outcome_contract:{criteria:[{id:'O',description:'Works',mandatory:true}]}, production_envelope:{criteria:[]}, delivery_contract:{criteria:[]},
    preferences:{}, reference_architecture:{}, normative_constraints:[], normative_references:[], informational_references:[], knowledge:[],
    slot_limit:2, activation_minimum:1, entry_deadline:100, build_start:100, submission_deadline:200, appeal_window_ms:50, review_deadline:400,
    prize_minor_units:100, settlement_asset:'TEST',
  });
}

test('new Build Contract JSON Schema accepts canonical frozen contract',()=>{const c=buildContract();assert.equal(validateBuild(c),true,JSON.stringify(validateBuild.errors))});
test('new Build Contract JSON Schema rejects obsolete appeal_deadline',()=>{const c={...buildContract(),appeal_deadline:250};delete c.appeal_window_ms;assert.equal(validateBuild(c),false)});
test('new Submission Manifest JSON Schema accepts canonical manifest',()=>{const c=buildContract();const m={schema_version:'inkubator.submission-manifest/1.0',challenge_id:c.challenge_id,entry_id:'E1',terms_digest:c.terms_digest,submission_version:1,immutable_source_reference:{kind:'GIT_COMMIT',value:'abc'},artifact_digest:digestRecord({x:1}),evidence_references:[],accepted_at:150};assert.equal(validateSubmission(m),true,JSON.stringify(validateSubmission.errors))});
test('new Submission Manifest JSON Schema rejects mutable-url-only identity',()=>{const c=buildContract();const m={schema_version:'inkubator.submission-manifest/1.0',challenge_id:c.challenge_id,entry_id:'E1',terms_digest:c.terms_digest,submission_version:1,artifact_digest:digestRecord({x:1}),evidence_references:[],optional_live_url:'https://example.com',accepted_at:150};assert.equal(validateSubmission(m),false)});
