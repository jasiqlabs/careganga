# CG-MB-012 — cg11 payroll branch allowance and original payments

**Priority:** P1 · **Owner:** CG-11 payroll (planning) · **Status:** FUTURE_IMPLEMENTATION_GATE · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

Original CG-11 module/tasks require Foundation/eligible branch period payroll, frozen actual CG-10 employee assignment and CG-09 posted payment. No CG-11 backend module appears in merged main.

## Required business behavior

Each employee's effective compensation/run/payslip/instruction is scoped to actual current/historic branch and private employee; branch transfers do not rewrite signed payslips or mix A/B net pay.

## Reproduce and record

Before US-001 source completion, test employee A then transferred B mid-pay-period; historical compensation, attendance, source revision, payroll approve and real CG-09 separate payable/refund.

## Expected closure fix, cross-owner dependencies

Treat this as mandatory original US-001–003 acceptance; implement original owner composite scoped FK, source snapshot, two-step reviewer and real bank proof; no premature code status PASS.

**Receiving modules:** CG-11,CG-10,CG-09,CG-19. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.
