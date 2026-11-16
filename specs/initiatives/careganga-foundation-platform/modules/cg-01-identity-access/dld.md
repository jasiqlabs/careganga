# CG-01 — Detailed Design (DLD)

**Canonical scope:** [CG-01 module](module.md) · [PRD](../../prd.md) FR-001–003/FR-080 · [HLD](../../hld.md) §5.0A · [UI/UX](uiux.md) · [Tasks / 51 QA](tasks.md). **Deployment model:** Greenfield; schema built fresh against one PostgreSQL database. **Status:** Source design; actual builds, database execution and device/security QA NOT_RUN.

## 1. Application boundaries and start-up

One npm workspace/lockfile with a single NestJS modular-monolith backend, PostgreSQL migrations and transaction pool, Next.js Admin/Public Web, separate Internal/Public Expo Android applications and shared design tokens/contracts. A `DATABASE_MIGRATION_URL` with direct, appropriately restricted permissions is used for local migration/bootstrap. The app uses validated runtime environment keys; no seeded user passwords, public bootstrap route, fake SMS or permanently active test account.

CG-01 starts independently of CG-02/03/19/21 and any later healthcare/finance owner. A globally OFF-by-default typed deployment config may declare `CAREGANGA_ERP_LAB_ENABLED`, `CAREGANGA_ERP_PHARMACY_ENABLED`, `CAREGANGA_ERP_NURSING_ENABLED`, `CAREGANGA_ERP_OT_ENABLED`, but does not instantiate future ERP modules or data masters. Missing essential database/signing keys fail startup closed. No repeated polling or tenant-wide background loop is permitted for zero work.

## 2. PostgreSQL model and indexes

| Table | Data and invariant |
| --- | --- |
| `access_realm` | One protected `FOUNDATION_ROOT` realm; opaque UUID and unique key |
| `account` | UUID, realm FK, full display name, **required normalized_mobile** uniquely indexed (10-digit Indian value), nullable **normalized_email** uniquely indexed case-insensitively, stored contact_phone in +91 format, status ACTIVE/SUSPENDED/DEACTIVATED, access_version and revision; timestamp of recent contact edit |
| `identity_credential` | Account FK unique; non-null salted strong password hash, credential_version, updated_at; no plaintext secret |
| `role`, `role_grant`, `account_role` | Realm/role keys, active/protected flag, allowed capability grants and version; one current assignment per account/realm; protected assignment approval evidence and last-root constraints |
| `auth_session` | Account FK, SHA-256 token digest unique, account access_version, password_authenticated_at, issued/expires/last_seen/revoked, device label; no role authority inferred from the client |
| `auth_challenge` | Account FK, `kind='RECOVERY'`, purpose-bound keyed OTP digest, request idempotency digest, 10-minute expiry, attempts/consumed_at, delivery_channel=email/sms, delivery_status=PENDING/CLAIMED/PROVIDER_ACCEPTED/UNKNOWN/UNAVAILABLE, attempt count and provider timestamp |
| `auth_login_attempt` | HMAC-keyed identifier/network bucket, rolling start and attempt budget; no raw email/mobile/IP |
| `account_command`, `role_command` | Actor/realm/action/requestKey, request digest, confirmed result with unique index for idempotent replay and duplicate denial |
| `auth_security_policy` and revision/command audit | Per-realm bounded maximum session age, idle timeout, failed attempt window/count, **root_password_reauth_required=true**, revision, author, immutable history and idempotency |
| `access_audit` | Actor, target, action, outcome, timestamp, redacted safe context and correlation reference. No password, OTP, token or full raw PII |

Use FK/unique/partial indexes for current role, current session, role grant, challenge expiry and account search. Migrations constitute **one clean initial schema**; no obsolete credential columns, invitation challenge state, verification prompts, or migration dedicated to converting already-delivered accounts. Full actual migrations and restore checks must run against disposable PostgreSQL 17.

## 3. One-time Super Admin bootstrap

Operator invokes a protected script with explicit `--confirm-one-time-root` and secure environment-provided `DATABASE_MIGRATION_URL`, `CAREGANGA_ROOT_NAME`, `CAREGANGA_ROOT_MOBILE`, optional `CAREGANGA_ROOT_EMAIL` and `CAREGANGA_ROOT_PASSWORD`. Password policy is checked and hash computed before transaction. Under a serialized realm lock, refuse any earlier root/account setup; otherwise insert single protected Super Admin role, ACTIVE account/credential, current assignment and immutable bootstrap audit in one commit. No HTTP endpoint or plaintext logs. Test concurrent script execution and repeat-run refusal. Operator must unset setup secrets after use.

## 4. Admin Create User and account lifecycle

**Endpoint:** `POST /api/access/accounts` with `{displayName,mobile,password,email?,roleRef,requestKey}`. Require active bearer session, `accounts.invite` (account-create capability label until the owner catalog is renamed) and `roles.assign`, verify selected eligible current role under transaction lock, protect privileged role/scope, validate name length 2–160, Indian mobile regex, optional normalized email/uniqueness and strong password. Account is immediately ACTIVE. Commit account, credential, role assignment, request ledger and redacted audit atomically. Return opaque accountRef/current revision/status, never original password. Duplicate phone/email returns a safe actionable error; identical idempotent request returns the durable committed outcome. Password should be communicated to the intended user through an authorized private channel, never through an audit or a generated default.

