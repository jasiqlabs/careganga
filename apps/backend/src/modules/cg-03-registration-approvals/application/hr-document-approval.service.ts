import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HrDocumentSourceFacade,type HrDocumentRow} from "../../cg-10-human-resources/application/hr-document-source.facade";
import {leaveId} from "../../cg-10-human-resources/application/hr-leave-source.facade";
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Case={id:string;case_number:string;process_id:string;status:string;revision:number;current_step:number;proposer_id:string;
 hr_document_request_id:string;hr_document_source_digest:string;proposal_revision:number;request_key:string;request_digest:string};
export function parseHrDocumentDecision(body:unknown){
 if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!["requestKey","expectedRevision","action","currentPassword"].includes(k)))
  throw new BadRequestException("Check the document review");
 const x=body as Record<string,unknown>;
 if(!Number.isSafeInteger(x.expectedRevision)||Number(x.expectedRevision)<1||typeof x.action!=="string"||
  !["APPROVE","RETURN","REJECT"].includes(x.action)||typeof x.currentPassword!=="string"||
  x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024)throw new BadRequestException("Confirm the original review and current password");
 return {requestKey:leaveId(x.requestKey),expectedRevision:Number(x.expectedRevision),action:x.action as "APPROVE"|"RETURN"|"REJECT",password:x.currentPassword};
}
@Injectable()
export class HrDocumentApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly owner:ProtectedAccessOwnerService,
  private readonly source:HrDocumentSourceFacade){}
 private stale():never{throw new ConflictException("The original document request has changed. Refresh before retrying.");}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
   const v=await fn(tx);await tx.query("COMMIT");return v;
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async root(tx:PoolClient,realm:string){
  if(!(await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[realm])).rowCount)throw new ForbiddenException();
 }
 private async reviewActor(token:string){
  await this.sessions.requireAction(token,"hr.documents.review");return this.sessions.requireAction(token,"approvals.review");
 }
 private async reviewRights(tx:PoolClient,a:VerifiedFoundationActor){
  await this.identity.assertCurrent(tx,a,"hr.documents.review");await this.owner.verifyReviewer(tx,a,"approvals.review",true);
 }
 private async event(tx:PoolClient,realm:string,caseRef:string,actor:string,action:string){
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",
   [realm,caseRef,actor,action,randomUUID()]);
 }
 private async exact(tx:PoolClient,realm:string,ref:string,lock=false){
  const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='HR_DOCUMENT_REVIEW'"+(lock?" FOR UPDATE":" FOR SHARE"),[realm,ref])).rows[0];
  if(!c)throw new NotFoundException("Document review unavailable");
  const row=await this.source.original(tx,realm,c.hr_document_request_id,lock);
  if(row.case_ref!==c.id||row.source_digest!==c.hr_document_source_digest||row.revision!==c.proposal_revision||row.created_by!==c.proposer_id)this.stale();
  return {c,row};
 }
 async subjects(token:string,kind:string,search=""){
  const actor=await this.sessions.requireAction(token,"hr.documents.manage");
  return this.run(tx=>this.source.subjects(tx,actor,kind,search));
 }
 async create(token:string,body:unknown){
  const a=await this.sessions.requireAction(token,"hr.documents.manage");
  return this.run(async tx=>{await this.root(tx,a.realmId);return this.source.create(tx,a,body);});
 }
 async submit(token:string,ref:string,body:unknown){
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!["requestKey","expectedRevision"].includes(k)))throw new BadRequestException("Check the request");
  const v=body as Record<string,unknown>,requestKey=leaveId(v.requestKey),expected=Number(v.expectedRevision);
  if(!Number.isSafeInteger(v.expectedRevision)||expected<1)throw new BadRequestException("Check the original document revision");
  const a=await this.sessions.requireAction(token,"hr.documents.manage");
  return this.run(async tx=>{
   await this.root(tx,a.realmId);await this.identity.assertCurrent(tx,a,"hr.documents.manage");
   const row=await this.source.requester(tx,a,ref,true),digest=hash(["HR_DOCUMENT_SUBMIT",row.id,row.source_digest,expected]);
   if(row.case_ref){
    const {c}=await this.exact(tx,a.realmId,row.case_ref);
    if(c.request_key!==requestKey||c.request_digest!==digest)this.stale();
    return {...this.source.summary(row),caseReference:c.case_number,replayed:true};
   }
   if(row.status!=="DRAFT"||row.revision!==expected)this.stale();
   const subject=await this.source.verifyCurrent(tx,a,row);
   await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
   // Never confuse HR document approval with the recipient's login or access case.
   let process=(await tx.query<{id:string}>("SELECT id FROM cg03_process WHERE realm_id=$1 AND process_kind='HR_DOCUMENT_REVIEW' FOR SHARE",[a.realmId])).rows[0]?.id;
   if(!process){
    const ver=(await tx.query<{next:number}>("SELECT COALESCE(MAX(version),0)+1 AS next FROM cg03_process WHERE realm_id=$1",[a.realmId])).rows[0].next;
    process=(await tx.query<{id:string}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) VALUES($1,$2,NULL,$3,'HR_DOCUMENT_REVIEW') RETURNING id",[a.realmId,ver,a.accountId])).rows[0].id;
    await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[process]);
   }
   const c=(await tx.query<Case>(`INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,
    target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,
    proposal_revision,proposal_digest,request_digest,request_key,case_kind,hr_document_request_id,hr_document_source_digest)
   SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,$3,$4,NULL,NULL,
    $5,$6,$7,$8,'HR_DOCUMENT_REVIEW',$9,$6 FROM cg03_process p WHERE p.realm_id=$1 AND p.id=$10 AND p.process_kind='HR_DOCUMENT_REVIEW' RETURNING *`,
    [a.realmId,a.accountId,subject.recipient,row.kind,row.revision,row.source_digest,digest,requestKey,row.id,process])).rows[0];
   if(!c)this.stale();
   const linked=await tx.query("UPDATE hr_document_request SET status='SUBMITTED',case_ref=$3 WHERE root_realm_id=$1 AND id=$2 AND status='DRAFT' RETURNING id",[a.realmId,row.id,c.id]);
   if(!linked.rowCount)this.stale();await this.event(tx,a.realmId,c.id,a.accountId,"SUBMITTED");
   return {...this.source.summary(await this.source.original(tx,a.realmId,row.id)),caseReference:c.case_number,replayed:false};
  });
 }
 async inbox(token:string,offsetInput:unknown){
  const a=await this.reviewActor(token),offset=Number(offsetInput??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw new BadRequestException("Check the review page");
  return this.run(async tx=>{
   await this.reviewRights(tx,a);
   const q=await tx.query<{case_ref:string;case_number:string;case_status:string;case_revision:number;reference:string;kind:string;recipient:string;status:string}>(`
    SELECT c.id AS case_ref,c.case_number,c.status AS case_status,c.revision AS case_revision,h.reference,h.kind,h.status,c.account_name_snapshot AS recipient
    FROM cg03_case c JOIN hr_document_request h ON h.root_realm_id=c.realm_id AND h.id=c.hr_document_request_id
     AND h.case_ref=c.id AND h.source_digest=c.hr_document_source_digest AND h.revision=c.proposal_revision
    WHERE c.realm_id=$1 AND c.case_kind='HR_DOCUMENT_REVIEW' ORDER BY c.submitted_at DESC,c.id DESC LIMIT 26 OFFSET $2`,[a.realmId,offset]);
   return {items:q.rows.slice(0,25).map(x=>({caseRef:x.case_ref,caseReference:x.case_number,reference:x.reference,status:x.status,caseStatus:x.case_status,kind:x.kind,recipient:x.recipient,revision:x.case_revision})),hasMore:q.rows.length>25,offset};
  });
 }
 private async distinct(tx:PoolClient,actor:VerifiedFoundationActor,row:HrDocumentRow){
  if(row.created_by===actor.accountId)return false;
  const q=await tx.query("SELECT 1 FROM hr_employee WHERE root_realm_id=$1 AND id=$2 AND account_ref=$4 UNION ALL SELECT 1 FROM hr_employee_application WHERE root_realm_id=$1 AND id=$3 AND applicant_account_ref=$4",[actor.realmId,row.employee_id,row.application_id,actor.accountId]);
  return !q.rowCount;
 }
 async detail(token:string,ref:string){
  const a=await this.reviewActor(token);return this.run(async tx=>{
   await this.reviewRights(tx,a);const {c,row}=await this.exact(tx,a.realmId,leaveId(ref));
   return {...this.source.summary(row),caseRef:c.id,caseReference:c.case_number,caseStatus:c.status,revision:c.revision,
    canReview:row.status==="SUBMITTED"&&await this.distinct(tx,a,row)};
  });
 }
 async decide(token:string,ref:string,body:unknown){
  const a=await this.reviewActor(token),d=parseHrDocumentDecision(body);await this.sessions.limitFoundationRootProof(a);
  return this.run(async tx=>{
   await this.root(tx,a.realmId);await this.reviewRights(tx,a);
   const {c,row}=await this.exact(tx,a.realmId,leaveId(ref),true);
   if(!await this.distinct(tx,a,row))throw new ForbiddenException("Another authorized reviewer must decide");
   const digest=hash([d.action,d.expectedRevision]),old=(await tx.query<{actor_id:string;request_digest:string}>("SELECT actor_id,request_digest FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[a.realmId,c.id,d.requestKey])).rows[0];
   if(old){if(old.actor_id!==a.accountId||old.request_digest!==digest)this.stale();return {confirmed:true,status:row.status,reference:c.case_number,replayed:true};}
   if(row.status!=="SUBMITTED"||!["SUBMITTED","IN_REVIEW"].includes(c.status)||c.revision!==d.expectedRevision)this.stale();
   if(!(await tx.query("SELECT 1 FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2 AND protected_root_required AND capability_key='approvals.review' FOR SHARE",[c.process_id,c.current_step])).rowCount)this.stale();
   await this.sessions.requireFreshFoundationRootProof(tx,a,d.password);
   if(d.action==="APPROVE")await this.source.verifyCurrent(tx,a,row);
   const next=d.action==="APPROVE"?"FINAL_APPROVED":d.action==="RETURN"?"RETURNED":"REJECTED",status=d.action==="APPROVE"?"APPROVED":next;
   if(!(await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4 RETURNING id",[a.realmId,c.id,next,c.revision])).rowCount)this.stale();
   const rec=(await tx.query<{id:string}>(`INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at)
    VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'',now()) RETURNING id`,[a.realmId,c.id,a.accountId,d.action,c.revision,c.revision+1,d.requestKey,digest])).rows[0];
   const saved=await tx.query("UPDATE hr_document_request SET status=$3,decision_ref=$4,decided_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' RETURNING id",
    [a.realmId,row.id,status,rec.id]);
   if(!saved.rowCount)this.stale();await this.event(tx,a.realmId,c.id,a.accountId,next);
   return {confirmed:true,status,reference:c.case_number,replayed:false};
  });
 }
 /** CG19 receives the authoritative exact final source, never caller-supplied approval. */
 async approvedSource(tx:PoolClient,actor:VerifiedFoundationActor,row:HrDocumentRow){
  if(row.status!=="APPROVED"||!row.case_ref||!row.decision_ref)this.stale();
  const {c}=await this.exact(tx,actor.realmId,row.case_ref);
  if(c.status!=="FINAL_APPROVED")this.stale();
  const proof=await tx.query(`SELECT d.id FROM cg03_case_decision d JOIN cg03_process_step st ON st.process_id=$5 AND st.ordinal=d.step_ordinal
   WHERE d.realm_id=$1 AND d.case_id=$2 AND d.id=$3 AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
    AND d.accepted_case_revision=$4 AND d.actor_id<>$6 AND st.protected_root_required AND st.capability_key='approvals.review'`,
   [actor.realmId,c.id,row.decision_ref,c.revision,c.process_id,c.proposer_id]);
  if(!proof.rowCount)this.stale();
  await this.source.verifyCurrent(tx,actor,row);
  return c;
 }
}
