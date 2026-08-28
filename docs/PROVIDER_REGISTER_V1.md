# Provider / Data-Rights Register V1

Status: `ACTIVE / REQUIRES_LEGAL_REVIEW_BEFORE_EPISODES_V0`

Retrieval date of this register: **2026-08-28**

Machine-readable form: [`provider-register.json`](./provider-register.json). The
JSON is authoritative for tooling; this document is the human-readable view and
the two must be kept in step.

## 1. Purpose

MARKET_TRUTH_V1 requires that every externally sourced fact the product relies
on can be traced to a named provider, a provenance class, and a statement about
what we are and are not permitted to do with it.

This register records what we consume today. It deliberately does **not** claim
permission we have not verified.

## 2. Scope note on verification

The rows below record each provider's rate limits and terms references as
documented by the provider. The `redistribution` column is our own assessment of
what this repository is currently entitled to do, and it is `REQUIRES_REVIEW`
everywhere that matters, because no commercial-terms review has been performed.

**Nothing in this register should be read as a legal opinion or as confirmation
that redistribution is permitted.**

Live provider endpoints were not reachable from the environment in which this
register was written (outbound HTTPS to `api.geckoterminal.com` was refused by
network policy), so field-level shapes are taken from each provider's published
API documentation rather than from a captured response. This is a limitation,
not a verification.

## 3. Register

### 3.1 GeckoTerminal — pools

| Field | Value |
| --- | --- |
| Provider | GeckoTerminal (CoinGecko) |
| Endpoint family | `GET /api/v2/networks/ink/pools` |
| Facts consumed | pool address, base/quote token identity, base token price in USD / native / quote token, reserve in USD, FDV, 24h volume, 24h buy/sell counts, price change percentages, pool creation time |
| Provenance class | `DERIVED` |
| Known rate limit | 30 calls/minute on the free public API tier |
| Retrieval date | 2026-08-28 |
| Persistence policy | In-memory only. Not written to disk, not cached across process restarts. |
| Redistribution | `REQUIRES_REVIEW` |
| Terms reference | https://www.geckoterminal.com/dex-api · https://www.coingecko.com/en/terms |

Aggregate figures computed by the provider over on-chain activity. They are
`DERIVED` and are **not** upgraded to `CONFIRMED` merely because the activity
underneath them occurred on a blockchain — the response carries no transaction
identity.

### 3.2 GeckoTerminal — OHLCV

| Field | Value |
| --- | --- |
| Provider | GeckoTerminal (CoinGecko) |
| Endpoint family | `GET /api/v2/networks/ink/pools/{pool}/ohlcv/{timeframe}` |
| Facts consumed | historical open/high/low/close/volume, denominated in USD or in the pool's quote token via the `currency`/`token` parameters |
| Provenance class | `DERIVED` |
| Known rate limit | 30 calls/minute on the free public API tier |
| Retrieval date | 2026-08-28 |
| Persistence policy | In-memory only, request-scoped. **No historical series is retained.** |
| Redistribution | `REQUIRES_REVIEW` — **blocking for EPISODES_V0** |
| Terms reference | https://www.geckoterminal.com/dex-api · https://www.coingecko.com/en/terms |

> **Flag for EPISODES_V0.**
> A future public episode archive would mean *retaining and republishing*
> provider historical datasets, which is materially different from displaying a
> live chart. Retention and redistribution rights must be established in writing
> before EPISODES_V0 publishes any retained provider dataset. This phase stores
> nothing, so the question is deferred, not answered.

### 3.3 GeckoTerminal — pool trades

| Field | Value |
| --- | --- |
| Provider | GeckoTerminal (CoinGecko) |
| Endpoint family | `GET /api/v2/networks/ink/pools/{pool}/trades` |
| Facts consumed | trade kind, transaction hash, block number, block timestamp, originating address, price in USD and in quote token, volume in USD |
| Provenance class | `CONFIRMED` when a transaction hash is present; otherwise `DERIVED` |
| Known rate limit | 30 calls/minute on the free public API tier |
| Retrieval date | 2026-08-28 |
| Persistence policy | In-memory only; a bounded per-pair set of recently seen trade ids exists purely for de-duplication and is discarded when the poller stops. |
| Redistribution | `REQUIRES_REVIEW` |
| Terms reference | https://www.geckoterminal.com/dex-api · https://www.coingecko.com/en/terms |

