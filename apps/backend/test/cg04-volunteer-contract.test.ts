import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {parseVolunteerCancel,parseVolunteerDraft,volunteerAvailabilities} from "../src/modules/cg-04-membership-volunteers/domain/volunteer-application-input";
/** SOURCE-CONTRACT ONLY. These tests do not constitute executed SQL/Web/Android CG04 QA. */
const key="11111111-1111-4111-8111-111111111111",state="22222222-2222-4222-8222-222222222222",
 district="33333333-3333-4333-8333-333333333333",branch="44444444-4444-4444-8444-444444444444",department="55555555-5555-4555-8555-555555555555";
const input=()=>({requestKey:key,firstName:"Amina",lastName:"Rahman",dateOfBirth:"2001-02-03",gender:"Female",bloodGroup:null,
 address:"Pune Foundation Road",city:"Pune",village:"",pinCode:"411028",stateRef:state,districtRef:district,
 branchRef:branch,departmentRef:department,availability:"WEEKENDS",skills:["Teaching","Community support"],experience:"Community activity",
 referral:"",consent:true});
const sql=(name:string)=>readFileSync(join(process.cwd(),"db/migrations",name),"utf8");
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
 for(const v of ["not-uuid","",123])assert.throws(()=>parseVolunteerDraft({...input(),branchRef:v}));
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
 assert.match(intake,/UNIQUE\(root_realm_id,application_id\)/);
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
test("US003-QA14/18 authorized export audit is append-only and scoped, not a public phone directory",()=>{
 const evidence=sql("3216_cg04_volunteer_roster_export_audit.sql");
 assert.match(evidence,/REFERENCES account\(id,realm_id\)/);
 assert.match(evidence,/cg04_tier_history_immutable/);
 assert.match(evidence,/exported_rows integer NOT NULL CHECK\(exported_rows BETWEEN 0 AND 500\)/);
});
