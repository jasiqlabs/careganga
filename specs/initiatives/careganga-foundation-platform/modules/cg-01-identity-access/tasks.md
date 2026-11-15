# CG-01 — Developer-Ready Stories & Source QA

**Module:** [CG-01](module.md) · **PRD:** [FR-001–003, FR-080](../../prd.md) · **HLD:** [Architecture](../../hld.md) · **Required designs:** [UI/UX](uiux.md), [DLD](dld.md).  
**Delivery:** After one-time technical bootstrap, build one **real Foundation-root capability** at a time. No dependency on future CG-02/03/10/14. Business owner data, the same backend, Web and applicable native Android are included in each story; no layer-specific phase/backlog.  
**Planning status:** REBUILT / SOURCE_REVIEW_PENDING. Hash-bound owner-delegated Planning approvals and authenticated local Harness resolver NOT_RUN; **do not begin Development until the gate is actually satisfied**.

## Proposed task definitions — current revision NOT approved

The heading above identifies the **intended immutable definitions**; they are **not yet formally approved**. After final review + resolver, record the module SHA and definition-prefix SHA-256 in initiative approvals.json as a truthful `DELEGATED_APPROVED` (never fake human approval). No extra stories file or QA tracker.

### US-001 — Sign in, protect sessions and recover identity

Outcome: An authorized Foundation administrator can securely bootstrap the first protected account, sign in/out through Web and Internal Android, recover access, and see only the correct authenticated navigation. Approved public identity entry points do not accidentally acquire staff access.

Requirements: FR-001, FR-003, FR-080; CG-01-BR01, BR08–09; BR-001/002/017; N-01/N-05/N-09/N-13.

Scope: The **one-time technical bootstrap** in HLD §4.0/DLD §1A (one root npm workspace/lockfile, NestJS app+CG-01-only database migration history, Next.js Web route areas, separate public/internal Expo apps, approved design tokens and typed API-contract packages, validated config/health/errors/observability and real start scripts) plus real CG-01 account, credential/challenge, verified contact, session state and access-version storage; secure initial Super Admin provisioning/recovery with protected last-root logic; authenticated backend guard; bounded login/recovery provider adapter with genuine pending/failure handling. Public browsing stays public. No branch/employee/provider master, fake OTP or duplicate general messaging ledger.

