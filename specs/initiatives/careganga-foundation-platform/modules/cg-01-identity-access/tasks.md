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

## 18 November 2026 — formal source review finding trace (six owner gates)
The current code-based review and fix evidence is [the six-owner formal source review](../../../../../docs/qa/CAREGANGA-FOUNDATION-FINANCE-CMS-FORMAL-SOURCE-REVIEW-20261118.md). **Owner finding:** Authentication/session source sampled; no additional confirmed finding in reviewed paths. Review remains conditional. This is the same original QA matrix — no new user stories or QA IDs. Corrected source was re-read after commit; the static Finance scope check returned 28/28 current predicates, **not runtime tests**. Independent reviewer/security/DB/Harness final gate, current design SHA signoff, backend/Web/Android build, disposable PostgreSQL migration, original screenshot comparison and positive/negative/error/manual QA remain **NOT_RUN/BLOCKED**. **Module formal SOURCE_COMPLETE: NOT_APPROVED**, original runtime QA outcomes remain NOT_RUN; no merge to main.

## 20 November 2026 — CG-01 latest developer UI baseline adopted on active healthcare feature

**Feature-only source synchronization, not a mainline CG-01 release:** `main@c73b43a3` contains the 19 November web responsive tokens, user/role/permissions and security-policy screens, plus native authenticated header, bottom navigation and scoped role/security presentation. The active CG-14/CG-15 feature branch pulled these in as genuine two-parent merge `dcd1fe6959520afd16f18ce763d4691f553dced5` (53 source paths; two conflicts resolved by preserving CG-14/15 CSS and native actions). Current compare: main ancestor / feature 0 behind. The original client Admin shell, public CMS style and separate healthcare visual-reference obligations are not conflated.

**CG-01-owned presentation/navigation fix:** `apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx` uses mutually exclusive module open actions so switching from one module to another never leaves the prior one as the displayed route. It now wraps the 21 already-implemented protected business screen entry points with `AuthenticatedAppShell`, maintaining separately developed CG-01 roles and security-policy screens' own headers. `apps/android-internal/src/features/dashboard/authenticated-app-shell.tsx` highlights **More** when its authorized active route is in overflow. Existing backend permissions and identity/session handling were not broadened. Source checks: 21/21 wrappers, CG-01 routes not double-wrapped, one handlers memo, no conflict markers, latest responsive theme present.

**Required regression (all NOT_RUN):** actual `npm ci`, backend/Web/Internal/Public Android typecheck/build, emulator/device login/session/logout, open→switch→Back behavior, bottom-nav More/permissions, notification badge, screen reader, font-scale, narrow/landscape safe area and Web client screenshot overlay. Verify CG-02 branch, CG-03 approvals, CG-09 finance, CG-14/15 healthcare, CG-19 documents/communications and CG-21 authorized menu states independently. **Existing CG-01 original 51 QA outcomes are not changed; no runtime PASS or formal source signoff is claimed.** No merge back to `main` in this feature cycle.


## 20 November 2026 — CG-01 cross-module first-render Web navigation parity (feature source checkpoint)

**Implement → review → fix → source re-review:** Following CG-01 latest `main@c73b43a3` integration, the previously inconsistent first-render Foundation sidebar now receives the exact *server-verified current effective capability keys* already fetched by each owning route. Source commits `ba3fc6da7682a3980003ab8d4ae59af7532a0b06` (shared sidebar + dashboard) and `66b9d15ffd45efd937dd453f676f1893b82da00e` (31 existing admin route/shared-shell source files) preserve CG-01 existing browser permission revalidation and the original backend enforcement. No unrestricted menu items, new role names, shortcuts, hardcoded permissions or unapproved business actions were introduced.

