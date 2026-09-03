import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import {
  EPISODE_LOAD_POLICY_V0,
  EPISODE_SCHEMA_VERSION,
  ETHUSDT_PERP_EPISODE_20260828_0530,
  EpisodeValidationError,
  MARGIN_EPISODE_ARTIFACTS,
  assertEpisodeArtifact,
  canonicalEpisodeJson,
  computeEpisodeDigest,
  computeFundingDigest,
  createEpisodeArtifact,
  loadEpisode,
  sha256Hex,
} from '../dist/index.js';

const FIRST = ETHUSDT_PERP_EPISODE_20260828_0530;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DIST_URL = pathToFileURL(resolve(ROOT, 'packages/episodes/dist/index.js')).href;

function copyArtifact(artifact, manifestChanges = {}, sampleChanges = new Map()) {
  return {
    manifest: { ...artifact.manifest, ...manifestChanges },
    samples: artifact.samples.map((sample) => sampleChanges.get(sample.sampleId) ?? { ...sample }),
  };
}

function rejects(input, code) {
  assert.throws(() => loadEpisode(input, EPISODE_LOAD_POLICY_V0), (error) => error instanceof EpisodeValidationError && error.code === code);
}

function rehashedArtifact(artifact, manifestChanges = {}) {
  const candidate = {
    manifest: { ...artifact.manifest, ...manifestChanges },
    samples: artifact.samples.map((sample) => ({ ...sample })),
  };
  candidate.manifest.sampleDigest = computeEpisodeDigest(candidate);
  return candidate;
}

test('SHA-256 implementation matches the standard vector and fixture artifacts are immutable', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(Object.isFrozen(FIRST), true);
  assert.equal(Object.isFrozen(FIRST.manifest), true);
  assert.equal(Object.isFrozen(FIRST.manifest.environmentEligibility), true);
  assert.equal(Object.isFrozen(FIRST.manifest.provenance), true);
  assert.equal(Object.isFrozen(FIRST.manifest.simulatorModelVersions), true);
  assert.equal(Object.isFrozen(FIRST.manifest.simulatorParameters), true);
  assert.equal(Object.isFrozen(FIRST.manifest.regime), true);
  assert.equal(Object.isFrozen(FIRST.samples), true);
  for (const sample of FIRST.samples) {
    assert.equal(Object.isFrozen(sample), true);
    if (sample.kind === 'MARKET') assert.equal(Object.isFrozen(sample.market), true);
  }
  assert.equal(FIRST.manifest.schemaVersion, EPISODE_SCHEMA_VERSION);
});

test('nested fixture mutation attempts fail and cannot alter later loads or digests', () => {
  const beforeJson = canonicalEpisodeJson(FIRST);
  const attempts = [
    () => FIRST.manifest.environmentEligibility.push('REPLAY'),
    () => { FIRST.manifest.simulatorModelVersions[0] = 'MUTATED'; },
    () => { FIRST.manifest.simulatorParameters.takerFeeBps = '999'; },
    () => { FIRST.manifest.provenance.market = 'CONFIRMED'; },
    () => { FIRST.manifest.regime.trend = 'UP'; },
    () => { FIRST.samples[0].market.priceUsdMicros = '1'; },
    () => FIRST.samples.push(FIRST.samples[0]),
  ];
  for (const attempt of attempts) assert.throws(attempt, TypeError);
  assert.equal(canonicalEpisodeJson(FIRST), beforeJson);
  assert.equal(computeEpisodeDigest(FIRST), FIRST.manifest.sampleDigest);
  assert.doesNotThrow(() => loadEpisode(FIRST, EPISODE_LOAD_POLICY_V0));
});

