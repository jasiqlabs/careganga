# CG-01 — Detailed Design: Identity & Role-Based Access

**Design authority:** [CG-01 module](module.md) · [PRD](../../prd.md) FR-001–003/080 · [HLD](../../hld.md) §§5.3–5.4, 7–9 · [CG-01 UI/UX](uiux.md)  
**Decision:** REQUIRED for new security-critical schema, permissions and Android/Web access. **State:** rebuilt source-design draft; no migration, runtime or local Harness gate executed.

## 1. Implementation boundary

A cohesive NestJS CG-01 application/domain/persistence module supplies login, accounts, roles, effective-access decisions and read-only option projections. Both React/Next.js Web and two separate Expo Android apps call the **same** typed endpoints. PostgreSQL is authoritative; client grants are navigation hints only.

The first technical bootstrap creates a protected Foundation-root administrative context and an explicitly controlled initial Super Admin account/recovery process. This is **not** CG-02 geography: future branches and CG-14 centers remain unknown and default-denied. No preliminary fake HR, center, approval or branch row is permitted.

## 2. Canonical data model and database architecture

**Risk:** CRITICAL, because identity/role mutations control future confidential resources. One protected `access_realm` singleton defines the initial Foundation-root authorization context. It is **not** a CG-02 geography/branch/business-Foundation record. No future department/branch/center/employee/protected-approval case is seeded or required. This does **not** introduce a multi-tenant business module.

| Owned record | Exact invariant and integrity contract |
| --- | --- |
| `access_realm` | Unique protected `FOUNDATION_ROOT` key; one bootstrap record, stable lock anchor for last-privileged-admin operations; no wildcard future branches |
| `account` | Opaque PK, verified provider identity subject, normalized verified contact where policy allows, name, invited/active/suspended/deactivated, `access_version`, timestamps; unique verified subject and contact constraints where genuinely applicable |
| `identity_credential` | FK account, provider reference or securely salted password verifier, version and change time; no raw password/OTP/token storage |
| `auth_challenge` | FK to actual account/invitation, one-way hashed challenge, type, `expires_at`, `consumed_at`, attempts, request idempotency key; unique accepted active challenge behavior and one-time consume enforced transactionally |
| `session` | FK account, unique hashed refresh/session secret, expiry, revoked time, account access_version snapshot, minimal device metadata; rotation and replay prevention |
| `role` | PK, realm FK, unique normalized name per realm, description/color, built-in protected flag, active/retired, revision |
| `role_grant` | role FK + allow-listed capability key, UNIQUE(role_id, capability_key); supported actions only, no wildcard or unauthorized inherited future grant |
| `account_role` | account/role/realm FK, assigning actor, active/revoked timestamps, revision; UNIQUE **active** (account_id, role_id, realm_id). Multiple different assigned roles per account are allowed; a display-only primary label must not drive authorization |
| `access_audit` | Append-only actor, target, action, realm, safe before/after summary, decision, UTC timestamp, correlation ID; audited privileged mutation commits atomically with grant and access_version |

**DB authority:** Every access decision is server-derived from active account + current session version + implemented action grant + verified **same real scope**. Multiple roles may contribute explicit allowed capabilities in the same valid context; a role must never silently grant protected actions or scopes belonging to another role, center, branch or patient. Do not trust a client-supplied realm/ID as proof. Row FK/CHECK/UNIQUE protect status, hierarchy and duplicate assignment; role-copy excludes root/sensitive grants and assigned people. Unknown future modules default-deny.

**Last-root / concurrency:** Lock `access_realm` first in a short transaction for grant/assignment/suspension affecting a protected administrator, recheck last-active-root under lock, write change + affected account access_version + durable redacted access_audit, then commit or reject. Role updates use expected revision/compare-and-swap; challenge consumption, bootstrap and active assignment uniqueness have DB guards. No SELECT-then-INSERT race. A technical logging outage never changes already confirmed transaction status; unlike diagnostics, failure to persist mandatory business access_audit must abort the mutation.

**Index and query plan:** Unique normalized verified subject/contact when appropriate, `role(realm_id, normalized_name)`, `role_grant(role_id, capability_key)`, partial active `account_role(account_id,role_id,realm_id)`, session account/revoked/expiry, challenge account/type/expiry, and bounded audit target/date. Authorized filtered account/role/selector pagination should use stable sort, capped page, minimal fields; add composite indexes only for verified filters/sort, not every column. Runtime query plans, actual row counts, N+1 and index write cost are `NOT_MEASURED`; EXPLAIN/realistic data review belongs to independent QA.

