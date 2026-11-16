# CG-01 — Detailed Design: Identity & Role-Based Access

**FINAL ACCOUNT CREATION CLARIFICATION (owner 16 Nov 2026; greenfield):** The **first Foundation Super Admin** is provisioned **once by a protected operator-only script**, using unique mobile, optional email, name and password supplied securely at runtime. No public endpoint can bootstrap Super Admin. Thereafter the Super Admin (and administrators possessing explicitly granted `accounts.invite` + `roles.assign`) create **every user directly** in the original CareGanga **U03–U04 Add New Staff Account** drawer: **Full name + mobile (username) + optional email + initial password + chosen eligible role**. Account becomes **ACTIVE immediately**; no invitation, self-signup, authenticator setup or mobile/email verification. The user signs in using mobile/email + password. Super Admin may create users with **any permitted role**, subject to last-root, privilege-escalation and deliberately guarded sensitive-role rules. A user does **not self-register**, choose their own role or gain access from the public website's contact/join CTA. Later public member/patient application flows are separate domain flows and will not silently create elevated login. **Forgot Password alone requires real email OR SMS OTP** to a previously stored contact; no bypass on provider unavailability.

**Greenfield delivery directive (owner, 16 November 2026):** CareGanga has not been delivered to the client and has no functioning legacy deployment or users to migrate. **Backward compatibility (BWC), preserving unshipped TOTP/invitation contracts, and supporting legacy login are not requirements.** Implement one coherent clean-initial-database authentication solution, simplify/drop obsolete code and seed only genuine initial roles. Test on a new disposable PostgreSQL database; never imply existing data migrations, production runtime or completed QA. Security and permission enforcement remain mandatory.


**Design authority:** [CG-01 module](module.md) · [PRD](../../prd.md) FR-001–003/080 · [HLD](../../hld.md) §§5.3–5.4, 7–9 · [CG-01 UI/UX](uiux.md)  
**Decision:** REQUIRED for new security-critical schema, permissions and Android/Web access. **State:** owner-delegated SOURCE DESIGN APPROVED at current SHA (approval ledger); authenticated local Harness resolver, independent security/database review, real migration, runtime/device/pixel/motion QA NOT_RUN.

## 1. Implementation boundary

A cohesive NestJS CG-01 application/domain/persistence module supplies login, accounts, roles, effective-access decisions and read-only option projections. Both React/Next.js Web and two separate Expo Android apps call the **same** typed endpoints. PostgreSQL is authoritative; client grants are navigation hints only.

The first technical bootstrap creates a protected Foundation-root administrative context and an explicitly controlled initial Super Admin account/recovery process. This is **not** CG-02 geography: future branches and CG-14 centers remain unknown and default-denied. No preliminary fake HR, center, approval or branch row is permitted.

### CG-01 US-001 typed ERP deployment capability bootstrap (FR-081 only; no ERP module import)

Under existing `apps/backend/src/config`, create an immutable validated `erpDeploymentCapabilities` typed object resolved at process start: allowed keys exactly `CAREGANGA_ERP_LAB_ENABLED`, `CAREGANGA_ERP_PHARMACY_ENABLED`, `CAREGANGA_ERP_NURSING_ENABLED`, `CAREGANGA_ERP_OT_ENABLED`; only normalized exact documented true/false values accepted, omitted/unrecognized invalid value fail OFF (audit a redacted config validation warning but never secret/PII). `.env.example` supplies explicit `false` for all four. Process health/readiness may expose **redacted current static OFF/ON availability** to privileged existing-auth actors; it cannot grant a center entitlement. Config is NOT edited in CG-21 database or a future panel; change requires controlled deployment restart and post-change gate checks. `apps/web` and native shells never treat a copied build-time flag as authorization. With no CG-14 or optional module installed, all four OFF yields no ERP route registration/job/service/database FK and original CG-01 bootstrap source unaffected. If ON before owner module installed, effective readiness fails CLOSED with explicit NOT_AVAILABLE rather than starting empty owner tables, leaking simulated UI or dispatching fake worker jobs. Security/QA: reject `truee`, missing, env injection and wrong-case inputs; do not include any third-party medicine/clinical API secret in feature flag or logs. Do not add a generic feature DSL, second config store or application server.