**Trace/evidence:** `apps/web/src/shared/foundation-admin-nav.tsx` accepts optional `initialActions`, creates initial role-filtered navigation from those keys and still performs its existing no-store `/api/access/effective` recheck; a failed recheck continues to clear protected menu links. `apps/web/src/app/(admin)/admin/dashboard/page.tsx` and `admin/page.tsx` pass only already verified keys. Existing CG-01 accounts, roles, security, audit, approvals, notifications, CG-02 Foundation/branches, CG-09 finance subroutes, CG-18 website CMS and CG-14/15 healthcare routes pass their owning already-validated capability lists. `apps/web/src/shared/healthcare-admin-shell.tsx` passes its role-filtered `ReadonlySet<string>` into the same component; this also covers doctor schedule, content review, leave and optional capability review pages. The prepared 31-file tree was read back against the exact intended blob SHAs; direct readback confirmed shared shell, dashboard, admin account, CG-09 invoice and CG-15 protected patient route render sites. **Scope:** presentation of existing authorized links; no server/API/DB/permission change.

**Remaining quality gates:** Actual Next.js compilation, Web route-by-route hydration/no-flash screenshots, keyboard navigation and narrow-width overlays, CG-01 native drawer/Back and bottom navigation, role-change/revocation scenarios, screen-reader/device/manual permission tests and original client screenshot pixel/motion comparison **NOT_RUN**. Original CG-01 QA case count 51 remains unchanged, no case marked actual PASS, no runtime/independent reviewer/Harness approval and no merge of the healthcare feature into `main`.

### 20 November 2026 — Follow-up native shell specialist review and import-resolution audit

**Scope limited to existing original CG-01 UI and source QA cases, no new stories/cases.** After developer CG-01 `main@c73b43a3` integration, review of shared internal-native header, navigation drawer, More tab and roles presentation identified two real presentation defects: the native header's infinite glow loop was not stopped on unmount, and the notification badge was set from `communications.notifications.view` permission rather than a verified unread state. Feature-branch UI-only fix `faa98354d9bd39ea24a664232d5e266721361915` stops the animation on cleanup, hides unauthorized notification actions in the CG-01 roles/dashboard headers, and does **not** falsely display an unread indicator without source data. Existing authorized open-notifications action, business module screens and server RBAC remain unchanged.

**Additional source audit:** checked GitHub tree-based relative import resolution for **39 Web Admin route pages**, **91 non-identity Web business feature files** (CG-02, CG-03, CG-09, CG-14/15, CG-18, CG-19, CG-21/support), **28 non-identity Internal Android feature files** (appointments, approvals, Foundation, finance), and **15 Public Android files** = **173 selected source files**. Found one misresolved access-denied import in `apps/web/src/app/(admin)/admin/health-network/page.tsx`; fixed in feature commit `379881ea0bde7b941010187e3304be906abda962`. No further unresolved *relative file imports* in that **selected** source set. This is not a full TypeScript linker, npm build, dynamic import runtime test, user-role test, screenshot comparison or approval of remaining unscanned files. Web first-render effective-capability integration commits on this feature (`ba3fc6da`, `66b9d15f`) were preserved. All original CG-01 **51 executable QA cases still NOT_RUN** here; source review is not independent runtime/visual PASS. Feature branch is **not** approved for a `main` merge.


## 20 November 2026 — Independent CG-01 Irfan page-by-page look/feel audit (source only)

**Canonical source inventory:** [All 39 Admin/Center Web pages and 21 internal business Android entry points](../../../../../docs/qa/CAREGANGA-CG01-IRFAN-UIUX-PAGE-BY-PAGE-SOURCE-AUDIT-20261120.md). Reviewed latest actual MD IRFAN CG-01 `main@c73b43a3` Web roles/staff/security and Android header/drawer/bottom-nav against committed existing CG-02/03/09/14/15/18/19/21 screens. Source-side admin visual fix `ed874b14d5ccc8cdb2b1608aa83de815fd45ba70` defines missing finance/healthcare card/table styling, common responsive headings/focus in Admin scope only, and corrects duplicate top/bottom Android safe-area insets across 20 direct business screens. Original public website/Public Android must **not** adopt internal Admin design. Related native/CG-01 logic, RBAC and business stories remain unchanged.

