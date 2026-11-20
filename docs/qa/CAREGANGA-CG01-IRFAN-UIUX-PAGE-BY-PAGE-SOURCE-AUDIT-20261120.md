# CareGanga — CG-01 / MD IRFAN UI/UX page-by-page source audit
**Date:** 20 November 2026 · **Repository:** `jasiqlabs/careganga` · **Branch:** `feature/careganga-cg14-healthcare-network-dev-20261118`

**Decision: SOURCE PRESENTATION PARTIALLY ALIGNED; RENDERED VISUAL ACCEPTANCE HOLD.** This is a real route/component-level source inspection, not a claim of browser screenshot comparison, Android emulator results, mobile accessibility tests or an independent specialist signoff. Preserve the original QA results in the owning module trackers.

## Exact baseline and boundaries
- **CG-01 developer baseline from `main`:** `f1e78ac` (Web security/responsive tokens), `f9bd051` (Web roles/permissions), `c8b2cb1` (Web user management), `477b969` (Android shell/security), `fbe779e` (Android role views); merge `c73b43a3`. These were authored by **MD IRFAN** on 19 Nov 2026 and integrated into this feature branch at `dcd1fe69`.
- **Design authority:** original Admin audit `docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md` §2 and CG-01 `uiux.md`; semantic theme `packages/design-tokens/src/index.ts`. CG-14 UI-07/09/23 and CG-15 H07/H15 are **separate healthcare original screenshot requirements**, not replaceable by a CG-01 role screen.
- **Internal Web/Admin Android** use CG-01 navy header/sidebar, white rounded surfaces, blue selected states, accessible focus/typography/responsive density. **Public Web/Public Android use the client-owned public/CMS visual contract**, not an Admin sidebar or private-role UI. Center Portal has its own authorized center context.
- **Source outcome:** 39 protected/auth/center Web routes inspected; 21 internal Android business entry points plus CG-01 screen examples inspected; representative feature components and their actual class/style signatures reviewed. No fabricated original UI pixels or fake provider source data.

## Review findings and changes already authored
1. **Web shell:** Every one of the 36 protected Admin/Center routes uses `FoundationAdminNav` or `HealthcareAdminShell` and the 3 public Admin auth pages keep their own CG-01 auth layout. Existing server-effective roles seed the permitted sidebar before client revalidation (`ba3fc6da`, `66b9d15f`). The newest mobile/desktop CG-01 sidebar source remains.
2. **Web content mismatch:** Outside CG-01 users/roles/security pages, most feature workspaces still use `role-workspace`, `topbar`, `role-table`, `cg-fin-manual` or `form-section`, rather than Irfan's dedicated page-specific CG-01 composition and skeletons. Some markup is intentionally healthcare/finance-specific; do not replace its forms. **Confirmed styling defects**: `.cg-fin-card`, `.table-wrap`, and `.card` lacked matching admin surface/table definitions. Fix `ed874b14` adds Admin-scoped white cards/table surfaces, responsive headings, focus indicators and mobile toolbars without modifying any business action or public CSS.
3. **Android shell:** The 21 protected business entries already use the CG-01 authenticated header/drawer/bottom-nav (`c3e23fb8`), exclusive module switching, selected More, and clear bottom action space. Direct nested business `SafeAreaView` screens were adding **top/bottom device insets again** despite CG-01 header and bottom nav already consuming them. Fix `ed874b14` updates 20 direct screens to lateral insets only and adopts additive `careGangaTheme.adminCanvas`; finance shared native card/action styling is aligned. **Shared RecipientNotifications** is a non-SafeArea embedded component and was not directly re-themed.
4. **Remaining screen-level differences:** Legacy page bodies still differ in KPI placement, filter/group density, advanced skeletons, inline validation, table-to-card responsive behavior, and consistent form action placement. CG-14 UI-07/09/23 and CG-15 H07/H15 client pixel/motion matching remain **unverified**. Every row below requires real runtime/device review before declaring full look-and-feel parity.
5. **No business change:** unchanged server RBAC, patient permissions/consent, SQL, booking, finance ledgers, approval, source integrations, Public Android and CMS content. Web CSS rules are scoped `.shell > .workspace` to avoid public-site styling.

## Web — all 39 pages checked individually
**Code status:** `BASELINE`=Ir​fan-led CG-01 source pattern; `SHARED-STYLED`=same shell/tokens/common CSS, body remains its own older module UI; `HEALTHCARE-STYLED`=same shell + healthcare page styling; `H07/H15-SPECIAL`=specific approved client-reference anatomy authored, original rendered parity pending; `CENTER-SCOPED`=distinct protected own-center experience. None of these means screenshot PASS.

