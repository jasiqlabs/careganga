# CG-01 — UI/UX: Existing CareGanga Theme, Accounts & Permissions

**Visual baseline:** [167-screenshot Admin Panel audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md), particularly **U02–U10**, **B34**, and the global shell at §2.1. Source archive: `careganga_features_screenshot.zip`.  
**Requirements:** [PRD](../../prd.md) FR-001–003/080 and mandatory **N-13** · [HLD](../../hld.md) mandatory **H-12** · [module.md](module.md) · [dld.md](dld.md).  
**State:** Reference-based source design; original PNG ZIP is **not committed** to this repository. Exact sampled colors, font metrics and rendered pixel-match are **NOT_VERIFIED** in this session.

## 1. Mandatory visual fidelity — no redesign

**Preserve the existing CareGanga Admin Panel visual identity.** Treat the supplied screenshots as the **design baseline** for color theme, typography hierarchy, spacing/density, component shape, icon style, status treatments, layout hierarchy and interaction patterns. No alternative brand colors, new dashboard theme, arbitrary gradients, glassmorphism, new card aesthetic or independent Android palette.

Existing observed design cues:
- **Sidebar:** CareGanga branding; searchable, categorized expandable navigation; **blue selected-item highlight**; account/status section near bottom. Maintain the established background, icons, hover/active colors and scroll behavior.
- **Header:** Current module title/subtitle, global search, notification/message controls, View Site/help, avatar/account menu. Preserve the existing header geometry and hierarchy.
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

## 4. Responsive and native adaptation without theme drift

**Admin Web:** Keep the desktop screenshot's navigation, header, KPI/list/filter/table/drawer hierarchy at desktop widths. On tablet, use the same components/tokens with controlled density and collapsing secondary panels. On narrow phones, preserve theme/icons/labels but collapse the sidebar into accessible navigation, convert overflowing tables into usable row details, and make drawers full-width when needed. Forms must remain usable at 360px and zoom/large type. **Do not replace the whole screen with unrelated decorative cards.**

**Internal Android:** Use the same approved color/typography/icon/status system; implement native flows **Users → Search → Account → Assign role** and **Roles → List → Drawer-equivalent native form → Permission groups → Review/Save**. Respect Android Back, safe-area/keyboard insets, large text, touch targets and focus; clear restricted caches on context/session change. Do not use a WebView or recreate dense desktop checkboxes at unreadable size.

**Public Web/Android and Center Portal:** The established CareGanga brand theme stays consistent, but their content/navigation and confidentiality differ by audience. A center selector does not appear until CG-14 provides **real approved center data**; public visitors never receive internal roles.

### Motion, microinteractions and state styling (mandatory)

Keep the **existing CareGanga** interaction language, not merely its colors. Reuse the single verified motion/interaction token set from project bootstrap for: sidebar submenu expand/collapse and active selection, table search/filter/tab changes, role permission group expansion and checkbox/toggle feedback, Add Staff/Create Role right-drawer entrance/exit/overlay, modal or confirmation display, loading indicators, disabled/pending saves, success/error toasts and focus feedback. Apply consistent animations and disabled/loading behavior across Web and the corresponding native Android flows.

**Evidence boundary:** The audit's U02–U10/B34 still images establish the screens/components and visible states, but **not** transition duration/easing, spring, overshoot or sequencing. An exact motion claim requires matching the original recorded walkthrough/video or otherwise authenticated original motion design, and comparison with a rendered flow. Before that: preserve the appearance and functional transitions, use restrained accessible native behavior where needed, mark timing `MOTION_REFERENCE_UNVERIFIED`, and **never invent a new brand animation**. Respect reduced-motion settings and performance (no animation-induced delayed/false action state).

## 5. Source QA and fidelity acceptance

- Compare every CG-01 Web screen to **U02–U10/B34** and the Admin global shell: existing colors, typography hierarchy, spacing, card/table/badge treatment, right drawer, filters, action placement and navigation.
- Compare selected real screens to the original ZIP at representative desktop and phone sizes. Record **visual differences and fix unintended theme drift**; accessibility/responsive adaptations are allowed only with documented reasons.
- Check all UI states and permissions against **US-001/002/003 QA cases** in [tasks.md](tasks.md). Test no broken/fake future selectors, silent privileged defaults or raw technical errors.
- During Development: review actual theme token/component source and responsive/native branches manually; **VISUAL_NOT_RUN** until separate authorized browser/device QA. An audit description alone cannot establish precise screenshot color values.
- Before claiming a **VISUAL PASS**, access the actual original PNGs and visually compare representative screen renders. If the ZIP is unavailable, report **REFERENCE_IMAGES_UNAVAILABLE** for exact-color/pixel verification instead of inventing token values.

**No second visual specification or independent theme tracker.** This file is the single CG-01 design reference; the project-wide screenshot audit is the visual source for later module UI/UX files too.