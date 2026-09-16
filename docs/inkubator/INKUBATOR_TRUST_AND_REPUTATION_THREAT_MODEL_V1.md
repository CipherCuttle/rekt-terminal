# REKT INKUBATOR — TRUST & REPUTATION THREAT MODEL V1

**Status:** USER-AUTHORIZED STAGE-H AUTHORITY LOCK  
**Date:** 2026-09-16  
**Branch:** `agent/stage-h-trust-hardening-authority-v1`  
**Parent authority:** Stage-G closure head `04365d2d4a20948c15d76d02c566499c5ed5bd57`  
**Implementation authority:** H1–H6 only, in order, after this authority lock passes exact-head verification  
**Production-money authority:** NONE  
**Merge authority:** NONE

This document is the dedicated threat-model authority required by `REKT_INKUBATOR_NORTH_STAR_V2.md` before external-human Alpha. It narrows Stage H into bounded implementation gates. It does not authorize settlement execution, production money, wallet custody/signing/broadcast, arbitrary participant-code execution, hidden tests, LLM judging/scoring, or merge.

The permanent trust invariant is:

> **No single compromise or mistake may silently alter Challenge rules, expose all private work, fabricate evidence, choose a winner, or redirect settlement.**

The communication invariant is:

> **Never claim more certainty than the evidence supports.**

---

## 1. Protected assets and authorities

### Product-rule authority

Protected:
- frozen Build Contract and terms digest;
- normative references / acceptance manifest / module identity;
- Challenge lifecycle state;
- final submission identity;
- objective qualification result;
- final qualifier set;
- organizer selection among qualifiers;
- append-only receipts and corrections.

A model, browser response, third-party webhook, organizer preference, runtime adapter, support/admin action, or cache may never become a parallel source of truth for these facts.

### Private material

Protected:
- private repository/source snapshots;
- private archive references/object keys;
- GitHub installation/repository identity where not product-public;
- raw evidence not justified for public projection;
- session material, OAuth/PKCE state and provider tokens;
- payout identities / future settlement authority;
- audit/operator metadata.

### Reputation material

Protected:
- qualification and selection history;
- receipt lineage;
- Builder Passport inputs;
- corrections and disputes.

Reputation may only be derived from durable product authority. A single opaque score is not authorized.

---

## 2. Trust boundaries

1. **Human/browser → API**: all body, params, cookies, URLs and rich text are untrusted input.
2. **LLM/compiler provider → deterministic core**: model output is untrusted proposal input only.
3. **GitHub/provider webhooks → repository state**: exact-byte authentication + provider identity are required; webhook content is observation, not product authority by itself.
4. **API → PostgreSQL**: DB constraints/triggers/transactions are canonical concurrency and lifecycle authority where already established.
5. **Workers → durable domain state**: at-least-once execution; business effects require idempotency, immutable lineage and replay-safe keys.
6. **API/workers → private object storage**: object references are private operational data, never public receipt/reveal facts.
7. **Verifier/runner → Test Arena**: runner outputs are observations under a content-addressed trusted registry, not caller-supplied PASS authority.
8. **Organizer/admin/resolver → exceptional actions**: normal organizer authority cannot silently become resolver/admin authority; privileged actions require distinct authorization and audit.
9. **Application → future settlement layer**: no production-value authority exists in Stage H.
10. **Backups/logs/telemetry → retained data**: secondary copies must not defeat retention, deletion or privacy boundaries.

---

## 3. Adversary classes

Stage H must assume:
- unauthenticated internet attacker;
- authenticated but malicious builder;
- malicious/compromised organizer;
- compromised GitHub account/session;
- compromised provider/webhook source;
- compromised model output / prompt injection;
- malicious submitted repository/content;
- accidental or malicious operator/admin/resolver;
- stale worker / duplicate delivery / race condition;
- dependency or blueprint supply-chain compromise;
- object-store or DB partial outage;
- backup/restore drift;
- accidental deployment of dev/legacy routes;
- insider or log/telemetry leakage;
- future settlement integration mismatch.

