# REKT INKUBATOR — TRUST & REPUTATION THREAT MODEL V1

**Status:** USER-AUTHORIZED / STAGE-H H0 AUTHORITY
**Date:** 2026-09-16
**Parent:** `STAGE_H_TRUST_HARDENING_V1.md`
**Strategic authority:** `REKT_INKUBATOR_NORTH_STAR_V2.md`
**Mechanism/privacy authority:** `FUNDED_CHALLENGE_SURVIVOR_PLAN_V1_1.md`
**Production-money authority:** NONE
**Merge authority:** NONE

This is the required pre-Alpha trust/reputation threat model for REKT Inkubator.

It governs Stage-H hardening of the integrated Challenge system built through Stage G. It does not authorize production-value settlement, arbitrary hosted participant execution, or a new authority system.

---

# 1. Security objective

Permanent invariant:

> **No single compromise or mistake should be able to silently alter Challenge rules, expose all private work, fabricate evidence, choose a winner or redirect settlement.**

Communication invariant:

> **Never claim more certainty than the evidence supports.**

Stage-H engineering must preserve four independent kinds of truth:

1. **contract truth** — frozen Build Contract / normative-reference semantics;
2. **evidence truth** — what was actually submitted, archived and observed;
3. **decision truth** — qualification, appeal/resolution and organizer selection;
4. **receipt truth** — append-only durable terminal/correction history.

No client, model, provider response, UI state, ordinary operator action or single external service may silently mint or rewrite those truths.

---

# 2. Protected assets

## 2.1 Highest-authority assets

- frozen Build Contract and `terms_digest`;
- immutable normative references/fixtures;
- accepted submission manifests and DB acceptance time;
- final-submission lineage;
- acceptance-manifest meaning;
- trusted execution identity/results;
- durable qualification and appeal resolution;
- `FINAL_QUALIFIERS`;
- organizer `SELECTION`;
- append-only receipts/corrections;
- history/audit facts used to explain authoritative mutations.

Compromise of these assets can change who qualifies, who wins, or what history says happened.

## 2.2 Sensitive private assets

- private GitHub source snapshots;
- private repository identity/metadata not needed publicly;
- raw private evidence;
- OAuth/session credentials;
- GitHub App credentials/install authority;
- object-storage credentials and private archive references;
- operator/resolver authentication material;
- backup copies containing any of the above.

## 2.3 Reputation-sensitive assets

- public Challenge/result projections;
- builder identity/history;
- qualification language;
- review/audit/security claims;
- REKT/Ink affiliation language;
- receipt/history projections;
- any future Builder Passport aggregation.

A technically correct backend can still create a trust failure if public language overstates what was proven.

---

# 3. Principals and attacker classes

The threat model assumes all of the following can be malicious, compromised, mistaken or unavailable independently.

### Anonymous external actor

Can send public requests, crawl links, probe routes, submit malformed payloads and induce load.

### Authenticated builder

Can control their browser/client, repository content, submitted links, immutable source choice before acceptance and ordinary builder-authorized commands.

### Authenticated organizer

Can control Challenge text/preferences and organizer-authorized selection commands, but may not rewrite frozen qualification law, admit hidden requirements, mint qualification or access unrelated builders' private source.

### Compromised participant account

Possesses normal participant session authority. Must not thereby gain resolver/admin, other-player, broad source-export or settlement authority.

### Malicious organizer + builder collusion

May coordinate identities/content but still cannot alter durable final-qualifier law or create multiple winner truths.

### Privileged operator

May handle bounded exceptions. Ordinary operator capability must not become an undocumented superuser path that can silently rewrite economic/product history.

### Resolver / moderator

Handles policy/dispute exceptions separately from organizer product qualification. Resolver conflict-of-interest and self-resolution are forbidden.

### Language model / coding agent

May emit hostile, hallucinated or prompt-injected text/code. Model output is untrusted proposal input and cannot be product truth.

### GitHub / OAuth / App dependency

May be unavailable, stale, revoked, misconfigured or compromised. Provider state cannot silently rewrite already-frozen Challenge semantics.

### Object/archive provider

May lose responses, delay writes, return stale/incorrect metadata or become unavailable. Platform archive failure is not builder failure.

### Verifier target / hostile URL

May attempt SSRF, redirect abuse, DNS rebinding, oversized responses, slow responses, protocol confusion or content designed to attack parsers/renderers.

