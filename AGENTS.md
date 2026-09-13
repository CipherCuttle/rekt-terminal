# REKT//INK Agent Contract

This repository is contract-first. Do not reopen product scope while executing an implementation phase.

## Repository authority order

1. `docs/PRODUCT_BOUNDARIES_V1.md` for repository-wide product identity, runtime-root, deployment separation and cross-product import boundaries.
2. Product-specific canonical authority for the product being changed.
3. Active bounded phase contract/packet.
4. Existing runtime implementation.

If two authorities conflict, stop implementation at the conflicting surface and preserve evidence. Do not silently choose a convenient interpretation.

## REKT Inkubator authority hydration

For **any Inkubator planning or implementation work**, read `docs/inkubator/INDEX.md` first and follow the authority files it names.

As of 2026-09-13 the forward Inkubator direction is **not** the historical Player→Mission MVP roadmap or agent-first Challenge OS where those conflict with the new authority.

Current Inkubator hierarchy includes:

- `docs/inkubator/REKT_INKUBATOR_NORTH_STAR_V2.md` — product strategy + staged roadmap;
- `docs/inkubator/FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md` — near-term mechanism/trust constraints;
- `docs/inkubator/SOLO_OPERATOR_CONSTRAINTS_V1.md` — one-human operating constraint / Alpha cutline;
- `docs/inkubator/PRE_REVENUE_INFRA_CAP_V1.md` — bootstrap budget/operational-spend constraints;
- `docs/inkubator/THIRD_PARTY_SUBSTRATE_LOCK_V1.md` — external/open-source adoption boundary, pinned/fallback/removal rules and the approved product substrate composition;
- `docs/inkubator/PREIMPLEMENTATION_READINESS_V1.md` — stage planning/readiness gates;
- current stage-specific protocol/test contracts named by `docs/inkubator/INDEX.md`;
- `docs/inkubator/REKT_TECHNICAL_FACEPLATE_V1.md` — highest Inkubator visual execution authority.

### Current Inkubator planning state

Stage A planning is sufficiently complete.

The next implementation phase, **only when the user explicitly grants implementation authority**, is Stage B: pure versioned Challenge / Build Contract protocol work in `packages/inkubator-protocol`.

Do not infer implementation authority from a planning document, roadmap, PR existence or generic discussion.

Do not begin Stage C+ work, UI work, model integration, chain/payment work, or distant North-Star features while Stage B is active unless an explicit successor/scope decision authorizes it.

Historical Inkubator systems remain reusable substrate where compatible, but old public nouns/navigation do not regain authority merely because code exists.

### Third-party substrate rule

Do not rebuild commodity peripheral capabilities by default, and do not import a large generic agent platform by default.

Before adding/replacing an Inkubator third-party dependency, hydrate from `docs/inkubator/THIRD_PARTY_SUBSTRATE_LOCK_V1.md` and preserve its disposition/authority boundary. In particular:

- Inkubator owns Challenge/Build-Contract/economic truth;
- parsers, visualization engines, design formats, planning tools, linters and coding agents are replaceable substrate unless an authority document explicitly says otherwise;
- any third-party tool used for qualification must have its relevant version/config/rules frozen into the Challenge terms;
- an upstream outage or upgrade may not silently rewrite active `DONE WHEN` semantics;
- popular new repos are not authority to reopen the locked shortlist during an active phase.

## Completion policy

IMPLEMENT → TEST → ONE independent hostile review → fix Critical/High → ONE targeted re-review only if Critical/High fixes were needed → COMMIT → MOVE FORWARD.

Medium/Low findings do not restart a phase unless they invalidate the stated objective, evidence, a frozen invariant, or fail-closed/safety behavior.

## Frozen repository invariants

- REKT Terminal and REKT Inkubator are distinct products in one monorepo. Terminal runtime roots are `apps/web` + `apps/api`; Inkubator runtime roots remain governed by `docs/PRODUCT_BOUNDARIES_V1.md` until that frozen boundary is explicitly amended. Direct cross-product application imports/routing and a shared canonical deployment identity are forbidden. Shared packages/tooling do not merge product authority.
- REKT Terminal remains practice simulation only. No private keys, wallet signing, approvals, transaction broadcast, or real-money execution may be added to Terminal by Inkubator work.
- Market state, simulator state, Career state, Inkubator Challenge state and presentation effects are separate domains.
- React/UI must never be canonical accounting/economic state.
- Canonical financial quantities use explicit fixed-point/integer arithmetic; no unconstrained JS floating point in ledger/economic state.
- Unsupported/stale/ambiguous source data fails closed; never relabel fixtures as LIVE.
- Inkubator participant/client code cannot mint authoritative qualification, PROVEN evidence, receipt, settlement or payment facts merely by claiming them.

## RPS donor boundary

Frozen donor snapshot: `CipherCuttle/rugpull-tycoon@80db648a86c34dd99193b494c9e07b087f8c8681`.

Reuse architecture/patterns only as specified by `docs/RPS_REUSE_MATRIX_V1.md`. Do not import RPS fictional price physics, clicker economy, economic card buffs, Candle Chain, Supercharge/Overdrive economic bonuses, or RUG IT monetary semantics.

## Verification

Before closing a phase, run the strongest available commands from repository scripts plus phase-specific tests. Record exact commands and results. A missing network/dependency capability is a limitation, not a PASS.

Repository-wide changes must pass `npm run verify:product-boundaries` in addition to the active phase checks.
