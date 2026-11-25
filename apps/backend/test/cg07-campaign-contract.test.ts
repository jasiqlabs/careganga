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
 assert.match(web,/Submit for Verification/);
 assert.match(web,/submitForReview/);
 assert.match(mobile,/Current active project/);
 assert.match(mobile,/Submit for Verification/);
 assert.match(mobile,/submitForReview/);
 assert.doesNotMatch(service,/INSERT INTO finance_journal|INSERT INTO donation|PUBLISHED' RETURNING/);
});

test("US001-QA11/12/19: original CG03 campaign launch keeps review snapshot, case and decision and separate publication",()=>{
 const sql=root("apps/backend/db/migrations/3302_cg07_original_cg03_campaign_review.sql");
 const owner=root("apps/backend/src/modules/cg-03-registration-approvals/application/campaign-review.service.ts");
 const source=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 const controller=root("apps/backend/src/modules/cg-03-registration-approvals/http/campaign-review.controller.ts");
 for(const clause of ["campaign_review_snapshot","cg03_campaign_process_current",
  "CAMPAIGN_LAUNCH","cg03_campaign_case_write","cg03_campaign_decision_insert",
  "cg03_campaign_source_disjoint","fk_cg03_campaign_exact"])assert.ok(sql.includes(clause));
 assert.match(sql,/FOREIGN KEY\(root_realm_id,campaign_id,source_revision,source_digest\)/);
 assert.match(owner,/requireDistinctFinalReviewer/);
 assert.match(owner,/requireFreshFoundationRootProof/);
 assert.match(owner,/originalCase\(/);
 assert.match(owner,/acceptReviewEffect\(/);
 assert.match(owner,/campaigns\.review/);
 assert.match(source,/freezeForReview\(/);
 assert.match(source,/source_status='SUBMITTED'/);
 assert.match(source,/status='ACTIVE'/);
 assert.match(controller,/@Post\(":ref\/submit"\)/);
 assert.match(controller,/@Post\(":ref\/decide"\)/);
 assert.doesNotMatch(owner,/INSERT INTO cms_publication|INSERT INTO donation|INSERT INTO finance_journal/);
});
test("US001-QA05/06/14/20: reviewer/author Web-native parity is role-scoped, and unverified public remains disabled",()=>{
 const webPage=root("apps/web/src/app/(admin)/admin/campaigns/page.tsx");
 const webReview=root("apps/web/src/features/campaigns/campaign-review-workspace.tsx");
 const nativeShell=root("apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx");
 const nativeReview=root("apps/android-internal/src/features/campaigns/native-campaign-reviews.tsx");
 const nav=root("apps/web/src/shared/foundation-admin-nav.tsx");
 const app=root("apps/backend/src/app.module.ts");
 assert.match(webPage,/canReview/);
 assert.match(webReview,/currentPassword/);
 assert.match(webReview,/independent/);
 assert.match(nativeShell,/NativeCampaignReviews/);
 assert.match(nativeReview,/currentPassword/);
 assert.match(nav,/campaigns\.review/);
 assert.match(app,/CampaignsDonationsModule/);
 assert.doesNotMatch(webPage,/Publish Campaign|Donation Received/);
});


test("US001-QA15 original optional volunteer assignment is a current CG04 origin, not an assigned staff role",()=>{
 const src=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 const cg04=root("apps/backend/src/modules/cg-04-membership-volunteers/application/current-volunteer-source.ts");
 const sql=root("apps/backend/db/migrations/3301_cg07_campaign_draft.sql");
 const guard=root("apps/backend/db/migrations/3303_cg07_campaign_status_proof.sql");
 const cg03=root("apps/backend/src/modules/cg-03-registration-approvals/application/campaign-review.service.ts");
 const web=root("apps/web/src/features/campaigns/campaign-drafts-workspace.tsx");
 const native=root("apps/android-internal/src/features/campaigns/native-campaign-drafts.tsx");
 assert.match(src,/requireCurrentVolunteer\(tx,a.realmId,v.team.volunteerRef,p.branchRef\)/);
 assert.match(src,/requireCurrentVolunteer\(tx,a.realmId,r.volunteer_source_ref,c.branch_ref\)/);
 assert.match(src,/cg04_current_volunteer\(/);
 assert.match(cg04,/cg04_current_volunteer/);
 assert.match(sql,/FOREIGN KEY\(root_realm_id,volunteer_source_ref\) REFERENCES volunteer\(root_realm_id,id\)/);
 assert.match(guard,/NEW.volunteer_source_ref/);
 assert.match(cg03,/volunteerRef:s.source_snapshot.volunteerRef/);
 assert.match(web,/Current approved volunteer/);
 assert.match(native,/Current approved volunteer/);
 assert.doesNotMatch(src,/INSERT INTO account_role|UPDATE role_grant/);
});

test("US001-QA11/19: temporary draft-only blocker is retired after secured 3303 transition proof",()=>{
 const draftSql=root("apps/backend/db/migrations/3301_cg07_campaign_draft.sql");
 const guardSql=root("apps/backend/db/migrations/3303_cg07_campaign_status_proof.sql");
 assert.match(draftSql,/CREATE TRIGGER cg07_campaign_draft_only BEFORE INSERT OR UPDATE ON campaign/);
 const guardPosition=guardSql.indexOf("CREATE CONSTRAINT TRIGGER cg07_campaign_status_proof_after");
 const dropPosition=guardSql.indexOf("DROP TRIGGER cg07_campaign_draft_only ON campaign");
 assert.ok(guardPosition>=0&&dropPosition>guardPosition,"do not remove safety guard before installing CG03 proof");
 assert.match(guardSql,/DROP FUNCTION cg07_campaign_draft_only\(\)/);
 assert.match(guardSql,/campaign_review_snapshot/);
 assert.match(guardSql,/cg03_case_decision/);
 assert.match(guardSql,/CREATE_DRAFT/);
 assert.match(guardSql,/REVIEW_APPROVE/);
});

test("US001-QA06/14/18: direct A12-A15 client image review maps to responsive Web structure and correct source totals",()=>{
 const original=root("docs/research/CAREGANGA-CG07-ORIGINAL-A12-A15-DIRECT-VISUAL-AUDIT-20261122.md");
 const web=root("apps/web/src/features/campaigns/campaign-drafts-workspace.tsx");
 const style=root("apps/web/src/features/campaigns/campaigns-reference-ui.module.css");
 const api=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 const proxy=root("apps/web/src/app/api/campaigns/[[...parts]]/route.ts");
 for(const key of ["A12","A13","A14","A15","direct visual","NOT_RUN"])assert.match(original,new RegExp(key,"i"));
 for(const key of ["styles.statGrid","styles.overviewColumns","styles.filterPanel",
  "styles.stepsStrip","styles.wizardGrid","styles.wizardAside","styles.previewThumb",
  "styles.miniStep","Campaign Preview","Steps Overview","Save as Draft",
  "Submit for Verification","Not yet verified by finance"])assert.ok(web.includes(key),key);
 assert.match(style,/@media\(max-width:820px\)/);
 assert.match(style,/@media\(max-width:540px\)/);
 assert.match(api,/count\(\*\) FILTER \(WHERE source_status='DRAFT'\)/);
 assert.match(api,/count\(\*\) FILTER \(WHERE source_status='APPROVED'\)/);
 assert.match(api,/\$5='ALL' OR c.source_status=\$5/);
 assert.match(proxy,/\["q","offset","status","stateRef","districtRef","leaderRef","branchRef","featured","createdFrom","createdTo"\]/);
 assert.doesNotMatch(web,/Raised so far:\s*₹0/);
});


test("US001-QA04/06/13/18: separate original A13 2MB cover, A15 5MB hero and supporting CG19 file refs are strict",()=>{
 const mediaOwner=root("apps/backend/src/modules/cg-19-documents-notifications/application/campaign-media-evidence.service.ts");
 const sql=root("apps/backend/db/migrations/3304_cg19_campaign_verified_media.sql");
 const domain=root("apps/backend/src/modules/cg-07-campaigns-donations/domain/campaign-draft-input.ts");
 const src=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 for(const kind of ["CAMPAIGN_COVER","CAMPAIGN_BANNER","CAMPAIGN_DOCUMENT"])
  assert.ok(sql.includes(kind),"Missing original CG19 kind "+kind);
 for(const key of ["coverRef","fileRef","supportingFileRefs"])
  assert.ok(domain.includes(key)&&sql.includes(key)&&src.includes(key),"Missing original media reference "+key);
 for(const maximum of ["2097152","5242880","10485760"])
  assert.ok(mediaOwner.includes(maximum),"Missing server-side client asset size bound "+maximum);
 assert.match(mediaOwner,/x.kind==="COVER"&&x.mime==="image\/webp"/);
 assert.match(sql,/classification=''CAMPAIGN_COVER'' AND mime IN\(''image\/jpeg'',''image\/png''\)/);
 assert.match(sql,/classification=''CAMPAIGN_BANNER'' AND mime IN\(''image\/jpeg'',''image\/png'',''image\/webp''\)/);
 assert.match(src,/requireMediaProof\(tx,a,c.id,c.current_revision,r.media.coverRef,"COVER"\)/);
 assert.match(src,/requireMediaProof\(tx,a,c.id,c.current_revision,r.media.fileRef,"BANNER"\)/);
 assert.match(src,/requireMediaProof\(tx,a,c.id,c.current_revision,fileRef,"DOCUMENT"\)/);
 assert.match(sql,/CREATE CONSTRAINT TRIGGER cg07_campaign_media_proof_after/);
 assert.match(sql,/f.revoked_at IS NULL/);
 assert.match(sql,/i.campaign_media_rights_confirmed/);
 const request=normal();
 const input={...request,steps:{...request.steps,media:{coverRef:id,fileRef:project,supportingFileRefs:[event],alt:"Original verified media"}}};
 const parsed=parseCampaignDraft(input);
 assert.equal(parsed.media.coverRef,id);
 assert.equal(parsed.media.fileRef,project);
 assert.deepEqual(parsed.media.supportingFileRefs,[event]);
 assert.deepEqual(parseCampaignDraft(request).media,{coverRef:null,fileRef:null,supportingFileRefs:[],alt:""});
 for(const altered of [
  {coverRef:id,fileRef:id,supportingFileRefs:[],alt:""},
  {coverRef:null,fileRef:project,supportingFileRefs:[project],alt:""},
  {coverRef:id,fileRef:null,supportingFileRefs:[id],alt:""},
  {coverRef:null,fileRef:null,supportingFileRefs:[event,event],alt:""},
  {coverRef:null,fileRef:null,supportingFileRefs:Array(7).fill(event),alt:""},
  {coverRef:null,fileRef:null,supportingFileRefs:["not-a-current-file"],alt:""},
 ]){
  assert.throws(()=>parseCampaignDraft({...request,steps:{...request.steps,media:altered}}));
 }
});
test("US001-QA02/04/06/13/18: original CG19 private scanned upload and real Web/internal Android parity",()=>{
 const owner=root("apps/backend/src/modules/cg-19-documents-notifications/application/campaign-media-evidence.service.ts");
 const controller=root("apps/backend/src/modules/cg-19-documents-notifications/http/campaign-media-evidence.controller.ts");
 const module=root("apps/backend/src/modules/cg-19-documents-notifications/documents-notifications.module.ts");
 const bff=root("apps/web/src/app/api/campaign-media/[...parts]/route.ts");
 const web=root("apps/web/src/features/campaigns/campaign-drafts-workspace.tsx");
 const uploader=root("apps/web/src/features/campaigns/campaign-banner-panel.tsx");
 const mobile=root("apps/android-internal/src/features/campaigns/native-campaign-drafts.tsx");
 const mobileUpload=root("apps/android-internal/src/features/campaigns/native-campaign-media-panel.tsx");
 const schema=root("apps/backend/db/migrations/3304_cg19_campaign_verified_media.sql");
 for(const action of ["reservePrivateUpload(","verifyPrivateObject(","readVerifiedPrivateObject(",
  "expected_sha256","verified_size_bytes","CLEAN_VERIFIED","request_digest",
  "campaign_media_rights_confirmed","source.guardMedia(","revoked_at IS NULL"])
  assert.ok(owner.includes(action),"Missing trusted private CG19 evidence boundary "+action);
 for(const route of ['@Get("campaigns/:ref")','@Post("intents")','@Post("intents/:ref/confirm")','@Get("files/:ref")'])
  assert.ok(controller.includes(route),"Missing protected CG19 route "+route);
 assert.match(module,/CampaignMediaEvidenceService/);
 assert.match(module,/CampaignMediaEvidenceController/);
 assert.match(bff,/req.headers.get\("origin"\)!==req.nextUrl.origin/);
 assert.match(bff,/Cache-Control":"private, no-store/);
 assert.match(bff,/application\/pdf/);
 const fkIndex=schema.indexOf("uq_cg19_campaign_intent_owner UNIQUE");
 const eventIndex=schema.indexOf("CREATE TABLE cg19_campaign_media_event");
 assert.ok(fkIndex>=0&&fkIndex<eventIndex,"Original CG19 event FK owner key must precede event table");
 for(const keyword of ["kind=\"COVER\"","kind=\"BANNER\"","CampaignSupportingDocumentsPanel"])
  assert.ok(web.includes(keyword),"Missing Web original A13/A15 media parity "+keyword);
 for(const keyword of ["kind=\"COVER\"","kind=\"BANNER\"","kind=\"DOCUMENT\""])
  assert.ok(mobile.includes(keyword),"Missing internal Android original media parity "+keyword);
 assert.match(uploader,/kind==="COVER"\?\["image\/jpeg","image\/png"\]:allowed/);
 assert.match(mobileUpload,/kind==="COVER"\?\["image\/jpeg","image\/png"\]:images/);
 assert.match(uploader,/kind:"DOCUMENT",rightsConfirmed:true/);
 assert.match(mobileUpload,/rightsConfirmed:true/);
 assert.doesNotMatch(owner,/INSERT INTO donation|UPDATE campaign SET source_status='PUBLISHED'/);
});

test("US001-QA01/05/07/10/12/16/17/20: CG18 effective original publication is separate from CG03 operational approval",()=>{
 const source=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-public-source.ts");
 const cms=root("apps/backend/src/modules/cg-18-cms-public-content/application/cms-editorial.service.ts");
 const controller=root("apps/backend/src/modules/cg-18-cms-public-content/http/cms-editorial.controller.ts");
 const media=root("apps/backend/src/modules/cg-19-documents-notifications/application/campaign-public-media.service.ts");
 const mediaRoute=root("apps/backend/src/modules/cg-19-documents-notifications/http/campaign-public-media.controller.ts");
 const nav=root("apps/web/src/features/cms-public-content/cms-site-header.tsx");
 const web=root("apps/web/src/features/campaigns/campaign-public-source.ts");
 const cards=root("apps/web/src/features/campaigns/campaign-public-cards.tsx");
 const native=root("apps/android-public/src/features/cms/native-public-campaigns.tsx");
 const nativeCms=root("apps/android-public/src/features/cms/public-cms-screen.tsx");
 const sitemap=root("apps/web/src/app/sitemap.ts");
 for(const phrase of ["source_status='APPROVED'","CAMPAIGN_LAUNCH","OWNER_COMPLETED",
  "CMS_PUBLICATION","cms_page_effective","cms_publication","CAMPAIGN_TEASER",
  "cg03_case_decision","CLEAN_VERIFIED","revoked_at IS NULL","campaign_media_rights_confirmed",
  "cg04_current_volunteer","project_activity","cg19_stored_file","publicCampaignSources"])
  assert.ok(source.includes(phrase),"Missing independently current campaign public source "+phrase);
 assert.match(source,/publication.state='EFFECTIVE'/);
 assert.match(source,/cms_decision.id=publication.cg03_final_decision_ref/);
 assert.match(source,/cg18review.cms_content_digest=publication.source_content_digest/);
 assert.match(source,/countPublishedCampaignSources\(db:Pool\|PoolClient,root:string/);
 assert.match(source,/publication.expires_at IS NULL OR publication.expires_at>now\(\)/);
 assert.match(source,/c.source_status='APPROVED'/);
 assert.match(source,/c.end_at IS NULL OR c.end_at>=/);
 assert.match(source,/NOT EXISTS\(SELECT 1 FROM jsonb_array_elements_text/);
 assert.match(cms,/validateCampaignTeaser\(tx,actor.realmId,sec.fields\)/);
 assert.match(cms,/CAMPAIGN_TEASER/);
 assert.match(cms,/publicCampaignSources\(this.db/);
 assert.match(controller,/@Get\("campaigns"\)/);
 assert.match(controller,/@Get\("campaigns\/:slug"\)/);
 assert.match(media,/readVerifiedPrivateObject/);
 assert.match(media,/publicCampaignMedia\(this.db,ref\)/);
 assert.match(media,/createHash\("sha256"\)/);
 assert.match(mediaRoute,/Cache-Control","no-store, no-cache, must-revalidate"/);
 assert.match(web,/cache:"no-store"/);
 assert.match(cards,/Read about this campaign/);
 assert.doesNotMatch(cards,/Donate Now|Pay Now|Verified received/);
 assert.match(native,/Back to campaigns/);
 assert.match(native,/AppState.addEventListener/);
 assert.match(nativeCms,/NativePublicCampaigns/);
 assert.match(nav,/href="\/campaigns"/);
 assert.match(sitemap,/publishedCampaigns\(\)/);
 assert.match(sitemap,/campaigns.state==="PUBLISHED"/);
});
test("US001-QA03/05/07/12/19: original CG07 cancel, pause, complete, resume are scoped, CAS and event-guarded",()=>{
 const sql=root("apps/backend/db/migrations/3305_cg07_campaign_original_lifecycle.sql");
 const service=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 const api=root("apps/backend/src/modules/cg-07-campaigns-donations/http/campaign-drafts.controller.ts");
 const bff=root("apps/web/src/app/api/campaigns/[[...parts]]/route.ts");
 const web=root("apps/web/src/features/campaigns/campaign-drafts-workspace.tsx");
 const native=root("apps/android-internal/src/features/campaigns/native-campaign-drafts.tsx");
 for(const word of ["CREATE OR REPLACE FUNCTION cg07_campaign_status_proof_guard",
  "CANCEL_DRAFT","PAUSE","RESUME","CLOSE","WITHDRAW",
  "campaign_status_event","OWNER_COMPLETED","campaign_source_digest","fresh_password_verified_at"])
  assert.ok(sql.includes(word),"Missing original DB lifecycle guard "+word);
 assert.match(sql,/NEW.current_revision<>OLD.current_revision/);
 assert.match(sql,/NEW.version<>OLD.version\+1/);
 assert.match(service,/async lifecycle\(token:string,ref:string,raw:unknown\)/);
 assert.match(service,/current\(tx,a,campaignId,true\)/);
 assert.match(service,/pg_advisory_xact_lock/);
 assert.match(service,/UPDATE campaign SET source_status=\$3,version=version\+1/);
 assert.match(service,/requireCurrentVolunteer/);
 assert.match(service,/projectEvents.requireCurrent/);
 assert.match(api,/@Post\(":ref\/lifecycle"\)/);
 assert.match(bff,/parts\[1\]==="lifecycle"/);
 assert.match(bff,/req.headers.get\("origin"\)!==req.nextUrl.origin/);
 for(const client of [web,native]){
  assert.match(client,/lifecyclePending/);
  assert.match(client,/expectedVersion:.*version/);
  assert.match(client,/WITHDRAW/);
  assert.match(client,/RESUME/);
  assert.match(client,/PAUSE/);
  assert.match(client,/CLOSE/);
  assert.match(client,/Retry/);
 }
 assert.doesNotMatch(service,/INSERT INTO donation|INSERT INTO finance_journal/);
});

test("US001-QA05/06/14: A12 original filters are backed by current owner records, not decorative options",()=>{
 const backend=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 const web=root("apps/web/src/features/campaigns/campaign-drafts-workspace.tsx");
 const bff=root("apps/web/src/app/api/campaigns/[[...parts]]/route.ts");
 for(const key of ["stateRef","districtRef","leaderRef","branchRef","featured","createdFrom","createdTo"]){
  assert.ok(web.includes(key)&&backend.includes(key)&&bff.includes(key),"Original real filter missing: "+key);
 }
 assert.match(backend,/r.step2_project_and_geo->>'stateRef'/);
 assert.match(backend,/r.step2_project_and_geo->>'districtRef'/);
 assert.match(backend,/r.step3_team->>'coordinatorRef'/);
 assert.match(backend,/cms_page_effective/);
 assert.match(backend,/cms_publication/);
 assert.match(backend,/sec.section_kind='CAMPAIGN_TEASER'/);
 assert.match(backend,/c.created_at AT TIME ZONE 'Asia\/Kolkata'/);
 assert.match(backend,/COALESCE\(r.step3_team->>'coordinatorRef',c.created_by::text\)/);
 assert.match(web,/Current campaign area and fundraiser choices could not be verified/);
 assert.match(web,/Apply Filters/);
 assert.match(web,/Reset/);
 assert.doesNotMatch(web,/Project and event links require verified CG-05 source and are not yet available/);
});

test("US001-QA05/06/16/18: A12 approved and public counts and recent activities use genuine current immutable sources",()=>{
 const source=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 const publicSource=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-public-source.ts");
 const ui=root("apps/web/src/features/campaigns/campaign-drafts-workspace.tsx");
 const schema=root("apps/backend/db/migrations/3305_cg07_campaign_original_lifecycle.sql");
 assert.match(source,/countPublishedCampaignSources\(tx,a.realmId,scope.all/);
 assert.match(source,/FROM campaign_status_event e JOIN campaign c/);
 assert.match(source,/c.branch_ref=ANY\(\$3::uuid\[\]\)/);
 assert.match(source,/ORDER BY e.at DESC,e.id DESC LIMIT 8/);
 assert.match(source,/actor.display_name AS by/);
 assert.match(ui,/Currently published campaigns: \{summary\?\.publicCount/);
 assert.match(ui,/Recent Activities/);
 assert.match(ui,/activities.map/);
 assert.match(ui,/Fundraising goal|Fundraising target|CG03-approved planned campaign goals/);
 assert.match(publicSource,/count\(DISTINCT c.id\)::integer AS total/);
 assert.match(schema,/CREATE INDEX ix_cg07_campaign_feed/);
 assert.doesNotMatch(ui,/Verified campaign activity feed is not yet connected/);
});

test("US001-QA03 original request retry returns its immutable event outcome",()=>{
 const source=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 assert.match(source,/SELECT campaign_id,digest,operation,resulting_version,resulting_status FROM campaign_status_event/);
 assert.match(source,/status:prior\.resulting_status,replayed:true/);
 assert.doesNotMatch(source,/status:c\.source_status,replayed:true/);
});
test("US001-QA04/13 exact A13 cover versus A15 banner server and DB media proof",()=>{
 const source=root("apps/backend/src/modules/cg-07-campaigns-donations/application/campaign-drafts.service.ts");
 const sql=root("apps/backend/db/migrations/3304_cg19_campaign_verified_media.sql");
 assert.match(source,/WHEN 'COVER' THEN f\.original_mime IN\('image\/jpeg','image\/png'\)/);
 assert.match(source,/WHEN 'BANNER' THEN f\.original_mime IN\('image\/jpeg','image\/png','image\/webp'\)/);
 const cover=sql.split("IF cover IS NOT NULL")[1].split("IF banner IS NOT NULL")[0];
 assert.match(cover,/f\.original_mime IN\('image\/jpeg','image\/png'\)/);
 assert.doesNotMatch(cover,/f\.original_mime IN\('image\/jpeg','image\/png','image\/webp'\)/);
});