**Gate:** Shell and common presentation **SOURCE_ALIGNED**, but many old per-module screens still need individual rendered CG-01 visual comparisons and possibly focused screen redesign for loading/filter/detail/action hierarchy. New manual `npm run verify:cg01-uiux-source` is a lexical source guard, not browser/device QA, not CI. Original 51 CG-01 cases, source approval, human review, Web build, Android visual/device/pixel and production acceptance status remain **unchanged / NOT_RUN**. No main merge.


## Supplemental 20-Nov-2026 client acceptance (no new story / QA count)

**Source:** [document examples](../../../../../docs/research/CAREGANGA-CLIENT-DOCUMENTS-REFERENCE-20261120.md) and [52 event templates](../../../../../docs/research/CAREGANGA-CLIENT-MASTER-EMAIL-V2-COVERAGE-20261120.md).

Existing CG-01 QA to reconcile client CG-EMP-007–009 with actual account flow: no plaintext password, verified recipient/expiry/single-use if setup link approved, correct effective role/geography, revoked access and replay safety. Do not claim source verified or disturb working current auth.

**Execution:** CLIENT_SOURCE_MAPPED; any missing source implementation is SOURCE_GAP/DEPENDENT_OWNER; actual runtime, migration, rendered PDF and delivery-provider QA NOT_RUN. Reuse existing story QA traces, not a second tracker.


### 21 November 2026 — Owner-approved Web ↔ Android same-capability contract

**Owner:** cg-01-identity-access. **Status:** MERGED_MAIN_OWNER_SOURCE_PARITY_AUDIT_OPEN. **Authority:** owner's existing BR/PRD/HLD and approved story IDs; root AGENTS.md current mandatory cross-channel rule. No new story, QA ID, role, table, endpoint or future dependency. The same authorized actor must be able to complete the same approved task on both applicable channels; maintain a single backend, record owner and permission/scope contract. This is owner-delegated **design-content approval only**, not a code, runtime, security, device or client acceptance.

**Channel mapping:** Foundation Admin/authorized operator Web **↔ Internal Android**: Foundation Admin accounts, roles, policy, login/session and operator access. Approved public/consented Web **↔ Public Android**, only when actually within this module's original audience: public sign-in, account recovery and identity-safe entry flows. Public Android must never receive a staff/clinical/finance action to fake parity; neither WebView nor an absent screen is equivalent native coverage. A genuinely channel-only item requires explicit owner-approved QA reason, not an inherited “no native screen” assumption.

**Original story QA reconciliation (no new scenarios):** For each existing story/QA ID trace `WEB_SOURCE`, `INTERNAL_ANDROID_SOURCE`, `PUBLIC_WEB_SOURCE`, `PUBLIC_ANDROID_SOURCE` to `SOURCE_TRACED`, `SOURCE_GAP`, or `NOT_APPLICABLE` with the specific actor/reason and exact UI/API source. For the implemented owner, Web/native source presence is not proof every allowed action matches; `ACTION_LEVEL_PARITY_REVIEW_OPEN`. Fix each confirmed gap in this owner source and re-review original stories before any `SOURCE_COMPLETE`. Runtime Next.js/Expo/backend/PostgreSQL/role/device/visual QA and independent expert acceptance remain `NOT_RUN` until real evidence; no automatic `main` merge or client release.


### 21 November 2026 — CG01 registered-mobile own-account Web/Internal Android parity source correction

