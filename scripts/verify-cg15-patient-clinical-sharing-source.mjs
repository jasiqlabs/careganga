/**
 * CG15 original US-003-QA09 and US-008-QA09 clinician-purpose patient file.
 * Lexical source check ONLY. Use actual checkout for npm run, SQL migrations,
 * race/consent/security tests and client Web/native builds: all NOT_RUN here.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=p=>readFileSync(resolve(import.meta.dirname,"..",p),"utf8");
const s={
 sql:read("apps/backend/db/migrations/1440_cg19_patient_specific_clinical_file_grants.sql"),
 service:read("apps/backend/src/modules/cg-19-documents-notifications/application/patient-clinical-file-sharing.service.ts"),
 ctrl:read("apps/backend/src/modules/cg-19-documents-notifications/http/patient-clinical-file-sharing.controller.ts"),
 module:read("apps/backend/src/modules/cg-19-documents-notifications/documents-notifications.module.ts"),
 bff:read("apps/web/src/app/api/patient-clinical-files/[...parts]/route.ts"),
 patientWeb:read("apps/web/src/features/patients/patient-clinical-file-shares.tsx"),
 patientPanel:read("apps/web/src/features/patients/patient-private-files-panel.tsx"),
 doctorWeb:read("apps/web/src/features/appointments/clinician-shared-patient-files.tsx"),
 doctorQueueWeb:read("apps/web/src/features/appointments/center-visit-queue.tsx"),
 patientNative:read("apps/android-public/src/features/patients/native-patient-clinical-file-shares.tsx"),
 patientPanelNative:read("apps/android-public/src/features/patients/native-patient-private-files.tsx"),
 doctorNative:read("apps/android-internal/src/features/appointments/native-clinician-shared-patient-files.tsx"),
 doctorQueueNative:read("apps/android-internal/src/features/appointments/native-center-visit-queue.tsx"),
 clinician:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-clinician-identity.service.ts"),
 migrations:read("scripts/verify-cg15-migrations-source.mjs"),
 pkg:read("package.json"),
 tracker:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const checks=[
 ["CG19 original immutable per-patient and per-appointment file permissions",
  s.sql.includes("CREATE TABLE cg19_patient_clinical_file_grant(")&&
  s.sql.includes("FOREIGN KEY(realm_id,file_id,patient_id)")&&
  s.sql.includes("FOREIGN KEY(realm_id,appointment_id,patient_id)")],
 ["exact doctor, center, original booking revision and consent revision are pinned",
  s.sql.includes("doctor_id uuid NOT NULL")&&
  s.sql.includes("center_id uuid NOT NULL")&&
  s.sql.includes("appointment_revision integer NOT NULL")&&
  s.sql.includes("care_consent_revision integer NOT NULL")&&
  s.sql.includes("REFERENCES cg15_patient_consent(root_realm_id,patient_id,purpose,revision_no)")],
 ["patient share request-key is idempotent, grant revoke/identity immutable",
  s.sql.includes("CREATE TABLE cg19_patient_clinical_file_grant_command(")&&
  s.sql.includes("cg19_patient_clinical_file_grant_change_guard")&&
  s.sql.includes("cg19_patient_clinical_file_grant_command_guard")&&
  s.service.includes("ON CONFLICT DO NOTHING RETURNING")&&
  s.service.includes("request_digest!==digest")],
 ["clinical file access has minimal append-only audit with NO private text",
  s.sql.includes("CREATE TABLE cg19_patient_clinical_file_read_event(")&&
  s.sql.includes("cg19_patient_clinical_read_event_guard")&&
  s.service.includes("INSERT INTO cg19_patient_clinical_file_read_event(")&&
  !s.sql.includes("diagnosis text")&&!s.sql.includes("phone_number text")],
 ["patient only current CG01 verified owner and current care consent grants",
  s.service.includes("cg15_patient_account_link link")&&
  s.service.includes("link.revoked_at IS NULL")&&
  s.service.includes("p.profile_status='VERIFIED'")&&
  s.service.includes("consent&&own.care_consent!==true")],
 ["patient only selects their own existing actual appointment, no phone/center search",
  s.service.includes("AND id=$2 AND patient_id=$3")&&
  s.service.includes("booking_state IN(")&&
  !s.service.includes("WHERE normalized_mobile")],
 ["clinician needs both CG01 visit actions and real currently accepted CG14 doctor account",
  s.service.includes('this.centers.assertCurrent(c,actor,center,"health.visits.manage")')&&
  s.service.includes('this.centers.assertCurrent(c,actor,center,"health.visits.clinical.manage")')&&
  s.service.includes("this.clinicians.assertCurrentAppointmentClinician(")&&
  s.clinician.includes("AND l.status='ACTIVE' AND l.accepted_at IS NOT NULL")],
 ["clinical reads tied to actual booked original patient and checked-in queue",
  s.service.includes("JOIN cg15_visit_queue v ON")&&
  s.service.includes("AND v.state IN('ARRIVED','WAITING','IN_CONSULTATION','COMPLETED')")&&
  s.service.includes("AND a.center_id=$2 AND a.id=$3")],
 ["client cannot re-use old grants after consent withdrawal/regrant, booking reschedule, account relink",
  s.service.includes("g.care_consent_revision=(SELECT x.revision_no")&&
  s.service.includes("g.appointment_revision=$6")&&
  s.service.includes("g.appointment_revision=$7")&&
  s.service.includes("live_owner.account_id=g.granted_by_account")&&
  s.service.includes("live_owner.revoked_at IS NULL")],
 ["malware-clean file and explicit active file-grant only, separate original private storage",
  s.service.includes("g.status='ACTIVE' AND g.revoked_at IS NULL")&&
  s.service.includes("f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED'")&&
  s.service.includes("this.objects.readVerifiedPrivateObject(")],
 ["second exact clinician/consent/read authorization after slow storage before disclosing bytes",
  s.service.includes("const original=await this.clinicalFile(")&&
  s.service.includes("const current=await this.clinicalFile(actor,center,booking,file,true)")&&
  s.service.includes('createHash("sha256").update(bytes)')],
 ["module registered under CG19 without importing its parent CG14 Nest module",
  s.module.includes("PatientClinicalFileSharingController")&&
  s.module.includes("PatientClinicalFileSharingService")&&
  s.module.includes("HealthClinicianIdentityService")&&
  !s.module.includes('import {HealthNetworkModule}')],
 ["backend controller status/file endpoints separate for patient and current clinician",
  s.ctrl.includes('Controller("api/documents/patient-clinical")')&&
  s.ctrl.includes('Post("me/files/:fileRef/shares")')&&
  s.ctrl.includes('Post("me/shares/:grantRef/revoke")')&&
  s.ctrl.includes('Get("centers/:centerRef/bookings/:bookingRef/files/:fileRef/download")')],
 ["Web BFF chooses correct existing patient/staff cookie and allows only protected paths",
  s.bff.includes('get(own?"cg_patient_session":"cg_staff_session")')&&
  s.bff.includes('method==="POST"&&req.headers.get("origin")')&&
  s.bff.includes("parts[6]==='download'")===false&&
  s.bff.includes('parts[6]==="download"')],
 ["Web patient explicitly selects a booking, can revoke; doctor only matching queue",
  s.patientWeb.includes("bookingRef:booking")&&
  s.patientWeb.includes('expectedVersion:row.version')&&
  s.patientPanel.includes("<PatientClinicalFileShares")&&
  s.doctorQueueWeb.includes("<ClinicianSharedPatientFiles")&&
  s.doctorQueueWeb.includes("clinicianAssignments.some(")],
 ["Public Android same patient grants and Internal Android same verified clinician view",
  s.patientNative.includes("bookingRef:selected")&&
  s.patientNative.includes('"/revoke"')&&
  s.patientPanelNative.includes("<NativePatientClinicalFileShares")&&
  s.doctorNative.includes("File.preview(")&&
  s.doctorQueueNative.includes("<NativeClinicianSharedPatientFiles")],
 ["migration 1440 and original 128 acceptance IDs preserved",
  s.migrations.includes("1440_cg19_patient_specific_clinical_file_grants.sql")&&
  s.pkg.includes("verify:cg15-patient-clinical-sharing-source")&&
  Array.from({length:8},(_,n)=>n+1).every(n=>
   Array.from({length:16},(_,i)=>
    "US-"+String(n).padStart(3,"0")+"-QA"+String(i+1).padStart(2,"0"))
    .every(id=>s.tracker.includes(id)))]
];
let bad=0;for(const [name,ok] of checks){
 process.stdout.write((ok?"SOURCE_PRESENT":"SOURCE_GAP")+" "+name+"\n");
 if(!ok)bad++;
}
process.stdout.write("Patient-approved clinician file grant source "+
 (checks.length-bad)+"/"+checks.length+
 "; actual SQL, clinician/consent races, private file scan, build/device QA NOT_RUN.\n");
if(bad)process.exitCode=1;
