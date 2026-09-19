#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

AUDITOR_SCOPE="56eaa98497f4c036227c7e2512dadeb640eacfe4"
RPC="${LOCAL_FORK_RPC:-http://127.0.0.1:8548}"
DIGEST="0xfd1656fab8c2c886907ad90e2653f37eafd7da10244871054c8dea25ac7cf138"
NATIVE_USDC="0x2D270e6886d130D724215A266106e6832161EAEd"

AUDITED_PATHS=(
  contracts/inkubator-vault/src/ProductionCandidateChallengeVault.sol
  contracts/inkubator-vault/src/ImmutableResolver1271.sol
  contracts/inkubator-vault/test/ProductionCandidateChallengeVault.t.sol
  contracts/inkubator-vault/test/ProductionCandidatePreAuditMatrix.t.sol
  contracts/inkubator-vault/test/ProductionCandidateKnownAnswer.t.sol
  contracts/inkubator-vault/foundry.toml
  packages/inkubator-protocol/src/production-candidate-vault-adapter.mjs
  packages/inkubator-protocol/src/payout-roster.mjs
  packages/inkubator-protocol/test/stage-j4-production-candidate.test.mjs
  scripts/inkubator/stage-j4-release-candidate.mjs
  scripts/inkubator/stage-j4-runtime-identity.mjs
  scripts/inkubator/stage-j4-runtime-identity.test.mjs
  scripts/inkubator/stage-j4-known-answer-vectors.mjs
  scripts/inkubator/stage-j4-preaudit-verify.mjs
  scripts/inkubator/stage-j4-readonly-ink-asset-probe.mjs
  scripts/inkubator/stage-j4-controlled-fork-usdc.mjs
  scripts/inkubator/stage-j4-release-differentiation.mjs
  .github/workflows/inkubator-j4.yml
)

if ! git diff --quiet "$AUDITOR_SCOPE" -- "${AUDITED_PATHS[@]}"; then
  echo "FAIL: frozen J4 external-audit scope drifted from $AUDITOR_SCOPE" >&2
  git diff --name-only "$AUDITOR_SCOPE" -- "${AUDITED_PATHS[@]}" >&2
  exit 1
fi

if [[ "$(cast chain-id --rpc-url "$RPC")" != "31337" ]]; then
  echo "FAIL: rehearsal RPC must be isolated local chain id 31337" >&2
  exit 1
fi

if [[ "$(cast code "$NATIVE_USDC" --rpc-url "$RPC")" == "0x" ]]; then
  echo "FAIL: native Ink USDC code missing from local fork" >&2
  exit 1
fi

cd contracts/inkubator-vault
forge clean
forge build >/dev/null
forge test --match-contract ProductionCandidateKnownAnswerTest -q

new_dummy_wallet() {
  cast wallet new --json | jq -c 'if type == "object" and has("data") then (.data | if type == "array" then .[0] else . end) elif type == "array" then .[0] else . end'
}

outcome_wallet="$(new_dummy_wallet)"
r1_wallet="$(new_dummy_wallet)"
r2_wallet="$(new_dummy_wallet)"
r3_wallet="$(new_dummy_wallet)"
outsider_wallet="$(new_dummy_wallet)"

cleanup() {
  outcome_wallet=""
  r1_wallet=""
  r2_wallet=""
  r3_wallet=""
  outsider_wallet=""
  outcome_key=""
  r1_key=""
  r2_key=""
  r3_key=""
  outsider_key=""
}
trap cleanup EXIT

outcome="$(jq -r '.address' <<<"$outcome_wallet")"
r1="$(jq -r '.address' <<<"$r1_wallet")"
r2="$(jq -r '.address' <<<"$r2_wallet")"
r3="$(jq -r '.address' <<<"$r3_wallet")"
outsider="$(jq -r '.address' <<<"$outsider_wallet")"