**Existing CG01 identity/contact and CG19 communication preference QA only, no new story/endpoint.** The original Admin Web communications page permits a currently authenticated user to check their **own recorded** CG01 mobile-verification status, request an SMS code through CG01's Twilio Verify service and confirm that exact code. Internal Android's existing own-notifications screen previously only advised users to verify the account elsewhere. Added the same direct CG01 `GET /api/identity/mobile/status`, `POST /verify/start` and `POST /verify/confirm` to `apps/android-internal/src/features/communications/notifications-screen.tsx` (commit `c72366a`). It displays only masked own-account contact, accepts no recipient phone, does not invent an OTP, checks the original CG01 verified status before confirming success and shows provider-disabled/uncertain results truthfully. CG19 notices and opt-in preferences remain the existing owners. Added static source assertions to original `scripts/verify-greenfield-auth.mjs` (commit `dec5dc5`). **Static assertions authored, not executed;** CG01 mobile provider, Next/Expo, PostgreSQL, lost SMS, 90-second provider rate limit, current role/session and actual Android device QA **NOT_RUN**. Role/server authority and original 51 QA IDs unchanged; Web/Internal Android source parity for this *specific* action `CORRECTED_SOURCE_READBACK_OPEN`, entire CG01 module `SOURCE_COMPLETE=NOT_APPROVED` and no main merge.


## Execution progress

### 24 November 2026 — healthcare hardening cross-owner re-review
Re-review: CG01 effective UI actions suppress optional equipment and clinical actions using the same existing server flags as CG16 admission; grant catalog and backend authorization remain unchanged. CG14 reviewer action uses actual verify permission (manage only for reopening), matching original owner workflows. CG15 H07 schedule filter/roster/detail controls guard uncertain writes, stale and failed reads and selected association identity; existing metrics, weekly/leave/holiday/copy rules retained. Source regression required with ERP OFF/ON + readiness, verifier-only/manage-only grants, rapid filter changes, uncertain schedule save, original recheck and multi-center copy. No runtime pass. Original QA definitions unchanged, independent and runtime NOT_RUN. See [HUX tracker](../../HEALTHCARE_UIUX_HARDENING_TRACKER.md).

- owner-integration CG10/US-003-QA05/06/07/08/12/13/16/17/18: HrEmploymentAccessOwnerService.snapshot/apply in CG01 checks actual scoped eligible account and nonprotected ordinary target role revision, original immutable distinct protected CG03 decision, approved effective date, exact source version; applies role/session revocation/exit deactivation and original immutable CG01 effect receipt inside caller HR transaction. 2017 migration exact same-root receipt FK, no public action; CG10 caller/effect pending. Runtime/independent review NOT_RUN.


## CG-MB cross-branch/center QA overlay — 23 Nov 2026

**Scope:** ROOT + authorized CG-02 BRANCH; not a client-supplied active-branch token. **Bug references:** CG-MB-001, CG-MB-005, CG-MB-015. [Run-book (MB-T01–T22)](../../../../../docs/qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md) · [issue register](../../../../../docs/bugs/multibranch/README.md). **All original QA IDs, requirements and prior execution statuses remain unchanged.** The anchors below supplement existing cases, they are not new original QA IDs or evidence of PASS. The developer must run two real ACTIVE branches A/B, a third closed branch C and root-only record; never use fictitious staff grants or browser-selected UUID as permission.

| Original story and existing QA anchor | Concrete A/B+root acceptance step | Mandatory proof across applicable channels | Status |
| --- | --- | --- | --- |
| **US-001** (existing US-001-QA01) | Sign in manager A, manager B, Foundation Super Admin and non-manager staff; session must never imply B or Foundation permission merely from successful login; cancel stale A session after revoke. | Admin Web + applicable native Web/Android, typed API, source row/CG-01/02/14 guard, PostgreSQL FK/trigger, wrong-branch 403/404, two-worker replay, export/doc/notification | NOT_RUN |
| **US-002** (existing US-002-QA02) | Assign custom role finance/HR/stock action to non-manager and verify branch A/B grant is NOT automatically inferred; deny cross-branch and protected root actions; trace current CG-02 source. | Admin Web + applicable native Web/Android, typed API, source row/CG-01/02/14 guard, PostgreSQL FK/trigger, wrong-branch 403/404, two-worker replay, export/doc/notification | NOT_RUN |
| **US-003** (existing US-003-QA04) | Create/assign/revoke staff account, then attempt B staff directory, role selectors and direct API from manager A; prove account role grants, last-root and any approved specific branch assignment. | Admin Web + applicable native Web/Android, typed API, source row/CG-01/02/14 guard, PostgreSQL FK/trigger, wrong-branch 403/404, two-worker replay, export/doc/notification | NOT_RUN |
| **US-004** (existing US-004-QA02) | Change session/security policy, revoke or suspend staff while they view A/B; stale bearer/mobile saved session must not reopen protected finance, reports or branches. | Admin Web + applicable native Web/Android, typed API, source row/CG-01/02/14 guard, PostgreSQL FK/trigger, wrong-branch 403/404, two-worker replay, export/doc/notification | NOT_RUN |

