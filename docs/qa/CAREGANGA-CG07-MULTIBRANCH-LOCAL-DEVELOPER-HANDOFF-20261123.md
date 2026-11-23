# CareGanga CG-07 + Cross-module Multi-branch — Local Developer Handoff
**Date:** 23 Nov 2026 · **Development branch:** `feature/careganga-cg07-campaigns-donations-dev-20261122` · **Target after verified QA:** remote `main`.
**Stage:** Source fixes authored, independent specialist certification and runtime tests **NOT_RUN**. NOT a blanket source-complete or merge-ready signoff.

## 1. What changed and what is not claimed
- **CG-MB-001 P0:** Clean greenfield CG01/CG02 auth×scope: protected Foundation root, delegated `ALL_BRANCHES` (all current/future active branches, but no Foundation-null money), geography `AREA` (active descendants), one/multiple `BRANCH` assignments; immutable PostgreSQL migration `3320`, staff-only selection, target version invalidation, protected grant/revoke with reviewer password and audit, Web + Internal Android controls. Recent reviewer fix makes branch-evidence commands respect delegated active branch grants.
- **CG-MB-002/003/004:** CG09 finance, CG12 warehouse/catalog, CG04/05 project/member/volunteer and CG10 HR application, private detail, attendance, change-proposal source paths consume CG02 branch grants without copying authorization tables. CG-MB-004 is STILL source-open for owner paths not independently checked.
- **CG-MB-006/007:** CG07 `3319` authentic campaign-branch provenance, prevents donation branch/kind/campaign retarget, current A/B/FOUNDATION donation list/KPI/trend/CSV/post-query access checks and private donor read reauthorization.
- **CG-MB-009:** CG09 source-owned POSTED branch-wise/combined A+B/AREA/ALL_BRANCHES MIS summary+trend, CG20 dashboard, saved/export and due-worker. Explicit user branch, current all-assigned and Foundation/root scope are different; after-read role/scope check added. Web+Internal Android selectors share source; financial grouping/other reports still require independent scope review.
- **CG07 US-003 QA13:** Fixed verified Razorpay refund reconciliation: UPDATE stores `found.id` in `provider_refund_id=$4`, not `request_key`; no downgrade of already signed/posted states, and durable exact `X-Refund-Idempotency` header added. Only confirmed signed refund and CG09 POSTED reversal change donor net. QA04 donor pending/failed source authored; real Razorpay sandbox NOT_RUN.
- **Remaining:** 15 separate multi-branch records in `docs/bugs/multibranch/README.md`, including CG-MB-004/005/008/010/011/014 source-owner targeted inspections still open; CG-MB-012/013 are future implementation gates; CG-MB-015 needs original UI approval. DO NOT close them from regex/source presence. All 24 module `tasks.md` hold branch overlays, CG07 original 60 QA IDs retained; no story runtime pass claimed.

## 2. Local IDE / DB setup (no CI or GitHub Actions)
1. On authorized local checkout **fetch**, make pre-merge backup of local work, checkout exact feature branch above; verify clean working tree and compare with remote `main`. Do not reset/rebase/merge over dirty local changes. Use locked `npm ci` at repo root.
2. Set backend `apps/backend/.env` from existing documented sample; use a **disposable development PostgreSQL database**, never production. Configure only actual authorized test Razorpay, CG19 storage and media endpoints needed by case; no keys in source, commits, logs or chat. Protect `DATABASE_URL`, encryption keys and webhook signature.
3. Run `npm run db:migrate` on **fresh and separately cloned/upgrade** disposable DB; confirm complete migration order **3301–3320** including 3317–3320, unique scope constraints, triggers and same-root foreign keys. Test forced rollback/restore/failed migration.
4. Run `npm run verify:local-build` (Nest backend compile, Next Web production build, **both** Android Internal/Public TS typechecks) and `npm run verify:all-source`.
5. Run these explicit checks from repo root:
   - `npm run test:cg02-staff-scope -w apps/backend`
   - `npm run test:cg02-staff-scope-db -w apps/backend` (with disposable `DATABASE_URL`)
   - `npm run test:cg07-campaign -w apps/backend`
   - `npm run test:cg07-donation -w apps/backend`
   - `npm run test:cg07-donation-db -w apps/backend` (disposable DB)
   - `npm run test:cg12-all -w apps/backend`
   - `npm run test:cg10-all -w apps/backend`
   - `npm run test:cg04-volunteers -w apps/backend`
   - `npm run test:cg05-project -w apps/backend`
   - `npm run test:cg20-source-contracts -w apps/backend`
   - `./node_modules/.bin/tsx --test apps/backend/test/cg20-multibranch-manager-contract.test.ts`
   **Source contract passing is NOT scenario acceptance**. Fix broken tests **and genuine owner source**; never delete tests to obtain green.
