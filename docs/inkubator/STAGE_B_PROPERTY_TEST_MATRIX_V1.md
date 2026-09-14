# REKT INKUBATOR — STAGE B PROPERTY-TEST MATRIX V1

**Status:** USER-AUTHORIZED PLANNING TEST CONTRACT / NO IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-13  
**Parent:** `STAGE_B_BUILD_CONTRACT_PROTOCOL_V1.md`

This document closes B-GATE-4. Stage B implementation is not complete because examples pass; it is complete only when the protocol behaves correctly across generated/permuted state, time, version and arithmetic cases.

The existing protocol package uses Node's built-in test runner. Stage B should prefer `node:test` plus deterministic generated case loops/helpers. Adding a property-testing dependency is optional only if it clearly reduces complexity and is separately justified.

## 1. Test principles

- Pure tests: no DB, network, clock, GitHub, model or chain.
- Deterministic random seed when generated cases are used.
- Every invariant must have at least one positive and one hostile/negative case where applicable.
- Replay failing generated input as a fixed regression fixture.
- Test integer minor-unit arithmetic only; no floating-point money.
- Test multiple mechanism/policy versions without allowing current code defaults to reinterpret frozen old cases.

Suggested Stage-B test families:

```text
test/challenge-state.test.mjs
test/build-contract.test.mjs
test/versioning.test.mjs
test/submission.test.mjs
test/qualification.test.mjs
test/default-resolution.test.mjs
test/settlement-ip.test.mjs
test/receipt.test.mjs
test/protocol-properties.test.mjs
```

Exact filenames are implementation details.

## 2. Lifecycle properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P001 | Only explicitly legal Challenge transitions succeed | generate every `(stateA,stateB)` pair; all non-edges reject |
| B-P002 | No lifecycle transition depends on hidden wall clock | patch/deny `Date.now`; all time transitions require caller `now` |
| B-P003 | `ENTRY_OPEN` cannot occur without a valid frozen contract | missing digest, missing normative ref digest, bad time ordering, unsupported version |
| B-P004 | `ENTRY_OPEN` freezes ordinary contract mutation | mutate each frozen field individually after open; reject |
| B-P005 | Below activation minimum can never enter `BUILDING` | seat count 0..min-1 across random mins |
| B-P006 | At/above activation minimum enters `BUILDING` only at valid due time | counts min..slot limit, now before/at/after deadline |
| B-P007 | All activated entries share identical build start and submission deadline | random seat sets/orderings |
| B-P008 | `SUBMISSIONS_LOCKED` cannot occur before submission deadline | now just before/at/after deadline |
| B-P009 | Zero final qualifiers never reaches subjective organizer selection | qualifier set empty |
| B-P010 | A non-final qualifier can never be selected | random entry sets with qualifier subset |
| B-P011 | Review deadline without valid organizer selection deterministically reaches default path | now before/at/after review deadline |
| B-P012 | Receipt filing requires terminal settlement/outcome fact | every nonterminal state rejects |

## 3. Build Contract / freeze / digest properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P020 | Canonical equivalent input produces identical digest | reorder object keys / equivalent serialization |
| B-P021 | Any semantic frozen-field change changes `terms_digest` | mutate each normative/frozen field one at a time |
| B-P022 | Normative reference content digest affects terms digest | same URL/id but different frozen content digest |
| B-P023 | Mutable informational URL cannot become qualification authority by itself | URL-only reference with no content digest marked informational |
| B-P024 | Preferences are frozen but do not affect qualification result | mutate preference only in pre-freeze contract; qualification evaluator ignores it |
| B-P025 | Reference architecture is advisory by default | change stack recommendation; identical normative qualification input produces same qualification |
| B-P026 | Promoted normative compatibility constraint can affect qualification | explicit normative constraint pass/fail |
| B-P027 | Material `UNKNOWN` may block contract readiness when policy marks it blocking | generated unknown severity/materiality |
| B-P028 | Digest does not claim truth/ownership/safety | API/output contains identity only; no derived proof flag from digest existence |

