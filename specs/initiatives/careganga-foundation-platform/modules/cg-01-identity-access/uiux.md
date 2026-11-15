# CG-01 — UI/UX: Existing CareGanga Theme, Accounts & Permissions

**Visual baseline:** [167-screenshot Admin Panel audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md), particularly **U02–U10**, **B34**, and the global shell at §2.1. Source archive: `careganga_features_screenshot.zip`.  
**Requirements:** [PRD](../../prd.md) FR-001–003/080 and mandatory **N-13** · [HLD](../../hld.md) mandatory **H-12** · [module.md](module.md) · [dld.md](dld.md).  
**State:** Reference-based source design; original PNG ZIP is **not committed** to this repository. Exact sampled colors, font metrics and rendered pixel-match are **NOT_VERIFIED** in this session.

## 1. Mandatory visual fidelity — no redesign

**Source-design review:** owner-delegated CURRENT_SHA_BOUND design approved; actual original U01–U10/B34 source images reopened from the verified CareGanga reference pack on 15 Nov 2026. Rendered Web/native pixel, precise source color extraction and motion verification remain NOT_RUN / UNVERIFIED.

**Preserve the existing CareGanga Admin Panel visual identity.** Treat the supplied screenshots as the **design baseline** for color theme, typography hierarchy, spacing/density, component shape, icon style, status treatments, layout hierarchy and interaction patterns. No alternative brand colors, new dashboard theme, arbitrary gradients, glassmorphism, new card aesthetic or independent Android palette.

Existing observed design cues:
- **Sidebar:** CareGanga branding; searchable, categorized expandable navigation; **blue selected-item highlight**; account/status section near bottom. Maintain the established background, icons, hover/active colors and scroll behavior.
- **Header:** Current module title/subtitle, global search **over actually delivered CG-01 account/role resources**, real View Site/public-shell route where present, and account menu. The original screenshot's notification/inbox/help affordances are **not rendered as working or disabled controls** until their owning CG-19/help route actually ships. Preserve the CareGanga header geometry/spacing responsively without a fake feature.
- **Workspace:** Existing KPI tile row, search/filter panel, tabbed table/list, compact action toolbar, relevant right-side detail/summary panels and status badges. Preserve the **relative density, border/radius/shadow, type weights and spacing** instead of inventing replacements.
- **Forms:** Use the existing **right-side drawer** style for Add Staff, Create/Edit/Copy Role, and other compact editing tasks; keep established labels, footer actions, field grouping, dropdown and checkbox/toggle style. Modal/wizard styles remain reserved for journeys that already warrant them.
- **Color and typography tokens:** **Extract from the actual original PNGs or approved current design assets during UI implementation**, record the matching reusable UI tokens once, and reuse them in Admin, Center Portal and Android where appropriate. The audit proves the active sidebar color is blue, **not the exact HEX/RGB, font family or radius**. Do **not guess exact values or claim pixel-fidelity from text alone**.
- **Same theme across platforms:** Native Android uses the same approved CareGanga colors, type hierarchy, icon language, surface/border semantics and clear status meanings, adapted to native accessibility, touch and navigation rather than copying a desktop grid pixel-for-pixel.

**Permitted improvements:** simplify overloaded filter grouping, correct insufficient contrast/touch targets, responsive overflow, loading/empty/forbidden/error messages, unsafe default selections and inaccessible controls. **Retain the recognizable existing layout and visual styling.** Any visual change beyond these corrections needs explicit product-design review.

## 2. Exact audit screen-to-design mapping

| Reference | Existing screenshot behavior to preserve | Functional corrections |
| --- | --- | --- |
| **U02 — Users Management** | Header, counters, search/filter toolbar, staff table, action buttons, existing card/table theme | Initially show only real CG-01 account/role/status filters; CG-10/02 adds real employee/area filters later |
| **U03–U04 — Add New Staff Account** | Existing right drawer, name/email/phone, role dropdown, Cancel/Create footer | Secure invitation/recovery (never expose/store temporary plaintext password); only assign eligible roles |
| **U05–U07 — Roles & Permissions** | KPIs, role list, filters/tabs, grouped **View/Add/Edit/Delete/Approve** checkbox matrix, counts, protected-role badges, details/activity | Only real implemented capabilities; backend enforcement; extend other action types when their modules arrive |
| **U08–U09 — Create/Copy Role** | Existing role drawer with name, description, color choice, **Copy Permissions From** or start empty, Cancel/Create | Copy allowed grants only; no people/root/scope copying; clear duplicate/forbidden/revision errors |
| **U10 — Area Level** | Existing area-level selector's look and spacing | Show only real Foundation-root initially; CG-02 later supplies actual permitted state/district/sub-division/block choices |
| **B34 — Role Assignment** | Existing role-assignment summary, staff/role filters, assignment list and action affordances | First release uses CG-01 accounts; CG-10 later adds employee status/linkage; never invent HR records |

