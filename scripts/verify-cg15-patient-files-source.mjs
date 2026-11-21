/**
 * CG15 original US-008-QA08 / US-003-QA07 patient-owned CG19 scanned files.
 * Static source assertions; NOT PostgreSQL, scanner, S3/Firebase, Web/mobile,
 * clinical/consent revocation or build QA PASS.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=p=>readFileSync(resolve(import.meta.dirname,"..",p),"utf8");
const s={
 db:read("apps/backend/db/migrations/1438_cg19_patient_owned_private_files.sql"),
 service:read("apps/backend/src/modules/cg-19-documents-notifications/application/patient-private-files.service.ts"),
 controller:read("apps/backend/src/modules/cg-19-documents-notifications/http/patient-private-files.controller.ts"),
 module:read("apps/backend/src/modules/cg-19-documents-notifications/documents-notifications.module.ts"),
 storage:read("apps/backend/src/modules/cg-19-documents-notifications/infrastructure/private-object-storage.ts"),
 bff:read("apps/web/src/app/api/patient-private-files/[...parts]/route.ts"),
 web:read("apps/web/src/features/patients/patient-private-files-panel.tsx"),
 webProfile:read("apps/web/src/features/patients/patient-profile-panel.tsx"),
 native:read("apps/android-public/src/features/patients/native-patient-private-files.tsx"),
 nativeProfile:read("apps/android-public/src/features/patients/patient-profile-native.tsx"),
 scripts:read("scripts/verify-cg15-migrations-source.mjs"),
 pkg:read("package.json"),
 tracker:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const checks=[
 ["forward-only 1438 has actual patient/intent/file FK and immutable source",
  s.db.includes("CREATE TABLE cg19_patient_file_intent(")&&
  s.db.includes("CREATE TABLE cg19_patient_private_file(")&&
  s.db.includes("FOREIGN KEY(realm_id,intent_id,patient_id)")&&
  s.db.includes("cg19_patient_private_file_identity_guard")],
 ["patient file privacy and revocation events preserved independently",
  s.db.includes("CREATE TABLE cg19_patient_file_event(")&&
  s.db.includes("cg19_patient_file_event_immutable_guard")&&
  s.db.includes("WHERE revoked_at IS NULL")],
 ["photo/old prescription/report explicitly distinguished and MIME bounded",
  s.db.includes("PATIENT_PHOTO")&&
  s.db.includes("PATIENT_UPLOADED_PRESCRIPTION")&&
  s.db.includes("PATIENT_MEDICAL_REPORT")&&
  s.db.includes("10485760")&&
  s.db.includes("CHECK(classification<>'PATIENT_PHOTO' OR mime<>'application/pdf')")],
 ["actual own verified patient account, original identity and consent for new uploads",
  s.service.includes("cg15_patient_account_link l")&&
  s.service.includes("l.revoked_at IS NULL")&&
  s.service.includes("p.profile_status='VERIFIED'")&&
  s.service.includes("cg15_patient_identity_event proof")&&
  s.service.includes("x.purpose='PATIENT_CARE'")&&
  s.service.includes("this.own(c,actor,true,true)")],
 ["patient list/read after withdrawal remains own lawful, not clinic access",
  s.service.includes("this.own(c,actor,false,true)")&&
  s.service.includes("async download(")&&
  s.service.includes("private async currentFile(")],
 ["real scanner and verified immutable object required before visibility",
  s.service.includes("this.objects.reservePrivateUpload(")&&
  s.service.includes("this.objects.verifyPrivateObject(")&&
  s.service.includes('verified.state==="CLEAN_VERIFIED"')&&
  s.service.includes("verified.sha256===row.sha256")&&
  s.service.includes("verified.scanProofRef")&&
  s.service.includes("readVerifiedPrivateObject(")],
 ["never return public protected GET URL, check object again after storage read",
  s.service.includes("const now=await this.currentFile(actor,ref)")&&
  s.service.includes('createHash("sha256").update(bytes)')&&
  s.service.includes("return {bytes,mime:before.mime}")],
 ["original idempotency and immutable revoke CAS",
  s.service.includes("ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING")&&
  s.service.includes("request_digest!==digest")&&
  s.service.includes("revoked_at=now(),revision=revision+1")],
 ["protected own-patient backend controller is CG19 owner",
  s.controller.includes('Controller("api/documents/patient-files")')&&
  s.module.includes("PatientPrivateFilesService")&&
  s.module.includes("PatientPrivateFilesController")],
 ["Web BFF only current patient cookie and no public file link",
  s.bff.includes('get("cg_patient_session")')&&
  s.bff.includes('["image/jpeg","image/png","image/webp","application/pdf"]')&&
  s.web.includes("Patient-supplied prescription")],
 ["Web verified patient UI is the original private file history owner",
  s.webProfile.includes("<PatientPrivateFilesPanel")&&
  (s.web.includes('readFile(')||s.web.includes('openFile('))&&
  s.web.includes('function revoke(')&&
  s.web.includes('async function upload(')],
 ["Public Android Web parity: actual picker, bytes SHA, signed PUT and protected read",
  s.nativeProfile.includes("<NativePatientPrivateFiles")&&
  s.native.includes("File.pickFileAsync(")&&
  s.native.includes("Crypto.digest(")&&
  s.native.includes("const uploaded=await expoFetch(started.uploadUrl")&&
  s.native.includes("File.preview(file")&&
  s.native.includes('"/revoke"')],
 ["mobile privacy matches protected source, client cannot grant clinic access",
  s.native.includes('"/api/documents/patient-files/"')&&
  s.native.includes("consentGranted")&&
  s.native.includes("onExpired()")&&
  !s.native.includes("CLINICIAN_WRITE")],
 ["original 128 cases and migration preflight preserved",
  s.scripts.includes("1438_cg19_patient_owned_private_files.sql")&&
  s.pkg.includes("verify:cg15-patient-files-source")&&
  Array.from({length:8},(_,n)=>n+1).every(n=>
   Array.from({length:16},(_,i)=>
    "US-"+String(n).padStart(3,"0")+"-QA"+String(i+1).padStart(2,"0"))
    .every(id=>s.tracker.includes(id)))]
];
let failed=0;
for(const [name,ok] of checks){
 process.stdout.write((ok?"SOURCE_PRESENT":"SOURCE_GAP")+" "+name+"\n");
 if(!ok)failed++;
}
process.stdout.write("CG15/CG19 patient private file source "+(checks.length-failed)+
 "/"+checks.length+"; NOT executed PostgreSQL/actual malware scanner or Android QA PASS.\n");
if(failed)process.exitCode=1;