| Route | Real page/feature component | Source status | Concrete visual QA still required |
|---|---|---|---|
| /admin/login | CG-01 auth layout | BASELINE | Retain split/brand sign-in; verify focus, recovery, sizes |
| /admin/recovery | CG-01 auth/recovery layout | BASELINE | Verify error, loading, OTP and accessible input |
| /admin/password | ChangePasswordForm | BASELINE | Verify authenticated password form and success transition |
| /admin | AdminProfileWorkspace | BASELINE | CG-01 account screen; verify shell and responsive profile |
| /admin/dashboard | Foundation dashboard | BASELINE+NAV | Verify KPI cards and compact-sidebar behavior |
| /admin/accounts | AccountsPanel | BASELINE+NAV | Verify CG-01 drawer, data table, skeleton and status |
| /admin/roles | RolesPanel | BASELINE+NAV | Verify 3-panel/matrix, drawer, role filters and 320px |
| /admin/security-policy | SecurityPolicyPanel | BASELINE+NAV | Verify CG-01 skeleton, cards and permission gate |
| /admin/approvals | ProposalWorkspace | SHARED-STYLED | Legacy list/review body; compare with CG-01 cards/toolbar |
| /admin/audit | PlatformAuditPanel | SHARED-STYLED | Legacy table/detail drawer; compare loading/empty states |
| /admin/backup-recovery | RecoveryPanel | SHARED-STYLED | Verify protected modal/table and action hierarchy |
| /admin/communications | CommunicationsWorkspace | SHARED-STYLED | Verify notice form, inbox detail, responsive table |
| /admin/documents | PrivateCaseEvidencePanel | SHARED-STYLED | Verify private file states, table and permission-specific controls |
| /admin/foundation | FoundationStructurePanel | SHARED-STYLED | Verify 3 tabs and department editor on mobile width |
| /admin/foundation/branches | BranchDraftPanel + OperatingBranchesPanel | SHARED-STYLED | Verify 7-step branch flow, location lists, dialog |
| /admin/finance | FinanceAccountsWorkspace | SHARED-STYLED | Already custom KPIs/tabs; visually check panel density |
| /admin/finance/vouchers | FinanceVoucherDraftWorkspace | SHARED-STYLED | Drawer/journal lines; verify horizontal scroll and sticky actions |
| /admin/finance/voucher-approvals | FinanceVoucherReviewerWorkspace | SHARED-STYLED | Reviewer drawer/read-only details and evidence |
| /admin/finance/claims | FinanceExpenseClaimWorkspace + ClaimManagement | SHARED-STYLED | Claims form/table; verify source-backed summary/empty |
| /admin/finance/claim-reviews | FinanceClaimReviewWorkspace | SHARED-STYLED | Reviewer actions/badges/disabled states |
| /admin/finance/invoices | FinanceInvoiceWorkspace | SHARED-STYLED | Drawer, invoice line items and payment states |
| /admin/finance/invoice-reviews | FinanceInvoiceReviewWorkspace | SHARED-STYLED | Reviewer table/drawer, protected outcomes |
| /admin/finance/budgets | FinanceBudgetWorkspace | SHARED-STYLED | Budget KPIs/forms/tables, narrow viewport overflow |
| /admin/finance/budget-reviews | FinanceBudgetReviewWorkspace | SHARED-STYLED | Budget review drawer, role protection |
| /admin/finance/reports | FinanceReportsWorkspace | SHARED-STYLED | Ledger filters/export/tables; verify dense mobile layout |
| /admin/health-network | ProviderOnboarding | HEALTHCARE-STYLED | Legacy long provider form/table; UI-06/07 client comparison pending |
| /admin/health-network/doctors | DoctorOnboarding | HEALTHCARE-STYLED | Doctor proof/profile/fee; UI-07/09 original review pending |
| /admin/health-network/reviews | HealthReviewInbox | HEALTHCARE-STYLED | Reviewer list/evidence; UI-23 original review pending |
| /admin/health-network/content-reviews | CenterContentReviewInbox + PublisherQueue | HEALTHCARE-STYLED | Scoped common healthcare shell; verify state badges |
| /admin/health-network/erp-grants | CenterErpGrantReviews | HEALTHCARE-STYLED | Approved-only capability review, no fake ERP options |
| /admin/health-network/schedules | DoctorScheduleWorkspace | H07-SPECIAL | Own H07 KPI/roster/calendar layout; original H07 pixel QA pending |
| /admin/health-network/doctor-leaves | DoctorLeaveReviewWorkspace | HEALTHCARE-STYLED | Specialized leave/approval; validate on actual narrow screens |
| /admin/health-network/patient-intake | CenterPatientIntakeWorkspace | HEALTHCARE-STYLED | Identity/consent cards; verify error and review hierarchy |
| /admin/health-network/patients | FoundationPatientBookings | H15-SPECIAL | Own H15 metrics, record/detail; original H15 pixel QA pending |
| /admin/health-network/queue | CenterVisitQueue | HEALTHCARE-STYLED | Previously unstyled card; verify queue row/action density |
| /admin/website | CmsAdminWorkspace + ExtendedWorkspace | SHARED-STYLED | Admin CG-01 shell only; published site must retain original public theme |
| /admin/settings | PlatformSettingsPanel + SafeErrorMessagesEditor | SHARED-STYLED | Settings forms/confirmation; browser visual QA pending |
| /admin/support | FoundationSupportWorkspace | SHARED-STYLED | Support cases/FAQ; verify status and responsive filters |
| /center | CenterDraftPortal | CENTER-SCOPED | Uses healthcare shell but must display own-center context, not Foundation global data |