### Blueprint / package / tool dependency

May release a compromised or semantically changed version. Active Challenges must remain bound to frozen versions/digests.

### Database/worker failure

May crash after commit, retry commands, reorder work, exhaust connections or restore an older backup. At-least-once execution must not create duplicate authority.

---

# 4. Trust boundaries

## TB-1 — Browser/client → Inkubator API

Client input is untrusted. The client may propose command payloads but cannot mint authoritative Challenge, qualification, selection, receipt or settlement facts.

Required properties:

- schema/bounds validation;
- actor authentication/authorization;
- actor+operation scoped idempotency for sensitive commands;
- origin/CSRF boundary where cookie auth applies;
- no authority derived from client-supplied role/status flags.

## TB-2 — Model/provider → Compiler

Model output is untrusted interpretation input.

Required properties:

- structured validation;
- deterministic consequence logic;
- explicit human acceptance before freeze;
- prompt injection cannot modify authority rules or tool permissions;
- model outage cannot stop already-frozen core Challenge operation.

## TB-3 — GitHub → Inkubator

GitHub responses/webhooks are external evidence, not product authority by themselves.

Required properties:

- signature/installation/repository identity validation;
- stable numeric identity where already frozen by existing authority;
- replay-safe delivery handling;
- exact accepted-source lineage frozen before archive capture;
- revocation/platform outage classified separately from builder-caused evidence failure.

## TB-4 — Inkubator API → private archive/object storage

Private storage is a confidentiality boundary, not a public artifact server.

Required properties:

- private-by-default buckets/objects;
- content-addressed/deterministic keys where required by existing F3 authority;
- object location/reference never exposed by public projections;
- access audit;
- bounded retention/deletion;
- provider outage cannot rewrite acceptance truth.

## TB-5 — Inkubator → verifier

Verifier is intentionally isolated.

Required properties:

- bounded protocols/ports/redirects;
- SSRF/private-network denial;
- DNS/redirect revalidation;
- response/time/size limits;
- no product DB credentials;
- no broad cloud credentials;
- verifier result is evidence under frozen module law, not self-authorizing product truth.

## TB-6 — Worker/outbox → domain store

Jobs are at-least-once.

Required properties:

- idempotent downstream keys;
- durable lease/heartbeat behavior for long jobs;
- crash-after-commit replay safety;
- worker retry cannot duplicate selection/qualification/receipt authority;
- operator recovery does not require editing canonical rows by hand.

## TB-7 — Operator/resolver → privileged actions

Privileged action is explicit product surface, not implicit database access.

Required properties:

- stronger authentication than ordinary participant session where feasible for Alpha;
- explicit role/capability;
- no self-resolution/conflict-of-interest;
- full durable audit;
- bounded action vocabulary;
- append-only correction rather than history mutation.

## TB-8 — Backup/restore → live authority

A backup may contain expired secrets/private source and stale state.

Required properties:

- restore is rehearsed;
- restored authority is reconciled against durable idempotency/history;
- deletion tombstones/retention jobs are replayed before restored private data can be served;
- backup expiry is bounded;
- restore cannot silently resurrect a deleted private-source projection.

---

# 5. Frozen trust invariants

1. **Frozen rules are immutable.** Active Challenge meaning is determined only by frozen version/digest authority.
2. **No hidden qualification requirements.** Policy/moderation is separate from organizer `DONE WHEN` law.
3. **Qualification ≠ preference.** Organizer taste can choose only among durable qualifiers.
4. **One durable winner truth.** Selection uses existing Stage-C decision authority; no parallel winner table/path/version family.
5. **Receipts are append-only.** Legitimate correction creates a superseding correction.
6. **Participant code cannot mint authority.** Client/browser/repository content is evidence/input only.
7. **Model output cannot mint authority.** LLM/provider text is never canonical by itself.
8. **Public GETs are pure.** Reads do not advance lifecycle or acquire economic locks as deadline side effects.
9. **Private source is private and temporary.** Public routes never expose raw source/archive references.
10. **Provider outage is not builder failure.** Platform/GitHub/archive uncertainty maps to pending/disputed law already frozen by Stage F/G.
11. **Legacy/dev/test routes are absent from production funded-Challenge assembly.** In-repo historical code may remain.
12. **Resolver/admin is not organizer authority.** Policy/dispute resolution requires separate capability and audit.
13. **Normal web/API authority cannot redirect production prize funds.** Production money remains unauthorized in Stage H.
14. **No single credential should expose every trust domain.** API, verifier, object storage and later settlement authority remain separable.
15. **Zero-inference core operation.** Frozen-Challenge lifecycle/evidence/decision/receipt semantics do not depend on a live model.