outcome_key="$(jq -r '.private_key' <<<"$outcome_wallet")"
r1_key="$(jq -r '.private_key' <<<"$r1_wallet")"
r2_key="$(jq -r '.private_key' <<<"$r2_wallet")"
r3_key="$(jq -r '.private_key' <<<"$r3_wallet")"
outsider_key="$(jq -r '.private_key' <<<"$outsider_wallet")"

for value in "$outcome" "$r1" "$r2" "$r3" "$outsider"; do
  [[ "$value" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "FAIL: bad dummy address" >&2; exit 1; }
done

uniq_count="$(printf '%s\n' "$outcome" "$r1" "$r2" "$r3" "$outsider" | tr '[:upper:]' '[:lower:]' | sort -u | wc -l | tr -d ' ')"
[[ "$uniq_count" == "5" ]] || { echo "FAIL: dummy signer addresses are not distinct" >&2; exit 1; }

outcome_sig="$(cast wallet sign --private-key "$outcome_key" --no-hash "$DIGEST")"
r1_sig="$(cast wallet sign --private-key "$r1_key" --no-hash "$DIGEST")"
r2_sig="$(cast wallet sign --private-key "$r2_key" --no-hash "$DIGEST")"
r3_sig="$(cast wallet sign --private-key "$r3_key" --no-hash "$DIGEST")"
outsider_sig="$(cast wallet sign --private-key "$outsider_key" --no-hash "$DIGEST")"

cast wallet verify --address "$outcome" --no-hash "$DIGEST" "$outcome_sig" >/dev/null

cd "$ROOT"
accounts_json="$(curl -fsS -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_accounts","params":[]}' "$RPC")"
deployer="$(jq -r '.result[0]' <<<"$accounts_json")"
organizer="$(jq -r '.result[1]' <<<"$accounts_json")"
refund="$(jq -r '.result[2]' <<<"$accounts_json")"