## 1A. First bootstrap directory contract (CG-01 US-001)

**Not yet implemented:** The following exact layout is the approved Development target and is checked at the first source QA, not an assertion about files currently present.

```text
careganga/
├── package.json                 # npm workspaces/scripts/compatible engines
├── package-lock.json            # one committed lockfile for reproducible resolution
├── tsconfig.base.json
├── .env.example                 # required/optional variable NAMES, no credentials
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── main.ts          # one NestJS startup/shutdown entry
│   │   │   ├── app.module.ts    # composition root: currently CG-01 only
│   │   │   ├── core/
│   │   │   │   ├── config/      # validated runtime environment
│   │   │   │   ├── http/        # health/readiness, safe exception boundary
│   │   │   │   └── observability/ # bounded, redacted correlated diagnostics
│   │   │   └── modules/
│   │   │       └── cg-01-identity-access/
│   │   │           ├── identity-access.module.ts
│   │   │           ├── public-api.ts   # allowed owner facade, not ORM exports
│   │   │           ├── domain/
│   │   │           ├── application/
│   │   │           ├── infrastructure/
│   │   │           └── http/
│   │   └── db/migrations/       # one ordered history; CG-01 schema only initially
│   ├── web/
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/            # public, (admin), (center) Next.js route groups
│   │       ├── features/identity-access/
│   │       └── shared/         # responsive primitives and safe messages
│   ├── android-public/
│   │   ├── package.json
│   │   └── app/                # Expo public routes, no internal staff bundle
│   └── android-internal/
│       ├── package.json
│       ├── app/
│       └── src/features/identity-access/
├── packages/
│   ├── api-contracts/src/      # versioned transport DTO/outcome schemas
│   └── design-tokens/src/      # source image/video approved brand semantics
├── docs/  # existing BR
├── specs/ # existing planning
└── scripts/ # existing resolver
```

**One root workspace:** Pin mutually compatible Node/npm, NestJS, Next.js, Expo/RN and native toolchain versions in the manifest/lockfile after official-source verification; no invented native version numbers. Required root/npm workspace commands to provide: `npm ci`; `npm run dev -w apps/backend`; `npm run dev -w apps/web`; `npm run start -w apps/android-public`; `npm run start -w apps/android-internal`; and `npm run db:migrate -w apps/backend`. Each must actually exist in its package scripts. Independent QA later executes commands and documents results; Planning and Development source review do **not** claim execution.

**Backend owner boundaries:** `app.module.ts` may import only implemented modules. CG-01 exports an authorization facade (e.g. verifySession/requireAction/allowedAccountOptions) with current real scope; no CG-02/03/10/14 imports or migrations. Technical `core` owns generic error/config/trace plumbing, **not** CG-01 role/permission truth. New owners add `src/modules/cg-02-foundation-structure/` etc. only when delivered, with small `domain/application/infrastructure/http` folders as actually needed. Modules import only prior owner `public-api` and shared DTOs, not foreign repositories, entities, internal services, or the composition root; no circular Nest `forwardRef()`. TypeScript/lint import-boundary checks or a small simple local check enforce this during manual review. No 21 empty folders, extra authentication service, broker, cache, import worker or redundant database.

**Runtime independence:** Verified DB connection/migration state and required signing/MFA provider config must be checked; missing **essential** config gives an explicit unavailable/failed-closed state, never fake success or known default secret. Absence of optional *future* services must not block backend startup or CG-01 roles/login. CG-01 invitation/MFA uses on-demand bounded provider adapter and truthful pending/unavailable states; zero scheduled tenant scans at idle. Each Android package uses separate identity/session storage and guarded navigation, never an Admin WebView with mixed auth. Seed no sample clinic, branch, employee or fake user.

**Later module gate:** Add a business-owner backend folder and migration inside the same DB history, expose only authorized typed facade, create only applicable Web/native routes, register module and its real capabilities, preserve CG-01 and old-client behavior, and trace auth, error copy, logging, concurrency, privacy, DB query/cost and idle-worker tests. Future module integration belongs to the introducing owner and is not an incomplete CG-01 prerequisite. Do not change the canonical top-level workspaces without a reviewed HLD/DLD change.
 