---

# 6. Threat register

Severity is Stage-H launch severity, not generic CVSS.

## T-01 — production route leakage

**Risk:** historical Mission/Round/World/social/help/assist/DevKit/development routes remain registered in the funded-Challenge production process.

**Severity:** HIGH until proven absent.

**Required control:** one explicit allowlisted production route assembly plus executable inventory test shared by both production entrypoints.

**Pass condition:** forbidden route list returns absent/404 in production assembly while intended Challenge/auth/GitHub/health surface remains registered.

## T-02 — runtime entrypoint drift

**Risk:** `server.ts` and `render-server.ts` compose different product routes/auth options, producing environment-specific trust behavior.

**Severity:** HIGH until one canonical assembly exists.

**Required control:** both production launchers consume one shared registration function/config contract; parity test compares route inventory.

## T-03 — compiler false authority / prompt injection

**Risk:** model/provider content changes requirements, acceptance meaning, route/tool authority or frozen contract without explicit deterministic/human acceptance.

**Severity:** HIGH.

**Required control:** validated structured proposal boundary; deterministic compiler consequence rules; explicit acceptance provenance; no model tool capable of freezing or directly mutating authoritative Stage-B/C state.

**Pass condition:** hostile prompt corpus cannot mint frozen authority or bypass unsupported-risk gates.

## T-04 — blueprint / acceptance-module supply-chain substitution

**Risk:** same module/blueprint name resolves to changed code/semantics after Challenge freeze.

**Severity:** HIGH.

**Required control:** version + content digest binding; curated registry; active Challenge references never float; provenance test rejects substitution.

## T-05 — private-source public leak

**Risk:** archive path/reference, raw source, private repo metadata or raw private evidence reaches public route/log/error/receipt.

**Severity:** CRITICAL for broad/raw source exposure; HIGH for repeatable metadata leakage.

**Required control:** projection allowlists, secret-safe errors/logging, private storage, route tests, access audit.

## T-06 — private-source over-retention

**Risk:** losing private repositories become permanent platform archives or survive indefinitely in backups.

**Severity:** HIGH.

**Required control:** Alpha retention schedule in §9, deletion worker, tombstones/audit, backup expiry, restore-time deletion replay.

## T-07 — organizer rewrites qualification

**Risk:** organizer selection/preferences or post-hoc policy claims become a second qualification law.

**Severity:** CRITICAL.

**Required control:** existing G2/G3 separation, durable `FINAL_QUALIFIERS`, `validateSelection()`, resolver path separate from `DONE WHEN`.

## T-08 — duplicate/parallel winner truth

**Risk:** retries, version variation, race or alternate table creates two valid winners.

**Severity:** CRITICAL.

**Required control:** existing Stage-C DB serialization/uniqueness + fixed G3 selection version; concurrency/replay tests remain permanent.

## T-09 — receipt/history mutation or forged correction

**Risk:** historical receipt is overwritten, correction predecessor is forged, or public transport invents corrected meaning.

**Severity:** CRITICAL.

**Required control:** immutable receipt rows; protocol-validated correction chain; durable audit; public transport projects only validated safe fields.

## T-10 — participant account takeover escalates to platform authority

**Risk:** stolen organizer/builder session can access resolver/admin actions, other users' private source or arbitrary platform controls.

**Severity:** HIGH.

**Required control:** capability separation; stronger privileged auth; short/bounded sessions; credential rotation/revocation; sensitive action audit.

## T-11 — OAuth/GitHub installation confusion

**Risk:** setup state, installation or repository authority is rebound across users/installations.

**Severity:** HIGH.

**Required control:** existing PKCE/state/installation ownership/repository-ID laws remain; Stage H adds rotation/revocation drills and production route exposure review.

## T-12 — webhook replay/spoof

**Risk:** forged/replayed GitHub webhook creates false observation or source state.

**Severity:** HIGH where authoritative evidence could be affected.

**Required control:** exact-byte HMAC, delivery dedupe, installation/repository lineage, bounded payload parsing; current tests remain regression gates.

