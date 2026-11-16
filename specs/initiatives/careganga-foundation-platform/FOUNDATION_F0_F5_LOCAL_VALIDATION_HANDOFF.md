# CareGanga — Foundation F0–F5 Consolidated Local Build & QA Handoff

**Repo:** `jasiqlabs/careganga` · **Candidate:** `feature/cg01-simple-auth-brickops-style-20261116` · **Baseline:** five Foundation owner modules already source-integrated into `main` (CG-01, CG-21, CG-03, CG-19, CG-02). **Qualification scope:** all 14 stories, **165 original QA cases** — CG-01 51, CG-21 16, CG-03 31, CG-19 42, CG-02 25. **Status:** feature-branch design/source changes not yet independently qualified or merged; consolidated live QA **NOT_RUN**. This handoff applies to the actual greenfield authentication design and all integrated Foundation business flows. No CI/GitHub Actions, no production run, no false PASS.

## 1. Required foundation identity and roles

1. Operator executes one protected `--confirm-one-time-root` script with explicit `DATABASE_MIGRATION_URL` and secret-provided `CAREGANGA_ROOT_NAME`, `CAREGANGA_ROOT_MOBILE`, optional `CAREGANGA_ROOT_EMAIL`, `CAREGANGA_ROOT_PASSWORD`. One Super Admin is created; repeat/concurrent bootstrap is refused and no secrets are emitted.
2. An authorized Admin creates each ACTIVE user directly with **full name, unique mobile username, password, optional email and permitted role** in original Admin U03–U04 Create Staff Account. No public account registration or additional activation step.
3. Every active user signs in with **mobile number or email + password**. Session limits, logout, permission-hidden pages and backend resource-scope denial apply across Web, Internal Android and relevant authenticated Public Android.
4. **Forgot Password:** six-digit OTP delivered by real configured SMTP email **or** SMS provider to the stored contact only; max ten-minute single-use challenge, cooldown/attempt limits, neutral unknown-account result, truthful provider state and credential/session revocation. **Change Password:** signed-in current/new password and session revocation.
5. Protect Super Admin security-policy updates, CG-03 role/branch review, CG-21 backup/setting requests, CG-19 confidential notices/letters and CG-02 branch finalization with actual current-password confirmation **plus** current role/scope, version and distinct-reviewer checks.

## 2. Local worktree, toolchain and database

1. Fetch and inspect current `main` and candidate branch; verify no unreviewed conflicts or lost Foundation commits. Work on a dedicated developer verification/fix branch based on the candidate when fixing, not directly on `main`. Read [AGENTS.md](../../../AGENTS.md), current [PRD](prd.md), [HLD](hld.md), all actual module docs/DLD/UIUX/tasks, and the original [Admin UI audit](../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) plus the separately supplied real login screenshot.
2. Using Node >=22.13 and the tracked lockfile, run `npm ci`; `npm run build -w apps/backend`; `npm run build -w apps/web`; `npx tsc --noEmit -p apps/android-internal/tsconfig.json`; `npx tsc --noEmit -p apps/android-public/tsconfig.json`. Run `npx expo install --check` from each Android app and build/bundle testable binaries; follow compatible current Android store SDK guidance from AGENTS.
3. On a new disposable PostgreSQL 17 database, run the **single clean migration history** with `DATABASE_MIGRATION_URL`. Confirm full fresh-schema migrations, second idempotent run, test backup and restore, row ownership, indexes, unique mobile/optional email and all protected F0–F5 owners. Do not test against client data and do not treat an old migration from an undelivered system as production data.
4. Run root bootstrap twice and concurrently as a negative test. Then create different authorized accounts: applicant, independent protected reviewer, one ordinary staff user and a branch manager. Confirm failed escalation, duplicate create, session-revocation and scoped selector/read/write denial.
5. Configure real sandbox SMTP/SMS senders if available. Check each accepted, throttled, timed-out, refused and unknown-outcome path, OTP reuse/expiry/concurrent confirmation, hold after contact change and password version revocation. Mark delivery verification **BLOCKED/NOT_RUN** rather than PASS without a real configured provider.
6. Verify S3 or Firebase private object storage, protected files, scanner, outbound original notice transport and truthful not-configured status. Never make optional integrations a prerequisite to CG-01-only login, but keep protected business effects fail-closed.