Acceptance:
- A protected root account exists through a controlled first-setup path, not a hardcoded universal password. A real active account can sign in/out and recover securely with permitted channel behavior.
- Session expiration/suspension/revocation always blocks backend access; privileged admin sessions require verified MFA per HLD; no stale protected information is trusted in Web/Android.
- Invalid/duplicate/replayed credentials, unknown users, provider timeout and retry use safe, truthful outcomes without exposing the account directory or internal exception text.
- **Per-story source QA:**
  - **US-001-QA01:** Fresh controlled first-setup, authorized Foundation operator → provision root + sign in via responsive Web; backend creates one protected root/account/session with unique constraints, auditable setup and permitted context; UI never prints credential/DB ID.
  - **US-001-QA02:** Existing authorized account → sign in/out via Internal Android; native UI displays permitted navigation; backend validates and revokes session, old token cannot reuse; secure storage and navigation-state clearing are covered.
  - **US-001-QA03:** Wrong/unverified/unknown contact or brute-force-like retries through Web/Android → neutral actionable error, backend rate limit/no session, redacted logs and no existence hint.
  - **US-001-QA04:** Expired session, suspended user or copied revoked token requests protected account details → both clients clear protected state, backend denies, no DB changes or unauthorized data response.
  - **US-001-QA05:** Invite/recovery provider unavailable, challenge expired or confirmation response lost → UI says pending/unavailable (not success); backend challenge is expiring, one-use and retry/idempotent; no duplicate account/credential.
  - **US-001-QA06:** Anonymous visitor opens Public Web/Public Android and tries an Internal/Center deep link → genuine public content works, protected actions denied server-side; no fabricated center affiliation or public-to-staff permission.
  - **US-001-QA07:** Privileged admin signs in with missing/invalid/expired MFA challenge or provider interruption → access remains denied/pending, no privileged session or bypass, safe retry/error in Web/Internal Android and protected challenge records.
  - **US-001-QA08:** Given actual CG-01 identity and HLD §4.1A/CG-01 UIUX §2.1: compare bootstrap CareGanga Admin Web shell with original audit §2.1 (brand/sidebar blue-selected navigation, menu search, title/subtitle, global search/Ctrl+K hint, notification/inbox/View Site/help/account) and native Internal Android against its **semantic** token/status hierarchy (not a fictional Android screenshot). Startup has only implemented menu/search results and truthful unavailable future inbox; public channels show no Admin role shortcuts. Record source asset/token IDs, desktop/native adaptations, accessibility and safe loading/invalid/pending states. Exact image/motion parity stays VISUAL_NOT_RUN / MOTION_REFERENCE_UNVERIFIED until independent image/video and rendered comparison.

  - **US-001-QA09 — zero-job/worker and network budget:** With 0 pending CG-01 communications, idle Foundation contexts and multiple backend instances, inspect actual startup, expiry cleanup and client timers; no unconditional tenant-wide scans/provider sends or role/session polling may run. With one requested OTP, verify one bounded provider attempt, durable challenge status, finite permitted retry and separate DB query/request/egress measurement. Before actual run: NOT_MEASURED.
  - **US-001-QA10 — provider failure, safe error and diagnostic chain:** Persist an expiring real MFA/recovery challenge, simulate provider timeout after commit or unknown send result; human UI says pending/unavailable with safe next action, never 'code sent' or login succeeded. Trace one opaque request/support reference across client→auth API→challenge DB→provider; restricted structured logs contain no OTP, token, password, full contact value or raw provider stack. Telemetry outage must not change committed challenge status.
  - **US-001-QA11 — database/restore:** On disposable setup trace a single Foundation-root creation, verified unique account/challenge/session keys, indexed/session-expiry lookup, duplicate concurrent root bootstraps and authorized recovery. The losing bootstrap must not create second root. Migration/restore and backup authority remain NOT_RUN until independent QA.

  - **US-001-QA12 — bootstrap structure and forward-dependency review:** At an approved fresh checkout inspect actual `apps/backend`, `apps/web`, `apps/android-public`, `apps/android-internal`, `packages/api-contracts`, `packages/design-tokens`, root package workspaces/lockfile and defined start/migrate scripts versus DLD §1A. Inspect one backend Nest composition root with only CG-01 registered, real CG-01-only migrations, sanitized errors/health/logging and token-backed app shells. Ensure CG-01 has **zero** imports, FK migrations, required provider variables or dummy records from CG-02–21; future owners add sibling modules without breaking CG-01. Check no extra backend/database/auth/worker, zero-job startup polling, circular imports or duplicate UI palette. Code inspection SOURCE_VERIFIED is separate from actual start, DB migration, Android/device or visual evidence, which remains NOT_RUN.

Verification: Manually inspect each US-001-QA01–12 from exact UI event/request → typed auth route → session and rate-limit validation → transaction/index/secret protection → safe response → both client states. Record source file:function references per case after implementation. Review Android manifests/lockfile against maintained Expo SDK 58/target API 36 baseline and note device/AAB evidence NOT_RUN.

Dependencies: None

### US-002 — Create and manage roles and action permissions

Outcome: An authorized Foundation administrator can create, edit, copy, view and safely retire custom roles and their **actual implemented** permissions through responsive Web and native Internal Android; server-side authorization and audit reflect the result immediately.

Requirements: FR-002–003, FR-080; CG-01-BR02–04, BR07–08; BR-002/017; N-01/N-05/N-09/N-13.

Scope: Roles, grant catalog, role versions, access audit and effective action-grant policy; backend role CRUD/copy/protection, atomic mutation and session-grant revision; grouped human-language Web role editor and native Android role flows. Built-in protected roles and safe permitted grant copying. Future domains declare capabilities later, default-denied; **do not depend on CG-02/03/10/14** or grant access to their absent records.

