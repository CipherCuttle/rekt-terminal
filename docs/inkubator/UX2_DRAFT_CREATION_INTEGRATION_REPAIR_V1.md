# REKT INKUBATOR — UX2 DRAFT CREATION INTEGRATION REPAIR V1

**Status:** USER-AUTHORIZED BOUNDED UX INTEGRATION REPAIR  
**Date:** 2026-10-01  
**Branch:** `plan/inkubator-ux-journey-v1`  
**Parent:** `UX_JOURNEY_SIGNAL_FLOW_V1.md` + `UX0_CONTROL_SIGNAL_FLOW_INVENTORY_V1.md`  
**Production-money authority:** NONE  
**Stage-I authority:** NONE  
**Merge authority:** NONE

## Objective

Remove the manual `?challenge=<id>` prerequisite from the forward organizer journey.

Target:

```text
CREATE
→ describe build
→ set bounded Challenge schedule
→ authenticated canonical DRAFT created
→ Challenge context carried forward automatically
→ compile / accept
→ preview exact locked version
→ organizer-authenticated canonical rule lock
```

## Integration repair

The Stage-C store already owns the canonical transactional `createChallenge()` command, but H1 did not expose a production creation route.

UX2 adds exactly one privileged production route:

`POST /v1/challenges`

Authority:
`CHALLENGE_ORGANIZER`

The route:
- requires an authenticated session;
- derives organizer identity from the server session, never from client input;
- creates only `DRAFT` state through the existing Stage-C store;
- uses the currently frozen Challenge mechanism / settlement-policy / IP-term versions;
- accepts only bounded schedule/slot fields needed to create the durable Challenge container;
- returns the existing safe `challenge.public.v1` projection;
- grants no funding, settlement, payout, wallet, signing or Stage-I behavior.

## Pre-money payout boundary

Stage-C currently requires reserved organizer/funder payout identity strings at Challenge creation time.

UX2 creates pre-money drafts with explicit sentinel identities:

- `UNCONFIGURED:ORGANIZER:<challenge-id>`
- `UNCONFIGURED:FUNDER:<challenge-id>`

These are not wallet addresses and must never become settlement authority.

The settlement store guard therefore treats `UNCONFIGURED:*` exactly like missing payout authority and fails closed before settlement intent validation.

No route in this slice configures a payout identity.

## Forward auth return

The canonical GitHub login success/failure path for the forward product returns to:

`?surface=compiler`

rather than the historical `?mode=command` compatibility runtime.

Legacy install/source-control flows remain otherwise unchanged.

## User-facing fields

Draft creation asks for:
- builder slots;
- activation minimum;
- join deadline;
- build start;
- submission deadline;
- review deadline;
- appeal window.

No hidden timing policy is invented in this slice.

The UI validates only obvious ordering/positive-number constraints before request; durable store/protocol authority remains server-side.

## Frozen invariants

UX2 does not change:
- Build Contract digest law;
- deterministic compiler rules;
- organizer-accepted provenance requirement;
- preview noncanonical/nonpersisted semantics;
- canonical contract persistence re-derivation;
- Challenge lifecycle semantics;
- qualification/selection/receipt semantics;
- production-money prohibition;
- Stage-I prohibition.

## Verification

Because this modifies the frozen H1 production route manifest, closure requires:
1. exact route-inventory tests;
2. authenticated API build;
3. Inkubator frontend unit/build/E2E;
4. product-boundary verification;
5. one focused hostile review of the integration repair;
6. Critical/High repair + at most one targeted rereview if required.

Do not merge before those gates pass and the owner separately authorizes merge.
