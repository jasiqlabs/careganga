# CG-01 — Identity, Roles, Permissions and Scoped Access: Detailed-Level Design

**Planning:** REQUIRED DLD · GREENFIELD · source-design review (no implementation/runtime evidence)  
**Requirements:** FR-001–003, FR-080; BR-001, BR-002, BR-004, BR-017; CG-01-BR01–10; applicable CG-NFR security, UX, mobile, logging and concurrency.  
**Authority:** Product HLD §§4–9, CG-01 module.md/uiux.md, approved Foundation/Healthcare owner boundaries and JASIQ Harness at commit `3713f13f2ea658a0cc42f8fbf98b4cc5b5b990fd`.  
**Reference, not a dependency:** Verified `jasiqlabs/brick-ops@master` RBAC implementation (role catalog, backend scope, Web `staff/roles`, Staff assignment and Android `StaffRolesScreen`/`StaffFormScreen`). Use concepts, not its tenant/plant/cashier entities, Express classes, styling or unresolved error handling.

## 1. Business boundaries and design choices

- One shared **NestJS Identity/Access module** with PostgreSQL as the authoritative source. Frontends use server-supplied effective capabilities only as **display/navigation hints**; backend authorization is final for **every** API, selector, list, detail, export, PDF, download and write.
- Separate **identity** (CG-01 account/session), **relationship** (CG-04 member/volunteer, CG-10 employee, CG-15 patient, CG-14 provider staff), **capability** (role and allowed action), and **scope** (Foundation hierarchy CG-02, healthcare center CG-14). A matched phone does not link confidential domains.
- The role creator/editor, permission checker, role copier and staff-role/location assignment must be usable from **Foundation Admin responsive Web and authorized Internal Android**. The Center Portal may manage only separately delegated center-staff access, if granted. Public Website/Public Android support verified public identity where required and never internal role administration.
- Protected Foundation Super Admin grants are not copyable/assignable by an ordinary role editor. Only verified protected bootstrap/recovery can manage root authority. Center permissions do not imply Foundation administration, and Foundation role does not automatically convey clinical treatment-record access.
- Permission changes take effect server-side immediately for subsequent actions: update grants + audit + session invalidation and relevant cache version together, not merely hiding controls.

## 2. Minimal owned schema and relational constraints

Exact names are proposed for a greenfield implementation and should be finalized together with the first migration. Do not add a second generic authorization database or grant engine.

| Owner table | Key fields / relationships | Essential database rules |
| --- | --- | --- |
| `accounts` | id UUID PK, normalized verified-contact reference, lifecycle status, sessionVersion, createdAt/updatedAt | Unique approved verified contact/subject where configured, suspended/closed cannot authenticate; do not store clinical/HR profile data here |
| `account_credentials` | accountId FK, credential kind/provider subject, secure hash or provider assertion reference, verification/recovery metadata | Never persist plaintext passwords/OTP, raw refresh token or provider secret; hashing/provider mode per approved auth policy |
| `account_sessions` | id PK, accountId FK, hashed/opaque session credential, expiresAt, revokedAt, scope/context version, safe device metadata | Index live account sessions; revoke per device/all sessions; expired/revoked always denied |
| `roles` | id PK, owner realm (FOUNDATION/CENTER if center-local roles formally authorized), owner reference, normalized name, builtIn/protected, status, version | Unique case-insensitive name within role owner; protected role cannot be edited/deleted; no normal deletion while assigned |
| `role_capabilities` | roleId FK, capabilityKey, createdAt | Unique (roleId, capabilityKey), DB constraints and server validation against versioned supported capability catalog; custom editor cannot add protected grants |
| `role_assignments` | id PK, accountId FK, roleId FK, assignedBy, status, effectiveFrom/Until, version | Role and account active, role owner/context valid; no cross-realm escalation; define one effective primary role per *specific assigned context* unless actual requirement authorizes more; protect last root administrator transactionally |
| `foundation_assignment_scopes` | assignmentId FK, Foundation CG-02 geography/branch owner FK, scope granularity and status | Only CG-02 active/authorized targets; FK/ownership enforcement, no guessed region inheritance |
| `center_assignment_scopes` | assignmentId FK, CG-14 center/center-location FK | Only active authorized provider center targets; not a Foundation branch; center scope cannot become patient chart entitlement |
| `access_audit_events` | id, actor, target account/role, action, old/new *safe* grant/scope summary, timestamp, correlation ID | Append-only authorized audit; no OTP, raw credentials, full patient/finance payload or unrestricted personal data |

