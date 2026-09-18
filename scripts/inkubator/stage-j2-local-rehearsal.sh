#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RPC_URL="http://127.0.0.1:8545"
CHAIN_ID="763373"
new_key() {
  while true; do
    candidate="0x$(openssl rand -hex 32)"
    if cast wallet address --private-key "$candidate" >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return
    fi
  done
}

export DEPLOYER_PRIVATE_KEY="$(new_key)"
DEPLOYER_ADDRESS="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
export J2_PRIZE_AMOUNT="250000000"
export J2_REFUND_RECIPIENT="$DEPLOYER_ADDRESS"
export J2_BUILDER_A="0x1111111111111111111111111111111111111111"
export J2_BUILDER_B="0x2222222222222222222222222222222222222222"
export J2_BUILDER_C="0x3333333333333333333333333333333333333333"

export J2_OUTCOME_PRIVATE_KEY="$(new_key)"
export J2_ORGANIZER_PRIVATE_KEY="$(new_key)"
export J2_RESOLVER_PRIVATE_KEY="$(new_key)"
export J2_OUTCOME_AUTHORITY="$(cast wallet address --private-key "$J2_OUTCOME_PRIVATE_KEY")"
export J2_ORGANIZER_AUTHORITY="$(cast wallet address --private-key "$J2_ORGANIZER_PRIVATE_KEY")"
export J2_RESOLVER_AUTHORITY="$(cast wallet address --private-key "$J2_RESOLVER_PRIVATE_KEY")"

WORKDIR="$(mktemp -d)"
ANVIL_LOG="$WORKDIR/anvil.log"
trap 'kill "${ANVIL_PID:-}" 2>/dev/null || true; rm -rf "$WORKDIR"' EXIT

anvil --silent --chain-id "$CHAIN_ID" --port 8545 >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!

ready=0
for _ in $(seq 1 40); do
  if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then
  cat "$ANVIL_LOG"
  echo "J2 local Anvil failed to start" >&2
  exit 1
fi
test "$(cast chain-id --rpc-url "$RPC_URL")" = "$CHAIN_ID"
cast rpc anvil_setBalance "$DEPLOYER_ADDRESS" 0x3635C9ADC5DEA00000 --rpc-url "$RPC_URL" >/dev/null

rm -rf "$ROOT/contracts/inkubator-vault/broadcast"

pushd "$ROOT/contracts/inkubator-vault" >/dev/null
forge script script/StageJ2TokenDeploy.s.sol:StageJ2TokenDeploy --rpc-url "$RPC_URL" --broadcast --slow
TOKEN_BROADCAST="broadcast/StageJ2TokenDeploy.s.sol/$CHAIN_ID/run-latest.json"
export J2_TOKEN_ADDRESS="$(jq -r '[.transactions[] | select(.transactionType == "CREATE" and .contractName == "StageJ2RehearsalToken")][0].contractAddress // empty' "$TOKEN_BROADCAST")"
test "$J2_TOKEN_ADDRESS" != ""
popd >/dev/null

export J2_CHALLENGE_ID="CH-J2-LOCAL-REHEARSAL"
export J2_FIXTURE_OUT="$WORKDIR/fixture.json"
node "$ROOT/scripts/inkubator/stage-j2-fixture.mjs" >"$WORKDIR/fixture-summary.json"

