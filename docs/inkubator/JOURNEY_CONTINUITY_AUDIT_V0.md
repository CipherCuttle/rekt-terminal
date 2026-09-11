# REKT Inkubator — Journey Continuity Audit V0

Status: **ACTIVE / PHASE-9 REHEARSAL INPUT**

Purpose: verify that every end-user action in the founding workflow has an explicit follow-up state and that asynchronous authority changes are re-read without requiring the user to guess that a manual page refresh is needed.

## Continuity rule

Every user-directed mutation or external authorization step MUST expose this sequence where applicable:

`AVAILABLE → PENDING → SUCCESS OR ERROR → CANONICAL FOLLOW-UP → AUTOMATIC RECONCILIATION`

A success toast alone is not sufficient when the action is expected to create durable state. The UI must re-read the canonical projection that owns the resulting state. Polling/focus/reconnect are transport mechanisms only; they do not create evidence or truth.

Truth remains:

`CLAIMED ≠ OBSERVED ≠ PROVEN`

## Founding workflow audit

| # | Human action | Intended follow-up | Reconciliation mechanism | Status |
|---|---|---|---|---|
| 01 | Open Inkubator logged out | Understand product; enter with GitHub or inspect WORLD | Static entry + public WORLD | PASS |
| 02 | Sign in with GitHub | Authenticated Player session; return to COMMAND | OAuth callback + session + route reload | PASS |
| 03 | Declare first Mission | COMMAND becomes persistent home | Mutation invalidates Inkubator queries; Mission gate re-reads command | PASS |
| 04 | Authorize GitHub repositories | Authorized repository choices appear without blind refresh | `?source=authorized` return state + repository polling + window-focus + reconnect + CHECK NOW | REPAIRED |
| 05 | Link authorized repository | COMMAND source changes from unlinked to connected | Mutation invalidation + COMMAND polling | REPAIRED |
| 06 | Push/change repository | Source observation appears as OBSERVED, never client proof | webhook → dedupe/outbox → project observation → COMMAND polling | PASS |
| 07 | Edit current focus / Next Move / blocker | COMMAND updates to canonical Mission state | Mutation invalidation + COMMAND polling | PASS |
| 08 | Open Help Beacon | Create form becomes canonical OPEN beacon state; WORLD can expose it | Help-loop polling + focus/reconnect + mutation invalidation | REPAIRED |
| 09 | Close Help Beacon | Open state disappears and create path becomes available again | Mutation invalidation + help-loop polling | REPAIRED |
| 10 | Helper selects open Help in WORLD | Signed-in non-owner can offer an Assist; signed-out visitor is sent to GitHub login | WORLD project context + session check | REPAIRED |
| 11 | Helper offers Assist | Helper sees CLAIMED confirmation and waits for owner acceptance | Mutation success + global query invalidation | REPAIRED |
| 12 | Owner reviews pending Assist | Owner must see OFFERED Assist(s) and accept one | **No owner-private pending-Assist read projection exists yet** | BLOCKED_BY_CONTRACT |
| 13 | Owner accepts Assist | Party membership becomes canonical; WORLD/PLAYER can observe accepted contribution | Existing `acceptAssist` mutation + downstream projections, once #12 is exposed | BLOCKED_BY_CONTRACT |
| 14 | Owner requests external test | Create form becomes canonical OPEN test request | external-tests polling + focus/reconnect + mutation invalidation | REPAIRED |
| 15 | Tester selects project in WORLD | Signed-in non-owner can record result for an OPEN request | WORLD project external-test projection | REPAIRED |
| 16 | Tester records result | Result reads OBSERVED; request stops being OPEN | Mutation invalidation + external-tests/WORLD polling | REPAIRED |
| 17 | Builder marks Mission SHIP_READY | SHIP becomes canonical next destination | Mission update + COMMAND polling | PASS |
| 18 | Submit Ship artifact | SHIP advances from submitted into verifier state | mutation refetch + project Ship polling | PASS |
| 19 | Verifier completes | PASS/FAILED/UNAVAILABLE appears as observation, never proof by itself | server verifier observation + SHIP polling | PASS |
| 20 | Ship accepted | Immutable receipt becomes PROVEN | acceptance transaction + receipt projection + SHIP polling/history recovery | PASS |
| 21 | Return after Ship | PLAYER/SHIP preserve durable builder record | PLAYER history/reputation polling + receipt recovery | PASS |
| 22 | New WORLD activity arrives | New canonical signal appears and animates once | WORLD polling keyed by stable signal id | PASS |

## Verification receipt

The repaired journey-continuity lineage passed all four repository gates before deployment:

- CI — PASS
- Inkubator Verification — PASS
- Inkubator Signal System — PASS
- Inkubator Auth Foundation — PASS

Signal-System verification included source invariants, unit/semantic tests, typecheck/build, bundle budgets, Storybook, Playwright journeys, axe, mobile and visual snapshots. The generated API client contract remained current.

## Remaining product gap

### JCA-01 — Owner cannot discover pending Assist offers

Severity: **HIGH for full human rehearsal**

The write path exists:

- helper can create `AssistView(state=OFFERED)`;
- project owner can call `acceptAssist(assistId)`;
- accepted Assist creates Party attribution and downstream history.

But the current public `project.help_loop.public.v1` projection intentionally exposes only the owner, open Help Beacon and already accepted Party members. It does **not** expose pending private Assist offers. Therefore the web product cannot truthfully give the owner an “Accept Assist” control without first adding an authenticated owner-only pending-Assist projection.

Required bounded successor:

1. Add owner-private pending Assist read contract (no public leak).
2. Generate the client from the canonical OpenAPI contract.
3. Show OFFERED Assist(s) in COMMAND Help follow-up.
4. Wire `acceptAssist` from that canonical private projection.
5. On acceptance, invalidate Help/WORLD/PLAYER/PROJECT projections and show accepted Party state.
6. Test authorization, self-help prohibition, stale offer conflict and idempotent replay.

Do not expose pending Assist messages through WORLD or another public projection.

## Operational continuity note

The rehearsal Render service still stores the legacy branch while exact PR heads are deployed by a temporary ref handoff. This is not an end-user interaction defect, but a manual redeploy can revert the rehearsal build. Permanent Render branch/health configuration remains an operations closure task before Phase 9 closes.

## Phase-9 journey acceptance

A real rehearsal is ready only when a cold human can execute, without architecture coaching:

`BECOME → DECLARE → CONNECT → BUILD → HELP → TEST → SHIP → REMEMBER → REPEAT`

For every click that crosses a state boundary, the tester must be able to answer:

- Did the system receive my action?
- What is it waiting for now?
- Will this state update itself?
- What should I do next?
- Is what I am seeing CLAIMED, OBSERVED or PROVEN?

No silent dead-end, duplicate-create form, stale authorization selector, or manual-refresh dependency is acceptable on the founding path.