## T-13 — verifier SSRF / hostile network target

**Risk:** participant-controlled URL accesses internal/cloud metadata/private networks or consumes unbounded resources.

**Severity:** CRITICAL if privileged network/credentials reachable; HIGH otherwise.

**Required control:** isolated verifier, network allow/deny policy, redirect/DNS revalidation, timeout/size caps, no product credentials.

## T-14 — worker crash/retry duplicates authority

**Risk:** crash after DB commit but before job acknowledgement causes duplicate qualification/evidence/receipt effects.

**Severity:** HIGH.

**Required control:** existing command idempotency + durable history + replay tests + bounded worker leases.

## T-15 — DB restore resurrects stale/deleted authority/private data

**Risk:** restore loses newer authority, reopens completed work, or serves source scheduled for deletion.

**Severity:** HIGH.

**Required control:** restore drill, point-in-time expectations, reconciliation, deletion tombstones replayed before service, backup retention cap.

## T-16 — rate/lock exhaustion creates authority failure

**Risk:** bursts on seats/submissions/auth/selection or hot public reads exhaust DB/locks, causing timeouts or inconsistent operator recovery.

**Severity:** HIGH if authority invariant can fail; Medium if only availability with bounded recovery.

**Required control:** no write amplification on GET, short transactions, durable scarce-action constraints, edge/IP protection, production-equivalent pooling/load test.

## T-17 — secret leakage in logs/errors/diagnostics

**Risk:** OAuth token, cookie/session, archive reference, private URL, provider secret or source fragment enters durable logs or diagnostic bundle.

**Severity:** HIGH.

**Required control:** structured allowlisted diagnostics, redaction tests, no raw request/body logging on sensitive routes.

## T-18 — privileged operator edits canonical state directly

**Risk:** normal exception handling requires DB surgery that bypasses protocol/history.

**Severity:** HIGH.

**Required control:** bounded operator commands/runbooks, append-only corrections, audit facts, unsupported surgery treated as incident rather than normal workflow.

## T-19 — mixed deploy silently changes active semantics

**Risk:** old/new worker/API versions disagree about an active Challenge.

**Severity:** HIGH.

**Required control:** versioned mechanism/terms/modules; mixed-version tests; unsupported version fails closed instead of reinterpretation.

## T-20 — false trust/brand claims

**Risk:** UI/public copy says `secure`, `audited`, `official`, `production ready`, `paid` or equivalent without evidence.

**Severity:** HIGH for claims that materially affect participant trust/value decisions; otherwise Medium.

**Required control:** claims policy in §8 + copy/projection review/tests where machine-enforceable.

---

# 7. Prompt/model boundary

The compiler/chat layer may:

- interpret fuzzy text;
- ask questions;
- propose wording;
- explain deterministic consequences;
- suggest blueprint candidates;
- surface ambiguity/unknowns.

It may not:

- freeze a Build Contract without explicit deterministic validation + human acceptance;
- define hidden acceptance criteria;
- mark a builder qualified;
- select a winner;
- file/correct a receipt;
- grant operator/resolver capability;
- read arbitrary private source merely because prompt text asks;
- widen network/tool permissions;
- make settlement/payment claims authoritative.

Untrusted Challenge/reference/repository text is data, never system/tool instruction.

Stage-H hostile prompt corpus must include instructions embedded in Challenge text, README/source, reference docs and acceptance evidence attempting to override role/tool/authority boundaries.

---

# 8. Claims / brand policy — H-GATE-2

## 8.1 Allowed evidence-bound language

Use exact qualified statements such as:

- `Qualified against Build Contract <version>`;
- `Passed <named/versioned module>`;
- `Human observation recorded for <criterion>`;
- `Organizer selected this build from the durable qualifier set`;
- `Receipt filed`;
- `Validated against Production Envelope <version>` when that exact envelope/check evidence exists;
- `AI-assisted proposal` / `compiler suggestion` for model-derived advice;
- `REKT Inkubator` as the product identity.

## 8.2 Forbidden or gated language

Do not say or imply without independent matching evidence:

- `secure`;
- `security certified`;
- `audited`;
- `production ready`;
- `official REKT` / `official Ink` / ecosystem endorsement;
- `guaranteed`;
- `AI verified` as an authority label;
- `fraud proof`;
- `paid` / `settled` before actual authorized settlement evidence exists;
- `on-chain verified` before a future chain authority exists;
- `best build` as an objective platform judgment when selection is organizer preference among qualifiers.

