# CG-14/CG-15 — Main sync and healthcare UI/UX integration (2026-11-19)

**Direction:** latest `main` -> `feature/careganga-cg14-healthcare-network-dev-20261118` only.  
**Main baseline:** `47a0596d8e54418f7359ae9d9a18dbb16a644eaa`.  
**Previous feature:** `0905d9976e0d68eb800390945772a81c29207a20`.  
**Review gate:** source-level independent checks; browser/native rendering and runtime workflows **NOT_RUN**. Do not merge feature to `main` before developer QA.

## Incoming latest main changes reviewed
- Internal Android authenticated dashboard, drawer, bottom navigation, notifications, module cards and responsive login/recovery/account UI; replaced previous staff landing with the new reusable role-based module directory.
- Web staff-management redesign and dashboard/login styles, account administration components, protected Access Denied views, and latest shared CSS.
- DB worker cold-start retry and connection error handling, backend migration/runtime adjustments, web session login changes, and test fixtures.
- New Expo linear gradient dependency and lock metadata.

## Source-level integration fixes on this branch
1. Retain the new **main** native `StaffAuthenticationScreen` login presentation, recovery, authorization, dashboard and hardware Back behavior. Restore four existing protected CG-14/CG-15 lazy native routes with session expiry, error boundaries, permission checks, and secure token-only fetches.
2. Update `dashboard-modules.ts` to add a **HEALTHCARE ASSISTANCE** group with *My Consultation Queue*, *Book for a Verified Patient*, *Doctor Leave Reviews*, *Healthcare Verification Reviews*; use the same permission predicates as original code, and route them via the new dashboard handlers. No fictitious screens or medical numbers.
3. Retain **main** login and user-management CSS while appending the feature's locally scoped healthcare admin blue and public gold/green styles. Avoid swapping the client's public and staff brand presentation.
4. Combine new Expo linear-gradient with existing CG-15 `expo-print` and `expo-sharing` dependencies in `apps/android-internal/package.json` and root `package-lock.json`; maintain Android Public print/sharing lock metadata.
5. Preserve the latest **main** CG19 worker retry/LISTEN error handling and CG15's appointment committed LISTEN, durable cross-root appointment outbox reconciliation and original decision capture. Protected clinical notification sources must not be lost during an unrelated UX merge.
6. Reuse `main`'s premium `AccessDeniedView` for the 11 existing restricted healthcare admin/center web routes, while keeping their original server-authoritative permission predicates and fail-closed unavailable states.
7. Keep all unrelated incoming `main` changes as-is, including new native dashboard components and web users-management code.

## Checks and restrictions
- All 73 changed/new `main` paths must be included in the resulting feature tree, with exact main blobs for nonconflicting paths.
- All unaffected CG-14/CG-15 feature blobs must remain identical to the pre-sync feature tree.
- Conflicts: Android internal dependency, staff authentication screen, CG19 communication worker, global stylesheet, root lockfile. Resolve explicitly, not by choosing one branch wholesale.
- `main` must be an actual second-parent ancestor of the feature merge commit. No force update, `main` changes, GitHub Actions or CI jobs.
- Run local `npm ci`, TypeScript/native Metro builds, Web production build, actual healthcare role login/navigation, center + patient booking, doctor leave, queuing and protected CG19 notification regression.
- Compare live Web 1440/1280/768/390 and Android phone/tablet screenshots against latest main, including new dashboard and H07/H15 client-owned screenshots. Validate responsive drawer, keyboard, Back, large text, disabled states and accessible contrast.
- **No source marker or static inspection is proof of executed QA.** Existing formal CG15 story gates and original source-gap tracker are not reclassified here.

**Result:** Prepared for developer local build and visual QA; not production/merge-to-main approved.
