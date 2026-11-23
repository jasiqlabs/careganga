# CG-MB-008 — cg19 private files notice current branch

**Priority:** P1 · **Owner:** CG-19 documents + communications · **Status:** SOURCE_FIX_REVIEWED_RUNTIME_PENDING · **Scope:** active CG-07 feature branch only · **Runtime:** NOT_RUN

## Source evidence / observed limitation

CG-19 maintains source-owned private CG-02 branch files, donor receipt, staff/patient/finance documents and outbox delivery. Complete recipient/file reauthorization under branch reassignment has not been independently traced.

## Required business behavior

File download, signed link, document list, recipient/notification and staged outbox must check current source owner, consent and branch/center rights, never expose B to A.

## Reproduce and record

Issue a private branch B letter, queue a B notice, transfer role before delivery/open. Attempt downloaded URL/receipt/notification as A, as center X and after revocation.

## Expected closure fix, cross-owner dependencies

Map every relevant CG-19 original source family to actor scope, expiry, source version and required consent; correct only verified cross-scope leak, then device/email sandbox QA.

**Receiving modules:** CG-19,CG-01,CG-02,CG-14,CG-20. **Common QA:** [Two-branch and center scenario matrix](../../qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md). Verify original story QA IDs and do not replace them. **Gate:** Implement → independent Review → Fix → Re-review → source trace → local PostgreSQL/Web/Android/device/provider QA. Document real test fixtures, exact file:function and result. No CI/GitHub Actions or merge.


### 23-Nov-2026 — final source-owner review disposition

**Reviewed original owner source:** CG19 branch evidence uses CG02 current owner; 3321 adds immutable original A/B scope to CG20 finance files, CG19 inbox/read/scheduled notice and CG20 download require original subset of CURRENT CG02 grants so an old A+B file cannot leak after B revoke.

**Executable evidence pending:** Private object bytes, expired signed URLs, current admin/root downgrade, cross-account PDF and two-device runtime QA NOT_RUN.

**Gate:** source authored/reviewed; NOT_RUNTIME_PASS; no CI/GitHub Actions, no merge until local QA verified.
