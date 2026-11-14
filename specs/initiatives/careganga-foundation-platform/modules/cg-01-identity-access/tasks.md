# CG-01 — Identity, Roles & Permissions: developer-ready user stories

**Initiative:** careganga-foundation-platform · **Module:** CG-01 · **Stage:** Planning · **Approval:** OWNER_DELEGATED_DESIGN policy applies; current module/task/design approval registry and pinned local resolver not yet finalized.
**Design baseline:** [Module](module.md) · [UI/UX](uiux.md) · [DLD](dld.md) · [Initiative PRD](../../prd.md) · [HLD](../../hld.md).
**Reference only:** `jasiqlabs/brick-ops@master` role creation/permission editing (Web and Android), staff-role+location assignments, backend capability catalog, scope and session invalidation. CareGanga's Foundation/healthcare/identity ownership, mobile/Web channel scope and HLD remain authoritative. No BrickOps manufacturing role is copied.

**Execution mode from latest JASIQ Harness:** One approved story at a time. Implement all applicable backend/DB, responsive Web, Android and shared contracts → manual expert review (backend/security/data, responsive Web/premium UX, native Android) → fix/re-review → trace **each case below** end-to-end through source → fix/retrace and update same tracker. **No live tests, application builds, browser/emulator/screenshots or images, CI/GitHub Actions.** `SOURCE_VERIFIED` is not an executed PASS; visual `VISUAL_NOT_RUN`, runtime `NOT_RUN`, metrics `NOT_MEASURED`. Design additions or scope changes return to Planning, not ad hoc developer guesses.

## Approved task definitions

**Approval status:** Design draft; owner-delegated Planning signoff and exact SHA-bound registry require the latest Harness preflight. Until then, these definitions are proposed and not an authorized Development start.

### US-001 — Secure account, verified sign-in, session and recovery foundation
Outcome: A legitimate Foundation/center/public user can establish, manage and end a secure authenticated session only for an authorized approved account relationship.
Requirements: FR-001, FR-003, FR-080; BR-001, BR-002, BR-017; CG-01-BR01,08–09; applicable security/privacy/audit/error NFRs.
Scope: One NestJS identity account/session owner and versioned PostgreSQL migration; permitted verified login/invitation/recovery provider integration; typed session/current-user/effective-context API; Foundation Admin, Center Portal, Public Website, Public Android and Internal Android session flows only where PRD allows. Do not create HR/member/patient profiles in CG-01 or expose raw technical errors. Implement current secure stable mobile dependency setup before Android features, using the approved verified source baseline and no unsupported library.
Acceptance: Account states and auth/session transitions are authoritative; revoked/expired account cannot reuse prior credentials; every channel has correct loading, verified, expired, denied and neutral-failure wording, with secure/correlated logging. No fake session on client. Public browsing remains available without internal login when allowed.
QA cases:
- US-001-QA01 — Authorized Foundation/center account with verified credentials signs in through relevant Web and Internal Android UI; UI shows permitted profile/context, API validates identity and active session, DB stores only secure session credentials and no duplicate account.
- US-001-QA02 — Invalid credentials, unverified contact or unknown user attempts sign-in/recovery across public/private channels; UI uses neutral non-enumerating message, backend rate limits and refuses session issuance; logs exclude password/OTP/token.
- US-001-QA03 — Suspended account, expired session or logout uses a previously captured credential; all relevant Web/Android routes show safe session-expired/denied state, backend rejects protected calls, session record is invalidated.
- US-001-QA04 — An invitation or verification provider times out after potential account creation; UI reports pending/unknown status, retry does not create duplicate account/invitation, database state and sanitized provider log remain truthful.
- US-001-QA05 — Public visitor navigates public website and public Android without internal role; only approved public pages/features work; internal staff menus and protected APIs are not accidentally exposed.
Verification: Manually trace each `US-001-QA##` from appropriate UI event → request/client state → NestJS auth/verification → account/session DB transaction → response and other client/cache; review credential hash/token redaction, duplicate/retry and revocation. Record per-case file:function evidence; actual auth/provider/device tests NOT_RUN.
Dependencies: None