These are **reference IDs from the existing uploaded ZIP audit**, not new screen routes or new requirements. Preserve the visible design while meeting approved PRD/HLD behavior.


### 2.1 Audit-derived layout contracts and native equivalents

The full archive is the visual source; the [Admin audit §2.1, §8.1, §8.2, §12.3](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) gives the following **grounded appearance/behavior**, not an excuse to redesign it. The desktop captures do not prove Android component dimensions or motion timing.

| Audited area | Desktop CareGanga Web contract | Internal Android / narrow Web adaptation | Verification and owner boundary |
| --- | --- | --- | --- |
| **Shell U01/§2.1** | Left scrolling brand/sidebar with own menu search, expandable groups and blue selected item; top title/subtitle and independent global search/Ctrl+K hint, notification/inbox, View Site/help, avatar/role identity | Native navigation preserves brand and current role but not desktop sidebar/Ctrl+K; narrow Web uses an accessible collapsible menu while retaining the title and important actions | Sidebar search searches only real accessible navigation; global search only returns real implemented permitted records. CG-19 later introduces the notification/inbox actions and tests their header integration; CG-01 must hide those missing-owner controls and never create a fake inbox or a fabricated global search index |
| **Users U02** | Existing status/count KPI row, account search + scoped filters/actions, compact real accounts table and details | Scrollable search/filter, essential status chips, tappable row → details; secondary filters collapse; no unreadable table shrink | CG-01 has real name/contact/account-status/current-role; employee ID/type, designation, department, probation/resignation and geography only after genuine CG-10/02 integration |
| **Invite U03/U04** | Existing **right-side Add New Staff Account drawer** with name, work email, phone, role picker, Cancel/Create footer | Full-height accessible native form/sheet with keyboard and accessible selection; same grouped labels/feedback/tokens | No temporary plaintext password; choose actual eligible CG-01 role; invitation persisted vs provider-delivery confirmation shown separately |
| **Roles U05/U06/U07** | KPI + filters/tabs, role list and active details, built-in protected badges, permission groups and **View/Add/Edit/Delete/Approve** matrix where implemented | Compact role list → details → permission group toggles; human labels, retained selection and review/save | Only CG-01 implemented capabilities selectable. Each future owner registers its real action catalog; no fictitious finance/clinical grants or working future tabs |
| **Create/Copy U08/U09** | Existing right drawer: role name, description, approved color options, copy-from dropdown or start empty, Cancel/Create | Native form with copy/start-empty, expandable permission groups and save/review step; consistent badges and inline errors | Copy only safe assignable grants, not role owners, protected root authority or future geography scope |
| **Area U10** | Existing area-level control styling in role form | Same semantic one-scope selector while no geography exists | First delivery displays only existing Foundation-root context, not selectable dummy states/districts/blocks. CG-02 later introduces real geography |
| **Role Assignment B34** | Existing counts, employee/role/status filters and assignment table with current-role/assignment-time/action icons | Task-first Account → Role → Review/Confirm and safe recently assigned status; return to previous account context | Initial CG-01 account roles are real; employee-specific filters/counts and departments belong to CG-10 and CG-02. Last Super Admin protected and live revisions enforced |

**Design tokens and components from the initial repo bootstrap:** `packages/design-tokens/src` holds original-approved semantic role of colors (brand, active navigation, surfaces, borders, success/warning/danger/info), fonts and typography hierarchy, spacing, radius, shadow, icons and observed motion, not arbitrary guessed HEX. `apps/web/src/shared` implements a reusable shell, KPI/status cards, table/list, search/filter toolbar, form drawer/dialog, badges, permission matrix and safe notices; `apps/android-internal` consumes the same *semantic values* with native components. Public Android has only its public task-first components and cannot import private Admin feature screens or restricted state. All screens share one human error message contract from CG-01 DLD, not raw server/provider errors. No new design-system document or duplicated per-module CSS source.

**Evidence ledger in current file:** observed: U02–U10, B34, desktop shell §2.1; native equivalence: **design adaptation only (not visually evidenced by audit)**; exact brand token values: **UNVERIFIED** until original images are inspectable; timing/easing: **MOTION_REFERENCE_UNVERIFIED** absent authentic captured motion; runtime comparison: **VISUAL_NOT_RUN**. The original screenshots' sample names/counts/password fields are **not** defaults or proof of working behavior.

