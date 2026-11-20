/**
 * CG15 original US-004-QA11 private consultation purpose/consent snapshot.
 * Local lexical preflight ONLY. Run on an actual checkout; NOT SQL execution,
 * cryptographic audit, native/Web build or original QA PASS.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const source=p=>readFileSync(resolve(root,p),"utf8");
const s={
 migration:source("apps/backend/db/migrations/1437_cg15_private_consultation_intent_consent.sql"),
 protection:source("apps/backend/src/modules/cg-15-patients-appointments/application/booking-intent-protection.ts"),
 booking:source("apps/backend/src/modules/cg-15-patients-appointments/application/consultation-booking.service.ts"),
 web:source("apps/web/src/features/appointments/patient-booking-action.tsx"),
 native:source("apps/android-public/src/features/appointments/native-consultation-action.tsx"),
 env:source(".env.example"),
 error:source("apps/backend/src/core/http/safe-error-copy.ts"),
 migrations:source("scripts/verify-cg15-migrations-source.mjs"),
 pkg:source("package.json")
};
const checks=[
 ["actual patient care consent and original booking composite keys",
  s.migration.includes("CREATE TABLE cg15_consultation_private_intent")&&
  s.migration.includes("REFERENCES cg15_consultation_appointment(root_realm_id,id)")&&
  s.migration.includes("REFERENCES cg15_patient_consent(root_realm_id,patient_id,purpose,revision_no)")],
 ["exact optional reason protected with AES-256-GCM and random 96-bit nonce",
  s.protection.includes('createCipheriv("aes-256-gcm",key,iv)')&&
  s.protection.includes("randomBytes(12)")&&
  s.protection.includes("cipher.getAuthTag()")],
 ["decryption AAD binds the exact Foundation and booking context",
  s.protection.includes('realm+":"+booking+":PATIENT_CARE"')&&
  s.protection.includes("cipher.setAAD(")],
 ["no unsafe default or fallback key, optional input only and 300-character limit",
  s.protection.includes("CG15_BOOKING_REASON_KEY_BASE64")&&
  s.protection.includes("key.length!==32")&&
  s.protection.includes('raw===undefined||raw===null||raw===""')&&
  s.protection.includes("value.length>300")&&
  !s.protection.includes("randomBytes(32)")],
 ["existing no-reason confirmation idempotency digest remains unchanged",
  s.booking.includes('...(reason?{reasonDigest:reason.signatureDigest}:{})')&&
  s.protection.includes('createHmac("sha256",key)')&&
  s.booking.includes("prepareConsultationReason(v.reasonForVisit,assisted)")],
 ["only patient may submit private reason; staff booking cannot inject it",
  s.booking.includes('...(assisted?[]:["reasonForVisit"])')&&
  s.protection.includes('if(assisted||typeof raw!=="string")')],
 ["atomic real current consent snapshot in original CG15 confirmation",
  s.booking.includes("ORDER BY revision_no DESC LIMIT 1")&&
  s.booking.includes("if(!care?.granted)")&&
  s.booking.includes("INSERT INTO cg15_consultation_private_intent(")&&
  s.booking.includes("consent_terms_version,consent_recorded_at,reason_ciphertext")],
 ["immutable encrypted protected column shape, never plain event snapshot",
  s.migration.includes("cg15_private_intent_history_guard")&&
  s.migration.includes("octet_length(reason_auth_tag)=16")&&
  s.migration.includes("octet_length(reason_iv)=12")&&
  s.booking.includes("await this.event(tx,actor,booking.rows[0],0,")&&
  !s.booking.includes("JSON.stringify({reasonForVisit")],
 ["Web and Android pass reason to original confirmation only, not hold/QR",
  s.web.includes("reasonForVisit:confirmedReason.current")&&
  s.native.includes("reasonForVisit:confirmedReason.current")&&
  s.web.includes("maxLength={300}")&&
  s.native.includes("maxLength={300}")],
 ["backend-only secret, explicit failure and migration manually checked",
  s.env.includes("CG15_BOOKING_REASON_KEY_BASE64=")&&
  s.error.includes("CG15_BOOKING_PRIVATE_REASON_UNAVAILABLE")&&
  s.migrations.includes('"1437_cg15_private_consultation_intent_consent.sql"')&&
  s.pkg.includes("verify:cg15-private-purpose-source")]
];
let gaps=0;
for(const [name,passed] of checks){
 process.stdout.write((passed?"SOURCE_PRESENT":"SOURCE_GAP")+" "+name+"\n");
 if(!passed)gaps++;
}
process.stdout.write("CG15 private purpose source "+(checks.length-gaps)+"/"+checks.length+
 "; no SQL, actual crypto bytes test, Web/native build, consent race or QA PASS.\n");
if(gaps)process.exitCode=1;