### US-002 — Protected roles, capabilities, effective access and audited mutations
Outcome: A privileged administrator can define permitted business roles and the backend enforces exact action plus Foundation/center scope, including concurrent edits and session revocation.
Requirements: FR-001–003, FR-080; BR-001–002, BR-017; CG-01-BR02–08; shared privacy/concurrency/audit NFRs.
Scope: Versioned DB schema for roles, capability grants, role assignments and typed Foundation/center scope links; centrally curated permitted business capability catalog and human-label metadata; NestJS guards and owner-scoped query policy; create/edit/copy/retire role API; atomic audit, collision handling and affected session invalidation. Include safe selector-vs-private-view permission distinction. Never copy BrickOps role keys or use a global role-name authorization bypass; linked CG-02/CG-14 scope owners must be real before their final FK/selector integration is claimed complete.
Acceptance: Supported role keys only; root/builtin authority protected; copy grants without assigned people; action AND owner scope required on all protected routes; duplicate role and concurrent update return safe conflicts; grant revocation invalidates backend and client hints; logs record safe event IDs but never sensitive bodies.
QA cases:
- US-002-QA01 — Authorized Super Admin creates a scoped custom role and saves allowed grants; DB unique constraints, versioned catalog validation and audit commit once; role exists in Web/Android accessible management catalog.
- US-002-QA02 — Administrator copies a protected or custom role; only assignable grants are copied, no staff/scope/root privileges are copied; UI indicates review required for restricted grants.
- US-002-QA03 — Forged mutation, unsupported permission key, protected-root edit, cross-realm scope or unauthorized role manager is attempted; backend denies without writes, leakage or privilege escalation; UI receives safe wording.
- US-002-QA04 — Two requests create same normalized role or concurrently edit one role; DB enforces unique/version conflict and audit correctness; one winner, actionable conflict response, no silent overwrites.
- US-002-QA05 — Active user loses an assigned grant or is suspended while client navigation is cached; subsequent backend request is denied and stale permission/context caches are invalidated; no old protected UI data remains authoritative.
- US-002-QA06 — Authorized create-only workflow requests a safe selectable master while prohibited from viewing financial/clinical private details; selection capability permits minimal bounded names/context only, forbidden ledger/patient data remains denied.
Verification: Manually inspect every `US-002-QA##` through role API → catalog/guards → actual owner-scope DB query/transaction/audit/revoke → safe response → affected clients. Inspect lifecycle migration/constraints and retry/invalidation source. No live DB/contract tests.
Dependencies: US-001

### US-003 — Create, edit and copy roles with a premium responsive Web and Android UI
Outcome: An authorized Foundation administrator can complete the **full role management workflow from UI** in Web and Internal Android, without technical IDs or relying on a developer to configure permissions.
Requirements: FR-002, FR-003, FR-080; CG-01-BR02–04, BR07–08; BR-017; visual-quality/UI/accessibility NFRs.
Scope: Responsive Foundation Admin `People & Access → Roles & Permissions` and native Internal Android role directory/new/edit/copy screens; grouped capability controls, readable labels, totals and built-in protections; backend-authorized role state and shared safe error categories. Only delegated center-specific UI where actually approved. Reuse US-002 backend; do not invent parallel mobile permission storage or platform-only backend branches.
Acceptance: Create role, edit grants, copy allowed grants, list assigned-user counts and safely retire only unassigned permitted roles from each authorized channel; at narrow phone/tablet/desktop the source-level design remains navigable; screen-level empty, loading, failure, forbidden, duplicate, protected and success states are separately handled. Internal UUID/capability names never appear as UI copy; never automatically select an elevated role.
QA cases:
- US-003-QA01 — Authorized admin creates custom `Branch Coordinator` from Web role editor; chooses plain-language permissions; UI submits invisible capability keys to shared API, backend validates/audits and returns confirmed success.
- US-003-QA02 — Authorized admin performs same create/edit/copy workflow from Internal Android; grouped touch controls, Back/keyboard and error state are represented in source; API and DB truth match Web, not a WebView-only placeholder.
- US-003-QA03 — An unauthorized account opens role URL/deep link or tries edit/delete; no privileged fetch/action or protected data leaks in Web/Android; direct API also denies safely.
- US-003-QA04 — Built-in role is selected for copying, a custom role is edited, or an assigned role is retired; UI shows correct protected/assigned safeguards, server enforces them, affected sessions invalidate only after committed changes.
- US-003-QA05 — Duplicate role name, invalid entry, permission catalog load failure or loss of connectivity occurs; UI shows field-specific validation, real retry or pending/unknown status and no fabricated success/empty list; backend remains unchanged if write failed.
- US-003-QA06 — Narrow Web, desktop and compact Android have long role names, large permission groups and text scaling; source layout, navigation/focus, human labels and appropriate controls remain sensible. **Rendered appearance VISUAL_NOT_RUN**, no screenshot claim.
Verification: For each case trace Web and/or native UI component event → permission query and role API → US-002 guards/validation/transaction → safe UI message and other channel refresh. Source inspect responsive styles/tokens and native safe-area/accessibility, not rendered images. Record case evidence in progress.
Dependencies: US-002