Acceptance:
- Complete responsive Web **and** native Android role create/edit/copy/retire with name/description/optional visual color, grouped relevant action toggles, permission totals and real assigned-account counts.
- Role copy copies **only assignable grants**, never assigned accounts, root authority or scope. Starting empty is valid. Retire/revise conflicts and protected roles are handled explicitly.
- Backend rejects unknown keys, denied modifications, forged IDs, self-escalation, duplicate names, racing edits and stale tokens; auditable grant change and affected access version commit together.
- **Per-story source QA:**
  - **US-002-QA01:** Authorized Super Admin opens Web role editor, creates custom "Program Coordinator" with chosen real permissions; Web displays business labels; backend allows only supported keys, persists one role/grant set and audit; list/count reflect committed role.
  - **US-002-QA02:** Same authorized actor uses native Internal Android to edit role and copy its permitted grants into a new role; keyboard/Back/loading/save states are represented; backend matches Web data, copy includes no people/root/scope.
  - **US-002-QA03:** User lacking role permission opens Web URL/Android deep link or forges direct role mutation → no protected list/data leak, backend responds forbidden, zero grants/role/audit success committed.
  - **US-002-QA04:** Attempt to edit/retire protected role, assign protected capability, or create a normalized duplicate role → clear specific human-safe denial/duplicate state, DB protected/UNIQUE guards preserve authority and original values.
  - **US-002-QA05:** Two administrators edit same role revision concurrently → backend accepts one revision, reports actionable conflict for stale one, retains correct grants/audit and no partial overwrite.
  - **US-002-QA06:** Previously assigned account loses an action; its cached Web/Android menu/direct API call is stale → authoritative backend denies immediately, old confidential content clears and role history shows change.
  - **US-002-QA07:** Newly introduced future module capability is absent from current catalog, or later added → existing role receives no silent automatic grant; UI groups only real allowed actions, backend denies unknown/not-granted capability.
  - **US-002-QA08:** Given existing custom roles and allowed action catalog, authorized manager opens Foundation Admin Roles U05–U07 and U08–U09 Create/Copy drawer: compare observed KPI/search/tabs, protected-role badge, expandable permission groups, View/Add/Edit/Delete/Approve headings only for *implemented* actions, role color picker, copy vs empty, Cancel/Save hierarchy. Native Internal Android uses same branded readable permission groups, native form and Back/keyboard, not compressed desktop matrix. Role access check, real counts, conflict/human feedback and no invented future grants must match. Record relevant source component/token references; source review is not pixel/motion PASS.

  - **US-002-QA09 — single current role, combined actions:** Create one custom role containing multiple implemented actions and assign it to a real Foundation-root account. Both allowed actions work; on changing that account to another permitted role, prior grants disappear on the next API while historical assignment remains auditable. A second simultaneously active role for the same context is rejected by the DB unique constraint; fake branch/center scope and protected grants never escalate access.
  - **US-002-QA10 — audit versus diagnostics:** Force a role/grant update with a failed mandatory security-audit insert → entire privilege change must roll back, no success. Force a technical logging/metrics sink failure *after* successful atomic commit → correct grant remains saved and UI reports actual success, not an error causing duplicate retry. Correlation ID, redacted cause and safe message are checked.
  - **US-002-QA11 — data paths and query budget:** Inspect normalized role uniqueness, partial active assignment uniqueness, version conflict, bounded role/selector/audit pagination and queries/index choices on representative data. Privileged user cannot bypass object scope by guessing IDs, using export or selecting an unimplemented action. EXPLAIN and measured p95/egress remain NOT_RUN/NOT_MEASURED.

Verification: Source-trace every US-002-QA01–11 through Web/native form and permission matrix → role API, guards and validated catalog → atomic grant/version/audit mutation → effective server authorization and both clients. Inspect optimistic conflicts, protected root, role-copy and deny queries; document source evidence per case. Visual/devices/runtime NOT_RUN.

Dependencies: US-001

### US-003 — Invite accounts, assign roles and manage real access

Outcome: An authorized Foundation staff-access manager can invite a real CG-01 account, search permitted accounts/roles, assign/change/revoke non-protected roles at **Foundation-root**, and review history on Web and Internal Android—without waiting for geography, HR or healthcare modules.

Requirements: FR-001–003, FR-080; CG-01-BR01–02, BR05–08, BR10 (account/role/status fields currently owned by CG-01); BR-001/002/017; N-01/N-05/N-09/N-13.

Scope: Account directory with actual name/contact/account-status/role filters and paginated counts; secure invitation lifecycle and suspend/reactivate; Foundation-root assignment to a real account; restricted audit; **CG-01-owned** account and role minimum-field options for authorized workflows. Responsive Web + native Android account/assignment screens, safe stale-context invalidation. Employee/department/branch/center/clinical filters and selections belong to future owner integrations, **not this story**.