**Migration rules:** Versioned migrations; additive/compatible rollout for old Android clients; atomic rollback or controlled forward repair. Proper PK/FK/UNIQUE/CHECK/status constraints, indexes for active account/realm/role/assignment/scope and bounded directory pagination. Prefer standard DB unique index on normalized role name and transactional optimistic role version checks; lock only the narrowly contested role/assignment rows. No advisory-lock framework unless a demonstrated race needs it. For dynamic scope joins, ensure each relationship has enforceable owner FKs and the same authorized parent; never trust a user-supplied UUID.

## 3. Capability catalog and authorization contracts

**Catalog is compiled and stable**, with a human-facing label/category/description and flags such as `customAssignable`, `sensitive`, `requiresApproval`. Each CG-01/other owner declares its real capabilities (examples: `identity.roles.manage`, `identity.staff.manage`, `foundation.branches.select`, `healthcare.centers.select`, `healthcare.doctors.select`, `finance.accounts.select`, `finance.accounts.view`, `healthcare.patient-records.view`). Examples are proposals; actual domain catalog keys and labels must be frozen in the owner DLD and must not invent unsupported features. **Do not copy BrickOps manufacturing permission keys.**

**Three distinct permission concepts:**
1. **Action:** allowed to create/update/approve/receive/record/export a specific business operation.
2. **Scope:** Foundation organization/state/district/subdivision/block/branch OR explicitly authorized healthcare center; conjunction with action. No wildcard across unrelated realms or automatic medical entitlement.
3. **Safe selection privilege:** enough read-only access to fetch a bounded, permitted set of names/context needed for an allowed workflow—**not** the ability to access confidential list/detail/ledger/clinical data. Example: approved doctor selector may return name, specialty and permitted center, never the doctor's confidential account or patient files. A permitted finance entry can select a permitted account name without account balance/ledger rights.

**Typed server-side contracts (illustrative interfaces, not public DTO field labels):**
```ts
type Realm = "FOUNDATION" | "CENTER" | "PUBLIC";
type AccessRequest = {
  principalId: string; sessionId: string; action: CapabilityKey;
  realm: Realm; requestedScope: AuthorizedScopeRef;
  ownerResource?: { type: string; id: string };
};
type AccessDecision =
  | { allowed: true; effectiveScope: VerifiedScope; grantVersion: number }
  | { allowed: false; category: "NOT_AUTHENTICATED" | "NOT_PERMITTED" | "NOT_IN_SCOPE" | "REVOKED" };
interface AccessPolicy {
  decide(request: AccessRequest, db: TransactionOrReadContext): Promise<AccessDecision>;
}
```
- `authorize(action, scope, ownerResource)` runs after verified session loading and **before** any protected response. The module-owning repository must apply the verified scope in the actual database query and revalidate referenced records before write; a UI-filtered list cannot secure a forged detail URL.
- No unbounded `roleName === "Owner"` bypass or permission keys accepted from client payload. A protected root account still remains inside valid CG-02 Foundation scope for operational records; clinical data requires separate policy.
- Web + Internal Android request `GET /access/effective` (conceptual endpoint) and role catalog UI metadata; client uses per-user/context-grantVersion query keys, fail-closed while unknown/refetching. On role/scope change, invalidate active sessions/cache, navigation and permitted option lists, including secure offline cache. A locally cached grant cannot authorize an offline mutation.
- Role directory UI metadata includes role name, description, built-in/protected state, counts, grouped action labels and assignability, **not** raw keys rendered to users. Backend accepts internal capability keys invisibly and rejects unknown/reserved or out-of-scope grants.
- Every producer of domain selector data must provide an owner-scoped `options/search` contract with minimum necessary fields, pagination/search and privacy redaction. CG-01 supplies authorization/owner guidance; **other modules own their own selector data**. Never load `finance.accounts.list` or patient charts solely to fill a name picker.

