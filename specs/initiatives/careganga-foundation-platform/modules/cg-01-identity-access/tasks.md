# CG-01 — Implementation Stories & Canonical QA

**Owner:** CG-01 Identity and Access · [PRD](../../prd.md) · [HLD](../../hld.md) · [Module](module.md) · [DLD](dld.md) · [UI/UX](uiux.md) · [Development order](../../DEVELOPMENT_ORDER.md).

**Design baseline:** single greenfield account and credential workflow. First Super Admin is created once by secure operator script; authorized Admin directly creates subsequent ACTIVE users with name/mobile/password/optional email/eligible role. Everyone signs in with mobile number or email + password. Forgot Password is the only credential workflow requiring a six-digit email OR SMS OTP. Every signed-in user can change their password. Restricted operations additionally require transaction-bound current-password proof and actual permission/reviewer controls.

**Implementation branch:** `feature/cg01-simple-auth-brickops-style-20261116`. **Stage:** source authoring and review in progress; **current content approval: REVIEW_REQUIRED** pending exact-hash review; **independent reviewer/security/database/runtime/device/provider/pixel-motion QA: NOT_RUN**. Historical integration of F0–F5 source into `main` does not mean this branch's authentication model has passed build, runtime or security gates. Do not create a duplicate QA tracker or report test PASS without evidence.

**Canonical QA count: 51** = US-001 18 + US-002 11 + US-003 14 + US-004 8. Keep stable identifiers and source evidence per case. Each case must trace actual end-to-end Web/native action, backend API/guards, PostgreSQL state, user-facing result, permissions and failure state as applicable. Only run on a fresh disposable PostgreSQL instance with provider sandbox credentials where required; do not run background CI/GitHub Actions.

## US-001 — Core Identity, Login & Password Recovery

**Scope:** One-time protected root setup, common password login, sessions, root credentials, reset OTP, current-password change, API/client security and initial workspace.

**Implementation sequence:** backend + schema → typed API → applicable Admin Web/Internal Android/Public Android → independent source review → fix/re-review → QA source trace → local build/migration/real device/provider execution.

| Case | Required test and source trace | Live execution |
| --- | --- | --- |
| **US-001-QA01** | Operator runs protected one-time Super Admin provisioning with valid name/mobile/optional email/password: one ACTIVE root account, role, strong hash and audit; no credentials logged. | **NOT_RUN** |
| **US-001-QA02** | Second/concurrent root bootstrap is rejected without creating another account or role; DB lock and unique checks hold. | **NOT_RUN** |
| **US-001-QA03** | Active Admin, staff, healthcare and eligible public account authenticate with mobile or email plus password; consistent session issue and appropriate permitted home. | **NOT_RUN** |
| **US-001-QA04** | Wrong password, unknown mobile/email, inactive account and brute-force requests show neutral errors, throttling and no session or account enumeration. | **NOT_RUN** |
| **US-001-QA05** | Logout, expired/idle policy, suspended/role-revoked account and stolen old token cannot fetch protected data on Web, Internal Android or Public Android. | **NOT_RUN** |
| **US-001-QA06** | Anonymous Public Web/Android browsing remains available; private deep links and API are denied without current authorization. | **NOT_RUN** |
| **US-001-QA07** | Protected Super Admin uses the same password login and has appropriate current permissions; direct protected API requires fresh current-password confirmation where specified. | **NOT_RUN** |
| **US-001-QA08** | Original `admin.careganga.com/login` screenshot fidelity: navy page, logo, lock, white card, label/icon structure, Remember Me, Forgot Password, primary button, secure-note/footer; screen-reader and responsive review. | **NOT_RUN** |
| **US-001-QA09** | Zero pending activity produces no per-tenant session/OTP polling or provider traffic; only actual requested recovery causes bounded work. | **NOT_RUN** |
| **US-001-QA10** | Email OTP: real SMTP accepted, transient provider error, timeout/unknown and missing config are distinguished without credentials/log leakage or false delivery. | **NOT_RUN** |
| **US-001-QA11** | SMS OTP: real configured provider accepted, transient error, unknown result and missing config are distinguished without credentials/log leakage or false delivery. | **NOT_RUN** |
| **US-001-QA12** | Fresh disposable PostgreSQL migration, required mobile/nullable email uniqueness, recovery/index/query and one-time root transaction checked, including restore and repeat-migrate behavior. | **NOT_RUN** |
| **US-001-QA13** | Backend, Web, Internal Android and Public Android workspaces, lockfile, build/typecheck/start commands, config/health/redacted errors and native version requirements are verified. | **NOT_RUN** |
| **US-001-QA14** | Optional Lab/Pharmacy/Nursing/OT ERP flags default OFF; malformed values never enable routes, menus, provider workers or fake clinical records. | **NOT_RUN** |
| **US-001-QA15** | Forgot Password request via stored contact choice returns neutral status for known/unknown accounts, enforces contact-change hold, cooldown and network/account throttles. | **NOT_RUN** |
| **US-001-QA16** | Reset Password confirms accepted single-use 10-minute OTP, wrong/expired/replayed/concurrent attempts, new salted hash, audit, version rotation and all-session revocation. | **NOT_RUN** |
| **US-001-QA17** | Signed-in Change Password verifies current password, enforces new password policy, rejects unchanged value, rotates credential under lock and revokes old sessions; Web/native UX. | **NOT_RUN** |
| **US-001-QA18** | Both supported OTP channels have accessible request/resend/confirm/recovery-failure UI; no provider sends or OTP verification are required for account creation or routine sign-in. | **NOT_RUN** |

