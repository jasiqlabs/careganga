# CG-01 — Detailed Design: Identity & Role-Based Access

**Design authority:** [CG-01 module](module.md) · [PRD](../../prd.md) FR-001–003/080 · [HLD](../../hld.md) §§5.3–5.4, 7–9 · [CG-01 UI/UX](uiux.md)  
**Decision:** REQUIRED for new security-critical schema, permissions and Android/Web access. **State:** rebuilt source-design draft; no migration, runtime or local Harness gate executed.

## 1. Implementation boundary

A cohesive NestJS CG-01 application/domain/persistence module supplies login, accounts, roles, effective-access decisions and read-only option projections. Both React/Next.js Web and two separate Expo Android apps call the **same** typed endpoints. PostgreSQL is authoritative; client grants are navigation hints only.

The first technical bootstrap creates a protected Foundation-root administrative context and an explicitly controlled initial Super Admin account/recovery process. This is **not** CG-02 geography: future branches and CG-14 centers remain unknown and default-denied. No preliminary fake HR, center, approval or branch row is permitted.

## 2. Owned database model

| Record | Minimum fields and invariants |
| --- | --- |
| Account | id, verified contact/identity subject, display name, lifecycle state, session/access version, timestamps; verified unique subject/contact according to real auth policy |
| Credential / challenge | account reference, provider subject or secure password hash, expiring single-use invite/recovery/verification challenge; no raw password, OTP, token or secret stored |
| Session | hashed opaque session/refresh reference, account FK, expiry, revocation, device metadata, access version; bounded index on active sessions |
| Role | id, Foundation-root realm, unique normalized name, description, optional UI color, protected/built-in flag, active/retired status, revision |
| Role grant | unique role FK + supported action key; allow-listed catalog only; sensitive/root grants not custom-copyable |
| Account-role assignment | account FK, role FK, explicit current Foundation-root context, effective/revoked times, assigned by, revision; at most one active primary role assignment per account per Foundation-root context (future center contexts require separate validated assignments) |
| Access audit | actor/target, action, safe before/after grant summary, timestamp, correlation reference, decision; append-only and privacy-redacted |

CG-01 also owns **logical future scope grant interfaces**, not premature foreign-key tables to unavailable geography or center entities. When CG-02/CG-14 ship, their approved schema/relations and integration migrations introduce validated real scope links; the CG-01 API guard must verify those owner relationships through typed contracts before any non-root scope can become active. CG-10 employee data and CG-03 approval state remain owner records.

**DB correctness:** real PK/FK/UNIQUE/CHECK constraints, normalized-role uniqueness, indexed account/session/role/assignment paths, bounded pagination, transactionally protected last-Super-Admin checks, optimistic revision conflicts. All migrations are versioned; include forward repair/rollback and no unscoped ownership joins. No second auth database, generic permission rules table interpreted as arbitrary code, or cross-domain table writes.

## 3. Capability and authorization contract

A maintained allow-listed capability registry returns `key, businessLabel, group, assignable, sensitive` for **implemented/approved** actions. Initial CG-01 actions cover account viewing/managing, roles/view/manage/assign and audit access. New owner modules register their real actions **only when introduced**; existing custom roles acquire no automatic new grants.

Authorization order:
1. Authenticate active account and live unrevoked session.
2. Resolve effective active assigned roles and current grant revision from authoritative server state.
3. Validate requested action, actual resource owner, active authorized scope and purpose restrictions.
4. Apply bounded owner-scoped query/filter to list, detail, selector, export and mutation; deny otherwise.
5. Write privileged audit for allowed mutations/denied security-significant operations; do not log secrets.

**Foundation-root** grants only CG-01/root operations currently defined. Never interpret root as wildcard to future Foundation branches, provider centers or patient records. A linked public/member/employee/patient identity never inherits another relationship's rights. Future clinical read additionally requires genuine CG-15/16 treatment/purpose authorization.

**Safe selectors:** CG-01 may return minimal eligible account/role `{value, label, context}` projections (opaque IDs transmitted, names displayed) with paging/search and an explicit limited selection capability. A feature requiring finance accounts, employees, branches, providers or doctors consumes that **later owner's** authorized options projection; selection does not imply confidential detail/ledger visibility.

## 4. Typed application and HTTP contracts

| API family (illustrative paths) | Authorization and result |
| --- | --- |
| `/auth/sign-in, sign-out, recover, verify` | Secure credential/challenge, throttling, expiry, neutral non-enumerating failure; public account access only where an owner has enabled a real self-service flow |
| `/me, /access/effective` | Current identity, verified context, capabilities, revision, allowed CG-01 scope; no frontend-issued privilege accepted |
| `/access/roles, /access/roles/:id` | Authorized role listing + create/edit/copy/retire; server validates every grant, protected privilege, version and audit |
| `/access/accounts, /access/invitations` | Scoped account directory, invite/suspend/reactivate; no CG-10 employee master or center staff record creation |
| `/access/assignments` | Assign/change/revoke permitted non-protected role to real CG-01 account at Foundation-root; reject forged, retired, elevated or outside-context requests |
| `/access/accounts/options, /access/roles/options` | Only permitted, limited label/context selection; separate from unrestricted directory/export privilege |
| `/access/audit` | Scoped privileged history; safe fields only |

