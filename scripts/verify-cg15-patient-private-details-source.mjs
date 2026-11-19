/**
 * Original CG15 US-003-QA07 optional patient-only private context.
 * Source-level wiring only. Requires local real PostgreSQL 1439, Web and
 * Android build, AES-GCM roundtrip, consent concurrency, security QA.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const s=p=>readFileSync(resolve(import.meta.dirname,"..",p),"utf8");
const v={
 sql:s("apps/backend/db/migrations/1439_cg15_private_patient_optional_details.sql"),
 owner:s("apps/backend/src/modules/cg-15-patients-appointments/application/patient-private-details.service.ts"),
 ctrl:s("apps/backend/src/modules/cg-15-patients-appointments/http/patient-profile.controller.ts"),
 mod:s("apps/backend/src/modules/cg-15-patients-appointments/patients-appointments.module.ts"),
 bff:s("apps/web/src/app/api/patients/[...parts]/route.ts"),
 web:s("apps/web/src/features/patients/patient-private-details-panel.tsx"),
 webProfile:s("apps/web/src/features/patients/patient-profile-panel.tsx"),
 native:s("apps/android-public/src/features/patients/native-patient-private-details.tsx"),
 nativeProfile:s("apps/android-public/src/features/patients/patient-profile-native.tsx"),
 env:s(".env.example"),
 migration:s("scripts/verify-cg15-migrations-source.mjs"),
 pkg:s("package.json"),
 tracker:s("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const checks=[
 ["real encrypted source + composite patient FK, append-only nonclinical change audit",
  v.sql.includes("CREATE TABLE cg15_patient_private_details(")&&
  v.sql.includes("CREATE TABLE cg15_patient_private_details_event(")&&
  v.sql.includes("cg15_patient_private_details_event_guard")&&
  v.sql.includes("REFERENCES cg15_patient(root_realm_id,id)")],
 ["AES-256-GCM with new nonce, auth tag and account-root patient AAD",
  v.owner.includes('createCipheriv("aes-256-gcm",key,nonce)')&&
  v.owner.includes('createDecipheriv("aes-256-gcm",key,record.nonce)')&&
  v.owner.includes("randomBytes(12)")&&v.owner.includes("cipher.getAuthTag()")&&
  v.owner.includes('realm+":"+patient+":CG15_PATIENT_PRIVATE:v1"')],
 ["separate canonical backend-only 32-byte secret and no fallback",
  v.env.includes("CG15_PATIENT_DETAILS_KEY_BASE64=")&&
  v.owner.includes("CG15_PATIENT_DETAILS_KEY_BASE64")&&
  v.owner.includes("key.length!==32")&&!v.owner.includes("randomBytes(32)")],
 ["only current verified personally linked patient from original CG01 source",
  v.owner.includes("cg15_patient_account_link l")&&
  v.owner.includes("l.revoked_at IS NULL")&&
  v.owner.includes("p.profile_status='VERIFIED'")&&
  v.owner.includes("cg15_patient_identity_event proof")&&
  v.owner.includes("a.status='ACTIVE'")],
 ["patient care consent and patient lock required for writes",
  v.owner.includes("x.purpose='PATIENT_CARE'")&&
  v.owner.includes("if(!row||(write&&row.consent_granted!==true))")&&
  v.owner.includes('write?"FOR UPDATE OF p":"FOR SHARE OF p,l,a"')],
 ["patient emergency contact never used to auto-link accounts",
  v.owner.includes("emergencyMobile")&&
  !v.owner.includes("WHERE normalized_mobile=")&&
  !v.owner.includes("UPDATE cg15_patient_account_link SET")],
 ["only bounded optional blood group, emergency and user-supplied medical context",
  v.owner.includes("const GROUPS=new Set(")&&
  v.owner.includes("emergencyName")&&
  v.owner.includes("emergencyMobile")&&
  v.owner.includes("cleanText(body.medicalInfo,500")],
 ["independent CAS revision and append-only protected audit no plaintext medical values",
  v.owner.includes("current!==expectedVersion")&&
  v.owner.includes("private_ciphertext=$3")&&
  v.owner.includes("INSERT INTO cg15_patient_private_details_event(")&&
  !v.sql.includes("medicalInfo text")],
 ["current signed-in patient-only GET/POST; no healthcare staff/public endpoint",
  v.ctrl.includes('Get("me/private-details")')&&
  v.ctrl.includes('Post("me/private-details")')&&
  v.bff.includes('route==="me/private-details"&&["GET","POST"].includes(method)')&&
  v.mod.includes("PatientPrivateDetailsService")],
 ["existing verified Web patient profile contains protected self-only form",
  v.webProfile.includes("<PatientPrivateDetailsPanel")&&
  v.web.includes("PatientPrivateDetailsPanel")&&
  v.web.includes("Save my private details")],
 ["existing verified Android patient profile has matching self-only form",
  v.nativeProfile.includes("<NativePatientPrivateDetails")&&
  v.native.includes("NativePatientPrivateDetails")&&
  v.native.includes("Save private details")],
 ["migration guard, manual script and all original QA cases unchanged",
  v.migration.includes("1439_cg15_private_patient_optional_details.sql")&&
  v.pkg.includes("verify:cg15-patient-private-details-source")&&
  Array.from({length:8},(_,n)=>n+1).every(n=>
   Array.from({length:16},(_,i)=>"US-"+String(n).padStart(3,"0")+
    "-QA"+String(i+1).padStart(2,"0")).every(id=>v.tracker.includes(id)))]
];
let fail=0;
for(const [name,pass] of checks){
 process.stdout.write((pass?"SOURCE_PRESENT":"SOURCE_GAP")+" "+name+"\n");
 if(!pass)fail++;
}
process.stdout.write("CG15 optional private details source "+(checks.length-fail)+
 "/"+checks.length+"; NOT executed migration, Web/native build or QA PASS.\n");
if(fail)process.exitCode=1;
