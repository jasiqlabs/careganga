# CareGanga — ALL modules integrated in `main`: CG-01 Web + internal Android UI/UX parity
**As of:** 20 November 2026 · **Repository:** `jasiqlabs/careganga` · **Reference branch:** `main` at `c73b43a3` · **Work branch:** `feature/careganga-cg14-healthcare-network-dev-20261118`

## Decision and scope
**SOURCE_IMPLEMENTATION_IMPROVED / VISUAL_PARITY_PARTIAL / BUILD_AND_DEVICE_QA_NOT_RUN / DO_NOT_MERGE_TO_MAIN_YET.**

The previous healthcare-focused audit was incomplete for the owner's request. This is the independent **main-integrated module** acceptance map. The latest CG-01 admin identity/access implementation by MD IRFAN in `main` is the shared authenticated Web/Internal Android design authority. Client-owned original Admin screenshots and the module-specific design references still govern workflow anatomy; the public website and Public Android retain their independent client-owned visual contract and must never be given an internal admin sidebar.

**Main baseline:** 28 actual `apps/web/src/app/(admin)/**/page.tsx` routes: 25 protected and three authentication. Business owners in main: CG-01 identity/account/roles/security; CG-02 Foundation/branches; CG-03 Registration & Approval; CG-09 Finance; CG-18 editable Website CMS; CG-19 case documents; CG-20 Audit; CG-21 communications/notices; plus Support, Settings and Recovery. Other CG-14/15 development screens on this feature branch remain in the separate healthcare reference audit, not falsely attributed to `main`.

## Web: each main-integrated Admin route

| Main route | Owner/reference | Source parity and still-required real QA |
|---|---|---|
| `/admin/login` | CG-01 | Original CG-01 split auth layout retained; keyboard/mobile/error visual QA NOT_RUN |
| `/admin/recovery` | CG-01 | Original CG-01 recovery layout retained; input/OTP/error visual QA NOT_RUN |
| `/admin/password` | CG-01 | Original CG-01 password layout retained; success/validation QA NOT_RUN |
| `/admin` | CG-01 account | CG-01 profile and shell retained; mobile profile QA NOT_RUN |
| `/admin/dashboard` | CG-01 dashboard | Existing source-backed cards and navigation retained; responsive drawer/metric QA NOT_RUN |
| `/admin/accounts` | CG-01 users | MD IRFAN's users/drawer/roles/permissions baseline retained; narrow screen QA NOT_RUN |
| `/admin/roles` | CG-01 roles | MD IRFAN's roles/matrix/wizard baseline retained; matrix/keyboard QA NOT_RUN |
| `/admin/security-policy` | CG-01 security | Original secure CG-01 forms/role gates retained; runtime QA NOT_RUN |
| `/admin/foundation` | CG-02 | Shared cards/tabs/KPIs/loading; original section/form structure preserved; rendered QA NOT_RUN |
| `/admin/foundation/branches` | CG-02 | Draft + operating branches; loading/empty states and native control styles aligned; 7-stage form QA NOT_RUN |
| `/admin/approvals` | CG-03 | Real approval status, loading and empty/history states styled; review drawer/permissions QA NOT_RUN |
| `/admin/finance` | CG-09 | Existing source-backed accounts KPIs/tabs; shared CG-01 card styles; rendered QA NOT_RUN |
| `/admin/finance/vouchers` | CG-09 | Main title promoted to `h1`, real dashboard moved below title, loading panel aligned; financial QA NOT_RUN |
| `/admin/finance/voucher-approvals` | CG-09 | `h1`, real loading panel and review states; runtime reviewer QA NOT_RUN |
| `/admin/finance/claims` | CG-09 | `h1`, existing claims source/loading styling; responsive form QA NOT_RUN |
| `/admin/finance/claim-reviews` | CG-09 | `h1`, loading card, reviewer workflow preserved; QA NOT_RUN |
| `/admin/finance/invoices` | CG-09 | `h1`, existing real financial summary/counterparty form preserved; QA NOT_RUN |
| `/admin/finance/invoice-reviews` | CG-09 | `h1`, independent review actions unchanged; QA NOT_RUN |
| `/admin/finance/budgets` | CG-09 | `h1`, source-backed budgets/ceiling cards intact; QA NOT_RUN |
| `/admin/finance/budget-reviews` | CG-09 | `h1`, reviewer source unchanged; QA NOT_RUN |
| `/admin/finance/reports` | CG-09 | `h1`, responsive report headers and active view styles; long ledger QA NOT_RUN |
| `/admin/website` | CG-18 CMS | Original CMS primary **New page** and source-only summaries retained, nested editorial **New editorial page** now primary; drawer/preview/publication QA NOT_RUN |
| `/admin/documents` | CG-19 | Source-backed protected files and empty state styled; download/revoke QA NOT_RUN |
| `/admin/communications` | CG-21 | Existing notices/inbox source badges/loading/empty treatment retained; mobile notification QA NOT_RUN |
| `/admin/support` | Support | Real contact messages and replies, empty states aligned; narrow drawer QA NOT_RUN |
| `/admin/audit` | CG-20 | Verified-page table loading, empty/partial notices and detail status aligned; export/permissions QA NOT_RUN |
| `/admin/settings` | Platform config | Protected settings/integration reference loading and empty states aligned; QA NOT_RUN |
| `/admin/backup-recovery` | Recovery | Protected actual readiness/history loading and empty states aligned; QA NOT_RUN |