test('both frozen margin source artifacts load as REPLAY and EXAM-eligible episodes', () => {
  assert.equal(MARGIN_EPISODE_ARTIFACTS.length, 2);
  for (const artifact of MARGIN_EPISODE_ARTIFACTS) {
    const loaded = loadEpisode(artifact, EPISODE_LOAD_POLICY_V0);
    assert.deepEqual(loaded.manifest.environmentEligibility, ['REPLAY', 'EXAM']);
    assert.equal(loaded.manifest.provenance.market, 'DERIVED');
    assert.equal(loaded.manifest.intrabarRule, 'OHLC_PATH_V0');
  }
});

test('same artifact has the same digest across independent Node processes', () => {
  const source = `import { ETHUSDT_PERP_EPISODE_20260828_0530 as e } from ${JSON.stringify(DIST_URL)}; console.log(e.manifest.sampleDigest);`;
  const first = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' });
  const second = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout.trim(), FIRST.manifest.sampleDigest);
  assert.equal(second.stdout.trim(), first.stdout.trim());
});

test('object insertion order does not affect canonical content or digest', () => {
  const reversedManifest = Object.fromEntries(Object.entries(FIRST.manifest).reverse());
  assert.equal(canonicalEpisodeJson(FIRST.manifest), canonicalEpisodeJson(reversedManifest));
  assert.equal(computeEpisodeDigest({ manifest: reversedManifest, samples: FIRST.samples }), FIRST.manifest.sampleDigest);
  assert.notEqual(canonicalEpisodeJson({ value: 9007199254740993n }), canonicalEpisodeJson({ value: '9007199254740993' }));
});

test('market price, timestamp, provenance, and intrabar mutations invalidate or reject the artifact', () => {
  const firstSample = FIRST.samples[0];
  const changedPrice = { ...firstSample, market: { ...firstSample.market, priceUsdMicros: '2488930001' } };
  const changedTime = { ...firstSample, eventTimeMs: firstSample.eventTimeMs + 1 };
  const changedProvenance = { ...firstSample, provenance: 'CONFIRMED' };
  const changedRule = copyArtifact(FIRST, { intrabarRule: 'OHLC_PATH_V0' });
  delete changedRule.manifest.intrabarRule;
  for (const changed of [changedPrice, changedTime, changedProvenance]) {
    const artifact = copyArtifact(FIRST, {}, new Map([[firstSample.sampleId, changed]]));
    assert.notEqual(computeEpisodeDigest(artifact), FIRST.manifest.sampleDigest);
    assert.throws(() => loadEpisode(artifact, EPISODE_LOAD_POLICY_V0), EpisodeValidationError);
  }
  assert.notEqual(computeEpisodeDigest(changedRule), FIRST.manifest.sampleDigest);
  rejects(changedRule, 'MISSING_INTRABAR_RULE');
});

function fundingArtifact(ratePpm = '1000') {
  return createEpisodeArtifact({
    manifest: {
      ...FIRST.manifest,
      sampleDigest: undefined,
      fundingDigest: undefined,
      provenance: { market: 'DERIVED', funding: 'DERIVED' },
    },
    samples: [
      FIRST.samples[0],
      { kind: 'FUNDING', sampleId: 'fund-1', fundingId: 'fund-1', eventTimeMs: FIRST.samples[0].eventTimeMs + 1, sourceId: 'TEST:FUNDING:1', provenance: 'DERIVED', ratePpm, markPriceUsdMicros: '2488930000' },
      ...FIRST.samples.slice(1),
    ],
  });
}

test('positive, zero, and negative funding rates round-trip exactly and remain signed', () => {
  for (const ratePpm of ['1000', '0', '-1000']) {
    const artifact = fundingArtifact(ratePpm);
    const loaded = loadEpisode(artifact, EPISODE_LOAD_POLICY_V0);
    assert.equal(loaded.manifest.fundingDigest, computeFundingDigest(artifact));
    assert.equal(loaded.start('REPLAY').advance().availableSamples.find((sample) => sample.kind === 'FUNDING').ratePpm, ratePpm);
  }
  assert.throws(() => fundingArtifact('1.5'), (error) => error.code === 'MALFORMED_FIXED_POINT');
});

