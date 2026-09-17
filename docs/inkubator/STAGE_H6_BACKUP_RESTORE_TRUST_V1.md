# REKT Inkubator — Stage H6 Backup / Restore Trust V1

Status: IMPLEMENTATION / VERIFICATION ACTIVE

Authority input: H5 frozen closure `b2c67646a65307d05b6aa0fa7392092fd21eb483`.

This document binds the Stage-H6 repository evidence. It grants no merge, Stage-I, production-money, wallet, settlement-execution or participant-code authority.

## 1. Backup scope

H6 treats the PostgreSQL Inkubator authority snapshot as an opaque backup artifact. A candidate backup is not trusted merely because a provider can restore it.

The protected/durable split remains the H2 split:

- durable Challenge authority includes frozen contract identity, accepted-submission digest/lineage, qualification, decisions, archive digest state and receipt lineage;
- private source/archive material remains lifecycle-deletable and must not be resurrected by a historical restore;
- provider object-storage deletion is a separate H2 retention concern; the DB restore path may preserve durable archive digests while private archive/source pointers remain tombstoned.

No H6 code authorizes restoring directly over the source database or into a production environment.

## 2. Restore admission order

The restore callback is unreachable until all of the following pass:

1. exact manifest schema;
2. backup UUID and canonical timestamps;
3. expected source environment/database identity;
4. artifact SHA-256 and byte length;
5. signed retention policy version and bounded expiry;
6. maximum admitted backup age;
7. encrypted-at-rest evidence with `BACKUP_ONLY` key scope;
8. exact least-privilege `BACKUP_READ` and `RESTORE_WRITE` credential scopes;
9. backup-reader/restore-writer credential separation;
10. separation from ordinary application credentials;
11. provider/snapshot provenance evidence;
12. Ed25519 signature from the configured trusted backup signer;
13. isolated target database/environment and all external effects disabled;
14. H2 retention evidence, including the minimum privacy-safe backup creation point.

A backup whose `created_at` predates `minimum_privacy_safe_backup_created_at` fails with `backup_predates_privacy_safe_restore_point` before provider restore. This is the fail-closed boundary that prevents an internally valid historical snapshot from silently resurrecting private material deleted after that snapshot was taken.

The privacy-safe point is deployment evidence, not a repository-wide TTL. It must be derived from the active private-material deletion/backup-lifecycle process and carries an evidence reference into the H6 receipt.

## 3. Isolation contract

A valid H6 restore target must satisfy all of these:

- mode is `ISOLATED_RESTORE`;
- target database ID differs from source database ID;
- target environment differs from source and is not in the configured production-environment set;
- GitHub effects disabled;
- archive writes disabled;
- provider/model inference disabled;
- settlement effects disabled;
- returned provider target identity exactly matches the pre-authorized isolation target.

Provider restore success alone never grants authority.

## 4. Post-restore authority verification

Before an H6 receipt can exist, the restored DB is checked using canonical Inkubator structures for:

- Challenge snapshot presence;
- frozen Build Contract pointer and durable contract-law equality;
- accepted Submission Manifest digest, Challenge/entry/terms lineage;
- archive Challenge/entry/terms/manifest lineage;
- qualification/submission/result lineage;
- decision digest and entry lineage;
- final-qualifier membership and uniqueness;
- selected-entry membership in final qualifiers;
- canonical Stage-G3 receipt transport reconstruction.

Any violation fails the restore as `restore_authority_invalid:*`.

## 5. Post-restore privacy verification

H6 separately verifies H2 private-material purge tombstones. For every `challenge.submission_private_material.purged` history event:

- the archive row must still exist;
- `source_reference` must remain `private-material-purged:v1`;
- a captured archive must keep its `archive_reference` tombstoned;
- a non-captured archive must not regain an archive reference;
- `challenge_submission_archive_sources` must contain no source row for the purged submission;
- a purge marker without its purge history event is rejected.

Any resurrection fails as `restore_privacy_invalid:*`. Durable hashes/digests are preserved; private pointers are not.

## 6. Retention consistency evidence

Each H6 run binds these retention facts into its receipt:

- retention policy version;
- retention policy document reference;
- manifest expiry (`bounded_until`);
- minimum privacy-safe backup creation timestamp;
- privacy-safe restore-point evidence reference;
- private-material erasure evidence reference;
- backup deletion/expiry evidence reference.

Backup expiry by itself is not treated as proof that historical private material is safe to restore.

## 7. RPO / RTO assumptions

H6 intentionally does **not** invent a product-wide numeric RPO or RTO.

RPO assumption:

- the deployment chooses a maximum admitted backup age (`max_backup_age_ms`);
- the signed manifest supplies `created_at` and `expires_at`;
- the candidate must also be at or after the current minimum privacy-safe restore point;
- therefore a deployment may choose a stricter RPO, but H6 never widens it implicitly.

RTO assumption:

- H6 proves a repeatable isolated restore and verification path, not a production recovery-time SLA;
- provider provisioning time, backup download time, database restore time and operator incident-response time are deployment characteristics;
- any production RTO claim must be backed by provider/operational drill evidence and is not inferred from CI duration.

The repository gate therefore claims **restore correctness and fail-closed trust admission**, not an unevidenced production availability SLA.

## 8. Executable evidence

Current H6 executable coverage includes:

- signed backup admission positive case;
- artifact tamper rejection;
- signed-manifest provenance tamper rejection;
- stale/expired backup rejection;
- unexpected source rejection;
- application/backup credential overlap rejection;
- backup/restore credential reuse rejection;
- production/source target isolation rejection;
- external-effect isolation rejection;
- privacy-obsolete backup rejection before restore callback;
- real Postgres isolated database clone drill;
- Challenge → contract → submission → archive → qualification → selection → settlement-fact → receipt lineage verification;
- restored receipt tamper rejection;
- restored H2 private-source tombstone resurrection rejection.

## 9. Closure gate

H6 may close only when:

1. exact-head canonical CI/Auth/integration gates pass;
2. the complete Stage-H surface receives ONE independent hostile review;
3. no Critical/High trust defect remains;
4. if Critical/High fixes are required, exact-head verification passes and ONE targeted re-review of those fixes is clean;
5. owner makes the H6/Stage-H closure decision.

No review loops.

Stage I remains separately authorized even after H6 closes.
