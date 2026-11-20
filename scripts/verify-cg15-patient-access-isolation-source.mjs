/**
 * Original CG15 US-003-QA16 default-deny patient lookup/merge/export.
 * Source checker only. No actual cross-root/center/role-device/SQL tests.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=p=>readFileSync(resolve(import.meta.dirname,"..",p),"utf8");
const s={
 capabilities:read("apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts"),
 admin:read("apps/backend/src/modules/cg-15-patients-appointments/application/patient-admin-overview.service.ts"),
 center:read("apps/backend/src/modules/cg-15-patients-appointments/application/center-patient-intake.service.ts"),
 centerController:read("apps/backend/src/modules/cg-15-patients-appointments/http/center-patient-intake.controller.ts"),
 patient:read("apps/backend/src/modules/cg-15-patients-appointments/application/patient-profile.service.ts"),
 patientController:read("apps/backend/src/modules/cg-15-patients-appointments/http/patient-profile.controller.ts"),
 files:read("apps/backend/src/modules/cg-19-documents-notifications/application/patient-private-files.service.ts"),
 fileController:read("apps/backend/src/modules/cg-19-documents-notifications/http/patient-private-files.controller.ts"),
 fileBff:read("apps/web/src/app/api/patient-private-files/[...parts]/route.ts"),
 patientBff:read("apps/web/src/app/api/patients/[...parts]/route.ts"),
 clinical:read("apps/backend/src/modules/cg-19-documents-notifications/application/patient-clinical-file-sharing.service.ts"),
 clinicalBff:read("apps/web/src/app/api/patient-clinical-files/[...parts]/route.ts"),
 identity:read("apps/backend/src/modules/cg-01-identity-access/application/session.service.ts"),
 tracker:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md"),
 pkg:read("package.json")
};
const checks=[
 ["all-patients overview requires NON-assignable protected Foundation capability",
  s.capabilities.includes('key:"health.patients.admin.view"')&&
  s.capabilities.includes('businessLabel:"View protected Foundation patient and booking operations",group:"Healthcare patients",assignable:false')&&
  s.admin.includes('requireAction(bearer,"health.patients.admin.view")')],
 ["Foundation aggregate/list bounded with actual root, no private symptom/file SQL",
  s.admin.includes("WHERE a.root_realm_id=$1")&&
  s.admin.includes("limit>50")&&
  s.admin.includes("ORDER BY a.id DESC LIMIT $5")&&
  !s.admin.includes("cg19_patient_private_file")],
 ["center intake choices require current verified+enabled center affiliation",
  s.center.includes('requireAction(bearer,"health.patients.intake")')&&
  s.center.includes("a.account_ref=$2 AND a.status='ACTIVE'")&&
  s.center.includes("c.access_state='ENABLED'")],
 ["center actions force live CG14 center scope inside original transaction",
  s.center.includes('this.ownCenter.assertCurrent(tx,actor,centerRef,"health.patients.intake")')&&
  s.center.includes("await this.scope(tx,actor,centerRef)")],
 ["reception cannot GET entire patient list by phone or arbitrary profile",
  !s.centerController.includes('@Get("patients")')&&
  !s.centerController.includes('@Get("merge")')&&
  !s.centerController.includes('@Post("merge")')&&
  !s.centerController.includes('patient-phone-search')],
 ["intake result keyed by current center/creating account/request key",
  s.center.includes("AND i.center_id=$2")&&
  s.center.includes("AND i.created_by_account=$3 AND i.request_key=$4")],
 ["patient own original account source requires live root/account link not shared phone",
  s.patient.includes("cg15_patient_account_link l")&&
  s.patient.includes("l.account_id=$2 AND l.revoked_at IS NULL")&&
  !s.patient.includes("WHERE p.normalized_mobile=")],
 ["patient profile controller is self-only; no arbitrary list or merge",
  s.patientController.includes('@Get("me")')&&
  !s.patientController.includes('@Get("patients")')&&
  !s.patientController.includes('@Post("merge")')],
 ["CG19 own file/scan/read never grants staff by knowing patient ID",
  s.files.includes("cg15_patient_account_link l")&&
  s.files.includes("l.account_id=$2 AND l.revoked_at IS NULL")&&
  s.files.includes("const now=await this.currentFile(actor,ref)")&&
  s.fileController.includes('Controller("api/documents/patient-files")')],
 ["patient Web routes always have own cookie and bounded allowlist",
  s.fileBff.includes('get("cg_patient_session")')&&
  s.patientBff.includes('get("cg_patient_session")')&&
  s.fileBff.includes("if(!valid(parts,method))")],
 ["separate clinician read cannot use center role alone, and no arbitrary phone export",
  s.clinical.includes("assertCurrentAppointmentClinician(")&&
  s.clinical.includes("g.care_consent_revision=(SELECT x.revision_no")&&
  s.clinicalBff.includes('get(own?"cg_patient_session":"cg_staff_session")')],
 ["original 128 QA cases and explicit manual source verifier retained",
  s.pkg.includes("verify:cg15-patient-access-isolation-source")&&
  Array.from({length:8},(_,n)=>n+1).every(n=>
   Array.from({length:16},(_,i)=>"US-"+String(n).padStart(3,"0")+
    "-QA"+String(i+1).padStart(2,"0")).every(id=>s.tracker.includes(id)))]
];
let errors=0;
for(const [name,pass] of checks){
 process.stdout.write((pass?"SOURCE_PRESENT":"SOURCE_GAP")+" "+name+"\n");
 if(!pass)errors++;
}
process.stdout.write("CG15 default-deny patient source "+(checks.length-errors)+
 "/"+checks.length+"; actual IDOR, role suspensions, SQL, Web/native QA NOT_RUN.\n");
if(errors)process.exitCode=1;
