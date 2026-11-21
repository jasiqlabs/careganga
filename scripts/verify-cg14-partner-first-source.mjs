/** Local source-only gate for the CG14 public partner-first intake (not runtime).
 * Run with npm run verify:cg14-partner-first-source; no CI/GitHub Actions. */
import {existsSync,readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import ts from "typescript";
const root=resolve(import.meta.dirname,"..");
const file=p=>readFileSync(resolve(root,p),"utf8");
const paths={
 sql:"apps/backend/db/migrations/1446_cg14_public_partner_application_intake.sql",
 service:"apps/backend/src/modules/cg-14-healthcare-network/application/health-partner-applications.service.ts",
 publicHttp:"apps/backend/src/modules/cg-14-healthcare-network/http/health-partner-applications.controller.ts",
 module:"apps/backend/src/modules/cg-14-healthcare-network/health-network.module.ts",
 throttle:"apps/backend/src/modules/cg-14-healthcare-network/application/health-public-request-throttle.service.ts",
 publicProxy:"apps/web/src/app/api/public/healthcare-partners/[action]/route.ts",
 staffProxy:"apps/web/src/app/api/health-network/[...parts]/route.ts",
 safeCopy:"apps/backend/src/core/http/safe-error-copy.ts",
 safeFilter:"apps/backend/src/core/http/safe-errors.filter.ts",
 doctorList:"apps/backend/src/modules/cg-14-healthcare-network/application/health-doctor-draft.service.ts",
 doctorHttp:"apps/backend/src/modules/cg-14-healthcare-network/http/health-doctor-draft.controller.ts",

 publicForm:"apps/web/src/features/health-network/healthcare-partner-application.tsx",
 publicLanding:"apps/web/src/app/collaboration/page.tsx",
 publicApply:"apps/web/src/app/collaboration/healthcare-partner/page.tsx",
 cmsNav:"apps/web/src/features/cms-public-content/cms-site-header.tsx",
 nativePublic:"apps/android-public/src/features/health-network/public-partner-application.tsx",
 nativePublicApp:"apps/android-public/app/index.tsx",
 nativeCms:"apps/android-public/src/features/cms/public-cms-screen.tsx",
 staffInbox:"apps/web/src/features/health-network/partner-application-inbox.tsx",
 staffPage:"apps/web/src/app/(admin)/admin/health-network/partner-applications/page.tsx",
 nativeStaff:"apps/android-internal/src/features/health-network/native-partner-application-inbox.tsx",
 nativeProvider:"apps/android-internal/src/features/health-network/native-provider-management.tsx"
};
const s=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,file(v)]));
const checks=[
 ["Only CG14 intake, no duplicate provider master",
  s.sql.includes("CREATE TABLE health_partner_application")&&
  !s.sql.includes("CREATE TABLE health_provider")&&
  !s.sql.includes("CREATE TABLE health_doctor")],
 ["Original CG14 provider and doctor composite FKs",
  s.sql.includes("REFERENCES health_provider(root_realm_id,id)")&&
  s.sql.includes("REFERENCES health_doctor(root_realm_id,id)")],
 ["256-bit secret tracking receipt stored as digest only",
  s.sql.includes("receipt_digest char(64)")&&
  !s.sql.includes("receipt_token")&&
  s.service.includes('digest("base64url")')&&
  s.service.includes("hashReceipt(obj.receipt)")],
 ["Public application never auto approves/publishes/grants ERP",
  s.service.includes('status:"PENDING"')===false&&
  s.sql.includes("DEFAULT 'PENDING'")&&
  !s.service.includes("INSERT INTO health_provider")&&
  !s.service.includes("INSERT INTO health_doctor")&&
  !s.service.includes("INSERT INTO foundation_liability")],
 ["Bounded public apply and private status through original CG14",
  s.publicHttp.includes('api/v1/public/health-network')&&
  s.publicHttp.includes('throttle.hit(request,"partnerApply")')&&
  s.publicHttp.includes('throttle.hit(request,"partnerStatus")')&&
  s.throttle.includes("partnerApply:60")&&s.throttle.includes("partnerStatus:180")],
 ["Private Foundation viewer/reviewer with expectedVersion",
  s.service.includes('requireAction(bearer,"health.providers.view")')&&
  s.service.includes('requireAction(bearer,"health.providers.manage")')&&
  s.service.includes('this.identity.assertCurrent(tx,actor,"health.providers.manage")')&&
  s.service.includes("FOR UPDATE")&&s.service.includes("PARTNER_VERSION_CHANGED")],
 ["Original source linking never means verification",
  s.service.includes("linked_provider_id")&&
  s.service.includes("linked_doctor_id")&&
  s.service.includes("Independent verification and publication still apply.")],
 ["Public Next strict origin and allowlisted endpoint",
  s.publicProxy.includes('req.headers.get("origin")!==req.nextUrl.origin')&&
  s.publicProxy.includes('action!=="apply"&&action!=="status"')&&
  !s.publicProxy.includes('Authorization:"Bearer "')],
 ["Original Partnerships page, separate CG04 Join",
  s.publicLanding.includes("Partner With Us")&&
  s.publicLanding.includes('href="/collaboration/healthcare-partner"')&&
  s.cmsNav.includes('href="/collaboration"')&&
  s.cmsNav.includes("Become a Member")&&s.cmsNav.includes("Become a Volunteer")],
 ["Same partner type options on web and native",
  ["HOSPITAL","CLINIC","DIAGNOSTIC_LAB","DOCTOR","PHARMACY","NURSING","SURGERY_CENTER"]
  .every(t=>s.publicForm.includes(t)&&s.nativePublic.includes(t)&&s.service.includes(t))],
 ["Same applicant status/receipt source on public web/native",
  s.publicForm.includes('call("status"')&&
  s.nativePublic.includes('request("status"')&&
  s.nativePublicApp.includes("onPartnerApplication")&&
  s.nativeCms.includes('title="Partnerships"')],
 ["Native design token dependency resolves from public Android partner form",
  (()=>{const found=s.nativePublic.match(/from\s+["\x27](\.[^"\x27]*\/design-tokens\/src\/index)["\x27]/);
   return !!found&&existsSync(resolve(root,dirname(paths.nativePublic),found[1]+".ts"));})()],
 ["Public Android handles hardware Back without exiting application flow",
  s.nativePublic.includes('BackHandler.addEventListener("hardwareBackPress"')&&
  s.nativePublic.includes('if(started)setStarted(false)')],
 ["Public Android email keyboard and same original bounded input checks",
  s.nativePublic.includes('keyboardType={key==="contactEmail"?"email-address"')&&
  s.nativePublic.includes('fields.applicantName.trim().length<2')&&
  s.nativePublic.includes('fields.contactEmail.trim()!==""')],
 ["Staff Android hardware Back returns from review to original providers",
  s.nativeStaff.includes('BackHandler.addEventListener("hardwareBackPress"')&&
  s.nativeStaff.includes('if(selected)setSelected(null)')],
 ["Public status explains returned/review/verified without auto discount on both clients",
  s.service.includes('statusLabel:"Additional details requested"')&&
  s.service.includes('statusLabel:"Original partner record verified"')&&
  s.service.includes('Foundation discounts still require separate approval.')&&
  s.publicForm.includes("checked.statusLabel")&&
  s.publicForm.includes("checked.message")&&
  s.nativePublic.includes("checked.statusLabel")&&
  s.nativePublic.includes("checked.message")],
 ["Web and internal Android link lookup uses original name filter",
  s.staffInbox.includes('"providers?offset=0&q="+encodeURIComponent(app.name)')&&
  s.nativeStaff.includes('"providers?offset=0&q="+encodeURIComponent(app.name)')],
 ["Main safe-error infrastructure contains all actual partner error codes",
  ["PARTNER_FIELD_INVALID","PARTNER_CONSENT_REQUIRED","PARTNER_RECEIPT_INVALID",
   "PARTNER_RECEIPT_UNAVAILABLE","PARTNER_REQUEST_CONFLICT",
   "PARTNER_VERSION_INVALID","PARTNER_VERSION_CHANGED","PARTNER_REVIEW_CLOSED",
   "PARTNER_SOURCE_MISMATCH","PARTNER_APPLICATION_UNAVAILABLE"]
   .every(code=>new RegExp("\\b"+code+":").test(s.safeCopy))&&
  s.safeFilter.includes("Object.hasOwn(safeCodes,rawCode)")&&
  s.safeFilter.includes('"partnerType"')&&s.safeFilter.includes('"applicantName"')],
 ["Staff and public Android only render reviewed safe error copy",
  s.nativeStaff.includes('safe.has(rec.code)')&&
  s.nativePublic.includes('safe.has(info.code)')&&
  !s.nativeStaff.includes('setError(e.code)')&&
  !s.nativePublic.includes('setError(e.code)')],
 ["Actual bounded clinician name lookup on original authenticated CG14",
  s.doctorList.includes('position($3 in normalized_name)>0')&&
  s.doctorHttp.includes('@Query("q")search?:string')&&
  s.staffInbox.includes('"doctors?q="+encodeURIComponent(app.name)')&&
  s.nativeStaff.includes('"doctors?q="+encodeURIComponent(app.name)')],
 ["Business display names rather than original internal record identifiers",
  s.staffInbox.includes('label:v.name')&&
  s.nativeStaff.includes('label:d.name')&&
  !s.staffInbox.includes('>{selected.applicationRef}<')&&
  !s.nativeStaff.includes('>{selected.applicationRef}<')],
 ["Original source list and staff review across Web/Internal Android",
  s.staffProxy.includes('parts[0]==="partner-applications"')&&
  s.staffPage.includes("PartnerApplicationInbox")&&
  s.nativeProvider.includes("NativePartnerApplicationInbox")&&
  s.staffInbox.includes("/link-original")&&
  s.nativeStaff.includes("/link-original")],
 ["No partner ERP dependency or auto finance effect",
  !s.service.includes("PHARMACY_ERP")&&
  !s.service.includes("OT_ERP")&&
  !s.service.includes("NURSING_ERP")&&
  !s.sql.includes("patient_charge")&&
  !s.sql.includes("provider_settlement")]
];
for(const [label,okay] of checks)
 console.log((okay?"SOURCE_PRESENT":"SOURCE_GAP")+" — "+label);
let failures=checks.filter(([,okay])=>!okay).length;
for(const [key,path] of Object.entries(paths)){
 if(!/\.tsx?$/.test(path))continue;
 const kind=path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS;
 const source=ts.createSourceFile(path,s[key],ts.ScriptTarget.Latest,true,kind);
 if(source.parseDiagnostics.length){
  failures++;
  for(const d of source.parseDiagnostics)
   console.error("PARSE_GAP "+path+": "+ts.flattenDiagnosticMessageText(d.messageText," "));
 }
}
console.log("CG14 first-slice source checks "+(checks.length-failures)+
 "/"+checks.length+"; real TypeScript builds, DB migration, independent "+
 "security/clinical/financial, Web and both Android runtime NOT_RUN.");
if(failures)process.exitCode=1;