6. Run actual backend + Next Web, Internal Android and Public Android app flows, screenshot-match the original client A12–A15/A16 Admin CG07 screens and existing CG01 baseline style. No UUIDs, raw errors, empty/broken chooser, unauthorized navigation.
7. Track JASIQ-dev per original story: implement/fix → independent review (backend, Web, both mobiles, security/DB) → re-review → source-specific scenario trace → fix → original tracker status and evidence. Keep same branch; commits small and meaningful. No BWC/legacy client compatibility is needed (greenfield).

## 3. Mandatory real data setup
Create Foundation root R, Active **North A** and **South B** (different managers/areas), Closed C, and unrelated active D. Add correct 4-level geography, regional state/district assignment, manager A, manager B, explicitly assigned A+B accountant, A-only cashier, A/B HR worker, warehouse operator, protected root and revoked staff. Create unrelated actual CG14 provider centers **X/Y**, distinct affiliated clinician/representative and consented patient. Generate ACTUAL original CG07 campaigns/donations, CG09 POSTED journal A=100, B=200, D=400 and Foundation-null=300 **minor units**, independent cash and verified gateway correction, CG12 warehouse transfer, CG19 private receipt, CG20 schedule artifact.

## 4. Must-pass positive/negative A/B/C/D + X/Y cases
- Root: Foundation-null plus A/B/D = **1000 minor units**; senior non-protected `ALL_BRANCHES`: A/B/D = **700**, never Foundation-null; A+B branch grants or district covering A+B = **300**; A-only manager = **100**. Check individually and combined on dashboard, report, monthly trend, saved/export/schedule/private artifact. **No role title alone grants access.**
- Direct forged B/D UUID for A-only member/volunteer/project/campaign/finance/HR/warehouse API, list, search, PDF/CSV, report, underlying SQL, native back button and queued notification **must deny**, no private source fields leaked.
- A→B manager transfer, close B, geography reparent, role/grant revoke mid-request and while scheduled file is being generated: current scope reauthorization. Repeat with account sessions open on both Android devices.
- Original donation branch immutable: attempt wrong-B campaign donation insert, post-donation `branch_ref`, `donation_kind`, `campaign_id` retarget SQL, and forged direct API. Must fail transaction with exact original posted CG09 and CG19 branch attribution unchanged.
- Razorpay sandbox: one persisted one-time original POST, provider unknown/timeout, reconcile original receipt via GET and exact provider refund ID, duplicate callback, wrong payment/amount/receipt, missing signed webhook, independent approval and CG09 reversal exactly once, CG19 receipt correction and donor pending/failed/posted truth. Never manually retry money-moving POST for unknown outcome.
- CG14 center X staff cannot inspect Y/patient notes or Foundation finance even if assigned CG02 branch A; A manager cannot inspect center X merely through geographic proximity. Exact doctor/consent + center manager status.
- Stock: approve A→B transfer only when actor has both branches and existing stock action; reject A→D, closed C, last unit under concurrent POST. HR current vs historical branch private access and CG19 signed downloads reviewed.
- Original `docs/qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md` MB-T01..22 **plus** each original CG07 US001/002/003 20 cases = **60** must be traced. Add actual tester, command, DB snapshots, 403/404, browser/device screenshots, defect and fix commits, reviewer, result. Never invent PASS.

## 5. Merge checklist / stop conditions
- **NO MERGE until:** source-open active-owner P0/P1 gaps (CG-MB-001,002,003,004,005,006,007,008,009,010,011,014 as applicable to implemented owners) are independently resolved or genuinely classified as future/non-applicable with documented owner proof; all builds/DB migrations/runnable unit+integration tests green; original 60 CG07 QA traces complete; real A/B/center X/Y/security/rollback/gateway QA passes; manual original UI parity verified.
- Future module gates CG-MB-012/013 stay tracked, not fake closed; CG-MB-015 requires actual approved UX decision (no unapproved global branch switcher).
- After independent security/database reviewer signs all current source gaps and local runtime passes, **commit fixes and tracking only to this branch**, push it, take fresh backup and compare `origin/main`, then PR/review and merge to remote `main` using approved JASIQ release process. **Do not use CI/GitHub Actions.** Check remote commit and live migration/deployment readiness post-merge.
- If a blocker remains, explicitly say **BLOCKED—not merge-ready**, identify original QA ID + bug + owning source, and continue fixing in this branch; do not quietly remove a failing QA.

**Evidence at authoring time:** Source checks and files were reviewed with connected GitHub source. No local build, disposable PostgreSQL upgrade, Razorpay sandbox, browser or Android device execution took place from ChatGPT. This is a **developer execution handoff**, not completion or merge authorization.