**CG-01 UI implementation map:** The canonical repo introduced at bootstrap implements `packages/design-tokens/src` once (reference-grounded semantic tokens, not unsupported HEX/animation constants); `apps/web/src/shared` provides accessible CareGanga shell, table, KPI, form drawer, status badge, permission matrix and human outcome notices; `apps/web/src/features/identity-access` is the only Web CG-01 business UI. `apps/android-internal/src/features/identity-access` implements equivalent *native* staff role/account journeys, with no Admin WebView or independent theme. `apps/android-public` only uses a safe common public sign-in/brand where actually in scope. Screens U02–U10/B34 map to these real features; don't copy screenshot demo data or create unbuilt future links. Compare [CG-01 UIUX](uiux.md) §2.1 before source handoff and record screenshot IDs and evidence, with visual/device checks NOT_RUN until independent QA.

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
| `account_role` | account/role/realm FK, assigning actor, active/revoked timestamps, revision; UNIQUE **active** (account_id, realm_id). Exactly **one active role per Foundation-root context** in the first business workflow; that role can contain multiple action permissions. Later CG-02/14 may add different roles for *different verified resource contexts*, never a hidden extra root role. |
| `access_audit` | Append-only actor, target, action, realm, safe before/after summary, decision, UTC timestamp, correlation ID; audited privileged mutation commits atomically with grant and access_version |

**DB authority:** Every access decision is server-derived from active account + current session version + implemented action grant + verified **same real scope**. One current role grants only its explicit allow-listed actions in its verified context; combining several actions inside one custom role is supported. Do not union invisible secondary roles or inherit branch, center or patient access. Do not trust a client-supplied realm/ID as proof. Row FK/CHECK/UNIQUE protect status, hierarchy and duplicate assignment; role-copy excludes root/sensitive grants and assigned people. Unknown future modules default-deny.

**Last-root / concurrency:** Lock `access_realm` first in a short transaction for grant/assignment/suspension affecting a protected administrator, recheck last-active-root under lock, write change + affected account access_version + durable redacted access_audit, then commit or reject. Role updates use expected revision/compare-and-swap; challenge consumption, bootstrap and active assignment uniqueness have DB guards. No SELECT-then-INSERT race. A technical logging outage never changes already confirmed transaction status; unlike diagnostics, failure to persist mandatory business access_audit must abort the mutation.

**Index and query plan:** Unique normalized verified subject/contact when appropriate, `role(realm_id, normalized_name)`, `role_grant(role_id, capability_key)`, partial active `account_role(account_id,realm_id)`, session account/revoked/expiry, challenge account/type/expiry, and bounded audit target/date. Authorized filtered account/role/selector pagination should use stable sort, capped page, minimal fields; add composite indexes only for verified filters/sort, not every column. Runtime query plans, actual row counts, N+1 and index write cost are `NOT_MEASURED`; EXPLAIN/realistic data review belongs to independent QA.

**Migrations/recovery:** Keep ordered CG-01-only migrations and ORM schema synchronized; enforce one root bootstrap in a transaction and a protected recovery route without a static password. No speculative FK to CG-02/03/10/14. Validate upgrade and safe rollback/forward repair in disposable DB, older Android client compatibility, account/session revocation and restore permissions. Engine/ORM version, pooling (direct migration vs pooled app), RLS choice, PITR/backup entitlement and actual RTO/RPO are `UNVERIFIED`, not guessed; optional RLS must be tested with the real non-BYPASSRLS request role and pool connection reuse. A scoped column alone never proves isolation.

## 2A. Foundation-root security policy — CG-01 original owner (FR-001 / CG-01-BR11)

**Ownership and timing:** CG-01/US-001 must establish safe non-disableable built-in auth/session/MFA defaults at bootstrap; **CG-01 US-004** adds authorized versioned customization after real roles and account assignment are delivered. This is a CG-01 capability, not a CG-21 settings row, not a CG-03 approval case, and not dependent on a later module, backup service or notification provider. Actual login/session/MFA enforcement remains in the existing CG-01 authentication service and is exercised by both Web/Android clients.

