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
console.log("CG-01 UI SOURCE CHECK only: "+web.length+" Web routes ("+
 protectedCount+" protected; "+navCount+" nav + "+healthcareCount+
 " healthcare shell), "+native.length+" native screen inset checks, "+keys.length+
 " protected native navigation routes. No runtime/pixel/device PASS implied.");
