# CG-MB-006 — cg07 original donation branch provenance

**Priority:** P0 · **Owner:** CG-07 + CG-09 + CG-19 · **Status:** SOURCE_FIX_REVIEWED_RUNTIME_PENDING · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

Current feature has new 3319_cg07_donation_branch_provenance.sql trigger: branch_ref immutable after insertion and campaign donation must inherit same-root current campaign branch.

## Required business behavior

No direct SQL/API can move an accepted campaign donation, finance reversal, donor status proof or receipt from branch A to B by changing a root-valid branch UUID.

## Reproduce and record

Migrate fresh and upgraded DB; insert correct A and Foundation campaign donations; attempt wrong-B insert and UPDATE branch_ref; compare CG-09 posted lines/CG-19 receipt before/after; concurrency.

## Expected closure fix, cross-owner dependencies

Run disposable SQL trigger and migration rollback/restore; independent review, then runtime source+Web+native sign-off; keep A/B original finance evidence.

**Receiving modules:** CG-07,CG-09,CG-19. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.


### 23-Nov — Independent source reviewer correction (source-only; open)

Original `3319_cg07_donation_branch_provenance.sql` has been tightened: UPDATE cannot retarget branch, source kind (`GENERAL` vs `CAMPAIGN`), source campaign ID or Foundation root. Original 3306 finance proof already binds the posted journal's branch to the original donation branch. Regression source assertion added in `cg07-donation-contract.test.ts`. **No disposable PostgreSQL execution/SQL tamper proof yet.** Merge BLOCKED until negative insert, update, financial posting, receipt/refund and stale-session tests all pass and independent DB reviewer accepts. See [developer handoff](../../qa/CAREGANGA-CG07-MULTIBRANCH-LOCAL-DEVELOPER-HANDOFF-20261123.md).


### 23-Nov-2026 — final source-owner review disposition

**Reviewed original owner source:** CG07 migration 3319 validates campaign same-root branch on insertion; prevents retarget of branch, root, donation kind and campaign identity on update. CG09 posted journal and CG19 receipts remain original owner.

**Executable evidence pending:** Real PostgreSQL wrong-branch insert/update, migration and CG09/CG19 money audit NOT_RUN.

**Gate:** source authored/reviewed; NOT_RUNTIME_PASS; no CI/GitHub Actions, no merge until local QA verified.