**Story stage:** IN_PROGRESS — independent source-review findings and real test outputs must be recorded against the actual feature HEAD; no run or PASS claimed here.

## US-002 — Custom Roles & Permissions

**Scope:** Actual current role catalog, grouped capabilities, custom roles, revisions, copy/edit/retire and current permission effects.

**Implementation sequence:** backend + schema → typed API → applicable Admin Web/Internal Android/Public Android → independent source review → fix/re-review → QA source trace → local build/migration/real device/provider execution.

| Case | Required test and source trace | Live execution |
| --- | --- | --- |
| **US-002-QA01** | Authorized Super Admin creates a non-protected custom role using actual implemented grouped capabilities and readable labels; only permitted grants persist. | **NOT_RUN** |
| **US-002-QA02** | Internal Android can view/edit/copy allowed role with native Back/keyboard and revision-safe backend parity; copy grants, not assigned people or root privileges. | **NOT_RUN** |
| **US-002-QA03** | Anonymous, revoked/suspended or unpermitted actor cannot view, deep-link, create or mutate role and receives backend deny. | **NOT_RUN** |
| **US-002-QA04** | Protected role edit/retire/clone, unknown sensitive capability and normalized duplicate role are denied without partial changes. | **NOT_RUN** |
| **US-002-QA05** | Concurrent same-role edit uses expected revision; one wins, the other receives safe conflict and prior grants remain consistent. | **NOT_RUN** |
| **US-002-QA06** | Removing a permitted action invalidates affected sessions/access versions and denies cached Web/Android actions. | **NOT_RUN** |
| **US-002-QA07** | New module capability defaults deny; only delivered/assignable capabilities appear in roles editor or backend options. | **NOT_RUN** |
| **US-002-QA08** | Compare U05–U09 original CareGanga Roles UI, permission groups, search/tabs, counts, role chips, create/copy drawer and native semantic parity. | **NOT_RUN** |
| **US-002-QA09** | Multiple assignable actions persist in one current custom role; no phantom users or inherited protected actions. | **NOT_RUN** |
| **US-002-QA10** | Mandatory transaction audit failure rolls back role write, while optional telemetry failure never reverses committed grant or lies about status. | **NOT_RUN** |
| **US-002-QA11** | Access audit reader and bounded role/selector queries preserve realm restrictions, pagination, permission visibility and redaction. | **NOT_RUN** |

**Story stage:** IN_PROGRESS — independent source-review findings and real test outputs must be recorded against the actual feature HEAD; no run or PASS claimed here.

## US-003 — Admin User Creation, Directory & Assignment

**Scope:** Admin Create User, one current role assignment, directory, account state/access revocation and original U02–U04 Web/Internal Android UI.

**Implementation sequence:** backend + schema → typed API → applicable Admin Web/Internal Android/Public Android → independent source review → fix/re-review → QA source trace → local build/migration/real device/provider execution.

