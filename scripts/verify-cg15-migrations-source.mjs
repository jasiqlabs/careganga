/**
 * Manual CG-15 / CG-01 patient / CG-03 doctor leave migration source preflight.
 * Detects repeated malformed DDL, broken string/dollar quotes, stray fragments,
 * mismatched parentheses and missing PL/pgSQL END; delimiters.
 *
 * IMPORTANT: This is a lexical SOURCE check, not a PostgreSQL parser.
 * It does NOT replace executing every migration on a clean isolated DB,
 * rollback/restore, concurrent booking tests, or professional DB review.
 * No CI or GitHub Actions.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const files=[
 "1420_cg15_doctor_schedule_original_source.sql",
 "1421_cg15_original_doctor_leave_cg03_review.sql",
 "1422_cg15_patient_self_consent.sql",
 "1423_cg15_center_provisional_patient_intake.sql",
 "1424_cg15_consultation_reservation_and_appointments.sql",
 "1425_cg15_visit_queue_and_booking_changes.sql",
 "1426_cg19_private_consultation_slip.sql",
 "1427_cg01_public_patient_password_identity.sql",
 "1428_cg15_in_person_patient_identity_verification.sql",
 "1429_cg15_patient_center_intake_claim.sql",
 "1430_cg15_patient_assisted_booking_authorization.sql",
 "1431_cg15_patient_claim_attempt_throttle.sql",
 "1432_cg15_center_day_appointment_index.sql",
 "1433_cg19_appointment_event_notification_source.sql",
 "1434_cg15_center_qr_verification_guard.sql",
 "1435_cg19_appointment_pending_recovery_global.sql",
 "1436_cg14_verified_clinician_account_link.sql",
 "1437_cg15_private_consultation_intent_consent.sql",
 "1438_cg19_patient_owned_private_files.sql",
 "1439_cg15_private_patient_optional_details.sql",
 "1440_cg19_patient_specific_clinical_file_grants.sql",
 "1441_cg01_shared_family_phone_patient_email_login.sql",
 "1442_cg15_verified_patient_explicit_secondary_account.sql",
 "1443_cg15_dependent_intake_authorization_context.sql",
 "1444_cg15_protected_duplicate_patient_review.sql"
];
function inspect(sql,minimumStatements=3){
 const errors=[],statements=[],parentheses=[];
 let mode="normal",tag="",at=0,line=1,startedLine=1;
 for(let i=0;i<sql.length;i++){
  const char=sql[i],next=sql[i+1];
  if(char==="\n")line++;
  if(mode==="line"){if(char==="\n")mode="normal";continue;}
  if(mode==="block"){
   if(char==="*"&&next==="/"){mode="normal";i++;}
   continue;
  }
  if(mode==="single"){
   if(char==="'"&&next==="'"){i++;continue;}
   if(char==="'")mode="normal";
   continue;
  }
  if(mode==="double"){
   if(char==='"'&&next==='"'){i++;continue;}
   if(char==='"')mode="normal";
   continue;
  }
  if(char==="-"&&next==="-"){mode="line";i++;continue;}
  if(char==="/"&&next==="*"){mode="block";i++;continue;}
  if(char==="'"){mode="single";continue;}
  if(char==='"'){mode="double";continue;}
  if(char==="$"){
   const found=sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
   if(found){
    tag=found[0];
    const end=sql.indexOf(tag,i+tag.length);
    if(end<0){errors.push("Unclosed PL/pgSQL dollar quote at line "+line);break;}
    const body=sql.slice(i+tag.length,end);
    if(!/\bEND;\s*$/i.test(body))
     errors.push("PL/pgSQL block lacks END; at line "+line);
    line+=(sql.slice(i,end+tag.length).match(/\n/g)||[]).length;
    i=end+tag.length-1;
    continue;
   }
  }
  if(char==="(")parentheses.push(line);
  if(char===")"){
   if(!parentheses.length)errors.push("Unexpected closing parenthesis at line "+line);
   else parentheses.pop();
  }
  if(char===";"){
   statements.push({text:sql.slice(at,i+1),line:startedLine});
   at=i+1;startedLine=line;
  }
 }
 if(mode!=="normal"&&mode!=="line")
  errors.push("Unclosed SQL "+mode+" at end");
 if(parentheses.length)
  errors.push("Unclosed parentheses near line "+parentheses.slice(-1)[0]);
 const stripComments=s=>s.replace(/--[^\n]*/g," ")
  .replace(/\/\*[\s\S]*?\*\//g," ").trim();
 const last=stripComments(sql.slice(at));
 if(last)errors.push("Unterminated final SQL near line "+startedLine);
 const seen=new Set();
 let named=0;
 for(const part of statements){
  const clean=stripComments(part.text);
  if(!clean)continue;
  if(!/^(CREATE|ALTER|DO|INSERT|UPDATE|DELETE|DROP|COMMENT|GRANT|REVOKE|WITH|SELECT|SET)\b/i.test(clean))
   errors.push("Unknown SQL statement near line "+part.line+": "+clean.slice(0,55));
  const create=clean.match(/^CREATE\s+(?:OR REPLACE\s+)?(?:UNIQUE\s+)?(TABLE|INDEX|FUNCTION|TRIGGER)\s+([A-Za-z_][A-Za-z_0-9]*)/i);
  const constraint=clean.match(/^ALTER\s+TABLE\s+([A-Za-z_][A-Za-z_0-9]*)\s+ADD\s+CONSTRAINT\s+([A-Za-z_][A-Za-z_0-9]*)/i);
  const key=create?"CREATE:"+create[1].toUpperCase()+":"+create[2].toLowerCase():
   constraint?"CONSTRAINT:"+constraint[1].toLowerCase()+":"+constraint[2].toLowerCase():null;
  if(key){
   named++;
   if(seen.has(key))errors.push("Duplicate DDL definition: "+key);
   seen.add(key);
  }
 }
 if(statements.length<minimumStatements)errors.push("Migration has too few complete statements");
 return {statements:statements.length,named,errors};
}
let failures=0;
for(const name of files){
 const path=resolve(root,"apps/backend/db/migrations",name);
 let source="";
 try{source=readFileSync(path,"utf8");}
 catch(e){process.stderr.write("SOURCE_GAP "+name+": file missing\n");failures++;continue;}
 const result=inspect(source,/^143[25]_/.test(name)?2:3);
 if(source.includes("\u0000"))result.errors.push("SQL contains a NUL byte");
 if(name.startsWith("1421")&&
  (!source.includes("cg15_exception_digest ~ '^[0-9a-f]{64}$'")||
   (source.match(/CREATE OR REPLACE FUNCTION cg03_health_source_immutable/g)||[]).length!==1))
  result.errors.push("CG03 doctor leave source digest or one-function invariant broken");
 if(name.startsWith("1423")&&
  ((source.match(/CREATE TABLE cg15_patient_center_intake/g)||[]).length!==1||
   (source.match(/CREATE TRIGGER cg15_center_intake_provenance_immutable/g)||[]).length!==1))
  result.errors.push("Provisional center intake has duplicated/missing protected schema");
 if(name.startsWith("1428")&&
  (!source.includes("CREATE TABLE cg15_patient_identity_challenge")||
   !source.includes("CREATE TABLE cg15_patient_identity_event")||
   !source.includes("'IDENTITY_VERIFIED'")||
   !source.includes("cg15_patient_identity_event_immutable")))
  result.errors.push("Patient-specific clinician identity verification or audit source missing");
 if(name.startsWith("1429")&&
  (!source.includes("CREATE TABLE cg15_patient_center_claim")||
   !source.includes("cg15_patient_center_claim_immutable")||
   !source.includes("identity_checked_in_person boolean NOT NULL")))
  result.errors.push("Clinic patient identity claim source or provenance guard missing");
 if(name.startsWith("1430")&&
  (!source.includes("CREATE TABLE cg15_patient_assisted_booking_code")||
   !source.includes("FOREIGN KEY(root_realm_id,hold_id,patient_id,center_id)")||
   !source.includes("cg15_assisted_booking_code_immutable")||
   !source.includes("WHERE consumed_at IS NULL AND revoked_at IS NULL")))
  result.errors.push("Patient-authorized clinic booking proof source is incomplete");
 if(name.startsWith("1434")&&
  (!source.includes("CREATE TABLE cg15_center_qr_verify_budget")||
   !source.includes("PRIMARY KEY(root_realm_id,actor_account_id,center_id)")||
   !source.includes("CREATE TABLE cg15_center_qr_verification_audit")||
   !source.includes("cg15_qr_verification_audit_immutable")||
   !source.includes("REFERENCES health_center(root_realm_id,id) ON DELETE RESTRICT")))
  result.errors.push("Original center QR verification abuse guard/audit source is incomplete");
 if(name.startsWith("1440")&&
  (!source.includes("CREATE TABLE cg19_patient_clinical_file_grant(")||
   !source.includes("FOREIGN KEY(realm_id,appointment_id,patient_id)")||
   !source.includes("care_consent_revision integer NOT NULL")||
   !source.includes("appointment_revision integer NOT NULL")||
   !source.includes("CREATE TABLE cg19_patient_clinical_file_grant_command(")||
   !source.includes("cg19_patient_clinical_file_grant_change_guard")||
   !source.includes("cg19_patient_clinical_file_grant_event_guard")||
   !source.includes("CREATE TABLE cg19_patient_clinical_file_read_event(")||
   !source.includes("cg19_patient_clinical_read_event_guard")))
  result.errors.push("Original patient-accepted exact-booking CG19 scanned-file consent and nonclinical access audit source missing");
 if(name.startsWith("1439")&&
  (!source.includes("CREATE TABLE cg15_patient_private_details(")||
   !source.includes("CREATE TABLE cg15_patient_private_details_event(")||
   !source.includes("cg15_patient_private_details_event_guard")))
  result.errors.push("CG15 optional encrypted patient context and append-only event source missing");
 if(name.startsWith("1438")&&
  (!source.includes("CREATE TABLE cg19_patient_file_intent(")||
   !source.includes("CREATE TABLE cg19_patient_private_file(")||
   !source.includes("CREATE TABLE cg19_patient_file_event(")||
   !source.includes("cg19_patient_private_file_identity_guard")||
   !source.includes("cg19_patient_file_event_immutable_guard")))
  result.errors.push("CG19 patient-scanned file identity, verified clean document and immutable revocation source missing");
 if(name.startsWith("1436")&&
  (!source.includes("CREATE TABLE health_doctor_account_link(")||
   !source.includes("CREATE TABLE health_doctor_account_link_event(")||
   !source.includes("ux_health_doctor_current_account")||
   !source.includes("ux_health_account_current_doctor")||
   !source.includes("proposed_by<>account_id")||
   !source.includes("health_doctor_account_event_immutable_guard")))
  result.errors.push("Original CG14 doctor-to-current-account two-party identity source missing");
 if(name.startsWith("1435")&&
  (!source.includes("CREATE INDEX ix_cg19_appointment_pending_recovery_global")||
   !source.includes("ON cg19_appointment_event_outbox(recorded_at,realm_id,event_id)")||
   !source.includes("WHERE state='PENDING'")))
  result.errors.push("Global bounded original appointment/queue recovery index missing");
 if(name.startsWith("1433")&&
  (!source.includes("CREATE TABLE cg19_appointment_event_outbox")||
   !source.includes("PRIMARY KEY(realm_id,event_id)")||
   !source.includes("WHERE state='PENDING'")||
   !source.includes("REFERENCES cg15_appointment_event(root_realm_id,id)")||
   !source.includes("source_kind IN ('CG03_DECISION','NOTICE','CG15_APPOINTMENT')")||
   !source.includes("pg_notify('cg19_appointment_committed'")||
   !source.includes("AFTER INSERT ON cg15_appointment_event")))
  result.errors.push("Original CG15 -> CG19 transactional notification outbox is incomplete");
 if(name.startsWith("1432")&&
  (!source.includes("CREATE INDEX ix_cg15_appointment_center_local_day")||
   !source.includes("((start_at AT TIME ZONE time_zone)::date)")||
   !source.includes("root_realm_id,center_id")))
  result.errors.push("The original center-local appointment-day index is incomplete");
 if(name.startsWith("1431")&&
  (!source.includes("CREATE TABLE cg15_patient_claim_attempt_throttle")||
   !source.includes("PRIMARY KEY(root_realm_id,account_id)")||
   !source.includes("REFERENCES account(id,realm_id) ON DELETE RESTRICT")))
  result.errors.push("The authenticated patient claim throttle source is incomplete");
 if(name.startsWith("1425")&&
  ((source.match(/CREATE TABLE cg15_visit_event/g)||[]).length!==1||
   (source.match(/CREATE TRIGGER cg15_visit_event_immutable/g)||[]).length!==1||
   !source.includes("CHECK(request_digest ~ '^[a-f0-9]{64}$')")))
  result.errors.push("Visit queue event source was corrupted or duplicated");
 if(result.errors.length){failures++;process.stderr.write(
  "SOURCE_GAP "+name+": "+result.errors.join("; ")+"\n");}
 else process.stdout.write("SOURCE_PRESENT "+name+": "+result.statements+
  " statements, "+result.named+" named DDL (lexical preflight only)\n");
}
process.stdout.write("CG-15 migration source preflight: "+
 (files.length-failures)+"/"+files.length+
 " source-valid; NOT executed PostgreSQL migration/rollback/QA.\n");
if(failures)process.exitCode=1;