## Internal Android main-integrated modules

| App source owner | Current source alignment | Real testing still required |
|---|---|---|
| CG-01 auth/accounts/roles/security/dashboard | Latest CG-01 authenticated shell/header/drawer/bottom navigation and role screens preserved | Emulator/physical Android, font scaling, TalkBack, rotation, role switching |
| CG-02 branch drafts | Existing one-safe-area layout, card radius; 48dp buttons, 96dp inner scroll clearance | Seven-stage progress, keyboard/IME and last action |
| CG-03 reviews | Existing CG-01-native card and shell styling retained | Reviewer actions, source permission gating, dialogs |
| CG-09 finance | Existing native shared primitives now have 48dp field controls, compact options, correct selection background and card elevation | Each native Finance screen: vouchers, invoices, claims, budgets, reports, back/IME and protected reviewer |
| CG-19 documents | Existing CG-01 shell/card and safe-area source guard retained | Private attachment preview/download, role and consent |
| CG-21 communications/notices | Native notification cards, selected item corners, 96dp scroll clearance; notice cards from prior pass | Inbox filters, read/unread, long body, keyboard |
| Support | Existing 14dp card corners and updated bottom scroll clearance | Long messages, reply composer and small-device focus |

## Exact changes made on the current feature branch
- Main-integrated Foundation/branches, CG-03, documents, support, audit, settings, recovery, CMS: source-backed loading/empty treatments only, preserved existing text/permissions/data/handlers.
- CG-09: nine standalone workspace titles are now semantic `h1`, real Finance voucher dashboard follows the heading, applicable loading states use shared CG-01 treatment, finance cards/tables/filters and selection styles use current admin palette.
- CG-18 CMS: actual **New editorial page** action receives primary hierarchy. Public CMS rendering and client site content remain unchanged.
- Internal Android: native Finance field sizes and selected surfaces now share semantic CG-01 tokens; existing branch, notification and support views use appropriate scroll clearance under bottom navigation; existing app shell and business workflows are unchanged.
- Main-only page parity adds no new scenarios, hardcoded business data, backend endpoints, SQL migrations, RBAC privileges, or integration changes.
- Local lexical script `npm run verify:cg01-uiux-source` contains checks for **all 28 existing main Admin routes** plus source markers and native styling. This script **was authored, not executed**.

## Explicit unresolved acceptance gates
1. **Web:** run `npm ci`, `npm run verify:cg01-uiux-source`, `npm run verify:core-source`, and `npm run build -w apps/web`. Source marker checks are not pixel accuracy tests.
2. Compare actual rendered `1440 / 1024 / 768 / 390 / 320px` screenshots, header/sidebar, title/CTA/KPI order, filters, table overflow, real loading/empty/error/success, keyboard, focus, reduced motion, permissions and drawer state against Irfan CG-01 reference on **every main route**. Capture defects/fixes individually.
3. **Android:** run actual TypeScript/Expo and devices for each installed main-integrated business module: small/large devices, orientation, font scale, safe areas/IME, bottom navigation, drawer/back and TalkBack. Verify no false success or unconfirmed writes.
4. **Client visuals:** use original Foundation Admin audit for shared visual identity. CG-18 public pages retain separate client-owned website/screenshots; CG-14/15 H07/H15 original reference images remain independently required. No fictional pixel or motion proof.
5. Preserve **original feature QA outcomes** and run end-to-end business/security/database regression locally before sign-off. Do not merge to `main` on source evidence alone.

