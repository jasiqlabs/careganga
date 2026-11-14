# CG-01 — Identity, Accounts, Roles and Permissions
**Initiative:** careganga-foundation-platform · **Mode:** GREENFIELD · **Planning state:** DRAFT / SOURCE_REVIEWED; local Harness resolver NOT_RUN
**Business owner:** CG-01 · **Authoritative requirements:** PRD FR-001–003, FR-080; BR-001, BR-002, BR-004, BR-017; Foundation CG-01-BR01–10; shared CG-NFR-600
**Architecture:** ../../hld.md §3, §4.1–4.3, §5.1–5.4, §7–9; published Harness `3713f13f2ea658a0cc42f8fbf98b4cc5b5b990fd`

uiux_decision: REQUIRED
uiux_reason: Greenfield role management and identity journeys span Foundation Admin, center portal and two native Android apps; premium responsive navigation, permission editor, role/assignment selection and accessible safe error states require deliberate user-facing design.
dld_decision: REQUIRED
dld_reason: New account/session/roles/grants schema and data-scope authorization are CRITICAL, crossing five channels, financial and clinical privacy boundaries and invalidation/revocation guarantees.
database_impact: CRITICAL
database_reason: New authoritative identity, session, role and action/scope grant records control cross-branch and cross-center access to sensitive finance, staff and healthcare data; a mistaken scope join can disclose protected records.

mobile_store_impact: ANDROID
mobile_store_reason: Both approved Android distributions need secure authentication, role-aware navigation, session expiration and restricted user-friendly API behavior; no iOS product is in approved scope.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: Greenfield proposed Expo SDK 58 stable + React Native 0.88 + React 19.3.0 + Node 22.13.x+ (supported LTS line) + Android compile SDK 37/target SDK 36; use official Expo-compatible Gradle/AGP/Kotlin/NDK native versions as a pinned tested pair at implementation, 64-bit and 16 KB-compatible native libraries. Android 7+ baseline subject to product security/device support decision. Use Expo Router compatible with SDK 58 and maintained stable dependencies; two Android app identities with shared domain-neutral client contract, not one app with privileged switches. iOS not contracted.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://support.google.com/googleplay/android-developer/answer/11926878 ; https://developer.android.com/guide/practices/page-sizes ; https://docs.expo.dev/versions/v58.0.0/
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no package manifest or lockfile exists yet, no binary check or execution performed.
mobile_store_status: PLANNING_PROPOSED_NOT_BUILT

## Scope and source of truth
**Owns:** authenticated account and contact verification references, credentials/session lifecycle, role definitions, protected built-in duties, action grants, account-role assignments, per-actor scope grants, effective-access decisions and role-change audit references. **Does not own:** employee/volunteer/member/patient/doctor profiles, Foundation geography/branches, healthcare provider locations, approvals, CMS or financial/clinical records. A single verified account can link to multiple permitted business relationships, but no cross-domain relationship is inferred from a shared phone number.

**Actors:** Super Admin (protected bootstrap/root administration), delegated Foundation role manager, staff/volunteer, center authorized administrator/operator, public verified applicant/member/donor/patient, anonymous visitor, internal system/job identities. A public profile is not automatically a staff/center account.

**Included workflows:** secure creation/invitation/activation/suspension/recovery; **UI-driven role creation, permission editing, role copying, staff role assignment and scope assignment on responsive Foundation Admin Web and authorized Internal Android**; protected roles, assignment/history and user-friendly permission matrix; server-authorized org/region/branch/center action and record scope; authorized user directory/search/filter; narrowly delegated center personnel actions only; public sign-in/self-service for approved journeys; permission-aware state in five channels; login/session revocation and audit.

**Excluded:** separate identity provider microservice, custom rule scripting, unlimited dynamic permission expressions, copied customer/patient data, arbitrary clinical access inferred from a role, role system per module, public exposure of technical IDs or permission keys, unauthorised iOS client.

## Interfaces, dependencies and ownership
| Consuming surface/domain | CG-01 contract / integration rule |
| --- | --- |
| Foundation Admin web | Full authorized role creator/editor/copier, grouped permission controls, staff role and Foundation-geography/branch assignment, directory/audit on desktop, tablet and phone browsers; not new HR master |
| Healthcare Center Portal | Center-granted session and selected authorized operating location; only explicitly delegated center-staff assignments and narrowly bounded permissions, with no Foundation-wide or patient-clinical privilege administration by inference |
| Public website and Public Android | Verified public session only where service requires; no internal role menu or clinical disclosure |
| Internal Android | **Authorized role creation/editing/copy, grouped permission editor, staff role assignment and permitted location assignment through task-focused mobile screens** using the same backend; no desktop-style giant grid. Unavailable actions fail server-side even when stale client caches them |
| All backend modules | Shared principal, action+resource+scope policy evaluation, scoped query constraints, denial and audit; linked dropdowns must include required permitted reference options without exposing foreign scope |
| CG-02 Foundation Structure | Owns geography, branches, department/committee; CG-01 references approved scope targets, does not create their data |
| CG-14 Healthcare Network | Owns center/location/professional records; CG-01 governs staff grants, not clinical relationship |
| CG-03 Approval | Owns approval decisions for protected assignments where policy requires; pending route cannot grant effective access |
| CG-10 HR / CG-04 / CG-15 | Owns employee/member/patient relationship truth and employment/status; CG-01 links verified relationships through approved owner interface |

