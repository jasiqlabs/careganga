import test from "node:test";
import assert from "node:assert/strict";
import {parsePartner} from "../src/modules/cg-08-csr-funding/application/csr-partners.service";
const key="11111111-1111-4111-8111-111111111111",branch="22222222-2222-4222-8222-222222222222";
const draft={requestKey:key,branchRef:branch,legalName:"  Community Partner Ltd  ",contactName:"  CSR Coordinator  ",contactEmail:"  csr@example.org  ",supportSummary:"  Support education programmes  "};
test("US001-QA09/14: normalized private draft, nullable registration and Foundation/branch scope",()=>{
 const v=parsePartner(draft);assert.equal(v.legalName,"Community Partner Ltd");assert.equal(v.contactEmail,"csr@example.org");
 assert.equal(v.expectedVersion,null);assert.equal(v.contactMobile,null);
 assert.equal(parsePartner({...draft,branchRef:null,contactEmail:null,contactMobile:"+919876543210"}).branchRef,null);
});
test("US001-QA02/04/14: no tenant, status, approval, finance, unsafe or extra fields accepted",()=>{
 for(const extra of [{rootRealmId:key},{status:"APPROVED"},{partnerRef:key},{approved:true},{receivedMinor:"100"},{publicLogo:true},{legalName:"<script>"},{contactEmail:"bad"},{contactMobile:"1234"},{branchRef:"not-a-uuid"},{supportSummary:"x"}]){
  assert.throws(()=>parsePartner({...draft,...extra}),JSON.stringify(extra));
 }
 assert.throws(()=>parsePartner({...draft,contactEmail:null,contactMobile:null}));
});
test("US001-QA03/13/15: protected current revision and request identity are mandatory",()=>{
 assert.equal(parsePartner({...draft,expectedVersion:3}).expectedVersion,3);
 for(const version of [0,-1,1.5,"2",2147483647])assert.throws(()=>parsePartner({...draft,expectedVersion:version}));
 assert.throws(()=>parsePartner({...draft,requestKey:"same-token"}));
});

import {readFileSync} from "node:fs";
import {join} from "node:path";
import {ForbiddenException} from "@nestjs/common";
import type {Pool} from "pg";
import {CsrPartnersService} from "../src/modules/cg-08-csr-funding/application/csr-partners.service";
import type {PoolClient} from "pg";
import type {PrivateObjectStorage} from "../src/modules/cg-19-documents-notifications/infrastructure/private-object-storage";
import type {SessionService} from "../src/modules/cg-01-identity-access/application/session.service";
import type {FoundationStructureIdentityFacade} from "../src/modules/cg-01-identity-access/application/foundation-structure-identity.facade";
import type {BranchSourceFacade} from "../src/modules/cg-02-foundation-structure/application/branch-source.facade";
test("US001-QA02/12/17: private contacts never appear in CSR list projection",()=>{
 const code=readFileSync(join(process.cwd(),"src/modules/cg-08-csr-funding/application/csr-partners.service.ts"),"utf8");
 const selected=code.match(/const listProjection='([^']+)'/);
 assert.ok(selected,"Privacy-limited list projection exists");
 for(const column of ["contact_email","contact_mobile","registration_reference","support_summary","contact_name"]){
  assert.ok(!selected[1].includes(column),column);
 }
 assert.ok(code.includes('const rows=await tx.query("SELECT "+listProjection+joins'));
 assert.ok(code.includes("await this.row(tx,a,key);"),"Detail needs current original scope");
 assert.ok(code.includes("projectBranchScope(tx,a)"),"Current branch assignments checked");
});
test("US001-QA02/17: revoked branch authorization aborts before CSR insert",async()=>{
 const events:string[]=[];
 const actor={realmId:key,accountId:"33333333-3333-4333-8333-333333333333"};
 const tx={query:async(sql:string)=>{events.push(sql);return {rows:[]};},release:()=>{events.push("RELEASE");}};
 const db={connect:async()=>tx} as unknown as Pool;
 const sessions={requireAction:async()=>actor} as unknown as SessionService;
 const identity={assertCurrent:async()=>{events.push("CURRENT_ACTION");}} as unknown as FoundationStructureIdentityFacade;
 const branches={projectBranch:async()=>{throw new ForbiddenException("Current branch access revoked");}} as unknown as BranchSourceFacade;
 const svc=new CsrPartnersService(db,sessions,identity,branches);
 await assert.rejects(()=>svc.create("Bearer original",draft),ForbiddenException);
 assert.ok(events.includes("BEGIN"));
 assert.ok(events.includes("ROLLBACK"));
 assert.equal(events.some(v=>v.startsWith("INSERT INTO csr_partner")),false);
});
test("US001-QA03/19: original greenfield migration constrains root, branch and draft-only status",()=>{
 const ddl=readFileSync(join(process.cwd(),"db/migrations/3401_cg08_csr_partner_drafts.sql"),"utf8");
 assert.match(ddl,/UNIQUE\(root_realm_id,legal_name_norm\)/);
 assert.match(ddl,/FOREIGN KEY\(branch_ref,root_realm_id\)/);
 assert.match(ddl,/OLD\.status NOT IN\('DRAFT','RETURNED'\)/);
 assert.match(ddl,/NEW\.status NOT IN\('DRAFT','INACTIVE'\)/);
 assert.match(ddl,/CREATE TRIGGER cg08_partner_command_no_change/);
});

