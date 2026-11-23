# CG-MB-011 — cg18 approved public branch deactivation

**Priority:** P1 · **Owner:** CG-18 CMS + original sources · **Status:** SOURCE_OWNER_REVIEWED_RUNTIME_PENDING · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

CMS source has Foundation-root scoped publication revisions; public CG-05 campaigns, CG-14 center and CG-02 branch fields should only publish independently approved current public information.

## Required business behavior

An internal private branch must not appear on public site merely because it exists. After branch close, private contact/photo/proof is not newly published; historical public archive follows actual approval state.

## Reproduce and record

Approve only public-safe branch A project/CG-07 campaign, then close/withdraw it while B stays active; verify public Next.js and Public Android cached navigation, CMS effective revision and CG-19 placements.

## Expected closure fix, cross-owner dependencies

Review publication owner current-source dependency and public cache/withdrawal semantics; no unverified auto-publish or guessed 80G document.

**Receiving modules:** CG-18,CG-02,CG-05,CG-07,CG-14,CG-19. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.


### 23-Nov-2026 — final source-owner review disposition

**Reviewed original owner source:** CG18 effective editorial source, CG07 qualified public campaigns, CG05 project/event public sources require real CG02 branch status ACTIVE (or original Foundation-null) with CG03 approval and CG19 rights. No new public master or publication bypass added.

**Next evidence:** Client public Web/Public Android, cache/CDN invalidation after B close/reparent and signed media runtime NOT_RUN.

**Gate:** Not a runtime PASS; future gates are not existing source defects; no GH Actions and no merge before local verified QA.
