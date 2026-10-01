# REKT INKUBATOR — UX3 TRUST + CHALLENGE PARTICIPATION V1

**Status:** USER-AUTHORIZED BOUNDED UX INTEGRATION  
**Date:** 2026-10-02  
**Branch:** `plan/inkubator-ux-journey-v1`  
**Merge authority:** NONE  
**Production-money authority:** NONE  
**Stage-I authority:** NONE

## Goal

Make the forward product feel like a coherent competition instead of an internal Challenge database:

```text
GitHub identity visible
→ bounded REKT session visible
→ Challenge reads like a human brief
→ builder Join is a real canonical seat command
→ unavailable Join states explain the exact blocker
```

## Implemented

### GitHub/session widget

Top-right account surface is backed by private server projections:
- `GET /v1/session`
- `GET /v1/me/connection`
- `GET /v1/github/repositories`

It shows:
- verified GitHub login + provider avatar;
- GitHub App authorization state;
- authorized repository count;
- REKT session remaining;
- 10-minute sensitive GitHub step-up boundary;
- reconnect/switch-account action;
- explicit sign-out.

GitHub App installation and REKT login session are presented as separate concepts.

### Session policy

Default REKT session TTL is now **8 hours absolute**.

Existing `INKUBATOR_SESSION_TTL_SECONDS` remains an explicit bounded override.

The 10-minute step-up freshness requirement for sensitive GitHub reconciliation remains unchanged.

Existing sessions are not retroactively shortened; the new TTL applies to newly created sessions unless deployment configuration explicitly overrides it.

### Human Challenge projection

The public Challenge read projection now exposes a safe frozen-contract summary:
- title;
- brief;
- optional human prize display;
- settlement asset label;
- frozen Done When criteria from outcome / production / delivery contracts.

It still does not expose:
- payout identities;
- private entry rows;
- private submission/source material;
- organizer private identity.

### Canonical Join

New authenticated route:

`POST /v1/challenges/:challengeId/entries`

The server:
- derives builder identity from the authenticated session;
- calls the existing Stage-C `acquireChallengeSeat()` authority;
- accepts no client-supplied builder player ID;
- preserves slot-limit / organizer-self-entry / reserved-payout / ENTRY_OPEN gates;
- does not substitute historical Project/Mission authority;
- creates no funding or settlement authority.

The UI requests a payout identity because funded-Challenge V1.1 requires one for the canonical seat record.

## Important remaining blocker

A newly created Challenge is `DRAFT`.

The frozen protocol lifecycle remains:

```text
DRAFT
→ AWAITING_FUNDING
→ FUNDED
→ ENTRY_OPEN
```

Therefore the UI must not make a freshly created pre-money Challenge joinable.

UX3 intentionally does **not**:
- fabricate a funding fact;
- treat `UNCONFIGURED:*` payout sentinels as money;
- introduce an unfunded pseudo-seat;
- skip protocol states;
- let organizers join their own Challenge.

The next lifecycle slice must decide and implement the real funding/open ceremony (or separately version an explicitly non-money rehearsal mechanism). Do not silently overload funded V1.1 for that purpose.

## Human interaction rule

Every Challenge state must answer:

> **Can I join right now? If not, what exact event must happen first?**

Examples:
- DRAFT → rules/funding/opening not complete;
- AWAITING_FUNDING → funding confirmation required;
- FUNDED → organizer has not opened entries;
- ENTRY_OPEN → Join is available;
- BUILDING+ → entry is closed.

## Verification targets

- 8-hour default config regression test;
- production route allowlist contains session/connection/join routes;
- unauthenticated session/connection/join reads/mutations fail closed;
- public contract summary does not leak restricted private fields;
- Challenge UI shows title/brief/Done When before technical IDs;
- Join calls the canonical seat route only in `ENTRY_OPEN`;
- organizer self-join remains rejected;
- GitHub widget distinguishes REKT session from GitHub App installation;
- mobile / axe / Playwright gates remain green.

No merge or deploy is authorized by this document.