**Dependency order:** establish CG-01 account/authenticated principal and safe response contract first; use a minimal controlled Foundation bootstrap (without fictional geography). CG-02 foundation structure and CG-14 center directory must exist before claiming complete live scoped grants for those entities; CG-03 approval can be integrated when its owner is ready. Cross-module source integration is *not* considered complete if only fixture IDs or UI visibility exist.

## Verified BrickOps master reference — patterns only, not copied business rules
Reviewed `jasiqlabs/brick-ops@master`: `frontend/src/app/dashboard/staff/roles/page.tsx` (Web role creator/editor/copy and grouped checkboxes), `frontend/src/app/dashboard/staff/page.tsx` (role and assigned-plant selectors), `mobile/src/modules/staff/StaffRolesScreen.tsx` (native role editor), `mobile/src/modules/staff/StaffFormScreen.tsx` (native role + location assignment), `backend/src/modules/rbac/middleware/permission-catalog.ts`, `backend/src/shared/security/plant-scope.ts`, and `frontend/src/modules/permissions/useEffectivePermissions.ts` / `mobile/src/core/auth/useEffectivePermissions.ts`.

**Reuse as CareGanga design ideas:** centrally owned stable business capabilities with human-readable labels; protected built-in roles; customizable grant selection; role cloning copies permissions only; role and **authorized scope** combine at backend; revocation invalidates effective access; Web and Android use backend-derived access hints; `selection/options` access is narrower than financial/clinical `view` rights; frontend caches fail closed across role/context changes.

**Avoid copying BrickOps weaknesses:** production/plant/cashier role keys and business assumptions; automatic selection of a broad first role; generic role-name-only authorization; raw `Error.message` display (notably in some Android catch handlers); a private list endpoint used to populate a safe picker; duplicated permission tables in Web and mobile; and previously reported PASS as evidence of current CareGanga verification. CG-01 must instead rely on the CareGanga permission catalog, scoped queries and safe message contract. For a permitted workflow, every required safe selector (e.g. staff, doctor, center, branch, cashier/account where applicable) must have **minimum necessary read-only options** without conferring confidential ledger, salary, patient record or unrestricted admin access. Every such supporting-options dependency must have its own QA scenario when consumed.

## Unbreakable policies / NFRs
- **Default deny:** a permitted action AND valid authorized resource/geography/branch/center assignment are both required, including list, search, child dropdown, related record, export, signed-file access, jobs, reports, webhook and audit access.
- Protected built-in Super Admin account/role cannot be deleted or silently altered; no permanent shared admin password. Invitations expire; remove/revoke active sessions on suspension or access changes. Effective access must be derived from currently verified assignments, not stale UI/JWT claims.
- Role cloning copies **grants only**, never assigned people. Role mutations are audited with actor, scope, old/new grants and date/time; no escalation to own authority or copying protected grants without authorization.
- Allow person to be public applicant, staff, member, donor or patient only through verified business-owner relationships; same contact alone is not proof of linkage/consent.
- Never show raw UUID, `role_key`, permission names, SQL errors, raw exception, paths/HTTP codes to an end user. Use staff names, roles, branch/center names and legitimate generated business reference numbers; safe verified defaults. Backend maintains opaque IDs and technical redacted logs with request/support correlation.
- Correct distinguish loading, empty directory, expired login, insufficient permission, duplicate contact/invitation, pending approval, revoked access and transient failure. No fake success, no protected account enumeration.
- Protect OTP/password/session/refresh tokens, rate limits and recovery lifecycle; do not put tokens/medical/payroll data in logs. Audit privileged role/access changes and unusual denied access without unbounded per-tenant polling.
- Use normalized indexed relational constraints scoped by owning business data; no per-module identity master, no id-based privilege grants, no generic dynamic SQL policy engine, no unnecessary message broker. DLD owns exact authorization patterns/migrations.
- **User experience:** compact responsive Foundation role matrix; visible permitted actions; accessible keyboard/screen reader, touch targets, long labels, smaller Android phone/tablet; web/mobile feedback human-readable and accurate.
- **Source-only Development:** implement, expert review by backend/security/DB + responsive Web/UX + Android and source-trace all each-story QA cases; runtime tests, screenshots and build results remain NOT_RUN, visual appearance VISUAL_NOT_RUN, performance NOT_MEASURED. Independent QA later is separate.

## Planning acceptance and downstream decisions
- FR-001–003 and relevant FR-080 user-facing outcomes can be traced through owned account/role/scope source contracts and all affected clients without duplicate ownership.
- Role matrix and staff assignment cannot omit required linked selectors; both hard direct API access and unauthorized UI paths are blocked.
- Audit and safe error handling describe exact allowed transitions and rollback in the module DLD.
- **External decisions for deployment/UAT (do not invent):** official Foundation bootstrap administrator and recovery process, OTP/email/SMS provider credentials, account identifier policy (email/phone verification), retention and support operator access, initial branch/center assignments, production store identities and device policy. These do not authorize public data leakage or relax P0 rules.
- **Planning stage boundary:** this module deliberately does not define all CG-02/CG-03/CG-14/CG-10 implementation; source stories depending on their real records remain integration-dependent. No live environment, OAuth/provider credentials, runtime test or visual preview exists.
