# CG-MB-007 — cg07 donation report root and branch filters

**Priority:** P1 · **Owner:** CG-07 reporting · **Status:** SOURCE_FIX_AUTHORED_NOT_VERIFIED · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

Current feature DonationAdminService.reportScope/list/exportCsv, Web A16 workspace, protected BFF and source contract now use live CG-02 allowed branches and ALL/FOUNDATION/branch filters.

## Required business behavior

A root admin gets Foundation-only, A, B and combined reports; A manager gets A only. List/KPIs/monthly trends/gross/refunds/net/export have identical source scope; no IDs/private PAN on screen.

## Reproduce and record

A/B with distinct posted money and a partial refund; compare totals to actual CG-09, attempt forged B query as A and cookie/role revocation during CSV request.

## Expected closure fix, cross-owner dependencies

Execute backend typecheck/postgres, browser exports, Web/Internal Android parity and original A16 screenshots; independent review; no main merge.

**Receiving modules:** CG-07,CG-02,CG-09,CG-20. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.