### US-004 — Create staff access and assign/change roles with authorized Foundation/center scope
Outcome: An authorized admin can select a real staff member, assign an existing custom/built-in permitted role and choose actual authorized operating areas/branches/healthcare centers by **name**, from responsive Web and Internal Android.
Requirements: FR-001–003, FR-080; CG-01-BR01–02, BR05–08, BR10; BR-001/002/017.
Scope: Staff account invitation/activation/suspension and role+scope assignments in Web and Internal Android, optional center administrator only with explicit center-grant authority. Resolve CG-10 employee relationship by authorized link, CG-02 geography/branch and CG-14 center owners through their true interfaces. Do not create fake Foundation geography/center/HR records or give a Center role Foundation-wide rights. If dependent owner APIs/models are absent, implement internal interface/source scaffolding without claiming full integration; record external owner dependency as BLOCKED before SOURCE_COMPLETE.
Acceptance: Complete staff creation and assignment in both clients; role and permitted scope are separate selections, not arbitrary IDs; server verifies the assigned staff, role and owner scope and prevents self-escalation; forbidden dropdowns and private fields never load; role/scope change invalidates old session and updates both clients. No insecure first-role default or auto-assign to all centers.
QA cases:
- US-004-QA01 — Foundation authorized staff manager invites a real staff account and assigns a custom role plus valid CG-02 branch/geography from responsive Web; labels show names, API validates owner FKs, audit records correct assignment, employee record stays CG-10-owned.
- US-004-QA02 — Authorized Internal Android manager assigns or changes the same role and permitted area; native selector includes only active allowed names/context, backend change immediately governs both Android and Web.
- US-004-QA03 — Delegated center administrator assigns only an explicitly permitted center-staff role at their own active CG-14 location; cannot select another center or Foundation Super Admin and cannot derive access to patient records.
- US-004-QA04 — Forged branch/center UUID, inactive destination, unapproved pending assignment or removed location is sent directly to API; backend denies and leaves assignment/audit truthful, no cross-realm data leak.
- US-004-QA05 — Staff suspended/reassigned while signed in or multiple admins update same account; server atomically updates access/version/audit and invalidates relevant sessions; stale Web/Android selected context/options are cleared.
- US-004-QA06 — User list, scope picker or invitation delivery is empty, fails or is pending; show clear distinct states, retry without duplication, no raw API error/identifier; safe fallback if no valid authorized area exists.
Verification: Source-trace each `US-004-QA##` through staff-role Web/Android forms → permission-limited role/CG-02/CG-14 options → NestJS assignment transaction → owned FK/scope guard → audit/session revoke → each client. Mark dependent CG-02, CG-14, CG-10 and CG-03 integration NOT_VERIFIABLE/BLOCKED until actual owner code exists; no fake fixtures as completed source.
Dependencies: US-001, US-002, US-003

### US-005 — Human-friendly identity directory, safe option selection and cross-channel access consistency
Outcome: Staff and center administrators can search only their permitted people, roles and locations; any authorized downstream form gets the minimum necessary selection values without exposing sensitive records or extra privileges.
Requirements: FR-001–003, FR-080; CG-01-BR05–07, BR10; BR-017; shared logging/UX/privacy/pagination NFRs.
Scope: Scoped staff-directory search/filter/count/pagination; safe assignment/role/location options contracts, action discovery/effective-access hints; responsive Web and Internal Android directory/search and current-scope navigation, public account menu only; owner-specific downstream `options` integrations are defined by each owner module, **not** implemented as a duplicate central business-master endpoint.
Acceptance: Active/probationary/on-hold/new/joining-date and other approved filters reflect actual available CG-10 relationship statuses; selection privilege is narrower than detail/ledger/medical view; switching account, assigned branch or healthcare center clears stale Web/Android caches, and disabled actions do not trigger unauthorized background requests. Real empty, loading, forbidden, timeout and unknown state have nontechnical messaging. No perpetual idle polling.
QA cases:
- US-005-QA01 — Authorized manager opens staff list by role/branch/status and searches name; owner-scoped result/page/count matches actual permitted data, no HR/medical details beyond grants; Web/mobile context remains consistent.
- US-005-QA02 — A create-only operator with no broad directory/financial/clinical view opens an authorized form requiring role/branch/doctor/account selection; safe `options` returns only bounded permitted name/context, while full protected details and exports remain forbidden. Domain owners implement their own choices.
- US-005-QA03 — Unauthorized direct list/detail/export/permission-catalog query, guessed ID and cross-scope search receive safe denied/hidden responses without data/metadata leaks in Web/Android/network API.
- US-005-QA04 — Role revoked, user switched, assigned branch/center changed, or offline session resumed; client hints, menus, actions, selector caches and reports are scoped/invalidated, not stale across accounts/centers.
- US-005-QA05 — Slow API, empty search, revoked permission, long staff names, invalid search and backend failure; UI distinguishes states with accessible, human-friendly text; structured restricted logs preserve trace token and redact sensitive fields.
Verification: Trace `US-005-QA##` through Web/Android directory and selector source → real owner API scope/filters/pagination → database query → sanitized projection/response → state/cache invalidation; cross-owner selector consumers require their own subsequent module QA cases. No live tests or performance measurements.
Dependencies: US-001, US-002, US-003, US-004

## Execution progress
- US-001: READY | Planning draft; source implementation NOT_STARTED, executable QA NOT_RUN, visual QA VISUAL_NOT_RUN
- US-002: READY | Planning draft; source implementation NOT_STARTED, executable QA NOT_RUN, visual QA VISUAL_NOT_RUN
- US-003: READY | Planning draft; Web/Internal Android role UI required, source implementation NOT_STARTED
- US-004: READY | Planning draft; CG-02/CG-10/CG-14 owner integrations are external dependencies and cannot be called SOURCE_COMPLETE until real
- US-005: READY | Planning draft; cross-owner selector integrations must be verified by actual owner modules