**Migrations/recovery:** Keep ordered CG-01-only migrations and ORM schema synchronized; enforce one root bootstrap in a transaction and a protected recovery route without a static password. No speculative FK to CG-02/03/10/14. Validate upgrade and safe rollback/forward repair in disposable DB, older Android client compatibility, account/session revocation and restore permissions. Engine/ORM version, pooling (direct migration vs pooled app), RLS choice, PITR/backup entitlement and actual RTO/RPO are `UNVERIFIED`, not guessed; optional RLS must be tested with the real non-BYPASSRLS request role and pool connection reuse. A scoped column alone never proves isolation.

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
- **Assignment:** active only after direct permitted action; revoke/change increments effective-access revision and invalidates impacted sessions/cache. Where a protected change requires CG-03 approval, direct action is blocked until CG-03 delivers a genuine request/review/finalization flow; CG-01 never exposes an uncompletable pending request.
- **Concurrent edits:** normalized name uniqueness and revision guard prevent duplicate/lost write; assignment/grant update, audit and session-version change commit coherently. Last protected administrator cannot be removed, including racing requests.
- **External invitation transport:** a narrow auth-verification provider adapter sends genuine verification/invite notices after committed state; missing credentials or timeout are pending/unavailable, never a fabricated send. Later CG-19 handles generalized messaging, not credential truth.
- **Zero unnecessary background traffic:** no periodic scan of every account/tenant for role changes; use access-version checks on protected requests and bounded expiry cleanup, if required.

## 6. Real future integrations

| Later module | Contract needed before integration is enabled | Its end-to-end acceptance owner |
| --- | --- | --- |
| CG-02 | Valid active geography/branch/department owner, permitted scope option/search, relational scope check and invalidation | CG-02 Planning/QA |
| CG-03 | Creates its protected access-change case using an existing CG-01 account and role, completes reviewer routing, then calls CG-01's guarded idempotent apply-approved-decision command. No required approval request table or pending-only CG-01 feature | CG-03 Planning/QA |
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

## 8. Invitation, MFA and worker/bandwidth boundary

**CG-01 does not create an always-on worker.** A real user invitation, sign-in MFA, credential recovery or explicit resend triggers an expiring credential/challenge and the configured provider adapter. Persist the required challenge/attempt status first; deliver after the short DB transaction, never hold a lock while calling network providers. A committed invite with provider timeout is `PENDING_DELIVERY` / delivery unknown, **not** a verified login or "invitation sent". Resend checks current eligible challenge, rate-limits attempts and uses stable request idempotency; no uncontrolled new OTP or duplicate account after uncertain provider response.

**Idle/no-work invariant:** With zero due communications, the current Foundation's idle accounts and multiple backend instances (and any future additional Foundation contexts), CG-01 runs **zero repeated per-tenant scans and zero provider sends**. Access/version is checked on actual protected requests; challenge expiry is checked on use. Only if measured storage growth requires it, add infrequent bounded global cleanup for already expired rows with a supporting expiry index—not a fast unconditional cron over tenants. Do not add an import worker, Redis, queue, broker or CG-19 table to the first module. If later proven necessary, CG-19 introduces a due-only durable job/claim with finite backoff, lease/restart recovery and audited provider delivery.

**Busy/restart cases:** Concurrent user-triggered resends, provider timeout-after-send, process restart after committed invitation and simultaneous admin invitations have one confirmed source state, finite external call/attempts and an actionable check-status/resend outcome. Keep provider error classes retryable/permanent, finite timeout, backoff only for approved retry mechanism, no synchronous infinite retry. Observe DB queries/rows, auth API requests, provider call count/bytes, idle wakeups and instance/tenant amplification; do not infer cloud egress billing from DB transaction count. All measured values remain `NOT_MEASURED` pending QA.

## 9. Human messages, errors, observability and logging

**Safe outcomes:** `SUCCESS`, `INVITED_PENDING`, `VERIFICATION_PENDING`, `VALIDATION`, `DUPLICATE`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `UNAVAILABLE`, `UNKNOWN_WRITE_STATUS`, `UNEXPECTED`. A small HTTP exception mapper converts domain outcome to proper transport semantics and safe payload; only controlled localized text is displayed in Foundation Web, Center/Public sign-in as applicable, and Internal/Public Android. Expected errors are deliberately handled; unexpected exceptions receive generic safe copy. No raw `error.message`, SQL constraint/stack/provider response, HTTP status numbers or UUID in user-facing UI, toast, notification or downloaded text.

| Business situation | Approved example wording and action |
| --- | --- |
| Role/access saved | “Role saved.” / “Access updated.” Only after a confirmed transaction |
| Invitation persisted; delivery unknown | “Invitation created. Delivery is being checked.” Show actual status and permitted resend |
| Unknown account/wrong sign-in | “We couldn't sign you in. Check your details and try again.” Do not reveal whether account exists |
| Code expired | “That code has expired. Request a new code.” |
| Wrong privilege | “You don't have permission for this action. Contact your administrator.” |
| Duplicate role | “A role with this name already exists. Choose another name.” |
| Stale role/assignment | “This was changed elsewhere. Refresh before saving again.” Preserve user input |
| Too many attempts | “Too many attempts. Try again later.” |
| Provider unavailable | “We couldn't send a code right now. Try again later.” |
| Network lost after write | “We couldn't confirm this change. Check its status before trying again.” No blind duplicate submission |
| Unexpected | “Something went wrong. Please try again or contact support with this reference.” Opaque support reference only |