Stage H does **not** pretend to solve nation-state compromise, arbitrary zero-days in the hosting platform, or audited mainnet smart-contract security. Those are separate risk classes and later gates.

---

## 4. Critical threat catalogue

### T1 — Compiler false authority / prompt injection

Failure:
- malicious prompt/reference convinces the system to treat model text as frozen law, bypass mandatory criteria, leak secrets, or alter acceptance semantics.

Required controls:
- deterministic schema validation and explicit organizer acceptance remain canonical;
- no provider output directly mutates frozen Challenge authority;
- untrusted source/reference text never becomes instruction to privileged tooling;
- provider absence/failure cannot block core Challenge operations already frozen;
- prompt/model transcripts are not qualification authority.

Exit evidence:
- adversarial compiler fixtures proving instruction injection cannot alter frozen structured authority;
- zero-inference core-operation test.

### T2 — Blueprint / module supply-chain substitution

Failure:
- module name/version is preserved while executable semantics change, or a mutable external dependency changes an active Challenge.

Required controls:
- version + digest identity for normative modules;
- immutable/content-addressed references for active Challenge semantics;
- registry fail-closed on unknown or digest-mismatched implementation;
- provenance recorded for promoted production modules;
- dependency drift cannot silently update active Challenge law.

Exit evidence:
- digest-substitution regression;
- registry/provenance inventory.

### T3 — Private-source leakage

Failure:
- reveal, comparison, receipt, history, errors, logs, metrics, public routes or object-storage URLs expose losing/private source or archive internals.

Required controls:
- explicit safe projections rather than raw row/object serialization;
- no public archive/object references;
- error responses contain bounded identifiers only;
- private-source reads require authenticated scoped authority;
- logging/telemetry forbid tokens, cookies, source contents, archive keys and raw private evidence;
- retention/deletion policy covers primary and backup copies.

Exit evidence:
- route-level negative disclosure tests;
- log/telemetry redaction tests;
- data inventory + retention matrix.

### T4 — Account takeover / session confusion

Failure:
- stolen/replayed session, OAuth state, provider token or identity re-parenting allows another user to act as organizer/builder or seize repository authority.

Required controls:
- opaque server-side sessions with bounded TTL and secure cookies;
- PKCE/state single-use behavior;
- stable provider numeric identity remains canonical;
- repository installation ownership cannot be re-parented by untrusted callback/body data;
- privileged actions cannot rely on display names/email alone;
- security-sensitive credential rotation has a tested runbook.

Exit evidence:
- auth/replay/re-parenting suite remains green;
- rotation drill documented and tested without weakening identity authority.

### T5 — Organizer / resolver / admin authority collapse

Failure:
- organizer or ordinary app operator can rewrite qualification, resolve their own dispute, alter receipt history, or redirect privileged policy actions.

Required controls:
- qualification remains frozen-criteria authority;
- preference only selects among final qualifiers;
- exceptional moderation/resolution uses separate authorization surface;
- self-resolution/conflict of interest is forbidden;
- every privileged mutation is append-only/audited with actor, operation, target and reason reference;
- no generic "admin update row" path over economic/trust facts.

Exit evidence:
- route/role matrix + negative authorization tests;
- append-only privileged audit proof.

### T6 — Evidence fabrication / tampering / correction abuse

Failure:
- caller supplies trusted automated PASS, worker rewrites evidence, correction replaces history, or replay creates contradictory facts.

Required controls:
- trusted runner registry creates automated observations server-side;
- evidence/result lineage binds Challenge, terms, entry, final submission and module identity;
- persisted qualifications/decisions/receipts stay immutable;
- corrections supersede; never mutate historical facts;
- exact replay returns prior semantic result; changed retries fail closed.

Exit evidence:
- existing G2/G3 adversarial tests remain part of Stage-H regression gate;
- mutation/delete attempts fail at durable boundary.

### T7 — Production route drift / forgotten legacy surface

