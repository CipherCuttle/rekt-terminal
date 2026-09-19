import {createHash} from 'node:crypto';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeHex(hex) {
  invariant(typeof hex === 'string' && /^0x[0-9a-fA-F]*$/.test(hex), 'runtime bytecode must be 0x-prefixed hex');
  invariant((hex.length - 2) % 2 === 0, 'runtime bytecode must contain whole bytes');
  return hex.toLowerCase();
}

export function canonicalImmutableLayout(immutableReferences, runtimeByteLength = null) {
  invariant(
    immutableReferences && typeof immutableReferences === 'object' && !Array.isArray(immutableReferences),
    'immutable references must be an object',
  );

  const layout = Object.values(immutableReferences)
    .flatMap((refs) => {
      invariant(Array.isArray(refs), 'immutable reference entries must be arrays');
      return refs.map((ref) => {
        invariant(ref && typeof ref === 'object', 'immutable reference must be an object');
        invariant(Number.isSafeInteger(ref.start) && ref.start >= 0, 'immutable reference start must be a safe non-negative integer');
        invariant(Number.isSafeInteger(ref.length) && ref.length > 0, 'immutable reference length must be a safe positive integer');
        if (runtimeByteLength !== null) {
          invariant(ref.start + ref.length <= runtimeByteLength, 'immutable reference exceeds runtime bytecode');
        }
        return {start: ref.start, length: ref.length};
      });
    })
    .sort((left, right) => left.start - right.start || left.length - right.length);

  invariant(layout.length > 0, 'J4 runtime identity requires compiler-declared immutable references');

  for (let index = 1; index < layout.length; index += 1) {
    const previous = layout[index - 1];
    const current = layout[index];
    invariant(previous.start + previous.length <= current.start, 'immutable reference ranges must not overlap');
  }

  return Object.freeze(layout.map((entry) => Object.freeze({...entry})));
}

export function normalizeImmutableRuntime(runtimeHex, immutableReferences) {
  const normalized = normalizeHex(runtimeHex);
  const bytes = Buffer.from(normalized.slice(2), 'hex');
  const layout = canonicalImmutableLayout(immutableReferences, bytes.length);

  for (const {start, length} of layout) {
    bytes.fill(0, start, start + length);
  }

  return '0x' + bytes.toString('hex');
}

export function immutableLayoutDigest(immutableReferences, runtimeHex) {
  const normalized = normalizeHex(runtimeHex);
  const layout = canonicalImmutableLayout(immutableReferences, (normalized.length - 2) / 2);
  const canonical = JSON.stringify(layout);
  return '0x' + createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function runtimeIdentityInputFromArtifact(artifact) {
  invariant(artifact && typeof artifact === 'object' && !Array.isArray(artifact), 'artifact must be an object');
  const runtime = artifact.deployedBytecode?.object;
  const immutableReferences = artifact.deployedBytecode?.immutableReferences;
  const normalizedRuntime = normalizeImmutableRuntime(runtime, immutableReferences);
  return Object.freeze({
    runtime_template_bytecode: normalizedRuntime,
    immutable_layout_digest: immutableLayoutDigest(immutableReferences, runtime),
    immutable_reference_count: canonicalImmutableLayout(
      immutableReferences,
      (normalizeHex(runtime).length - 2) / 2,
    ).length,
  });
}
