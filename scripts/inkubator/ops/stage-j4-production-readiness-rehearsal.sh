#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

AUDITOR_SCOPE="05e345181dfde2c720874b1fc2d1ee7dd39272a9"
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

wallet_json="$(cast wallet new --number 5 --json)"
cleanup() {
  wallet_json=""
  outcome_key=""
  r1_key=""
  r2_key=""
  r3_key=""
  outsider_key=""
}
trap cleanup EXIT

outcome="$(jq -r '.[0].address' <<<"$wallet_json")"
r1="$(jq -r '.[1].address' <<<"$wallet_json")"
r2="$(jq -r '.[2].address' <<<"$wallet_json")"
r3="$(jq -r '.[3].address' <<<"$wallet_json")"
outsider="$(jq -r '.[4].address' <<<"$wallet_json")"

outcome_key="$(jq -r '.[0].private_key' <<<"$wallet_json")"
r1_key="$(jq -r '.[1].private_key' <<<"$wallet_json")"
r2_key="$(jq -r '.[2].private_key' <<<"$wallet_json")"
r3_key="$(jq -r '.[3].private_key' <<<"$wallet_json")"
outsider_key="$(jq -r '.[4].private_key' <<<"$wallet_json")"

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

expected_resolver_hash="$(forge inspect src/ImmutableResolver1271.sol:ImmutableResolver1271 deployedBytecode | cast keccak)"
actual_resolver_hash="$(cast code "$resolver" --rpc-url "$RPC" | cast keccak)"
expected_vault_hash="$(forge inspect src/ProductionCandidateChallengeVault.sol:ProductionCandidateChallengeVault deployedBytecode | cast keccak)"
actual_vault_hash="$(cast code "$vault" --rpc-url "$RPC" | cast keccak)"

[[ "$expected_resolver_hash" == "$actual_resolver_hash" ]] || { echo "FAIL: resolver runtime hash mismatch" >&2; exit 1; }
[[ "$expected_vault_hash" == "$actual_vault_hash" ]] || { echo "FAIL: vault runtime hash mismatch" >&2; exit 1; }

read_addr() {
  cast call "$vault" "$1()(address)" --rpc-url "$RPC" | tr '[:upper:]' '[:lower:]'
}
read_b32() {
  cast call "$vault" "$1()(bytes32)" --rpc-url "$RPC" | tr '[:upper:]' '[:lower:]'
}
read_u256() {
  cast call "$vault" "$1()(uint256)" --rpc-url "$RPC"
}

[[ "$(read_addr token)" == "$(tr '[:upper:]' '[:lower:]' <<<"$NATIVE_USDC")" ]] || exit 1
[[ "$(read_b32 challengeDigest)" == "$challenge" ]] || exit 1
[[ "$(read_b32 termsDigest)" == "$terms" ]] || exit 1
[[ "$(read_b32 bindingDigest)" == "$binding" ]] || exit 1
[[ "$(read_u256 prizeAmount)" == "$prize" ]] || exit 1
[[ "$(read_u256 activationDeadline)" == "$activation" ]] || exit 1
[[ "$(read_u256 organizerSelectionDeadline)" == "$selection" ]] || exit 1
[[ "$(read_u256 resolutionDeadline)" == "$resolution" ]] || exit 1
[[ "$(read_u256 terminalLongStop)" == "$longstop" ]] || exit 1
[[ "$(read_addr refundRecipient)" == "$(tr '[:upper:]' '[:lower:]' <<<"$refund")" ]] || exit 1
[[ "$(read_addr outcomeAuthority)" == "$(tr '[:upper:]' '[:lower:]' <<<"$outcome")" ]] || exit 1
[[ "$(read_addr organizerSelectionAuthority)" == "$(tr '[:upper:]' '[:lower:]' <<<"$organizer")" ]] || exit 1
[[ "$(read_addr resolverAuthority)" == "$(tr '[:upper:]' '[:lower:]' <<<"$resolver")" ]] || exit 1
[[ "$(read_b32 preBuildRefundManifestDigest)" == "$prebuild" ]] || exit 1
[[ "$(read_b32 terminalRefundManifestDigest)" == "$terminal" ]] || exit 1

jq -n   --arg schema "inkubator.j4-production-readiness-rehearsal/1.0"   --arg authority "LOCAL_FORK_DUMMY_ONLY_NO_MAINNET_NO_REAL_VALUE"   --arg auditor_scope "$AUDITOR_SCOPE"   --arg outcome_address "$outcome"   --arg resolver_address "$resolver"   --arg resolver_signer_1 "$r1"   --arg resolver_signer_2 "$r2"   --arg resolver_signer_3 "$r3"   --arg vault_address "$vault"   --arg vault_runtime_hash "$actual_vault_hash"   --arg resolver_runtime_hash "$actual_resolver_hash"   --arg native_usdc "$NATIVE_USDC"   '{
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
      vault_runtime_hash:$vault_runtime_hash,
      resolver_runtime_hash:$resolver_runtime_hash,
      immutable_readback_pass:true,
      m04_satisfied:false,
      production_money_authorized:false
    }
  }'
