# PARTNER_CARTRIDGE_V0 — Apple Inu vertical

Status: **ISOLATED PROTOTYPE / NO MERGE AUTHORITY**

Base snapshot: `feature/inkubator-founding-cohort-rehearsal-v0@b4f3a1ff7228759127154a748a6bc65eb6690c7f`

This prototype tests one hypothesis:

> An external Ink project can inject bounded build demand into REKT Inkubator, a builder can turn that demand into an ordinary Mission, and a resulting canonical Ship can flow back to the partner surface without granting the partner any proof/reputation/Ship authority.

## Tested vertical

`WORLD → APPLE INU PORT → BITE-001 → BUILD THIS → ordinary Mission → canonical Ship pipeline → immutable origin on Ship artifact → reciprocal public embed`

The GitHub Action applies the candidate source changes only inside its CI checkout. Active Phase-9 branches are not mutated and the patch is not production authority.

## V0 boundary

- one operator-curated partner: Apple Inu;
- three build requests (BITES);
- Ink chain only (`57073`);
- no real transaction execution or wallet signing;
- no bounty custody/payment promise;
- no permissionless partner publishing;
- no partner ability to mark PROVEN, approve Ship, mint Cheevos or alter reputation;
- immutable partner origin is stored in the existing `mission.declared` history event;
- normal `/v1/missions` cannot spoof partner provenance.

## Hostile checks

- unknown cartridge fails closed;
- malformed contract address fails closed;
- unsupported chain fails closed;
- unverified partner reward cannot present as guaranteed;
- duplicate `BUILD THIS` is idempotent;
- semantic reuse of the same request id conflicts;
- participant-supplied partner/proof overrides are ignored/rejected;
- direct participant SHIPPED transition remains forbidden;
- canonical verifier + trusted acceptance is still required for PROVEN Ship;
- Ship artifact preserves original partner/build-request provenance;
- reciprocal embed exposes bounded public counts/artifact locators only;
- existing Phase-3 Mission and Phase-6 Ship regressions still pass.

## Clickable UX

Open `index.html` through a static raw-file host such as GitHack. It is deliberately a UI simulation; backend semantics are exercised separately against the actual Inkubator modules/Postgres in CI.

## Promotion rule

Do not merge this into Phase 9. If it passes and the UX is compelling, finish Phase 9 first, then reconstruct the minimal production changes as a normal bounded phase with OpenAPI/generated-client coverage.

If it feels like a partner directory rather than a demand → Mission → Ship loop, kill it.
