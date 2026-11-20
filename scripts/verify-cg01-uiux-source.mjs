/**
 * CG-01 Irfan UI source contract — local developer preflight only.
 * This does NOT run Web/Android, verify the original client screenshots,
 * approve business logic, or mark any QA case passed.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
function check(condition,message){
 if(!condition)throw Error("CG01 UI SOURCE GAP: "+message);
}
function pages(dir){
 return readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(ent=>{
  const sub=join(dir,ent.name);
  if(ent.isDirectory())return pages(sub);
  return ent.isFile()&&ent.name==="page.tsx"?[sub]:[];
 });
}
const web=pages("apps/web/src/app/(admin)");
const authPublic=new Set([
 "admin/login/page.tsx",
 "admin/password/page.tsx",
 "admin/recovery/page.tsx"
]);
let protectedCount=0, navCount=0, healthcareCount=0;
for(const full of web){
 const path=relative("apps/web/src/app/(admin)",full).replaceAll("\\","/");
 if(authPublic.has(path))continue;
 const code=read(full);
 const hasNav=code.includes("<FoundationAdminNav");
 const hasHealthcare=code.includes("<HealthcareAdminShell");
 check(hasNav||hasHealthcare,path+" missing CG-01 admin/navigation shell");
 check(!(hasNav&&hasHealthcare),path+" embeds two separate admin shells");
 if(hasNav){
  check(code.includes("initialActions="),path+" does not seed current server-verified actions");
  navCount++;
 }
 if(hasHealthcare)healthcareCount++;
 protectedCount++;
}
check(web.length>=39,"expected 39 existing protected/auth Web screens");
check(protectedCount>=36,"expected at least 36 protected Web screens");

const nav=read("apps/web/src/shared/foundation-admin-nav.tsx");
check(nav.includes("initialActions ? new Set(initialActions) : null"),
 "shared sidebar missing verified first-render permissions");
check(nav.includes('fetch("/api/access/effective"'),
 "shared sidebar must revalidate effective permissions");
const healthcareShell=read("apps/web/src/shared/healthcare-admin-shell.tsx");
check(healthcareShell.includes("initialActions={Array.from(actions)}"),
 "healthcare role-specific shell missing server permissions");
const css=read("apps/web/src/app/globals.css");
for(const token of ["--cg-heading-lg",".cg-rp-workspace",".cg-um-workspace",".cg-sp-workspace",
 "/* CG-01 Nov 2026 visual parity for EXISTING admin business modules.",
 ".cg-fin-card {",".table-wrap table {"]){
 check(css.includes(token),"shared CG-01 responsive styling absent: "+token);
}
check(css.includes(".shell > .workspace"),"admin styling is not scoped to admin workspace");

const native=[
 "appointments/native-center-assisted-booking.tsx",
 "appointments/native-center-visit-queue.tsx",
 "registration-approvals/doctor-leave-native-review.tsx",
 "registration-approvals/healthcare-native-review.tsx",
 "registration-approvals/proposal-screen.tsx",
 "finance-accounting/finance-accounts-screen.tsx",
 "finance-accounting/finance-expense-claims-screen.tsx",
 "finance-accounting/finance-voucher-draft-screen.tsx",
 "finance-accounting/finance-voucher-only-screen.tsx",
 "finance-accounting/finance-voucher-native-reviewer.tsx",
 "finance-accounting/finance-claim-native-reviewer.tsx",
 "finance-accounting/finance-native-invoices.tsx",
 "finance-accounting/finance-native-budgets.tsx",
 "finance-accounting/finance-native-reports.tsx",
 "finance-accounting/finance-native-protected-review.tsx",
 "foundation-structure/branch-registration-screen.tsx",
 "documents/private-case-evidence-screen.tsx",
 "communications/notifications-screen.tsx",
 "communications/foundation-notice-admin-screen.tsx",
 "support/foundation-support-screen.tsx"
];
for(const p of native){
 const code=read("apps/android-internal/src/features/"+p);
 check(code.includes('edges={["left","right"]}'),p+" repeats CG-01 top/bottom safe-area padding");
 check(code.includes("SafeAreaView"),p+" missing safe-area layout");
}
const theme=read("packages/design-tokens/src/index.ts");
check(theme.includes('adminCanvas:"#F8FAFC"'),
 "native business module canvas differs from latest CG-01 baseline");
const kit=read("apps/android-internal/src/features/finance-accounting/finance-native-source-kit.tsx");
check(kit.includes("backgroundColor:t.adminCanvas"),
 "native finance primitive still uses legacy module background");
const staff=read("apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx");
const keys=["approvals","healthVisitQueue","healthPatientBooking","healthDoctorLeave",
 "healthReviews","notifications","documents","financeInvoiceReviews","financeBudgetReviews",
 "financeInvoices","financeBudgets","financeReports","financeClaimReviews","financeClaims",
 "financeReviews","financeVouchers","finance","branches","communications","noticeAdmin","support"];
for(const k of keys)check(staff.includes(', "'+k+'", '),
 "CG-01 native navigation missing protected screen: "+k);
check(staff.includes("const closeModuleViews = useCallback("),
 "module switching does not clear previous business view");
check(staff.includes("AuthenticatedAppShell"),
 "protected business screens do not reuse CG-01 header, drawer, bottom nav");

const cg01OwningModuleMarkers=[
 ["apps/web/src/features/cms-public-content/cms-admin-workspace.tsx",
  ["<h1>Website content</h1>",'className="primary" type="button" onClick={()=>{setSelected(null);setReviewing(false);']],
 ["apps/web/src/features/health-network/provider-onboarding.tsx",
  ['className="toolbar cg-module-header-actions"']],
 ["apps/web/src/features/health-network/doctor-onboarding.tsx",
  ['className="toolbar cg-module-header-actions"']],
 ["apps/web/src/features/appointments/center-visit-queue.tsx",
  ["<h1>Consultation check-in & queue</h1>"]],
 ["apps/web/src/features/appointments/foundation-patient-bookings.tsx",
  ['className="cg15-print-scope cg-health-patient-detail"']]
];
for(const [path,markers] of cg01OwningModuleMarkers){
 const code=read(path);
 for(const marker of markers)
  check(code.includes(marker),path+" missing source-reviewed CG-01 page treatment");
}
check(css.includes(".cg-cms-actions button.primary:not(:disabled)"),
 "CG-18 CMS New page no longer styled as primary");
check(!css.includes(".cg-cms-actions button:first-child:not(:disabled)"),
 "CG-18 CMS still treats Refresh as primary");
const cg01NativeCardPaths=[
 "registration-approvals/proposal-screen.tsx",
 "appointments/native-center-assisted-booking.tsx",
 "appointments/native-center-visit-queue.tsx",
 "registration-approvals/doctor-leave-native-review.tsx",
 "registration-approvals/healthcare-native-review.tsx",
 "finance-accounting/finance-accounts-screen.tsx",
 "finance-accounting/finance-expense-claims-screen.tsx",
 "finance-accounting/finance-voucher-draft-screen.tsx",
 "finance-accounting/finance-voucher-native-reviewer.tsx",
 "finance-accounting/finance-claim-native-reviewer.tsx",
 "foundation-structure/branch-registration-screen.tsx",
 "documents/private-case-evidence-screen.tsx",
 "communications/notifications-screen.tsx",
 "communications/foundation-notice-admin-screen.tsx",
 "support/foundation-support-screen.tsx"
];
for(const path of cg01NativeCardPaths){
 const code=read("apps/android-internal/src/features/"+path);
 check(code.includes("shadowOpacity:0.045")&&code.includes("borderRadius:14"),
  path+" missing CG-01 card elevation/corners");
}


const cg01LoadingPages=[
 "registration-approvals/proposal-workspace.tsx",
 "foundation-structure/foundation-structure-panel.tsx",
 "foundation-structure/branch-draft-panel.tsx",
 "health-network/provider-onboarding.tsx",
 "health-network/doctor-onboarding.tsx",
 "documents/private-case-evidence-panel.tsx",
 "finance-accounting/finance-accounts-workspace.tsx",
 "appointments/doctor-schedule-workspace.tsx",
 "appointments/foundation-patient-bookings.tsx",
 "communications/communications-workspace.tsx"
];
for(const path of cg01LoadingPages){
 const content=read("apps/web/src/features/"+path);
 check(content.includes('className="cg-module-loading"'),
  path+" lost CG-01 accessible loading presentation");
}
check(read("apps/web/src/features/registration-approvals/proposal-workspace.tsx").includes("<tbody aria-busy={loading}>"),
 "CG-03 approvals table must expose its loading state");
check(css.includes(".cg-module-loading::before")&&css.includes("prefers-reduced-motion"),
 "shared module loading indicator must be reduced-motion accessible");


for(const selector of [
 ".cg-fin-workspace .cg-fin-kpi",
 ".cg-cms-dashboard > div",
 '.role-workspace .toolbar[role="tablist"]',
 '[role="tab"][aria-selected="true"]'
]) check(css.includes(selector),"CG-01 module statistics/selected-tab source missing: "+selector);


const cg01EmptyStateOwners=[
 "foundation-structure/branch-draft-panel.tsx",
 "foundation-structure/foundation-structure-panel.tsx",
 "health-network/provider-onboarding.tsx",
 "health-network/doctor-onboarding.tsx",
 "communications/communications-workspace.tsx",
 "appointments/doctor-schedule-workspace.tsx"
];
for(const path of cg01EmptyStateOwners){
 const content=read("apps/web/src/features/"+path);
 check(content.includes('className="cg-module-empty" role="status"'),
  path+" missing shared CG-01 empty-state treatment");
}
check(css.includes(".cg-module-empty"),
 "CG-01 source-matched empty-state style missing from authenticated admin");

// Healthcare routes now reuse the same authorized presentation wrapper, rather
// than diverging from the CG-01 navigation/heading treatment page by page.
for(const p of [
 "admin/health-network/page.tsx",
 "admin/health-network/doctors/page.tsx",
 "admin/health-network/reviews/page.tsx",
 "admin/health-network/patient-intake/page.tsx",
 "admin/health-network/queue/page.tsx",
 "admin/health-network/patients/page.tsx"
]){
 const code=read("apps/web/src/app/(admin)/"+p);
 check(code.includes("<HealthcareAdminShell")&&!code.includes("<FoundationAdminNav"),
  p+" does not reuse the canonical healthcare Admin shell");
 check(code.split("<HealthcareAdminShell").length===2&&
  code.split("</HealthcareAdminShell>").length===2&&
  !code.includes('>ce">')&&!code.includes(';iv>;')&&
  !code.includes('<main className="workspace cg-health-admin-workspace">'),
  p+" has a malformed or duplicated healthcare wrapper");
}
check(nav.includes("healthReviewerAccess")&&nav.includes("healthPublisherAccess")&&
 nav.includes('"/admin/health-network/reviews"')&&
 nav.includes('"/admin/health-network/content-reviews"'),
 "reviewer/publisher-only Healthcare sidebar destinations are missing");
check(healthcareShell.includes('active==="healthCenter"')&&
 healthcareShell.includes('aria-current="page"')&&
 healthcareShell.includes('pageLabel?:string'),
 "own-center and route-specific breadcrumbs must remain context-aware");
const providerLanding=read("apps/web/src/app/(admin)/admin/health-network/page.tsx");
check(providerLanding.includes('href="/admin/health-network/reviews"')&&
 providerLanding.includes('actions.has("approvals.review")'),
 "healthcare reviewer landing does not expose protected review navigation");


/* 20 November: main-integrated CG-01 alignment regression contract.
 * These are source assertions, never browser/device/pixel acceptance. */
