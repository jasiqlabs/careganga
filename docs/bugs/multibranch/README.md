# CareGanga — Multi-branch bug register (15 distinct files)

**Authority:** `feature/careganga-cg07-campaigns-donations-dev-20261122` only. **Created 23 Nov 2026** from original CG-01/02 design + inspected main owner source and current CG-07. **NONE is claimed RUNTIME_PASS.** Status deliberately distinguishes proven source limitations from testing gaps and future development decisions. These are branch-local Markdown bug records, **not GitHub Issues**, CI jobs or merges. The issue paths and owners below are the single source of tracking for this audit; append implementation commit and proof before closing.

| ID | Severity | Owner | Evidence state | Finding / QA dependency |
| --- | --- | --- | --- | --- |
| [CG-MB-001](CG-MB-001-cg01-cg02-staff-branch-assignments.md) | P0 | CG-01/02 | `SOURCE_FIX_AUTHORED_REVIEW_PENDING` | Dedicated non-manager staff branch grants missing |
| [CG-MB-002](CG-MB-002-cg09-finance-delegated-branch-operators.md) | P0 | CG-09 | `SOURCE_INTEGRATION_AUTHORED_REVIEW_PENDING` | Delegated accountants/cashiers blocked without explicit assignment |
| [CG-MB-003](CG-MB-003-cg12-warehouse-operator-multibranch.md) | P1 | CG-12 | `SOURCE_INTEGRATION_AUTHORED_REVIEW_PENDING` | Ordinary storekeepers and multi-branch stock rights |
| [CG-MB-004](CG-MB-004-cg04-cg05-cg10-delegated-branch-roles.md) | P1 | CG-04/05/10 | `SOURCE_IN_PROGRESS_OWNER_PATHS_PENDING` | Membership, project and HR coordinators inherit manager-only scope |
| [CG-MB-005](CG-MB-005-cg02-branch-manager-transfer-and-close.md) | P1 | CG-02 | `VERIFICATION_GAP` | Branch manager reassignment/closure cascades |
| [CG-MB-006](CG-MB-006-cg07-original-donation-branch-provenance.md) | P0 | CG-07 | `SOURCE_FIX_AUTHORED_NOT_VERIFIED` | Original donation branch immutable proof in migration 3319 |
| [CG-MB-007](CG-MB-007-cg07-donation-report-root-and-branch-filters.md) | P1 | CG-07 | `SOURCE_FIX_AUTHORED_NOT_VERIFIED` | Same filtered list/KPI/trends/CSV branch report |
| [CG-MB-008](CG-MB-008-cg19-private-files-notice-current-branch.md) | P1 | CG-19 | `VERIFICATION_GAP` | Private document/recipient scope after source change |
| [CG-MB-009](CG-MB-009-cg20-mis-scheduled-cached-scope.md) | P0 | CG-20 | `SOURCE_FIX_AUTHORED_REVIEW_PENDING` | Scheduled MIS, cached artifacts and scope revalidation |
| [CG-MB-010](CG-MB-010-cg14-to-cg17-clinical-center-vs-foundation-branch.md) | P0 | CG-14–17 | `VERIFICATION_GAP` | External healthcare center is not Foundation branch |
| [CG-MB-011](CG-MB-011-cg18-approved-public-branch-deactivation.md) | P1 | CG-18 | `VERIFICATION_GAP` | Public CMS branch source after deactivation |
| [CG-MB-012](CG-MB-012-cg11-payroll-branch-allowance-and-original-payments.md) | P1 | CG-11 | `FUTURE_IMPLEMENTATION_GATE` | Payroll branch assignment and original CG-09 posting |
| [CG-MB-013](CG-MB-013-future-owner-root-branch-center-qa-contracts.md) | P1 | CG-06/08/13/22–24 | `FUTURE_IMPLEMENTATION_GATE` | Original future owner branch/center explicit QA |
| [CG-MB-014](CG-MB-014-cg12-cross-warehouse-transfer-both-sides.md) | P1 | CG-12 | `VERIFICATION_GAP` | Cross-warehouse rights and last-unit races |
| [CG-MB-015](CG-MB-015-global-app-selected-branch-ux-policy.md) | P2 | Shared UI | `SCOPE_DECISION_REQUIRED` | Whether one synchronized app-wide branch switcher is in approved scope |

## Triage and closure order