`Qualified` means only that frozen mandatory acceptance law produced a qualifying result. It is not a universal quality/security guarantee.

`Winner` means the organizer-selected qualifying entry under the frozen Challenge mechanism. It does not imply platform endorsement of code quality beyond recorded evidence.

## 8.3 REKT / Ink affiliation

Until a separate documented partnership/endorsement authority exists:

- product branding may be REKT-native;
- community/ecosystem references may be descriptive;
- do not claim Foundation/team sponsorship, endorsement, approval or official status;
- sponsor labels must identify the actual sponsor and scope.

---

# 9. Data inventory + retention matrix — H-GATE-3

These are **closed-Alpha operational defaults**. Legal/compliance review may require narrower/longer handling before production value; Stage H may not silently expand retention.

| Data class | Purpose | Public? | Default access | Alpha retention/deletion |
| --- | --- | --- | --- | --- |
| Player ID + public profile | identity/history | bounded public fields | account owner + public projection | while account active; deletion request pseudonymizes/removes nonessential profile within 30 days unless active liability blocks immediate deletion |
| Session token/hash/state | authentication | never | auth subsystem only | existing session TTL; expired/revoked rows removed or irreversibly invalidated within 7 days |
| GitHub immutable user ID | identity binding | not by default | auth/connection subsystem | while linked/active liability exists; after unlink/account deletion retain only minimal pseudonymous audit reference up to 365 days |
| GitHub installation/repository IDs + public-safe metadata | source authority/reconciliation | only purpose-bound projection | owner + integration workers | while linked/needed by active Challenge; inactive linkage metadata removed/pseudonymized within 30 days, authority/audit digest may remain 365 days |
| OAuth/provider access token | provider access | never | server integration boundary | no diagnostic/log persistence; revoke/delete as soon as no longer required; unlink/compromise triggers immediate revocation path |
| GitHub App/private provider secret | service credential | never | deployment secret boundary | rotate on compromise/scheduled key policy; never stored in product DB/history/logs |
| Accepted submission manifest | deadline/lineage authority | safe projection only | Challenge domain | durable for Challenge history; contains references/digests, not raw private source |
| Losing private source snapshot | evaluation/dispute evidence | never | evaluation/resolver boundary only | delete 14 days after terminal receipt or dispute closure; hard maximum 30 days after terminal state absent documented legal hold |
| Winner private source snapshot | delivery/evidence | never by default | winner-delivery/resolver boundary | delete platform copy within 30 days after verified delivery unless frozen winning terms explicitly require another period |
| Raw private evidence | qualification/dispute | never | evaluation/resolver boundary | same schedule as corresponding private source/evidence purpose; durable digest/result may remain |
| Public-safe evidence digest/result | explainability/history | yes where justified | Challenge projection | durable with Challenge/receipt history |
| History/audit event | accountability/recovery | not raw-public | operator/audit boundary | 365 days minimum for Alpha unless event is part of permanent receipt authority; no raw secrets/source in payload |
| Receipt/correction | durable result | privacy-bounded projection | public-safe projection + internal authority | durable/append-only; personal fields minimized/pseudonymized as allowed by frozen law |
| Compiler structured state | explainability/reproducibility | organizer/private unless Challenge projection says otherwise | organizer/compiler | through Challenge lifecycle + 90 days, then retain only frozen contract/result facts needed for history |
| Raw model/chat prompt/output | compiler assistance | never public by default | organizer/compiler support | maximum 30 days for Alpha diagnostics; prefer shorter/no retention; must never contain raw private repository source by default |
| Application/security logs | operations/incident response | never | operator | 30 days default; security incident subset may be retained up to 365 days if redacted/purpose-bound |
| Database backups | disaster recovery | never | restricted operator/infra | rolling maximum 35 days; restored systems must replay deletion/tombstone policy before serving private data |
| Private object-storage backups/versions | recovery | never | restricted infra | must not exceed the effective 35-day backup window; lifecycle rules required |

### Retention invariants

