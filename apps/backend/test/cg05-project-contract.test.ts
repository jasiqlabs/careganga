import test from "node:test";
import assert from "node:assert/strict";
import {parseCreate,parseEdit,parseBranch,parseStatus,canTransition,budget,date,version,statuses} from "../src/modules/cg-05-projects-field-operations/domain/project-input";
const id="11111111-1111-4111-8111-111111111111",owner="22222222-2222-4222-8222-222222222222";
const input={requestKey:id,code:" cg-05.01 ",title:"Community Project",category:"Education",priority:"NORMAL",ownerRef:owner,status:"DRAFT",plannedBudget:"123.45"};
test("QA01/02: normalise codes and exact minor amount; allow internal text-first draft",()=>{const v=parseCreate(input);assert.equal(v.code,"CG-05.01");assert.equal(v.budget,"12345");assert.equal(v.branch,null);assert.equal(v.status,"DRAFT");});
test("QA02/06: reject extra protected fields or malformed refs",()=>{for(const extra of [{rootRealmId:id},{publicStatus:"PUBLISHED"},{allocated:"100"},{ownerRef:"invalid"},{branchRef:1}])assert.throws(()=>parseCreate({...input,...extra}));});
test("QA06: district requires state, chronological valid dates",()=>{assert.throws(()=>parseCreate({...input,districtRef:id}));assert.throws(()=>parseCreate({...input,plannedStart:"2026-03-02",plannedEnd:"2026-03-01"}));assert.throws(()=>date("2026-02-29"));assert.equal(date("2028-02-29"),"2028-02-29");});
test("QA10: exact decimal parser; reject invalid and excessive precision",()=>{assert.equal(budget("0.01"),"1");assert.equal(budget("10"),"1000");assert.equal(budget(""),null);for(const v of ["-1","1e5","1.001","10000000000000",1])assert.throws(()=>budget(v));});
test("QA04/09: version required and terminal status cannot create/edit through transition graph",()=>{for(const x of [0,-1,1.5,"1",2147483647])assert.throws(()=>version(x));const {status,...edit}=input;assert.equal(parseEdit({...edit,expectedVersion:1}).expected,1);assert.throws(()=>parseCreate({...input,status:"COMPLETED"}));for(const terminal of ["COMPLETED","CANCELLED"] as const)for(const to of statuses)assert.equal(canTransition(terminal,to),false);assert.equal(canTransition("ACTIVE","ON_HOLD"),true);assert.equal(canTransition("ON_HOLD","ACTIVE"),true);assert.equal(canTransition("DRAFT","COMPLETED"),false);});
test("QA07/08/19: command contracts reject missing reason, stale shape and spoofed scope",()=>{assert.equal(parseBranch({requestKey:id,expectedVersion:1,branchRef:null,ownerRef:owner,reason:"Move to Foundation"}).branch,null);assert.throws(()=>parseBranch({requestKey:id,expectedVersion:1,branchRef:null,ownerRef:owner,reason:"x"}));assert.throws(()=>parseStatus({requestKey:id,expectedVersion:1,status:"ACTIVE",reason:"Approved",rootRealmId:id}));assert.throws(()=>parseStatus({requestKey:id,expectedVersion:0,status:"ACTIVE",reason:"Approved"}));});

// US001-QA13/14/17: authored source-contract regression tests. A fake query
// verifies the projection boundary, not actual PostgreSQL or public publication.
import type {PoolClient} from "pg";
import {projectTeaserRefs,publicProjectTeaser,publishedProjectCover} from "../src/modules/cg-05-projects-field-operations/application/project-public-source";
test("QA13/17: canonical source refs reject spoofed, duplicate and oversize inputs",()=>{
 const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 assert.deepEqual(projectTeaserRefs([a.toUpperCase()]),[a]);
 for(const v of ["all",[a,a.toUpperCase()],[{id:a}],["invalid"],Array(13).fill(a)])assert.throws(()=>projectTeaserRefs(v));
});
test("QA13/14: public teaser drops missing current source and never exposes internal source identifier",async()=>{
 const root="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",valid="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",revoked="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
 const fake={query:async(_sql:string,params:unknown[])=>{assert.deepEqual(params,[root,[valid,revoked]]);return {rows:[{sourceRef:valid,slug:"education-project",title:"Education Project",category:"Education",summary:"Public description",area:"General area",launch:null,status:"PLANNED",coverSrc:null}]};}} as unknown as PoolClient;
 const result=await publicProjectTeaser(fake,root,{heading:"Projects",sourceRefs:[valid,revoked]});
 assert.equal(result.cards.length,1);assert.equal(result.cards[0].title,"Education Project");assert.equal("sourceRef" in result.cards[0],false);
});
test("QA14: public cover rejects an invalid ref without accessing storage or database",async()=>{
 const fake={query:async()=>{throw Error("Unexpected query");}} as unknown as PoolClient;
 assert.equal(await publishedProjectCover(fake,"invalid"),null);
});