**State:** Source parity **PARTIAL**, all live visual/functional gates **NOT_RUN**. This report is not an independent live QA signoff or developer build pass.

## Final expanded internal Android source pass — 20 November 2026

The additional independent source review identified remaining native presentation drift in CG-03 approvals, CG-19 private files, CG-09 Finance accounts/claims/vouchers/reviews, CG-21 notice administration and Support. These owning screens now use 48dp-standard touch controls (where an existing control was shorter), shared 12dp interactive corners, current CG-01 navy/blue/white semantic colors, and **96dp extra scroll clearance** for existing authenticated bottom navigation. Native Finance selected states use `careGangaTheme.selectedSurface`; the shared finance source kit has 48dp fields and 96dp inner scroll clearance. Existing 14dp native card surfaces, role-protected actions and all business handlers remain.

**Source readback of these 15 explicitly listed native owner screens:** each retains left/right-only safe-area edges and current CG-01 admin canvas or its shared Finance source kit. The 10 independently styled scroll screens checked have `paddingBottom:96`; the other four Finance screens use the shared source kit and voucher-only is a small wrapper. **These checks do not prove a physical device's bottom-nav/keyboard interaction.** No code was added to CG-01 core login, roles, or dashboard screen components; original CG-01 look/feel remains the reference.

### Actual main-owned native screen-by-screen source inventory
| Owner | Code location | Outcome |
|---|---|---|
| CG-03 approval | `apps/android-internal/src/features/registration-approvals/proposal-screen.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-19 documents | `apps/android-internal/src/features/documents/private-case-evidence-screen.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 accounts | `apps/android-internal/src/features/finance-accounting/finance-accounts-screen.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 expense claims | `apps/android-internal/src/features/finance-accounting/finance-expense-claims-screen.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 voucher draft | `apps/android-internal/src/features/finance-accounting/finance-voucher-draft-screen.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 voucher entry | `apps/android-internal/src/features/finance-accounting/finance-voucher-only-screen.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 voucher review | `apps/android-internal/src/features/finance-accounting/finance-voucher-native-reviewer.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 claim review | `apps/android-internal/src/features/finance-accounting/finance-claim-native-reviewer.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 invoices | `apps/android-internal/src/features/finance-accounting/finance-native-invoices.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 budgets | `apps/android-internal/src/features/finance-accounting/finance-native-budgets.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 ledger/reports | `apps/android-internal/src/features/finance-accounting/finance-native-reports.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-09 protected reviewer | `apps/android-internal/src/features/finance-accounting/finance-native-protected-review.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-21 notices | `apps/android-internal/src/features/communications/foundation-notice-admin-screen.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| CG-21 notifications | `apps/android-internal/src/features/communications/notifications-screen.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |
| Support | `apps/android-internal/src/features/support/foundation-support-screen.tsx` | Authenticated CG-01 shell and one safe-area source; native visual/device pass **NOT_RUN** |

**Main-branch nuance:** `main` had the CG-01 native authenticated dashboard shell but did not directly wrap all nested business screens with `AuthenticatedAppShell`; the authorized development feature branch already added the main business screen `renderInShell` integration before this pass. Do not infer that a protected module screen visually matched CG-01 in `main` just because the dashboard did.

**Not implemented as native admin screens in this `main` baseline:** separate CG-18 CMS editor, CG-20 Audit Logs, and Platform Settings/Recovery editors. Keep them Web-only rather than fabricate Android screenshots or claim mobile screen QA. The separate **public Android** app must follow the client-owned public website design, not the private CG-01 Admin skin.

**Source follow-up commits:** `acfcd553` and `49bcc108` implement the additional screen-level native style corrections. The real QA decision is unchanged: `SOURCE_UI_ALIGNMENT_PARTIAL`, `MAIN_MERGE_HOLD` until Web/Android builds and rendered visual comparison execute.
