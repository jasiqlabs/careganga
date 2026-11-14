# CG-01 — Developer-Ready Stories & Source QA

**Module:** [CG-01](module.md) · **PRD:** [FR-001–003, FR-080](../../prd.md) · **HLD:** [Architecture](../../hld.md) · **Required designs:** [UI/UX](uiux.md), [DLD](dld.md).  
**Delivery:** After one-time technical bootstrap, build one **real Foundation-root capability** at a time. No dependency on future CG-02/03/10/14. Business owner data, the same backend, Web and applicable native Android are included in each story; no layer-specific phase/backlog.  
**Planning status:** REBUILT / SOURCE_REVIEW_PENDING. Hash-bound owner-delegated Planning approvals and authenticated local Harness resolver NOT_RUN; **do not begin Development until the gate is actually satisfied**.

## Approved task definitions

The heading above identifies the **intended immutable definitions**; they are **not yet formally approved**. After final review + resolver, record the module SHA and definition-prefix SHA-256 in initiative approvals.json as a truthful `DELEGATED_APPROVED` (never fake human approval). No extra stories file or QA tracker.

### US-001 — Sign in, protect sessions and recover identity

Outcome: An authorized Foundation administrator can securely bootstrap the first protected account, sign in/out through Web and Internal Android, recover access, and see only the correct authenticated navigation. Approved public identity entry points do not accidentally acquire staff access.

Requirements: FR-001, FR-003, FR-080; CG-01-BR01, BR08–09; BR-001/002/017; N-01/N-05/N-09.

Scope: The **one-time technical bootstrap** (single backend/PostgreSQL migrations, responsive Web/Public/Center shells and distinct Public/Internal Android shells) plus real CG-01 account, credential/challenge, verified contact, session state and access-version storage; secure initial Super Admin provisioning/recovery with protected last-root logic; authenticated backend guard; bounded login/recovery provider adapter with genuine pending/failure handling. Public browsing stays public. No branch/employee/provider master, fake OTP or duplicate general messaging ledger.

Acceptance:
- A protected root account exists through a controlled first-setup path, not a hardcoded universal password. A real active account can sign in/out and recover securely with permitted channel behavior.
- Session expiration/suspension/revocation always blocks backend access; no stale protected information is trusted in Web/Android.
- Invalid/duplicate/replayed credentials, unknown users, provider timeout and retry use safe, truthful outcomes without exposing the account directory or internal exception text.
- **Per-story source QA:**
  - **US-001-QA01:** Fresh controlled first-setup, authorized Foundation operator → provision root + sign in via responsive Web; backend creates one protected root/account/session with unique constraints, auditable setup and permitted context; UI never prints credential/DB ID.
  - **US-001-QA02:** Existing authorized account → sign in/out via Internal Android; native UI displays permitted navigation; backend validates and revokes session, old token cannot reuse; secure storage and navigation-state clearing are covered.
  - **US-001-QA03:** Wrong/unverified/unknown contact or brute-force-like retries through Web/Android → neutral actionable error, backend rate limit/no session, redacted logs and no existence hint.
  - **US-001-QA04:** Expired session, suspended user or copied revoked token requests protected account details → both clients clear protected state, backend denies, no DB changes or unauthorized data response.
  - **US-001-QA05:** Invite/recovery provider unavailable, challenge expired or confirmation response lost → UI says pending/unavailable (not success); backend challenge is expiring, one-use and retry/idempotent; no duplicate account/credential.
  - **US-001-QA06:** Anonymous visitor opens Public Web/Public Android and tries an Internal/Center deep link → genuine public content works, protected actions denied server-side; no fabricated center affiliation or public-to-staff permission.

Verification: Manually inspect each US-001-QA01–06 from exact UI event/request → typed auth route → session and rate-limit validation → transaction/index/secret protection → safe response → both client states. Record source file:function references per case after implementation. Review Android manifests/lockfile against maintained Expo SDK 58/target API 36 baseline and note device/AAB evidence NOT_RUN.

Dependencies: None

### US-002 — Create and manage roles and action permissions

Outcome: An authorized Foundation administrator can create, edit, copy, view and safely retire custom roles and their **actual implemented** permissions through responsive Web and native Internal Android; server-side authorization and audit reflect the result immediately.

Requirements: FR-002–003, FR-080; CG-01-BR02–04, BR07–08; BR-002/017; N-01/N-05/N-09.

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

Verification: Source-trace every US-002-QA01–07 through Web/native form and permission matrix → role API, guards and validated catalog → atomic grant/version/audit mutation → effective server authorization and both clients. Inspect optimistic conflicts, protected root, role-copy and deny queries; document source evidence per case. Visual/devices/runtime NOT_RUN.

Dependencies: US-001

### US-003 — Invite accounts, assign roles and manage real access

Outcome: An authorized Foundation staff-access manager can invite a real CG-01 account, search permitted accounts/roles, assign/change/revoke non-protected roles at **Foundation-root**, and review history on Web and Internal Android—without waiting for geography, HR or healthcare modules.

Requirements: FR-001–003, FR-080; CG-01-BR01–02, BR05–08, BR10 (account/role/status fields currently owned by CG-01); BR-001/002/017; N-01/N-05/N-09.

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

Verification: Trace all US-003-QA01–08 through each applicable Web/Android action → identity/assignment/options API → backend scope/capability guard → unique/index/transaction/audit/revocation/provider path → filtered human-readable client result. Verify ordinary account search cannot disclose HR, finance or medical data. Record exact source references and unresolved gaps individually.

Dependencies: US-001, US-002

## Execution progress

- US-001: READY | Planning definitions rebuilt; **Development unauthorized** until final design/Harness approval. Source code NOT_STARTED, QA runtime NOT_RUN, visual NOT_RUN.
- US-002: READY | Depends on US-001; no future-module blockers. Source code NOT_STARTED, QA runtime NOT_RUN, visual NOT_RUN.
- US-003: READY | Depends on US-001/002; Foundation-root only. Future CG-02/03/10/14 integrations assigned to those owners. Source code NOT_STARTED, QA runtime NOT_RUN, visual NOT_RUN.