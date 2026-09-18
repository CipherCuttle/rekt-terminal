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
| 12 | Owner reviews pending Assist | Owner sees only owner-private OFFERED Assist(s), including helper identity/message, and can accept one | authenticated owner-only pending-Assist projection + 4s polling + focus/reconnect + CHECK AGAIN on failure | REPAIRED |
| 13 | Owner accepts Assist | Pending offer disappears; Party membership becomes canonical OBSERVED collaboration | existing `acceptAssist` mutation + global query invalidation + Help/WORLD/PLAYER/PROJECT reconciliation | REPAIRED |
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

JCA-01 implementation head `fe2fec688c3746c6aab21041161d9eaeeabff803` passed all four repository gates. The closure-note successor `104311ad282b7e8c03a099bdb0f11239b4314b4a` also passed the same four gates with no code changes after the implementation head:

- CI — PASS
- Inkubator Verification — PASS
- Inkubator Signal System — PASS
- Inkubator Auth Foundation — PASS

The final verification covered generated-client currency, typecheck, unit/semantic tests, canonical production build, source/product-boundary invariants, Postgres integration tests, Lighthouse, bundle budgets, Storybook, Playwright journeys, axe, mobile and visual snapshots.

The owner-private pending-Assist endpoint is canonical OpenAPI but intentionally uses an inline response schema plus a product-private web client wrapper. It is not added to the generated public SDK surface, so pending helper messages cannot accidentally become part of a broad/public client contract. The generated API client therefore remains current without exposing the owner-only inbox.

## JCA-01 — CLOSED

The former HIGH continuity gap is repaired.

The bounded implementation now provides:

1. `GET /v1/projects/{projectId}/pending-assists` as an authenticated owner-only, `no-store` projection.
2. Anonymous access fails with 401; authenticated non-owners fail with 403.
3. The public `project.help_loop.public.v1` projection remains unchanged and never includes pending Assist messages.
4. COMMAND polls the private inbox while a Help Beacon is open, refreshes on focus/reconnect, and provides explicit retry on failure.
5. OFFERED Assists render helper identity/message plus `ACCEPT ASSIST`.
6. Acceptance uses the existing authoritative `acceptAssist` mutation, invalidates Inkubator projections, removes the pending offer and allows accepted Party state to reconcile.
7. Acceptance remains OBSERVED collaboration; it does not mint PROVEN state or advance Mission gates.
8. Integration coverage locks anonymous/non-owner denial, private-message non-leakage, owner read access, acceptance replay, pending-offer removal, Party attribution and truth-state ceilings.

No pending Assist message is exposed through WORLD or the public Help projection.

## Operational continuity note

The rehearsal Render service still stores the legacy branch while exact PR heads are deployed by a temporary ref handoff. This is not an end-user interaction defect, but a manual redeploy can revert the rehearsal build. Permanent Render branch/health configuration remains an operations closure task before Phase 9 closes.

## Phase-9 journey acceptance

The primary founding path now has an explicit product follow-up for every audited user state boundary. A real human rehearsal is still required before Phase 9 can close:

`BECOME → DECLARE → CONNECT → BUILD → HELP → TEST → SHIP → REMEMBER → REPEAT`

For every click that crosses a state boundary, the tester must be able to answer:

- Did the system receive my action?
- What is it waiting for now?
- Will this state update itself?
- What should I do next?
- Is what I am seeing CLAIMED, OBSERVED or PROVEN?

No silent dead-end, duplicate-create form, stale authorization selector, manual-refresh dependency or private-message leakage is acceptable on the founding path.
