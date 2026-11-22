import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseCampaignDraft} from "../src/modules/cg-07-campaigns-donations/domain/campaign-draft-input";

const id="11111111-1111-4111-8111-111111111111";
const project="22222222-2222-4222-8222-222222222222";
const event="33333333-3333-4333-8333-333333333333";
const branch="44444444-4444-4444-8444-444444444444";
const area="55555555-5555-4555-8555-555555555555";
const root=(path:string)=>readFileSync(new URL("../../../"+path,import.meta.url),"utf8");
const normal=()=>({requestKey:id,steps:{
 basic:{title:"Community Health Fund",type:"GENERAL",summary:"Helping eligible families",description:"Actual Foundation campaign.",tags:["Support","Community"]},
 project:{category:"Healthcare",branchRef:branch,stateRef:area,districtRef:null,location:"Pune",targetGroup:"Eligible families",plannedBeneficiaries:100,projectRef:project,eventRef:event},
 team:{coordinatorRef:id,volunteerRef:null},
 budget:{goal:"1234.50",expectedCost:"222.25",startAt:"2026-11-25",endAt:"2027-02-24"},
 media:{fileRef:null,alt:""},review:{}
}});
test("US001-QA01/14: original six steps normalize INR into exact bigint minor units without saving money",()=>{
 const draft=parseCampaignDraft(normal());
 assert.equal(draft.basic.title,"Community Health Fund");
 assert.equal(draft.budget.goalMinor,"123450");
 assert.equal(draft.budget.expectedCostMinor,"22225");
 assert.equal(draft.project.projectRef,project);
 assert.equal(draft.project.eventRef,event);
 assert.equal(draft.team.coordinatorRef,id);
 assert.equal(draft.expected,null);
 assert.deepEqual(Object.keys(draft).sort(),["basic","budget","expected","key","media","project","review","team"].sort());
});
test("US001-QA03/07: edit requires CAS version and original idempotency key",()=>{
 const request=normal();
 assert.equal(parseCampaignDraft({...request,expectedVersion:7},true).expected,7);
 for(const value of [null,0,-1,1.5,"1",2147483648])assert.throws(()=>parseCampaignDraft({...request,expectedVersion:value},true));
 assert.throws(()=>parseCampaignDraft({...request,expectedVersion:1}));
 assert.throws(()=>parseCampaignDraft({...request,requestKey:"unverified"}));
});
test("US001-QA02/04: reject scope spoof, untyped source refs and unsafe content before DB",()=>{
 const request=normal();
 for(const extra of [{rootRealmId:id},{status:"PUBLISHED"},{receivedMinor:"12345"},{approvalCaseRef:id},{donationRef:id}])
  assert.throws(()=>parseCampaignDraft({...request,...extra}));
 for(const changes of [
  {basic:{...request.steps.basic,title:"<script>alert(1)</script>"}},
  {basic:{...request.steps.basic,tags:["repeated","REPEATED"]}},
  {project:{...request.steps.project,branchRef:"foreign"}},
  {project:{...request.steps.project,plannedBeneficiaries:-1}},
  {budget:{...request.steps.budget,goal:"1e4"}},
  {budget:{...request.steps.budget,goal:"1.000"}},
  {budget:{...request.steps.budget,startAt:"2026-02-30"}},
  {budget:{...request.steps.budget,endAt:"2026-11-22"}},
  {media:{...request.steps.media,publicUrl:"https://example.com"}},
  {review:{approved:true}},
 ]){
  const [key,value]=Object.entries(changes)[0];
  assert.throws(()=>parseCampaignDraft({...request,steps:{...request.steps,[key]:value}}));
 }
});
test("US001-QA16: no planned goal treated as actual receipts or finance posting",()=>{
 const draft=parseCampaignDraft({...normal(),steps:{...normal().steps,budget:{goal:"",expectedCost:"",startAt:"",endAt:""}}});
 assert.equal(draft.budget.goalMinor,null);
 assert.equal(draft.budget.expectedCostMinor,null);
 for(const word of ["donor","paid","journal","receipt","verifiedCollection"])
  assert.equal(word in draft,false);
});
test("US001-QA09/10/17/19: source migration retains real CG05 composite project/event FKs, immutable revision, no donation shadow",()=>{
 const sql=root("apps/backend/db/migrations/3301_cg07_campaign_draft.sql");
 assert.match(sql,/FOREIGN KEY\(root_realm_id,project_source_ref\) REFERENCES project\(root_realm_id,id\)/);
 assert.match(sql,/FOREIGN KEY\(root_realm_id,event_source_ref\) REFERENCES project_activity\(root_realm_id,id\)/);
 assert.match(sql,/UNIQUE\(root_realm_id,actor_ref,request_key\)/);
 assert.match(sql,/cg07_campaign_revision_immutable/);
 assert.doesNotMatch(sql,/CREATE TABLE donation\(/);
 const source=root("apps/backend/src/modules/cg-05-projects-field-operations/application/campaign-link-source.facade.ts");
 assert.match(source,/p.status='ACTIVE'/);
 assert.match(source,/e.status IN\('SCHEDULED','ONGOING'\)/);
 assert.match(source,/eventSource.project_id!==project/);
 assert.match(source,/FOR SHARE/);
});
test("US001-QA02/03/04/05/06/20: same owner source on guarded backend, Web and Internal Android, not public money",()=>{
 const service=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 const controller=root("apps/backend/src/modules/cg-07-campaigns-donations/http/campaign-drafts.controller.ts");
 const web=root("apps/web/src/features/campaigns/campaign-drafts-workspace.tsx");
 const mobile=root("apps/android-internal/src/features/campaigns/native-campaign-drafts.tsx");
 const bff=root("apps/web/src/app/api/campaigns/[[...parts]]/route.ts");
 assert.match(service,/sessions.requireAction\(token,capability\)/);
 assert.match(service,/projectEvents.requireCurrent\(tx,a,p.branchRef,p.projectRef,p.eventRef\)/);
 assert.match(service,/projectBranchScope\(tx,a\)/);
 assert.match(service,/pg_advisory_xact_lock/);
 assert.match(service,/current_revision=current_revision\+1,version=version\+1/);
 assert.match(controller,/@Get\("options"\)/);
 assert.match(bff,/req.headers.get\("origin"\)!==req.nextUrl.origin/);
 assert.match(bff,/\["q","stateRef","branchRef"\]/);
 assert.match(web,/Current active project/);
 assert.match(web,/Submit for Verification \(not yet available\)/);
 assert.match(mobile,/Current active project/);
 assert.match(mobile,/Submit for Verification \(not available\)/);
 assert.doesNotMatch(service,/INSERT INTO finance_journal|INSERT INTO donation|PUBLISHED' RETURNING/);
});
