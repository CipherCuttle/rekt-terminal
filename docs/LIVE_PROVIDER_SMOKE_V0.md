# LIVE_PROVIDER_SMOKE_V0

Status: `AUTHORIZED / BOUNDED_OPERATIONAL_QUALIFICATION`

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

On PASS: record a compact receipt containing pool identity, request counts, observed field/schema identities, provenance/currency assertions, and timestamp; then STOP.

On FAIL: preserve the receipt and open exactly one targeted provider-adapter repair. Do not redesign MARKET_TRUTH_V1 or expand product scope.