**Request trace:** correlate Web/Android action → API → CG-01 policy → DB transaction → auth provider with a safe opaque request/correlation ID. Structured restricted diagnostics record UTC, severity, module, operation, environment, safe actor/realm reference, outcome/error class, trace ID, duration and bounded DB/provider counters. Unexpected stack/cause belongs only in restricted redacted diagnostics, not users' response bodies; never log passwords, OTPs, tokens, request bodies, full phones/emails, bank/clinical data, private file paths or high-cardinality user-labelled metrics. Normal failed logins should not create giant stack traces.

**Distinct responsibilities:** (1) durable append-only `access_audit` is CG-01's business-security truth, transactionally coupled to sensitive grant mutations; future CG-21 may read/filter it for permitted central audit, **not create a second role-access ledger**; (2) technical logs/metrics diagnose failures and are retained/permissioned with bounded volume; (3) user communications contain safe outcome only. If telemetry fails after a committed role change, don't report operation failed or attempt another write. An authorized support operator may map a displayed opaque Support reference to restricted diagnostics; normal Foundation staff and center staff cannot browse infrastructure logs.

**Measured operational signals:** auth failure/rate-limit trends, MFA provider failures, role edit conflicts, session revocations, suspicious scope-denials, HTTP latency, DB query/row volume, provider calls/bytes, idle background cycles, logging sink failures. Alert via existing hosting monitoring where materially justified; no new logging microservice. Actual thresholds, cloud bandwidth attribution and incident response testing are `NOT_MEASURED`.

## 10. Minimal patterns and specialist review gates

| Scenario | Selection and reason | Alternatives rejected | Verification |
| --- | --- | --- | --- |
| Scoped action and role access | Typed **Policy/Specification** helpers + guarded queries | UI-only visibility insecure; arbitrary policy DSL complex | BOLA/BFLA, selector and export negative QA |
| Role change and session revocation | Simple service + existing DB **Unit of Work**, row revision, unique constraints | Saga/approval engine unnecessary for current direct grants | Last-root races, stale role, audit atomicity |
| Auth/MFA provider calls | Thin **Adapter** with on-demand trigger and durable pending challenge status | Always-running per-tenant worker/broker unjustified | Timeout after commit, explicit retry, zero-work/no-provider |
| Safe exception and logs | Typed outcomes + one restricted middleware/log boundary | Separate error service / raw exception text unsafe | Correlation/redaction and telemetry outage |
| Sensitive future approvals | CG-03 introduces workflow after CG-01 exists; guarded source owner finalization | Current-module pending-only feature can't finish | CG-03 integration acceptance |

No Strategy, inheritance Template Method, factory layer, global cache, event bus, microservice or generic repository framework is needed for fixed CG-01 operations. **CRITICAL database changes require independent qualified data review** in addition to this source design review; actual schema, startup/idle traffic, plans and restore remain untested.

## 11. Android/Expo native dependency and store compatibility gate

The two Android apps share a stable backend/API and original CareGanga visual language, but not private session caches or package identities. Official Expo SDK 58 compatibility: **Expo SDK 58.0.0 / React Native 0.88 / React 19.3.0 / React Native Web 0.21.0**, minimum Node 22.13.x, Android 7+, compile SDK 37, target SDK 36 and Android build tools 37.0.0. Google Play ordinary Android new/update submissions require target API 36 from 31 August 2026. References: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878.

**Not yet evidenced:** exact compatible Expo-generated Android Gradle Plugin/Gradle/Kotlin/JDK/NDK versions, config/native plugin matrix, secure native storage package, actual committed manifests/lockfile, native .so transitive SDKs, 64-bit/16 KB ELF/AAB packaging, device launch and Play SDK Index/Console blocking warnings. The single bootstrap **must pin and verify the real mutually compatible stable versions before mobile feature implementation and formal task approval**; do not invent an AGP/NDK number or call a target-SDK declaration store accepted. Product remains `MOBILE_DEPENDENCY_MATRIX_UNVERIFIED` until this evidence exists.

Native Web/Internal Android parity requires securely separate account/session caches and correct Back/keyboard/inset/biometric-if-implemented state. Expired MFA and revoked roles deny next protected API even with old installed clients. Real signed AAB, device/16 KB and store validation remain `NOT_RUN` until independent QA/Release, with no CI or GitHub Actions.

## 12. Design acceptance and evidence

The three vertical CG-01 stories in [tasks.md](tasks.md) must each source-trace a real database/HTTP/UI interaction including positive, forbidden, duplicate/concurrent, stale-revoked, unavailable and relevant Web/Android outcomes. No future-owner FK or selector is part of current CG-01 completion. This design is ready **for review and Harness resolver**, not for automatic Development authorization. No code, source tests, device tests, app builds or screen previews were executed.