**Minimal owned schema:** `auth_security_policy(id,access_realm_id,revision,max_session_age_seconds,idle_timeout_seconds,failed_attempt_window_seconds,max_failed_attempts,root_mfa_required,updated_by,updated_at)` with exactly one effective row for the existing real Foundation-root `access_realm` (UNIQUE(access_realm_id), FK to that real realm, row-local CHECK for positive configured bounds and root_mfa_required = TRUE). `auth_security_policy_revision(id,policy_id,revision,safe_previous_values,safe_effective_values,actor_ref,changed_at,correlation_ref)` is append-only with UNIQUE(policy_id,revision). No password verifier/OTP/token in revisions, audit, UI or API response. Implement a safe allow-listed server validation for bounds (concrete numeric ranges configured/reviewed by security policy, not user-provided arbitrarily); missing optional custom row uses secure CG-01 bootstrap defaults, never disabling MFA, extending sessions indefinitely or permitting unlimited attempts. Keep only these security settings here—CG-21's operational settings are separate.

**Typed protected API:** `GET /api/identity/security-policy` returns only safe effective policy fields, `revision`, capability metadata and supported field descriptions for an authorized root. `PATCH /api/identity/security-policy` accepts allow-listed fields, expectedRevision and idempotencyKey from a **currently active protected Super Admin with fresh validated MFA**, under a non-assignable protected capability `identity.security-policy.manage`; any other account or stale/revoked session is denied at the backend (regardless of hidden navigation). Never expose password verifier, challenge secret or raw session token. `identity.security-policy.view` is permissioned; privileged root remains the only policy editor. A direct role copy cannot grant this protected permission.

**Atomicity and effect:** Short CG-01 transaction locks the real access realm / policy, confirms active last-root/MFA protections and expected revision, enforces non-disableable root MFA and bounded positive expiry/rate-limit thresholds, updates policy+one immutable revision+**original CG-01 access_audit** and bumps a safe realm security policy version (or equivalent server-readable effective-policy cache epoch). Reject stale update with CONFLICT and actual safe current version. Policy changes that tighten session rules or revoke risky sessions must invalidate affected existing sessions (server-side version check / TTL / access_version) without relying on push; do not silently break an unrelated account mid-write or claim globally atomic network invalidation. All newly created sessions and MFA challenges use the effective policy at creation; existing sessions are rechecked on protected requests against current maximum/idle/revocation floor and version, not trusted client timers. Consistent durable retry identity handles a lost response without repeating the effect. No network/provider calls under row locks; no recurring per-account/tenant policy poll.

**Web / native contract:** Reuse Admin U02–U10/B34 shell and current original CareGanga tokens. Foundation Admin **Security Policy** is a protected settings subview for CG-01, with current effective values, clear units/explanations, save confirmation, MFA reauthentication, optimistic conflict and last-updated status. Authorized Internal Android exposes the same genuine policy view/edit through native fields/Back/keyboard and one typed API. Public Android and Public Web **enforce** sessions but never expose this administrator screen. No fictitious CG-21 policy toggle, duplicate auth realm, generic settings builder or offline edit queue.

**Independent QA & CRITICAL review:** Perform source tracing for CG-01 US-004-QA01–QA08: authorized update and readback, privileged non-disableable MFA, revoked/stale role and deep-link denial, concurrent revision and lost response, existing/new session enforcement across Web/Internal/Public Android, bounded password-failure rate-limit, migration/rollback and existing access-audit, original token-responsive UI and zero-job worker cost. Do not claim actual DB migration, rendered UI or device QA PASS until independently executed. The CG-01 module passes without CG-21 being present.

## 2B. Protected original access-audit read contract (CG-01 source owner)

