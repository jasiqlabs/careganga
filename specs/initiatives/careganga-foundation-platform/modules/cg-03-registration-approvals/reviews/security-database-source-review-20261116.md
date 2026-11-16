# CG-03 — Security and PostgreSQL source-review handoff

**Review date:** 2026-11-16  
**Repository:** `jasiqlabs/careganga`  
**Review source:** `feature/careganga-cg03-protected-approvals-20261115`  
**Baseline:** `main` at `91bd933e5540a49c70a1d6dae3f71eea3471c99f` (CG-03 already merged earlier)  
**Scope:** CG-03 US-001/002/003; CG-01 protected-role definition, current permission and owner-effect facade; migrations 0016–0020; Admin Web and Internal Android source.  
**Method:** Fresh manual adversarial source reading and static cross-file verification. No compilation or executable QA was performed.

> **Status: HOLD — INDEPENDENT REVIEW NOT COMPLETE.** This pass was conducted by the assistant that helped implement the feature. It is not a separate qualified security or database reviewer, and cannot constitute an independent sign-off. Assign an independent security reviewer and PostgreSQL reviewer for written sign-off before merging these new corrections. The prior CG-03 source merge into main has already occurred; this report does not certify main for release.

## Confirmed review findings and changes

| ID | Severity | Finding | Fix in this branch | Closure |
|---|---|---|---|---|
| DB-01 | Medium, integrity | `cg03_case` pinned `process_version` but the database FK checked only `process_id,realm_id`. Wrong-version data could pass FK validation. | **Additive** `0020_cg03_process_version_integrity.sql`: process `UNIQUE(id,realm_id,version)` plus case `FOREIGN KEY(process_id,realm_id,process_version)`. | Source-fixed; PostgreSQL execution and validation NOT_RUN |
| DB-02 | High, migration safety | Directly editing already-merged `0016` would change its checksum for any database that applied it. | Restored `0016_cg03_protected_proposals.sql` byte-for-byte from main (blob `f09a59dd7a0fb4bac410f7dafb3128f73ae617e2`), moved DB-01 into `0020`, and extended health-readiness required migration set. | Source-fixed; live migration/restore NOT_RUN |
| SEC-01 | Low–Medium, truthful recovery UX | `ApprovalFinalizationService.status` marked `APPLYING` eligible for owner retry even during an active unexpired lease. Backend cannot safely claim it yet, leading to misleading client action. | Require non-null `claimed_until <= now` for the `APPLYING` retry indication; retain bounded retry and original effect key. | Source-fixed; concurrency/runtime NOT_RUN |

## Security source checks (static, not independent certification)

- **Authority:** `SessionService.requireAction`, `ProtectedAccessOwnerService.verifyProposer/verifyReviewer`, and one-use fresh-TOTP proof are invoked at sensitive decisions. Reviewer and proposer cannot be the same account.
- **Sensitive grant:** ordinary `AccountsService.eligibleRole` denies direct custom-role assignment when `roles.manage` is present. The CG-01 protected owner service alone applies the reviewed grant, after checking immutable decision/proposal, approved route, target account and role versions, root realm, current active root reviewer and proposer. A matching CG-01 approval-effect record is required for non-root `roles.manage` in `SessionService.allowedActionsFor`.
- **Replay and uncertainty:** CG-03 decisions use case revision/step locking and immutable decision history; owner effect has one effect key, a bounded lease, retry cap, same-key source outcome lookup, and CG-01 unique effect ledger. Failed/unconfirmed application does not report `OWNER_COMPLETED` without ledger proof.
- **Scope and exposure:** Web BFF uses server session and same-origin POST validation. Admin APIs validate Foundation realm/ownership and no bulk approval route is present. CG-03 has no public Android Admin surface, unrelated owner FKs or future business-entity placeholders.
- **Audit:** CG-01 access grant and source audit record are written atomically with session revocation; CG-03 preserves separate append-only reviewer/case decision history and source-effect status.
- **UI path:** Web and Internal Android source expose actual case and owner outcome with unknown/pending distinction; original visual and device testing was not executed.

## PostgreSQL source checks (static, not EXPLAIN/restore)

- `0016`: scoped process/case and immutable process/event/proposal fields, unique active target case and command replay.
- `0017`: immutable decisions, unique case/revision and request key, case/realm composite FK.
- `0018`: CG-01 once-only approved assignment ledger with source/decision/effect unique keys and immutable effect history.
- `0019`: one case/decision/effect finalization, guarded state/claim, bounded due/lease indexes and same-case composite decision FK.
- `0020`: additive process-version referential integrity, validated against existing rows by PostgreSQL at migration time.
- Migration runner checks historic file hashes and rejects missing applied migrations. `HealthController.ready` now requires `0020`.
- No script, CI/GitHub Actions, live PostgreSQL, EXPLAIN ANALYZE, backup restore, concurrent request harness, browser, Android emulator, pixel/motion or external provider verification was run.

## Open external reviewer gates — do not mark passed

1. **Independent security reviewer:** inspect non-root role manager escalation, protected custom-role creation/copy/edit, direct assignment denial, distinct-actor MFA proof, revoked reviewer/role windows, actor/case-scoped lookup, replay key collisions, Web/native permission hiding and CSRF. Investigate whether historical `cg01_approved_sensitive_assignment` eligibility should be tied to the exact active assignment generation rather than matching only account/role/revision; normal assignment API already blocks direct sensitive grants, but the lineage policy needs independent evaluation.
2. **Independent PostgreSQL reviewer:** inspect 0016–0020 with a *disposable* Postgres 17 database; apply clean migrations, re-run checksum check, test upgrade from exact previously applied 0016–0019, test rollback/restore on failure, reject mismatched process version, explain scoped queue/history indexes, and exercise simultaneous approval, role-revision drift, owner lease expiration, crash recovery, and duplicate effect races.
3. **Source QA trace:** canonical `tasks.md` contains 31/31 `SOURCE_VERIFIED` references (US-001:10, US-002:10, US-003:11). This is **not** executable QA. Re-review QA references for DB-01/DB-02 and SEC-01 before independent sign-off.
4. **Developer IDE handoff:** later run TypeScript/Next/Android builds, migrations, secured APIs, concurrency, UI/visual and device QA. Record genuine PASS/FAIL; do not change NOT_RUN to PASS from source reading.
5. **Planning:** formal `DRAFT_UNAPPROVED` / PRD/HLD/Harness and runtime gates remain recorded; this review does not change those approvals.

**Merge decision for the new hardening commits:** **HOLD** pending independent security and PostgreSQL review/approval. No automatic merge, force push or deployment.