Failure:
- old WORLD/MISSION/HELP/DEVKIT/dev/test/admin route becomes reachable in funded-Challenge production merely because code exists.

Required controls:
- explicit production route manifest/assembly;
- deny-by-default production registration;
- automated route inventory snapshot/allowlist;
- dev auth/test/bootstrap impossible when production mode is enabled;
- both supported runtime entrypoints must use the same production surface.

Exit evidence:
- production route inventory test fails on any unapproved route;
- route diff is reviewed as a trust-boundary change.

### T8 — Rate/concurrency abuse

Failure:
- burst/replay creates duplicate seats/submissions/selections, resource starvation, lock amplification, or bypasses per-process limits across replicas.

Required controls:
- DB uniqueness/transactions remain economic concurrency authority;
- sensitive quotas are shared/durable, not process-local;
- public GETs remain pure and do not cause deadline writes/locks;
- bounded lock/transaction behavior under contention;
- 409/429 expected conflicts distinct from 5xx/invariant failure.

Exit evidence:
- burst tests for seat/submission/selection/idempotency;
- load profile records lock wait, connection saturation, 5xx, invariant violations.

### T9 — Worker lease / partial-failure duplication

Failure:
- worker crashes after durable side effect but before job completion, stale lease duplicates work, or retry loses evidence.

Required controls:
- idempotent downstream keys and reconciliation;
- replay-safe domain commands;
- long jobs support safe lease duration/renewal where needed;
- no worker result alone becomes authority without canonical persistence checks.

Exit evidence:
- crash-point/replay tests for archive/evaluation paths;
- oldest-job age and retry exhaustion are observable.

### T10 — Backup / restore authority divergence

Failure:
- restored DB/object storage contains mismatched authority, loses append-only facts, resurrects deleted private data, or restores an inconsistent terms/evidence pairing.

Required controls:
- documented backup scope/RPO/RTO assumptions;
- restore into isolated environment;
- post-restore invariant suite verifies Challenge/contract/submission/qualification/decision/receipt lineage;
- private-source retention/deletion semantics explicitly state backup behavior;
- restore never silently points at production external side effects.

Exit evidence:
- repeatable restore drill with invariant report.

### T11 — Verifier / runner breakout or SSRF

Failure:
- submitted URL/content reaches internal network, cloud metadata, credentials, filesystem, or arbitrary code execution under application authority.

Required controls:
- verifier is an isolated boundary with explicit egress/target policy;
- no private/link-local/loopback metadata targets unless explicitly test-only;
- bounded body/time/redirect behavior;
- participant code execution is NOT authorized by this Stage-H V1;
- safe modules operate on bounded artifacts/observations only.

Exit evidence:
- SSRF/redirect/size/timeout negative tests at the verifier boundary;
- architecture proves app credentials are not present in verifier context.

### T12 — Retention / erasure / telemetry conflict

Failure:
- source deletion succeeds in primary object store but backups/logs/analytics retain unnecessary private data indefinitely, or account deletion corrupts durable receipts/liabilities.

Required controls:
- field-level data inventory;
- retention class per datum;
- active-liability hold semantics;
- source deletion/pseudonymisation separate from durable minimal receipt facts;
- backup deletion/expiry behavior documented;
- no third-party analytics required for Alpha.

Exit evidence:
- retention matrix + deletion rehearsal;
- public history remains coherent after allowed pseudonymisation.

### T13 — Incident-response failure

Failure:
- compromise is detected but there is no bounded way to stop new writes, revoke provider credentials, preserve evidence, communicate scope, or recover without rewriting history.

Required controls:
- incident severity/classification;
- safe disable switches for risky integrations/mutations that do not rewrite frozen facts;
- credential/provider revocation runbook;
- evidence preservation/audit procedure;
- explicit recovery/reenable acceptance gate;
- post-incident corrections remain append-only.

Exit evidence:
- tabletop drill for account takeover, GitHub webhook secret compromise, private-source exposure and verifier isolation failure.

---

## 5. Stage-H implementation sequence