**Owned now by CG-01:** CG-01's append-only `access_audit` remains the only source of truth for login/session, protected role/grant/assignment/security-policy and current privileged security actions. CG-01 must expose one **typed, authorized, bounded read facade** before its own module is considered delivered; a future CG-21 central audit cannot invent an undocumented reader, copy raw CG-01 rows or import the CG-01 repository. The CG-01 role/account Admin screens use the same reader for permitted own security history, so this capability is independently testable without CG-21.

**Read API / facade:** `listAccessAudit({actorContext,realmRef,action?,targetRef?,from?,to?,cursor?,limit?})` returns a redacted allow-listed `{eventRef,occurredAt,actorDisplay,actionLabel,targetDisplay,outcome,source:"CG-01"}` plus an opaque continuation cursor and `coverage:"COMPLETE"` for successfully queried local data. The caller provides a verified current CG-01 authenticated context, not arbitrary authority/scope; backend enforces a distinct `identity.audit.view` or more restrictive protected root privilege for each event's real realm and read permission, separately gates protected export/entry detail, and caps `limit` and time ranges. Sorting is stable `(occurred_at,id)`; indexed scoped filters, no unbounded scans, no raw password/MFA/token/contact/PII, no SQL IDs exposed. Actor/target display is sanitized and never a blanket right to read full account/person records.

**Later consumer (not predecessor):** CG-21 (when delivered) calls this stable read facade to compose its own central read-only view; **CG-01 works, can show permitted security history, and is QA-closed before CG-21 exists**. CG-01 owns scope/redaction/permission regression; CG-21 later owns merge pagination and partial-feed UI only. Audit writes remain transactionally coupled to CG-01 protected changes and never move into CG-21.

## 3. Capability and authorization contract

A maintained allow-listed capability registry returns `key, businessLabel, group, assignable, sensitive` for **implemented/approved** actions. Initial CG-01 actions cover account viewing/managing, roles/view/manage/assign and audit access. New owner modules register their real actions **only when introduced**; existing custom roles acquire no automatic new grants.

Authorization order:
1. Authenticate active account and live unrevoked session.
2. Resolve effective active assigned roles and current grant revision from authoritative server state.
3. Validate requested action, actual resource owner, active authorized scope and purpose restrictions.
4. Apply bounded owner-scoped query/filter to list, detail, selector, export and mutation; deny otherwise.
5. Write privileged audit for allowed mutations/denied security-significant operations; do not log secrets.

**Foundation-root** grants only CG-01/root operations currently defined. Never interpret root as wildcard to future Foundation branches, provider centers or patient records. A linked public/member/employee/patient identity never inherits another relationship's rights. Future clinical read additionally requires genuine CG-15/16 treatment/purpose authorization.

**BrickOps master source lesson (comparison, not implementation dependency):** `backend/src/modules/rbac/middleware/permission-catalog.ts` defines allow-listed capabilities; `permission.middleware.ts` protects direct APIs; `backend/tests/integration/permission-driven-ui-runtime.integration.test.ts` covers cross-client permissions. Its safe `customers.select` and `cashiers.options` grants show why permission to select a necessary business record must be separate from permission to view private full details/financial balances. CareGanga follows that principle for current account/role options and later source-owned branch, center, cashier or finance selectors. UI hiding does not confer backend rights; a permitted task must not fail because its essential eligible selector is invisible.

**Safe selectors:** CG-01 may return minimal eligible account/role `{value, label, context}` projections (opaque IDs transmitted, names displayed) with paging/search and an explicit limited selection capability. A feature requiring finance accounts, employees, branches, providers or doctors consumes that **later owner's** authorized options projection; selection does not imply confidential detail/ledger visibility.

### Design delta — 2026-11-16 mobile/email + password, without TOTP (source approval requires refresh)