| Case | Required test and source trace | Live execution |
| --- | --- | --- |
| **US-003-QA01** | Authorized Admin uses U03–U04 right drawer to create ACTIVE staff with full name, unique mobile, optional email, initial password and eligible selected role; backend commits account/role/credential/audit. | **NOT_RUN** |
| **US-003-QA02** | Internal Android provides matching Add Staff Account and current role assignment/revocation; subsequent Admin Web shows same account state. | **NOT_RUN** |
| **US-003-QA03** | Account/role selector returns minimum permitted names to create-only operators; full directory and audit remain denied without their specific permissions. | **NOT_RUN** |
| **US-003-QA04** | Forged role/account, protected/root role, retired role, unrelated scope and non-Admin direct POST are denied; no user can choose their own role. | **NOT_RUN** |
| **US-003-QA05** | Duplicate mobile/email and repeated/concurrent Admin Create User requests use unique constraints and idempotency, without double accounts or side effects. | **NOT_RUN** |
| **US-003-QA06** | Suspension, deactivation, role switch/revoke and removed capability invalidate current access and hide old Web/native actions immediately. | **NOT_RUN** |
| **US-003-QA07** | Empty/no-results, long names, missing eligible roles, disabled button, timeout and uncertain committed write have accessible distinct UX without leaked backend errors. | **NOT_RUN** |
| **US-003-QA08** | No HR/branch/clinical owner records are invented when future selectors do not exist; independently delivered CG-01 account creation remains usable. | **NOT_RUN** |
| **US-003-QA09** | Compare actual U02 account list/search/tabs/status/table, U03–U04 Add Staff drawer/roles, U10 style and B34 assignment history with original screenshots and native adaptation. | **NOT_RUN** |
| **US-003-QA10** | Root create/account directory works without future modules; sensitive non-root custom role with `roles.manage` follows real CG-03 case approval rather than direct escalation. | **NOT_RUN** |
| **US-003-QA11** | Last protected root cannot be demoted/suspended/deactivated via role change; concurrent privileged edits preserve an active authorized root. | **NOT_RUN** |
| **US-003-QA12** | Creating a mobile-only account with no email works and can sign in; no notification, activation, delivery provider or extra verification is needed. | **NOT_RUN** |
| **US-003-QA13** | Account create/assign/status change generates one redacted access-audit event and idempotent status lookup; Web/native never display UUID/SQL/API stack traces. | **NOT_RUN** |
| **US-003-QA14** | Current custom role with multiple capabilities is assigned atomically; both capabilities enforced across backend/Web/Android; switching role removes previous rights. | **NOT_RUN** |

**Story stage:** IN_PROGRESS — independent source-review findings and real test outputs must be recorded against the actual feature HEAD; no run or PASS claimed here.

## US-004 — Session & Security Policy

**Scope:** Versioned session/attempt configuration, protected current-password policy writes, audit and full-channel enforcement.

**Implementation sequence:** backend + schema → typed API → applicable Admin Web/Internal Android/Public Android → independent source review → fix/re-review → QA source trace → local build/migration/real device/provider execution.

| Case | Required test and source trace | Live execution |
| --- | --- | --- |
| **US-004-QA01** | Protected Super Admin reads CG-01 session security defaults and saves a permitted versioned revision after current-password proof; durable revision/audit. | **NOT_RUN** |
| **US-004-QA02** | Other actor, revoked/suspended session, forged root, invalid password or direct unauthorized API/deep link cannot inspect/change protected policy. | **NOT_RUN** |
| **US-004-QA03** | Cannot disable required current-password reauthentication; unbounded max/idle duration, unsafe attempt limits, unknown keys or bypassed client validation are rejected. | **NOT_RUN** |
| **US-004-QA04** | Two protected actors editing same revision and a retry after lost response resolve through one committed revision, accurate history and replay result. | **NOT_RUN** |
| **US-004-QA05** | Shorter session max/idle limits apply to existing/new backend, Admin Web and Android sessions without needing client polling. | **NOT_RUN** |
| **US-004-QA06** | Account bootstrap/login, Forgot Password email/SMS OTP, Change Password, role editor and protected-root safeguards remain functional after policy updates. | **NOT_RUN** |
| **US-004-QA07** | Original CareGanga U02–U10/B34 visual integration, Admin Web policy read/edit/confirm/error and native Android touch/focus/Back/accessibility parity; no policy navigation for public users. | **NOT_RUN** |
| **US-004-QA08** | CRITICAL DB/idle NFR: one root realm and effective policy, unique revision/idempotency, append-only redacted audit, fail-closed stale session, bounded read and no idle scans. | **NOT_RUN** |