Stage H is intentionally split. Closing one slice authorizes only the next slice named here; it does not authorize Stage I.

### H1 — Production route + privilege boundary

Implement:
- canonical production route manifest;
- both runtime entrypoints prove the same funded-Challenge/auth/GitHub/health surface;
- production excludes legacy/dev/test bootstrap routes;
- explicit privileged-operation inventory;
- organizer vs resolver/admin negative authorization harness.

Exit:
- route inventory is mechanically enforced;
- no unapproved privileged mutation path is reachable.

### H2 — Private-data inventory + retention/deletion

Implement:
- field/storage inventory;
- safe logging/telemetry contract;
- private-source retention state/policy;
- deletion/pseudonymisation rehearsal path for non-liability data;
- backup-retention semantics documented.

Exit:
- losing private source can be lifecycle-deleted without damaging minimal durable Challenge/receipt truth;
- public/API/log projections prove no private archive/source leakage.

### H3 — Auth/operator hardening + incident controls

Implement:
- privileged-role boundary required by actual supported operations;
- conflict-of-interest/self-resolution prohibition where resolver functionality exists;
- credential/session/provider rotation drill;
- incident runbooks and bounded integration disable/recovery controls.

Exit:
- account/provider compromise drill cannot rewrite canonical Challenge history or silently seize another actor's authority.

### H4 — Verifier / supply-chain isolation

Implement:
- trusted module provenance checks;
- verifier target/egress/redirect/size/time policy;
- isolation proof for application secrets;
- no arbitrary participant-code execution.

Exit:
- substitution + SSRF + redirect + oversized/stall cases fail closed;
- active Challenge semantics remain content-addressed.

### H5 — Failure/load/concurrency + zero-inference

Implement:
- production-equivalent DB pooling/load harness for relevant funded-Challenge paths;
- worker crash/replay drills;
- sensitive cross-instance quota/constraint proof;
- zero-inference full frozen-core operation test.

Exit:
- no economic/trust invariant violations under the tested burst/failure profile;
- core Challenge operation succeeds with model providers unavailable.

### H6 — Backup/restore + final hostile trust gate

Implement:
- isolated backup/restore drill;
- post-restore domain invariant verification;
- retention/backups consistency report;
- one bounded independent hostile review of the completed Stage-H surface.

Exit:
- no Critical/High trust defect remains;
- exact reviewed head passes canonical CI/Auth/security/failure gates;
- Stage H may close, but Stage I remains separately authorized.

---

## 6. Severity / closure law

A **Critical** or **High** defect is any defect that can plausibly:
- alter frozen Challenge law without authorized versioning;
- expose private source/evidence across authorization boundaries;
- fabricate/overwrite qualification, selection or receipt authority;
- create contradictory winner/economic truth;
- seize another actor's identity/repository/privileged authority;
- break verifier isolation into sensitive infrastructure;
- make backup/restore silently lose or invent durable authority;
- make retention/deletion materially contradict the documented privacy model.

Bounded completion per implementation slice:

`IMPLEMENT → TEST → ONE independent hostile review → fix Critical/High → ONE targeted rereview only if required → CLOSE → MOVE FORWARD`

Medium/Low findings do not restart a slice unless they undermine the stated objective, evidence, frozen invariant, authority boundary, privacy boundary or fail-closed behavior.

No review loops.

---

## 7. Stage-H global exit gate

Stage H is **not** complete merely because a checklist exists. It closes only when H1–H6 are closed and the evidence shows:
- explicit production route surface;
- private-data inventory/retention/deletion law;
- privileged authority separation appropriate to implemented capabilities;
- append-only audit/correction behavior;
- verifier and trusted-module isolation;
- failure/concurrency/load evidence;
- zero-inference core behavior;
- backup/restore proof;
- incident runbooks;
- no unresolved Critical/High trust defect.

External-human Alpha remains blocked until Stage H closes.

Production money remains independently blocked by the Survivor V1.1 legal/privacy/settlement/smart-contract gates and explicit future authority.