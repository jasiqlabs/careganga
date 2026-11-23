# CG-MB-001 — cg01 cg02 staff branch assignments

**Priority:** P0 · **Owner:** CG-01 + CG-02 · **Status:** SOURCE_FIX_REVIEWED_RUNTIME_PENDING · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

CG-02 BranchSourceFacade.projectBranchScope/financeReportScope and InventoryCatalogService.requireScope authorize a root/protected branch administrator or the single branch.manager_account_ref. CG-01 role assignment is root-scoped; no general active staff-to-many-branches authorization projection was found.

## Required business behavior

Ordinary authorized accountant/cashier/storekeeper/coordinator can be delegated to one or several real active branches without being a branch manager and without receiving root authority.

## Reproduce and record

Create A/B managers; grant an ordinary finance/stock role; attempt to select an explicitly assigned branch through existing APIs. Source appears to reject a non-manager regardless of capability. Test with real current grants before claiming a runtime failure.

## Expected closure fix, cross-owner dependencies

Define least-privilege current CG-01/CG-02 branch assignment owner and validity/revocation; no shadow grants in CG-07. Require proof, effective dates, version/permission invalidation, currently active branch and audit. Every downstream owner must use the genuine facade. Manual/client policy approval may be required before expanding role semantics.

**Receiving modules:** CG-01,CG-02,CG-04,CG-05,CG-09,CG-10,CG-12,CG-20. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.

## Concrete least-privilege owner-source remediation design (SOURCE_PROPOSAL_REVIEW_REQUIRED)

**Original authority:** Foundation BR `CG-01-BR05` explicitly requires geography state/district/subdivision/block plus relevant branch assignments; `CG-01-BR06` separately requires center-specific personnel scope; Master BR `BO-02` and `BR-X01` require delegated non-manager geographic/branch operation. This must be resolved rather than labelling ordinary branch managers as the only possible users.

1. **Owner decision:** CG-01 continues to own authenticated account, role/action capability, session, access version and sensitive grants. CG-02 owns *which real active Foundation branch/geographic area that actor may act upon*. CG-14 owns external center affiliations; do not add center grants to a CG-02 branch table. Retain existing manager-only access until a reviewed assignment API, DB and UI exist.
2. **Minimal persistence proposal:** A forward-only CG-02 owner migration for real `(root_realm_id,account_ref,scope_kind,branch_ref_nullable,area_ref_nullable,active_from,ended_at,granted_by,source_revision)` scoped assignment history, with same-root composite FK to current CG-01 account / CG-02 area / branch, exactly one of branch/area where applicable, no conflicting active assignment under the same actor/source, audit and version. Prefer reusing an existing owner-owned link if an independent source review finds one; **do not create a second active assignment model**. Authorization evaluates current live assignment *and* current CG-01 capability; a historical assignment alone grants nothing. Regional area coverage requires current valid CG-02 hierarchy and active descendants, not a string-matched district name.
3. **Protected commands/UI proposal:** Only current authorized Foundation admin creates/ends explicit role-limited branch/geographic assignments with required fresh password and CG-03 review when the actual existing protected-grant policy demands it; non-manager target role must remain least-privileged. Web Admin and native Internal Android show human readable active branch/area choices, explicit effective changes, invalidated old permissions and safe empty/revoked state. Avoid client-supplied default `branchRef` as a grant, do not expose internal UUIDs to operators.
4. **Facade propagation:** Reuse one genuine CG-02 current-scope projection in `projectBranchScope`, `projectBranch`, `financeReportScope`, `requireFinanceActorBranch`, `financeBranches`, and equivalent current scope on CG-04/05/09/10/12/20; all consumers keep their **domain capability check** and true root/branch source. No blanket `finance.reports.view => all` and no shadow grant per module.
5. **Race/revocation:** Take a stable current account/role/area/branch lock or version proof in each write. End of assignment, role revocation, branch close, manager transfer and geography reparent must block subsequent permitted operations and queued sends while preserving historical posted finance/payslip/source. Recheck authorization for read/export and scheduled workers.
6. **Acceptance:** Ordinary authorized A-only accountant, A+B accountant, A-only inventory operator, unrelated B manager, protected root, revoked staff, inactive C and one area-level coordinator: exact positive/negative direct API, selector, PDF/CSV, current native Web state, current CG-09 journal and CG-12 transfer proof. All original owner QA IDs + MB-T01–T22. Independent security/DB review, source fix, re-review and local PostgreSQL/dual Android runtime qualification required. No historical migration rewrite, no CI, no main merge.

**Status stays CONFIRMED_SOURCE_SCOPE_GAP; this section is a proposed minimal remediation, not an implemented table, policy approval or executable PASS.**

## 23 November implementation checkpoint — source candidate, NOT certification

