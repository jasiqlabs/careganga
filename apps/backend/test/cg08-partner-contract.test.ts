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