- Legal hold is exceptional, documented, scoped and auditable; it is not a hidden permanent-retention switch.
- Deleting live rows/objects is not enough if backups can restore them indefinitely.
- A restore must execute pending deletion/tombstone policy before public/authenticated service resumes.
- Account deletion during active Challenge liability may defer deletion of minimum necessary authority facts, but must not justify retaining unrelated profile/private-source data.
- Public receipt/history should use opaque IDs/digests rather than unnecessary personal identity.

---

# 10. Privileged authority policy

## Organizer

Can create/freeze under existing rules, administer own Challenge within frozen capability and select only among durable qualifiers.

Cannot:

- edit frozen criteria;
- mark qualification directly;
- access another Challenge's private source;
- resolve own platform-policy conflict as privileged resolver;
- mutate receipt history;
- execute production settlement in Stage H.

## Builder

Can manage own seat/build/submission under existing authority.

Cannot:

- see competitor work before reveal law allows;
- mark own qualification;
- alter accepted submission time/source lineage after acceptance;
- access other private source;
- mint receipts/selection.

## Resolver/operator

Must use explicit privileged capability separate from normal organizer/builder actions.

At minimum:

- privileged mutation is authenticated;
- target/reason/evidence/request ID are recorded;
- self-resolution is forbidden where resolver has organizer/builder conflict;
- correction is append-only;
- privilege is not inferred from UI/client fields;
- direct DB edits are break-glass incident procedure, not supported normal operation.

---

# 11. Operator runbooks — H-GATE-4

Each implementation runbook must end with one of:

`RESOLVED / DEGRADED_SAFE / PAUSED_FAIL_CLOSED / INCIDENT_ESCALATED`

It must never instruct the operator to invent authority by editing canonical rows.

## R-01 GitHub unavailable

1. classify provider/platform outage;
2. keep accepted-before-deadline manifests authoritative;
3. pause/provider-mark archive evidence as pending/unknown according to existing law;
4. retry through bounded jobs;
5. do not mark builder failed solely due provider outage;
6. surface degraded state without leaking repository details.

## R-02 GitHub/OAuth compromise suspected

1. disable/revoke affected credential/integration path;
2. preserve frozen Challenge/submission authority;
3. stop new provider mutations/capture that require compromised credential;
4. rotate secret/token;
5. audit affected installation/repository accesses;
6. resume only after ownership/secret validation.

## R-03 model unavailable / budget cap reached

1. disable conversational inference path;
2. keep deterministic compiler/frozen Challenge operation available;
3. show model assistance unavailable rather than fabricate fallback answers;
4. no frozen lifecycle/qualification/selection/receipt operation may depend on model recovery.

## R-04 compiler output suspected wrong

1. stop freeze if contract not yet frozen;
2. inspect deterministic CompilerState/rule provenance;
3. correct compiler rule/blueprint version for future contracts;
4. never silently reinterpret already-frozen Challenge terms;
5. active Challenge correction requires existing explicit version/correction authority, not a compiler rewrite.

## R-05 DB restore

1. enter maintenance/fail-closed mutation mode;
2. restore chosen recovery point;
3. verify migrations/version;
4. reconcile history/outbox/idempotency;
5. replay retention deletion/tombstones;
6. verify Challenge authority invariants and receipt counts/digests;
7. run smoke/auth/private-projection checks;
8. reopen only after authority conservation receipt passes.

## R-06 worker retry storm

1. stop/limit affected worker intake;
2. inspect oldest-job age/error family, not raw secrets;
3. verify downstream idempotency before retrying;
4. repair cause/lease configuration;
5. resume bounded concurrency;
6. prove no duplicate authority effects.

## R-07 verifier unavailable/compromised

1. mark verifier-dependent observation unavailable/unknown;
2. do not convert outage to builder failure unless frozen law explicitly classifies builder-caused evidence failure;
3. isolate/disable verifier;
4. rotate verifier credentials if any;
5. validate network policy and known-good canary before resume.

## R-08 suspected private-source exposure

1. stop affected public/private serving path;
2. revoke exposed credentials/URLs;
3. preserve audit evidence without copying raw source into tickets/chat;
4. identify exact objects/principals/time window;
5. delete/restrict unintended replicas;
6. notify affected parties according to legal/incident policy;
7. add regression preventing the leak class before resume.

## R-09 account takeover

1. revoke sessions/provider tokens;
2. freeze privileged actions for affected principal;
3. preserve immutable prior actions/history;
4. re-establish identity through approved recovery;
5. do not rewrite legitimate historical receipts; use append-only correction/resolution only where authority permits.

