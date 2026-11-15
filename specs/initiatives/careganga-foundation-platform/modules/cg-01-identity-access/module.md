# CG-01 — Identity, Accounts, Roles & Permissions

**Initiative:** careganga-foundation-platform  
**Planning scope:** CG-01 only · GREENFIELD · 14 November 2026  
**Source of truth:** [PRD](../../prd.md) FR-001–003, FR-080; BR-001/002/017 · [HLD](../../hld.md) §§4–5, 7–9 · [Foundation BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-01-BR01–10  
**Stage state:** REBUILT_FOR_REVIEW. No application source exists. Harness local preflight, final hash-bound approval, runtime/visual QA: NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel account, custom-role, permission-matrix and staff assignment journeys need purpose-built responsive Web and native Android UX.
dld_decision: REQUIRED
dld_reason: New security-critical account/session, effective grant, audit and relational schema; privacy, revocation and concurrency invariants.
database_impact: CRITICAL
database_reason: Account, role and grant records govern all later protected records and must prevent escalation and unscoped access.
mobile_store_impact: ANDROID
mobile_store_reason: Public and Internal Android authentication, with native Internal Android role and account-access management.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: Expo SDK 58 stable; React Native 0.88; React 19.3.0; Node.js >=22.13; Android compile SDK 37, target SDK 36, Android 7+ minimum. Expo-recommended compatible native toolchain/Expo Router dependency versions must be pinned during bootstrap, not guessed.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://developer.android.com/google/play/requirements/target-sdk
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no package manifest, AAB or device proof yet.
mobile_store_status: PLANNING_PROPOSED_NOT_BUILT

## 1. Deliverable outcome

After the **one-time technical bootstrap**, CG-01 is independently useful, with **no dependency on unbuilt CG-02/03/10/14**. An authorized Foundation administrator can:
1. Securely manage real login accounts, invitations, sessions, recovery and suspension.
2. Create, edit, copy and retire permitted roles; choose grouped action permissions in Web and authorized Internal Android.
3. Assign/revoke roles to **CG-01 accounts** in the real Foundation-root context, review access history, and safely search/select accounts and roles.
4. Enforce all active grants on the backend and show only permitted UI actions. Changing access immediately invalidates old effective permissions.

Foundation-root is a real single-Foundation administrative context, **not** a fabricated branch or unrestricted grant over future branch, center, finance or patient records. Future resources start **default-denied** until real authorized scope is assigned.

## 2. Data owner and boundaries

**CG-01 owns:** account/credential/session, verified contact, invitation, account status, protected and custom roles, stable capability catalog, role grants, account-role assignment, Foundation-root scope, effective access calculation, and access-change audit. Approval-dependent protected access changes are introduced **by CG-03 after CG-01 works**; the first module creates no pending-only approval feature or CG-03 case.

**CG-01 does not own:** HR employee profile/status (CG-10), geography/branch/department (CG-02), approval cases (CG-03), provider/center and doctor (CG-14), member/volunteer (CG-04), patient (CG-15), finance, files or communication delivery. The same verified login may link to future relationships only through the relevant owner, never by matching phone alone. Do not create fake master rows or a universal cross-module dropdown.

**First delivery prerequisites:** only the technical bootstrap (one backend, PostgreSQL migrations, Web shells, two Android app shells, secure configuration). No separate identity microservice, runtime rule-language engine, duplicated platform permission database or artificial module framework.

## 3. Channels and complete current journeys

| Channel | CG-01 capability |
| --- | --- |
| Foundation Admin Web (responsive) | Login/recovery; accounts directory; invite/suspend; create/copy/edit/retire roles; grouped permission editor; assign/revoke role; audit; Foundation-root context |
| Internal Android | Login/recovery; task-first native role creator/editor/copier; account lookup, invitation and role assignment/revocation; same backend rules |
| Public Website + Public Android | Public browsing without staff privileges; verified account authentication/self-service building blocks only where a real owning business flow needs them |
| Healthcare Center Portal | Secure sign-in and explicit default-deny guards; **no active center affiliation or center administration until CG-14 real records exist** |
| Backend/DB | Authoritative auth, scoped action checks, safe options, versioning, revocation, audit, sanitized errors |

The permission catalog uses clear business labels in clients and stable internal keys in the API. Grant creation never silently gives a role newly introduced future capabilities.

## 4. Real integration ownership — not CG-01 blockers

| Later owner | What it introduces and must verify |
| --- | --- |
| CG-02 Foundation Structure | Real state/district/subdivision/block/branch and department records; scoped assignment selectors/authorization and negative cross-branch tests through CG-01 access |
| CG-03 Approvals | Adds genuine approval-dependent access-change applications targeting already-existing CG-01 accounts/roles; only after review may CG-03 call CG-01's guarded, idempotent grant finalization. No first-module dependency |
| CG-10 HR | Verified employee-account association; employee type, designation, joining date, employment/status filters in the CG-01 people directory |
| CG-14 Healthcare Network | Real center/location/staff affiliations and safe selector; center-specific role binding, revocation, and prevention of Foundation/medical privilege inheritance |
| Every later owner | Register only its approved action keys; expose its own minimum-field `options` endpoint for required selectors, with distinct permission from confidential detail/list/export |

**Rule:** Design a small typed extension point in CG-01; never insert placeholder geography, employee, center, doctor or approval data. The real integration and end-to-end QA are acceptance of the later module that makes those owner records available. The full PRD/BR scope remains intact.

## 5. Mandatory source-matched UI/UX and motion

**PRD N-13 / HLD H-12 applies without exception** to all CG-01 user-visible surfaces. The existing [CareGanga Admin Panel audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) (§2.1, **U02–U10, B34**) and original screenshot/video ZIP supply the existing **color/theme/look/feel, layout and interaction** authority. Reuse one project-wide source-extracted theme/component/motion implementation, never a new palette or invented UI animation. Required [CG-01 UI/UX](uiux.md) records screen-by-screen references; the role and account stories in [tasks.md](tasks.md) explicitly validate existing sidebar/header, cards, tables, right-side drawers, permission matrix, status treatment, native look, loading/pending feedback, and verified transition behavior. Static screenshots do not prove precise animation timing: actual source/video is required for final visual parity; respect reduced-motion/accessibility.

**Pass condition:** Manual source inspection checks theme tokens, source-matched component usage and native/responsive behaviors; independently authorized live visual QA compares the result against original reference images/videos before declaring an exact-color/animation PASS. Until original assets and rendered screens are inspected, keep `VISUAL_NOT_RUN` and `REFERENCE_ASSETS_NOT_VERIFIED`. Preserve UI identity across future CG modules; do not duplicate the token catalog in every module.

## 6. Non-negotiable acceptance

- Every protected action requires **current authenticated account + permitted action + valid actual resource scope**. Unknown scopes, revoked access and guessed IDs fail closed, including search, selector, export, files and direct API calls.
- Protect the initial Super Admin/root authority (including recovery and last-root safeguards); no ordinary role edit, role copy or assignment may elevate to root. Audited role/grant/assignment mutations are atomic and concurrency-safe.
- A workflow's required safe selector can return authorized **minimum** names/context without opening confidential records; no private list endpoint merely to populate a dropdown.
- Web/Internal Android use the **same** business grants, names, validation and outcomes. Show meaningful account/role names, never UUIDs, raw permission codes, SQL or exception messages; include loading/empty/pending/denied/conflict/retry states.
- Credential protection, rate-limited recovery, session invalidation, privacy-safe logs, bounded directory pagination, database constraints/indexes, accessible responsive/native UX and no unbounded polling are mandatory.
- Manual source QA per approved story covers backend, database, responsive Web and Android. **No CI/GitHub Actions.** Runtime, visual appearance, Play Store binary and performance remain NOT_RUN/NOT_MEASURED until independently authorized QA.

### Harness completeness — product-wide NFRs applied to CG-01

**Database (CRITICAL):** accurate account/session/role/grant/one-active-role-per-context keys and UNIQUE/FK/CHECK constraints, protected last Super Admin, scoped read/search/options/export, versioned migrations and rollback/recovery. DLD owns exact schema, transaction locks and index choices. No technical Foundation-root row may substitute for CG-02 geography or branch.

**Idle cost/workers:** MFA, invitations and recovery run only from genuine actions using bounded provider attempts and honest delivery status; zero due work must not cause tenant-wide polling, repeated DB scans or provider sends. No mandatory import worker, Redis or new queue. Request/DB/provider usage and costs are `NOT_MEASURED` until tested.

**Human errors and diagnostics:** Same plain-language outcomes across Web/Android, including duplicate role, blocked action, stale edit, invalid/expired verification, delivery pending, provider unavailable and unknown save result; errors show safe next actions and never technical IDs. Append-only security audit is durable with authorized permission changes; structured **restricted** technical logs carry redacted correlation/support references, bounded metrics and no credential/PII payloads. Diagnostic failure cannot turn a committed update into a false failure.

**Security/reliability:** enforce server authorization on every API/selector/search/export, current role and session revisions, MFA for privileged roles, rate limits, concurrency/idempotency, scoped caching, safe secret storage and old-client compatibility. CG-01 must be independently functional with only its technical bootstrap. UI retains original CareGanga tokens and source-supported transitions. Record unexecuted CRITICAL DB specialist review, visual/device checks and live measurements as pending, never PASS.

## 7. Planning outputs and gate

Only these four files constitute CG-01 Planning: `module.md`, `uiux.md`, `dld.md`, `tasks.md`. Tasks are cross-stack business outcomes, not backend/Web/mobile phases. No stories.md, duplicate tracker, future-owner task masquerading as CG-01 completion, or extra design stage.

The approved product PRD/HLD stay authoritative. The source-checked Harness main is `3713f13f2ea658a0cc42f8fbf98b4cc5b5b990fd`. This rewritten pack must undergo the pinned local Harness **prepare/finalize resolver**, latest complete-artifact review and SHA-bound `DELEGATED_APPROVED` record before Development; do not claim those checks were executed in this connector-only session.