test('funding changes invalidate both content and funding digests', () => {
  const artifact = fundingArtifact();
  assert.equal(artifact.manifest.fundingDigest, computeFundingDigest(artifact));
  const funding = artifact.samples.find((sample) => sample.kind === 'FUNDING');
  const mutated = {
    ...artifact,
    samples: artifact.samples.map((sample) => sample.kind === 'FUNDING' ? { ...sample, ratePpm: '1001' } : sample),
  };
  assert.notEqual(computeFundingDigest(mutated), artifact.manifest.fundingDigest);
  assert.notEqual(computeEpisodeDigest(mutated), artifact.manifest.sampleDigest);
  assert.ok(funding);
  assert.throws(() => loadEpisode(mutated, EPISODE_LOAD_POLICY_V0), (error) => error.code === 'DIGEST_MISMATCH');
});

test('validation fails closed for duplicate IDs, unordered/out-of-bounds samples, schema/provenance errors, and future versions', () => {
  const duplicate = { ...FIRST, samples: [...FIRST.samples, { ...FIRST.samples[0], eventTimeMs: FIRST.manifest.endTimeMs, sampleId: FIRST.samples[0].sampleId }] };
  rejects(duplicate, 'DUPLICATE_SAMPLE_ID');
  rejects({ ...FIRST, samples: [FIRST.samples[0], FIRST.samples[2], FIRST.samples[1], FIRST.samples[3]] }, 'UNORDERED_SAMPLE_STREAM');
  const outside = copyArtifact(FIRST, {}, new Map([[FIRST.samples[0].sampleId, { ...FIRST.samples[0], eventTimeMs: FIRST.manifest.startTimeMs - 1 }]]));
  rejects(outside, 'SAMPLE_OUT_OF_BOUNDS');
  rejects(copyArtifact(FIRST, { schemaVersion: 'EPISODES_V1' }), 'UNKNOWN_SCHEMA_VERSION');
  rejects(copyArtifact(FIRST, {}, new Map([[FIRST.samples[0].sampleId, { ...FIRST.samples[0], provenance: 'SYNTHETIC' }]])), 'UNSUPPORTED_PROVENANCE');
  rejects(copyArtifact(FIRST, { schemaVersion: 'EPISODES_V99' }), 'UNKNOWN_SCHEMA_VERSION');
});

test('compatibility policy is mandatory and rejects unknown or future models even with a valid digest', () => {
  assert.throws(() => loadEpisode(FIRST), (error) => error.code === 'MISSING_COMPATIBILITY_POLICY');
  const unknownMarket = rehashedArtifact(FIRST, { marketDataModelVersion: 'FUTURE_MARKET_V99' });
  assert.throws(() => loadEpisode(unknownMarket, EPISODE_LOAD_POLICY_V0), (error) => error.code === 'INCOMPATIBLE_MODEL');
  const unknownSimulator = rehashedArtifact(FIRST, { simulatorModelVersions: [...FIRST.manifest.simulatorModelVersions, 'FUTURE_SIM_V99'] });
  assert.throws(() => loadEpisode(unknownSimulator, EPISODE_LOAD_POLICY_V0), (error) => error.code === 'INCOMPATIBLE_MODEL');
  const unknownIntrabar = rehashedArtifact(FIRST, { intrabarRule: 'FUTURE_INTRABAR_V99' });
  assert.throws(() => loadEpisode(unknownIntrabar, EPISODE_LOAD_POLICY_V0), (error) => error.code === 'UNKNOWN_INTRABAR_RULE');
  assert.throws(() => loadEpisode(FIRST, {
    ...EPISODE_LOAD_POLICY_V0,
    supportedSimulatorModelVersions: ['SIM_MARGIN_V0'],
  }), (error) => error.code === 'INCOMPATIBLE_MODEL');
});