const mainIntegratedAdminRoutes=[
 "admin/accounts/page.tsx",
 "admin/approvals/page.tsx",
 "admin/audit/page.tsx",
 "admin/backup-recovery/page.tsx",
 "admin/communications/page.tsx",
 "admin/dashboard/page.tsx",
 "admin/documents/page.tsx",
 "admin/finance/budget-reviews/page.tsx",
 "admin/finance/budgets/page.tsx",
 "admin/finance/claim-reviews/page.tsx",
 "admin/finance/claims/page.tsx",
 "admin/finance/invoice-reviews/page.tsx",
 "admin/finance/invoices/page.tsx",
 "admin/finance/page.tsx",
 "admin/finance/reports/page.tsx",
 "admin/finance/voucher-approvals/page.tsx",
 "admin/finance/vouchers/page.tsx",
 "admin/foundation/branches/page.tsx",
 "admin/foundation/page.tsx",
 "admin/login/page.tsx",
 "admin/page.tsx",
 "admin/password/page.tsx",
 "admin/recovery/page.tsx",
 "admin/roles/page.tsx",
 "admin/security-policy/page.tsx",
 "admin/settings/page.tsx",
 "admin/support/page.tsx",
 "admin/website/page.tsx"
];
check(mainIntegratedAdminRoutes.length===28,
 "the original 28 main-integrated Admin Web routes must be listed");
