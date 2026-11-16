# CG-01 — Simplified Authentication: Product Owner Change Request (16 November 2026)

**Status:** OWNER_DIRECTED_TARGET_BEHAVIOR · IMPLEMENTATION_NOT_STARTED · NOT_RUNTIME_TESTED  
**Source branch:** `feature/cg01-simple-auth-brickops-style-20261116` (from current CareGanga `main`)  
**Scope:** CG-01 identity/credential/login, all identity entry screens and existing CG-03/CG-19/CG-21/CG-02 consumers of MFA/session proofs. Preserve the five integrated Foundation modules, 14 existing story workstreams and all canonical QA IDs.  
**No CI/GitHub Actions; follow AGENTS.md and `jasiq-dev`.** This change request is **not** a retroactive SHA-bound design approval, code QA result or replacement for the canonical PRD/HLD/DLD/UIUX/tasks.

## Owner decision (this supersedes the earlier complex all-staff authenticator UX)

The **same simple registration, sign-in and recovery-facing UI** must apply across all user types, including ordinary/public users, staff, volunteers, healthcare staff, branch managers, Finance, and Super Admin. **No mobile OTP verification, email verification, authenticator enrollment, six-digit TOTP, or app-based MFA is mandatory for registration or routine login in this phase.** No role-based exception in login. Avoid treating this as an instruction to bypass backend permissions or to let self-registration create a privileged role.

### Registration

- **Minimum visible form:** full name (to display the account), **mobile number**, password, **email (optional)**. The mobile number **is the username**; do not require an additional username field. If product UX retains an optional custom username in the future, it must be unique and cannot impersonate a mobile/email, but it is **not needed now**.
- Mobile validation: normalized Indian 10-digit number (as in BrickOps; if country support is later required, use E.164 in a separate scope). Unique per user in the single Foundation identity realm. Email, when given, is format-validated and unique after normalization, but **not verified** and must not be treated as ownership proof.
- User enters password once plus a show/hide control; a confirmation field may be present only if usability testing finds it necessary. Minimum password length at least eight characters with breached/common password rejection where practical; hash with existing secure credentials, never plaintext.
- Register transaction creates one real account, credential, audit row and safe status, **without** requiring OTP, email service, SMS provider, TOTP secret or future module tables. Handle repeated/double submit, duplicate phone/email, idempotency and concurrency.
- **Self-registration creates a least-privilege account only** with no protected Foundation/branch/finance/clinical permissions. It can sign in to public/own-account features, while a privileged administrator assigns staff roles through existing guarded CG-01/CG-03 flows. Never self-assign role, Foundation-root authority, branch membership, doctor/center privilege or financing access.
- Initial Super Admin/root provisioning remains **operator-controlled**, not public self-registration; after creation, that account uses the **same mobile/password login UI**. Existing protected authority and last-root rules remain enforced.

### Login

- **One field:** `Mobile number or email` (or `Username / mobile / email` only if explicit separate username is implemented later).
- **One field:** `Password`.
- **No authenticator code input, enrollment/setup step, email OTP, mobile OTP or role-picker.** Same two-field form regardless of role in Admin Web, Internal Android, and public sign-in entry points when enabled.
- Backend normalizes and checks mobile/email, verifies password and active account, creates a revocable session and resolves **current** server-side roles/scopes before showing permitted menus. Invalid login returns a neutral failure; throttle credential stuffing and log only redacted events. Session revocation and role edits apply immediately on subsequent protected requests.
- Current code uses `SessionController.signIn` mandatory `totp`, `SessionService.signIn` and `verifySession` mandatory `mfa_verified_at`, `account.email_verified_at`, protected owner facade and numerous approval dependencies. **Do not remove UI fields without rewriting all server assumptions.** Migrate actual identifiers, session assurance and owner proof contracts consistently across CG-01, CG-03, CG-19, CG-21 and CG-02.

### Recovery without verified channels