Transaction identity is what justifies `CONFIRMED` here. Addresses are passed
through verbatim when supplied; this phase makes **no wallet-behaviour claims**
from them.

### 3.4 Dexscreener — pair snapshot

| Field | Value |
| --- | --- |
| Provider | Dexscreener |
| Endpoint family | `GET /latest/dex/pairs/ink/{pairAddress}`, `GET /latest/dex/search` |
| Facts consumed | price in USD, price in native currency, 5-minute transaction counts, 5-minute volume, liquidity in USD, base/quote token symbols and addresses, pair creation time |
| Provenance class | `DERIVED` |
| Known rate limit | 300 requests/minute for the pairs and search endpoints |
| Retrieval date | 2026-08-28 |
| Persistence policy | In-memory only. One most-recent snapshot per actively subscribed pair, discarded when the last subscriber leaves. |
| Redistribution | `REQUIRES_REVIEW` |
| Terms reference | https://docs.dexscreener.com/api/reference · https://dexscreener.com/terms |

Polled once per pair every 2 000 ms by the shared server-side hub — 30
requests/minute/pair regardless of how many browser clients are connected,
against a documented 300/minute budget. The polling interval is configurable via
`MARKET_POLL_INTERVAL_MS` and is clamped to a 1 000 ms floor.

A polled snapshot is an **aggregate summary of a pool**, not a trade. It must
never be presented with the visual grammar of one confirmed swap.

### 3.5 Ink RPC — chain head and balances

| Field | Value |
| --- | --- |
| Provider | Ink public RPC (`rpc-gel.inkonchain.com`, `ws-gel.inkonchain.com`) |
| Endpoint family | JSON-RPC `eth_chainId`, `eth_blockNumber`, `eth_getBalance`; WebSocket `eth_subscribe("newHeads")` |
| Facts consumed | chain id, block number, block hash/parent hash, account ETH balance |
| Provenance class | `CONFIRMED` for chain heads; `UNAVAILABLE` for any wallet classification, which we do not compute |
| Known rate limit | Not published for the public gateway; treated as best-effort. Head subscription is one socket per client connection with bounded exponential reconnect backoff to 10 s. |
| Retrieval date | 2026-08-28 |
| Persistence policy | In-memory only. |
| Redistribution | `VERIFIED` — public chain state is not proprietary provider data |
| Terms reference | https://docs.inkonchain.com |

A signed chain head is direct evidence with strong identity, which is what
`CONFIRMED` means. `eth_getBalance` gives a balance and nothing else; the API
returns `UNAVAILABLE` for classification rather than inventing behavioural
conclusions about a real address.

### 3.6 Internal fixtures — DEMO environment

| Field | Value |
| --- | --- |
| Provider | None — fabricated in-repo (`apps/api/src/fixtures.ts`, `apps/web/src/lib/local-fixtures.ts`) |
| Endpoint family | n/a |
| Facts consumed | n/a — all values are seeded deterministically |
| Provenance class | `SYNTHETIC`, always |
| Known rate limit | n/a |
| Retrieval date | n/a |
| Persistence policy | Source-controlled constants. |
| Redistribution | `VERIFIED` — our own fabricated content |
| Terms reference | n/a |

Enforced by `scripts/verify-source.mjs`: these modules may not emit `CONFIRMED`
or `DERIVED`.

## 4. Standing constraints

1. No provider historical dataset is retained on disk in this phase.
2. No provider data is republished from this repository.
3. Redistribution rights are `REQUIRES_REVIEW` for every third-party row above.
4. EPISODES_V0 is blocked on §3.2 review before it may publish retained data.
5. Provenance for aggregate provider facts is `DERIVED`; it is not promoted to
   `CONFIRMED` on the grounds that the underlying activity was on-chain.