for(const p of mainIntegratedAdminRoutes){
 const code=read("apps/web/src/app/(admin)/"+p);
 if(p==="admin/login/page.tsx"||p==="admin/password/page.tsx"||p==="admin/recovery/page.tsx")continue;
 check(code.includes("<FoundationAdminNav")||code.includes("<HealthcareAdminShell"),
  p+" lost its authenticated CG-01 shell");
}
const financePageTitles=[
 [
  "finance-voucher-draft-workspace.tsx",
  "Finance Voucher Drafts"
 ],
 [
  "finance-voucher-reviewer-workspace.tsx",
  "Finance Voucher Reviews"
 ],
 [
  "finance-expense-claim-workspace.tsx",
  "Expense Claims"
 ],
 [
  "finance-claim-review-workspace.tsx",
  "Expense Claim Reviews"
 ],
 [
  "finance-invoice-workspace.tsx",
  "Invoices & Receipts"
 ],
 [
  "finance-invoice-review-workspace.tsx",
  "Protected Invoice Reviews"
 ],
 [
  "finance-budget-workspace.tsx",
  "Budgets & Fund Allocation"
 ],
 [
  "finance-budget-review-workspace.tsx",
  "Protected Budget Reviews"
 ],
 [
  "finance-reports-workspace.tsx",
  "Financial Statements & Ledger"
 ]
];
for(const [path,title] of financePageTitles){
 const code=read("apps/web/src/features/finance-accounting/"+path);
 check(code.includes("<h1>"+title+"</h1>"),
  path+" lost the CG-01 standalone Finance page heading");
}
const mainStateOwners=[
 [
  "foundation-structure/operating-branches-panel.tsx",
  "cg-module-empty"
 ],
 [
  "registration-approvals/proposal-workspace.tsx",
  "cg-module-empty"
 ],
 [
  "documents/private-case-evidence-panel.tsx",
  "cg-module-empty"
 ],
 [
  "communications/communications-workspace.tsx",
  "cg-module-empty"
 ],
 [
  "support/foundation-support-workspace.tsx",
  "cg-module-empty"
 ],
 [
  "platform-configuration/platform-audit-panel.tsx",
  "cg-module-loading"
 ],
 [
  "platform-configuration/recovery-panel.tsx",
  "cg-module-empty"
 ],
 [
  "platform-configuration/platform-settings-panel.tsx",
  "cg-module-empty"
 ],
 [
  "cms-public-content/cms-extended-workspace.tsx",
  "cg-module-empty"
 ]
];
for(const [path,marker] of mainStateOwners){
 check(read("apps/web/src/features/"+path).includes(marker),
  path+" lost the CG-01 operational state presentation");
}
const extendedCms=read("apps/web/src/features/cms-public-content/cms-extended-workspace.tsx");
check(extendedCms.includes('className="primary" disabled={busy} onClick={()=>begin(kind)}'),
 "existing CMS editorial create action lost its primary hierarchy");
