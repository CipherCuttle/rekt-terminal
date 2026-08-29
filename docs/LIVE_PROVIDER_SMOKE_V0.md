# LIVE_PROVIDER_SMOKE_V0

Status: `CLOSED / PASS`

## Goal

Prove that one real GeckoTerminal Ink pool can traverse the MARKET_TRUTH_V1 live adapter without fallback, guessing, provenance strengthening, or currency mismatch.

## Scope

Use exactly one known Ink ETH/WETH-quoted pool.

Allowed provider work:

- one pool-metadata request;
- one OHLCV request;
- optionally one trades request if needed to exercise transaction-backed `CONFIRMED` vs aggregate `DERIVED` semantics.

No product/source changes unless this smoke test fails.

No DEMO fallback. No simulated trades. No Career progression. No feature work.

## PASS

All of the following must hold:

1. Base and quote identities resolve from provider fields, not display-name parsing.
2. Expected token addresses match the selected pool.
3. Chart currency equals the provider quote denomination.
4. OHLCV values are finite and structurally valid.
5. Provider aggregates remain `DERIVED`.
6. A trade is `CONFIRMED` only when transaction identity exists; otherwise it is no stronger than `DERIVED`.
7. No `SYNTHETIC` values appear anywhere in the LIVE response path.
8. No current-FX conversion is applied to historical candles.
9. No failure silently switches the environment to DEMO.
10. Provider request count remains inside the frozen request budget.

## FAIL

Fail closed on any:

- unresolved or mismatched token identity;
- provider schema mismatch;
- accidental provenance strengthening;
- chart/quote currency mismatch;
- synthetic value in LIVE;
- fallback to DEMO;
- undocumented field assumption required for correctness;
- request-budget violation.

## Closure

PASS observed at `2026-08-29T09:49:37.657Z` against frozen Ink pool `0x716ddc8df376488660e85eefda8df74f447c453a` (ANITA/WETH, InkySwap).

Observed qualification:

- exactly 3 GeckoTerminal requests;
- quote relationship resolved to Ink WETH `0x4200000000000000000000000000000000000006`;
- 20 finite OHLCV bars requested directly in quote-token denomination (`WETH`);
- pool aggregates and OHLCV remained `DERIVED`;
- 100 recent trades carried transaction identity and were classified `CONFIRMED`;
- no `SYNTHETIC` values appeared;
- no current-FX historical conversion occurred;
- no DEMO fallback occurred;
- no provider-adapter source change was required.

The first CI harness attempt failed before any provider request because its root TypeScript entry used top-level await under CommonJS transformation. The harness was wrapped in an async entrypoint and the bounded provider qualification then passed. The failed harness attempt consumed zero provider requests.

Canonical receipt: `docs/LIVE_PROVIDER_SMOKE_V0_RECEIPT.json`.

STOP. Next product phase is `RISK_SIZING_V0`; it is not part of this qualification.