## 3. Core CG-01 screens

| Screen | Current business action | Required states |
| --- | --- | --- |
| Sign in & recover | Verified credentials, privileged MFA, secure recovery, sign out | Verification/pending, invalid attempt, expired/revoked, provider unavailable |
| Users Management | Search real accounts by name/contact/role/account status, invite, suspend/reactivate, view assigned role | Loading, confirmed empty, forbidden, unavailable, successful |
| Add Staff Account drawer | Real name/contact, eligible role, Foundation-root context, explicit invite | Required field, duplicate, pending delivery, rollback/unknown outcome |
| Roles & Permissions | Search/filter actual roles, counts, protected status, open matrix, create/edit/copy/retire | No assigned role, protected restrictions, conflict, revoked session |
| Create/Edit/Copy Role drawer | Existing organized fields, role color, copy/start-empty, grouped permissions, review/save | Unsaved draft, duplicate name, unsupported grant, permission denied |
| Role Assignment | Find authorized real account/role by name, assign/change/revoke at Foundation-root | Empty options, no first-role auto-selection, stale grant, concurrency conflict |
| Access History | Authorized list of actor, action, role/account, time and change summary | Restricted, paginated, private fields redacted |

**Shared behavior:** Backend capabilities govern what users can see and do; clients do not issue forbidden background requests. Use the screenshot's existing interface wording and action positions when compatible with the PRD. For every API result show a truthful human-language success/pending/denied/duplicate/conflict/unavailable state—never raw UUID, permission code, SQL or exception.

## CG-01 security-policy editor (transferred from CG-21)

**Owner:** CG-01-BR11 / FR-001 / US-004. The existing Foundation Admin account/role shell (U02–U10/B34) owns the protected **Security Policy** navigation and editor, not the CG-21 general settings page. Preserve CareGanga brand tokens, active sidebar treatment, tab/section hierarchy, right-side detail/edit drawer, readable labels, button placement and accessible status feedback. The original screenshots do **not** verify a dedicated security-policy view; reuse the established Admin component vocabulary instead of claiming pixel-perfect original policy screen.

For eligible current Foundation Super Admin only, show actual policy values and units: session maximum age, idle timeout, failed-attempt window and limit, with privileged MFA shown **required and not disableable**. Editing is a guarded task: read actual effective revision → change permitted fields → explicit confirmation + fresh CG-01 MFA → save once through CG-01 API → backend-confirmed new revision and safe audit. Conflict reload, revoked/MFA-expired, validation, unknown-write/result lookup and policy effect on existing sessions need truthful next-action messages. Prevent accidental loss of form edits on narrow Web; no technical IDs or raw session secrets.

Internal Android implements native read/edit of the same authorized CG-01 policy, preserving brand semantic tokens, touch targets, Back/keyboard, reauthentication and visible policy effects, without a WebView. Public Android and Public Web **enforce** the updated session policy but have no Security Policy administration route. Non-root users never receive this sensitive form in navigation, and direct API/deep links remain backend-denied. This editor has **no CG-21, CG-02, CG-03 or future owner record requirement**; visual/device/motion QA remains NOT_RUN.

## 4. Responsive and native adaptation without theme drift

**Admin Web:** Keep the desktop screenshot's navigation, header, KPI/list/filter/table/drawer hierarchy at desktop widths. On tablet, use the same components/tokens with controlled density and collapsing secondary panels. On narrow phones, preserve theme/icons/labels but collapse the sidebar into accessible navigation, convert overflowing tables into usable row details, and make drawers full-width when needed. Forms must remain usable at 360px and zoom/large type. **Do not replace the whole screen with unrelated decorative cards.**

**Internal Android:** Use the same approved color/typography/icon/status system; implement native flows **Users → Search → Account → Assign role** and **Roles → List → Drawer-equivalent native form → Permission groups → Review/Save**. Respect Android Back, safe-area/keyboard insets, large text, touch targets and focus; clear restricted caches on context/session change. Do not use a WebView or recreate dense desktop checkboxes at unreadable size.

**Public Web/Android and Center Portal:** The established CareGanga brand theme stays consistent, but their content/navigation and confidentiality differ by audience. A center selector does not appear until CG-14 provides **real approved center data**; public visitors never receive internal roles.

### Motion, microinteractions and state styling (mandatory)