## R-10 submission/evidence dispute

1. preserve frozen contract/manifest/evidence digests;
2. classify product qualification dispute vs platform-policy issue;
3. use existing appeal/resolver law;
4. no hidden criteria;
5. record resolution authority/evidence append-only.

## R-11 receipt correction

1. verify correction authority and predecessor;
2. never update/delete prior receipt;
3. append protocol-valid correction;
4. public projection exposes safe supersession lineage only.

## R-12 budget cap reached

1. stop optional variable-cost inference/provider work;
2. keep core deterministic Challenge operation running;
3. no emergency provider switch may change frozen active semantics;
4. alert operator with cost source + replacement/defer action.

---

# 12. Failure / chaos matrix — H-GATE-5

| Drill | Injection | Required pass condition |
| --- | --- | --- |
| Deadline read storm | high GET RPS at entry/submission deadline | zero lifecycle writes caused by GET; no economic row-lock amplification |
| Seat race | concurrent final-seat requests | exact capacity; losers deterministic conflict; no duplicate builder/wallet seat |
| Submission replay | duplicate/crash-after-commit submit | one accepted semantic effect; exact replay recoverable |
| Qualification replay | crash after qualification before evidence/history completion | one durable qualification; evidence can reconcile without second truth |
| Selection race | simultaneous organizer choices | exactly one durable `SELECTION` |
| GitHub outage | timeout/5xx/revocation after accepted submission | pending/unknown as frozen law requires; not automatic builder failure |
| Archive lost response | write succeeds but acknowledgement lost | deterministic retry key; no duplicate semantic archive authority |
| Worker lease expiry | slow healthy job beyond nominal lease | heartbeat/lease prevents duplicate active execution or duplicate authority |
| DB connection exhaustion | saturate pool under mixed reads/mutations | bounded failure; no invariant violation; recovery without DB surgery |
| Mixed deployment | old/new API/worker handling active Challenge version | active terms unchanged; unsupported version fails closed |
| Verifier SSRF suite | loopback/private IP, redirects, rebinding, oversized/slow body | verifier cannot reach forbidden target/credentials; bounded failure |
| Verifier outage | unavailable verifier during check | unavailable/unknown; no fabricated PASS/FAIL |
| Provider/model outage | all inference unavailable | frozen Challenge core still operates; compiler assistance degrades explicitly |
| Secret rotation | rotate webhook/OAuth/app credential | old credential stops; new path works; no secret logging |
| Private-source projection | hostile source metadata/paths in errors/routes | no raw source/archive reference/private repo identity escapes public projection |
| Live deletion | losing source retention expires | object/raw evidence deleted; digest/history retained as allowed |
| Backup restore after deletion | restore backup containing previously deleted source | deletion/tombstone replay occurs before serving; restored source remains inaccessible/deleted |
| Receipt correction | correction chain + malformed predecessor | valid append succeeds; forged/mismatched predecessor fails closed |
| Rate burst | auth/seat/submission/selection burst across instances | shared durable constraints remain effective; intentional 409/429 not 5xx storm |
| Zero inference | disable model/provider completely | join/build/submit/reveal/evaluate/select/receipt core remains deterministic where required inputs exist |

---

# 13. Production route inventory contract

Stage H must stop treating `buildApp()` as implicit production authority.

Every route in the production funded-Challenge process must be classified into exactly one category:

- `PUBLIC_PRODUCT`;
- `AUTHENTICATED_PRODUCT`;
- `PRIVILEGED_OPERATOR`;
- `GITHUB_PROVIDER_CALLBACK/WEBHOOK`;
- `HEALTH/CONTRACT`;
- `NON_PRODUCTION`;
- `FORBIDDEN_LEGACY`.

A production route inventory test must enumerate registered method+path and fail on any `NON_PRODUCTION` or `FORBIDDEN_LEGACY` entry.

Historical route implementation may remain in the repository for compatibility/tests. Absence from production registration is the trust boundary.

The current Stage-G starting point already proves a need for this gate because both launchers call `buildApp()` and independently add Challenge routes, while the launchers do not presently compose an identical Challenge route set.

---

# 14. Verifier isolation contract

Before Alpha the verifier must prove:

- no direct product DB credentials;
- no GitHub App private key/OAuth secret;
- no object-store write credential unless a narrowly scoped future authority explicitly requires it;
- outbound network policy denies loopback, link-local, RFC1918/private, cloud metadata and other forbidden ranges after DNS resolution and redirects;
- protocol allowlist;
- bounded redirects;
- bounded DNS/connection/read/overall time;
- bounded response size/decompression;
- safe content parsing;
- result schema/version/digest bound to frozen acceptance module;
- outage returns unavailable/unknown rather than fabricated evidence.

Arbitrary participant-code execution remains out of Stage-H scope.

---

# 15. Dependency / blueprint provenance

For any dependency that can affect qualification or compiled contract meaning:

- exact version/config/rules are frozen or content-addressed;
- active Challenges never float to latest;
- registry update affects only future contract versions unless explicit migration authority exists;
- compromised/deprecated module can be disabled for new Challenges without rewriting old evidence;
- canary/reference builds may inform health but do not override frozen Challenge law;
- provider/OSS popularity is not authority.

---

# 16. Audit requirements

Audit records must be useful without containing the secret/private payload itself.

For privileged/sensitive actions record, where applicable:

- event type/version;
- request/command ID;
- actor opaque ID + capability;
- target type/opaque ID;
- Challenge/entry ID;
- prior/result authority digest or row ID;
- reason code;
- evidence reference/digest, not raw private evidence;
- DB timestamp;
- outcome.

Never log:

- session cookies/tokens;
- OAuth access tokens;
- GitHub App private keys;
- object-store secrets;
- private archive object paths when a nonsecret digest can serve diagnosis;
- raw private source;
- arbitrary unbounded request bodies on sensitive routes.

---

# 17. Incident severity

## SEV-0 / Critical trust incident

Examples:

- broad private-source exposure;
- frozen terms/selection/receipt authority corruption;
- unauthorized privileged action capable of changing winner/economic history;
- verifier escapes into privileged network/credentials;
- future settlement-redirection authority exposed.

Response: fail closed affected mutation/serving path immediately, preserve evidence, rotate/revoke credentials, no normal operation until containment and authority-integrity proof.

## SEV-1 / High trust incident

Examples:

- repeatable cross-user private metadata leak;
- auth/privilege bypass without known authority corruption;
- restore/retry ambiguity that could duplicate authoritative effects;
- private-source retention/deletion failure;
- production legacy route exposing unintended privileged functionality.

Response: disable affected path, bounded repair, exact regression, audit impact before resume.

## SEV-2 / degraded but authority-safe

Provider outage, verifier unavailable, optional model outage, rate limiting or performance issue where frozen authority remains intact and failure is explicit.

Response: degraded-safe state/runbook; no fabricated success.

---

# 18. Stage-H implementation order

The threat model authorizes only the bounded Stage-H sequence defined by `STAGE_H_TRUST_HARDENING_V1.md`:

1. H1 production route assembly / entrypoint parity;
2. H2 privileged/auth/private-source abuse controls;
3. H3 retention/audit/correction/operator exceptions;
4. H4 verifier/dependency/restore/zero-inference isolation;
5. H5 production-equivalent load/chaos + final trust review.

Do not start H2 while H1 is open unless a concrete H1 finding requires the dependency.

---

# 19. Stage-H / Alpha exit criteria

Stage H may close only when:

- no known Critical/High threat in this model remains unmitigated inside Alpha scope;
- route inventory proves production surface minimization;
- privileged-action matrix passes;
- private-source projection/deletion/backup tests pass;
- verifier isolation suite passes;
- backup/restore drill passes;
- zero-inference core operation passes;
- production-equivalent load/chaos produces zero authority-invariant violation;
- public claims are evidence-bound;
- runbooks exist and do not require normal DB surgery;
- exact-head CI/Auth/product-boundary verification passes;
- one bounded independent hostile review finds no unresolved Critical/High issue.

Stage-H PASS authorizes consideration of Stage I closed Alpha only. It does not authorize production money or Stage J.

---

# 20. H0 verdict

This threat model is the Stage-H trust authority once linked from `INDEX.md` and verified under the H0 bounded gate.

Known immediate implementation priority after H0 closure:

`H1 = EXPLICIT PRODUCTION ROUTE ASSEMBLY + ENTRYPOINT PARITY + FORBIDDEN-ROUTE INVENTORY TEST`

No production-money, vault, arbitrary code-execution or merge authority is created by this document.
