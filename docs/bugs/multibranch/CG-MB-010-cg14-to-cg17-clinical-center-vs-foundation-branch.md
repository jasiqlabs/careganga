# CG-MB-010 — cg14 to cg17 clinical center vs foundation branch

**Priority:** P0 · **Owner:** CG-14/15/16/17 healthcare · **Status:** SOURCE_OWNER_REVIEWED_RUNTIME_PENDING · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

CG-14 HealthCenterSupportScopeFacade uses current representative/center affiliation, CG-15 CenterPatientIntakeService and CG-17 MonthlyProviderSettlementService use it. A CG-02 branch is not an external CG-14 center.

## Required business behavior

Foundation branch manager never gains clinical files from nearby Center X; Center X representative cannot inspect Center Y or Foundation-wide charity finance. Patient consent/doctor affiliation guard independent axes.

## Reproduce and record

Make branches A/B in same district as centers X/Y. Test center intake, booking, doctor, lab report, own gateway collections, subsidy, cross-center transfer and revoke affiliation.

## Expected closure fix, cross-owner dependencies

Trace CG-14 owner center grants, center-ERP flags, patient/doctor permissions, CG-17 center merchant and Foundation liability; actual direct API negative and Web/native/public QA.

**Receiving modules:** CG-14,CG-15,CG-16,CG-17,CG-22,CG-23,CG-24. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.


### 23-Nov-2026 — final source-owner review disposition

**Reviewed original owner source:** CG14 HealthCenterSupportScopeFacade uses actual verified provider, enabled center, active account affiliation and CG01 clinical permission; CG15/CG17 use original center owner, not CG02 delegated Foundation branch. Protected root finance and patient consent remain independent.

**Next evidence:** Center X/Y parallel roles, doctor/consent, ERP off, patient leak and original center ledger runtime NOT_RUN.

**Gate:** Not a runtime PASS; future gates are not existing source defects; no GH Actions and no merge before local verified QA.
