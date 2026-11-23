# CG-MB-005 — cg02 branch manager transfer and close

**Priority:** P1 · **Owner:** CG-02 + downstream owners · **Status:** VERIFICATION_GAP · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

CG-02 BranchOperationsService stores manager and active status; project/finance/inventory source paths re-evaluate manager and active branch. Full stale-session, saved draft, queue and signed-link propagation not yet proven end-to-end.

## Required business behavior

Manager A loses A access immediately after reassignment/closure; new manager gains only current legal scope; historical posted journal and uploaded evidence retain original branch.

## Reproduce and record

Transfer A manager to B and close C with 2 concurrent Web/Android sessions; repeat old work/URL/queued approval/attachments and run scheduled export.

## Expected closure fix, cross-owner dependencies

Prove transaction/version ordering across CG-01/02/03/04/05/09/10/12/19/20 and add owner-source fixes for any bypass; no manual reattribution of finance.

**Receiving modules:** CG-01,CG-02,CG-03,CG-04,CG-05,CG-09,CG-10,CG-12,CG-19,CG-20. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.
