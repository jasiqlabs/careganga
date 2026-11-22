import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {parseVolunteerCancel,parseVolunteerDraft,volunteerAvailabilities} from "../src/modules/cg-04-membership-volunteers/domain/volunteer-application-input";
import {opaqueAppointmentQr} from "../src/modules/cg-19-documents-notifications/application/cg19-appointment-qr";
import {parseVolunteerStaffIntake} from "../src/modules/cg-04-membership-volunteers/domain/volunteer-staff-intake-input";
/** SOURCE-CONTRACT ONLY. These tests do not constitute executed SQL/Web/Android CG04 QA. */
const key="11111111-1111-4111-8111-111111111111",state="22222222-2222-4222-8222-222222222222",
 district="33333333-3333-4333-8333-333333333333",branch="44444444-4444-4444-8444-444444444444",department="55555555-5555-4555-8555-555555555555";
const input=()=>({requestKey:key,firstName:"Amina",lastName:"Rahman",dateOfBirth:"2001-02-03",gender:"Female",bloodGroup:null,
 address:"Pune Foundation Road",city:"Pune",village:"",pinCode:"411028",stateRef:state,districtRef:district,
 branchRef:branch,departmentRef:department,availability:"WEEKENDS",skills:["Teaching","Community support"],experience:"Community activity",
 referral:"",consent:true});
