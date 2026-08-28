# Architecture V1

`source -> normalization -> canonical API model -> client projection -> chart / UI`

Live discovery uses GeckoTerminal/Dexscreener. Ink block truth uses the public Ink RPC/WSS. Aggregate APIs are never promoted to trade-level buyer identity. Fixture mode is deterministic and exercises the complete UI.

## Source tiers

- `INK_WSS`: confirmed chain head only.
- `DEXSCREENER`: derived pair snapshots/discovery.
- `GECKOTERMINAL`: estimated/cached top pools, OHLCV and recent-trade enrichment.
- `FIXTURE_V1`: deterministic development truth.

## Fail closed

The REKT NFT live-sale adapter is intentionally not invented. Configure the actual REKT contract and marketplace evidence adapters before displaying live `SALE_CONFIRMED` events.