## 4. Contracts and application services

| Application operation | Endpoint shape (indicative) | Guard, outcome and transaction boundary |
| --- | --- | --- |
| Sign-in, verification, recovery, sign-out and revoke sessions | `/auth/*`, `/sessions/*` | Configured verified identity, rate limits, neutral enumeration-safe errors, sessionVersion/revocation; no exposure of reset secrets |
| Effective permissions and allowed contexts | `GET /access/effective`, `GET /access/scopes/options` | Verified current account + session, allowed scopes with human names; no private master leakage |
| Role catalog and protected roles | `GET /access/roles`, `GET /access/capabilities` | Only authorized management scope; grouped human labels + invisible keys, bounded counts |
| Create/edit/copy/retire role | `POST/PATCH /access/roles`, `POST .../copy` (or copy in UI before create) | `roles.manage` + realm scope; protected/assignable key validation; normalized uniqueness; atomic version change + audit + affected session invalidation |
| Invite/suspend/reactivate staff access | `POST/PATCH /access/accounts` | `staff.manage` + permitted org/center scope; links existing owner records only by authorized verified selection; no duplicate employee master |
| Assign/change/revoke role and location | `POST/PATCH /access/assignments` | `roles.assign` + authorized target staff + valid active CG-02/CG-14 scope + role realm; approval state (CG-03 where required) before effective access; audit, session/version change |
| Safe people/roles/scope options | `GET /access/*/options` | Narrow selection/assignment capability; no salary, patient medical records, finance balances or unrestricted search |
| Staff directory and grant history | `GET /access/accounts`, `GET /access/audit` | Scoped/paginated fields, only permitted filters; no cross-center reports or raw credentials |

**Positive/negative outcome contract:** map `SUCCESS`, `SUBMITTED_PENDING`, `VALIDATION`, `DUPLICATE`, `FORBIDDEN`, `REVOKED`, `NOT_FOUND_OR_HIDDEN`, `CONFLICT`, `PROVIDER_UNAVAILABLE`, `UNKNOWN_WRITE_STATUS` and unexpected failure to **human-safe messages** shared by backend and all applicable clients; technical code used only to route UI behavior. Raw exception/HTTP/SQL/provider error never becomes user copy. A backend error produces restricted structured diagnostics (module/action, UTC time, scrubbed cause/stack and safe correlation token). Logging failure does not change an already committed role change.

## 5. State, transactions and concurrent behavior

**Account:** invited → verified/active → suspended → reactivated or closed. No suspended/revoked session may access protected operations. Invitations expire; resend is idempotent and rate-limited; response-lost-after-commit re-queries authoritative state.

**Role:** protected builtin (immutable for normal editor) or active custom → updated version → retired only if no assignments. “Copy role” copies allowed *grant keys only*, not staff/scope assignments; if protected source includes root grants, the custom role receives only safely assignable subset with a review prompt.

**Assignment:** proposed → active (directly or after actual CG-03 approval) → changed/revoked/expired; only active approved assignments grant access. Avoid separate approval workflow inside CG-01. Changing role, grant, staff status or scope commits an audited transition and invalidates relevant server sessions/permission hints. If role/version comparison loses a race, return human-readable “Role changed. Refresh and try again,” not a lost write.

**Transaction scope:** role/grant mutation, assignment mutation, last protected-root check, relevant session revoke and audit must be committed coherently. External notification sent later via existing outbox when appropriate; a failed invitation message never reverses a valid account without explicit business decision, and UI must distinguish delivered/pending.

**Cached context:** scoped by principal + realm + selected CG-02/CG-14 target + role/grant version; change of account, grant, center/branch, sign-out, suspension or TTL invalidates client caches. Unknown/offline permissions **fail closed**; never show another scope's salary, patient data or role controls as “cached convenience.”