test('future withholding exposes the first sample, then only deterministic prefixes', () => {
  const loaded = loadEpisode(FIRST, EPISODE_LOAD_POLICY_V0);
  const initial = loaded.start('REPLAY');
  assert.deepEqual(initial.availableSamples.map((sample) => sample.sampleId), ['open']);
  assert.equal(initial.availableSamples.some((sample) => sample.sampleId === 'low'), false);
  assert.equal(initial.currentTimeMs, FIRST.manifest.startTimeMs);
  const one = initial.advance();
  assert.deepEqual(one.availableSamples.map((sample) => sample.sampleId), ['open', 'low']);
  assert.equal(one.availableSamples.some((sample) => sample.sampleId === 'high'), false);
  const two = one.advance();
  const three = two.advance();
  assert.deepEqual(three.availableSamples.map((sample) => sample.sampleId), ['open', 'low', 'high', 'close']);
  assert.equal(three.isComplete, true);
  assert.throws(() => three.advance(), (error) => error.code === 'EPISODE_EXHAUSTED');
  assert.equal('getSample' in initial, false);
  assert.equal('samples' in initial, false);
});

test('cursor sessions are independent and eligibility is enforced at the domain boundary', () => {
  const loaded = loadEpisode(FIRST, EPISODE_LOAD_POLICY_V0);
  const replayA = loaded.start('REPLAY');
  const replayB = loaded.start('REPLAY');
  assert.deepEqual(replayA.advance().availableSamples.map((sample) => sample.sampleId), ['open', 'low']);
  assert.deepEqual(replayB.availableSamples.map((sample) => sample.sampleId), ['open']);
  assert.throws(() => loaded.start('LIVE'), (error) => error.code === 'INELIGIBLE_ENVIRONMENT');
  assert.doesNotThrow(() => loaded.start('EXAM'));
});

test('session environment is mandatory and eligibility is enforced for replay-only, exam-only, and dual artifacts', () => {
  const replayOnly = loadEpisode(rehashedArtifact(FIRST, { environmentEligibility: ['REPLAY'] }), EPISODE_LOAD_POLICY_V0);
  const examOnly = loadEpisode(rehashedArtifact(FIRST, { environmentEligibility: ['EXAM'] }), EPISODE_LOAD_POLICY_V0);
  const dual = loadEpisode(FIRST, EPISODE_LOAD_POLICY_V0);
  assert.throws(() => dual.start(), (error) => error.code === 'INELIGIBLE_ENVIRONMENT');
  assert.doesNotThrow(() => replayOnly.start('REPLAY'));
  assert.throws(() => replayOnly.start('EXAM'), (error) => error.code === 'INELIGIBLE_ENVIRONMENT');
  assert.doesNotThrow(() => examOnly.start('EXAM'));
  assert.throws(() => examOnly.start('REPLAY'), (error) => error.code === 'INELIGIBLE_ENVIRONMENT');
  assert.deepEqual(dual.start('REPLAY').availableSamples.map((sample) => sample.sampleId), ['open']);
  assert.deepEqual(dual.start('EXAM').availableSamples.map((sample) => sample.sampleId), ['open']);
});

test('future withholding remains identical for both explicit session environments', () => {
  const loaded = loadEpisode(FIRST, EPISODE_LOAD_POLICY_V0);
  const replay = loaded.start('REPLAY');
  const exam = loaded.start('EXAM');
  assert.deepEqual(replay.availableSamples.map((sample) => sample.sampleId), ['open']);
  assert.deepEqual(exam.availableSamples.map((sample) => sample.sampleId), ['open']);
  assert.deepEqual(replay.advance().availableSamples.map((sample) => sample.sampleId), ['open', 'low']);
  assert.deepEqual(exam.advance().availableSamples.map((sample) => sample.sampleId), ['open', 'low']);
});

test('loading does not mutate the frozen source artifact', () => {
  const before = canonicalEpisodeJson(FIRST);
  loadEpisode(FIRST, EPISODE_LOAD_POLICY_V0);
  assert.equal(canonicalEpisodeJson(FIRST), before);
  assert.doesNotThrow(() => assertEpisodeArtifact(FIRST, EPISODE_LOAD_POLICY_V0));
});