const readRoot=(file:string)=>readFileSync(new URL("../../../"+file,import.meta.url),"utf8");
const sql=(name:string)=>readRoot("apps/backend/db/migrations/"+name);
test("US003-QA01/07/16 original verified self draft captures only approved personal/interest/department fields",()=>{
 const result=parseVolunteerDraft(input());
 assert.equal(result.first,"Amina");assert.equal(result.last,"Rahman");
 assert.equal(result.availability,"WEEKENDS");assert.equal(result.department,department);
 assert.deepEqual(result.skills,["Teaching","Community support"]);assert.equal(result.consentVersion,"VOLUNTEER_V1");
 for(const field of ["applicantAccountRef","accountRef","roleRef","staffRole","rootRealmId","approved","volunteerNumber"]){
  assert.equal(field in result,false);
 }
});
test("US003-QA04/15/20 only original four availability values, actual department required",()=>{
 assert.deepEqual(volunteerAvailabilities,["FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"]);
 for(const availability of ["ON_DUTY","ANY_TIME","PAID","FULLTIME",null])assert.throws(()=>parseVolunteerDraft({...input(),availability}));
 assert.throws(()=>parseVolunteerDraft({...input(),departmentRef:null}));
 assert.throws(()=>parseVolunteerDraft({...input(),departmentRef:"not-uuid"}));
});
test("US003-QA02/04 source rejects arbitrary staff, role, approval, payment and identity metadata",()=>{
 for(const field of ["rootRealmId","accountRef","roleRef","status","approved","proofVerified","isEmployee","monthlySalary","feeMinor","patientData","sourceVersion"]){
  assert.throws(()=>parseVolunteerDraft({...input(),[field]:"forged"}));
 }
});
test("US003-QA04 date, consent, PIN and branch validation are fail-closed",()=>{
 for(const v of ["2026-02-30","2026-13-01","2026-00-01","2026-02-29","2020-11-23T00:00:00Z","",undefined])assert.throws(()=>parseVolunteerDraft({...input(),dateOfBirth:v}));
 for(const v of ["004110","41102","4110287","abcdef",""])assert.throws(()=>parseVolunteerDraft({...input(),pinCode:v}));
 for(const v of [false,"true",undefined])assert.throws(()=>parseVolunteerDraft({...input(),consent:v}));
 for(const v of ["not-uuid","12345",123])assert.throws(()=>parseVolunteerDraft({...input(),branchRef:v}));
 assert.equal(parseVolunteerDraft({...input(),branchRef:""}).branch,null);
});
test("US003-QA01/02 blood group is private optional applicant value and cannot be elevated to medical proof",()=>{
 assert.equal(parseVolunteerDraft(input()).blood,null);
 assert.equal(parseVolunteerDraft({...input(),bloodGroup:"B+"}).blood,"B+");
 for(const v of ["Unknown","PLASMA","abc","O positive",42])assert.throws(()=>parseVolunteerDraft({...input(),bloodGroup:v}));
});
test("US003-QA15 capped normalized volunteer interests never grant payroll or attendance",()=>{
 const list=parseVolunteerDraft({...input(),skills:[" Community support ","Teaching"]}).skills;
 assert.deepEqual(list,["Community support","Teaching"]);
 assert.throws(()=>parseVolunteerDraft({...input(),skills:["teaching","Teaching"]}));
 assert.throws(()=>parseVolunteerDraft({...input(),skills:Array(21).fill("Test")}));
 assert.throws(()=>parseVolunteerDraft({...input(),skills:["\u0001"]}));
 assert.throws(()=>parseVolunteerDraft({...input(),availability:"EMPLOYEE"}));
});
test("US003-QA03/18 compare-and-swap edits and cancellation require current numeric revision",()=>{
 assert.equal(parseVolunteerDraft({...input(),expectedVersion:2},true).expected,2);
 for(const v of [undefined,"2",0,-1,1.3,2147483647])assert.throws(()=>parseVolunteerDraft({...input(),expectedVersion:v},true));
 assert.equal(parseVolunteerCancel({requestKey:key,expectedVersion:2}).expected,2);
 assert.throws(()=>parseVolunteerCancel({requestKey:key,expectedVersion:0}));
});
test("US003-QA02/03/07/18 actual source schema binds original applicant/root/CG03 approval and CG19 proof",()=>{
 const intake=sql("3212_cg04_volunteer_intake.sql"),evidence=sql("3213_cg19_volunteer_evidence.sql");
 const approval=sql("3214_cg03_volunteer_original_review.sql"),activation=sql("3215_cg04_verified_volunteer_activation.sql");
 assert.match(intake,/UNIQUE\(root_realm_id,account_ref\)/);
 assert.match(intake,/PRIMARY KEY\(root_realm_id,application_id\)/);
 assert.match(intake,/cg04_volunteer_command_commit/);
 assert.match(evidence,/VOLUNTEER_IDENTITY_PROOF/);
 assert.match(evidence,/CLEAN_VERIFIED/);
 assert.match(approval,/cg03_volunteer_decision_guard/);
 assert.match(approval,/source_digest/);
 assert.match(approval,/frozenProof|volunteer_review_snapshot/);
 assert.match(activation,/cg04_volunteer_approved_source/);
 assert.match(activation,/DEFERRABLE INITIALLY DEFERRED/);
 assert.doesNotMatch(activation,/INSERT INTO account_role|INSERT INTO finance_|INSERT INTO cg05_/);
});
test("US003-QA17 original optional issued volunteer card requires real CG19 approval, immutable private source and no public personal fields",()=>{
 const migration=sql("3217_cg19_verified_volunteer_card.sql");
 assert.match(migration,/FOREIGN KEY\(root_realm_id,volunteer_id\) REFERENCES volunteer/);
 assert.match(migration,/cg03_case decision/);
 assert.match(migration,/cg19_member_brand_config/);
 assert.match(migration,/ux_cg19_volunteer_card_current/);
 assert.match(migration,/OLD\.claim_expires_at<=now\(\)/);
 assert.match(migration,/cg19_volunteer_card_event_immutable/);
 const src=readRoot("apps/backend/src/modules/cg-19-documents-notifications/application/volunteer-card.service.ts");
 assert.match(src,/volunteers\.documents\.issue/);
 assert.match(src,/return valid\?\{valid:true,status:"ACTIVE"\}/);
 assert.match(src,/makeToken\(card\.root_realm_id,card\.id,card\.source_digest\)/);
 assert.doesNotMatch(src,/INSERT INTO account_role|INSERT INTO finance_|INSERT INTO cg05_/);
});
test("US003-QA14/18 authorized export audit is append-only and scoped, not a public phone directory",()=>{
 const evidence=sql("3216_cg04_volunteer_roster_export_audit.sql");
 assert.match(evidence,/REFERENCES account\(id,realm_id\)/);
 assert.match(evidence,/cg04_tier_history_immutable/);
 assert.match(evidence,/exported_rows integer NOT NULL CHECK\(exported_rows BETWEEN 0 AND 500\)/);
});