- **Account additive migration:** `account.normalized_mobile` unique, non-null for newly created users, allow `account.normalized_email` nullable (unique for non-null), never rewrite old migration hashes. Existing password credential/account/role references remain stable; backfill legacy accounts with controlled operator re-enrollment rather than fabricated mobile data. No existing account should be stranded or automatically elevated. Distinct identifiers cannot be ambiguous across channels.
- **Register:** **NO public registration endpoint**; protected initial root script is operator-only. Admin-only `POST /api/access/accounts` with `{displayName,mobile,password,email?,roleRef,requestKey}` verifies current session plus `accounts.invite` and `roles.assign`; in one transaction creates one ACTIVE account/credential/eligible real role assignment/immutable audit, handles concurrent duplicates/idempotency. Password never returned, emailed or logged. No SMS/email/TOTP activation. Root privileges restricted to the operator-first account or guarded owner-defined role operations; protected root bootstrap never exposed on HTTP. No TOTP secret or verified-contact timestamps set from registration.
- **Sign in:** `POST /api/identity/login` `{identifier,password,deviceLabel?}` on all real Web/Android entry points, neutral failure, lockout/throttle, active account, current account/session/role version checks. No TOTP or mandatory verified-email predicate; credential hash recheck while holding transaction locks to close concurrent password reset races. `mfa_verified_at` is **not** set as synthetic proof; migrate session predicates and actor-projection assurance explicitly.
- **Recovery:** `POST /api/identity/recovery/request` `{identifier,channel?,requestKey}` with an email or SMS provider adapter, random six-digit one-use OTP, HMAC digest keyed by server secret, maximum 10-minute expiry, bounded attempts/resend, rate limiting, neutral response; submit to stored contact only, ensure accepted provider result or true unavailable. `POST /confirm` `{identifier,otp,newPassword}` consumes challenge atomically, rotates hash and account credential version and revokes other sessions; recovery blocked for changed/reassigned-contact risk with reviewed root controls. Provider secrets never enter clients/logs.
- **Signed-in password change:** `POST /api/identity/password/change` `{currentPassword,newPassword}` with current authenticated actor, source verification, short lock, version bump, previous-session revocation, redacted audit.
- **Sensitive operations:** introduce **operation-bound reauthentication** via current-password proof verified at commit/transaction time, and keep protected CG-03 distinct reviewer, CG-21 separate recovery authorizer, last-root/owner-reference/version checks. Replace old required `totp`/fresh-mfa proof on actual owners, contracts, migrations and UIs; do **not** mark old `fresh_mfa_verified_at` as true for password-only login. The reduced assurance is an explicit qualified security-review item.
- **Visual:** original user-provided CareGanga Admin `/login` screenshot (navy page, logo badge, lock icon, white rounded card, label with leading icon, password reveal eye, Remember Me, Forgot Password, blue→green SIGN IN, secure-access block, footer). Original screenshot audit U02–U04 owns Admin Add Staff drawer. Public page and Public Android self-registration style is adapted brand language, not falsely claimed original screenshot exactness.
- **QA:** targeted source review of each dependent owner, local PostgreSQL 17 fresh/upgrade migration + concurrency, Web/Public Android/Internal Android real runtime, fake/blocked provider, OTP expiry/guess/replay, session kill, Admin authorization and original screenshot comparisons. Source-only evidence is not a live PASS.

## 4. Permission catalog, typed business APIs and client state

**Initial allow-listed capability set (stable internal keys):** `accounts.view`, `accounts.select`, `accounts.invite`, `accounts.status.manage`, `roles.view`, `roles.select`, `roles.manage`, `roles.assign`, `access.audit.view`. Only the actions actually implemented in CG-01 are active. The built-in protected Super Admin/root authority cannot be granted to a custom role or copied into it. The permission matrix groups user-friendly business labels (e.g., “Invite staff accounts”, “Edit roles”, “Assign roles”, “View access history”). Later CG-02/09/14/etc. register their own **approved** keys when those real modules ship; existing custom roles remain default-denied for newly added actions. A displayed disabled group is not proof that backend grants exist.

**Authentication/context:** A verified account can be an internal, public or later center participant but never inherits staff/clinical role merely from sign-in. Every private request is bound to current session, account lifecycle, access_version and verified `access_realm`; the server validates action + context + ownership. A role/selector ID supplied by client is a selector, not authority. Public sign-in endpoints are throttled and neutral to account-existence probing; MFA is mandatory before privileged session activation. The backend handles distinct public/admin credentials/contexts correctly without sharing protected caches.