for value in "$deployer" "$organizer" "$refund"; do
  [[ "$value" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "FAIL: local Anvil account unavailable" >&2; exit 1; }
done

if [[ "$(tr '[:upper:]' '[:lower:]' <<<"$organizer")" == "$(tr '[:upper:]' '[:lower:]' <<<"$outcome")" ]]; then
  echo "FAIL: organizer and outcome authority collide" >&2
  exit 1
fi

cd contracts/inkubator-vault
resolver_json="$(forge create src/ImmutableResolver1271.sol:ImmutableResolver1271   --rpc-url "$RPC"   --unlocked   --from "$deployer"   --broadcast   --json   --constructor-args "$r1" "$r2" "$r3")"
resolver="$(jq -r '.deployedTo' <<<"$resolver_json")"
[[ "$resolver" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "FAIL: resolver deployment failed" >&2; exit 1; }

magic12="$(cast call "$resolver" 'isValidSignature(bytes32,bytes)(bytes4)' "$DIGEST" "${r1_sig}${r2_sig#0x}" --rpc-url "$RPC")"
magic13="$(cast call "$resolver" 'isValidSignature(bytes32,bytes)(bytes4)' "$DIGEST" "${r1_sig}${r3_sig#0x}" --rpc-url "$RPC")"
magic23="$(cast call "$resolver" 'isValidSignature(bytes32,bytes)(bytes4)' "$DIGEST" "${r2_sig}${r3_sig#0x}" --rpc-url "$RPC")"
single="$(cast call "$resolver" 'isValidSignature(bytes32,bytes)(bytes4)' "$DIGEST" "$r1_sig" --rpc-url "$RPC")"
duplicate="$(cast call "$resolver" 'isValidSignature(bytes32,bytes)(bytes4)' "$DIGEST" "${r1_sig}${r1_sig#0x}" --rpc-url "$RPC")"
outsider_pair="$(cast call "$resolver" 'isValidSignature(bytes32,bytes)(bytes4)' "$DIGEST" "${r1_sig}${outsider_sig#0x}" --rpc-url "$RPC")"

[[ "$magic12" == "0x1626ba7e" && "$magic13" == "0x1626ba7e" && "$magic23" == "0x1626ba7e" ]] || {
  echo "FAIL: 2-of-3 resolver rehearsal failed" >&2
  exit 1
}
[[ "$single" == "0xffffffff" && "$duplicate" == "0xffffffff" && "$outsider_pair" == "0xffffffff" ]] || {
  echo "FAIL: resolver negative ceremony cases failed" >&2
  exit 1
}

[[ "$(cast call "$resolver" 'quorum()(uint8)' --rpc-url "$RPC")" == "2" ]] || {
  echo "FAIL: resolver quorum readback mismatch" >&2
  exit 1
}

challenge="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
terms="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
binding="0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
prebuild="0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
terminal="0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
prize="1234567"
activation="4102441000"
selection="4102442000"
resolution="4102443000"
longstop="4102444000"

cat >/tmp/j4-vault-args.txt <<ARGS
($NATIVE_USDC,$challenge,$terms,$binding,$prize,$activation,$selection,$resolution,$longstop,$refund,$outcome,$organizer,$resolver,$prebuild,$terminal)
ARGS

vault_json="$(forge create src/ProductionCandidateChallengeVault.sol:ProductionCandidateChallengeVault   --rpc-url "$RPC"   --unlocked   --from "$deployer"   --broadcast   --json   --constructor-args-path /tmp/j4-vault-args.txt)"
vault="$(jq -r '.deployedTo' <<<"$vault_json")"
rm -f /tmp/j4-vault-args.txt

[[ "$vault" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "FAIL: vault deployment failed" >&2; exit 1; }

normalize_immutable_runtime() {
  artifact="$1"
  runtime_hex="$2"
  node - "$artifact" "$runtime_hex" <<'NODE'
const fs = require('fs');
const artifact = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let hex = process.argv[3];
if (hex.startsWith('0x')) hex = hex.slice(2);
if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) throw new Error('runtime must be even-length hex');
const bytes = Buffer.from(hex, 'hex');
const refs = Object.values(artifact.deployedBytecode?.immutableReferences ?? {}).flat();
if (refs.length === 0) throw new Error('expected immutable references for J4 candidate');
for (const ref of refs) {
  if (!Number.isSafeInteger(ref.start) || !Number.isSafeInteger(ref.length) || ref.start < 0 || ref.length <= 0) {
    throw new Error('invalid immutable reference');
  }
  if (ref.start + ref.length > bytes.length) throw new Error('immutable reference outside runtime');
  bytes.fill(0, ref.start, ref.start + ref.length);
}
process.stdout.write('0x' + bytes.toString('hex'));
NODE
}

resolver_artifact="out/ImmutableResolver1271.sol/ImmutableResolver1271.json"
vault_artifact="out/ProductionCandidateChallengeVault.sol/ProductionCandidateChallengeVault.json"

resolver_template="$(jq -r '.deployedBytecode.object' "$resolver_artifact")"
vault_template="$(jq -r '.deployedBytecode.object' "$vault_artifact")"
resolver_runtime="$(cast code "$resolver" --rpc-url "$RPC")"
vault_runtime="$(cast code "$vault" --rpc-url "$RPC")"

resolver_template_exact_hash="$(cast keccak "$resolver_template")"
resolver_deployed_exact_hash="$(cast keccak "$resolver_runtime")"
vault_template_exact_hash="$(cast keccak "$vault_template")"
vault_deployed_exact_hash="$(cast keccak "$vault_runtime")"

# Solidity immutables are constructor-patched into deployed runtime. Exact hashes are expected
# to differ from the unpatched compiler template; compare normalized code identity instead.
[[ "$resolver_template_exact_hash" != "$resolver_deployed_exact_hash" ]] || {
  echo "FAIL: resolver rehearsal expected immutable runtime differentiation" >&2
  exit 1
}
[[ "$vault_template_exact_hash" != "$vault_deployed_exact_hash" ]] || {
  echo "FAIL: vault rehearsal expected immutable runtime differentiation" >&2
  exit 1
}

expected_resolver_hash="$(normalize_immutable_runtime "$resolver_artifact" "$resolver_template" | cast keccak)"
actual_resolver_hash="$(normalize_immutable_runtime "$resolver_artifact" "$resolver_runtime" | cast keccak)"
expected_vault_hash="$(normalize_immutable_runtime "$vault_artifact" "$vault_template" | cast keccak)"
actual_vault_hash="$(normalize_immutable_runtime "$vault_artifact" "$vault_runtime" | cast keccak)"

[[ "$expected_resolver_hash" == "$actual_resolver_hash" ]] || { echo "FAIL: resolver normalized runtime identity mismatch" >&2; exit 1; }
[[ "$expected_vault_hash" == "$actual_vault_hash" ]] || { echo "FAIL: vault normalized runtime identity mismatch" >&2; exit 1; }

# Bind the rehearsal to the repaired release receipt itself, not merely a local recomputation.
RESOLVER_SIGNER_SET_DIGEST="0x7777777777777777777777777777777777777777777777777777777777777777" \
SOURCE_COMMIT="$AUDITOR_SCOPE" \
node "$ROOT/scripts/inkubator/stage-j4-release-candidate.mjs" >/tmp/j4-readiness-release.json

release_schema="$(jq -r '.schema_version' /tmp/j4-readiness-release.json)"
release_mode="$(jq -r '.runtime_identity_mode' /tmp/j4-readiness-release.json)"
release_vault_template_hash="$(jq -r '.vault_runtime_template_hash' /tmp/j4-readiness-release.json)"
release_resolver_template_hash="$(jq -r '.resolver_runtime_template_hash' /tmp/j4-readiness-release.json)"
release_vault_layout_digest="$(jq -r '.vault_immutable_layout_digest' /tmp/j4-readiness-release.json)"
release_resolver_layout_digest="$(jq -r '.resolver_immutable_layout_digest' /tmp/j4-readiness-release.json)"

[[ "$release_schema" == "inkubator.production-candidate-release/1.1" ]] || {
  echo "FAIL: wrong release receipt schema: $release_schema" >&2
  exit 1
}
[[ "$release_mode" == "IMMUTABLE_NORMALIZED_TEMPLATE_PLUS_EXHAUSTIVE_READBACK" ]] || {
  echo "FAIL: wrong runtime identity mode: $release_mode" >&2
  exit 1
}
[[ "$release_vault_template_hash" == "$actual_vault_hash" ]] || {
  echo "FAIL: deployed vault does not normalize to frozen release template" >&2
  exit 1
}
[[ "$release_resolver_template_hash" == "$actual_resolver_hash" ]] || {
  echo "FAIL: deployed resolver does not normalize to frozen release template" >&2
  exit 1
}
[[ "$release_vault_layout_digest" =~ ^0x[0-9a-f]{64}$ ]] || {
  echo "FAIL: invalid vault immutable-layout digest" >&2
  exit 1
}
[[ "$release_resolver_layout_digest" =~ ^0x[0-9a-f]{64}$ ]] || {
  echo "FAIL: invalid resolver immutable-layout digest" >&2
  exit 1
}

read_addr() {
  cast call "$vault" "$1()(address)" --rpc-url "$RPC" | tr '[:upper:]' '[:lower:]'
}
read_b32() {
  cast call "$vault" "$1()(bytes32)" --rpc-url "$RPC" | tr '[:upper:]' '[:lower:]'
}
read_u256() {
  cast call "$vault" "$1()(uint256)" --rpc-url "$RPC" | awk '{print $1}'
}
assert_eq() {
  label="$1"
  actual="$2"
  expected="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $label readback mismatch: actual=$actual expected=$expected" >&2
    exit 1
  fi
}

assert_eq token "$(read_addr token)" "$(tr '[:upper:]' '[:lower:]' <<<"$NATIVE_USDC")"
assert_eq challengeDigest "$(read_b32 challengeDigest)" "$challenge"
assert_eq termsDigest "$(read_b32 termsDigest)" "$terms"
assert_eq bindingDigest "$(read_b32 bindingDigest)" "$binding"
assert_eq prizeAmount "$(read_u256 prizeAmount)" "$prize"
assert_eq activationDeadline "$(read_u256 activationDeadline)" "$activation"
assert_eq organizerSelectionDeadline "$(read_u256 organizerSelectionDeadline)" "$selection"
assert_eq resolutionDeadline "$(read_u256 resolutionDeadline)" "$resolution"
assert_eq terminalLongStop "$(read_u256 terminalLongStop)" "$longstop"
assert_eq refundRecipient "$(read_addr refundRecipient)" "$(tr '[:upper:]' '[:lower:]' <<<"$refund")"
assert_eq outcomeAuthority "$(read_addr outcomeAuthority)" "$(tr '[:upper:]' '[:lower:]' <<<"$outcome")"
assert_eq organizerSelectionAuthority "$(read_addr organizerSelectionAuthority)" "$(tr '[:upper:]' '[:lower:]' <<<"$organizer")"
assert_eq resolverAuthority "$(read_addr resolverAuthority)" "$(tr '[:upper:]' '[:lower:]' <<<"$resolver")"
assert_eq preBuildRefundManifestDigest "$(read_b32 preBuildRefundManifestDigest)" "$prebuild"
assert_eq terminalRefundManifestDigest "$(read_b32 terminalRefundManifestDigest)" "$terminal"

jq -n   --arg schema "inkubator.j4-production-readiness-rehearsal/1.0"   --arg authority "LOCAL_FORK_DUMMY_ONLY_NO_MAINNET_NO_REAL_VALUE"   --arg auditor_scope "$AUDITOR_SCOPE"   --arg outcome_address "$outcome"   --arg resolver_address "$resolver"   --arg resolver_signer_1 "$r1"   --arg resolver_signer_2 "$r2"   --arg resolver_signer_3 "$r3"   --arg vault_address "$vault"   --arg vault_runtime_template_hash "$actual_vault_hash"   --arg resolver_runtime_template_hash "$actual_resolver_hash"   --arg vault_deployed_runtime_hash "$vault_deployed_exact_hash"   --arg resolver_deployed_runtime_hash "$resolver_deployed_exact_hash"   --arg vault_immutable_layout_digest "$release_vault_layout_digest"   --arg resolver_immutable_layout_digest "$release_resolver_layout_digest"   --arg release_schema "$release_schema"   --arg runtime_identity_mode "$release_mode"   --arg native_usdc "$NATIVE_USDC"   '{
    schema:$schema,
    authority:$authority,
    auditor_scope:$auditor_scope,
    signer_rehearsal:{
      outcome_address:$outcome_address,
      resolver_address:$resolver_address,
      resolver_signers:[$resolver_signer_1,$resolver_signer_2,$resolver_signer_3],
      resolver_quorum:2,
      all_two_signer_pairs_valid:true,
      single_signer_rejected:true,
      duplicate_signer_rejected:true,
      outsider_pair_rejected:true,
      production_keys_created:false
    },
    deployment_rehearsal:{
      local_chain_id:31337,
      native_usdc:$native_usdc,
      vault_address:$vault_address,
      vault_runtime_template_hash:$vault_runtime_template_hash,
      resolver_runtime_template_hash:$resolver_runtime_template_hash,
      vault_deployed_runtime_hash:$vault_deployed_runtime_hash,
      resolver_deployed_runtime_hash:$resolver_deployed_runtime_hash,
      vault_immutable_layout_digest:$vault_immutable_layout_digest,
      resolver_immutable_layout_digest:$resolver_immutable_layout_digest,
      release_schema:$release_schema,
      runtime_identity_mode:$runtime_identity_mode,
      immutable_runtime_normalization_pass:true,
      release_receipt_binding_pass:true,
      immutable_readback_pass:true,
      m04_satisfied:false,
      production_money_authorized:false
    }
  }'