test("US003-QA17/19/20 volunteer-card source distinguishes outages and suppresses stale private displays",()=>{
 const backend=readRoot("apps/backend/src/modules/cg-19-documents-notifications/application/volunteer-card.service.ts");
 const issuer=readRoot("apps/web/src/features/volunteers/volunteer-card-manager.tsx");
 const own=readRoot("apps/web/src/features/volunteers/volunteer-own-card.tsx");
 const internal=readRoot("apps/android-internal/src/features/volunteers/native-volunteer-card-issuer.tsx");
 const publicNative=readRoot("apps/android-public/src/features/volunteers/native-volunteer-card.tsx");
 assert.match(backend,/key\(\); \/\/ An unavailable QR signing key is a service outage/);
 assert.match(backend,/throw new ServiceUnavailableException\("Current official volunteer verification is temporarily unavailable\."\)/);
 assert.match(issuer,/\[reload,setReload\]=useState\(0\)/);
 assert.match(issuer,/at===seq\.current&&document\.visibilityState==="visible"/);
 assert.match(issuer,/if\(!current\(\)\)return;/);
 assert.match(own,/!controller\.signal\.aborted&&document\.visibilityState==="visible"/);
 assert.match(internal,/at===seq\.current&&AppState\.currentState==="active"/);
 assert.match(publicNative,/at===seq\.current&&AppState\.currentState==="active"/);
});