| Final CG-01 contract | Input / guard | Transaction/response and UI |
| --- | --- | --- |
| `POST /auth/sign-in` (public-anonymous) | Validated identifier + credential or provider exchange, anti-enumeration throttling, explicit channel; no client role choice trusted | Returns verified auth challenge/MFA-required or established session, never a staff role before verified privileged MFA; failure neutral to account existence |
| `POST /auth/mfa/verify`, `POST /auth/recovery/request`, `POST /auth/recovery/confirm` (public-anonymous with scoped expiring proof) | Typed challenge/request ref and code/proof, max attempts, hash verification, time/rate limits, one-use consumption | Authenticate/restore only on verified challenge; expired, wrong and provider-pending have separate safe states, no leaked OTP |
| `POST /auth/sign-out`, `GET /me`, `GET /access/effective` (authenticated) | Current active session and access_version checked against DB | Revoke/rotate actual session; safe minimal account display, real current role and permission **business labels**; no raw token/secret in UI |
| `GET /access/accounts`, `GET /access/roles` (scoped staff private) | `accounts.view` / `roles.view`; approved filters, capped page/continuation and stable sort | Actual names/status/counts within permitted Foundation-root scope; restricted audit/private credentials excluded. Future HR/geography filters are absent until real owner exists |
| `GET /access/accounts/options`, `GET /access/roles/options` (scoped staff private) | `accounts.select` / `roles.select` or a specifically defined required permitted management flow, current actor and eligible target | Small `{value,label,context}` options only; invisible opaque value, readable name/context, no salary/bank/clinical/full master rights |
| `POST /access/invitations` (staff private) | `accounts.invite`; `display_name`, verified work-contact intent, optional *eligible* current role ref, action `idempotency_key`; validate contact and rate limit | Single INVITED/VERIFICATION_PENDING account/challenge, honest pending provider delivery. No user-entered temporary password. Duplicate/replay returns existing appropriate safe status |
| `PATCH /access/accounts/:accountRef/status` (staff private) | `accounts.status.manage`; real target, status intent, expected revision and request key; protect last root | Atomic suspend/reactivate/deactivate + session access_version + business audit; wrong scope/protected admin/foreign ref denied |
| `POST /access/roles`, `PATCH /access/roles/:roleRef`, `POST /access/roles/:roleRef/copy`, `POST /access/roles/:roleRef/retire` (staff private) | `roles.manage`; validated name/description/color, `selected_action_keys[]` from implemented assignable catalog, copy-source ref where relevant, `expected_revision` for edits, idempotent request key for irreversible action | Unique normalized role; copy allowed grant choices only, never users/role scope/root. Atomic revision + role grant set + audit; protected role and unknown key rejected. Retiring assigned role needs explicit valid reassignment/revocation |
| `PUT /access/accounts/:accountRef/role`, `DELETE /access/accounts/:accountRef/role` (staff private) | `roles.assign`; eligible active account/role, real Foundation-root, `expected_revision`, optional safe reason/idempotency; verify self-escalation/last-root restrictions | Exactly one active role in current realm. Direct ordinary assignment is complete in CG-01. **Direct assignment of a non-root custom role containing `roles.manage` is approval-required and rejected until a real CG-03 case/finalizer is delivered**. No root-role or `identity.security-policy.manage` assignment ever. Atomic permitted assignment + access_version bump + original audit; no CG-03 pending source table in CG-01 bootstrap |
| `GET /access/audit` (privileged) | `access.audit.view`; scoped filter/time window, capped pages and safe authorization | Business-safe actor/target/status/time summaries only; private technical diagnostic logs are **not** exposed |

**Typed boundary envelope:** for each endpoint, `{outcome, data?, field_errors?, support_reference?}`, where `outcome` is a stable sanitized domain category and `data` is an authorized minimum-field projection. The HTTP adapter maps appropriate transport status; user-visible components always translate through the controlled message catalog, never display raw `outcome` keys or HTTP numbers. Expected `VALIDATION`, `DUPLICATE`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `PENDING`, `UNAVAILABLE` and `UNKNOWN_WRITE_STATUS` cases are distinct; an unexpected exception uses a redacted correlation/support reference.