const voucherDraft=read("apps/web/src/features/finance-accounting/finance-voucher-draft-workspace.tsx");
check(voucherDraft.indexOf("<h1>Finance Voucher Drafts</h1>")<
 voucherDraft.indexOf("<FinanceVoucherDashboard"),
 "CG-09 source-backed dashboard must follow the page heading");
for(const selector of [
 ".cg-fin-manual > .cg-fin-toolbar h1",
 ".cg-cms-workspace > .cg-cms-toolbar > div > h2",
 ".cg-fin-manual .cg-fin-empty:not(.cg-module-loading)",
 ".cg-module-empty"
])check(css.includes(selector),
 "main-integrated CG-01 authenticated styling lost: "+selector);
const coreTokens=read("packages/design-tokens/src/index.ts");
check(coreTokens.includes('selectedSurface:"#EEF4FF"'),
 "CG-01 selected surface token missing for native business controls");
const nativeKit=read("apps/android-internal/src/features/finance-accounting/finance-native-source-kit.tsx");
check(nativeKit.includes("backgroundColor:t.selectedSurface")&&
 nativeKit.includes("minHeight:48"),
 "CG-09 shared native Finance input/selection parity missing");
for(const p of [
 "foundation-structure/branch-registration-screen.tsx",
 "communications/notifications-screen.tsx",
 "support/foundation-support-screen.tsx"
]){
 check(read("apps/android-internal/src/features/"+p).includes("paddingBottom:96"),
  p+" lacks CG-01 bottom-navigation scroll clearance");
}

console.log("CG-01 UI SOURCE CHECK only: "+web.length+" Web routes ("+
 protectedCount+" protected; "+navCount+" nav + "+healthcareCount+
 " healthcare shell), "+native.length+" native screen inset checks, "+keys.length+
 " protected native navigation routes. No runtime/pixel/device PASS implied.");