- Show `Forgot password?` -> enter registered mobile number or email -> **neutral acknowledgement** (`If this account exists, a recovery request has been recorded`).
- **For now do not send an automatically trusted password reset link/OTP to an unverified mobile number or email.** Possession was never proven and SIM/contact may belong to someone else. Follow the BrickOps-style **support/admin-assisted recovery** pattern: authorized Foundation recovery operator validates identity out-of-band, issues a single-use short-lived reset code, and the user enters **mobile/email + reset code + new password**. Neither Authenticator nor verified SMS/email provider is required.
- In secure operator flow, make proof collection and issuance auditable; prevent self-approval, replay, guessable codes, account enumeration and direct account takeover. Recovery must revoke existing sessions and increment credential/account version atomically. Operators cannot read an existing password.
- If no trusted support operator or controlled reset channel exists, display recovery **unavailable/contact support**, not an insecure automatic reset or false success.
- Signed-in `Change password`: **current password + new password**, with permission/session validation; revoke old sessions upon success. No mandatory authenticator code for any role. Sensitive financial/approval actions may use fresh **current-password confirmation** plus separated approver permissions/dual control instead of authenticator codes; do not silently weaken existing CG-03/CG-21/CG-02 controls.

## Verified BrickOps basis (reviewed source, not code to copy)

- `jasiqlabs/brick-ops` `master`: `backend/src/modules/auth/validator/auth.validator.ts` accepts **required mobile/password and optional email** for registration; login accepts `identifier/password`.
- `backend/src/modules/auth/service/auth.service.ts` and `auth.repository.ts`: lookup by **email or mobile**, normal password check, session issuance and subsequent role/tenant checks. No TOTP in ordinary login.
- `frontend/src/app/login/page.tsx`, `mobile/src/modules/auth/LoginScreen.tsx`: mobile/email + password; `frontend/src/app/register/page.tsx`, `mobile/src/modules/auth/RegisterScreen.tsx`: mobile/password, optional email.
- `backend/src/modules/auth/service/password-recovery.service.ts`: support-admin-assisted recovery / temporary reset code; not an automatic trust claim from unverified SMS or email.
- BrickOps has a separate business/tenant registration context. **Do not copy tenant onboarding, payments, plant selection, or autonomous root-role creation** into CareGanga.

## Engineering change map and required workflow

1. Review current `CG-01 BR/PRD/HLD/module.md/uiux.md/dld.md/tasks.md` and every owner that depends on `mfa_verified_at`, `fresh_mfa_verified_at`, verified contacts, token recipient qualification and CG-01 root policy. Reconcile requirements in their **actual owning documents**, including CG-03 approval, CG-21 guarded settings/recovery, CG-19 contact messaging and CG-02 activation. Preserve their existing business outcomes and QA IDs; add only necessary change-specific QA cases. Refresh SHA-bound delegated design approvals only after complete independent design review; do not mislabel as formal Harness resolver PASS.
2. Implement additive, reversible-on-disposable-test DB migrations for normalized `mobile`, optional unique unverified `email`, credential/session changes and existing-account transition; retain exact previous applied migration hashes. Ensure username/mobile uniqueness + non-ambiguous lookup; avoid account collision and unverified-contact role takeover. Protect root bootstrap, old users and already-activated branches.
3. Make actual registration endpoint, typed API contracts, existing anonymous Web and Public Android pages where enabled, and Internal Android staff journey consistent. Current invitation-only path may remain a **nonmandatory operator-managed alternate**, but it must not demand authenticator setup.
4. Remove TOTP from login/recovery/registration UX **and** remove or replace mandatory code assumptions in services/controllers, protected APIs and session/approval evidence; never merely spoof `mfa_verified_at` or insert fake proof timestamps. For high-risk operations retain distinct-authorized approvers and fresh password verification plus existing audit/version controls; document changed security assurance and run qualified review.
5. Execute story-by-story `Implement -> independent source Review -> Fix -> Re-review -> QA source trace -> live QA`; build NestJS, Next.js, Public and Internal Android, execute isolated PostgreSQL migrations/restore/races, test original Admin visual reference and actual live behavior. Test login/registration/recovery for both ordinary and protected users, duplicate identifiers, brute force, session revocation, disabled account, role changes, direct API bypass, approver separation, password reset, unconfigured providers.
6. Update same five Foundation module trackers and the central `FOUNDATION_F0_F5_LOCAL_VALIDATION_HANDOFF.md`. Do not declare full 165-case source/runtime PASS or merge to `main` while old TOTP-specific QA cases have not been formally reconciled and actually re-executed. No CI/GitHub Actions; commit/push on this **feature branch**, independently review, then safely merge after approved gates.

## Explicit release boundary

**New target approved in conversation:** simple uniform mobile/email + password, no contact verification and no authenticator across roles, including Super Admin.  
**Not yet done:** canonical design hash updates, implementation, DB migration, build, runtime/device/visual QA, independent security review or merge to main. Until code is changed, existing CareGanga login still requires email/password/TOTP.