## 4. Versioning properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P030 | Challenge semantics resolve using stored `mechanism_version`, not current default | same frozen fixture interpreted under v1 vs hypothetical v2 registry |
| B-P031 | New mechanism version does not mutate old Challenge result | evaluate old fixture before/after registering newer version |
| B-P032 | Settlement policy version is frozen per Challenge | attempt policy replacement after `ENTRY_OPEN` |
| B-P033 | IP terms version is frozen per Challenge | attempt replacement after `ENTRY_OPEN` |
| B-P034 | Unsupported stored version fails closed | unknown mechanism/policy/IP version |
| B-P035 | Draft-only migration, if supported, cannot migrate active-liability state | DRAFT vs ENTRY_OPEN/BUILDING/etc |

## 5. Entry properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P040 | One builder identity cannot occupy two active seats in one Challenge | duplicate builder id |
| B-P041 | Same entry set activation outcome is order-independent | random permutation of entries |
| B-P042 | Pre-build withdrawal removes seat from activation count | withdrawn vs seated combinations |
| B-P043 | Post-activation abandonment does not reopen capacity | ACTIVE then no final submission |
| B-P044 | Competitor sealed data is not part of pre-reveal public projection contract | generated other-entry identity/source/progress fields rejected/omitted |
| B-P045 | Organizer/funder identity conflict is detectable by protocol invariant | same canonical identity/payout identifier where policy forbids |

Database race/unique enforcement is Stage C, but Stage B must expose deterministic validity semantics.

## 6. Submission properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P050 | Accepted-before-deadline manifest remains eligible independent of later archive status | archive pending/unavailable after valid acceptance |
| B-P051 | Accepted-after-deadline manifest never becomes final | timestamp just after deadline |
| B-P052 | Latest valid accepted-before-deadline manifest wins | random version/timestamp sequences |
| B-P053 | Invalid later manifest cannot displace earlier valid final candidate | valid then invalid before deadline |
| B-P054 | Mutable branch/live URL alone is insufficient artifact identity | missing immutable source/artifact digest |
| B-P055 | Wrong `terms_digest` invalidates submission | random other digest |
| B-P056 | Wrong Challenge/entry identity invalidates submission | swapped IDs |
| B-P057 | Archive failure reason does not silently rewrite submission acceptance time | PENDING/CAPTURED/PLATFORM_UNAVAILABLE/BUILDER_REVOKED |
| B-P058 | Builder-caused revocation state is distinguishable from platform unavailability | distinct enum/fact and outcome handling |

## 7. Qualification / policy / appeal properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P060 | Every mandatory normative criterion must PASS for `QUALIFIED` | generated PASS/FAIL/DISPUTED vectors |
| B-P061 | Any unresolved `DISPUTED` criterion prevents final `QUALIFIED` | mixed vectors |
| B-P062 | Preference values cannot turn FAIL into PASS or PASS into FAIL | random preference payloads |
| B-P063 | Organizer cannot introduce criterion absent from frozen contract | injected criterion id |
| B-P064 | Platform PolicyResolution is separate from qualification calculation | malware/fraud policy flag does not mutate criterion vector itself |
| B-P065 | Resolver may resolve criterion/evidence dispute but cannot choose taste winner | resolver command attempting selection rejects |
| B-P066 | Appeal budget is bounded to one builder appeal + one resolution | repeated appeal sequence rejects |
| B-P067 | Appeal cannot alter frozen criterion definition | appeal payload contains new requirement |

## 8. Default-resolution properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P070 | 0 qualifiers → refund/no-qualifier outcome | empty set |
| B-P071 | 1 qualifier → single-recipient winner payout intent | singleton set |
| B-P072 | 2+ qualifiers → default distribution, no winner | random n from 2..configured max |
| B-P073 | Default distribution conserves every minor unit | random prize integer and n >=2 |
| B-P074 | No default recipient receives more than one minor unit above another | random prize/n |
| B-P075 | Default split result is independent of input iteration order | permute qualifier array; canonical entry-id ordering wins |
| B-P076 | Default multi-qualifier distribution never triggers customer IP transfer | n >=2 |
| B-P077 | Deterministic remainder policy is stable across replay | same inputs repeated / serialization reordered |