## Internal Android — all 21 protected business entries checked individually
The CG-01 login, account, users, roles, security and recovery screens are **CG-01 baselines**, not duplicate-wrapped; verify their latest Irfan header/drawer/layout as part of runtime QA. All rows below use `renderInShell` with the CG-01 header, permission-filtered drawer, bottom navigation and exclusive active module. `SHARED-SHELL` **does not** mean each internal form or table already matches Irfan's screen-specific visual hierarchy.

| Navigation key | Actual native screen | Source status | Required runtime/design check |
|---|---|---|---|
| approvals | ProposalScreen | SHARED-SHELL | Legacy review form/cards; role-safe actions |
| healthVisitQueue | NativeCenterVisitQueue | SHARED-SHELL | Queue/filter and status actions, physical scrolling |
| healthPatientBooking | NativeCenterAssistedBooking | SHARED-SHELL | Center/doctor/slot/hold/confirm hierarchy |
| healthDoctorLeave | DoctorLeaveNativeReview | SHARED-SHELL | Leave review and confirmation |
| healthReviews | HealthcareNativeReview | SHARED-SHELL | Provider/doctor verification evidence |
| notifications | NotificationsScreen | SHARED-SHELL | Inbox read/unread, permission and back |
| documents | PrivateCaseEvidenceScreen | SHARED-SHELL | Private file upload/consent/preview |
| financeInvoiceReviews | FinanceNativeProtectedReview (invoice) | SHARED-SHELL | Reviewer forms, source permissions |
| financeBudgetReviews | FinanceNativeProtectedReview (budget) | SHARED-SHELL | Budget reviewer states |
| financeInvoices | FinanceNativeInvoices | SHARED-SHELL | Invoice editor/cards and keyboard scroll |
| financeBudgets | FinanceNativeBudgets | SHARED-SHELL | Budget editor and totals |
| financeReports | FinanceNativeReports | SHARED-SHELL | Dense filters/table/export |
| financeClaimReviews | FinanceClaimNativeReviewer | SHARED-SHELL | Review evidence and recorded outcomes |
| financeClaims | FinanceExpenseClaimsScreen | SHARED-SHELL | Claims form and list |
| financeReviews | FinanceVoucherNativeReviewer | SHARED-SHELL | Voucher reviewer state/actions |
| financeVouchers | FinanceVoucherOnlyScreen / DraftScreen | SHARED-SHELL | Voucher editor safe-area and actions |
| finance | FinanceAccountsScreen | SHARED-SHELL | Accounts/years and status controls |
| branches | BranchRegistrationScreen | SHARED-SHELL | Seven-step editor, keyboard/discard |
| communications | RecipientNotifications (shared native pkg) | SHARED-SHELL | Shared package is not re-themed; separate recipient states |
| noticeAdmin | FoundationNoticeAdminScreen | SHARED-SHELL | Notice compose, send, list |
| support | FoundationSupportScreen | SHARED-SHELL | FAQ/messages and response composer |

## Public Android and public Web — intentionally distinct (not CG-01 Admin skins)
Public Android `apps/android-public/app/index.tsx` and the native CG-18 CMS, CG-14 published center/doctor directory, CG-15 patient profile/history/consultation/documents and support screens use the consumer-facing client/public contract. Public Web `apps/web/src/app/**` (23 non-Admin pages in this checkout) is governed by the original `cg-site.css` / approved public references. No public navbar/brand/CTA was changed in this UI integration. Review public vs original client website separately; never assert these should look like an internal CG-01 role editor.