test("US003-QA14/19 staff Android protected shares are source-guarded after asynchronous resume",()=>{
 const native=readRoot("apps/android-internal/src/features/volunteers/native-volunteer-staff.tsx");
 const first=native.indexOf("const fileAction=");
 const last=native.indexOf("const switchTo=",first);
 assert.ok(first>=0&&last>first,"original protected volunteer staff file action must be mounted");
 const files=native.slice(first,last);
 assert.match(files,/const current=\(\)=>active\.current&&seq\.current===at/);
 for(const mime of ["text/csv","application/pdf"]){
  if(mime==="text/csv"){
   const share=files.indexOf('Sharing.shareAsync(dest.uri,{mimeType:"text/csv"');
   const check=files.lastIndexOf("if(!current())return;",share);
   const availability=files.lastIndexOf("Sharing.isAvailableAsync()",share);
   assert.ok(share>0&&check>availability&&availability>0,"CSV export must recheck foreground immediately before native sharing");
  }else{
   const share=files.indexOf("Sharing.shareAsync(dest.uri,{mimeType:mime");
   const check=files.lastIndexOf("if(!current())return;",share);
   const availability=files.lastIndexOf("Sharing.isAvailableAsync()",share);
   assert.ok(share>0&&check>availability&&availability>0,"private proof must recheck foreground immediately before native sharing");
  }
 }
 assert.match(native,/if\(!active\.current\|\|seq\.current!==at\)return;/);
 assert.match(native,/try\{await work\(\);\}catch\(e\)\{\s*if\(at===seq\.current&&active\.current\)/);
});

test("US003-QA17 real CG19 QR encoder accepts only the original opaque code and produces a full 29-by-29 matrix",()=>{
 const code="CGV-0123456789ABCDEF01234567";
 const matrix=opaqueAppointmentQr(code);
 assert.equal(matrix.length,29);
 for(const row of matrix){assert.equal(row.length,29);for(const bit of row)assert.equal(typeof bit,"boolean");}
 assert.equal(matrix[3][3],true);
 assert.equal(matrix[22][22],true);
 assert.throws(()=>opaqueAppointmentQr("CGV-EXAMPLE"));
 assert.throws(()=>opaqueAppointmentQr("CGV-0123456789ABCDEF01234567?name=private"));
});

test("US003-QA17/19/20 historical volunteer card does not imply live eligibility across current Web and Android source",()=>{
 const read=(file:string)=>readRoot(file);
 const service=read("apps/backend/src/modules/cg-19-documents-notifications/application/volunteer-card.service.ts");
 assert.match(service,/private async present\(tx:PoolClient,c:Card\)/);
 assert.match(service,/await this\.check\(tx,c\);return status/);
 assert.match(service,/if\(!status\.canDownload&&!status\.canRetry\)return status/);
 assert.match(service,/if\(e instanceof ConflictException\)return \{\.\.\.status,canDownload:false,canRetry:false\}/);
 assert.match(service,/card:p\?await this\.present\(tx,p\):null/);
 assert.match(service,/return this\.present\(tx,await this\.actual\(tx,a\.realmId,ref\)\)/);
 assert.match(service,/items\.push\(await this\.present\(tx,card\)\)/);
 assert.match(service,/if\(!state\.claim\)return this\.run/);
 const webIssuer=read("apps/web/src/features/volunteers/volunteer-card-manager.tsx");
 const webOwn=read("apps/web/src/features/volunteers/volunteer-own-card.tsx");
 const nativeIssuer=read("apps/android-internal/src/features/volunteers/native-volunteer-card-issuer.tsx");
 const nativeOwn=read("apps/android-public/src/features/volunteers/native-volunteer-card.tsx");
 assert.match(webIssuer,/card\?\.status==="ISSUED"&&!card\.canDownload/);
 assert.match(webOwn,/v\.status==="ISSUED"/);
 assert.match(nativeIssuer,/card\?\.status==="ISSUED"&&!card\.canDownload/);
 assert.match(nativeOwn,/v\.status==="ISSUED"/);
});

test("US003-QA10 Web/Public Android only render the current published original volunteer Join route",()=>{
 const web=readRoot("apps/web/src/features/cms-public-content/cms-site-header.tsx");
 const native=readRoot("apps/android-public/src/features/cms/public-cms-screen.tsx");
 assert.match(web,/volunteerJoin\?\.visible===true&&navigation\.volunteerJoin\.path==="\/volunteer"/);
 assert.match(native,/data\.volunteerJoin\?\.visible===true&&data\.volunteerJoin\?\.path==="\/volunteer"/);
});

test("US003-QA17 expired CG19 verifying claim retry matches current state and five-attempt cap",()=>{
 const source=readRoot("apps/backend/src/modules/cg-19-documents-notifications/application/volunteer-card.service.ts");
 assert.match(source,/canRetry:v\.attempt_count<5/);
 assert.match(source,/v\.state==="VERIFYING"&&!!v\.claim_expires_at&&v\.claim_expires_at\.getTime\(\)<=Date\.now\(\)/);
 assert.match(source,/if\(p\.attempt_count>=5\)throw new ConflictException/);
 assert.match(source,/if\(p\.state==="VERIFYING"&&p\.claim_expires_at&&p\.claim_expires_at\.getTime\(\)>Date\.now\(\)\)/);
});

test("US003-QA06/13 original U14 single candidate and quoted CSV validation never includes consent or role",()=>{
 const rows=parseVolunteerStaffIntake({rows:[{firstName:" Amina ",lastName:"Rahman",mobile:"9876543210",city:"Pune"}]});
 assert.deepEqual(rows,[{firstName:"Amina",lastName:"Rahman",mobile:"+919876543210",city:"Pune"}]);
 const csv=parseVolunteerStaffIntake({csv:'First Name,Last Name,Mobile,City\r\nAmina,Rahman,+919876543210,"Pune, Maharashtra"\r\n'});
 assert.equal(csv.length,1);
 assert.equal(csv[0].city,"Pune, Maharashtra");
 const excel=parseVolunteerStaffIntake({csv:"\uFEFFFirst Name,Last Name,Mobile,City\nAmina,Rahman,9876543210,Pune"});
 assert.equal(excel[0].mobile,"+919876543210");
 for(const row of [...rows,...csv])for(const privateKey of ["consent","status","approval","role","isEmployee","proofVerified"])
  assert.equal(privateKey in row,false);
});
test("US003-QA04/06/13 U14 strictly rejects CSV injection, consent forgery, duplicate mobiles and oversized intake",()=>{
 const ok={firstName:"Amina",lastName:"Rahman",mobile:"9876543210",city:"Pune"};
 for(const invalid of [
  {rows:[{...ok,consent:true}]},{rows:[{...ok,status:"APPROVED"}]},
  {rows:[ok,ok]},{rows:[{...ok,mobile:"1234567890"}]},
  {rows:[{...ok,firstName:"=IMPORT()"}]},{rows:[]},
  {rows:Array(201).fill(ok)}, {csv:"First Name,Mobile\nAmina,9876543210"},
  {csv:'First Name,Last Name,Mobile,City\n"Amina,Rahman,9876543210,Pune'},
  {csv:"First Name,Last Name,Mobile,City\nAmina,Rahman,9876543210,=FORMULA"},
  {csv:"x".repeat(100001)}, {rows:[ok],rootRealmId:key}
 ])assert.throws(()=>parseVolunteerStaffIntake(invalid));
});
test("US003-QA11/12 task/visit persistence uses explicit volunteer identity, source check and no new role",()=>{
 const migration=sql("3218_cg04_current_volunteer_cg05_assignment.sql");
 assert.match(migration,/CREATE FUNCTION cg04_current_volunteer/);
 assert.match(migration,/ALTER TABLE project_task ADD COLUMN assignee_volunteer_ref uuid/);
 assert.match(migration,/ALTER TABLE field_visit ADD COLUMN actor_volunteer_ref uuid/);
 assert.match(migration,/cg04_task_volunteer_event_at_commit/);
 assert.match(migration,/cg04_visit_volunteer_event_at_commit/);
 assert.match(migration,/Accepted field visit volunteer assignment is immutable/);
 assert.doesNotMatch(migration,/INSERT INTO account_role|INSERT INTO finance_event|CREATE TABLE volunteer\(/);
 const tasks=readRoot("apps/backend/src/modules/cg-05-projects-field-operations/application/project-tasks.service.ts");
 const visits=readRoot("apps/backend/src/modules/cg-05-projects-field-operations/application/field-visits.service.ts");
 assert.match(tasks,/assignee_volunteer_ref=\$7/);
 assert.match(tasks,/requireCurrentVolunteer\(tx,a.realmId,target,p.branch_ref\)/);
 assert.match(tasks,/currentVolunteerPredicate\("v","aa.id","p.branch_ref"\)/);
 assert.match(visits,/await requireCurrentVolunteer\(tx,a.realmId,volunteerRef,p.branch_ref,account\)/);
 assert.match(visits,/t.assignee_volunteer_ref!==volunteerRef/);
 assert.match(visits,/x.volunteer===v.actor_volunteer_ref/);
});
test("US003-QA09 CG09 real U42 source and protected Web/Android submission never issues a payment",()=>{
 const migration=sql("3219_cg04_volunteer_cg09_claim_origin.sql");
 assert.match(migration,/ALTER TABLE expense_claim/);
 assert.match(migration,/cg04_current_volunteer/);
 assert.match(migration,/volunteer_entered_utr/);
 assert.doesNotMatch(migration,/INSERT INTO finance_journal|INSERT INTO finance_voucher|INSERT INTO finance_voucher_payment/);
 const claim=readRoot("apps/backend/src/modules/cg-09-finance-accounting/application/finance-expense-claim.service.ts");
 const web=readRoot("apps/web/src/features/volunteers/volunteer-reimbursement-panel.tsx");
 const native=readRoot("apps/android-internal/src/features/volunteers/native-volunteer-reimbursement.tsx");
 assert.match(claim,/this.identity.assertCurrent\(client,actor,"volunteers.view"\)/);
 assert.match(claim,/this.branches.projectBranchScope\(client,actor\)/);
 assert.match(claim,/CG09_VOLUNTEER_CLAIM_V1/);
 assert.match(web,/FinanceClaimBillTools/);
 assert.match(native,/FinanceClaimNativeBill/);
});
test("US003-QA06/13 U14 batch replay and verified self linkage never create an account or approval",()=>{
 const migration=sql("3220_cg04_volunteer_staff_draft_intake.sql");
 assert.match(migration,/UNIQUE\(root_realm_id,actor_ref,request_key\)/);
 assert.match(migration,/state='UNVERIFIED_DRAFT'/);
 assert.match(migration,/app.consent_version='VOLUNTEER_V1'/);
 assert.doesNotMatch(migration,/INSERT INTO account|INSERT INTO volunteer\(|INSERT INTO cg03_case/);
 const roster=readRoot("apps/backend/src/modules/cg-04-membership-volunteers/application/volunteer-roster.service.ts");
 const self=readRoot("apps/backend/src/modules/cg-04-membership-volunteers/application/volunteer-applications.service.ts");
 assert.match(roster,/async previewImport\(/);
 assert.match(roster,/async importDrafts\(/);
 assert.match(roster,/pg_advisory_xact_lock/);
 assert.match(roster,/CG04:VOLUNTEER_PHONE:/);
 assert.match(roster,/UNION SELECT contact_mobile FROM volunteer_application/);
 assert.match(self,/CG04:VOLUNTEER_PHONE:/);
 assert.match(self,/UPDATE volunteer_staff_intake_draft SET linked_application_id=\$3,linked_at=now\(\)/);
 assert.match(readRoot("apps/web/src/features/volunteers/volunteer-staff-intake.tsx"),/draft-only intake/);
 assert.match(readRoot("apps/android-internal/src/features/volunteers/native-volunteer-staff-intake.tsx"),/Confirm draft-only intake/);
});