**Cross-story negative/closure trace (NOT_RUN):** With manager A and B, an ordinary non-manager action-role holder, protected root, revoked user and separate actual center X/Y where relevant: check same-root A→B and foreign-root UUID bypass; branch deactivation/reassignment in middle of edit/export/upload; file/notice/worker visibility; history versus current authorization; Foundation-only NULL branch; no overbroad client filter; list/KPI/CSV/PDF report consistency; two-worker replay/rollback; original client screenshot UI and applicable Internal/Public Android parity. Record reviewer, exact commit, PostgreSQL migration/trigger/EXPLAIN and real API/device screenshots for **every original story**; separate SOURCE_REVIEWED from RUNTIME_PASS. For branch-assignment policy blocked by missing non-manager grants, mark BLOCKED CG-MB-001, not a false PASS. No merge into main.


### 23-Nov-2026 — CG-MB-001 delegated staff scope source candidate

**Bug/story linkage:** CG-MB-001 / original US-002-US-004. **Stage:** SOURCE_AUTHORED_REVIEW_PENDING, executable QA and independent reviewer NOT_RUN. **Source review and implementation:** CG-01 continues to own existing account_role, implemented action/capability, current session and access_version. No shadow role model added. CG-02 protected grant and end use SessionService.requireFreshFoundationRootProof and login-throttled check. A genuine staff scope change increments target access_version, requiring a new sign-in before any privileged action. Confirm original root, sensitive role approval and revoked-session negative scenario in existing QA IDs.

**JASIQ-dev QA trace:** root R, A/B different active managers, assigned A-only accountant/stockkeeper/HR staff, assigned A+B accountant, state/district coordinator, unassigned and revoked staff, closed C; test original action+CG01 capability→CG02 current branch→actual root+branch SQL→user-readable Web/Internal Android and safe CSV/PDF. Direct guessed cross-branch ID and Root-only Foundation action deny; source change/revoke invalidates sessions, queued CG20 needs live scope. Capture actual test command, before/after database snapshots, reviewer and result per existing US-NNN-QAxx; never claim execution from this source note. Existing QA IDs/approved requirements unchanged. No CI, no GH Actions, no main merge.


### 23-Nov-2026 — CG-MB-001/004 cross-owner source re-review checkpoint

**Original QA anchors:** CG-01 US-002/003/004. **State:** SOURCE_FIX_AUTHORED_REVIEW_PENDING (CG-MB-004 additionally remaining source owner gaps), **INDEPENDENT_REVIEW_NOT_RUN / RUNTIME_NOT_RUN**. No CG01 identity schema/role master was copied. CG02 grants depend on current CG01 current account+role and protected current-password verification; grant/end increments target account.access_version in same transaction. Source-only review: revoke/role suspend must block stale mobile/Web; AUTHORED_NOT_EXECUTED, independent reviewer pending.

**Next finite gate:** re-open actual changed source in the original owner, review access privileges, BWC is not needed, prove same-root composite DB FK+migration, A/B account roles+area ancestor and manager transfer, closed C, stale sessions and read/option/write/export/file/worker, clear safe Web/Internal Android errors. Run source contracts and disposable PostgreSQL migrations in separately authorized local final QA, trace original QA IDs; record reviewer/commit/evidence. Do not merge main or fabricate SOURCE_COMPLETE.



