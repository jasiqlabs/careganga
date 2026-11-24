/** Source-only regression gate for the recently integrated CG09/CG14–CG19 healthcare owners.
 * No runtime/database/browser tests; execute locally after npm ci, never via CI.
 * Every static exception code must have safe, reviewed copy in the original CG01 catalog.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import * as parser from "@babel/parser";
import traverseModule from "@babel/traverse";
const traverse=traverseModule.default||traverseModule;
const root=resolve(import.meta.dirname,"..");
const file=path=>readFileSync(resolve(root,path),"utf8");
const ownerPaths=[
 "apps/backend/src/modules/cg-09-finance-accounting/application/healthcare-foundation-posting.facade.ts",
 "apps/backend/src/modules/cg-09-finance-accounting/application/healthcare-provider-payout-proof.facade.ts",
 "apps/backend/src/modules/cg-09-finance-accounting/finance-source.module.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-center-support-scope.facade.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-clinician-identity.service.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-doctor-draft.service.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-doctor-review-workflow.service.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-lab-catalog-source.facade.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-lab-professional-review-source.facade.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-network.service.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-partner-applications.service.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-public-directory.service.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-public-request-throttle.service.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-review-workflow.service.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/application/health-verified-center-doctor.facade.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/health-network.module.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/http/health-doctor-draft.controller.ts",
 "apps/backend/src/modules/cg-14-healthcare-network/http/health-partner-applications.controller.ts",
 "apps/backend/src/modules/cg-15-patients-appointments/application/consultation-charge-source.facade.ts",
 "apps/backend/src/modules/cg-15-patients-appointments/application/consultation-completion-source.facade.ts",
 "apps/backend/src/modules/cg-15-patients-appointments/application/consultation-queue.service.ts",
 "apps/backend/src/modules/cg-15-patients-appointments/http/consultation-queue.controller.ts",
 "apps/backend/src/modules/cg-15-patients-appointments/patients-appointments.module.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-admission.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-custody.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-equipment.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-generated-result.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-options.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-order.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-patient-release.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-professional-review.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-quality-evidence.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/clinical-lab-result-evidence.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/diagnostics-catalog.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/diagnostics-price-review.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/application/diagnostics-public-catalog.service.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/diagnostics.module.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/http/clinical-lab-equipment.controller.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/http/clinical-lab-order.controller.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/http/clinical-lab-patient-report.controller.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/http/diagnostics-catalog.controller.ts",
 "apps/backend/src/modules/cg-16-healthcare-diagnostics/http/diagnostics-public-catalog.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/center-merchant-checkout.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/center-merchant-provisioning.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/center-patient-collection.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/center-patient-receipt.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/completed-consultation-liability.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/consultation-patient-charge.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/foundation-journal-reconciliation.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/foundation-liability-correction.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/healthcare-assistance-policy.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/healthcare-assistance-review-source.facade.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/healthcare-policy-approval.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/monthly-provider-settlement.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/public-healthcare-assistance.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/application/verified-provider-payout.service.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/healthcare-assistance.module.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/center-merchant.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/center-patient-collection.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/center-patient-receipt.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/completed-consultation-liability.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/consultation-patient-charge.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/foundation-journal-reconciliation.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/healthcare-assistance-policy.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/healthcare-policy-approval.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/monthly-provider-settlement.controller.ts",
 "apps/backend/src/modules/cg-17-healthcare-assistance-settlements/http/public-healthcare-assistance.controller.ts",
 "apps/backend/src/modules/cg-18-cms-public-content/application/cms-editorial.service.ts",
 "apps/backend/src/modules/cg-18-cms-public-content/application/cms-extended-sections.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/application/center-collection-receipt-renderer.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/application/center-online-payment-confirmation-renderer.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/application/delivery.service.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/application/laboratory-report-renderer.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/application/notification.service.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/infrastructure/communication-worker.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/infrastructure/verified-private-storage.ts",
 "apps/backend/src/modules/cg-19-documents-notifications/lab-result-storage.module.ts"
];
const originalCatalog=file("apps/backend/src/core/http/safe-error-copy.ts");
const originalFilter=file("apps/backend/src/core/http/safe-errors.filter.ts");
const approved=new Set([...originalCatalog.matchAll(/^\s+([A-Z][A-Z_0-9]{4,}):"/gm)].map(match=>match[1]));
const problems=[];
let checked=0,recognized=0;
for(const path of ownerPaths){
 try {
  const ast=parser.parse(file(path),{
   sourceType:"module",
   plugins:["typescript","decorators-legacy"]
  });
  traverse(ast,{
   NewExpression(p){
    const callee=p.node.callee;
    const name=callee.name||(callee.property&&callee.property.name);
    if(name&&/(?:Exception)$/.test(name)&&p.node.arguments.length){
     const arg=p.node.arguments[0];
     if(arg.type==="ObjectExpression"){
      for(const prop of arg.properties){
       if(prop.type==="ObjectProperty"&&(prop.key.name==="code"||prop.key.value==="code")){
        if(prop.value.type==="StringLiteral"||prop.value.type==="TemplateLiteral"){
         const code=prop.value.type==="StringLiteral"?prop.value.value:prop.value.quasis[0]?.value?.raw;
         if(code){
          checked++;
          if(!approved.has(code))problems.push(path+": no safe copy for "+code);
          else recognized++;
         }
        }
       }
      }
     }
    }
   }
  });
 }catch(err){
  problems.push(path+": parse error: "+err.message);
 }
}
if(!originalFilter.includes("Object.hasOwn(safeCodes,rawCode)"))
 problems.push("Original safe HTTP filter no longer enforces its catalog allowlist");
const fields=["partnerType","applicantName","contactPhone","contactEmail","registrationNumber","addressLine","districtName","stateName","pinCode","consentAccepted"];
for(const field of fields)if(!originalFilter.includes('"'+field+'"'))
 problems.push("Partner field is missing from safe error field allowlist: "+field);
for(const error of problems)console.error("SOURCE_GAP — "+error);
console.log("CareGanga original safe-error source coverage: "+recognized+"/"+checked+
 " literal thrown exception codes across "+ownerPaths.length+
 " recently merged/changed backend files. Browser, Web, Android, PG, payment "+
 "and independent QA NOT_RUN.");
if(problems.length)process.exitCode=1;