**Contract decisions:** Names are normalized/case-insensitive for unique roles; colors are from allowed CareGanga design tokens only, not arbitrary user CSS. Invitation contact verification, challenge expiry and MFA have server-approved rules, never client-authored. No synthetic profile, dummy staff count, fabricated branch picker, fabricated delivery or unverified permissions are returned. One current user role per root context reflects the existing Admin's “Current Role”; future scoped contexts require real CG-02/14 owner integration, not speculative placeholder assignments.

### 4A. Complete forgot/reset/change password API, UX and security contract (CG-01 US-001)

- **Forgot Password:** `POST /auth/recovery/request` with typed purpose `PASSWORD_RESET`, eligible previously verified email/mobile identifier and idempotency/request intent; use **one existing `auth_challenge` owner** (`purpose, hashed_secret, expiry, attempt_count, consumed_at, target_account_revision`) and CG-01 configured on-demand authentication delivery adapter. Return a neutral public result for both existing and nonexistent contacts; do not reveal recipient or tenant/account existence. Apply per-account/identifier/network and resend rate limits plus bounded expiry and purpose-specific attempt budget. SSO-only accounts do not get local-password reset tokens.
- **Reset Password:** `POST /auth/recovery/confirm` with `purpose=PASSWORD_RESET`, one-time actual challenge proof and `new_password`; validate current non-suspended eligible account, exact challenge and policy/expiry/retry ceiling. In a short **single account/challenge transaction** compare current credential/challenge revision, hash new password with currently approved slow salted password hashing, atomically consume challenge, replace verifier and credential version, increment access_version, revoke other sessions/refresh secrets and append required redacted `access_audit`. Replayed/stale/expired/wrong proof fails without credential change. Password change never grants authentication before required MFA or disables MFA.
- **Signed-in Change Password:** `POST /auth/password/change` authenticates current session; requires current password or verified provider reauthentication and fresh MFA for protected accounts; validates new policy, rotates password verifier, revokes/rotates old sessions under a consistent documented account policy and returns a confirmed result only after DB commit. Do not allow a supervisor to reset another person's password directly via staff-directory edit.
- **Delivery and failure:** Verified email **or** verified mobile SMS is an available configured *authentication* channel, not a mandatory CG-19 deployment dependency; CG-01 owns challenge purpose, safe delivery attempt/status and resend. Missing or failed configured provider yields truthful `PROVIDER_UNAVAILABLE`/`PENDING_DELIVERY`, not a usable code or fabricated 'sent' confirmation. Keep reset links/tokens out of logs/referrers/caches; use trusted HTTPS origin and narrow link scope. A subsequent CG-19 messaging provider is reusable only via an explicit non-circular typed adapter without moving credential secrets into general CG-19 templates/history or requiring CG-21 setup to start CG-01.
- **QA and UI:** Deliver visible **Forgot password? → verification-code/link → Set new password → return to sign in** for real Foundation Web/Internal Android sign-in and public/center sign-in **only when those owner entry points exist**. Authenticated **Change password** belongs in the current user's Account/Security screen. Test neutral unknown account, verified contact choice, invalid/expired/replayed proof, concurrent confirmation, provider outage, lockout, MFA and multi-device old-session revocation; CG01 US-001 QA15–QA18 supplement existing QA01–14. Actual runtime/OTP/SMS/email/device verification remains NOT_RUN.

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
| CG-03 | Once delivered, introduces the approval-required assignment of an existing **non-root custom role with `roles.manage`** to an eligible actual CG-01 account, after a distinct current protected Super Admin's final approval. CG-01 keeps the `roles.manage` sensitive-assignable policy and denies direct initial assignment of such a role; the protected/root role and `identity.security-policy.manage` remain **non-assignable under any approval**. The later CG-03 integrator extends **CG-01's guarded public finalizer** to validate genuine version-pinned decision, existing account/role, actor privilege, last root and unique source-effect key, then atomically assign once, bump access version and write original CG-01 audit. No CG-01 pending-case table or dependency on CG-03 to finish normal CG-01 login/ordinary role assignment | CG-03 Planning/QA |
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