**Story stage:** IN_PROGRESS — independent source-review findings and real test outputs must be recorded against the actual feature HEAD; no run or PASS claimed here.

## Cross-owner regression and completion gate

The same credential/session/role contract must be used by CG-02 branch approvals, CG-03 independent role/branch decision review, CG-19 notices and private documents, and CG-21 operational settings/backup. Test a real current-password-protected action, incorrect password, revoked actor, stale version, same-actor approval denial, wrong scope, duplicate request, replay and database transaction isolation in each owner. Those modules retain their own canonical QA cases and current statuses.

**Local validation:** `npm ci`; backend/Web builds, both Expo Android TypeScript/native device builds; PostgreSQL 17 full migrate/repeat/backup/restore; root bootstrap double-run; configured email/SMS delivery; real permission bypass cases; UI fidelity with authentic `admin.careganga.com/login` screenshots and 167-screen U02–U10 audit; no idle workers or secret logs; qualified independent security/database review.

**Closure:** No Source Complete / QA PASS / client delivery / merge approval is asserted until current exact-hash designs and source plus all required review gates have been verified. No business-module parallelization based on unqualified authentication.

## Source-only verification evidence — current feature HEAD

- **US-001-QA08:** Admin password-only login currently renders `apps/web/src/app/(admin)/admin/login/page.tsx`; the former alternate-method divider has been removed. **SOURCE_INSPECTED, visual comparison NOT_RUN.**
- **US-003-QA03, US-003-QA06, US-003-QA09, US-003-QA14:** `apps/web/src/app/(admin)/admin/accounts/page.tsx`, `apps/web/src/app/(admin)/admin/page.tsx`, `apps/web/src/shared/foundation-admin-nav.tsx`, and all protected Admin route page props consistently allow an eligible `accounts.create` + `roles.assign` operator to reach the create-only account UI without granting `accounts.view`. Backend create remains separately authorization-checked. **SOURCE_INSPECTED; authorized and unauthorized browser/device/API regression NOT_RUN.**
- **US-003-QA01, US-003-QA04:** `dld.md` now specifies the implemented `accounts.create` action and `roles.assign` for direct ACTIVE-account creation. **SPEC/SOURCE CROSS-CHECK ONLY; actual PostgreSQL/HTTP tests NOT_RUN.**
- **Foundation regression:** The newer mainline consolidated test runner is not yet reconciled with this feature's credential model and cannot substantiate the canonical 165-case gate. The owning F0–F5 cases remain **NOT_RUN** until fresh actual evidence is traced into their existing tasks; never propagate synthetic `PASS` results.

## Mainline integration and source preflight — 16 November 2026

Feature merge `6d151b2a` includes current `main` without importing retired authenticator/activation flows. The obsolete staff-activation redirect is removed; the backend compiled entry path is now `dist/src/main.js`. Run `npm run verify:auth-source` from repository root after `npm ci`: the guard verifies existing CG-01 account/login/recovery source, permission-hidden create-only staff navigation, fixed CG-19 schema sections and **51 + 16 + 31 + 42 + 25** unique Foundation case IDs. **SOURCE_REVIEWED; static guard and all 51 CG-01 live QA cases NOT_RUN.** Do not infer runtime readiness or stage approval from case counts alone.

## 18 November 2026 — consolidated Foundation → Finance → CMS local QA execution index
The original QA cases above remain authoritative and unchanged. Execute the relevant owner cases in dependency order using [the consolidated local QA runbook](../../../../../docs/qa/CAREGANGA-FOUNDATION-FINANCE-CMS-LOCAL-QA-RUNBOOK-20261118.md) and `npm run verify:core-source` for static QA-ID/source assertions. This runbook adds **no new story, case ID or PASS**. Record positive, negative, editable error, unauthorized, concurrency, source revocation, database evidence and applicable Web/Android screenshot results in their original rows. **Runtime/Web/Android/DB/manual case execution: NOT_RUN in this source checkpoint.**