## 9. Settlement / IP properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P080 | Settlement intent is not settlement execution | intent present, no finalized execution fact |
| B-P081 | Mismatched settlement evidence cannot settle | wrong challenge, contract, asset, amount or recipients |
| B-P082 | Unfinalized/ambiguous execution fact cannot produce production `SETTLED` | status pending/reorg/disputed |
| B-P083 | Correct finalized execution fact can settle exactly the authorized intent | matching generated intents/facts |
| B-P084 | Selected-but-unpaid winner never triggers IP transfer | selection + pending settlement |
| B-P085 | Finalized normal winner payout triggers IP-transfer fact exactly once | duplicate replay |
| B-P086 | Pre-build refund never triggers IP transfer | refund path |
| B-P087 | No-qualifier refund never triggers IP transfer | refund path |
| B-P088 | Multi-qualifier default distribution never triggers IP transfer | default path |
| B-P089 | Duplicate finalized execution fact is idempotent | same fact replayed N times |

Stage B does not validate an actual chain. Later adapters are responsible for producing trustworthy finalized execution facts.

## 10. Receipt properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P090 | Receipt cannot exist before terminal outcome | every preterminal state |
| B-P091 | Receipt references exact frozen `terms_digest` and version set | mismatched digest/version rejects |
| B-P092 | Filing same receipt command is idempotent | duplicate command |
| B-P093 | Historical receipt cannot be mutated in place | attempted field rewrite |
| B-P094 | Correction creates successor referencing prior receipt | valid correction |
| B-P095 | Correction cannot fabricate missing settlement execution fact | corrected monetary fields without evidence reject |
| B-P096 | Correction chain remains acyclic | self-reference / ancestor loop |
| B-P097 | Public receipt projection never needs private source contents | fixture with private source metadata |

## 11. Determinism / serialization properties

| ID | Property | Hostile cases / generated domain |
| --- | --- | --- |
| B-P100 | Same initial state + command + authoritative inputs → byte/semantic equivalent result | repeat across randomized object key order |
| B-P101 | Command evaluation does not depend on process locale/timezone | run fixtures under multiple TZ/locale settings where CI allows |
| B-P102 | Integer arithmetic never emits `NaN`, Infinity or fractional money | boundary values incl 0, 1, large safe integer/BigInt strategy |
| B-P103 | Invalid schema payload fails closed before transition | fuzz missing/wrong-type/extra prohibited fields |
| B-P104 | Unknown enum/version fails closed | random unknown strings/numbers |
| B-P105 | Canonical IDs/order produce stable default distribution and receipt digest | randomized input array order |

## 12. Boundary-value corpus

At minimum cover:

```text
slot_limit:          1, 2, default, max pilot
activation_minimum:  1, 2, equal slot limit
qualifier_count:     0, 1, 2, max
prize_minor_units:   0, 1, n-1, n, n+1, large values
timestamps:          deadline-1, deadline, deadline+1
submission_versions: duplicate, gaps, out-of-order
IDs:                 unicode-safe strings where allowed, max length, wrong identity
versions:            current, old supported, unknown
```

If zero prize is invalid for funded Challenge policy, schema validation should reject it; still test the arithmetic helper separately for mathematical totality if exposed.

## 13. Fixture strategy

Maintain three layers:

### Golden fixtures

Small human-readable canonical lifecycle examples.

### Hostile fixtures

Known invalid/attack/edge states.

### Generated properties

Seeded combinatorial/permutation cases that exercise state/time/arithmetic/version spaces.

When generated testing finds a defect, add the minimized input to hostile regression fixtures.

## 14. Stage-C carry-forward tests

These are important but do **not** belong in Stage-B pure protocol closure:

- 100 simultaneous final-seat attempts → exactly one last seat success;
- cross-instance idempotency;
- row-lock timeout behavior;
- public deadline GETs cause zero writes/locks;
- worker crash after commit;
- long lease heartbeat/renewal;
- production PgBouncer transaction-pool mode;
- duplicate webhook delivery;
- archive worker retry/revocation timing;
- production route inventory.

They become Stage C/H integration tests.

## 15. Exit gate

Stage B property-test gate passes only when:

```text
ALL REQUIRED B-Pxxx TESTS PASS
NO CRITICAL/HIGH HOSTILE-REVIEW FINDING REMAINS
NO DB/HTTP/MODEL/CHAIN DEPENDENCY ENTERS PURE PROTOCOL
FAILURES ARE REPLAYABLE FROM FIXTURES/SEEDS
```

A large line-count test suite is not the goal. The goal is proving the frozen invariants with the smallest comprehensible test machinery.