### 23-Nov-2026 — hierarchy QA for CG-01-BR05, receiving CG-MB-001

**Original US-002/US-003 QA extensions, NOT_RUN:** A role name or position (General Manager, State Manager, District Manager, Branch Manager, Cashier, Accountant) is NEVER an authorization grant alone. Current CG-01 action + CG-02 `ALL_BRANCHES`, `AREA` or explicit `BRANCH` scope required. Test protected Foundation Admin all A/B/C+Foundation; non-protected organization manager all current and future ACTIVE branches A/B/C but NOT Foundation-null legal/money; district manager only descendants; A+B manager union of A+B; A-only manager A only; A-only cashier only finance actions granted in CG-01; revoked/suspended staff zero active actions. Protected/public patient/community accounts cannot be targets of staff branch grants. Source tests authored and static checks, PostgreSQL/role matrix/Web/Internal Android QA NOT_RUN. Keep original QA IDs unchanged; per test record permission and exact actor/branch/root scope with positive and negative direct API and native UI screenshot.


### 24 November — Healthcare online confirmation safe-error owner repair
- HUX-15.01 / CG17-US-004-QA01/08/09 receiving scope: the two newly thrown online confirmation codes were absent from the original CG01 `SAFE_MESSAGE_CATALOG`; added actionable copy for unavailable/changed source. Existing SafeErrorsFilter 4xx allowlist and generic redacted 5xx fallback unchanged. Source commit 312908e45706e8ddd8394468d822ca034835de54; original QA definitions unchanged. `INDEPENDENT_REVIEW_UNAVAILABLE`; runtime NOT_RUN. Next: include renderer in the existing healthcare safe-error source gate and run local preflight.

### 24 November — greenfield first-install/restart deployment source candidate
- Existing CG01 US-001-QA02/QA12: baseline.mjs generate/init/upgrade, schema-readiness.ts, health.controller.ts and main.ts replace partial readiness with full release-ledger read-only checks; root provisioning remains one-time with its original protected transaction. No change to approved QA definitions or original account/role constraints. E2E-001/002 CMS first-publication remains separate, non-overwriting. Base 37c2b8920cc3532c6db971420eb5dbde85142299; generated SQL/manifest MISSING, PostgreSQL build/restore, repeated/concurrent setup, runtime user DDL denial and restart acceptance NOT_RUN. Source candidate; independent review unavailable, resolver NOT_RUN. Next: follow Hostinger deployment guide, generate verified artifact on disposable DBs and run original QA02/QA12. No SOURCE_COMPLETE claim or production write.

- Follow-up source review 9b115667: init CLI forwarding fixed; release contract build check, no-op current upgrade, ordered prefix verification and compiled protected root provisioning; five guard tests authored, NOT_RUN. CG01 US-001-QA02/QA12 remains pending actual database/restore and independent review, no business schema change.

- Parent reconciliation 082dd00c2923c956e846f3ac6b25ff7095a3a2bd: single native-pg release path with strict direct connection guard, zero-account scratch check and empty-object validation. Original QA02/QA12 unchanged, execution and independent review pending.