Define typed commands/queries and stable safe **outcome categories** (`SUCCESS`, `PENDING`, `VALIDATION`, `DUPLICATE`, `FORBIDDEN`, `CONFLICT`, `UNAVAILABLE`, `UNKNOWN`) shared by Web/Android. Client copy uses user language, never raw exception/provider/SQL/HTTP text or permission/UUID key. Correlated technical cause is available only in redacted operator logs. An unsuccessful API response must never be shown as success.

## 5. State, transaction and recovery rules

- **Account:** invited → verified/active → suspended/reactivated or deactivated. Recovery challenge one-time/expiring; invitation re-send/retry cannot double-create account. No session for unverified/suspended account. **Privileged Foundation Admin authentication requires MFA; provider failure never bypasses its challenge.**
- **Role:** built-in protected (ordinary edits forbidden) or active custom → revised → retired (only with safe assignment transition). Copy copies only allowed grant choices, not assigned users, protected root authority or scope.
- **Assignment:** active only after direct permitted action; revoke/change increments effective-access revision and invalidates impacted sessions/cache. Where a future CG-03 approval is mandatory, the pending change grants **nothing** until actual approved finalization.
- **Concurrent edits:** normalized name uniqueness and revision guard prevent duplicate/lost write; assignment/grant update, audit and session-version change commit coherently. Last protected administrator cannot be removed, including racing requests.
- **External invitation transport:** a narrow auth-verification provider adapter sends genuine verification/invite notices after committed state; missing credentials or timeout are pending/unavailable, never a fabricated send. Later CG-19 handles generalized messaging, not credential truth.
- **Zero unnecessary background traffic:** no periodic scan of every account/tenant for role changes; use access-version checks on protected requests and bounded expiry cleanup, if required.

## 6. Real future integrations

| Later module | Contract needed before integration is enabled | Its end-to-end acceptance owner |
| --- | --- | --- |
| CG-02 | Valid active geography/branch/department owner, permitted scope option/search, relational scope check and invalidation | CG-02 Planning/QA |
| CG-03 | Protected assignment request, reviewer routing, final authorization callback/reference and idempotent activation | CG-03 Planning/QA |
| CG-10 | Verified employee-to-account link, employment/status/designation/joining-date query and safe staff selector | CG-10 Planning/QA |
| CG-14 | Valid active center/location/staff affiliation, center realm grants and negative clinical/cross-center checks | CG-14 Planning/QA |
| Other owners | Domain capability registry declaration, own scoped resource lookup and `options` read model | Introducing module Planning/QA |

Each future module consumes **CG-01's completed identity policy contract**, rather than requiring CG-01's original feature to remain blocked. Do not add fake owner rows or mark feature integration verified from type declarations alone.

## 7. Pattern, channel and security decisions

- **Use:** small server-side policy/specification functions for action + verified scope, transactional application services for mutations, explicit guarded lifecycle transitions, simple auth-provider adapter, typed minimum-field option projection.
- **Reject:** inheritance-based state classes/Template Method, universal rule DSL, speculative Strategy/Factory hierarchies, per-module RBAC engines, microservices, full CQRS/message broker, automatic root-as-all-branches scoping. Simpler explicit code is preferable until a real variant exists.
- **Mandatory PRD N-13 / HLD H-12 source-matched UI:** Foundation Web must reuse the **actual** CareGanga Admin screenshot-derived shared palette, typography, spacing, borders, badges, icon family, sidebar/header, KPI and table, role checkbox-matrix and right-side drawer components. CG-01 screen audit IDs: U02–U10, B34 and audit shell §2.1. **One token/motion implementation from initial frontend bootstrap**, no per-module CSS/theme copy; verify the original PNG/video before freezing exact colors or transition duration/easing. Navigation, drawer/overlay, tabs, group expansion, feedback/loading and error states must match verified existing interaction styles; retain reduced-motion behavior and do not invent decorative animation. Matching native Android components consume semantically identical tokens, adapted to touch/Back/keyboard.
- **Foundation Web:** responsive account and role screens, grouped compact permission controls; no technical keys in UI.
- **Internal Android:** native, keyboard-safe/touch-safe role and assignment journeys, not a WebView parity claim; secure logout/role-revoke handling.
- **Public Web/Android:** verified identity only for actual enabled public owner journeys; no staff menus. **Center Portal:** sign-in shell only until real CG-14 scope exists.
- **Security/NFR:** OWASP/ASVS/API/MASVS applicable controls, secure credential storage/MFA for privileged use per selected auth policy, authorization across direct IDs and files, minimal logs, accessible states, privacy-safe selectors, bounded queries, safe migration and stale-version compatibility.
- **Mobile baseline:** Expo SDK 58 / React Native 0.88 / React 19.3 / Android compile 37, target 36 (official Expo and Play references in module.md). Bootstrap pins and reviews exact compatible SDK/Gradle/NDK/native dependencies; no unverified binary/store PASS.

## 8. Design acceptance and evidence

The three vertical CG-01 stories in [tasks.md](tasks.md) must each source-trace a real database/HTTP/UI interaction including positive, forbidden, duplicate/concurrent, stale-revoked, unavailable and relevant Web/Android outcomes. No future-owner FK or selector is part of current CG-01 completion. This design is ready **for review and Harness resolver**, not for automatic Development authorization. No code, source tests, device tests, app builds or screen previews were executed.