Keep the **existing CareGanga** interaction language, not merely its colors. Reuse the single verified motion/interaction token set from project bootstrap for: sidebar submenu expand/collapse and active selection, table search/filter/tab changes, role permission group expansion and checkbox/toggle feedback, Add Staff/Create Role right-drawer entrance/exit/overlay, modal or confirmation display, loading indicators, disabled/pending saves, success/error toasts and focus feedback. Apply consistent animations and disabled/loading behavior across Web and the corresponding native Android flows.

**Evidence boundary:** The audit's U02–U10/B34 still images establish the screens/components and visible states, but **not** transition duration/easing, spring, overshoot or sequencing. An exact motion claim requires matching the original recorded walkthrough/video or otherwise authenticated original motion design, and comparison with a rendered flow. Before that: preserve the appearance and functional transitions, use restrained accessible native behavior where needed, mark timing `MOTION_REFERENCE_UNVERIFIED`, and **never invent a new brand animation**. Respect reduced-motion settings and performance (no animation-induced delayed/false action state).

## 5. Human-readable error and permission interaction contract

The verified CareGanga palette, type hierarchy, icon/badge and original form/drawer motion apply equally to positive, denied, loading, pending, duplicate, stale and unexpected outcomes. A spinner or green toast **never** implies a persisted privilege change. Important confirmations remain visible in the role/account detail and access history, not only a disappearing toast.

| Screen/state | User-facing text and accessible next action |
| --- | --- |
| Saved role/assigned access | “Role saved.” / “Access updated.” Show actual committed name, scope and change history |
| Invite saved, delivery not verified | “Invitation created. Delivery is being checked.” Show pending label and permitted resend, not “Invitation sent” |
| Unknown account or incorrect sign-in | “We couldn't sign you in. Check your details and try again.” Same text regardless of account existence |
| MFA/recovery code expired | “That code has expired. Request a new code.” |
| Protected role change before CG-03 exists | “This action requires authorized approval and isn't available yet.” No fake pending approval case; never silently grant |
| Forbidden detail/action | “You don't have permission for this action. Contact your administrator.” Do not reveal protected account existence |
| Duplicate role | “A role with this name already exists. Choose another name.” Field-level prompt near role name |
| Stale assignment/role revision | “This was changed elsewhere. Refresh before saving again.” Preserve safe inputs |
| Provider unavailable | “We couldn't send a code right now. Try again later.” Show status, no confirmation of delivery |
| Network loss after write | “We couldn't confirm this change. Check its status before trying again.” Provide refresh rather than blind resubmit |
| Unexpected failure | “Something went wrong. Please try again or contact support with this reference.” Only an opaque safe support reference |

Shared user-language message catalog across public/center sign-in (where actually in use), Foundation Web and native Android; future module copy must inherit categories, never display HTTP/SQL/provider codes or exceptions. Account, role and scoped option selectors show actual names/context, not internal UUIDs or permission keys. On sign-out/revoked session, clear protected cached screens and display login. On screen readers, use persistent accessible field errors, focus, announcement and meaningful action labels.

Technical diagnosis is separate: neither ordinary staff nor patients see developer logs or a general logging UI. An authorized support operator may resolve the optional support reference in restricted diagnostics; no PII, OTP, secret or raw provider payload appears in UI/toasts/notifications. No new CG-01 background-worker dashboard.

## 6. Source QA and fidelity acceptance

- Compare every CG-01 Web screen to **U02–U10/B34** and the Admin global shell: existing colors, typography hierarchy, spacing, card/table/badge treatment, right drawer, filters, action placement and navigation.
- Compare selected real screens to the original ZIP at representative desktop and phone sizes. Record **visual differences and fix unintended theme drift**; accessibility/responsive adaptations are allowed only with documented reasons.
- Check all UI states and permissions against **US-001/002/003 QA cases** in [tasks.md](tasks.md). Test no broken/fake future selectors, silent privileged defaults or raw technical errors.
- During Development: review actual theme token/component source and responsive/native branches manually; **VISUAL_NOT_RUN** until separate authorized browser/device QA. An audit description alone cannot establish precise screenshot color values.
- Before claiming a **VISUAL PASS**, access the actual original PNGs and visually compare representative screen renders. If the ZIP is unavailable, report **REFERENCE_IMAGES_UNAVAILABLE** for exact-color/pixel verification instead of inventing token values.

**No second visual specification or independent theme tracker.** This file is the single CG-01 design reference; the project-wide screenshot audit is the visual source for later module UI/UX files too.