export J2_CHALLENGE_DIGEST="$(jq -r '.vault_plan.challenge_digest' "$WORKDIR/fixture.json")"
export J2_TERMS_DIGEST="$(jq -r '.vault_plan.terms_digest' "$WORKDIR/fixture.json")"
export J2_BINDING_DIGEST="$(jq -r '.vault_plan.binding_digest' "$WORKDIR/fixture.json")"
export J2_SELECTION_DEADLINE_SECONDS="$(jq -r '.vault_plan.organizer_selection_deadline_seconds' "$WORKDIR/fixture.json")"
export J2_PLAN_DIGEST="$(jq -r '.vault_plan.plan_digest' "$WORKDIR/fixture.json")"
export J2_WINNER_MANIFEST_DIGEST="0x$(jq -r '.scenarios.organizer_winner.manifest.manifest_digest' "$WORKDIR/fixture.json")"
export J2_DEFAULT_MANIFEST_DIGEST="0x$(jq -r '.scenarios.frozen_default_distribution.manifest.manifest_digest' "$WORKDIR/fixture.json")"
export J2_REFUND_MANIFEST_DIGEST="0x$(jq -r '.scenarios.zero_qualifier_refund.manifest.manifest_digest' "$WORKDIR/fixture.json")"

deploy_scenario() {
  local script_name="$1"
  local contract_name="$2"
  local output_var="$3"

  pushd "$ROOT/contracts/inkubator-vault" >/dev/null
  forge script "script/$script_name.s.sol:$contract_name" --rpc-url "$RPC_URL" --broadcast --slow
  local broadcast="broadcast/$script_name.s.sol/$CHAIN_ID/run-latest.json"
  local vault
  vault="$(jq -r '[.transactions[] | select(.transactionType == "CREATE" and .contractName == "TestnetChallengeVault")][0].contractAddress // empty' "$broadcast")"
  popd >/dev/null

  test "$vault" != ""
  printf -v "$output_var" '%s' "$vault"
  export "$output_var"
}

deploy_scenario "StageJ2WinnerDeploy" "StageJ2WinnerDeploy" J2_WINNER_VAULT
deploy_scenario "StageJ2DefaultSetup" "StageJ2DefaultSetup" J2_DEFAULT_VAULT
deploy_scenario "StageJ2RefundDeploy" "StageJ2RefundDeploy" J2_REFUND_VAULT

snapshot() {
  local vault="$1"
  local output="$2"
  local token challenge terms binding prize deadline refund outcome organizer resolver

  token="$(cast call "$vault" 'token()(address)' --rpc-url "$RPC_URL")"
  challenge="$(cast call "$vault" 'challengeDigest()(bytes32)' --rpc-url "$RPC_URL")"
  terms="$(cast call "$vault" 'termsDigest()(bytes32)' --rpc-url "$RPC_URL")"
  binding="$(cast call "$vault" 'bindingDigest()(bytes32)' --rpc-url "$RPC_URL")"
  prize="$(cast call "$vault" 'prizeAmount()(uint256)' --rpc-url "$RPC_URL" | awk '{print $1}')"
  deadline="$(cast call "$vault" 'organizerSelectionDeadline()(uint256)' --rpc-url "$RPC_URL" | awk '{print $1}')"
  refund="$(cast call "$vault" 'refundRecipient()(address)' --rpc-url "$RPC_URL")"
  outcome="$(cast call "$vault" 'outcomeAuthority()(address)' --rpc-url "$RPC_URL")"
  organizer="$(cast call "$vault" 'organizerSelectionAuthority()(address)' --rpc-url "$RPC_URL")"
  resolver="$(cast call "$vault" 'resolverAuthority()(address)' --rpc-url "$RPC_URL")"

  jq -n     --arg plan_digest "$J2_PLAN_DIGEST"     --arg vault_address "$vault"     --argjson chain_id "$CHAIN_ID"     --arg token_address "$token"     --arg challenge_digest "$challenge"     --arg terms_digest "$terms"     --arg binding_digest "$binding"     --argjson prize_minor_units "$prize"     --argjson organizer_selection_deadline_seconds "$deadline"     --arg refund_recipient "$refund"     --arg outcome_authority "$outcome"     --arg organizer_selection_authority "$organizer"     --arg resolver_authority "$resolver"     '{
      schema_version:"inkubator.testnet-vault-snapshot/1.0",
      plan_digest:$plan_digest,
      vault_address:$vault_address,
      chain_id:$chain_id,
      token_address:$token_address,
      challenge_digest:$challenge_digest,
      terms_digest:$terms_digest,
      binding_digest:$binding_digest,
      prize_minor_units:$prize_minor_units,
      organizer_selection_deadline_seconds:$organizer_selection_deadline_seconds,
      refund_recipient:$refund_recipient,
      outcome_authority:$outcome_authority,
      organizer_selection_authority:$organizer_selection_authority,
      resolver_authority:$resolver_authority
    }' >"$output"

  node "$ROOT/scripts/inkubator/stage-j2-verify-snapshot.mjs" "$WORKDIR/fixture.json" "$output" >/dev/null
}