1. **P0 actual shared-source scope limitations:** CG-MB-001 → CG-MB-002; verify CG-MB-009/010 independently, do not silently expand access. Pre-existing `main` lives on root/protected branch admin or a designated manager, and ordinary role grants alone must never expose other branches. Full CG-01/02 policy decision before committing new grants.
2. **Current CG-07 owner fixes:** CG-MB-006/007 have committed candidate source already. Complete independent review + actual PostgreSQL 3319/TypeScript/Next/native API and two-branch test. Failed tests must be fixed in the same authorized feature branch, not new hotfix branches.
3. **Other existing owner consumers:** CG-MB-003/004/005/008/011/014, then targeted CG-MB-009/010 cross-owner source reviews. Every accepted fix needs source-owner tests and permitted Web/Internal Android UX; public apps only when original audience qualifies.
4. **Future development gate:** CG-MB-012/013 and CG-MB-015 as explicit planning/UX decisions; never mark “fixed” simply by updating specs. All **24 module `tasks.md`** files receive story-level A/B+Center X/Y overlays without renumbering original QA.

## Test evidence protocol

Use the [two-branch and two-center test matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md) and [source comparison](../../research/CAREGANGA-MULTIBRANCH-MAIN-VS-CG07-SOURCE-AUDIT-20261123.md). Each issue must record `owner_file:function`, `source_before/after`, `commit_sha`, `reviewer`, `US/QA original IDs`, `test_runner + command`, `real DB/APIs/UI screenshots`, result `SOURCE_ONLY | RUNTIME_PASS | FAIL | BLOCKED`, and a closure date. No invented test result, no technical IDs in end-user UI, no fabricated pass. Never merge to `main` until authorization and local developer gates completed.


## 23 November source implementation checkpoint (no runtime certification)

The approved greenfield **CG-MB-001** CG-02 assignment model (migration 3320, real Foundation branch/area records, protected independent staff grant/end, current account session invalidation) and CG-02 source facade are **AUTHORED**, with source-only receiving owner changes for CG-MB-002 finance, CG-MB-003 inventory and CG-MB-004 HR/project/membership. No historic BWC/production-data compatibility paths were added. The mutable statuses above are **not closed**: independent owner review, security/database review, TypeScript/Next/Android build, PostgreSQL migration/restore and real A/B/closed-C/scoped CG-14 center QA remain NOT_RUN. CG-MB-004 has further owner paths to inspect and fix. Keep all 15 unique issue IDs and original 24-module QA overlays; do not merge.

**Current manager reporting source candidate (23 Nov):** CG09 CG20 posted A+B aggregate across ONLY live current CG02 branch/area grants plus protected Foundation admin full scope, Web and Internal Android parity; tracked in CG-MB-009. Runtime test still NOT_RUN. Original root Foundation money excluded from restricted manager aggregate. One issue remains open and is not duplicated.


### 23-Nov senior manager hierarchy source checkpoint

Implemented source candidate: protected root sees Foundation and branches; CG02 `ALL_BRANCHES` non-root delegated manager sees current/future active branches but never Foundation-null money; `AREA` manager sees active descendants; explicit `BRANCH` A+B manager sees only A+B. CG09+CG20 current permitted union reports preserve original posted finance and source, Web and native UI reflect the distinction. Targeted static review 13/13 invariants (NOT runtime). `cg02-staff-scope-contract.test.ts`, disposable `cg02-staff-scope-db-integrity.test.ts`, `cg20-multibranch-manager-contract.test.ts` are authored but **not executed**. P0 bug CG-MB-001 and source task CG-MB-009 remain open pending independent security/DB review, source QA and local PostgreSQL/Web/Android. No greenfield compatibility code or main merge.


### 23 November — final source reviewer checkpoint and actual execution handoff

[**Current local developer handoff / no-merge gates**](../../qa/CAREGANGA-CG07-MULTIBRANCH-LOCAL-DEVELOPER-HANDOFF-20261123.md). New source corrections: CG-MB-001 active-branch evidence guards for authorized delegated managers; CG-MB-006 `3319` rejects original branch, kind and campaign retarget; CG-MB-007 report/CSV/private donor post-read revocation checks; CG-MB-009 original CG09 root→manager mid-report downgrade no longer discloses a root-wide result; CG07 US003-QA13 Razorpay reconciliation fixes parameter order and prevents processing-state rollback with official refund idempotency key. Tests added, NOT_RUN. **15 records remain, 0/15 independently closed**, including explicit future/UX entries; do NOT present these as 15 confirmed runtime bugs or as 15 source passes. No local DB, Next, Nest, Android or Razorpay execution was performed. Merge strictly only after the developer's independent review, current owner source fixes, executable QA and approved PR to remote `main`.