Acceptance:
- Select a real permitted account and role by human-readable name/context, never typing raw IDs; **no automatic first privileged role choice**. Custom non-protected role assignment and revocation work on both clients and backend without granting future branch/clinical access.
- A permitted selector shows only eligible minimal data without granting unrestricted account directory, salary, patient or financial visibility. Protected/root role assignments are blocked from ordinary staff actions.
- Duplicate invitations, assignment races, suspended accounts, unauthorized users, provider delivery pending and context revocation have truthful outcomes and atomic audit/cache updates.
- **Per-story source QA:**
  - **US-003-QA01:** Authorized Web manager invites a real named Foundation-root account and assigns an allowed custom role; UI displays names and explicit root context; backend validates account/grants, commits unique account/assignment/audit and shows actual invite-delivery state.
  - **US-003-QA02:** Authorized Internal Android manager searches same real account/role and changes/revokes assignment; native search/selection/confirmation is usable; backend revision and audit update, Web view reflects current access.
  - **US-003-QA03:** Create-only operator opens required account/role picker without broad directory rights → scoped minimal names/context only; direct full directory/audit/private detail/export remains denied.
  - **US-003-QA04:** Manager attempts forged account ID, retired/protected role or unrelated future branch/center resource → safe denial and no mutation; root assignment does not imply branch/center/medical access.
  - **US-003-QA05:** Duplicate invite/retry after lost response or two admins reassign account concurrently → one true account, consistent winning revision/active grant, accurate audit, actionable conflict/pending message.
  - **US-003-QA06:** Previously signed-in staff is suspended or loses role while Web/Android have cached search/navigation → subsequent API denied, client clears role options and sensitive data, other account's data never appears.
  - **US-003-QA07:** Empty role/account query, filtered no-result, provider failure, long names or API timeout → distinct accessible empty/loading/failed/pending UI; no raw error; bounded paginated DB query, no background polling loop.
  - **US-003-QA08:** User searches employment type, joining date, geography or center before those owners exist → CG-01 UI does **not** invent unusable filters/options; later CG-02/10/14 owners must add and source-verify the real integration with safe default-deny.
  - **US-003-QA09:** Given real accounts, permitted role options and one current Foundation-root context, compare U02 account KPI/search/filter/table, U03/U04 right-side Add Staff drawer/role picker, U10 area-level style (root only), B34 current-role assignment history and action layout with implemented Foundation Admin Web. On narrow Web retain searchable list/detail and full-width drawer; on Internal Android use Account→Details→Assign Role with native selection/confirmation, same semantic badges/typography/icons and accessible Back/keyboard. Employee, department, geography, probation and center filters appear only after CG-02/10/14 supply real owners. Review truthful invitation delivery, approved permissions and error states; source token review is separate from unexecuted pixel/motion QA.
  - **US-003-QA10 — future-module independence:** CG-01 must complete normal account invite, role creation, assignment, revocation and audit without any CG-02/03/10/14 records, tables, workers, fake selectors or uncompletable approval request. Sensitive protected-role assignment is correctly denied until the real CG-03 approval integration is delivered. CG-03 later creates its own genuine approval case against an existing CG-01 account/role and verifies one authorized grant effect; never mark this later integration as CG-01 complete.

  - **US-003-QA11 — single root, concurrent staff assignments:** Two authorized admins simultaneously attempt to remove/demote the last two active protected Super Admin accounts. A serially protected check must leave at least one active protected root; loser receives a safe conflict/denial, no stale session retains revoked capabilities. Repeated ordinary assignment with one idempotency key returns its original source status, not two grants.
  - **US-003-QA12 — invitation provider and no idle worker:** Invite a genuine account, lose provider reply after challenge commit, then restart the backend and explicitly resend while rate-limited. Show saved invitation with delivery-pending status and a safe next action, no extra account or unlimited OTP. With zero invite/MFA work on multiple app instances, observe zero repeated per-Foundation DB scans/provider calls; measure bytes and requests separately from database transaction count.
  - **US-003-QA13 — user message, audit and support reference:** Role assignment is rejected, stale or loses network response after commit: Web/Android render correct deny/conflict/status-check wording, preserve safe draft and never expose raw UUID/API/SQL/provider strings. Confirm one coherent access audit plus safe correlation reference to restricted diagnostic event with no passwords, OTPs, contacts or raw request body. Technical logging failure never turns committed role assignment into false failure.

Verification: Trace all US-003-QA01–13 through each applicable Web/Android action → identity/assignment/options API → backend scope/capability guard → unique/index/transaction/audit/revocation/provider path → filtered human-readable client result. Verify ordinary account search cannot disclose HR, finance or medical data. Record exact source references and unresolved gaps individually.

Dependencies: US-001, US-002

## Execution progress

- US-001: BLOCKED | Planning definitions rebuilt; **Development unauthorized** until final design/Harness approval. Source code NOT_STARTED, QA runtime NOT_RUN, visual NOT_RUN.
- US-002: BLOCKED | Depends on US-001; no future-module blockers. Source code NOT_STARTED, QA runtime NOT_RUN, visual NOT_RUN.
- US-003: BLOCKED | Depends on US-001/002; Foundation-root only. Future CG-02/03/10/14 integrations assigned to those owners. Source code NOT_STARTED, QA runtime NOT_RUN, visual NOT_RUN.