**Implemented on current branch:** migration `3320_cg02_delegated_staff_scope.sql` and one CG-02 `BranchStaffAccessService`/controller with live BRANCH/AREA grants, immutable same-root records, protected root-password grant/end, replay/audit, target account access-version invalidation. CG-02 `BranchSourceFacade` now authoritatively derives ACTIVE current branches from manager or per-account branch/real ancestor-area assignment, without conferring CG-01 action and without touching CG-14 center rights. CG-02 operating branch list/details/CSV, CG-05/CG-04 project/roster consumers, CG-09 finance/MIS and CG-10/CG-12 original sources have been integrated or are in receiving-owner review. Protected Web and Internal Android admin screens use original CG-02 API.

**Important limitations:** independent security/database/architecture source reviewer NOT_RUN; compile and migrated PostgreSQL (plus two-worker race, active geography recategorization) NOT_RUN; Web/Internal Android device visual QA NOT_RUN; full CG-10 and every consuming service may still have direct manager-only reads outside the updated paths. Keep parent bug review pending, no complete/PASS claim. New source-contract and disposable read-only PostgreSQL test files are authored, not executed. No BWC/legacy conversion (greenfield).

### 23 November — security reviewer fixes and explicit manager precedence (SOURCE_FIX_REVIEW_PENDING)

- The original **CG-01-BR05** organization/state/district/subdivision/block and specific branch model is applied as *role action AND current CG-02 source scope*, never as a numeric job-title rank. Foundation protected Admin sees all branches and root-only records; state/district coordinator sees only descendant active branches; multiple assigned A+B branch manager sees A+B, and A-only manager never receives B/ROOT through role name alone. CG-14 provider center permission remains separate.
- CG-01 staff-only eligibility now **rejects public patient/community and protected root accounts**, uses a current account-row exclusive lock before grant, and avoids LIKE wildcard patterns for safe staff lookup. CG-02 grant and end now lock the target account first to prevent competing protected administrator update/end deadlocks; CG-02 source locks current active grants and branch rows and holds Foundation root hierarchy read fence during a genuine caller transaction.
- Confirm `eligibleDelegatedStaff` and `eligibleDelegatedStaffOptions`, `BranchStaffAccessService.grant/end`, `BranchSourceFacade.permittedStaffBranches`, `3320_cg02_delegated_staff_scope.sql`. Newly authored CG02 contract and DB integrity tests remain **NOT_RUN**; account/role revocation and branch transfer race must be executed using two local sessions and a migrated PostgreSQL DB. For greenfield, there are NO backward-compatibility paths. Status is not closed; no main merge.



### 23 November — organization-wide senior manager support (SOURCE_AUTHORED_REVIEW_PENDING)

CG-01-BR05 specifically requires organization-wide, state, district, subdivision, block and branch geographic authorization. Existing two CG-02 assignment kinds were insufficient to express a non-protected high-level manager overseeing **all current and future ACTIVE branches without granting protected Foundation master privileges**. Greenfield migration `3320` now supports a third explicit `ALL_BRANCHES` staff scope, with one active per actor, no branch/area ref and preserved audited end/regrant. CG-02 `permittedStaffBranches` returns every ACTIVE branch for this grant, while `projectBranchScope.all`, `financeReportScope.all` and all original Foundation-null sensitive sources stay **false** unless the user independently holds protected Foundation admin authority. Original CG-01 finance/HR/project/MIS capabilities are still required before the branch source is considered. Senior manager gets A/B/C branch list and permitted branch totals, NOT root-only legal profile, donations, general journal or patient health center X/Y rights.

**Original manager hierarchy QA, NOT_RUN:** protected root = A+B+C+Foundation; high-level manager with ALL_BRANCHES = A+B+C only and all newly activated eligible branches; AREA manager = only ACTIVE children of approved state/district/block, including newly activated eligible descendants; A+B explicit manager = A+B; A branch manager = A only; ordinary staff = only scopes and role actions assigned. Verify all combinations against real current CG-01 capability/CG-02 status, wrong-root, parent reparent, manager transfer, protected-role revoke, concurrent last scope revoke and Web/Internal Android branch selector. Senior role TITLE without `ALL_BRANCHES` or matching AREA/BRANCH grant must not widen data. The new 13 targeted static source checks were performed by direct source inspection, **not** compiled tests or a PostgreSQL runtime PASS. No BWC/legacy handling (greenfield).


### 23-Nov-2026 — final source-owner review disposition

**Source evidence:** CG01 protected action and verified staff; CG02 3320 BRANCH/AREA/ALL_BRANCHES grant, immutable ledger, session version, Web/native selection; BranchSourceFacade branch/area projection, manager and area changes reserved to root.

**Remaining evidence gate:** Account role revoke, concurrent grant/end, branch move, 10k records and PG 3320 migration still require runtime execution.

**Tracking:** Owner/source stage is not RUNTIME_PASS, no CI/GitHub Actions, no main merge. Evidence and approved original QA IDs must be reconciled with `docs/qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md` and `docs/qa/CAREGANGA-CG07-MULTIBRANCH-LOCAL-DEVELOPER-HANDOFF-20261123.md`.