snapshot "$J2_WINNER_VAULT" "$WORKDIR/winner-snapshot.json"
snapshot "$J2_DEFAULT_VAULT" "$WORKDIR/default-snapshot.json"
snapshot "$J2_REFUND_VAULT" "$WORKDIR/refund-snapshot.json"

test "$(cast call "$J2_WINNER_VAULT" 'isFinalized()(bool)' --rpc-url "$RPC_URL")" = "true"
test "$(cast call "$J2_DEFAULT_VAULT" 'isFinalized()(bool)' --rpc-url "$RPC_URL")" = "false"
test "$(cast call "$J2_REFUND_VAULT" 'isFinalized()(bool)' --rpc-url "$RPC_URL")" = "true"

cast rpc evm_setNextBlockTimestamp "$J2_SELECTION_DEADLINE_SECONDS" --rpc-url "$RPC_URL" >/dev/null
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null

pushd "$ROOT/contracts/inkubator-vault" >/dev/null
forge script script/StageJ2DefaultSettle.s.sol:StageJ2DefaultSettle --rpc-url "$RPC_URL" --broadcast --slow
popd >/dev/null

for vault in "$J2_WINNER_VAULT" "$J2_DEFAULT_VAULT" "$J2_REFUND_VAULT"; do
  test "$(cast call "$vault" 'isFinalized()(bool)' --rpc-url "$RPC_URL")" = "true"
  test "$(cast call "$J2_TOKEN_ADDRESS" 'balanceOf(address)(uint256)' "$vault" --rpc-url "$RPC_URL" | awk '{print $1}')" = "0"
done

base=$((J2_PRIZE_AMOUNT / 3))
remainder=$((J2_PRIZE_AMOUNT % 3))
expected_a=$((J2_PRIZE_AMOUNT + base + (remainder > 0 ? 1 : 0)))
expected_b=$((base + (remainder > 1 ? 1 : 0)))
expected_c=$((base + (remainder > 2 ? 1 : 0)))
expected_refund=$J2_PRIZE_AMOUNT

test "$(cast call "$J2_TOKEN_ADDRESS" 'balanceOf(address)(uint256)' "$J2_BUILDER_A" --rpc-url "$RPC_URL" | awk '{print $1}')" = "$expected_a"
test "$(cast call "$J2_TOKEN_ADDRESS" 'balanceOf(address)(uint256)' "$J2_BUILDER_B" --rpc-url "$RPC_URL" | awk '{print $1}')" = "$expected_b"
test "$(cast call "$J2_TOKEN_ADDRESS" 'balanceOf(address)(uint256)' "$J2_BUILDER_C" --rpc-url "$RPC_URL" | awk '{print $1}')" = "$expected_c"
test "$(cast call "$J2_TOKEN_ADDRESS" 'balanceOf(address)(uint256)' "$J2_REFUND_RECIPIENT" --rpc-url "$RPC_URL" | awk '{print $1}')" = "$expected_refund"
test "$(cast call "$J2_TOKEN_ADDRESS" 'totalSupply()(uint256)' --rpc-url "$RPC_URL" | awk '{print $1}')" = "$((J2_PRIZE_AMOUNT * 3))"

echo "STAGE_J2_LOCAL_REHEARSAL_PASS"
