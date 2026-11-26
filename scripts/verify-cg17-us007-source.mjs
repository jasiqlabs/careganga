/** Original CG17 US007 source preflight (manual, not CI).
 * node scripts/verify-cg17-us007-source.mjs
 * Parsing/ownership assertions are NOT Postgres, browser, Android, pixel,
 * actual public content or independent clinical/financial QA.
 */
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const paths={
 source:"apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/public-healthcare-assistance.service.ts",
 controller:"apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/public-healthcare-assistance.controller.ts",
 cg14:"apps/backend/src/modules/cg-14-healthcare-network/application/health-public-directory.service.ts",
 cg18fields:"apps/backend/src/modules/cg-18-cms-public-content/application/cms-extended-sections.ts",
 cg18:"apps/backend/src/modules/cg-18-cms-public-content/application/cms-editorial.service.ts",
 cms:"apps/web/src/features/cms-public-content/cms-editorial-route.tsx",
 composition:"apps/web/src/app/healthcare/page.tsx",
 center:"apps/web/src/app/healthcare/centers/[slug]/page.tsx",
 component:"apps/web/src/features/healthcare-assistance/approved-consultation-benefits.tsx",
 web:"apps/web/src/features/healthcare-assistance/public-consultation-benefits.ts",
 native:"apps/android-public/src/features/health-network/native-approved-consultation-benefits.tsx",
 directory:"apps/android-public/src/features/health-network/public-healthcare-directory.tsx"
};
const values=Object.fromEntries(Object.entries(paths).map(([key,path])=>{
 const source=read(path);
 const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,
  path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,path+": "+
  parsed.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join(" | "));
 assert.doesNotMatch(source,/^(<{7}|={7}|>{7})/m,"Conflict in "+path);
 return [key,source];
}));
const has=(k,...parts)=>parts.every(part=>values[k].includes(part));
const cases={
 QA01:has("source","healthcare_policy_revision","eligibleConsultationCandidate")&&
  has("controller",'@Header("Cache-Control","no-store, max-age=0")'),
 QA02:has("source","root_ref","rootRef","approval_state='ACTIVE'")&&
  !has("source","cg15_patient")&&!has("source","patient_charge"),
 QA03:has("source","BEGIN READ ONLY")&&
  has("source","rule.activated_at<=now()")&&
  has("web","cache:\"no-store\""),
 QA04:has("source","PUBLIC_ASSISTANCE_FILTER_INVALID")&&
  has("web","UNAVAILABLE","items:[]")&&
  has("native","status===\"UNAVAILABLE\""),
 QA05:has("cms","ConsultationBenefitCards")&&
  has("composition",'slug="healthcare"')&&
  has("directory","NativeApprovedConsultationBenefits"),
 QA06:has("component","cg-site-content","cg-site-action")&&
  has("native","theme.surface","minHeight:48","accessibilityRole"),
 QA07:has("cg18fields","healthcareEditorialClaimsSafe")&&
  has("cg18","CMS_HEALTHCARE_UNSUPPORTED_RATE_CLAIM",
   "CMS_HEALTHCARE_FINANCIAL_SOURCE_NOT_VERIFIED")&&
  !values.cms.includes('import {ApprovedConsultationBenefits}'),
 QA08:has("source","maximumSupportMinor","patientEntitlementConfirmed:false")&&
  has("cg14","HEALTH_DOCTOR_VERIFICATION","CLEAN_VERIFIED")&&
  has("component","Currently approved consultation support"),
 QA09:has("controller","consultation-benefits")&&
  has("source","service_kind='CONSULTATION'")&&
  !values.source.includes("CAREGANGA_ERP_LAB_ENABLED"),
 QA10:has("source","valid_until>now()")&&
  has("native","AppState.addEventListener","clearTimeout(timer)")&&
  has("web","Date.parse(x.validUntil)>Date.now()"),
 QA11:has("cms","publishedCmsPage(slug)","benefits&&<ConsultationBenefitCards")&&
  has("cg18fields","HEALTHCARE_CATEGORIES")
};
assert.equal(Object.keys(cases).length,11);
for(const [caseId,verified]of Object.entries(cases))
 assert.equal(verified,true,"CG17 US007 original "+caseId+" source not verified");
console.log("CG17 US007 12 TS/TSX parses; 11 original QA SOURCE checks traced. "+
 "UI QA06 structural only. Actual runtime, database, native and pixel QA NOT_RUN.");
