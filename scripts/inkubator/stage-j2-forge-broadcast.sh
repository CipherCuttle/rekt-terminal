#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: stage-j2-forge-broadcast.sh <script-ref> [forge-args...]" >&2
  exit 64
fi

script_ref="$1"
shift

: "${INK_SEPOLIA_RPC_URL:?INK_SEPOLIA_RPC_URL is required}"
: "${DEPLOYER_ADDRESS:?DEPLOYER_ADDRESS is required}"

log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT

run_initial() {
  forge script "$script_ref" \
    --rpc-url "$INK_SEPOLIA_RPC_URL" \
    --broadcast \
    --slow \
    "$@"
}

set +e
run_initial "$@" 2>&1 | tee "$log_file"
status=${PIPESTATUS[0]}
set -e

if [ "$status" -eq 0 ]; then
  exit 0
fi

if ! grep -Fq 'EOA nonce changed unexpectedly while sending transactions' "$log_file"; then
  exit "$status"
fi

echo "Recoverable J2 RPC nonce drift detected; waiting for latest/pending nonce convergence before one bounded resume."

rpc_nonce() {
  local block_tag="$1"
  curl --fail --silent --show-error \
    -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getTransactionCount\",\"params\":[\"$DEPLOYER_ADDRESS\",\"$block_tag\"]}" \
    "$INK_SEPOLIA_RPC_URL" | jq -r '.result // empty'
}

converged=0
for attempt in $(seq 1 30); do
  latest="$(rpc_nonce latest || true)"
  pending="$(rpc_nonce pending || true)"
  if [[ "$latest" =~ ^0x[0-9a-fA-F]+$ ]] && [ "$latest" = "$pending" ]; then
    converged=1
    echo "Nonce view converged at $latest."
    break
  fi
  sleep 2
done

if [ "$converged" != "1" ]; then
  echo "Ink Sepolia nonce views did not converge; refusing to resume." >&2
  exit "$status"
fi

echo "Attempting exactly one Foundry --resume for the nonce-drift failure."
forge script "$script_ref" \
  --rpc-url "$INK_SEPOLIA_RPC_URL" \
  --broadcast \
  --slow \
  --resume \
  "$@"