### 24 November — actual PostgreSQL 17 replay and consolidated baseline candidate
- Isolated Neon QA: careganga-greenfield-db-qa / careganga_baseline_source and careganga_baseline_verify; PostgreSQL 17.12. All 311 historical ledger entries committed; 3702/3704/3705 syntax/argument-limit defects fixed and retried successfully at reviewed HEAD 6bfb3fbff7b145ca0cbba888068cd6087c030b1e. 0 accounts; no operational rows. 0 invalid indexes, 0 unvalidated constraints. Original CG11 US-001/US-002 and CG03 review/CG01 US-001 QA02/QA12 acceptance definitions unchanged.
- DB-06: single catalog-derived schema.sql (2,161,863 bytes, SHA256 09ff3722aef357748231fa63c2c6560d55db6d62e5726b325352dbe255297dd1) and genuine 311-entry manifest added; native pg_dump unavailable, Neon diff refused large schema. Actual second-empty-DB replay in bounded SQL transactions, not the production one-command atomic restore. Compared SHA-256 of 12 catalog categories in source and restore: all match after 353 UUID default expressions explicitly bound to pg_catalog.gen_random_uuid; canonical pretty constraint deparse normalizes redundant associative AND parentheses. 477 tables, 5660 table/view columns, 5229 constraints, 1883 indexes, 429 non-extension application functions, 590 application triggers, 6 views, 31 sequences, 1 sequence owner, 18 comments, 3 extensions, 311 ledger rows. Evidence: apps/backend/db/baseline/catalog-verification.json. Provider-specific physical attributes, ownership and ACL are excluded; runtime role setup, exact artifact single-transaction init/upgrade/start/restart, backup/restore, CMS and all original business scenarios remain pending local QA. No production writes, no protected branch merge. Independent review unavailable, not SOURCE_COMPLETE until gate satisfied.

- DB-07/08: archived SQL remains in the historical path for existing immutable QA/source references only; new active folder db/upgrades contains zero SQL. Build verifies frozen source ledger against manifest and generates compiled readiness contract. Runtime init/upgrade/check read only baseline + upgrades + compiled contract; historical SQL not required or executed by release tooling. New upgrades run under the same locked connection and atomic transaction, reject transaction-control/psql statements, no-op on current history, new installs apply any future upgrade after baseline in the same transaction. Existing old-prefix init instructs explicit upgrade. Artifact was read back from Git blob a97eb8a60f363eb7e0fce203438d9222e3bb767a and executed whole inside one PostgreSQL transaction using connector DO EXECUTE on third empty careganga_baseline_atomic; all 12 fingerprints matched and zero non-ledger populated tables. Evidence catalog-atomic-verification.json. Exact Node CLI/build/role and restart/upgrade business QA still pending, independent reviewer unavailable. Original CG01 QA02/QA12/E2E-001/002 unchanged.

- DB-08 package self-review: db:release:check now verifies exact SQL/manifest/compiled release contract and compiled server/root entries; added local temporary-fixture test for archive tamper, stale future upgrade contract, prebuilt release with no archive and corrupt schema. Guard tests 7/7 previously executed on Node v22.16.0, exact Git blobs 53e624f2653935b9f17052ec2ab94574573da399 / bf886888d8551acef06964e3e5bca6c43829e757; expanded eighth test pending execution on final exact blobs. Actual single-file SQL atomic restore evidence already PASS on PostgreSQL 17, no full Node-DB/Hostinger runtime or independent clearance. QA02/QA12 original acceptance unchanged.

### 24 November — database source handoff checkpoint
- DB-06 through DB-10 source deliverables implemented: exact consolidated schema/manifest and atomic catalog proof, frozen archive separated from zero-file active upgrades, package/build checks and test handoff. Actual committed file whole-transaction restore successful, all 12 fingerprints equal; independent SQL rollback probe SQLSTATE 22012 left no probe and 477 tables/311 ledger unchanged. Eight focused Node 22.16.0 tests PASS, source/test blobs 73d3fd1226f84a6cd0ffb9484517f88ca4f78e80 and 0f8caf79ccd346792fffb1e2f3eb4a2ebffac13f verified against GitHub. 32 selected source hashes rechecked against ledger, 0 mismatches; full checkout build rechecks all 311. See docs/qa/CAREGANGA-GREENFIELD-DB-DEVELOPER-HANDOFF-20261124.md. Original CG01 US-001-QA02/QA12, CG03 and CG11 acceptance remain unchanged. INDEPENDENT_REVIEW_UNAVAILABLE; full Node CLI/role/restart/upgrade, full app build and original runtime QA NOT_RUN; do not promote to production approval or SOURCE_COMPLETE without independent clearance. Developer test handoff authorized, no production writes or merge. Archive path retained for old source QA; omit from prebuilt artifact. Existing parent branch not modified.
