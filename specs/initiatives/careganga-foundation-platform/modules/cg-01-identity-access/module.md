# CG-01 — Identity, Accounts, Roles & Permissions

**Canonical delivery order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) · **Initiative:** `careganga-foundation-platform` · **PRD:** [FR-001–003, FR-080](../../prd.md) · **HLD:** [Architecture](../../hld.md) · **Foundation BR:** [CG-01-BR01–11](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) · **UI reference:** [167-screen Admin audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U01–U10/B34 and supplied original Admin login screenshots.

**Status:** GREENFIELD · 4 source-implementation stories · 51 source QA cases · development feature branch `feature/cg01-simple-auth-brickops-style-20261116`. Current exact-hash design approval, independent source review, PostgreSQL, Web and both Android runtime/device/visual qualification **PENDING/NOT_RUN**. The first complete CG-01 implementation must be qualified together with F0–F5 before production use.

uiux_decision: REQUIRED
uiux_reason: Original CareGanga Admin visual identity, login, role list/matrix, Add New Staff Account drawer and cross-channel identity actions.
dld_decision: REQUIRED
dld_reason: Security-critical credentials, mobile/email login uniqueness, protected role grants, revocable sessions, OTP recovery, audit and transaction concurrency.
database_impact: CRITICAL
database_reason: Unique account identity, role membership, access/version/session enforcement and single-use credential challenges are shared by all protected modules.
mobile_store_impact: ANDROID
mobile_store_reason: Native internal/public sign-in and recovery; Internal Android authorized account/role and security actions.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_store_status: BUILD_AND_DEVICE_VALIDATION_REQUIRED

## 1. Module outcome

CG-01 supplies one authoritative Foundation-wide account and access service. Every account uses a common sign-in method. Permissions are granted after authentication by current server-owned role and resource scope, never by the login form.

- The **first Foundation Super Admin** is created once via a protected offline operator script using full name, mobile, optional email and initial password. It is not a public HTTP action. A second bootstrap is refused; last-root safeguards apply.
- Authorized administrators create **every subsequent user** directly from original **U03–U04 Add New Staff Account** using full name, required unique 10-digit Indian mobile number, password, optional unique email and one currently eligible server-authorized role. The account becomes **ACTIVE immediately**. Administrator creation, assignment and protected role changes are permission-checked, audited and idempotent. There is no anonymous CG-01 registration form.
- Any active user, including Super Admin, Admin, staff, volunteers, healthcare professionals or authorized public/patient account holders, signs in with **mobile number or email + password**. Account creation does not require contact proof. A user can never select or elevate their own role. Public applications and patient membership are owned by their actual modules and do not automatically confer staff privileges.
- **Forgot Password** uses six-digit email OR SMS OTP to the account's **stored** registered contact. The code is random, purpose-bound, hashed, single-use and valid for no more than ten minutes; include account/network/recipient rate limits, resend cooldown, locked recent contact changes, neutral unknown-account responses, truthful provider states and retry caps. Confirmed reset revokes all prior sessions and rotates access/credential versions. Never accept a caller-supplied new delivery destination.
- **Change Password** works for every signed-in user with current password and new password. Successful atomic change revokes all sessions and records the action.
- Only currently eligible roles and scopes reveal protected navigation, selectors, actions and data. Enforce access again on the backend, with current account status and access-version invalidation; safe error/toast and accessible loading/unknown states are required on each channel.
- **Protected operations** (security policy, sensitive role changes, CG-03/21/19/02 approved operations) require current-password confirmation in their guarded write transaction, with distinct authorized reviewers, immutable source/decision versions, protected root and audit controls.

## 2. Four owner stories

| Story | Scope | Channels and data |
| --- | --- | --- |
| **US-001 — Initial identity, authentication and recovery** | One-time bootstrap, unique mobile/email, password credentials, common login/logout, session/token/access-version, Forgot/Reset by email/SMS OTP, signed-in Change Password, security audit, throttling | NestJS, PostgreSQL migration, Admin Web, relevant Public Web/Public Android, Internal Android |
| **US-002 — Role catalog and permission editor** | Protected Super Admin and allowed custom roles; role create/edit/copy/retire; grouped action grants and eligibility; permission-driven visibility | NestJS, PostgreSQL, Admin Web and Internal Android |
| **US-003 — Admin account directory and assignments** | Original U02–U04 staff drawer, Admin Create User, search by name/mobile/email, status, account details/history, role assign/revoke, eligibility, idempotent duplicate prevention | NestJS, PostgreSQL, Admin Web and Internal Android |
| **US-004 — Foundation-root session and security policy** | Versioned session maximum age, idle timeout, failed-attempt window/limit; protected current-password-confirmed changes, immutable revision and audit | NestJS, PostgreSQL, Admin Web and Internal Android |

## 3. Ownership and dependencies

CG-01 may start without any business module. It owns `access_realm`, `account`, `identity_credential`, `role`, `role_grant`, `account_role`, `auth_session`, `auth_challenge`, account/role command ledger, security policy and access audit. No employee, branch, clinical, provider, finance or CMS master is created here. Other owners reference CG-01's real actor/account permissions through typed interfaces, and must not duplicate credentials, approvals or recovery challenges.

CG-03 owns frozen approval case/reviewer decisions for sensitive grants. CG-21 owns nonsecret operational configuration and protected backup/recovery operation; CG-19 owns document and ordinary SMS/email notices/transports, not identity reset proof; CG-02 owns Foundation and branch structure. CG-14/15 and other public modules use CG-01 login only when a genuine authorized account exists.

The original 167-screen audit is the reference for Admin U01–U10 and B34. The owner-supplied original `admin.careganga.com/login` screenshots govern the sign-in page; native screens follow brand semantics. Do not invent fake roles, branches, numbers, patient profiles, data visibility or pixel/motion matches.

## 4. Technical and operational constraints

Use the existing single PostgreSQL migration history, one NestJS backend, Next.js Admin/Public Web, separate Internal and Public Expo Android apps, shared typed contracts and CareGanga design tokens. First startup requires only real CG-01 essential services. Optional ERP flags remain OFF by default without creating future ERP entities or workers.

Password hashes use the existing slow salted algorithm and policy checks. Avoid plaintext password/OTP/token in logs, API responses, documents or analytics. All protected reads/writes use tenant/realm/resource and current-session permission checks. Account creation and credential rotation are atomic and concurrency-safe, with bounded request sizes and predictable human-readable errors. No fake delivery success, unattended per-tenant polling or unnecessary background jobs.

## 5. Acceptance and QA

The canonical [tasks.md](tasks.md) owns **51 cases** across US-001 **18**, US-002 **11**, US-003 **14** and US-004 **8**. Implement → independent source review → fix → re-review → trace each amended case to real backend/DB/Web/Android evidence. These traces are not live tests. Runtime database migration, duplicate and reset concurrency, configured SMTP/SMS, backend/Web/native builds, device flow, security bypass, authorization, accessibility, performance, screenshot comparisons and independent qualified security/database approval remain **NOT_RUN** until actually executed.