**Directory:** `GET /api/access/accounts` supports bounded search by name/mobile/email, role, status and pagination; `GET /api/access/roles/options` returns only actual eligible roles. Detail/history, role assignment/revocation, suspension and deactivation preserve current roles and revision checks. A protected-root account is not edited through ordinary staff controls. Revocation increments access_version and makes previous sessions unusable. Permission absence hides UI and denies direct calls. Sensitive grants requiring CG-03 approval cannot be bypassed via direct role selection.

## 5. Login/session

`POST /api/identity/login`: accepts `{identifier,password,deviceLabel?}`, normalizes identifier as mobile/email, validates size, applies per-IP/identifier throttles, looks up current eligible account + credential, compares salted password hash with uniform negative behavior, then locks account and checks active status/credential revision/role. Commit revocable session with cryptographically random opaque token whose **digest only** is persisted and a safe audit. Same login path for all roles.

`GET /api/identity/me` and effective-access API resolve current bearer, realm, active role/grants, data scope and session validity on each protected operation. Logout revokes current session. Web uses strict same-site secure HttpOnly cookie; native Android uses OS-protected credential storage and clears it after expiry/revocation. Remember Me affects Web cookie persistence only; it does not extend the server's maximum allowed session duration.

## 6. Forgot Password / Reset Password

`POST /api/identity/recovery/request`: `{identifier,channel:'email'|'sms',requestKey}` and network metadata. Return neutral 202 message whether account is known. Validate eligible active account and a **previously stored** chosen destination; hold recently edited contact. Enforce account/identifier/network cooldown and serialize concurrent issue. Generate 6-digit random OTP and a keyed hash bound to challenge ID/account/purpose. Store only hash and expiry 10 minutes, then one bounded SMTP or SMS provider attempt; accurately record provider accepted/unknown/unavailable. Do not resend an unknown-outcome challenge automatically.

`POST /api/identity/recovery/confirm`: `{identifier,otp,newPassword}`. Rate-limit by account and network before transaction. Lock account and exact newest provider-accepted unconsumed challenge. Check active status, expiry, max 5 wrong attempts and recent contact change. Compare keyed hash constant-time; wrong attempt increments durable counter, correct attempt atomically consumes all current reset challenges, rotates salted credential/password and access revisions, revokes every session and writes a redacted audit. Replay and concurrent confirm cannot reuse code. No provider, admin fallback or support-person override can silently reset credentials.

Configure only the chosen real provider: SMTP host/user/password/from for email; Twilio SMS SID/auth/from for SMS, with proper secrets and trusted network route. Provider delivery is not assumed until it returns acceptance. App UI shows a neutral request state; backend proof is mandatory before claiming reset.

## 7. Authenticated Change Password

`POST /api/identity/password/change` requires an active session and `{currentPassword,newPassword}`. Apply explicit guess budget, verify current password against locked credential, reject identical old/new password, and rotate hash + credential version + account access version + revoke all active sessions + audit in one transaction. Return success only after commit. Web clears secure cookie; Android clears saved bearer and returns to login. No other staff account's password may be altered through Admin account editor.

## 8. Versioned session security and protected actions

CG-01 US-004 owns `GET/PATCH /api/identity/security-policy` for root-only bounded session max-age, idle timeout, failure window/count, expected revision and idempotency. A root update requires true current-password confirmation under the same protected transaction. `root_password_reauth_required` is always true. Each protected downstream action may require its own fresh confirmation and must also enforce current role, scope, proposer/reviewer separation, immutable source case, requested action, version and finalizer integrity. CG-03 owns decisions, CG-21 owns backup operation, CG-19 owns private notice/letters, CG-02 owns branches. Neither password proof alone nor client hiding an action confers permission.

## 9. UI/UX and platform delivery

Admin Web sign-in reproduces the owner-supplied original CareGanga navy background, white wordmark area, lock, white rounded card, field/icon hierarchy, Remember Me, Forgot Password, blue-to-green action, security note and footer. U02–U04 Admin Staff Directory uses original right drawer, role choices from the real eligible role API, full name, mobile, optional email and initial password. Internal Android supplies matching native sign-in, recovery, account/create/roles/policy and Change Password. Public Android reuses shared login for actual protected public-notice account access only; public browsing stays guest-accessible.

Navigation, tooltips, labels and errors are business-readable. Never show technical IDs, mock patients, unauthorized actions or fake provider success. Native keyboards, Back, focus, touch sizes, screen-reader labels, safe-area, empty/error states and accessibility are required.

## 10. Security, reliability and story QA

Mandatory source review: password/common-password policy, user enumeration and rate-limit resistance, unique contacts, admin role escalation, last-root controls, replay/idempotency, concurrent bootstrap/reset/create, session revocation across devices, audit redaction, storage/transport secrets, scope isolation, excessive database queries, idle provider calls, and accurate success/unknown states. All NFR requirements apply without extra infrastructure or workers.

Source delivery follows **Implement → independent Review → Fix → Re-review → story-by-story QA trace** (18 US-001, 11 US-002, 14 US-003, 8 US-004). Actual PostgreSQL migration/restore/concurrency, backend and Web compilation, both native Android builds, provider delivery, manual device flows and original UI screenshot/pixel/motion comparison require local QA and independent specialist evidence. Current execution status: **NOT_RUN**.