## 6. Frontend / Android delivery boundaries

**Responsive Foundation Admin Web:** People & Access → Roles & Permissions (list/create/copy/edit/retire and grouped human-readable checkboxes) and Team Members (search, create/invite, change role, choose permitted Foundation branch/region). Every button/action has server guard. Compact 360px, tablet and desktop source-layout review; focus labels and safe success/pending/error states.

**Authorized Internal Android:** Native Roles list/new/edit/copy and grouped permission editor; Staff search/role assignment/location assignment; same backend contract and core validations. Do **not** omit role creation/assignment from mobile or squeeze a Web matrix into an Android screen. Smaller task-focused group/step screens, accessible touch, Android Back, keyboard/insets, large text, role-change logout and stale/offline state.

**Healthcare Center Portal:** Only allowed center-staff membership and narrow center roles when explicitly delegated. It cannot assign Foundation-wide rights or read patient records solely because a user is a center administrator.

**Public Website & Public Android:** Public identity/self-service only where domain owner requires; no internal staff/role editor exposed. Authenticated public account never inherits staff or clinical grants.

**Zero technical-ID UX:** Internal IDs travel invisibly in typed API payloads; selectors show permitted names + disambiguation and safe verified default scope, not a code/UUID textbox. Avoid automatic first-option privileged role selection (observed in BrickOps source). **No raw `Error.message`** in Android toasts (also observed in BrickOps source).

## 7. Patterns, NFRs, risks and traceable source-QA

- **Policy/Specification** for explicit action+scope+resource decisions; simpler direct `hasPermission` guards for uncomplicated cases. Reject dynamic policy DSL or per-module RBAC engine.
- **Facade/application services** for role and staff assignments, not generic write-anything repository. **Unit of Work** via ordinary PostgreSQL transactions for grant/session/audit updates. **Adapter** only if an actual second OTP/auth delivery provider is used; no speculative Factory/Strategy.
- DB indexing: candidate indexes include `(account_id, status)` on sessions/assignments, `(role_id, capability_key)` unique, realm+normalized role name unique, owner FK+active-state on scope links; validate actual query plan and migration with separately authorized release QA, not invented performance measurements.
- P0 privacy: no cross-center/provider/branch IDOR, protected account enumeration, session fixation, stale grant JWT, public-cache leakage, sensitive log payload or unbounded list options. P0 operability: error correlation/redaction, bounded DB queries, no permanent worker/polling merely for RBAC.
- Source-review requirement for every Planning-approved QA case: trace UI handler in Web/**Internal Android where applicable** → shared typed API client → NestJS guard/DTO → policy + owner-scope query → transaction/audit/session invalidation → safe outcome and affected other client/report. Reject source-complete until negative, duplicate, revocation, cross-scope and picker-only cases have traceable implementation. **No live test/build, browser/emulator, screenshot/image generation, CI/GitHub Actions** during Development; runtime/visual `NOT_RUN` and `VISUAL_NOT_RUN`.
- **External unresolved choices:** Foundation bootstrap credential and recovery operator, phone/email/OTP provider, final auth modality, staff relationships with CG-10, CG-02/CG-14 live owner schema, CG-03 approval conditions, role rights for center administrator. Do not invent provider credentials or implement autonomous grant of restricted rights.

## 8. Review and handoff integrity
Reviewed against `jasiqlabs/brick-ops@master` role creator/editor (`frontend/src/app/dashboard/staff/roles/page.tsx`, `mobile/src/modules/staff/StaffRolesScreen.tsx`), role/staff assignment (`frontend/src/app/dashboard/staff/page.tsx`, `mobile/src/modules/staff/StaffFormScreen.tsx`), permission catalog, scope and session logic. Kept pattern: minimum necessary `options` access for creator-only workflows, with no accidental confidential list view. Corrected the risks of first-role auto-default and showing `e.message` on Android. All CareGanga tables/APIs are **proposed designs**, not pre-existing code. Source-level self-review only; independent specialist review and pinned local stage resolver are `NOT_RUN`.
