# CG-01 — UI/UX Contract

**References:** [CG-01 module](module.md) · [DLD](dld.md) · [Tasks / 51 QA](tasks.md) · original [167-screen Admin audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) U01–U10/B34 and owner-supplied original `https://admin.careganga.com/login` screenshots. **Status:** Design specification; rendered Web/native/pixel/motion QA NOT_RUN.

## 1. Visual authority

Match the original CareGanga Foundation identity, not another product's theme. Use the authentic Foundation logo, deep navy page/sidebar, white surface/cards, blue-selected navigation, blue-to-green primary submit, shared original rounded inputs, icon family, typography/density and safe status contrast. The 167-image audit establishes the Admin staff/roles screen structure; the two separately supplied original login screenshots establish the Admin sign-in page. Where an exact font/color/animation cannot be validated from the original source files, record visual evidence pending rather than claiming a match.

All actual Web, Internal Android and Public Android features use the same brand semantics. Web uses responsive headers, sidebar, accessible cards/tables and right drawers; native screens use appropriate stacks, sheets, Back/navigation, keyboards, focus, touch areas, safe areas and screen-reader labels.

## 2. Login — identical for every account

**Route:** Admin `/admin/login`; other delivered signed-in entry points reuse CG-01's credential contract.

- White brand logo plaque over deep-navy full-page background.
- Centered white rounded sign-in card with outlined lock, “Sign in to your Account”, compact help copy, labelled **Mobile Number or Email** and **Password**, leading icons, password visibility toggle.
- **Remember Me**, **Forgot Password?**, primary **SIGN IN** action with original blue-to-green treatment, secure-access message and footer.
- Mobile/email and password are the only login fields. Validation must not expose whether an account exists. If the account is inactive, permission-restricted, throttle-limited or server/provider access is unavailable, present a safe human action and never show raw status codes, source paths or user/role IDs.
- On successful authentication, navigate to the true permitted home. Every sidebar item, page action, quick search and contextual control is filtered by the same server-provided effective permissions that backend actions enforce. A successful sign-in does not itself confer special-role access.

## 3. Add New Staff Account — original U02–U04

**Entry:** Foundation Admin → Staff Accounts/Access Management → **Add New Staff Account**. Authorized administrators only. Reproduce U02 directory table/panel and original U03/U04 full-height right drawer including overlay/dismiss, hierarchy, role choices, form separators and Cancel/Create footer. Server authorization determines visible button and offered roles.

**Fields:** **Full name** (required), **Mobile number** (required ten digits, username), **Email (optional)**, **Initial password** (required with show/hide) and **Role** (required from eligible current role options). Role is chosen by the admin, not the new user. Submit creates ACTIVE account immediately, shows a truthful confirmation and refreshes directory; no provider-delivery status or extra activation step appears.

**Directory/detail:** Search by name/mobile/email; filter current status and real role; bounded pagination, accessible no-results/loading/error; permitted account details and audits; suspend/reactivate/deactivate and allowed role changes with revision-safe confirmation. Current protected/root accounts are not changed through the regular staff editor. Permission absence hides controls **and** backend rejects direct URL/API access.

## 4. Forgot Password / Reset Password

**Entry:** **Forgot Password?** from any delivered login. Keep same CareGanga card/field/button vocabulary and native usability.

1. Enter registered **mobile number or email**.
2. Choose **SMS** or **Email** delivery to a previously stored contact. Show neutral wording after request; never display the stored destination, account existence or claim delivery that has not been confirmed.
3. Enter **six-digit OTP** (ten-minute lifetime) and **new password**; confirm new password on client when appropriate. Enforce server-side expiry, wrong attempts, one-use proof, account/rate limits and recent-contact hold.
4. Allow a deliberate **Request another OTP** action after cooldown. If provider is unavailable or outcome unknown, give a safe explanation and next action, not a fabricated success. After confirmed reset return to sign-in; all previous sessions are invalid.

The original login evidence does not contain a reset-screen reference, so style the reset journey using validated CareGanga components and mark exact rendered/reset animation comparisons NOT_RUN until inspected.

## 5. Change Password and security policy

Every signed-in user can open **Account → Change Password** on Admin Web/Internal Android (and a corresponding account route when the Public Android user area is implemented). Enter current password, new password, confirm, optional show/hide; after confirmed change clear current token/cookie and return to sign-in. Current-password errors, throttle, unknown write, network failure and old-session revocation must have truthful messages.

Only authorized protected administrators see **Security Policy**. Show actual bounded maximum session duration, idle timeout, failed-attempt window and limit plus **required current-password confirmation** for protected changes; do not render a switch that would bypass it. Save with expected revision, safe confirmation, success/replay/unknown outcomes and local-vs-stale conflict handling; permissions remain backend-enforced. Adapt the same policy operations natively for Internal Android; Public Android has no admin policy editor.

## 6. Roles and permissions — original U05–U10/B34

Offer real protected and eligible custom role list, create/edit/copy/retire, grouped checkboxes for actual implemented capabilities, readable descriptions and staff-count/assignment only from real data. The role dropdown shows only currently eligible roles. A protected root role is labelled appropriately but not editable via ordinary custom-role editor. A role containing sensitive capabilities follows actual CG-03 review process with distinct actors and fresh current-password confirmation; do not show irreversible success before the owner finalizer confirms.

## 7. UX acceptance matrix

| Journey | Admin Web | Internal Android | Public Android |
| --- | --- | --- | --- |
| Common password sign-in | Actual page | Native screen | Only for genuinely protected public/own-notice area |
| Forgot/reset using stored email or SMS OTP | Actual | Actual | Where an authenticated public area exists |
| Signed-in change password | Actual | Actual | When public account area is delivered |
| Admin Create User, directory, role management | Authorized controls only | Authorized native controls only | Not shown |
| Security-policy editor and protected confirmations | Authorized protected actor only | Authorized protected actor only | Not shown |

Maintain WCAG-oriented labels/contrast, responsive density, keyboard behavior, correct permission-hidden actions, non-disclosing neutral auth messages, no technical IDs or mock user data and the original screenshot matching process. **Source code presence does not establish pixel-motion/device PASS**.