## Mandatory page-level visual QA before accepting `main` merge
**Browser:** Compare real 1440px, 1024px, 768px, 390px and 320px rendered screenshots with CG-01 current `main` for every Admin route; verify type scales, title/subtitle/KPI hierarchy, button density, table overflow, drawer focus and keyboard, loading/empty/error/success states, selected sidebar, reduced motion and permission-hidden entries. Compare CG-14 UI-07/09/23 and CG-15 H07/H15 against their **own original** client screenshots, not only CG-01.
**Internal Android:** Build and test on actual compact/tall Android/emulator screens, rotation, font scaling, TalkBack, safe-area edges, IME covering last action, touch size, notifications, drawer/More/Back, role-revocation, alerts, scroll and visual record details. The 20 direct native inset changes must be checked for single inset on all devices.
**Data:** No fabricated statuses/KPIs, no raw technical IDs and no cross-role/customer/patient data leak. Verify actual business functions separately in their original QA cases.
**Developer source guard:** after `npm ci`, run `npm run verify:cg01-uiux-source`, then `npm run verify:core-source`, `npm run verify:cg14-source`, `npm run verify:cg15-final-source-gaps`, `npm run build -w apps/backend`, `npm run build -w apps/web`, `npx tsc --noEmit -p apps/android-internal/tsconfig.json` (or exact workspace-compatible equivalent), plus actual Expo runs. **These commands are prescribed, NOT executed by this source reviewer.**

**Gate:** `SOURCE_UI_ALIGNMENT_PARTIAL` / `LIVE_VISUAL_QA_NOT_RUN` / `MAIN_MERGE_HOLD`. No CI/GitHub Actions; no new user stories or QA case statuses were invented.
## Continued owning-module implementation checkpoint — 20 November 2026

**Baseline is CG-01 in the latest \`main\`, not the reverse.** New functionality was not requested; the work adapts existing other-module presentation only. The following changes are present on the healthcare feature branch:

- \`09b7597598e91046722f2f28eb30c1443066933e\`: **CG-18 CMS** title semantics and the real **New page** primary action replace incorrect **Refresh** emphasis; **CG-14 providers/doctors** use responsive header action group; **CG-15 queue** gets a real page heading and accessible loading notice, **CG-15 patient details** uses the shared admin card rather than a one-off inline border. Existing handlers and permission conditions remain.
- \`821fd0dbd6733d28c92318c04b4976f16d90c930\`: 15 existing **internal Android** CG-02/03/09/14/15/19/20/21 screens use consistent rounded card/elevation and input border radius from existing theme. These are source-level presentation updates, **not screenshots verified on devices**.
- **Current pending loading-state commit:** nine existing CG-02, CG-09, CG-14, CG-15, CG-19 and CG-21 web workspaces retain truthful \`role="status"\` copy while receiving CG-01-like card/spinner presentation. A \`prefers-reduced-motion\` alternative avoids unnecessary animation. Shared \`/admin\` shell styling is scoped and does not affect the public website or Public Android. Source guard adds page-specific UI markers and keeps all QA counts unchanged.

### Remaining per-module visual deviations (do not mark PASS)

| Owning module | Screen-level status after source change | Still needed for CG-01 parity |
|---|---|---|
| CG-02 Foundation/branches | Shared responsive shell, headings, cards and loading treatment | Verify seven-stage branch form, tab hierarchy, desktop right panels, accessible narrow screen |
| CG-03 approvals | CG-01 shell and native rounded cards | Compare original approval list, detail drawer, action hierarchy and independent-review confirmation |
| CG-09 finance | Shared admin panels/table headings, native finance primitives and 15-screen native card pass | Original finance dashboard/list/form detail consistency, double-column fields, keyboard/IME, no horizontal clipping |
| CG-14 healthcare | Providers and doctors header toolbars, common card and loading styles | Separate healthcare screenshots UI-07/09/23; evidence, approval and suspended/provisional states |
| CG-15 appointments/patients | H07/H15 client-specific layout retained; queue header and record details visually polished | Original H07/H15 screenshot layout, booking step forms, restricted data and appointment timelines on real web/mobile |
| CG-18 CMS | Correct primary New page and headline hierarchy | Draft/review/publish panel appearance against real CG-01 forms; leave published public theme unchanged |
| Documents, communications, support | Shared fields, notices, web cards and native surfaces | Verify detail drawer, long notices, empty states, compact phone layout, focus and status affordances |

**No complete rendered UI fidelity claimed.** Exact pixel measurements or motion comparison against the client's original snapshots, 1440/1024/768/390/320 browser runs, Android devices, fonts, keyboards, lifecycle and accessibility testing are still \`NOT_RUN\`; source parity remains \`PARTIAL\`, feature-into-\`main\` merge remains \`HOLD\`. The manual \`npm run verify:cg01-uiux-source\` test is a lexical source regression guard, not an implementation or live QA certificate.
