import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {AssistanceService,aidDigest} from "../../cg-06-beneficiaries-assistance/application/assistance.service";
import {fields,ref,revision,option,text,conflict} from "../../cg-06-beneficiaries-assistance/domain/beneficiary-input";
type Case={id:string;case_number:string;proposer_id:string;assistance_review_ref:string;assistance_source_digest:string;status:string;revision:number};
@Injectable()
export class AssistanceReviewService{
 constructor(private readonly source:AssistanceService,private readonly identity:FoundationStructureIdentityFacade,private readonly protectedOwner:ProtectedAccessOwnerService,private readonly sessions:SessionService){}
 private async event(tx:PoolClient,a:Actor,c:Case,action:string,remarks=""){
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref,safe_remarks) VALUES($1,$2,$3,$4,1,$5,$6)",[a.realmId,c.id,a.accountId,action,randomUUID(),remarks]);
 }
 private async process(tx:PoolClient,a:Actor){
  const found=(await tx.query<{process_id:string}>("SELECT p.id AS process_id FROM cg03_assistance_process_current cur JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id WHERE cur.realm_id=$1 AND p.process_kind='ASSISTANCE_REVIEW' FOR SHARE OF p",[a.realmId])).rows[0];
  if(found)return found.process_id;
  const created=(await tx.query<{id:string}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'ASSISTANCE_REVIEW' FROM cg03_process WHERE realm_id=$1 RETURNING id",[a.realmId,a.accountId])).rows[0];
  await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[created.id]);
  await tx.query("INSERT INTO cg03_assistance_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,created.id]);return created.id;
 }
 async submit(token:string,id:string,raw:unknown){
  const x=fields(raw,["requestKey","expectedRevision"]),key=ref(x.requestKey),expected=revision(x.expectedRevision),target=ref(id),hash=aidDigest(["SUBMIT",target,expected]);
  return this.source.run(token,"beneficiaries.assistance.manage",async(tx,a)=>{
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   const row=await this.source.guard(tx,a,target,true);
   const prior=(await tx.query<{request_digest:string;assistance_id:string;action:string}>("SELECT request_digest,assistance_id,action FROM assistance_event WHERE root_realm_id=$1 AND actor_ref=$2 AND request_key=$3",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.request_digest!==hash||prior.assistance_id!==target||prior.action!=="SUBMITTED")throw conflict();return {...this.source.view(row),replayed:true};}
   if(row.state!=="DRAFT"||row.revision!==expected)throw conflict();
   await this.source.context(tx,a,row.branch_ref,row.project_ref,row.activity_ref,row.visit_ref,row.campaign_ref);
   const available=await tx.query("SELECT 1 FROM account c JOIN account_role ar ON ar.account_id=c.id AND ar.realm_id=c.realm_id AND ar.revoked_at IS NULL JOIN role r ON r.id=ar.role_id AND r.realm_id=c.realm_id WHERE c.realm_id=$1 AND c.status='ACTIVE' AND r.active AND r.is_protected AND c.id<>ALL($2::uuid[]) LIMIT 1",[a.realmId,[a.accountId,row.created_by]]);
   if(!available.rowCount)throw new ConflictException("A different protected Foundation reviewer is required");
   const process=await this.process(tx,a);
   const c=(await tx.query<Case>(`INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,assistance_review_ref,assistance_source_digest)
   SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,$3,'Assistance release',NULL,NULL,2,$4,$5,$6,'ASSISTANCE_REVIEW',$7,$4 FROM cg03_process p WHERE p.realm_id=$1 AND p.id=$8 AND p.process_kind='ASSISTANCE_REVIEW' RETURNING *`,[a.realmId,a.accountId,row.reference,row.source_digest,hash,key,row.id,process])).rows[0];
   if(!c)throw conflict();
   const changed=await tx.query("UPDATE assistance_case SET state='SUBMITTED',revision=2,approval_case_ref=$3,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND revision=1 RETURNING id",[a.realmId,row.id,c.id]);
   if(!changed.rowCount)throw conflict();
   await this.source.event(tx,a,row.id,key,"SUBMITTED",hash,2);await this.event(tx,a,c,"SUBMITTED");
   return {ref:row.id,caseNumber:c.case_number,state:"SUBMITTED",revision:2,replayed:false};
  });
 }
 async detail(token:string,id:string){
  return this.source.run(token,"beneficiaries.assistance.view",async(tx,a)=>{
   const row=await this.source.guard(tx,a,id);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND assistance_review_ref=$2 AND case_kind='ASSISTANCE_REVIEW'",[a.realmId,row.id])).rows[0];
   if(!c)return {status:"NOT_SUBMITTED",canReview:false,caseRef:null};
   let canReview=false;
   if(row.state==="SUBMITTED"&&c.status==="SUBMITTED"&&c.proposer_id!==a.accountId&&row.created_by!==a.accountId&&c.assistance_source_digest===row.source_digest){
    try{await this.identity.assertCurrent(tx,a,"beneficiaries.assistance.review");await this.protectedOwner.verifyReviewer(tx,a,"approvals.review",true);canReview=true;}catch(e){if(!(e instanceof ForbiddenException))throw e;}
   }
   return {caseNumber:c.case_number,status:c.status,canReview,caseRef:canReview?c.id:null,revision:c.revision};
  });
 }
 async decide(token:string,id:string,raw:unknown){
  const x=fields(raw,["requestKey","expectedRevision","action","remarks","currentPassword"]),key=ref(x.requestKey),expected=revision(x.expectedRevision),target=ref(id),action=option(x.action,["APPROVE","RETURN","REJECT"] as const),remarks=text(x.remarks??"",action==="APPROVE"?0:3,500);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024)throw new BadRequestException("Enter your current Foundation password");
  const password=x.currentPassword,hash=aidDigest([target,expected,action,remarks]),auth=await this.sessions.requireAction(token,"approvals.review");
  await this.sessions.limitFoundationRootProof(auth);
  return this.source.run(token,"beneficiaries.assistance.review",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"approvals.review");await this.protectedOwner.verifyReviewer(tx,a,"approvals.review",true);
   const first=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='ASSISTANCE_REVIEW'",[a.realmId,target])).rows[0];
   if(!first)throw new NotFoundException("Assistance review unavailable");
   const row=await this.source.guard(tx,a,first.assistance_review_ref,true);
   const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='ASSISTANCE_REVIEW' FOR UPDATE",[a.realmId,target])).rows[0];
   if(!c||c.proposer_id===a.accountId||row.created_by===a.accountId)throw new ForbiddenException("An independent reviewer is required");
   const prior=(await tx.query<{actor_id:string;request_digest:string}>("SELECT actor_id,request_digest FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[a.realmId,c.id,key])).rows[0];
   if(prior){if(prior.actor_id!==a.accountId||prior.request_digest!==hash)throw conflict();return {state:row.state,replayed:true};}
   if(c.revision!==expected||c.status!=="SUBMITTED"||row.state!=="SUBMITTED"||row.revision!==2||row.approval_case_ref!==c.id||row.source_digest!==c.assistance_source_digest)throw conflict();
   await this.source.context(tx,a,row.branch_ref,row.project_ref,row.activity_ref,row.visit_ref,row.campaign_ref);
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const state=action==="APPROVE"?"APPROVED":action==="RETURN"?"RETURNED":"REJECTED",caseState=state==="APPROVED"?"PENDING_OWNER":state;
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4",[a.realmId,c.id,caseState,expected]);
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())",[a.realmId,c.id,a.accountId,action,expected,expected+1,key,hash,remarks]);
   await this.event(tx,a,c,state==="APPROVED"?"FINAL_APPROVED":state,remarks);
   const updated=await tx.query("UPDATE assistance_case SET state=$3,revision=3,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND revision=2 RETURNING id",[a.realmId,row.id,state]);
   if(!updated.rowCount)throw conflict();
   await this.source.event(tx,a,row.id,key,state,hash,3);
   if(state==="APPROVED"){await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,c.id]);await this.event(tx,a,c,"OWNER_COMPLETED");}
   return {state,replayed:false};
  });
 }
}