test("US001-QA14: CG08 direct-SQL email constraint is single and syntactically closed",()=>{
 const ddl=readFileSync(join(process.cwd(),"db/migrations/3401_cg08_csr_partner_drafts.sql"),"utf8");
 const email=ddl.split("\n").find(line=>line.trimStart().startsWith("contact_email text"));
 assert.ok(email&&email.endsWith(")),"));
 assert.match(email,/\+\$'\)\)/);
 assert.equal(ddl.split("contact_mobile text").length,2);
 assert.equal(ddl.split("CREATE TABLE csr_partner (").length,2);
});

import {parseCsrAgreementUpload} from "../src/modules/cg-19-documents-notifications/application/csr-agreement-evidence.service";
test("US001-QA10: only exact private PDF/image agreement bytes and current source revision accepted",()=>{
 const v={partnerRef:key,sourceVersion:1,requestKey:key,mime:"application/pdf",sizeBytes:1032,sha256:"a".repeat(64)};
 assert.equal(parseCsrAgreementUpload(v).sourceVersion,1);
 for(const add of [{ownerKind:"PUBLIC"},{status:"VALIDATED"},{mime:"text/html"},{sourceVersion:0},
  {sourceVersion:1.5},{sizeBytes:0},{sizeBytes:10485761},{sha256:"invalid"},{partnerRef:"other"}])
  assert.throws(()=>parseCsrAgreementUpload({...v,...add}),JSON.stringify(add));
});
test("US001-QA10: private agreement download re-hashes raw bytes, not serialized buffer",()=>{
 const code=readFileSync(join(process.cwd(),"src/modules/cg-19-documents-notifications/application/csr-agreement-evidence.service.ts"),"utf8");
 assert.ok(code.includes('createHash("sha256").update(bytes).digest("hex")!==f.verified_sha256'));
 assert.ok(code.includes("readVerifiedPrivateObject"),"Never use a public file URL");
 assert.ok(code.includes("verifyPrivateObject"),"Scanner must verify the uploaded bytes");
 assert.ok(code.includes("requireCurrentProof"),"Review uses exact current verified evidence");
});


import {CsrAgreementEvidenceService} from "../src/modules/cg-19-documents-notifications/application/csr-agreement-evidence.service";
import type {VerifiedFoundationActor} from "../src/modules/cg-01-identity-access/public-api";
test("US001-QA10/11: independent protected CG03 reviewer uses review grant, not ordinary CSR partner-view",async()=>{
 const audit:string[]=[];
 const actor={realmId:key,accountId:branch} as unknown as VerifiedFoundationActor;
 const db={} as Pool;
 const sessions={} as SessionService;
 const identity={} as FoundationStructureIdentityFacade;
 const partners={
  reviewSource:async()=>{audit.push("review");return {version:2,status:"SUBMITTED"};},
  guardAgreement:async()=>{audit.push("staff-view");throw new ForbiddenException("not granted");}
 } as unknown as CsrPartnersService;
 const storage={} as PrivateObjectStorage;
 const evidence=new CsrAgreementEvidenceService(db,sessions,identity,partners,storage);
 const tx={query:async()=>({rowCount:1,rows:[{id:key}]})} as unknown as PoolClient;
 await evidence.requireCurrentProof(tx,actor,key,1,branch,true);
 assert.deepEqual(audit,["review"]);
 await assert.rejects(()=>evidence.requireCurrentProof(tx,actor,key,1,branch),ForbiddenException);
});
test("US001-QA11: CG19 re-exports its source module rather than an undeclared class provider",()=>{
 const code=readFileSync(join(process.cwd(),"src/modules/cg-19-documents-notifications/documents-notifications.module.ts"),"utf8");
 assert.match(code,/imports:\[CsrAgreementSourceModule,/);
 assert.match(code,/exports:\[CsrAgreementSourceModule,/);
 assert.ok(!code.includes("exports:[CsrAgreementEvidenceService,"));
});


test("US001-QA05/13: approved partner view preserves read-only UX and original review history",()=>{
 const ui=readFileSync(join(process.cwd(),"../web/src/features/csr/csr-partners-workspace.tsx"),"utf8");
 assert.match(ui,/canSubmit=\{canEditCurrent&&selected\.status==="DRAFT"\}/);
 assert.match(ui,/onSubmitted=\{\(\)=>/);
 assert.match(ui,/readOnly=\{!canEditCurrent\}/);
 assert.match(ui,/\/review-history/);
 assert.match(ui,/p\.status\)\?"Edit":"View"/);
});


test("US001-QA08/10/11: CSR reviewer evidence download is original-case and scan guarded",()=>{
 const approval=readFileSync(join(process.cwd(),"src/modules/cg-03-registration-approvals/application/csr-partner-review.service.ts"),"utf8");
 const evidence=readFileSync(join(process.cwd(),"src/modules/cg-19-documents-notifications/application/csr-agreement-evidence.service.ts"),"utf8");
 const controller=readFileSync(join(process.cwd(),"src/modules/cg-03-registration-approvals/http/csr-partner-review.controller.ts"),"utf8");
 assert.match(approval,/await this\.reviewerCurrent\(tx,a\);[\s\S]*?await this\.case\(tx,a,caseRef\);/);
 assert.match(approval,/readForOriginalReview\(tx,a,proof\.partner_id,proof\.source_version,proof\.evidence_file_id\)/);
 assert.match(evidence,/readForOriginalReview\(/);
 assert.match(evidence,/i\.status='VALIDATED' FOR SHARE OF f,i/);
 assert.match(evidence,/createHash\("sha256"\)\.update\(bytes\)\.digest\("hex"\)/);
 assert.match(controller,/@Get\(":ref\/agreement"\)/);
});


test("US001-QA05/08/10: Native reviewer only reads exact case-scoped protected agreement",()=>{
 const native=readFileSync(join(process.cwd(),"../android-internal/src/features/csr/native-csr-review-panel.tsx"),"utf8");
 assert.match(native,/identityRequest\(origin\+"\/"\+detail\.caseRef\+"\/agreement"/);
 assert.match(native,/detail\.status!=="SUBMITTED"/);
 assert.match(native,/await Sharing\.shareAsync\(local\.uri/);
 assert.match(native,/local\.delete\(\)/);
 assert.ok(!native.includes("uploadUrl"),"Reviewer does not receive a storage upload URL");
});


test("US001-QA05/06/08/13/17/18: real B03-B06 review tabs and branch-limited read-only parity",()=>{
 const web=readFileSync(join(process.cwd(),"../web/src/features/csr/csr-partners-workspace.tsx"),"utf8");
 const android=readFileSync(join(process.cwd(),"../android-internal/src/features/csr/native-csr-partners.tsx"),"utf8");
 for(const src of [web,android]){
  for(const label of ["All Partners","Pending Review","Approved Partners","Rejected"])
   assert.ok(src.includes(label),"Missing original status tab: "+label);
  assert.ok(src.includes('params.set("status",statusFilter)')||
   src.includes('p.set("status",statusFilter)'),"Backend-owned status filter required");
  assert.ok(src.includes('setOffset(0);setStatusFilter('),"Status changes must reset paging");
  assert.ok(src.includes('branchRef'),"Must retain current CG02 branch selection");
  assert.ok(src.includes('canEditCurrent'),"Approved/other private records must be read-only");
  assert.ok(src.includes('review-history'),"Original CG03 review status must be preserved");
 }
 assert.ok(web.includes('aria-pressed={statusFilter===tab.value}'),"Web active-state a11y");
 assert.ok(android.includes('editable={canEditCurrent&&!busy&&!pending}'),"Native readonly input guard");
});

test("US001-QA04/15: native retry success can refresh while manual refresh stays disabled mid-command",()=>{
 const code=readFileSync(join(process.cwd(),"../android-internal/src/features/csr/native-csr-partners.tsx"),"utf8");
 assert.match(code,/const refresh=\(\)=>\{setSelected\(null\);setEditing\(false\);setEpoch\(/);
 assert.match(code,/disabled=\{!!pending\|\|busy\} accessibilityState=\{\{disabled:!!pending\|\|busy\}\} onPress=\{refresh\}/);
 assert.ok(!code.includes("const refresh=()=>{if(pending)return"),"Do not capture stale pending after a confirmed original retry");
});


test("US001-QA02/12/17: assigned manager denied foreign/Foundation scope before CSR query",async()=>{
 const other="44444444-4444-4444-8444-444444444444",statements:string[]=[];
 const actor={realmId:key,accountId:branch};
 const tx={query:async(sql:string)=>{statements.push(sql);return {rows:[],rowCount:0};},release:()=>{}};
 const db={connect:async()=>tx} as unknown as Pool;
 const sessions={requireAction:async()=>actor} as unknown as SessionService;
 const identity={assertCurrent:async()=>{}} as unknown as FoundationStructureIdentityFacade;
 const branches={projectBranchScope:async()=>({all:false,branches:[{value:branch,label:"Assigned branch",managerRef:actor.accountId}]})} as unknown as BranchSourceFacade;
 const svc=new CsrPartnersService(db,sessions,identity,branches);
 await assert.rejects(()=>svc.list("Bearer assigned",{branchRef:other}),ForbiddenException);
 await assert.rejects(()=>svc.list("Bearer assigned",{branchRef:"FOUNDATION"}),ForbiddenException);
 assert.equal(statements.filter(x=>x.includes("FROM csr_partner p")).length,0,"No foreign/foundation data query before permission");
 const rows=await svc.list("Bearer assigned",{branchRef:branch,status:"SUBMITTED"});
 assert.deepEqual(rows,{items:[],hasMore:false});
 assert.equal(statements.filter(x=>x.includes("FROM csr_partner p")).length,1);
});

test("US001-QA12/17: current scope is an explicit parameter in every CSR list query",async()=>{
 const calls:{sql:string;params:unknown[]}[]=[];
 const actor={realmId:key,accountId:branch};
 const tx={query:async(sql:string,params:unknown[]=[])=>{calls.push({sql,params});return {rows:[],rowCount:0};},release:()=>{}};
 const db={connect:async()=>tx} as unknown as Pool;
 const sessions={requireAction:async()=>actor} as unknown as SessionService;
 const identity={assertCurrent:async()=>{}} as unknown as FoundationStructureIdentityFacade;
 const branches={projectBranchScope:async()=>({all:false,branches:[{value:branch,label:"Assigned branch",managerRef:actor.accountId}]})} as unknown as BranchSourceFacade;
 const svc=new CsrPartnersService(db,sessions,identity,branches);
 await svc.list("Bearer assigned",{status:"APPROVED"});
 const read=calls.find(x=>x.sql.includes("FROM csr_partner p"));
 assert.ok(read,"Partner list query must reach real DB");
 assert.match(read.sql,/p\.root_realm_id=\$1/);
 assert.match(read.sql,/p\.branch_ref=ANY\(\$3::uuid\[\]\)/);
 assert.deepEqual(read.params.slice(0,3),[key,false,[branch]]);
 assert.equal(read.params[6],"APPROVED");
 assert.equal(read.sql.includes("contact_email"),false,"Private contacts cannot enter list projection");
});

test("US001-QA17: only current Foundation administrator may filter Foundation-owned partners",async()=>{
 const statements:{sql:string;params:unknown[]}[]=[];
 const actor={realmId:key,accountId:branch};
 const tx={query:async(sql:string,params:unknown[]=[])=>{statements.push({sql,params});return {rows:[],rowCount:0};},release:()=>{}};
 const db={connect:async()=>tx} as unknown as Pool;
 const sessions={requireAction:async()=>actor} as unknown as SessionService;
 const identity={assertCurrent:async()=>{}} as unknown as FoundationStructureIdentityFacade;
 const branches={projectBranchScope:async()=>({all:true,branches:[]})} as unknown as BranchSourceFacade;
 const svc=new CsrPartnersService(db,sessions,identity,branches);
 await svc.list("Bearer Foundation admin",{branchRef:"FOUNDATION"});
 const list=statements.find(x=>x.sql.includes("FROM csr_partner p"));
 assert.ok(list);
 assert.deepEqual(list.params.slice(0,5),[key,true,[],false,null]);
});


test("US001-QA08/10/13: old scanner proof stays historical and cannot re-submit amended source",()=>{
 const service=readFileSync(join(process.cwd(),"src/modules/cg-19-documents-notifications/application/csr-agreement-evidence.service.ts"),"utf8");
 const web=readFileSync(join(process.cwd(),"../web/src/features/csr/csr-agreement-panel.tsx"),"utf8");
 const android=readFileSync(join(process.cwd(),"../android-internal/src/features/csr/native-csr-agreement-panel.tsx"),"utf8");
 assert.match(service,/f\.proposal_revision AS \\"sourceVersion\\"/);
 assert.match(service,/f\.proposal_revision=\$4/);
 for(const src of [web,android]){
  assert.match(src,/sourceVersion:number/);
  assert.match(src,/f\.sourceVersion===version/);
  assert.ok(src.includes("Earlier draft"),"Historical CG19 agreement must not be presented as current");
 }
 assert.match(android,/p\.sourceVersion===version&&<Pressable/);
});

test("US001-QA04/10: protected proof-list failure differs from loading and legitimately empty",()=>{
 const web=readFileSync(join(process.cwd(),"../web/src/features/csr/csr-agreement-panel.tsx"),"utf8");
 const native=readFileSync(join(process.cwd(),"../android-internal/src/features/csr/native-csr-agreement-panel.tsx"),"utf8");
 for(const source of [web,native]){
  assert.match(source,/setProofLoadError\(""\)/);
  assert.match(source,/proofLoadError\?/);
  assert.match(source,/setProofLoadError\(e instanceof Error\?/);
  assert.match(source,/proofLoadError\)/);
 }
 assert.ok(web.includes('disabled={busy||!!proofLoadError}'));
 assert.ok(native.includes('if(running.current||proofLoadError)return;'));
});