## 3. Story-by-story QA — all five owners

| Owner | Canonical case count | Required end-to-end verification |
| --- | ---: | --- |
| **CG-01** | **51** | Script root once; direct ACTIVE Admin users; user/role/status/permission flows; mobile/email + password; email OR SMS reset OTP; signed-in change; versioned policy; original U02–U10 login/drawer screens; Public and Internal Android. |
| **CG-21** | **16** | Effective versioned settings, provider reference and truthful actual readiness; protected password-confirmed root writes, bounded original-audit projection, backup request/status with separately validated proof. |
| **CG-03** | **31** | Real frozen CG-01 protected-role proposal; pinned process/reviewer steps; distinct authorized reviewer with current-password confirmation; stale version/replay/deny and one guarded owner finalization; CG-02 branch decision adapter. |
| **CG-19** | **42** | Genuine protected media/documents, scanner, S3/Firebase, role-based recipient notices and email/SMS transports, private letters with current-password confirmation, public contact/support and bounded outbox jobs. |
| **CG-02** | **25** | Foundation identity/geography/departments and committees; seven-stage branch draft/resume/submission/Web-Android; protected distinct CG-03 approval; frozen CG-19 evidence; exactly one active branch/code; concurrency and hierarchy changes. |

## 4. Specific integration and adversarial tests

- **Security:** direct API navigation/permission bypass, root escalation, self-approval, revoked reviewer, stale source, OTP misuse, session token replay, sensitive contact/document leaks, cross-realm/cross-branch access, CSRF and secret/error redaction.
- **Database:** migration sequence, FK/unique/CHECK and revision integrity; simultaneous Admin Create User/bootstrap/OTP confirm, two reviewers, branch duplicate activation, lost-postcommit response and idempotent status resolution. Check no duplicate user, role, audit effect, branch, file or payment side effect.
- **UI/UX:** original Admin U02–U10/B34 and U18–U22, actual owner-supplied `admin.careganga.com/login` images; responsive Web; two native Android apps with true permitted menus, Back/keyboard, accessibility, correct empty/error/loading states, no fake records or exposed internal IDs. Native adaptations are not asserted pixel-equal to Web.
- **NFR:** healthy startup, bounded queries, no idle polling/provider sends for zero work, rate limits, safe network errors, transaction locks, observable redacted traces, and consistent user-facing statuses.

## 5. Evidence and closure

Trace each of the 165 cases to **actual** feature-HEAD source path/function plus real test input, expected/observed result and any sanitized PostgreSQL, HTTP, Web, device or provider evidence in the **owning module's existing `tasks.md`**. Do not create a second QA tracker. Follow **Implement → independent security/database/source/UI review → Fix → re-review → individual QA trace**. A source trace is not a live run.

**Candidate merge gate:** current source design/hashes reviewed; no outstanding compile/schema/source-critical defects; current Foundation interfaces and case evidence reconciled; independent specialist review recorded. Keep `main` untouched until authorized. **Runtime/deployment gate:** successful real builds, clean migrations/restore, role/OTP/branch flows, Android device tests, screenshot comparisons and configured-provider validation. Report unrun cases as NOT_RUN; no production or release PASS without evidence.

## 6. Integration integrity and honest QA evidence — 16 November 2026

The current `main` branch contains an additional consolidated Foundation QA script and a credential-code helper not present in this feature branch. Their inputs and scenario claims do **not** match the canonical greenfield CG-01 contract. The inherited runner must **not** be executed, copied, merged unchanged, or used to claim a pass: it contains scenario success recorded without observed execution. Rebuild a single case-identified runner from the 165 owner-owned cases, verify each real action and SQL/device/provider result, and mark absent evidence `NOT_RUN`. Remove the superseded helper during explicit mainline integration. Preserve unrelated newer mainline migration and Foundation fixes after independent comparison; do not overwrite main blindly.

**Feature-head source corrections:** The account creation permission is `accounts.create` together with `roles.assign`. The protected Admin `Users Management` navigation must be visible to an authorized create-only operator, even when full account-directory read permission is absent; both initial server rendering and live effective-access refresh enforce that rule. The login card presents only mobile/email + password with no alternate sign-in divider. These are source amendments, **not** executed visual/security/runtime QA. Review these changes with the exact feature commit before approval or merge.
