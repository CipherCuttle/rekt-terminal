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

rpc_nonce() {
  local block_tag="$1"
  curl --fail --silent --show-error \
    -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getTransactionCount\",\"params\":[\"$DEPLOYER_ADDRESS\",\"$block_tag\"]}" \
    "$INK_SEPOLIA_RPC_URL" | jq -r '.result // empty'
}

pending_hex=""
for attempt in $(seq 1 10); do
  pending_hex="$(rpc_nonce pending || true)"
  if [[ "$pending_hex" =~ ^0x[0-9a-fA-F]+$ ]]; then
    break
  fi
  sleep 1
done

if ! [[ "$pending_hex" =~ ^0x[0-9a-fA-F]+$ ]]; then
  echo "Unable to obtain Ink Sepolia pending nonce; refusing broadcast." >&2
  exit 65
fi

pending_dec="$((16#${pending_hex#0x}))"
latest_hex="$(rpc_nonce latest || true)"
echo "J2 broadcast nonce pin: pending=$pending_hex ($pending_dec), latest=${latest_hex:-unavailable}"

forge script "$script_ref" \
  --rpc-url "$INK_SEPOLIA_RPC_URL" \
  --broadcast \
  --slow \
  --sender-nonce "$pending_dec" \
  "$@"
