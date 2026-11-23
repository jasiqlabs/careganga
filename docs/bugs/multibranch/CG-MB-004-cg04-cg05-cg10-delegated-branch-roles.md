# CG-MB-004 — cg04 cg05 cg10 delegated branch roles

**Priority:** P1 · **Owner:** CG-04 + CG-05 + CG-10 · **Status:** CONFIRMED_SOURCE_DEPENDENCY · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

CG-04 MembershipRosterService/VolunteerRosterService and CG-05 ProjectsService use projectBranchScope; CG-10 HrEnrollmentService.branch/availableBranches use branch manager or root branch admin.

## Required business behavior

An ordinary authorized membership/volunteer/project/HR coordinator gets only their specifically assigned branches and can never search unrelated persons or employee records.

## Reproduce and record

Use two managers and one non-manager with allowed domain capabilities; query member/volunteer rosters, private exports, project assignment and HR enrollment across A/B. Existing common scope does not establish separate staff-specific branch grants.

## Expected closure fix, cross-owner dependencies

Review role policy; integrate CG-MB-001 single authoritative scope into each owner without widening public/self user rights; DB/API/UI/Android parity.

**Receiving modules:** CG-01,CG-02,CG-04,CG-05,CG-10. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.
